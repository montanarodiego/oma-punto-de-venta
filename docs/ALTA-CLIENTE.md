# Alta de cliente nuevo — Runbook

> Documento **canónico** de onboarding. Cómo poner en funcionamiento OmaTech POS
> para un cliente nuevo, de punta a punta, con el modelo actual (activación por
> `licenseKey` + custom token + onboarding fiscal en la app).
>
> Si algo de `deploy.md` o de un doc viejo contradice esto, **vale esto**.
> Arquitectura por módulo: [arquitectura.md](arquitectura.md) · Estado general: [handoff.md](handoff.md).

---

## 0. Mapa mental (leer una vez)

Hay **dos repos** y **dos capas de identidad** que no se mezclan:

| | Qué | Dónde vive | Quién la crea |
|---|---|---|---|
| **Licencia (nube)** | Habilita que el POS funcione. Se identifica con un **`licenseKey`** (`OMA-XXXX-…`). | Firestore `negocios/{negocioId}.licencia`, gestionada desde **OMA Manager** (`oma-manager.vercel.app`). | **Vos (vendedor)**. |
| **Usuario operador (local)** | El admin/cajero que abre la caja. bcrypt en SQLite local. | `%APPDATA%\oma-punto-de-venta\oma-pos.db` | **El cliente**, en su PC. |

Reglas de oro:

- Al cliente le mandás **el `licenseKey`**, nunca un usuario/contraseña.
- El usuario local es local **a propósito**: el POS tiene que vender **sin internet**.
- El POS verifica la licencia online cada ~30 min; offline sigue con el token local
  hasta que venza.

---

## 1. Antes de empezar (pre-requisitos del vendedor)

- [ ] Acceso a **OMA Manager** y/o a la consola de Firebase del proyecto `omatechpos`.
- [ ] El instalador `OmaTech.POS.Setup.<versión>.exe` publicado (ver [deploy.md](deploy.md)).
  - El **mismo instalador sirve para todos los clientes**: la licencia ya **no** va
    horneada. El cliente pega su `licenseKey` en pantalla la primera vez.
- [ ] Datos del cliente a mano: nombre del comercio, condición fiscal (Monotributo /
  Responsable Inscripto), CUIT (si va a facturar), fecha de vencimiento de la licencia.

---

## 2. Paso a paso

### Paso A — Generar la licencia (lado vendedor, nube)

En **OMA Manager** → alta de cliente: se crea el `negocio` y se emite su **`licenseKey`**.
Esto deja en Firestore `negocios/{negocioId}.licencia` con:

```json
{ "activa": true, "vencimiento": <Timestamp> }
```

> El endpoint `https://oma-manager.vercel.app/api/activar` valida ese `licenseKey`
> (hash en Firestore) y devuelve un custom token scopeado al negocio. Está vivo y
> validado. **Guardá el `licenseKey` en un lugar seguro**: es lo único que se le manda
> al cliente y lo vas a necesitar para soporte/recuperación.

### Paso B — Entregar el instalador

Mandale al cliente:
1. El `.exe` (link al release de GitHub o el archivo).
2. Su **`licenseKey`** por un canal privado.

> ⚠️ SmartScreen va a advertir (no hay code signing todavía — deuda conocida).
> Avisale: "Más información → Ejecutar de todas formas".

### Paso C — Activación en pantalla (primera apertura)

Al abrir por primera vez, el POS detecta que no está activado y muestra
**"Activar OmaTech POS"** (`pages/Activacion.tsx`):

1. El cliente pega el `licenseKey`.
2. El POS llama `/api/activar`, valida online y guarda la clave **cifrada** (DPAPI) en
   `%APPDATA%\oma-punto-de-venta\oma-license-key`.
3. Hace `signInWithCustomToken` (uid == negocioId) y guarda el token offline.

Listo: a partir de acá no necesita internet para operar.

> **Tip de provisión sin que el cliente tipee:** si querés dejarlo pre-activado, podés
> hornear `license_key` en `src/main/credentials.js` / `oma-creds.json` del build, o
> exportar `OMA_LICENSE_KEY` en su PC. Para el caso normal **no hace falta**: que lo
> pegue en pantalla es lo más simple y permite un único instalador para todos.

### Paso D — Wizard de primer uso (usuario admin local)

Tras activar, aparece el **Setup**:

1. Crear el **usuario admin** (nombre, email, contraseña). El email es el canal de
   recuperación por mail (hoy degradado si el build no trae `GMAIL_*`).
2. El wizard genera y **muestra una sola vez** la **Clave de recuperación de dueño**
   (`OMA-REC-XXXX-XXXX`). En disco solo queda el hash.
   - 👉 **Que el cliente la guarde fuera de la PC.** Junto con el `licenseKey` es lo
     que permite "Recuperar acceso de administrador" si pierde la contraseña.
   - Si la instalación ya estaba configurada, se genera desde
     **Configuración → Clave de recuperación de dueño**.

### Paso E — Onboarding fiscal (solo si va a facturar AFIP/ARCA)

En **Configuración → Facturación** (`FiscalOnboarding`). La app evita que el cliente
toque OpenSSL: genera la clave privada (que **nunca** sale de la PC) y el CSR.

1. **Datos fiscales:** CUIT, razón social, condición frente al IVA (Monotributo → Factura C;
   RI → Factura A/B), punto de venta, y **ambiente: Homologación** primero. → *Guardar datos*.
2. **Paso 1 — Generar solicitud (.csr):** la app crea la clave + el CSR.
3. **Paso 2 — En ARCA** (con clave fiscal del cliente):
   - Administración de Certificados Digitales → crear alias, subir el `.csr`, descargar el `.crt`.
   - Administrador de Relaciones → asociar el certificado al servicio
     **"Facturación Electrónica" (wsfe)**.
4. **Importar el `.crt`** en la app (valida que corresponda a la clave generada acá).
5. **Probar conexión con ARCA** → debe dar OK en el ambiente elegido.
6. Smoke test en **Homologación** (venta en modo fiscal → CAE OK → comprobante guardado/
   reimprimible). Recién ahí cambiar **Ambiente → Producción** y volver a probar.
7. Activar **Modo fiscal** (toggle, atajo `Ctrl+Shift+F`).

> Si AFIP falla en una venta real, el POS **no bloquea**: registra la venta y ofrece
> *Reintentar* / *Registrar sin factura* (queda pendiente).

### Paso F — Carga inicial de datos

Con el cliente: rubros/categorías, artículos (alta manual o **importación Excel con
preview**), clientes y proveedores si usa cuenta corriente, y apertura de turno/caja.

### Paso G — Smoke test de entrega (hacelo siempre)

```
abrir → activación OK (CUSTOM_TOKEN) → login local → cargar un producto →
venta (modo fiscal: CAE OK si factura) → cerrar turno (corte Z imprime) →
reconectar y sincronizar → probar "Recuperar acceso de administrador".
```

---

## 3. Post-venta (lado vendedor, desde OMA Manager)

| Acción | Cómo | Efecto en el POS |
|---|---|---|
| **Renovar / extender** | Actualizar `licencia.vencimiento` | Se refleja en el próximo chequeo (~30 min) o reinicio. |
| **Suspender** | `licencia.activa = false` | El POS cierra con "Licencia suspendida" en ≤30 min (offline sigue hasta vencer el token). |
| **Reactivar** | `licencia.activa = true` | Vuelve a habilitar. |

> El corte por suspensión necesita que la PC toque internet. Offline, el token local
> aguanta hasta su vencimiento.

---

## 4. Soporte frecuente

- **El cliente perdió la contraseña de admin:** Login → **"Recuperar acceso de
  administrador"** → pide `licenseKey` (se lo das vos) **+** la clave de recuperación
  de dueño (la guardó él). Sin email de por medio.
- **Resetear contraseña de un cajero:** el admin entra a Configuración → Usuarios y la
  cambia. (Último recurso por SQLite: ver [deploy.md](deploy.md) → "Resetear contraseña".)
- **Restaurar datos:** Configuración → Backup y Restauración (hace backup preventivo,
  restaura y reinicia). Backups en `%APPDATA%\oma-punto-de-venta\backups\`.
- **Token caducó (>30 días sin internet) y sin key guardada:** vuelve a la pantalla de
  activación → reenviale su `licenseKey`.

---

## 5. Checklist rápido (copiar y pegar por cliente)

```
[ ] licenseKey generado en OMA Manager y guardado (vendedor)
[ ] Instalador enviado + licenseKey enviado por canal privado
[ ] Activación en pantalla OK (CUSTOM_TOKEN)
[ ] Usuario admin local creado
[ ] Clave de recuperación de dueño generada y guardada por el cliente (fuera de la PC)
[ ] (Si factura) Onboarding fiscal: CSR → ARCA → cert importado → wsfe asociado
[ ] (Si factura) Probar conexión ARCA OK en Homologación → venta de prueba con CAE
[ ] (Si factura) Pasado a Producción y reprobado → Modo fiscal activado
[ ] Carga inicial de datos (artículos / clientes / proveedores)
[ ] Smoke test de entrega completo
```

---

## Ubicaciones útiles (Windows)

| Recurso | Ruta |
|---|---|
| Base de datos | `%APPDATA%\oma-punto-de-venta\oma-pos.db` |
| Token de licencia (offline) | `%APPDATA%\oma-punto-de-venta\license.json` |
| licenseKey cifrado | `%APPDATA%\oma-punto-de-venta\oma-license-key` |
| Config / credencial fiscal | `%APPDATA%\oma-punto-de-venta\fiscal-config.json` · `fiscal-cred.json` |
| Backups | `%APPDATA%\oma-punto-de-venta\backups\` |
| Logs | `%APPDATA%\oma-punto-de-venta\logs\` |
