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
  negocio). `oma-creds.json` ya solo contiene `license_key`: sin credenciales maestras de
  Firebase ni de Gmail.
- **Recuperación de admin sin email (doble factor).** Login → "Recuperar acceso de
  administrador": exige `licenseKey` (lo da OmaTech) **+ clave de recuperación de dueño**
  (se genera y se muestra una vez en el onboarding / Configuración; en disco solo el hash).
- **Degradación limpia de mail.** Sin `GMAIL_*` en el build, las features de mail (reset por
  email, soporte, cierre por mail, reporte de ventas) avisan con mensaje claro y NO rompen.
  Rutas críticas (ventas, stock, facturación) no dependen de mail.
- **Reglas Firestore endurecidas** (`firestore.rules`): sin cuenta de sync compartida, cada
  negocio accede solo a lo suyo (`uid == negocioId`). Verificado: el custom token trae
  `uid == negocioId`.
- **Hardening Electron.** `sandbox:true` explícito; bloqueo de `window.open` y navegación
  externa; CSP estricta verificada.
- **Validado:** `tsc` limpio, suite de tests verde, build de producción del renderer OK.

## 🔴 Acciones tuyas ANTES de vender (no las puedo hacer yo)

- [ ] **ROTAR el app password de Gmail comprometido.** El password `ajdhlcudqxpgarjg`
      (cuenta `oma.technologies.venta@gmail.com`) quedó en el historial de git (commit
      `4289b5d`) y en builds previos → es legible vía IMAP/POP. Revocalo en Google
      (Seguridad → Contraseñas de aplicación) y generá uno nuevo. Tratá la casilla como
      comprometida. (Opcional luego: limpiar el historial con BFG/filter-repo.)
- [ ] **Deployar las reglas Firestore endurecidas:** `firebase deploy --only firestore:rules`.
      Hasta entonces, la regla con acceso global (`esCuentaSync`) sigue vigente del lado
      servidor. Verificá en Rules Playground que un negocio NO pueda leer otro.
- [ ] **Smoke test de facturación en homologación** con el certificado del cliente:
      onboarding fiscal → *Probar conexión* → venta en modo fiscal → verificar CAE y que el
      comprobante quede guardado/reimprimible. Recién después, pasar a producción.
- [ ] Confirmar **condición fiscal del cliente** (Monotributo → Factura C, listo / Responsable
      Inscripto → A/B: revisar reconciliación de IVA por línea con descuento global).

## 🔧 Pasos de release (ops)

- [ ] El `oma-creds.json` del cliente debe tener **solo `license_key`** (ya está así). Sin
      `GMAIL_*` ni credenciales de Firebase. **Nunca** commitearlo (está en `.gitignore`).
- [ ] Asegurar que el cliente tenga generada su **clave de recuperación de dueño** (Setup la
      genera en instalaciones nuevas; en instalaciones ya configuradas, generarla desde
      Configuración → "Clave de recuperación de dueño"). Guardarla fuera de la PC.
- [ ] `npm run dist` → verificar `dist/latest.yml` (campo `path` == nombre del `.exe`).
- [ ] Bump de versión (actual `2.3.1` → sugerido `2.4.0` por la feature fiscal) + release.

## 📌 Deuda conocida (documentada, no bloquea al primer cliente)

- **Code signing ausente.** SmartScreen va a advertir; el auto-updater verifica SHA512 pero
  no firma Authenticode. Decisión de negocio (cert OV/EV ~USD 200-500/año).
- **`xlsx` (SheetJS) — vuln high sin fix en npm** (prototype pollution + ReDoS). Riesgo
  acotado: el dueño importa sus propios archivos en local. Mitigación: instalar desde el CDN
  de SheetJS en vez de npm.
- **Vulns transitivas de Firebase SDK / `undici`** (moderate). Actualizar con cuidado.
- **Envío de mail client-side.** Hoy sin `GMAIL_*` en el build, las features de mail quedan
  desactivadas. Mover el envío (al menos reset de contraseña, soporte) a OMA Manager
  server-side **antes del segundo cliente** (etapa aparte ya planificada).
- **Encriptación de la clave fiscal.** Se cifra con clave derivada del salt en disco;
  `safeStorage` (DPAPI) la ataría a la cuenta de Windows — migrable sin dolor sin cert cargado.
- **Paths legacy en `main.js`.** Ramas de la cuenta de sync compartida quedan como código
  muerto (sin credenciales que las disparen). Eliminables tras confirmar CUSTOM_TOKEN.

## 🧪 Camino crítico a verificar (smoke test general)

abrir app → activar licencia (CUSTOM_TOKEN) → login local → cargar productos →
registrar venta (modo fiscal: CAE OK) → cerrar turno (corte Z) → reconectar y sincronizar.
Extra: generar clave de recuperación y probar "Recuperar acceso de administrador".
