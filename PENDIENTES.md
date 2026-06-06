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

## Próximos sub-pasos Fase 3 (en orden) — AQUÍ NOS QUEDAMOS
1. **Wire wizard → INSERT `fin_solicitudes`**: `solicitud.js` hoy hace POST al Apps Script (`action:'solicitud'`). Cambiar a INSERT Supabase REST anon (RLS sólo permite INSERT, sin select). Mapear campos del form → columnas. ← SIGUIENTE.
2. **Wire OS admin** `/financiamiento` (Solicitudes.jsx etc.): leer de Supabase, no del Apps Script. Docs → Supabase Storage (`fin_documentos`).
3. **Seed `promociones`** (promo IDEC-425 del Sheet) → admin Marketing/Promos. (Alimenta norlab.com.mx, no el simulador; baja prioridad.)
4. Retirar Apps Script/Sheet.
- **Fase 2 — UI** (al final): inicio más claro (equipos con foto desde `product_catalog.image_url`), 3 planes diferenciados, wizard limpio/mobile.

## Confirmaciones de negocio abiertas (están en 1 solo lugar de fin-model.js)
- Renta = **4%** mensual (asumido = lo que muestra el simulador hoy).
- Comodato = reactivos `(precio/24 + mant 10%/12)/margen 35%`, **depósito 2 meses**, duración 24 meses.
