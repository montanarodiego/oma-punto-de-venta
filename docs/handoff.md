# Handoff — Estado actual del POS

> Documento de traspaso. Resume cómo está armado OmaTech POS **hoy**, qué se tocó
> en las últimas sesiones, cómo correrlo/testearlo y qué queda pendiente.
> Para el detalle de arquitectura por módulo, ver [arquitectura.md](arquitectura.md).

---

## 1. Qué es y cómo se compone

OmaTech POS es una app de escritorio (Electron) **offline-first** para kioscos/PyMEs.
El sistema completo son **dos repos**:

| Repo | Qué es | Dónde |
|------|--------|-------|
| `oma-punto-de-venta` | El POS de escritorio (este repo) | Electron + React + SQLite |
| `oma-manager` | Panel admin del vendedor (licencias) | Next.js en Vercel → `oma-manager.vercel.app` |

**Hay dos capas de identidad que NO hay que confundir:**

1. **Licencia (nube)** — la maneja el vendedor en `oma-manager`. Da de alta clientes,
   genera un **`licenseKey`** (`OMA-XXXX-...`), y puede **suspender / extender**. Controla
   si el POS puede funcionar. Vive en Firestore: `negocios/{negocioId}.licencia`.
2. **Usuario operador (local)** — el admin/cajero que opera la caja. Vive en SQLite local
   (`usuarios`, bcrypt). Lo crea el **cliente en su PC** (pantalla Setup el primero, el resto
   en Configuración → Usuarios). Es local **a propósito**: el POS tiene que poder loguear
   para vender **sin internet**.

> Lo que el vendedor le envía al cliente es el **licenseKey**, no un usuario/contraseña.

---

## 2. Cambios recientes (lo último que se trabajó)

Rama de trabajo: **`feat/activacion-licensekey`** (mergeada a `main` en este handoff).

1. **Fix de login** (`usuarios.login`): tolerante a mayúsculas/espacios (`LOWER()` + `trim`).
   Antes tiraba "usuario o contraseña incorrectos" si la capitalización no era idéntica.
2. **Registro pide email** (`Setup.tsx`): el primer admin ahora exige email — es el único
   canal de recuperación de contraseña.
3. **Recuperación honesta** (`auth:solicitarReset`): avisa si el email no está registrado
   en vez de mentir con "código enviado".
4. **Limpieza de caché al actualizar** (`main.js`): al cambiar la versión instalada se
   limpia la caché de Electron (evita arrancar con "interfaz vieja"). **No toca la base.**
5. **Activación por clave en pantalla** (esta feature, ver sección 3): el POS dejó de
   depender del `licenseKey` horneado en el instalador.
6. **Anti doble-cobro** (`ModalCobro.tsx`): lock síncrono (`cobrandoRef`) antes del primer
   `await`, cierra la ventana de doble disparo (doble-click / Enter + F1).

---

## 3. Modelo de licencias / activación (estado nuevo)

**Antes:** el `licenseKey` venía **horneado** en `oma-creds.json` dentro del instalador →
obligaba a un instalador por cliente (o todos compartían el mismo negocio). Inseguro.

**Ahora:** la primera vez que se abre una instalación sin activar, el POS **pide la clave
en pantalla**, la valida online y la guarda cifrada en el dispositivo.

Flujo:
```
Pantalla "Activar OmaTech POS"  (renderer: pages/Activacion.tsx)
      │  el cliente pega su licenseKey
      ▼
window.api.licencia.activar(key)   →  IPC 'licencia:activar' (main.js)
      ▼
activacion.activar(auth, key)  →  POST oma-manager /api/activar { licenseKey }
      ▼
oma-manager valida (hash en Firestore) y devuelve { token, negocioId, vencimiento }
      ▼
signInWithCustomToken(token)  →  uid == negocioId  (Firestore rules: auth.uid == negocioId)
      ▼
activacion.guardarLicenseKey(key)  →  cifra con safeStorage/DPAPI en userData/oma-license-key
      ▼
guardarTokenLocal(...)  →  license.json (token offline)  →  sigue a Setup/Login
```

Piezas clave:
- `src/main/activacion.js` — `leerLicenseKey()` (store cifrado → env `OMA_LICENSE_KEY` →
  `oma-creds.json` legacy), `guardarLicenseKey()` (DPAPI), `activar()` (network + custom token).
- `src/main/main.js` — handlers IPC `licencia:estado` y `licencia:activar`.
- `src/renderer/App.tsx` — **gating de arranque**: chequea licencia ANTES que usuarios.
  `checking → needs-activation → (no-users | ready)`.
- `src/renderer/pages/Activacion.tsx` — la pantalla.

**Compatibilidad:** instalaciones viejas con token local válido (o key horneada) dan
`activado=true` → no ven la pantalla. **No se rompe ningún cliente en uso normal.**

**Endpoint** (oma-manager): `/api/activar` (validado en vivo, responde 200 + custom token).
Default configurable: `OMA_ACTIVAR_URL` (env) o `activar_url` en `oma-creds.json`.

---

## 4. Cómo correr y testear (dev)

```bash
npm install
npm run dev        # Vite en :5173 + Electron
```

**Ver la pantalla de Activación** (forzar estado "no activado", sin borrar la base):
```powershell
# con la app cerrada
$d = "$env:APPDATA\oma-punto-de-venta"
Remove-Item "$d\license.json","$d\oma-license-key" -Force -ErrorAction SilentlyContinue
npm run dev
```
Después pegar un `licenseKey` válido (se genera en oma-manager → Alta de cliente).

**Saltear la pantalla en testing** (no tipear la clave):
```powershell
$env:OMA_LICENSE_KEY = "OMA-XXXX-..."; npm run dev
```

**Reset TOTAL** (cliente nuevo desde cero — ⚠️ borra la base local):
```powershell
Remove-Item -Recurse -Force "$env:APPDATA\oma-punto-de-venta"
```

Tests: `npm test` (corre los tests de contrato/cobro/actividad con Electron).

---

## 5. Cortar / extender servicio (oma-manager)

En `oma-manager` → `/admin/clientes`: botones **Suspender / Reactivar / Extender** por cliente.
- Suspender pone `licencia.activa = false` en Firestore.
- El POS lo detecta en su chequeo periódico (**cada 30 min** con internet) o al reiniciar →
  cierra con "Licencia suspendida".
- **Offline:** sigue funcionando con el token local hasta que venza; el corte necesita que
  la PC toque internet.

---

## 6. Builds y releases

```bash
npm run dist       # genera dist/OmaTech.POS.Setup.<ver>.exe + latest.yml
```
- `artifactName` con **puntos** (`OmaTech.POS.Setup.${version}.exe`) — crítico para que el
  auto-updater no falle con 404.
- Publicar: `gh release create vX.Y.Z dist/OmaTech.POS.Setup.X.Y.Z.exe dist/...blockmap dist/latest.yml`.
- El `latest.yml` debe quedar adjunto al release y su `path` coincidir con el `.exe`.
- Detalle completo en [deploy.md](deploy.md).

---

## 7. Pendientes / caveats conocidos

- **Migración de clientes viejos:** un install cuyo token caduque (>30 días sin abrir con
  internet) y sin key guardada caerá en la pantalla de activación → hay que tener su
  `licenseKey` nuevo a mano (generarlo en oma-manager y enviárselo).
- **Reglas Firestore objetivo:** `firestore.rules.post-migracion` (raíz del repo) tiene las
  reglas que eliminan la cuenta de sync compartida. **NO deployar todavía** — primero todos
  los clientes en el modelo custom-token.
- **Legacy a quitar:** en `main.js` quedan ramas para `firebase_email/password` (cuenta de
  sync compartida) marcadas con `[SEGURIDAD] LEGACY`. Sacar cuando no queden installs viejos.
- **`oma-creds.json`** ya no debe llevar `license_key` (se quitó). Solo GMAIL para el mailer.

---

## 8. Backup y recuperación

- **Todo está en el remoto** (`origin`): rama `main` (estado canónico) + la rama
  `feat/activacion-licensekey` (copia de la feature).
- **Tag de restore:** `handoff-nico` apunta al estado exacto de este traspaso. Para volver:
  ```bash
  git checkout handoff-nico        # ver el estado del handoff
  # o, para resetear main a ese punto (destructivo, con cuidado):
  git checkout main && git reset --hard handoff-nico
  ```
- **Archivos locales NO versionados** (cada dev necesita los suyos): `oma-creds.json`,
  `.env`, `src/main/credentials.js`. Pedírselos a Diego.
