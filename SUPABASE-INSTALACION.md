# Configuración de Supabase — COBRO POR INCIDENCIAS

## Qué contiene este repositorio
- `supabase-setup.sql`: tablas de perfiles, pagos y cierres; políticas de seguridad iniciales.
- La aplicación publicada todavía necesita configurar Supabase y conectar sus pantallas a estas tablas. No se debe usar como sistema central hasta terminar esa integración y probar permisos.

## 1. Crear el proyecto
1. Abra https://supabase.com/dashboard y cree un proyecto.
2. En el proyecto, abra SQL Editor > New query.
3. Copie todo el archivo `supabase-setup.sql` de este repositorio, péguelo y pulse Run.
4. Abra Authentication > Users y cree el usuario inicial de la administradora.

## 2. Dar rol de administradora
En SQL Editor, ejecute el bloque siguiente reemplazando el correo por el correo exacto de la administradora:

```sql
insert into public.profiles (id, display_name, role, active)
select id, 'Administradora', 'admin', true
from auth.users
where email = 'TU_CORREO@EJEMPLO.COM'
on conflict (id) do update
set display_name = 'Administradora', role = 'admin', active = true;
```

Compruebe que se creó una fila en Table Editor > profiles.

## 3. Datos de conexión
Abra Connect o Project Settings > API Keys y copie:
- Project URL
- Publishable key (sb_publishable_...) o la antigua anon key si ese es el formato que muestra el proyecto.

No copie la secret key ni service_role a GitHub, al navegador ni al chat. La clave pública solo es segura cuando las políticas RLS están activadas y verificadas.

## 4. Importante
El esquema crea las tablas y políticas iniciales, pero no termina por sí solo la conexión de la página. Antes de ponerlo en producción hay que conectar el inicio de sesión, las operaciones de cobro y cierre a Supabase, y probar con una cuenta de operador y otra de administradora. No guarde contraseñas en tablas propias; use Supabase Auth.
