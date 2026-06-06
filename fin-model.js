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

  // ── Backend (hoy Apps Script; Fase 3 = Supabase) ───────────────────────────
  var EQ_SOURCE_URL = 'https://script.google.com/macros/s/AKfycbyQWCY3SzoYKlXG_HF7D-fll3Zi-5jYWXeaOkSAPi0zJpGO3T_C-DLpW-DQLuHDxasM/exec';

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
    // ⚠️ CONFIRMAR con David — hoy el código se contradecía (4% / 3.6% / 3.5%).
    renta: {
      tasaMensual: 0.04,        // 4% del precio (incluye mantenimiento preventivo)
      plazoMinMeses: 36,
    },
    // ⚠️ CONFIRMAR — modelo "nuevo" (el de la solicitud): reactivos para liquidar
    // el equipo en `meses` incluyendo mantenimiento anual, sobre margen.
    comodato: {
      mesesLiquidacion: 24,
      mantenimientoAnualPct: 0.10,  // 10% del precio / año
      margenReactivos: 0.35,        // 35%
      depositoMeses: 2,             // depósito = 2 meses de compra mínima
      opcionCompraPct: 0.15,        // 15% del costo al final
    },
  };

  // ── Catálogo fallback (si la fuente no responde) ───────────────────────────
  // Campos: id, n(nombre), m(marca), c(categoría), p(precio s/IVA), co(costo),
  //   mr(margen reactivos legacy), pl(planes: fin/ren/com), mx(plazo máx),
  //   dm(depósito en meses, legacy), mc(meses comodato legacy), nota.
  var EQ_FALLBACK = [
    {id:1,  n:"BA88A",   m:"Mindray",  c:"Química Clínica", p:39990,   co:30000,   mr:null, pl:["fin"],             mx:6,  dm:0, mc:0,  nota:"0% de interés hasta 4 meses · máximo 6 meses"},
    {id:2,  n:"AQ-200i", m:"Meril",    c:"Química Clínica", p:184338,  co:131670,  mr:0.40, pl:["fin","com"],       mx:24, dm:3, mc:48, nota:null},
    {id:3,  n:"DH22",    m:"DYMIND",   c:"Hematología",     p:95000,   co:73000,   mr:0.30, pl:["fin","com"],       mx:24, dm:3, mc:36, nota:null},
    {id:4,  n:"DH36",    m:"DYMIND",   c:"Hematología",     p:106000,  co:82000,   mr:0.30, pl:["fin","com"],       mx:24, dm:3, mc:36, nota:null},
    {id:5,  n:"DF55",    m:"DYMIND",   c:"Hematología",     p:205000,  co:160800,  mr:0.30, pl:["fin","com"],       mx:24, dm:3, mc:48, nota:null},
    {id:6,  n:"DH76",    m:"DYMIND",   c:"Hematología",     p:260000,  co:210000,  mr:0.30, pl:["fin","com"],       mx:24, dm:4, mc:48, nota:null},
    {id:7,  n:"c-5000",  m:"Poclight", c:"Inmunología",     p:90000,   co:57750,   mr:0.40, pl:["fin","com"],       mx:24, dm:3, mc:36, nota:null},
    {id:8,  n:"X3",      m:"MAGLUMI",  c:"Inmunología",     p:590150,  co:453962,  mr:0.30, pl:["ren","fin","com"], mx:24, dm:6, mc:60, nota:null},
    {id:9,  n:"X6",      m:"MAGLUMI",  c:"Inmunología",     p:1388587, co:1068144, mr:0.30, pl:["ren","fin","com"], mx:24, dm:6, mc:60, nota:null},
    {id:10, n:"X8",      m:"MAGLUMI",  c:"Inmunología",     p:2391289, co:1839453, mr:0.30, pl:["ren","fin","com"], mx:24, dm:6, mc:60, nota:null},
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
      fetch(EQ_SOURCE_URL + '?ts=' + Date.now())
        .then(function (r) { return r.json(); })
        .then(function (data) { finish(Array.isArray(data) ? data : null); })
        .catch(function () { finish(null); });
    } catch (e) { finish(null); }
    // Timeout de seguridad para no dejar el simulador colgado
    setTimeout(function () { finish(null); }, opts.timeout || 4000);
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

  // ── 2) RENTA ───────────────────────────────────────────────────────────────
  function calcRenta(eq) {
    var mensual = eq.p * CONFIG.renta.tasaMensual;
    return {
      plan: 'ren', mensual: mensual, mensualIVA: iva(mensual),
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
      opcionCompra: (eq.co || eq.p) * c.opcionCompraPct,
    };
  }

  // ── API pública ────────────────────────────────────────────────────────────
  global.FinModel = {
    CONFIG: CONFIG,
    EQ_FALLBACK: EQ_FALLBACK,
    EQ_SOURCE_URL: EQ_SOURCE_URL,
    fmt: fmt, fmt2: fmt2, iva: iva,
    loadEquipos: loadEquipos,
    plazosFin: plazosFin,
    calcFinanciamiento: calcFinanciamiento,
    calcRenta: calcRenta,
    calcComodato: calcComodato,
  };
})(window);
