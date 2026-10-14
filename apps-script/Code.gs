const PROP_ID = 'PARKING_SPREADSHEET_ID';
const SHEET_PAYMENTS = 'Cobros';
const SHEET_CLOSURES = 'Cierres';

/**
 * Ejecutar setup() una sola vez desde el editor de Apps Script.
 * Crea el Google Sheet central y guarda su ID en las propiedades del proyecto.
 */
function setup() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty(PROP_ID);
  let ss;
  if (id) {
    ss = SpreadsheetApp.openById(id);
  } else {
    ss = SpreadsheetApp.create('MAM - Cobros de estacionamiento');
    props.setProperty(PROP_ID, ss.getId());
  }
  ensureSheet_(ss, SHEET_PAYMENTS, ['id','fechaISO','fecha','hora','ticket','entrada','salida','minutos','total','operador','estado','equipo']);
  ensureSheet_(ss, SHEET_CLOSURES, ['id','fechaISO','fecha','hora','operador','cantidad','total','ticketsJSON','equipo']);
  Logger.log('Hoja central: ' + ss.getUrl());
  return ss.getUrl();
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.appendRow(headers);
  return sh;
}

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'ping';
  let result;
  try {
    const ss = openDb_();
    if (action === 'ping') {
      result = { ok: true, message: 'Conexión activa' };
    } else if (action === 'listPayments') {
      result = { ok: true, data: readObjects_(ss.getSheetByName(SHEET_PAYMENTS)) };
    } else if (action === 'listClosures') {
      result = { ok: true, data: readObjects_(ss.getSheetByName(SHEET_CLOSURES)) };
    } else {
      result = { ok: false, error: 'Acción GET no reconocida' };
    }
  } catch (err) {
    result = { ok: false, error: String(err) };
  }
  const callback = e && e.parameter && e.parameter.callback;
  const output = callback
    ? ContentService.createTextOutput(callback + '(' + JSON.stringify(result) + ');').setMimeType(ContentService.MimeType.JAVASCRIPT)
    : ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  return output;
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const ss = openDb_();
    const action = body.action;
    const item = body.data || {};
    if (action === 'addPayment') {
      const sh = ss.getSheetByName(SHEET_PAYMENTS);
      const id = String(item.id || Utilities.getUuid());
      if (!existsId_(sh, id)) {
        sh.appendRow([id, item.fechaISO || '', item.fecha || '', item.hora || '', item.ticket || '', item.entrada || '', item.salida || '', Number(item.minutos || 0), Number(item.total || 0), item.operador || 'No indicado', item.estado || 'PAGADO', item.equipo || '']);
      }
      return json_({ ok: true, id: id });
    }
    if (action === 'addClosure') {
      const sh = ss.getSheetByName(SHEET_CLOSURES);
      const id = String(item.id || Utilities.getUuid());
      if (!existsId_(sh, id)) {
        sh.appendRow([id, item.fechaISO || '', item.fecha || '', item.hora || '', item.operador || 'No indicado', Number(item.cantidad || 0), Number(item.total || 0), JSON.stringify(item.tickets || []), item.equipo || '']);
      }
      return json_({ ok: true, id: id });
    }
    return json_({ ok: false, error: 'Acción POST no reconocida' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

function openDb_() {
  const id = PropertiesService.getScriptProperties().getProperty(PROP_ID);
  if (!id) throw new Error('Primero ejecute setup() en Apps Script.');
  return SpreadsheetApp.openById(id);
}

function readObjects_(sh) {
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getDataRange().getValues();
  const headers = values.shift();
  return values.map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i] instanceof Date ? row[i].toISOString() : row[i]);
    if (obj.ticketsJSON) {
      try { obj.tickets = JSON.parse(obj.ticketsJSON); } catch (e) { obj.tickets = []; }
      delete obj.ticketsJSON;
    }
    return obj;
  });
}

function existsId_(sh, id) {
  if (!sh || sh.getLastRow() < 2) return false;
  return sh.getRange(2, 1, sh.getLastRow() - 1, 1).createTextFinder(id).matchEntireCell(true).findNext() !== null;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}