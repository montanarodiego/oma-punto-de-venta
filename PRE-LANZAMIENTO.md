# Pre-lanzamiento — Checklist de release (primer cliente)

Estado al preparar el lanzamiento comercial con facturación electrónica AFIP/ARCA.
Marcá cada ítem antes de entregar el instalador al cliente.

## ✅ Hecho en esta ronda de hardening

- **Facturación recableada al módulo correcto.** La venta en modo fiscal ahora emite con
  el certificado del comercio (cifrado), su CUIT, su punto de venta y su **ambiente real**
  (producción/homologación). Persiste el CAE en `comprobantes_fiscales` (respaldo legal +
  reimpresión). Idempotente por transacción. Se retiró el módulo viejo (`@afipsdk/afip.js`,
  homologación y CUIT hardcodeados, sin persistencia).
- **Flujo "el cajero decide" ante fallo de AFIP.** La venta siempre se registra; si AFIP
  falla, overlay con *Reintentar* / *Registrar sin factura* (queda pendiente). Nunca bloquea.
- **Cuenta de sync segura (CUSTOM_TOKEN).** El build activa por `license_key` (scopeado al
  negocio). `oma-creds.json` ya **no** contiene credenciales maestras de Firebase.
- **Hardening Electron.** `sandbox:true` explícito en ambas ventanas; bloqueo de
  `window.open` y de navegación externa (`will-navigate`); CSP estricta verificada.
- **Validado:** `tsc` limpio, suite de tests verde, build de producción del renderer OK.

## ⛔ Bloqueante antes de vender — PROBAR EMISIÓN REAL

- [ ] **Smoke test de facturación en homologación** con el certificado del cliente:
  onboarding fiscal → *Probar conexión* → una venta en modo fiscal → verificar que devuelve
  CAE y que el comprobante queda guardado y reimprimible. Recién después, pasar a producción.
- [ ] Confirmar **condición fiscal del cliente**: Monotributo → Factura C (exacto, listo).
      Responsable Inscripto → A/B: revisar la reconciliación de IVA por línea cuando hay
      descuento global (ver "Deuda conocida").

## 🔧 Pasos de release (ops)

- [ ] Pegar el `oma-creds.json` del cliente (solo `license_key` + Gmail si se usan reportes)
      antes de `npm run dist`. **Nunca** commitear este archivo (ya está en `.gitignore`).
- [ ] `npm run dist` → verificar `dist/latest.yml` (campo `path` == nombre del `.exe`).
- [ ] Deploy de reglas Firestore endurecidas: revisar `firestore.rules.post-migracion`
      (sin la cuenta de sync compartida) y deployar cuando el cliente esté en CUSTOM_TOKEN.
- [ ] Bump de versión (actual `2.3.1` → sugerido `2.4.0` por la feature fiscal) + release.

## 📌 Deuda conocida (documentada, no bloquea al primer cliente)

- **Code signing ausente.** SmartScreen va a advertir en la instalación; el auto-updater
  verifica SHA512 pero no firma Authenticode. Decisión de negocio (cert OV/EV ~USD 200-500/año).
  Instalación asistida para el primer cliente.
- **`xlsx` (SheetJS) — vuln high sin fix en npm** (prototype pollution + ReDoS al parsear
  `.xlsx`). Riesgo acotado: el dueño importa **sus propios** archivos en local. Mitigación
  oficial: instalar desde el CDN de SheetJS (`https://cdn.sheetjs.com`) en vez de npm.
- **Vulns transitivas de Firebase SDK / `undici`** (moderate). Actualizar el SDK con cuidado
  en una ventana de testing; no romper auth/sync.
- **Secreto Gmail compartido.** `GMAIL_APP_PASSWORD` viaja en `oma-creds.json` a cada cliente
  (reportes por email corren client-side). Recomendado: mover el envío de reportes al backend
  (OMA Manager) o no incluir las credenciales en el build (la feature degrada con aviso claro).
- **Encriptación de la clave fiscal.** Hoy se cifra con clave derivada del salt en disco
  (atada a la instalación). `safeStorage` (DPAPI) la ataría a la cuenta de Windows — más
  fuerte. Migrable sin dolor mientras el cliente no tenga cert cargado.
- **Paths legacy en `main.js`.** Las ramas de la cuenta de sync compartida quedan como código
  muerto (sin credenciales que las disparen). Se pueden eliminar tras confirmar CUSTOM_TOKEN.

## 🧪 Camino crítico a verificar (smoke test general)

abrir app → activar licencia (CUSTOM_TOKEN) → login local → cargar productos →
registrar venta (modo fiscal: CAE OK) → cerrar turno (corte Z) → reconectar y sincronizar.
