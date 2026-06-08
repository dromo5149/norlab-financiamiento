/* ============================================================================
 * portal.js · Simulador de la página de inicio
 * ----------------------------------------------------------------------------
 * Consumidor delgado de fin-model.js (FUENTE ÚNICA del modelo financiero).
 * Ya NO contiene datos de equipos ni fórmulas duplicadas: todo sale de FinModel
 * → el simulador muestra EXACTAMENTE lo que recibe la solicitud.
 * Requiere <script src="fin-model.js"> cargado antes que este archivo.
 * ========================================================================== */
var FM = window.FinModel;
var EQ = FM.EQ_FALLBACK.slice();           // se reemplaza por el catálogo en vivo
var fmt = FM.fmt, fmt2 = FM.fmt2;
var waLink = function (msg) { return "https://wa.me/525611202177?text=" + encodeURIComponent(msg); };
var waSvg  = function () { return '<svg width="15" height="15" fill="white" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>'; };

var sTab = "fin", sId = null, sMes = 12, sEng = FM.CONFIG.fin.engancheDefault, sCat = "Todos";

// ── FAQ ──────────────────────────────────────────────────────────────────────
function faq(btn) {
  var a = btn.nextElementSibling, ic = btn.querySelector(".faq-ic");
  var open = a.classList.toggle("op");
  ic.textContent = open ? "×" : "+";
}

// ── Tabs (financiamiento / renta / comodato) ──────────────────────────────────
function setTab(t) {
  sTab = t; sId = null;
  ["fin","ren","com"].forEach(function (x) {
    var el = document.getElementById("t-" + x); if (el) el.classList.toggle("on", x === t);
  });
  render();
}

function render() {
  // Tinta la pestaña activa con el color de su plan (refuerza la diferenciación)
  var TAB_AC = { fin: '#1976d2', ren: '#0891b2', com: '#2e9e5b' };
  ['fin', 'ren', 'com'].forEach(function (x) {
    var el = document.getElementById('t-' + x);
    if (el) el.style.color = (x === sTab) ? TAB_AC[x] : '';
  });

  // Category pills
  var cats = ["Todos"].concat(Array.from(new Set(EQ.map(function (e) { return e.c; }))));
  var cf = document.getElementById("cats"); cf.innerHTML = "";
  cats.forEach(function (c) {
    var b = document.createElement("button");
    b.className = "cat" + (sCat === c ? " on" : "");
    b.textContent = c;
    b.onclick = function () { sCat = c; sId = null; render(); };
    cf.appendChild(b);
  });

  // Equipment grid (filtra por categoría + plan disponible)
  var lista = EQ.filter(function (eq) {
    if (sCat !== "Todos" && eq.c !== sCat) return false;
    if (sTab === "ren" && (!eq.pl || eq.pl.indexOf("ren") < 0)) return false;
    if (sTab === "com" && (!eq.pl || eq.pl.indexOf("com") < 0)) return false;
    return true;
  });
  var eg = document.getElementById("eqs"); eg.innerHTML = "";
  lista.forEach(function (eq) {
    var b = document.createElement("button");
    b.className = "eq" + (sId === eq.id ? " on" : "");
    var thumb = '<div style="flex:0 0 46px;width:46px;height:46px;border-radius:8px;background:#fff;border:1px solid var(--border);position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden">' +
      '<span style="font-size:20px;opacity:.4">🔬</span>' +
      (eq.img ? '<img src="' + eq.img + '" alt="" loading="lazy" referrerpolicy="no-referrer" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#fff" onerror="this.remove()">' : '') +
      '</div>';
    b.innerHTML = '<div style="display:flex;align-items:center;gap:10px">' + thumb +
      '<div style="flex:1;min-width:0"><span class="eq-n">' + eq.n + '</span><span class="eq-b">' + eq.m + '</span><span class="eq-p">' + fmt(eq.p) + '</span></div></div>';
    b.onclick = function () { sId = eq.id; sMes = (eq.id === 1 ? 4 : 12); sEng = FM.CONFIG.fin.engancheDefault; render(); };
    eg.appendChild(b);
  });

  // Plazo & Enganche (solo financiamiento)
  var eq = EQ.find(function (e) { return e.id === sId; });
  var fp = document.getElementById("fPlazo"), fe = document.getElementById("fEng");
  if (sTab !== "fin") {
    fp.style.display = "none"; fe.style.display = "none";
  } else {
    fp.style.display = "block";
    var opts = FM.plazosFin(eq);
    var pg = document.getElementById("pzs"); pg.innerHTML = "";
    opts.forEach(function (m) {
      var b = document.createElement("button");
      b.className = "pz" + (sMes === m ? " on" : "");
      b.innerHTML = m + '<br><span style="font-size:9px;opacity:.65">meses</span>';
      b.onclick = function () { sMes = m; render(); };
      pg.appendChild(b);
    });
    fe.style.display = (eq && eq.id !== 1) ? "block" : "none";
    if (eq && eq.id !== 1) {
      document.getElementById("engLbl").textContent = "Enganche: " + sEng + "% — " + fmt(eq.p * sEng / 100);
      var sl = document.getElementById("engS");
      sl.min = FM.CONFIG.fin.engancheMin; sl.max = FM.CONFIG.fin.engancheMax;
      sl.value = sEng;
      sl.oninput = function (ev) { sEng = parseInt(ev.target.value, 10); render(); };
    }
  }

  // Result panel
  var box = document.getElementById("simR");
  if (!eq) {
    box.innerHTML = '<div class="empty"><div class="empty-i">🔬</div><div class="empty-t">Selecciona un equipo<br>para ver tu simulación</div></div>';
    return;
  }
  var wm = "Hola NORLAB quiero cotizar el equipo " + eq.n + " " + eq.m;
  var eqImgTag = eq.img
    ? '<div style="text-align:center;margin:4px 0 12px"><img src="' + eq.img + '" alt="' + eq.n + '" referrerpolicy="no-referrer" style="max-height:96px;max-width:72%;object-fit:contain;background:#fff;border-radius:10px;padding:6px" onerror="this.parentNode.style.display=\'none\'"></div>'
    : '';
  // Tema visual por plan (diferencia fin/renta/comodato): acento + tagline.
  var THEMES = {
    fin: { ac: '#1976d2', lt: '#90caf9', tag: 'Compra el equipo a plazos — enganche + mensualidades' },
    ren: { ac: '#0891b2', lt: '#67e8f9', tag: 'Úsalo sin comprarlo — mantenimiento incluido' },
    com: { ac: '#2e9e5b', lt: '#a5d6a7', tag: '$0 de inversión inicial — pagas reactivos' },
  };
  var TH = THEMES[sTab] || THEMES.fin;
  var tagTag = '<div style="font-size:12px;color:#cfd8e3;font-weight:500;margin:2px 0 14px">' + TH.tag + '</div>';

  // ── RENTA ────────────────────────────────────────────────────────────────
  if (sTab === "ren") {
    var r = FM.calcRenta(eq);
    box.innerHTML = '<div class="res" style="border-top:5px solid ' + TH.ac + '">' +
      '<div class="r-lbl" style="color:' + TH.lt + '">📅 Renta Mensual</div>' + tagTag + eqImgTag +
      '<div class="r-eq">' + eq.n + ' · ' + eq.m + '</div>' +
      '<div class="r-ml">Renta mensual estimada</div>' +
      '<div class="r-mv">' + fmt2(r.mensualIVA) + '</div>' +
      '<div class="r-ms">Incluye IVA · Plazo mínimo ' + (r.plazoMinMeses/12) + ' años</div>' +
      '<div class="rr"><span class="rl">Sin IVA (deducible)</span><span class="rv">' + fmt2(r.mensual) + '</span></div>' +
      '<div class="rr"><span class="rl">Enganche</span><span class="rv">No aplica</span></div>' +
      '<div class="rr"><span class="rl">Plazo mínimo</span><span class="rv">' + r.plazoMinMeses + ' meses</span></div>' +
      '<div class="rr"><span class="rl">Mantenimiento</span><span class="rv" style="color:#a5d6a7">Incluido ✓</span></div>' +
      '<div class="rr"><span class="rl">Tasa</span><span class="rv">' + (r.tasaMensual*100) + '% mensual</span></div>' +
      '<div class="r-note">Estimado sujeto a propuesta formal.</div>' +
      '<div class="r-cta">' +
      '<button class="r-btn" onclick="openMd()">Solicitar renta →</button>' +
      '<a class="r-wa" href="' + waLink(wm + ' - Renta mensual') + '" target="_blank">' + waSvg() + ' Cotizar por WhatsApp</a>' +
      '<div class="r-sub">Respuesta en menos de 24 hrs</div>' +
      '</div></div>';
    return;
  }

  // ── COMODATO ─────────────────────────────────────────────────────────────
  if (sTab === "com") {
    var co = FM.calcComodato(eq);
    box.innerHTML = '<div class="res" style="border-top:5px solid ' + TH.ac + '">' +
      '<div class="r-lbl" style="color:' + TH.lt + '">🤝 Comodato</div>' + tagTag + eqImgTag +
      '<div class="r-eq">' + eq.n + ' · ' + eq.m + '</div>' +
      '<div class="z-badge">$0 de adquisición</div>' +
      '<div class="com-box"><div class="com-lbl">Compra mínima mensual de reactivos</div><div class="com-val">' + fmt(co.reactivosMinIVA) + '</div><div class="com-sub">Durante ' + co.duracionMeses + ' meses</div><div style="font-size:10px;opacity:.7;margin-top:2px">Sin IVA (deducible): ' + fmt(co.reactivosMin) + '/mes</div></div>' +
      '<div class="rr"><span class="rl">Costo adquisición</span><span class="rv" style="color:#a5d6a7">$0</span></div>' +
      '<div class="rr"><span class="rl">Depósito garantía</span><span class="rv">' + fmt(co.deposito) + '</span></div>' +
      '<div class="rr"><span class="rl">Duración</span><span class="rv">' + co.duracionMeses + ' meses</span></div>' +
      '<div class="rr"><span class="rl">Depósito equiv.</span><span class="rv">' + co.depositoMeses + ' meses de compra</span></div>' +
      '<div class="rr"><span class="rl">Opción de compra</span><span class="rv">' + fmt(co.opcionCompra) + '</span></div>' +
      '<div class="r-cta">' +
      '<button class="r-btn" onclick="openMd()">Solicitar comodato →</button>' +
      '<a class="r-wa" href="' + waLink(wm + ' - Comodato') + '" target="_blank">' + waSvg() + ' Cotizar por WhatsApp</a>' +
      '<div class="r-sub">Respuesta en menos de 24 hrs</div>' +
      '</div></div>';
    return;
  }

  // ── FINANCIAMIENTO ───────────────────────────────────────────────────────
  var f = FM.calcFinanciamiento(eq, sMes, sEng);
  box.innerHTML = '<div class="res" style="border-top:5px solid ' + TH.ac + '">' +
    '<div class="r-lbl" style="color:' + TH.lt + '">💳 Financiamiento</div>' + tagTag + eqImgTag +
    '<div class="r-eq">' + eq.n + ' · ' + eq.m + '</div>' +
    '<div class="r-ml">Mensualidad</div>' +
    '<div class="r-mv">' + fmt2(f.mensualIVA) + '</div>' +
    '<div class="r-ms">Incluye IVA · ' + f.plazoMeses + ' pagos</div>' +
    '<div class="rr"><span class="rl">Precio equipo</span><span class="rv">' + fmt(eq.p) + '</span></div>' +
    '<div class="rr"><span class="rl">Enganche (' + f.enganchePct + '%)</span><span class="rv">' + fmt(f.engancheIVA) + '</span></div>' +
    '<div class="rr"><span class="rl">Capital financiado</span><span class="rv">' + fmt(f.capital) + '</span></div>' +
    '<div class="rr"><span class="rl">Tasa mensual</span><span class="rv">' + (f.sinIntereses ? "0% sin intereses 🎉" : (f.tasaMensual*100) + "% mensual") + '</span></div>' +
    '<div class="rr"><span class="rl">Intereses totales</span><span class="rv" style="color:' + (f.intereses>0 ? "#ffb74d" : "#a5d6a7") + '">' + fmt(f.intereses) + ' s/IVA</span></div>' +
    '<div class="rr"><span class="rl">Total sin IVA (deducible)</span><span class="rv">' + fmt2(f.totalSinIVA) + '</span></div>' +
    '<div class="r-tot"><span class="rtl">Total con IVA</span><span class="rtv">' + fmt2(f.totalIVA) + '</span></div>' +
    (f.sinIntereses ? '<div class="r-green">🎉 Sin intereses — Financiamiento al 0%</div>' : '') +
    (eq.nota ? '<div class="r-note">ℹ️ ' + eq.nota + '</div>' : '') +
    '<div class="r-cta">' +
    '<button class="r-btn" onclick="openMd()">Solicitar este plan →</button>' +
    '<a class="r-wa" href="' + waLink(wm + ' - Financiamiento ' + f.plazoMeses + ' meses mensualidad ' + fmt2(f.mensual)) + '" target="_blank">' + waSvg() + ' Cotizar por WhatsApp</a>' +
    '<div class="r-sub">Respuesta en menos de 24 hrs</div>' +
    '</div></div>';
}

// ── Hand-off a la solicitud (mismos números que el simulador) ─────────────────
function openMd() {
  var eq = EQ.find(function (e) { return e.id === sId; });
  if (!eq) return;
  var planName = "", mensual = "", enganche = "", plazo = "", engPct = "";
  if (sTab === "fin") {
    var f = FM.calcFinanciamiento(eq, sMes, sEng);
    planName = "Financiamiento"; plazo = String(f.plazoMeses); engPct = String(f.enganchePct);
    mensual = fmt2(f.mensualIVA) + " c/IVA";
    enganche = fmt(f.engancheIVA) + " (" + f.enganchePct + "%)";
  } else if (sTab === "ren") {
    var r = FM.calcRenta(eq);
    planName = "Renta"; mensual = fmt2(r.mensualIVA) + " c/IVA";
  } else if (sTab === "com") {
    var co = FM.calcComodato(eq);
    planName = "Comodato";
    mensual = "Compra mín. " + fmt(co.reactivosMinIVA) + "/mes";
    enganche = "Depósito: " + fmt(co.deposito) + " (" + co.depositoMeses + " meses)";
  }
  var params = "equipo=" + encodeURIComponent(eq.n + " · " + eq.m) +
    "&plan=" + encodeURIComponent(planName) +
    "&plazo=" + encodeURIComponent(plazo) +
    "&mensual=" + encodeURIComponent(mensual) +
    "&enganche=" + encodeURIComponent(enganche) +
    "&engPct=" + encodeURIComponent(engPct) +
    "&precio=" + encodeURIComponent(eq.p || 0);
  window.location.href = "solicitud.html?" + params;
}

// ── Init: carga catálogo en vivo (fallback resiliente) y renderiza UNA vez ────
FM.loadEquipos(function (list) { EQ = list; render(); });
render(); // pinta de inmediato con el fallback mientras llega el catálogo
