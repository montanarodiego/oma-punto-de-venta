# Deploy y Operaciones — OmaTech POS

## Publicar un nuevo release

### 1. Bump de versión
Editar `package.json`, campo `"version"`. Formato: `MAJOR.MINOR.PATCH`.

```bash
# Ejemplo: subir a v2.4.0
# Editar manualmente package.json → "version": "2.4.0"
```

### 2. Generar el instalador

```bash
npm run dist
```

Produce en `dist/`:
- `OmaTech.POS.Setup.2.4.0.exe` — instalador NSIS
- `latest.yml` — manifiesto para el auto-updater

> **CRÍTICO:** el nombre del `.exe` debe coincidir exactamente con el campo `path:` en `latest.yml`. Si no coincide, el auto-updater falla con 404. El `artifactName` en `package.json` usa puntos (`OmaTech.POS.Setup.${version}.exe`) — no cambiar ese formato.

### 3. Publicar en GitHub

```bash
# Escribir las notas de release en un archivo temporal
cat > dist/release-notes.md << 'EOF'
## Cambios en v2.4.0
- ...
EOF

# Crear el release
gh release create v2.4.0 \
  "dist/OmaTech.POS.Setup.2.4.0.exe" \
  "dist/latest.yml" \
  --title "OmaTech POS v2.4.0" \
  --notes-file dist/release-notes.md

# Limpiar
rm dist/release-notes.md
```

> Requiere `GH_TOKEN` en `.env` con permiso `repo` o `write:packages`.

### 4. Verificar auto-updater
Al publicar el release, los clientes con la app abierta recibirán la notificación de actualización en los próximos 30 minutos (o al reiniciar).

---

## Activar un cliente nuevo

> ⚠️ **Movido.** El alta de cliente y la renovación/suspensión de licencias viven ahora
> en un único runbook: **[ALTA-CLIENTE.md](ALTA-CLIENTE.md)**.
>
> El modelo cambió: la activación es por **`licenseKey` en pantalla** (custom token
> scopeado al negocio), **no** por email/contraseña de Firebase ni con la config de
> Firebase horneada en `oma-creds.json`. Ese flujo viejo quedó obsoleto y se removió de
> acá para no inducir a error. Para alta, renovar, suspender y onboarding fiscal, ver
> [ALTA-CLIENTE.md](ALTA-CLIENTE.md).

---

## Resetear contraseña de usuario local

El sistema de contraseñas locales usa bcryptjs. No hay recuperación por email para usuarios locales.

**Opción 1 — Desde la app (solo admin puede hacer esto):**
1. Configuración → Usuarios del sistema
2. Editar el usuario → cambiar contraseña

**Opción 2 — Directo en SQLite (si el admin perdió su contraseña):**

```bash
# Generar hash de la nueva contraseña (ej: "nueva1234")
node -e "const b=require('bcryptjs'); console.log(b.hashSync('nueva1234', 10))"

# Actualizar en la DB (app debe estar cerrada)
# DB en: %APPDATA%\oma-punto-de-venta\oma-pos.db
sqlite3 "%APPDATA%\oma-punto-de-venta\oma-pos.db" \
  "UPDATE usuarios SET password_hash = '<hash>' WHERE usuario = 'admin';"
```

> Si no tenés `sqlite3` instalado, usá DB Browser for SQLite (GUI).

---

## Restaurar un backup

### Desde la UI (recomendado)
1. Configuración → Backup y Restauración
2. Seleccionar el archivo `.db` de la lista de backups automáticos
3. Confirmar → la app hace un backup preventivo del estado actual, restaura y reinicia

### Manual (si la app no arranca)
1. Cerrar la app
2. Los backups están en `%APPDATA%\oma-punto-de-venta\backups\`
3. Copiar el backup deseado sobre `%APPDATA%\oma-punto-de-venta\oma-pos.db`
4. Abrir la app

### Reparar índices FTS5 corruptos
Si al guardar artículos aparece `SQLITE_CORRUPT_VTAB`:

```bash
# Con la app cerrada:
npx electron scripts/recover-db.js
```

El script hace un backup automático antes de tocar nada. Si el rebuild falla, recrea el índice desde cero sin pérdida de datos.

---

## Variables de entorno

Archivo `.env` en la raíz (no commitear):

| Variable | Propósito |
|----------|-----------|
| `GH_TOKEN` | Token de GitHub para publicar releases |
| `GMAIL_USER` | Cuenta Gmail del mailer de soporte |
| `GMAIL_APP_PASSWORD` | App Password de Gmail (no la contraseña de la cuenta) |

Las credenciales Gmail también deben estar en `src/main/credentials.js`:

```js
module.exports = {
  GMAIL_USER:         'cuenta@gmail.com',
  GMAIL_APP_PASSWORD: 'xxxx xxxx xxxx xxxx',
};
```

Copiar desde `credentials.example.js` y completar con valores reales.

---

## Ubicaciones importantes (Windows)

| Recurso | Ruta |
|---------|------|
| Base de datos | `%APPDATA%\oma-punto-de-venta\oma-pos.db` |
| Backups | `%APPDATA%\oma-punto-de-venta\backups\` |
| Token de licencia | `%APPDATA%\oma-punto-de-venta\license.json` |
| Logs de Electron | `%APPDATA%\oma-punto-de-venta\logs\` |
| Instalador generado | `dist\OmaTech.POS.Setup.<versión>.exe` |
