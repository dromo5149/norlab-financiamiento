
const EQ_JSON_URL = 'https://script.google.com/macros/s/AKfycbySCcqJ3dyRjGX8qA-ysssBh6PI5lZfyS3BbDGHh-KfgnFwjYyn4IpH9ybKq-s7yOB2/exec';
const EQ_FALLBACK = [
  {id:1,  n:"BA88A",   m:"Mindray", c:"Química Clínica", p:39990,   co:30000,  mr:null, pl:["fin"],             mx:6,  dm:0, mc:0,  nota:"0% de interés hasta 4 meses · máximo 6 meses"},
  {id:2,  n:"AQ-200i", m:"Meril",   c:"Química Clínica", p:184338,  co:131670, mr:0.40, pl:["fin","com"],       mx:24, dm:3, mc:48, nota:null},
  {id:3,  n:"DH22",    m:"DYMIND",  c:"Hematología",     p:95000,   co:73000,  mr:0.30, pl:["fin","com"],       mx:24, dm:3, mc:36, nota:null},
  {id:4,  n:"DH36",    m:"DYMIND",  c:"Hematología",     p:106000,  co:82000,  mr:0.30, pl:["fin","com"],       mx:24, dm:3, mc:36, nota:null},
  {id:5,  n:"DF55",    m:"DYMIND",  c:"Hematología",     p:205000,  co:160800, mr:0.30, pl:["fin","com"],       mx:24, dm:3, mc:48, nota:null},
  {id:6,  n:"DH76",    m:"DYMIND",  c:"Hematología",     p:260000,  co:210000, mr:0.30, pl:["fin","com"],       mx:24, dm:4, mc:48, nota:null},
  {id:7,  n:"c-5000",  m:"Poclight",c:"Inmunología",     p:90000,   co:57750,  mr:0.40, pl:["fin","com"],       mx:24, dm:3, mc:36, nota:null},
  {id:8,  n:"X3",      m:"MAGLUMI", c:"Inmunología",     p:590150,  co:453962, mr:0.30, pl:["ren","fin","com"], mx:24, dm:6, mc:60, nota:null},
  {id:9,  n:"X6",      m:"MAGLUMI", c:"Inmunología",     p:1388587, co:1068144,mr:0.30, pl:["ren","fin","com"], mx:24, dm:6, mc:60, nota:null},
  {id:10, n:"X8",      m:"MAGLUMI", c:"Inmunología",     p:2391289, co:1839453,mr:0.30, pl:["ren","fin","com"], mx:24, dm:6, mc:60, nota:null},
];
let EQ = [...EQ_FALLBACK];

const fmt  = n => new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:0,maximumFractionDigits:0}).format(n);
const fmt2 = n => new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:2}).format(n);
const waLink = msg => "https://wa.me/525621836094?text=" + encodeURIComponent(msg);
const waSvg  = () => '<svg width="15" height="15" fill="white" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';

let sTab="fin", sId=null, sMes=12, sEng=30, sCat="Todos";

// ── FAQ ──────────────────────────────────────────────────────────────────────
function faq(btn) {
  const a = btn.nextElementSibling;
  const ic = btn.querySelector(".faq-ic");
  const open = a.classList.toggle("op");
  ic.textContent = open ? "×" : "+";
}

// ── SIMULATOR ────────────────────────────────────────────────────────────────
function setTab(t) { sTab=t; sId=null; ["fin","ren","com"].forEach(x => document.getElementById("t-"+x).classList.toggle("on", x===t)); render(); }

function calcFin(p, ep, m, t) {
  const e = p*ep/100, cap = p-e;
  if (t === 0) return { e, cap, mn: cap/m, int: 0, tot: p };
  const f = Math.pow(1+t, m), mn = cap*(t*f)/(f-1);
  return { e, cap, mn, int: mn*m-cap, tot: e+mn*m };
}

function calcCom(eq) {
  const mp = eq.co/(eq.mr*eq.mc), mr = mp*1.2;
  return { mr, dep: mr*eq.dm, gan: mr*eq.mc*eq.mr };
}

function render() {
  // Category pills
  const cats = ["Todos", ...new Set(EQ.map(e => e.c))];
  const cf = document.getElementById("cats");
  cf.innerHTML = "";
  cats.forEach(c => {
    const b = document.createElement("button");
    b.className = "cat" + (sCat===c ? " on" : "");
    b.textContent = c;
    b.onclick = () => { sCat=c; sId=null; render(); };
    cf.appendChild(b);
  });

  // Equipment grid
  const lista = EQ.filter(eq => {
    if (sCat !== "Todos" && eq.c !== sCat) return false;
    if (sTab === "ren" && !eq.pl.includes("ren")) return false;
    if (sTab === "com" && !eq.pl.includes("com")) return false;
    return true;
  });
  const eg = document.getElementById("eqs");
  eg.innerHTML = "";
  lista.forEach(eq => {
    const b = document.createElement("button");
    b.className = "eq" + (sId===eq.id ? " on" : "");
    b.innerHTML = '<span class="eq-n">' + eq.n + '</span><span class="eq-b">' + eq.m + '</span><span class="eq-p">' + fmt(eq.p) + '</span>';
    b.onclick = () => { sId=eq.id; sMes=(eq.id===1?4:12); sEng=30; render(); };
    eg.appendChild(b);
  });

  // Plazo & Enganche visibility
  const eq = EQ.find(e => e.id===sId);
  const fp = document.getElementById("fPlazo"), fe = document.getElementById("fEng");

  if (sTab !== "fin") {
    fp.style.display = "none"; fe.style.display = "none";
  } else {
    fp.style.display = "block";
    const opts = eq ? (eq.id===1 ? [4,5,6] : [6,12,18,24].filter(m => m<=eq.mx)) : [6,12,18,24];
    const pg = document.getElementById("pzs");
    pg.innerHTML = "";
    opts.forEach(m => {
      const b = document.createElement("button");
      b.className = "pz" + (sMes===m ? " on" : "");
      b.innerHTML = m + '<br><span style="font-size:9px;opacity:.65">meses</span>';
      b.onclick = () => { sMes=m; render(); };
      pg.appendChild(b);
    });
    fe.style.display = (eq && eq.id!==1) ? "block" : "none";
    if (eq && eq.id!==1) {
      document.getElementById("engLbl").textContent = "Enganche: " + sEng + "% — " + fmt(eq.p*sEng/100);
      const sl = document.getElementById("engS");
      sl.value = sEng;
      sl.oninput = ev => { sEng = parseInt(ev.target.value); render(); };
    }
  }

  // Result panel
  const box = document.getElementById("simR");
  if (!eq) {
    box.innerHTML = '<div class="empty"><div class="empty-i">🔬</div><div class="empty-t">Selecciona un equipo<br>para ver tu simulación</div></div>';
    return;
  }

  const wm = "Hola NORLAB quiero cotizar el equipo " + eq.n + " " + eq.m;

  if (sTab === "ren") {
    const mn = eq.p*0.025;
    CP = {eq: eq.n+' · '+eq.m, plan:'Renta Mensual', ml:'Renta mensual', mv:fmt2(mn)+' + IVA', el:'Mantenimiento', ev:'Incluido', details:'Tasa: 2.5% mensual | Sin enganche'};
    box.innerHTML = '<div class="res">' +
      '<div class="r-lbl">📅 Renta Mensual</div>' +
      '<div class="r-eq">' + eq.n + ' · ' + eq.m + '</div>' +
      '<div class="r-ml">Renta mensual estimada</div>' +
      '<div class="r-mv">' + fmt2(mn) + '</div>' +
      '<div class="r-ms">+ IVA · Sin enganche</div>' +
      '<div class="rr"><span class="rl">Enganche</span><span class="rv">No aplica</span></div>' +
      '<div class="rr"><span class="rl">Plazo</span><span class="rv">Sin plazo fijo</span></div>' +
      '<div class="rr"><span class="rl">Mantenimiento</span><span class="rv" style="color:#a5d6a7">Incluido ✓</span></div>' +
      '<div class="rr"><span class="rl">Tasa</span><span class="rv">2.5% mensual</span></div>' +
      '<div class="r-note">Estimado sujeto a propuesta formal.</div>' +
      '<div class="r-cta">' +
      '<button class="r-btn" onclick="openMd()">Solicitar renta →</button>' +
      '<a class="r-wa" href="' + waLink(wm + ' - Renta mensual') + '" target="_blank">' + waSvg() + ' Cotizar por WhatsApp</a>' +
      '<div class="r-sub">Respuesta en menos de 24 hrs</div>' +
      '</div></div>';
    return;
  }

  if (sTab === "com") {
    const {mr, dep, gan} = calcCom(eq), gv = eq.p-eq.co, mejor = gan>gv;
    CP = {eq: eq.n+' · '+eq.m, plan:'Comodato', ml:'Compra mínima/mes', mv:fmt(mr), el:'Depósito', ev:fmt(dep), details:'Compra mínima: '+fmt(mr)+'/mes | Depósito: '+fmt(dep)+' | Duración: '+eq.mc+' meses'};
    box.innerHTML = '<div class="res">' +
      '<div class="r-lbl">🤝 Comodato</div>' +
      '<div class="r-eq">' + eq.n + ' · ' + eq.m + '</div>' +
      '<div class="z-badge">$0 de adquisición</div>' +
      '<div class="com-box"><div class="com-lbl">Compra mínima mensual de reactivos</div><div class="com-val">' + fmt(mr) + '</div><div class="com-sub">Durante ' + eq.mc + ' meses · 20% colchón</div></div>' +
      '<div class="rr"><span class="rl">Costo adquisición</span><span class="rv" style="color:#a5d6a7">$0</span></div>' +
      '<div class="rr"><span class="rl">Depósito garantía</span><span class="rv">' + fmt(dep) + '</span></div>' +
      '<div class="rr"><span class="rl">Duración</span><span class="rv">' + eq.mc + ' meses</span></div>' +
      '<div class="rr"><span class="rl">Depósito equiv.</span><span class="rv">' + eq.dm + ' meses de compra</span></div>' +
      '<div class="rr"><span class="rl">Opción de compra</span><span class="rv">' + fmt(eq.co*0.15) + '</span></div>' +
      '<div class="r-tot"><span class="rtl">vs. Venta directa</span><span class="rtv" style="color:' + (mejor?"#a5d6a7":"#fff") + '">' + (mejor ? "+" + fmt(gan-gv) + " más" : fmt(gv) + " venta") + '</span></div>' +
      '<div class="r-cta">' +
      '<button class="r-btn" onclick="openMd()">Solicitar comodato →</button>' +
      '<a class="r-wa" href="' + waLink(wm + ' - Comodato') + '" target="_blank">' + waSvg() + ' Cotizar por WhatsApp</a>' +
      '<div class="r-sub">Respuesta en menos de 24 hrs</div>' +
      '</div></div>';
    return;
  }

  // Financiamiento
  const t  = eq.id===1 ? (sMes<=4 ? 0 : 0.015) : 0.015;
  const m  = eq.id===1 ? Math.min(sMes,6) : sMes;
  const ep = eq.id===1 ? 30 : sEng;
  const {e, cap, mn, int, tot} = calcFin(eq.p, ep, m, t);
  CP = {eq: eq.n+' · '+eq.m, plan:'Financiamiento '+m+' meses', ml:'Mensualidad', mv:fmt2(mn)+' + IVA', el:'Total a pagar', ev:fmt2(tot), details:'Enganche ('+ep+'%): '+fmt(e)+' | Capital: '+fmt(cap)+' | Total: '+fmt2(tot)};

  box.innerHTML = '<div class="res">' +
    '<div class="r-lbl">💳 Financiamiento</div>' +
    '<div class="r-eq">' + eq.n + ' · ' + eq.m + '</div>' +
    '<div class="r-ml">Mensualidad</div>' +
    '<div class="r-mv">' + fmt2(mn) + '</div>' +
    '<div class="r-ms">+ IVA · ' + m + ' pagos</div>' +
    '<div class="rr"><span class="rl">Precio equipo</span><span class="rv">' + fmt(eq.p) + '</span></div>' +
    '<div class="rr"><span class="rl">Enganche (' + ep + '%)</span><span class="rv">' + fmt(e) + '</span></div>' +
    '<div class="rr"><span class="rl">Capital financiado</span><span class="rv">' + fmt(cap) + '</span></div>' +
    '<div class="rr"><span class="rl">Tasa mensual</span><span class="rv">' + (t===0 ? "0% sin intereses 🎉" : "1.5% mensual") + '</span></div>' +
    '<div class="rr"><span class="rl">Intereses totales</span><span class="rv" style="color:' + (int>0 ? "#ffb74d" : "#a5d6a7") + '">' + fmt(int) + '</span></div>' +
    '<div class="r-tot"><span class="rtl">Total a pagar</span><span class="rtv">' + fmt2(tot) + '</span></div>' +
    (t===0 ? '<div class="r-green">🎉 Sin intereses — Financiamiento al 0%</div>' : '') +
    (eq.nota ? '<div class="r-note">ℹ️ ' + eq.nota + '</div>' : '') +
    '<div class="r-cta">' +
    '<button class="r-btn" onclick="openMd()">Solicitar este plan →</button>' +
    '<a class="r-wa" href="' + waLink(wm + ' - Financiamiento ' + m + ' meses mensualidad ' + fmt2(mn)) + '" target="_blank">' + waSvg() + ' Cotizar por WhatsApp</a>' +
    '<div class="r-sub">Respuesta en menos de 24 hrs</div>' +
    '</div></div>';
}

function initPortal() {
  var cbName = 'nlEQ_' + Date.now();
  var script = document.createElement('script');
  var timeout = setTimeout(function() {
    if (document.head.contains(script)) document.head.removeChild(script);
    delete window[cbName]; render();
  }, 5000);
  window[cbName] = function(data) {
    clearTimeout(timeout);
    if (document.head.contains(script)) document.head.removeChild(script);
    delete window[cbName];
    if (Array.isArray(data) && data.length > 0) EQ = data;
    render();
  };
  script.src = EQ_JSON_URL + '?callback=' + cbName + '&ts=' + Date.now();
  script.onerror = function() {
    clearTimeout(timeout);
    if (document.head.contains(script)) document.head.removeChild(script);
    delete window[cbName]; render();
  };
  document.head.appendChild(script);
}
initPortal();

// ── MODAL ────────────────────────────────────────────────────────────────────
const KOMMO = { subdomain:'', token:'' };
let CP = {};

function openMd() {
  var eq = EQ.find(function(e) { return e.id === sId; });
  if (!eq) return;
  var planName = '', mensual = '', enganche = '', plazo = '';
  if (sTab === 'fin') {
    var tasa = (eq.nota && eq.nota.indexOf('0%') !== -1) ? 0 : 0.015;
    var ep = sEng;
    var e = eq.p * ep/100;
    var cap = eq.p - e;
    var mn = tasa === 0 ? cap/sMes : cap * tasa * Math.pow(1+tasa,sMes)/(Math.pow(1+tasa,sMes)-1);
    planName = 'Financiamiento'; plazo = String(sMes);
    mensual = '$'+mn.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})+' + IVA';
    enganche = '$'+Math.round(e).toLocaleString('es-MX')+' ('+ep+'%)';
  } else if (sTab === 'ren') {
    // Renta: 3.5% mensual (incluye mantenimiento preventivo 10% anual)
    planName = 'Renta'; mensual = '$'+(eq.p*0.035).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})+' + IVA';
  } else if (sTab === 'com') {
    // Comodato: reactivos minimos para recuperar equipo en 24 meses + mant. preventivo
    // reactivos = (equipo/24 + equipo*10%/12) / 35% margen
    var mantMensual = eq.p * 0.10 / 12;
    var mr = Math.ceil((eq.p / 24 + mantMensual) / 0.35);
    var dep = mr * 2; // deposito = 2 meses de reactivos
    planName = 'Comodato';
    mensual = 'Compra mín. $'+Math.round(mr).toLocaleString('es-MX')+'/mes';
    enganche = 'Depósito: $'+Math.round(dep).toLocaleString('es-MX')+' (2 meses)';
  }
  var params = 'equipo=' + encodeURIComponent(eq.n + ' · ' + eq.m) +
    '&plan=' + encodeURIComponent(planName) +
    '&plazo=' + encodeURIComponent(plazo) +
    '&mensual=' + encodeURIComponent(mensual) +
    '&enganche=' + encodeURIComponent(enganche) +
    '&precio=' + encodeURIComponent(eq.p || 0);
  window.location.href = 'solicitud.html?' + params;
}

function closeMd() { document.getElementById("ov").classList.remove("on"); document.body.style.overflow = ""; }
function ovClick(e) { if (e.target===document.getElementById("ov")) closeMd(); }
document.addEventListener("keydown", e => { if(e.key==="Escape") closeMd(); });

function chk() {
  let ok = true;
  const rules = {
    n: [v => v.trim().length>=3,  "Ingresa tu nombre"],
    t: [v => v.replace(/\D/g,"").length>=8, "Teléfono inválido"],
    e: [v => /^[^@]+@[^@]+\.[^@]+$/.test(v), "Email inválido"],
    c: [v => v.trim().length>=2,  "Ingresa tu ciudad"],
    l: [v => v.trim().length>=3,  "Ingresa el nombre"]
  };
  Object.entries(rules).forEach(([f,[fn,msg]]) => {
    const inp = document.getElementById("f"+f), err = document.getElementById("e"+f);
    const valid = fn(inp.value);
    inp.classList.toggle("er", !valid); err.classList.toggle("on", !valid);
    if (!valid) ok = false;
  });
  return ok;
}

async function sendKommo(d) {
  if (!KOMMO.subdomain || !KOMMO.token) return;
  try {
    await fetch("https://" + KOMMO.subdomain + ".kommo.com/api/v4/leads/complex", {
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":"Bearer " + KOMMO.token},
      body: JSON.stringify([{
        name: "[Simulador] " + d.eq + " · " + d.lab,
        tags_to_add: [{name: d.plan}, {name:"Simulador Web"}],
        _embedded: {
          contacts: [{
            first_name: d.nombre.split(" ")[0],
            last_name: d.nombre.split(" ").slice(1).join(" ")||"",
            custom_fields_values: [
              {field_code:"PHONE", values:[{value:d.tel, enum_code:"WORK"}]},
              {field_code:"EMAIL", values:[{value:d.email, enum_code:"WORK"}]}
            ]
          }],
          notes: [{note_type:"common", params:{text:
            "SOLICITUD SIMULADOR NORLAB\n\n" +
            "Nombre: " + d.nombre + "\nLaboratorio: " + d.lab + "\nCiudad: " + d.ciudad +
            "\nTel: " + d.tel + "\nEmail: " + d.email +
            "\n\nEquipo: " + d.eq + "\nPlan: " + d.plan + "\n" + d.details
          }}]
        }
      }])
    });
  } catch(err) { console.warn("Kommo:", err); }
}

async function submitLead() {
  if (!chk()) return;
  const btn = document.getElementById("sbtn");
  btn.disabled = true; btn.innerHTML = "⏳ Enviando...";
  const d = {
    nombre: document.getElementById("fn").value.trim(),
    tel:    document.getElementById("ft").value.trim(),
    email:  document.getElementById("fe").value.trim(),
    ciudad: document.getElementById("fc").value.trim(),
    lab:    document.getElementById("fl").value.trim(),
    eq: CP.eq, plan: CP.plan, details: CP.details||""
  };
  await sendKommo(d);
  const waMsg = encodeURIComponent(
    "Hola NORLAB, solicito información sobre este plan:\n\n" +
    "Equipo: " + d.eq + "\nPlan: " + d.plan + "\n" + d.details +
    "\n\nNombre: " + d.nombre + "\nLaboratorio: " + d.lab +
    "\nCiudad: " + d.ciudad + "\nTel: " + d.tel + "\nEmail: " + d.email
  );
  window.location.href = "https://wa.me/525621836094?text=" + waMsg;
  setTimeout(function(){ btn.disabled=false; btn.innerHTML="Solicitar por WhatsApp &#128241;"; },3000);
}

initPortal();
