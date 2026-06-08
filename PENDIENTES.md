# PENDIENTES · norlab-financiamiento (darle vida · de inicio a fin)

> Repo: `github.com/dromo5149/norlab-financiamiento` → GitHub Pages → `financiamiento.norlab.xyz`.
> Estático (HTML + JS, sin build). Backend HOY: 1 Google Apps Script (`AKfycbyQWCY3…/exec`)
> que lee el libro Sheets **"NORLAB-Equipos"** (id `1ToXtS2X1ll2_KCrzTIcmcV7tRvTFVpuo31HGKk9L06c`).

## Arquitectura decidida (con David)
- **Equipos: el precio de financiamiento es el CANÓNICO** → sobreescribe el del maestro y **crea los que falten** ahí. Catálogo unificado por **SKU**.
- **SKU**: lo genero yo (match financiamiento ↔ `product_catalog`). David NO toca el Sheet.
- Path **(a)**: equipos se gestionan en UN solo lugar (Sheet/tabla financiamiento) y el maestro los **absorbe**.
- Modelo financiero en UNA sola fuente (`fin-model.js` / luego Supabase).

## El libro Sheets "NORLAB-Equipos" (5 pestañas) → OS
| Pestaña | Llave | Alimenta hoy | Destino |
|---|---|---|---|
| Promociones (SKU, Tipo_Promo, Precio_Especial, Etiqueta, Fecha_Fin, Activo, URL Drive) | SKU | web norlab.com.mx | `promociones` → admin Marketing/Promos |
| Equipos (precio, costo, margen_r, planes, plazo_max, deposito_m, duracion_c, nota) | SKU | simulador | `fin_equipos` + absorbe a `product_catalog` |
| Documentos (Folio, Tipo esperado/detectado, URL Drive, ¿Coincide?, Confianza, RFC/Nombre extraído, Alertas) | Folio | subida docs + análisis Claude | `fin_documentos` + Storage |
| Solicitudes (Folio, Estado, Equipo, Plan, datos cliente, PII) | Folio | wizard | `fin_solicitudes` → admin `/financiamiento` del OS (ya existe Solicitudes.jsx) |
| Instrucciones | — | notas | no migra |

## Estado por fase
- **Fase 1 — fuente única del modelo financiero · HECHO + DEPLOYADO** (commit `32c7b16`).
  - Nuevo `fin-model.js` (window.FinModel): equipos fallback + calc fin(2%)/renta(4%)/comodato + IVA en 1 lugar.
  - `portal.js` (simulador) y `solicitud.js` (wizard) consumen FinModel → mismos números. Enganche del simulador viaja por URL (`engPct`) y el wizard lo respeta. Fix doble-fetch. Fuera modal/Kommo muerto.
- **Fase 4 — catálogo real · CUBIERTO**: el simulador ya carga de Supabase (`fin_equipos`), precio financiamiento = canónico, y el master-absorb unifica al maestro.
- **Fase 3 — backend Supabase · EN CURSO**.
  - ✅ **Esquema** (`fin_fase3_esquema_base`, proyecto `bbkpxpfhxxakwhrbbxww`): `fin_equipos`, `promociones`, `fin_solicitudes`, `fin_documentos` con RLS. anon SELECT en equipos/promos (solo activos); anon **solo INSERT** en solicitudes (NO lee → sin IDOR); fin_documentos sin anon; authenticated full.
  - ✅ **Seed `fin_equipos`** (17 equipos, incluye 6 nuevos: XI-921, XI-931DT, BS-240PRO, BS-360E, NX600, NX700).
  - ✅ **Master-absorb** (commits norlab-os `e24ba52b` + fix `47f9fec5`): `sync-catalog-sheets.js` absorbe `fin_equipos → product_catalog` en CADA corrida (cron */15) + protege esos SKUs del cleanup. Precio financiamiento gana, crea faltantes. **Verificado**: los 17 en `✓ unificado`, `source='financiamiento'`. ⚠️ Bug encontrado y corregido: el batch de updates mandaba filas sin `name` (NOT NULL) → reventaba todo el absorb; ahora reusa el name curado del maestro.
  - ✅ **Wire front (equipos READ)** (`fin-model.js`): `loadEquipos` lee `fin_equipos` de Supabase REST (anon key embebida, RLS-safe) + `mapFinEquipo` (claves largas→cortas). Apps Script retirado del loader; `EQ_FALLBACK` queda como resiliencia. Validado e2e (BA88A 0%, AQ-200i precio fin, NX600 nuevo visible). Cache-bust `v=20260606`.
  - ✅ **Wire wizard → INSERT `fin_solicitudes`** (dual-write): `solicitud.js submitForm()` ahora, además del POST al Apps Script (que sigue escribiendo Sheet + subiendo docs a Drive), llama `FM.insertSolicitud(...)` → INSERT anon a `fin_solicitudes`. Fire-and-forget (no rompe el wizard). Campos directos + resto en `meta` jsonb (aval, zoho, reactivos, negocio…). Validado e2e (INSERT 201, row correcto, RLS sin SELECT). Cache-bust `solicitud.js?v=20260606`.

  - ✅ **Backfill histórico** (12 solicitudes del Sheet → `fin_solicitudes`): vía INSERT anon, `created_at` original preservado, análisis de Claude (score, recomendación, dictamen, resumen IA, Zoho) volcado a `meta`. **Supabase es ahora el registro COMPLETO** (histórico + nuevas del dual-write), no sólo lo nuevo.

## ⚠️ Hallazgo de alcance (admin) — DECISIÓN DE NEGOCIO
El módulo admin del OS (`src/pages/financiamiento/`: Solicitudes/Buró/Contratos/Cobranza) NO es sólo una lista: está acoplado al **pipeline de análisis con Claude sobre los docs en Drive** (`admin_analysis`, `admin_reanalizar`, scoring), a **contratos + e-sign** (`contratos_a_sign`, `sign_status`), y al **scoring** que vive en el Sheet. Reemplazarlo entero en Supabase = reconstruir ese pipeline (Claude leyendo docs de Storage), el e-sign y el scoring → **proyecto grande**. Hacerlo a medias (sólo cambiar la lista) **regresaría** funciones (perdería score/filtros/análisis).
- **El funnel YA funciona de inicio a fin HOY**: simulador (Supabase) → wizard → solicitud (dual-write Sheet+Supabase) → admin (Apps Script, con análisis/contratos). Y Supabase ya es el system-of-record de los datos.
- **Recomendación**: dejar el admin del OS sobre el Apps Script (funciona) y tratar la migración total como proyecto aparte deliberado. NO ripear el admin que funciona por ripearlo.

## 🏗️ Rebuild admin financiamiento (decidido: opción 1 = plan + R1) — plan por fases
- **R1 · Docs → Supabase Storage · ✅ HECHO (aditivo, dual-write)**:
  - Bucket privado `fin-docs` (10MB), Edge Function `fin-upload-doc` (service-role; `verify_jwt` on → exige anon JWT que el sitio ya tiene). Sube a `fin-docs/{folio}/{archivo}` + INSERT `fin_documentos` (folio, tipo_esperado, archivo, storage_path). Validado e2e (subió + registró + limpieza).
  - Wizard `solicitud.js uploadFile()` llama `FM.uploadDoc(...)` **además** del POST a Drive (Apps Script). Fire-and-forget. Cache-bust `v=20260607`. Drive sigue siendo el canal "oficial" hasta R2/R3.
  - Artefacto trivial: queda 1 archivo test `NL-TEST-R1/prueba.txt` (20B) en el bucket (anon no puede borrar por RLS; sin fila en `fin_documentos`). Inocuo.
- **R2 · Admin lee Supabase · ✅ HECHO (sin regresión)** (norlab-os commit `77e72f92`): nueva capa `src/api/finSupabase.js`; `Solicitudes.jsx` lee la lista con **Supabase como base** (todas las solicitudes incl. históricas + estado), el GAS solo **enriquece análisis** (Score/Dictamen/Resumen IA/Zoho) donde falte y como fallback si el GAS cae. Cambio de estado **dual-write** (Supabase debe pasar + GAS best-effort). **Detalle del drawer migrado** (commit `c35cd18f`): lee `getSolicitudDetailSupabase` (fin_solicitudes + análisis R3 vía meta + docs de Storage signed-URLs) mergeado con el GAS (conserva docs de Drive + análisis de históricas). Sin regresión (si no hay fila en Supabase, cae 100% al GAS).
- **R3 · Análisis con Claude · ✅ DESPLEGADO (falta validar con doc real)** (norlab-os commits `38864b2a` + `227730fb`): **Netlify** function `fin-analizar.cjs` (no Edge — reusa `ANTHROPIC_API_KEY` + service-role ya en Netlify). Lee docs de Storage `fin-docs/{folio}`, Claude `sonnet-4-5` (visión/PDF) con tool de salida estructurada → escribe por-doc en `fin_documentos` (tipo_detectado/coincide/confianza/nombre·RFC/alertas) + global en `fin_solicitudes.meta` (score/recomendacion/dictamen/resumen_ia). Auth: exige JWT de usuario (verificado con service-role; no anónima). Admin: botón "Analizar docs (Supabase)" en el drawer (junto al legacy Drive). Registrado en `public/_redirects`. **Verificado**: endpoint vivo + guard 401. **PENDIENTE validar**: correr contra un doc real (no hay en Storage hasta que fluya el wizard post-R1) → afinar prompt/score vs el GAS. **Cómo probar**: enviar una solicitud por el wizard con un documento → abrir esa solicitud en el admin → "Analizar docs (Supabase)". El detalle (drawer) aún lee Score/Dictamen del GAS; el nuevo análisis se ve en la LISTA (que lee `meta`) y en el toast — conectar el drawer a `meta` cuando se migre el detalle.
- **R4 · Contratos + e-sign · GREENFIELD (no hay firmas en vivo hoy)**: David confirmó (2026-06-06) que **hoy NO se firman contratos**; se planeó hacerlo con **Zoho Sign**. O sea NO es migración — no hay nada vivo que preservar; el GAS (`contratos_a_sign`, `sign_status_folio`, `sign_cancelar`) es solo andamiaje planeado. Construir = integración nueva con **Zoho Sign API** (scope OAuth aparte del de Zoho Books; requiere plantilla de contrato + credenciales que controla David). Baja urgencia hasta que se quiera activar firmas. Plan tentativo: generar el contrato (PDF) desde `fin_solicitudes`, mandarlo a Zoho Sign, guardar request_id + estado en una tabla `fin_contratos`, webhook de Zoho Sign → actualiza estado.
- **R5 · Retirar Apps Script/Sheet**: cuando R2-R4 tengan paridad → quitar dual-writes (solicitud + doc) y los `action:*` del GAS.

## Próximos pasos posibles (a elección de David)
- **(A) Proyecto admin completo**: reconstruir análisis-Claude-sobre-Storage + contratos/e-sign + scoring en Supabase, luego wire admin + retirar Apps Script. Grande.
- **(B) Dar el funnel por terminado** (recomendado): Supabase = system-of-record; admin sigue en Apps Script. Pasar a otras prioridades (walkthrough Usuarios, fix IDOR portal norlab-site, seed promociones).
- **Seed `promociones`** (promo IDEC-425) → norlab.com.mx. Independiente, chico.
- **Fase 2 — UI** del simulador (fotos `product_catalog.image_url`, 3 planes, mobile). Independiente.
- **Fase 2 — UI** (al final): inicio más claro (equipos con foto desde `product_catalog.image_url`), 3 planes diferenciados, wizard limpio/mobile.

## Confirmaciones de negocio abiertas (están en 1 solo lugar de fin-model.js)
- Renta = **4%** mensual (asumido = lo que muestra el simulador hoy).
- Comodato = reactivos `(precio/24 + mant 10%/12)/margen 35%`, **depósito 2 meses**, duración 24 meses.
