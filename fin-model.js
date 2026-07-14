/* ============================================================================
 * fin-model.js · FUENTE ÚNICA DE VERDAD del modelo financiero NORLAB
 * ----------------------------------------------------------------------------
 * Antes el cálculo vivía duplicado (y CONTRADICTORIO) en portal.js (simulador)
 * y solicitud.js (formulario): la renta salía 4% en un lado y 3.5/3.6% en otro,
 * el comodato tenía 2-3 fórmulas distintas → el simulador "mentía" vs lo que
 * llegaba a la solicitud. Este módulo centraliza:
 *   - el catálogo de equipos (fallback + loader único)
 *   - las constantes del modelo (tasas, IVA, plazos)
 *   - las 3 funciones de cálculo (financiamiento, renta, comodato)
 * Lo consumen TANTO el simulador como la solicitud → números idénticos.
 *
 * Se carga como <script src="fin-model.js"> ANTES de portal.js / solicitud.js.
 * Expone window.FinModel.
 * ========================================================================== */
(function (global) {
  'use strict';

  // ── Backend · Fase 3 = Supabase REST (anon) ────────────────────────────────
  // El catálogo de equipos vive en la tabla `fin_equipos` (Supabase, proyecto
  // bbkpxpfhxxakwhrbbxww). RLS sólo permite SELECT anónimo de filas activo=true,
  // así que la anon key puede ir embebida en este JS estático sin riesgo.
  // (Legacy: antes leía del Apps Script AKfycbyQWCY… que envolvía el Sheet.)
  var SB_URL  = 'https://bbkpxpfhxxakwhrbbxww.supabase.co';
  var SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJia3B4cGZoeHhha3docmJieHd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3OTUyNDgsImV4cCI6MjA4OTM3MTI0OH0.kpKxI6ZLXkRUmy9NkzuBPM9cmSQo8UuTVLv6IrS7qKU';
  // Vista pública fin_equipos_web = fin_equipos (activos) + product_catalog.image_url.
  // Seguridad: el front NO recibe costo ni margen_reactivos (la vista ya no los
  // expone a anon). La opción de compra del comodato viene precomputada en
  // `opcion_compra` (columna generada = 15% del costo).
  var EQ_SOURCE_URL = SB_URL + '/rest/v1/fin_equipos_web?select=sku,nombre,marca,categoria,precio,planes,plazo_max,deposito_meses,duracion_comodato,nota,orden,image_url,imagen_url,opcion_compra&order=orden.asc';

  // Mapea una fila de `fin_equipos` (claves largas) al shape compacto que
  // consumen portal.js/solicitud.js: {id,n,m,c,p,co,mr,pl,mx,dm,mc,nota,sku}.
  // ⚠️ id ← orden: la llave de selección de los UIs y la promo 0% de BA88A
  // dependen de id===1. BA88A está seedeado con orden=1, así que se preserva.
  function mapFinEquipo(r) {
    return {
      id: r.orden,
      n:  r.nombre,
      m:  r.marca || '',
      c:  r.categoria || '',
      p:  Number(r.precio) || 0,
      oc: r.opcion_compra != null ? Number(r.opcion_compra) : null,  // opción de compra comodato (15% costo, precomputado)
      pl: Array.isArray(r.planes) ? r.planes : [],
      mx: r.plazo_max || 24,
      dm: r.deposito_meses || 0,
      mc: r.duracion_comodato || 0,
      nota: r.nota || null,
      sku: r.sku,
      // Foto: maestro (product_catalog) y, como fallback, la del Sheet de Equipos.
      img: r.image_url || r.imagen_url || null,
    };
  }

  // ── Constantes del modelo · ÚNICO lugar para ajustar tasas ─────────────────
  var CONFIG = {
    IVA: 0.16,
    fin: {
      tasaMensual: 0.02,        // 2% mensual sobre capital
      plazos: [6, 12, 18, 24],  // se recortan por eq.mx
      engancheDefault: 30,      // %
      engancheMin: 10,
      engancheMax: 60,
    },
    // MSI · meses sin intereses (0%) para equipos marcados con plan "msi".
    // David (2026-06-08): plazos 3/6/12, enganche mínimo 40%. El cliente paga
    // (precio − enganche) / N, sin sobrecosto. NORLAB absorbe el costo financiero
    // (por eso solo para ciertos equipos, marcados en el Sheet maestro).
    msi: {
      plazos: [3, 6, 12],
      engancheMin: 40,       // %
      engancheDefault: 40,
      engancheMax: 60,
    },
    // Confirmado por David (14-jul-2026): renta 4% mensual y depósito en
    // garantía de 2 meses tanto en renta como en comodato. El contrato
    // (norlab-os/fin-contrato) usa estos mismos parámetros.
    renta: {
      tasaMensual: 0.04,        // 4% del precio (incluye mantenimiento preventivo)
      plazoMinMeses: 36,
      depositoMeses: 2,         // depósito en garantía = 2 meses de renta
    },
    // Modelo de la solicitud: reactivos para liquidar el equipo en `meses`
    // incluyendo mantenimiento anual, sobre margen.
    comodato: {
      mesesLiquidacion: 24,
      mantenimientoAnualPct: 0.10,  // 10% del precio / año
      margenReactivos: 0.35,        // 35%
      depositoMeses: 2,             // depósito = 2 meses de compra mínima
      opcionCompraPct: 0.15,        // 15% del costo al final
    },
  };

  // ── Catálogo fallback (si la fuente no responde) ───────────────────────────
  // Campos: id, n(nombre), m(marca), c(categoría), p(precio s/IVA), pl(planes:
  //   fin/ren/com/msi), mx(plazo máx), dm(depósito meses, legacy), mc(meses
  //   comodato legacy), nota. SIN costo/margen (no se exponen al front; offline
  //   la opción de compra del comodato cae a 15% del precio).
  var EQ_FALLBACK = [
    {id:1,  n:"BA88A",   m:"Mindray",  c:"Química Clínica", p:39990,   pl:["fin"],             mx:6,  dm:0, mc:0,  nota:"0% de interés hasta 4 meses · máximo 6 meses"},
    {id:2,  n:"AQ-200i", m:"Meril",    c:"Química Clínica", p:184338,  pl:["fin","com"],       mx:24, dm:3, mc:48, nota:null},
    {id:3,  n:"DH22",    m:"DYMIND",   c:"Hematología",     p:95000,   pl:["fin","com"],       mx:24, dm:3, mc:36, nota:null},
    {id:4,  n:"DH36",    m:"DYMIND",   c:"Hematología",     p:106000,  pl:["fin","com"],       mx:24, dm:3, mc:36, nota:null},
    {id:5,  n:"DF55",    m:"DYMIND",   c:"Hematología",     p:205000,  pl:["fin","com"],       mx:24, dm:3, mc:48, nota:null},
    {id:6,  n:"DH76",    m:"DYMIND",   c:"Hematología",     p:260000,  pl:["fin","com"],       mx:24, dm:4, mc:48, nota:null},
    {id:7,  n:"c-5000",  m:"Poclight", c:"Inmunología",     p:90000,   pl:["fin","com"],       mx:24, dm:3, mc:36, nota:null},
    {id:8,  n:"X3",      m:"MAGLUMI",  c:"Inmunología",     p:590150,  pl:["ren","fin","com"], mx:24, dm:6, mc:60, nota:null},
    {id:9,  n:"X6",      m:"MAGLUMI",  c:"Inmunología",     p:1388587, pl:["ren","fin","com"], mx:24, dm:6, mc:60, nota:null},
    {id:10, n:"X8",      m:"MAGLUMI",  c:"Inmunología",     p:2391289, pl:["ren","fin","com"], mx:24, dm:6, mc:60, nota:null},
  ];

  // ── Formateadores MXN ──────────────────────────────────────────────────────
  function fmt(n)  { return new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:0,maximumFractionDigits:0}).format(n||0); }
  function fmt2(n) { return new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:2}).format(n||0); }
  function iva(n)  { return (n||0) * (1 + CONFIG.IVA); }

  // ── Loader único de equipos (fallback resiliente) ──────────────────────────
  // cb(equipos). Intenta la fuente; si falla/ vacía, usa el fallback.
  function loadEquipos(cb, opts) {
    opts = opts || {};
    var done = false;
    function finish(list) { if (done) return; done = true; cb(list && list.length ? list : EQ_FALLBACK); }
    try {
      fetch(EQ_SOURCE_URL, {
        headers: { apikey: SB_ANON, Authorization: 'Bearer ' + SB_ANON, Accept: 'application/json' },
      })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          finish(Array.isArray(data) && data.length ? data.map(mapFinEquipo) : null);
        })
        .catch(function () { finish(null); });
    } catch (e) { finish(null); }
    // Timeout de seguridad para no dejar el simulador colgado
    setTimeout(function () { finish(null); }, opts.timeout || 4000);
  }

  // ── INSERT de solicitud a Supabase (anon · RLS sólo permite INSERT) ────────
  // Fire-and-forget: registra la solicitud en `fin_solicitudes` para que el
  // admin del OS la lea. NO reemplaza el POST al Apps Script (que sigue
  // escribiendo Sheet + subiendo docs a Drive) — es dual-write durante la
  // migración. Devuelve una promesa que nunca rechaza (no rompe el wizard).
  function insertSolicitud(row) {
    try {
      return fetch(SB_URL + '/rest/v1/fin_solicitudes', {
        method: 'POST',
        headers: {
          apikey: SB_ANON, Authorization: 'Bearer ' + SB_ANON,
          'Content-Type': 'application/json', Prefer: 'return=minimal',
        },
        body: JSON.stringify(row),
      }).catch(function () {});
    } catch (e) { return Promise.resolve(); }
  }

  // ── Subir documento a Supabase Storage (Edge Function service-role) ────────
  // Dual-write Fase 3 R1: además del upload a Drive (Apps Script), guarda el
  // doc en Storage (bucket fin-docs) + registra fin_documentos. La Edge Function
  // usa service-role internamente; aquí va el anon JWT (verify_jwt on).
  // Fire-and-forget: nunca rompe la subida a Drive.
  function uploadDoc(payload) {
    try {
      return fetch(SB_URL + '/functions/v1/fin-upload-doc', {
        method: 'POST',
        headers: {
          apikey: SB_ANON, Authorization: 'Bearer ' + SB_ANON,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }).catch(function () {})
    } catch (e) { return Promise.resolve() }
  }

  // ── Plazos válidos para un equipo (financiamiento) ─────────────────────────
  function plazosFin(eq) {
    if (!eq) return CONFIG.fin.plazos.slice();
    if (eq.id === 1) return [4, 5, 6];                       // BA88A: promo corta
    return CONFIG.fin.plazos.filter(function (m) { return m <= (eq.mx || 24); });
  }

  // ── 1) FINANCIAMIENTO ──────────────────────────────────────────────────────
  // Amortización francesa al `tasaMensual`. BA88A ≤4 meses = 0% sin intereses.
  function calcFinanciamiento(eq, plazoMeses, enganchePct) {
    var p = eq.p;
    var ep = (eq.id === 1) ? 30 : (enganchePct != null ? enganchePct : CONFIG.fin.engancheDefault);
    var m  = (eq.id === 1) ? Math.min(plazoMeses, 6) : plazoMeses;
    var t  = (eq.id === 1 && m <= 4) ? 0 : CONFIG.fin.tasaMensual;

    var enganche = p * ep / 100;
    var capital  = p - enganche;
    var mensual, intereses;
    if (t === 0) { mensual = capital / m; intereses = 0; }
    else { var f = Math.pow(1 + t, m); mensual = capital * (t * f) / (f - 1); intereses = mensual * m - capital; }
    var totalSinIVA = enganche + mensual * m;

    return {
      plan: 'fin', plazoMeses: m, enganchePct: ep, tasaMensual: t,
      enganche: enganche, capital: capital, mensual: mensual, intereses: intereses,
      totalSinIVA: totalSinIVA,
      // con IVA (lo que realmente paga)
      engancheIVA: iva(enganche), mensualIVA: iva(mensual), totalIVA: iva(enganche) + iva(mensual) * m,
      sinIntereses: t === 0,
    };
  }

  // ── 1b) MSI · MESES SIN INTERESES (0%) ──────────────────────────────────────
  // Solo para equipos cuyo `pl` incluye "msi". mensual = (precio − enganche)/N,
  // sin intereses. Enganche mínimo 40% (CONFIG.msi.engancheMin).
  function plazosMSI(eq) {
    var plz = CONFIG.msi.plazos.slice();
    if (!eq) return plz;
    // No ofrecer un plazo MSI mayor al plazo máximo del equipo.
    return plz.filter(function (m) { return m <= (eq.mx || 12); });
  }
  function calcMSI(eq, plazoMeses, enganchePct) {
    var p = eq.p;
    var ep = (enganchePct != null ? enganchePct : CONFIG.msi.engancheDefault);
    if (ep < CONFIG.msi.engancheMin) ep = CONFIG.msi.engancheMin;   // piso 40%
    if (ep > CONFIG.msi.engancheMax) ep = CONFIG.msi.engancheMax;
    var plz = plazosMSI(eq);
    var m = (plazoMeses && plz.indexOf(plazoMeses) >= 0) ? plazoMeses : plz[0];
    var enganche = p * ep / 100;
    var capital  = p - enganche;
    var mensual  = capital / m;            // 0% interés
    return {
      plan: 'msi', plazoMeses: m, enganchePct: ep, tasaMensual: 0,
      enganche: enganche, capital: capital, mensual: mensual, intereses: 0,
      totalSinIVA: p,                       // sin sobrecosto: el total = precio
      engancheIVA: iva(enganche), mensualIVA: iva(mensual), totalIVA: iva(p),
      sinIntereses: true,
    };
  }

  // ── 2) RENTA ───────────────────────────────────────────────────────────────
  function calcRenta(eq) {
    var mensual = eq.p * CONFIG.renta.tasaMensual;
    var deposito = mensual * CONFIG.renta.depositoMeses;
    return {
      plan: 'ren', mensual: mensual, mensualIVA: iva(mensual),
      deposito: deposito, depositoMeses: CONFIG.renta.depositoMeses,
      tasaMensual: CONFIG.renta.tasaMensual, plazoMinMeses: CONFIG.renta.plazoMinMeses,
      mantenimiento: 'Incluido',
    };
  }

  // ── 3) COMODATO ────────────────────────────────────────────────────────────
  // Compra mínima mensual de reactivos para liquidar el equipo en `meses`
  // incluyendo mantenimiento, dividido entre el margen de reactivos.
  function calcComodato(eq) {
    var c = CONFIG.comodato;
    var mantMensual = eq.p * c.mantenimientoAnualPct / 12;
    var reactivosMin = Math.ceil((eq.p / c.mesesLiquidacion + mantMensual) / c.margenReactivos);
    var deposito = reactivosMin * c.depositoMeses;
    return {
      plan: 'com', reactivosMin: reactivosMin, reactivosMinIVA: iva(reactivosMin),
      deposito: deposito, depositoMeses: c.depositoMeses, duracionMeses: c.mesesLiquidacion,
      // Precomputado en la vista (no exponemos costo al front). Fallback: 15% del precio.
      opcionCompra: (eq.oc != null ? eq.oc : eq.p * c.opcionCompraPct),
    };
  }

  // ── API pública ────────────────────────────────────────────────────────────
  global.FinModel = {
    CONFIG: CONFIG,
    EQ_FALLBACK: EQ_FALLBACK,
    EQ_SOURCE_URL: EQ_SOURCE_URL,
    fmt: fmt, fmt2: fmt2, iva: iva,
    loadEquipos: loadEquipos,
    insertSolicitud: insertSolicitud,
    uploadDoc: uploadDoc,
    plazosFin: plazosFin,
    plazosMSI: plazosMSI,
    calcFinanciamiento: calcFinanciamiento,
    calcMSI: calcMSI,
    calcRenta: calcRenta,
    calcComodato: calcComodato,
  };
})(window);
