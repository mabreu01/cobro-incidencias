package com.mamparking.cobro;

import android.app.Activity;
import android.os.Bundle;
import android.os.RemoteException;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import com.sunmi.peripheral.printer.InnerPrinterCallback;
import com.sunmi.peripheral.printer.InnerPrinterException;
import com.sunmi.peripheral.printer.InnerPrinterManager;
import com.sunmi.peripheral.printer.SunmiPrinterService;

public class MainActivity extends Activity {
    private static final String APP_URL = "https://mabreu01.github.io/cobro-incidencias/";
    private WebView webView;
    private SunmiPrinterService printerService;
    private boolean printerReady = false;

    private final InnerPrinterCallback printerCallback = new InnerPrinterCallback() {
        @Override
        protected void onConnected(SunmiPrinterService service) {
            printerService = service;
            try {
                printerReady = InnerPrinterManager.getInstance().hasPrinter(service);
                runOnUiThread(() -> Toast.makeText(MainActivity.this,
                        printerReady ? "Impresora SUNMI lista" : "No se detectó la impresora SUNMI",
                        Toast.LENGTH_SHORT).show());
            } catch (InnerPrinterException e) {
                printerReady = false;
            }
        }

        @Override
        protected void onDisconnected() {
            printerService = null;
            printerReady = false;
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setSupportZoom(false);
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient());
        webView.addJavascriptInterface(new PrinterBridge(), "SunmiPrinter");
        setContentView(webView);
        webView.loadUrl(APP_URL);

        try {
            boolean bound = InnerPrinterManager.getInstance().bindService(this, printerCallback);
            if (!bound) {
                Toast.makeText(this, "No se pudo conectar con la impresora SUNMI", Toast.LENGTH_LONG).show();
            }
        } catch (InnerPrinterException e) {
            Toast.makeText(this, "Error conectando la impresora SUNMI", Toast.LENGTH_LONG).show();
        }
    }

    private void printContent(String text, String qrData) {
        if (printerService == null || !printerReady) {
            runOnUiThread(() -> Toast.makeText(this,
                    "La impresora SUNMI no está lista. Compruebe el equipo.", Toast.LENGTH_LONG).show());
            return;
        }
        try {
            printerService.printerInit(null);
            printerService.setAlignment(0, null);
            printerService.printText(normalize(text) + "\n", null);
            if (qrData != null && !qrData.trim().isEmpty()) {
                printerService.setAlignment(1, null);
                printerService.printQRCode(qrData, 6, 3, null);
                printerService.setAlignment(0, null);
            }
            printerService.lineWrap(4, null);
            try {
                printerService.autoOutPaper(null);
            } catch (RemoteException ignored) {
                printerService.lineWrap(3, null);
            }
            runOnUiThread(() -> Toast.makeText(this, "Enviado a la impresora SUNMI", Toast.LENGTH_SHORT).show());
        } catch (RemoteException e) {
            runOnUiThread(() -> Toast.makeText(this, "Error al imprimir: " + e.getMessage(), Toast.LENGTH_LONG).show());
        }
    }

    private String normalize(String text) {
        if (text == null) return "";
        return text.replace('\u00a0', ' ')
                   .replaceAll("[ \\t]+\\n", "\\n")
                   .replaceAll("\\n{3,}", "\\n\\n")
                   .trim();
    }

    private class PrinterBridge {
        @JavascriptInterface
        public boolean isReady() {
            return printerService != null && printerReady;
        }

        @JavascriptInterface
        public void printReceipt(String text, String qrData) {
            runOnUiThread(() -> printContent(text, qrData));
        }

        @JavascriptInterface
        public void printText(String text) {
            runOnUiThread(() -> printContent(text, null));
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        try {
            InnerPrinterManager.getInstance().unBindService(this, printerCallback);
        } catch (Exception ignored) {}
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
