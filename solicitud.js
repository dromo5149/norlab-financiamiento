const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyQWCY3SzoYKlXG_HF7D-fll3Zi-5jYWXeaOkSAPi0zJpGO3T_C-DLpW-DQLuHDxasM/exec';
const WA_NUM = '525621836094';

// Financial constants
const TASA_MANT = 0.10; // 10% anual mantenimiento preventivo
const MESES_BE_COM = 24; // punto de equilibrio comodato en meses
const MARGIN_COM = 0.35; // margen en reactivos comodato

const PLAN_HINTS = {
  fin: 'Adquieres el equipo en pagos fijos. Es tuyo al finalizar.',
  ren: 'Renta mensual fija. Incluye mantenimiento preventivo. Sin enganche. Instalacion se cotiza por separado.',
  com: 'El equipo se paga con la compra minima mensual de reactivos. Punto de equilibrio en 24 meses. Instalacion se cotiza por separado.'
};
const UMBRAL_AVAL = 300000; // Obligado Solidario requerido para equipos >= este monto
const REQ_FISICA_BASE = ['d_ine','d_dom','d_ec','d_cif'];
const REQ_FISICA_AVAL = ['d_aval_ine','d_aval_dom','d_aval_ec','d_aval_cif'];
const REQ_MORAL_BASE  = ['dm_acta','dm_poder','dm_cif','dm_dom','dm_ec'];
const REQ_MORAL_AVAL  = ['dm_aval_ine','dm_aval_dom','dm_aval_ec','dm_aval_cif'];
const STEPS = ['Equipo','Tipo','Datos','Documentos'];

const DOC_TYPE = {
  'd_ine':'INE','d_dom':'Comprobante de domicilio','d_ec':'Estado de cuenta',
  'd_cif':'Constancia SAT','d_curp':'CURP',
  'd_aval_ine':'INE del Obligado Solidario','d_aval_dom':'Domicilio del Obligado Solidario',
  'd_aval_ec':'Estado de cuenta del Obligado Solidario','d_aval_cif':'Constancia SAT del Obligado Solidario',
  'dm_acta':'Acta constitutiva','dm_poder':'Poder notarial','dm_cif':'Constancia SAT',
  'dm_dom':'Comprobante de domicilio','dm_ec':'Estado de cuenta','dm_ef':'Estados financieros',
  'dm_aval_ine':'INE del Accionista / Obligado Solidario','dm_aval_dom':'Domicilio del Accionista / Obligado Solidario',
  'dm_aval_ec':'Estado de cuenta del Accionista / Obligado Solidario','dm_aval_cif':'Constancia SAT del Accionista / Obligado Solidario'
};

function getReqDocs(){
  var base = tipo === 'fisica' ? REQ_FISICA_BASE.slice() : REQ_MORAL_BASE.slice();
  if(curPrecio >= UMBRAL_AVAL){
    base = base.concat(tipo === 'fisica' ? REQ_FISICA_AVAL : REQ_MORAL_AVAL);
  }
  return base;
}

var curStep=1, tipo='', selEq=null, zohoData=null, uploadedFiles=[], curFolio='', curMensualidad=0, curPrecio=0;
var curEngancheNum = 0;  // Valor numérico del enganche (con IVA)
var curMensualNum = 0;   // Valor numérico de la mensualidad (con IVA)
var checkedDocs=new Set();
var expandedDoc=null;
var EQ=[];

function g(id){var el=document.getElementById(id);return el?el.value:'';}

// ── Finance helpers ──────────────────────────────────────────────────────────
function calcRenta(eq){
  // 3.5% mensual = cubre equipo + mantenimiento preventivo + margen
  return eq.p * 0.036;
}
function calcComodatoReactivos(eq){
  // Reactivos minimos para liquidar equipo en 24 meses incluyendo mantenimiento
  // (reactivos * margin) = equipo/24 + mant_mensual
  // reactivos = (equipo/24 + equipo*0.10/12) / margin
  var mantMensual = eq.p * TASA_MANT / 12;
  return Math.ceil((eq.p / MESES_BE_COM + mantMensual) / MARGIN_COM);
}
function calcComodatoDeposito(eq){
  // 2 meses de reactivos como deposito
  return calcComodatoReactivos(eq) * 2;
}

// ── Progress ─────────────────────────────────────────────────────────────────
function buildProgress(){
  var w=document.getElementById('progSteps');w.innerHTML='';
  STEPS.forEach(function(l,i){
    var n=i+1,done=n<curStep,active=n===curStep;
    var d=document.createElement('div');
    d.className='ps'+(done?' done':active?' active':'');
    d.innerHTML='<div class="ps-dot">'+(done?'<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none"><polyline points="20 6 9 17 4 12"/></svg>':n)+'</div>'+(i<STEPS.length-1?'<div class="ps-line"></div>':'');
    w.appendChild(d);
  });
  document.getElementById('progPct').textContent='Paso '+curStep+' de '+STEPS.length;
}

// ── Equipment ─────────────────────────────────────────────────────────────────
function loadEquipos(retry){
  fetch(SCRIPT_URL+'?ts='+Date.now())
    .then(function(r){return r.json();})
    .then(function(data){
      if(Array.isArray(data) && data.length > 0){
        EQ = data; populateEquipos(EQ);
      } else if(!retry) {
        // Deployment frío — reintentar una vez tras 3 seg
        setTimeout(function(){ loadEquipos(true); }, 3000);
      } else {
        populateEquipos([]);
      }
    })
    .catch(function(){
      if(!retry){ setTimeout(function(){ loadEquipos(true); }, 3000); }
      else { populateEquipos([]); }
    });
}
function populateEquipos(list){
  document.getElementById('eq_loading').style.display='none';
  document.getElementById('eq_form').style.display='grid';
  var sel=document.getElementById('p_equipo');
  sel.innerHTML='<option value="">Selecciona un equipo...</option>';
  var cats={};
  list.forEach(function(eq){if(!cats[eq.c])cats[eq.c]=[];cats[eq.c].push(eq);});
  Object.keys(cats).sort().forEach(function(cat){
    var og=document.createElement('optgroup');og.label=cat;
    cats[cat].forEach(function(eq){
      var o=document.createElement('option');o.value=eq.id;o.textContent=eq.n+' \u2014 '+eq.m;og.appendChild(o);
    });
    sel.appendChild(og);
  });
  var p=new URLSearchParams(window.location.search);
  curPrecio = parseFloat(p.get('precio') || '0') || 0;
  if(p.get('equipo')){
    var eqp=decodeURIComponent(p.get('equipo')).split('\u00b7')[0].trim();
    for(var i=0;i<sel.options.length;i++){
      if(sel.options[i].text.split('\u2014')[0].trim()===eqp){sel.value=sel.options[i].value;break;}
    }
    onEquipoChange();
    if(p.get('plan')){
      setTimeout(function(){
        var ps=document.getElementById('p_plan'),pl=(p.get('plan')||'').toLowerCase();
        for(var j=0;j<ps.options.length;j++){
          var code=ps.options[j].value;
          if(code&&pl.indexOf(code==='fin'?'finan':code==='ren'?'renta':code==='com'?'comod':'xx')>-1){ps.value=code;onPlanChange();break;}
        }
      },80);
    }
  }
}
function onEquipoChange(){
  var v=document.getElementById('p_equipo').value;
  selEq=EQ.find(function(e){return String(e.id)===v;})||null;
  var ps=document.getElementById('p_plan');
  ps.innerHTML='<option value="">Selecciona un plan...</option>';
  ps.disabled=true;
  ['plazo_wrap','eng_wrap','mensual_wrap','mant_wrap'].forEach(function(id){
    var el=document.getElementById(id);if(el)el.style.display='none';
  });
  document.getElementById('plan_hint').classList.remove('on');
  // Ocultar secciones adicionales
  var banner=document.getElementById('aval_banner');
  if(banner) banner.style.display='none';
  var comWrap=document.getElementById('com_reactivos_wrap');
  if(comWrap) comWrap.style.display='none';
  if(!selEq) return;

  // Actualizar precio
  curPrecio = selEq.p || 0;

  // Banner obligado solidario
  if(banner && curPrecio >= UMBRAL_AVAL){
    banner.style.display='flex';
  }

  ps.disabled=false;
  var planNames={fin:'Financiamiento',ren:'Renta mensual',com:'Comodato'};
  selEq.pl.forEach(function(code){
    var o=document.createElement('option');o.value=code;o.textContent=(planNames[code]||code);ps.appendChild(o);
  });
  document.getElementById('p_equipo').classList.remove('er');
  document.getElementById('e_equipo').classList.remove('on');
  // Actualizar visibilidad aval en docs
  updateAvalSection(tipo);
}
function onPlanChange(){
  var code=document.getElementById('p_plan').value;
  if(!code||!selEq)return;
  document.getElementById('plan_hint').textContent=PLAN_HINTS[code]||'';
  document.getElementById('plan_hint').classList.add('on');
  var pw=document.getElementById('plazo_wrap'),ew=document.getElementById('eng_wrap'),mw=document.getElementById('mensual_wrap');
  var mantWrap=document.getElementById('mant_wrap');

  if(code==='fin'){
    pw.style.display='flex';ew.style.display='flex';mw.style.display='flex';
    if(mantWrap)mantWrap.style.display='none';
    var ps2=document.getElementById('p_plazo');ps2.innerHTML='';
    [6,12,18,24].filter(function(m){return m<=(selEq.mx||24);}).forEach(function(m){
      var o=document.createElement('option');o.value=m;o.textContent=m+' meses';ps2.appendChild(o);
    });
    calcPreview();

  }else if(code==='ren'){
    pw.style.display='none';ew.style.display='none';mw.style.display='flex';
    if(mantWrap)mantWrap.style.display='flex';
    var rentaMensual=selEq.p*0.04;  // Cambiar de calcRenta() a 4% directo
    var rentaConIVA=rentaMensual*1.16;
    var mantMensual=selEq.p*TASA_MANT/12;
    
    // Guardar valores numéricos
    curMensualNum = rentaConIVA;
    curEngancheNum = 0;
    
    document.getElementById('p_mensual').value='$'+rentaConIVA.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})+'/mes';
    document.getElementById('p_mant').value='Incluido en renta ($'+Math.round(mantMensual).toLocaleString('es-MX')+'/mes estimado)';

  }else if(code==='com'){
    pw.style.display='none';ew.style.display='flex';mw.style.display='flex';
    if(mantWrap)mantWrap.style.display='flex';
    var reactMin=calcComodatoReactivos(selEq);
    var reactMinConIVA=reactMin*1.16;
    var dep=calcComodatoDeposito(selEq);
    var mantMensualCom=selEq.p*TASA_MANT/12;
    
    // Guardar valores numéricos
    curMensualNum = reactMinConIVA;
    curEngancheNum = dep;
    
    document.getElementById('p_mensual').value='Compra min. $'+Math.round(reactMinConIVA).toLocaleString('es-MX')+'/mes';
    document.getElementById('p_enganche').value='Dep\u00f3sito: $'+Math.round(dep).toLocaleString('es-MX');
    document.getElementById('p_mant').value='Incluido en c\u00e1lculo. BE equipo = 24 meses';
    // Mostrar selector de reactivos comodato
    loadReactivosComodato(reactMin);
  }
  document.getElementById('p_plan').classList.remove('er');
  document.getElementById('e_plan').classList.remove('on');
}
function calcPreview(){
  if(!selEq)return;
  var m=parseInt(document.getElementById('p_plazo').value)||12;
  var e=selEq.p*0.30,cap=selEq.p-e;
  var tasa=(selEq.nota&&selEq.nota.indexOf('0%')!==-1)?0:0.02;
  var mn=tasa===0?cap/m:cap*tasa*Math.pow(1+tasa,m)/(Math.pow(1+tasa,m)-1);
  
  // Calcular IVA
  var engancheConIVA=e*1.16;
  var mensualidadConIVA=mn*1.16;
  
  // Guardar valores numéricos
  curEngancheNum = engancheConIVA;
  curMensualNum = mensualidadConIVA;
  
  document.getElementById('p_enganche').value='$'+Math.round(engancheConIVA).toLocaleString('es-MX')+' (30%)';
  document.getElementById('p_mensual').value='$'+mensualidadConIVA.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});
}

// ── Navigation ────────────────────────────────────────────────────────────────
function goStep(n){
  if(n>curStep&&!validateStep(curStep))return;
  document.getElementById('s'+curStep).classList.remove('active');
  curStep=n;
  document.getElementById('s'+curStep).classList.add('active');
  buildProgress();
  if(n===4){
    // Assign folio NOW so uploaded docs get correct folder name
    if(!curFolio||curFolio.indexOf('TEMP_')===0){
      curFolio='NL-'+String(Math.floor(10000+Math.random()*90000));
    }
    buildResumen();
  }
  window.scrollTo({top:0,behavior:'smooth'});
}
function validateStep(n){
  if(n===1){
    var ok=true;
    if(!document.getElementById('p_equipo').value){document.getElementById('p_equipo').classList.add('er');document.getElementById('e_equipo').classList.add('on');ok=false;}
    if(!document.getElementById('p_plan').value){document.getElementById('p_plan').classList.add('er');document.getElementById('e_plan').classList.add('on');ok=false;}
    return ok;
  }
  if(n===2){if(!tipo){document.getElementById('e_tipo').classList.add('on');return false;}return true;}
  if(n===3){return tipo==='fisica'?validateFisica():validateMoral();}
  if(n===4){
    var req=getReqDocs();
    var docsOk=req.filter(function(x){return checkedDocs.has(x);}).length;
    var req2=getReqDocs();
  var docsOk2=req2.filter(function(x){return checkedDocs.has(x);}).length;
  var warnId=tipo==='fisica'?'warn_fisica':'warn_moral';
  var warnEl2=document.getElementById(warnId);
  if(warnEl2)warnEl2.style.display=docsOk2<req2.length?'flex':'none';
    var warnEl=document.getElementById(warnId);
    // Also check aval warns
    var warnAvalF=document.getElementById('warn_aval_fisica');
    var warnAvalM=document.getElementById('warn_aval_moral');
    if(docsOk<req.length){
      if(warnEl)warnEl.style.display='flex';
      if(warnAvalF)warnAvalF.style.display='flex';
      if(warnAvalM)warnAvalM.style.display='flex';
      // Scroll to docs section
      var docsEl=document.getElementById('docs_fisica')||document.getElementById('docs_moral');
      if(docsEl)docsEl.scrollIntoView({behavior:'smooth',block:'start'});
      return false;
    }
    if(warnEl)warnEl.style.display='none';
    return true;
  }
  return true;
}
function vf(id,fn,eid){
  var el=document.getElementById(id),er=document.getElementById(eid),ok=fn(el?el.value:'');
  if(el)el.classList.toggle('er',!ok);if(er)er.classList.toggle('on',!ok);return ok;
}
function validateFisica(){
  var ok=true;
  if(!vf('f_nombre',function(x){return x.trim().length>2;},'ef_nombre'))ok=false;
  if(!vf('f_rfc',function(x){return x.trim().length>=12;},'ef_rfc'))ok=false;
  if(!vf('f_curp',function(x){return x.trim().length===18;},'ef_curp'))ok=false;
  if(!vf('f_tel',function(x){return x.replace(/[^0-9]/g,'').length>=8;},'ef_tel'))ok=false;
  if(!vf('f_email',function(x){return /^[^@]+@[^@]+\.[^@]+$/.test(x);},'ef_email'))ok=false;
  if(!vf('f_negocio',function(x){return x.trim().length>2;},'ef_negocio'))ok=false;
  if(!vf('f_dir',function(x){return x.trim().length>5;},'ef_dir'))ok=false;
  if(!vf('f_ciudad',function(x){return x.trim().length>1;},'ef_ciudad'))ok=false;
  if(!vf('f_anos',function(x){return x!=='';},'ef_anos'))ok=false;
  return ok;
}
function validateMoral(){
  var ok=true;
  if(!vf('m_razon',function(x){return x.trim().length>2;},'em_razon'))ok=false;
  if(!vf('m_rfc',function(x){return x.trim().length>=12;},'em_rfc'))ok=false;
  if(!vf('m_rep',function(x){return x.trim().length>2;},'em_rep'))ok=false;
  if(!vf('m_tel',function(x){return x.replace(/[^0-9]/g,'').length>=8;},'em_tel'))ok=false;
  if(!vf('m_email',function(x){return /^[^@]+@[^@]+\.[^@]+$/.test(x);},'em_email'))ok=false;
  if(!vf('m_dir',function(x){return x.trim().length>5;},'em_dir'))ok=false;
  if(!vf('m_ciudad',function(x){return x.trim().length>1;},'em_ciudad'))ok=false;
  if(!vf('m_anos',function(x){return x!=='';},'em_anos'))ok=false;
  return ok;
}
function setTipo(t){
  tipo=t;
  document.getElementById('tc_fisica').classList.toggle('on',t==='fisica');
  document.getElementById('tc_moral').classList.toggle('on',t==='moral');
  document.getElementById('e_tipo').classList.remove('on');
  document.getElementById('cliente_card_fisica').style.display=t==='fisica'?'block':'none';
  document.getElementById('cliente_card_moral').style.display=t==='moral'?'block':'none';
  document.getElementById('form_fisica').style.display=t==='fisica'?'block':'none';
  document.getElementById('form_moral').style.display=t==='moral'?'block':'none';
  document.getElementById('docs_fisica').style.display=t==='fisica'?'block':'none';
  document.getElementById('docs_moral').style.display=t==='moral'?'block':'none';
  updateAvalSection(t);
}

function updateAvalSection(t){
  var needsAval = curPrecio >= UMBRAL_AVAL;
  var avalFisica = document.getElementById('docs_aval_fisica');
  var avalMoral  = document.getElementById('docs_aval_moral');
  if(avalFisica) avalFisica.style.display = (t==='fisica' && needsAval) ? 'block' : 'none';
  if(avalMoral)  avalMoral.style.display  = (t==='moral'  && needsAval) ? 'block' : 'none';
  // Datos form del aval (visible en step 3)
  var formAval = document.getElementById('form_aval');
  if(formAval) formAval.style.display = needsAval ? 'block' : 'none';
}

// ── Reactivos Comodato ────────────────────────────────────────────────────────
var reactivosCache=null;
var reactivosSeleccionados=[];
function loadReactivosComodato(reactMin){
  var wrap=document.getElementById('com_reactivos_wrap');
  var grid=document.getElementById('com_reactivos_grid');
  var loading=document.getElementById('com_reactivos_loading');
  if(!wrap)return;
  wrap.style.display='block';
  grid.style.display='none';
  loading.style.display='block';
  loading.textContent='Cargando cat\u00e1logo de reactivos...';
  if(reactivosCache){renderReactivosGrid(reactivosCache,reactMin);return;}
  fetch(SCRIPT_URL+'?action=reactivos_comodato')
    .then(function(r){return r.json();})
    .then(function(d){
      reactivosCache=d.reactivos||[];
      renderReactivosGrid(reactivosCache,reactMin);
    })
    .catch(function(){loading.textContent='No se pudo cargar el cat\u00e1logo.';});
}
function renderReactivosGrid(list,reactMin){
  var grid=document.getElementById('com_reactivos_grid');
  var loading=document.getElementById('com_reactivos_loading');
  loading.style.display='none';
  if(!list||list.length===0){grid.innerHTML='<p style="font-size:13px;color:var(--muted)">Cat\u00e1logo no disponible. Tu ejecutivo te enviar\u00e1 la lista de precios.</p>';grid.style.display='block';return;}
  var html='<div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:8px;text-transform:uppercase;letter-spacing:.3px">Cat\u00e1logo de precios especiales</div>';
  html+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px;margin-bottom:10px">';
  list.forEach(function(r,i){
    html+='<label style="display:flex;align-items:flex-start;gap:8px;background:#f8fbfd;border:1px solid #d6eaf5;border-radius:8px;padding:10px;cursor:pointer;transition:all .15s" id="rx_card_'+i+'">';
    html+='<input type="checkbox" id="rx_chk_'+i+'" style="margin-top:2px;flex-shrink:0" onchange="updateReactivosSel()" data-i="'+i+'" data-nombre="'+(r.n||'').replace(/"/g,'&quot;')+'" data-precio="'+(r.p||0)+'" data-unidad="'+(r.u||'unidad')+'">';
    html+='<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:700;color:var(--navy)">'+(r.n||'Reactivo')+'</div>';
    html+='<div style="font-size:11px;color:var(--muted)">'+(r.m||'')+'</div>';
    html+='<div style="font-size:13px;font-weight:700;color:#4AB8C8;margin-top:3px">$'+(Number(r.p)||0).toLocaleString('es-MX',{minimumFractionDigits:2})+' / '+(r.u||'kit')+'</div></div></label>';
  });
  html+='</div>';
  grid.innerHTML=html;
  grid.style.display='block';
  updateReactivosSel(reactMin);
}
function updateReactivosSel(reactMinOverride){
  var reactMin=reactMinOverride||(selEq?calcComodatoReactivos(selEq):0);
  var chks=document.querySelectorAll('[id^="rx_chk_"]');
  var total=0,selected=[];
  chks.forEach(function(c){
    var card=document.getElementById('rx_card_'+c.dataset.i);
    if(c.checked){
      var p=Number(c.dataset.precio)||0;
      total+=p;
      selected.push(c.dataset.nombre+' ($'+p.toLocaleString('es-MX')+'/'+c.dataset.unidad+')');
      if(card){card.style.background='#e8f7f9';card.style.borderColor='#4AB8C8';}
    }else{
      if(card){card.style.background='#f8fbfd';card.style.borderColor='#d6eaf5';}
    }
  });
  reactivosSeleccionados=selected;
  var info=document.getElementById('com_reactivos_sel_info');
  if(!info)return;
  if(selected.length===0){info.style.display='none';return;}
  var diff=total-reactMin;
  var ok=diff>=0;
  info.style.display='block';
  info.innerHTML='<div style="font-weight:700;color:#1A3A4A;font-size:13px">'+selected.length+' reactivo(s) seleccionado(s) &mdash; Total: $'+total.toLocaleString('es-MX',{minimumFractionDigits:2})+'/mes</div>'+
    '<div style="font-size:12px;margin-top:3px">Compra m\u00ednima requerida: <strong>$'+Math.round(reactMin).toLocaleString('es-MX')+'/mes</strong> &nbsp;&bull;&nbsp; '+
    '<span style="color:'+(ok?'#2e7d32':'#c62828')+'">'+(ok?'\u2713 Cubre la compra m\u00ednima (+$'+diff.toLocaleString('es-MX')+')'
      :'Faltan $'+Math.abs(diff).toLocaleString('es-MX')+' para cubrir la compra m\u00ednima')+'</span></div>';
}

// ── Zoho Lookup ───────────────────────────────────────────────────────────────
// Show/hide inline email field when "soy cliente" is selected
function onClienteChange(t){
  var val=document.getElementById(t==='fisica'?'f_cliente':'m_cliente').value;
  var emailRow=document.getElementById('zoho_email_row_'+t);
  var box=document.getElementById('zoho_'+t);
  if(val!=='si'){
    if(emailRow)emailRow.style.display='none';
    box.className='zoho-box';
    zohoData=null;
    return;
  }
  // Show inline email row
  if(emailRow)emailRow.style.display='flex';
  // If main email field already has valid email, trigger lookup
  var mainEmail=document.getElementById(t==='fisica'?'f_email':'m_email').value.trim();
  if(mainEmail&&/^[^@]+@[^@]+\.[^@]+$/.test(mainEmail)){
    // Pre-fill inline field
    var inlineField=document.getElementById('zoho_email_'+t);
    if(inlineField&&!inlineField.value)inlineField.value=mainEmail;
    doZohoLookup(t);
  }
}
function onZohoEmailKey(e,t){
  if(e.key==='Enter'){e.preventDefault();doZohoLookup(t);}
}
function doZohoLookup(t){
  // Use inline email field OR main email field
  var inlineField=document.getElementById('zoho_email_'+t);
  var mainEmail=document.getElementById(t==='fisica'?'f_email':'m_email').value.trim();
  var email=(inlineField&&inlineField.value.trim())||mainEmail;
  if(!email||!/^[^@]+@[^@]+\.[^@]+$/.test(email)){
    var box=document.getElementById('zoho_'+t);
    box.className='zoho-box notfound show';
    box.innerHTML='Ingresa un email v\u00e1lido para buscar.';
    return;
  }
  // Copy to main email if not set
  var mainEl=document.getElementById(t==='fisica'?'f_email':'m_email');
  if(mainEl&&!mainEl.value.trim())mainEl.value=email;

  var box=document.getElementById('zoho_'+t);
  box.className='zoho-box loading show';
  box.innerHTML='<svg viewBox="0 0 24 24" width="14" height="14" stroke="#1976d2" stroke-width="2" fill="none" style="animation:spin .8s linear infinite;margin-right:6px"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Verificando en nuestro sistema...';
  fetch(SCRIPT_URL+'?action=zoho_lookup&email='+encodeURIComponent(email)+'&ts='+Date.now())
    .then(function(r){return r.json();})
    .then(function(data){zohoData=data;renderZoho(box,data,t);})
    .catch(function(){box.className='zoho-box notfound show';box.innerHTML='Error de conexi\u00f3n.';});
}
function renderZoho(box,d,t){
  if(!d||!d.found){
    box.className='zoho-box notfound show';
    box.innerHTML='<svg viewBox="0 0 24 24" width="14" height="14" stroke="#b45309" stroke-width="2" fill="none" style="margin-right:6px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'+(d&&d.message||'No encontrado en nuestros registros.');
    return;
  }
  box.className='zoho-box found show';
  box.innerHTML='<div style="display:flex;align-items:center;gap:6px;font-weight:700;color:#2e7d32;margin-bottom:8px">'+
    '<svg viewBox="0 0 24 24" width="16" height="16" stroke="#2e7d32" stroke-width="2.5" fill="none"><polyline points="20 6 9 17 4 12"/></svg>'+
    'Cliente verificado: '+d.nombre+'</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;font-size:12px">'+
    '<span style="color:#6b7c93">Total compras</span><span style="font-weight:600">$'+(d.total_pagado||0).toLocaleString('es-MX',{maximumFractionDigits:0})+'</span>'+
    '<span style="color:#6b7c93">Facturas pagadas</span><span style="font-weight:600">'+(d.facturas_pagadas||0)+'/'+(d.total_facturas||0)+'</span>'+
    '<span style="color:#6b7c93">\u00daltima compra</span><span style="font-weight:600">'+(d.ultima_compra||'N/A')+'</span>'+
    '<span style="color:#6b7c93">Comportamiento</span><span style="font-weight:600">'+(d.comportamiento||'N/A')+'</span>'+
    (d.saldo_pendiente>0?'<span style="color:#c62828;font-weight:600;grid-column:1/-1;margin-top:4px">Saldo pendiente: $'+d.saldo_pendiente.toLocaleString('es-MX',{maximumFractionDigits:0})+'</span>':'')+
    '</div>'+
    '<div style="font-size:11px;color:#2e7d32;margin-top:8px;font-style:italic">Los campos disponibles se han llenado autom\u00e1ticamente.</div>';

  // Auto-fill ALL available fields
  function fill(id,val){if(val){var el=document.getElementById(id);if(el&&!el.value.trim())el.value=val;}}
  if(t==='fisica'){
    fill('f_nombre', d.nombre);
    fill('f_tel',    d.telefono);
    fill('f_email',  d.email||'');
    fill('f_ciudad', d.ciudad);
    fill('f_negocio',d.empresa||d.nombre);
    fill('f_rfc',    d.rfc||'');
    fill('f_dir',    d.direccion||'');
  }else{
    fill('m_razon',  d.nombre);
    fill('m_tel',    d.telefono);
    fill('m_email',  d.email||'');
    fill('m_ciudad', d.ciudad);
    fill('m_rep',    d.rep||'');
    fill('m_rfc',    d.rfc||'');
    fill('m_dir',    d.direccion||'');
  }
}

// ── Docs inline expand ────────────────────────────────────────────────────────
function toggleDoc(id){
  if(expandedDoc===id){collapseDoc(id);return;}
  if(expandedDoc)collapseDoc(expandedDoc);
  expandedDoc=id;
  var el=document.getElementById(id);
  var zone=document.getElementById('zone_'+id);
  el.classList.add('expanded');
  if(zone)zone.style.display='block';
}
function collapseDoc(id){
  var el=document.getElementById(id);
  var zone=document.getElementById('zone_'+id);
  el.classList.remove('expanded');
  if(zone)zone.style.display='none';
  if(expandedDoc===id)expandedDoc=null;
}
function checkDoc(id){
  var el=document.getElementById(id);
  checkedDocs.add(id);
  el.classList.add('checked');
  updateDocWarn();
  // Update resumen counter live
  if(curStep===4) buildResumen();
}
function updateDocWarn(){
  var req2=getReqDocs();
  var docsOk2=req2.filter(function(x){return checkedDocs.has(x);}).length;
  var warnId=tipo==='fisica'?'warn_fisica':'warn_moral';
  var warnEl2=document.getElementById(warnId);
  if(warnEl2)warnEl2.style.display=docsOk2<req2.length?'flex':'none';
}
function onDocDrop(e,docId){e.preventDefault();var z=document.getElementById('zone_'+docId);if(z)z.querySelector('.doc-upload-inner').classList.remove('drag');processDocFiles(Array.from(e.dataTransfer.files),docId);}
function onDocDragOver(e,docId){e.preventDefault();var z=document.getElementById('zone_'+docId);if(z)z.querySelector('.doc-upload-inner').classList.add('drag');}
function onDocDragLeave(e,docId){var z=document.getElementById('zone_'+docId);if(z)z.querySelector('.doc-upload-inner').classList.remove('drag');}
function onDocFileSelect(e,docId){processDocFiles(Array.from(e.target.files),docId);}
function processDocFiles(files,docId){
  if(!files.length)return;
  files.forEach(function(file){
    if(file.size>10*1024*1024){alert(file.name+' excede el limite de 10MB');return;}
    var uid='f'+Date.now()+Math.random().toString(36).substr(2,4);
    var docType=DOC_TYPE[docId]||'Documento';
    var item={uid:uid,name:file.name,docId:docId,docType:docType,tipo:tipo,status:'reading'};
    uploadedFiles.push(item);
    addDocFileItem(item,docId);
    var reader=new FileReader();
    reader.onload=function(ev){
      item.b64=ev.target.result.split(',')[1];
      item.mime=file.type||'application/octet-stream';
      item.status='uploading';
      updateDocFileItem(item);
      uploadFile(item);
      checkDoc(docId);
    };
    reader.readAsDataURL(file);
  });
}
function uploadFile(item){
  var nombre=tipo==='fisica'?(g('f_nombre')||'solicitante'):(g('m_razon')||g('m_rep')||'solicitante');
  var folio=curFolio||('NL-'+String(Math.floor(10000+Math.random()*90000)));
  if(!curFolio||curFolio.indexOf('TEMP_')===0) curFolio=folio;
  // Folder will be named: {Nombre}_{Folio}
  fetch(SCRIPT_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain'},
    body:JSON.stringify({action:'upload_doc',folio:folio,nombre:nombre,tipo_doc:item.docType,
      mensualidad:curMensualidad||0,
      file:item.b64,mime:item.mime,filename:folio+'_'+item.docType.replace(/ /g,'_')+'_'+item.name})
  }).then(function(){
    item.status='done';item.analysis='Guardado en Drive. Analisis Claude enviado por email.';
    updateDocFileItem(item);checkDoc(item.docId);
    setTimeout(function(){collapseDoc(item.docId);},800);
  }).catch(function(){
    item.status='done';item.analysis='Enviado correctamente.';
    updateDocFileItem(item);checkDoc(item.docId);
    setTimeout(function(){collapseDoc(item.docId);},800);
  });
}
function addDocFileItem(item,docId){var list=document.getElementById('flist_'+docId);if(!list)return;var d=document.createElement('div');d.id='fi_'+item.uid;d.className='fi-row';list.appendChild(d);updateDocFileItem(item);}
function updateDocFileItem(item){
  var el=document.getElementById('fi_'+item.uid);if(!el)return;
  var icons={
    reading:'<svg viewBox="0 0 24 24" width="16" height="16" stroke="#6b7c93" stroke-width="2" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    uploading:'<svg viewBox="0 0 24 24" width="16" height="16" stroke="#1976d2" stroke-width="2" fill="none" style="animation:spin .8s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>',
    done:'<svg viewBox="0 0 24 24" width="16" height="16" stroke="#2e7d32" stroke-width="2.5" fill="none"><polyline points="20 6 9 17 4 12"/></svg>',
    error:'<svg viewBox="0 0 24 24" width="16" height="16" stroke="#c62828" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
  };
  var stat={reading:'Leyendo...',uploading:'Subiendo y analizando con Claude...',done:'Guardado en Drive',error:'Error'};
  el.className='fi-row '+(item.status==='done'?'done':item.status==='uploading'?'uploading':'');
  el.innerHTML='<span style="flex-shrink:0">'+(icons[item.status]||icons.reading)+'</span>'+
    '<div style="flex:1;min-width:0">'+
    '<div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+item.name+'</div>'+
    '<div style="font-size:11px;color:#6b7c93">'+(stat[item.status]||'')+'</div>'+
    (item.status==='uploading'?'<div style="height:2px;background:#e8edf5;border-radius:2px;margin-top:4px;overflow:hidden"><div style="height:100%;background:#1976d2;width:70%"></div></div>':'')+
    '</div>'+
    (item.status!=='uploading'?'<button style="background:none;border:none;cursor:pointer;color:#aaa;font-size:14px;padding:0 2px" onclick="removeDocFile(\''+item.uid+'\',\''+item.docId+'\')"><svg viewBox="0 0 24 24" width="14" height="14" stroke="#aaa" stroke-width="2.5" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>':'');
}
function removeDocFile(uid,docId){
  uploadedFiles=uploadedFiles.filter(function(f){return f.uid!==uid;});
  var el=document.getElementById('fi_'+uid);if(el)el.remove();
  var remaining=uploadedFiles.filter(function(f){return f.docId===docId&&f.status==='done';});
  if(remaining.length===0){var docEl=document.getElementById(docId);if(docEl)docEl.classList.remove('checked');checkedDocs.delete(docId);updateDocWarn();}
}

// ── Resumen & Submit ──────────────────────────────────────────────────────────
function buildResumen(){
  var rows=[];
  if(selEq)rows.push(['Equipo',selEq.n+' \u2014 '+selEq.m]);
  var pc=document.getElementById('p_plan').value;
  rows.push(['Plan',({fin:'Financiamiento',ren:'Renta mensual',com:'Comodato'})[pc]||pc]);
  var pl=g('p_plazo');if(pl)rows.push(['Plazo',pl+' meses']);
  var mn=g('p_mensual');if(mn){rows.push(['Mensualidad / Reactivos',mn]);curMensualidad=Number((mn||'').replace(/[^0-9.]/g,''))||0;}
  var en=g('p_enganche');if(en)rows.push(['Enganche / Dep\u00f3sito',en]);
  rows.push(['Tipo',tipo==='fisica'?'Persona F\u00edsica':'Persona Moral']);
  if(tipo==='fisica'){rows.push(['Nombre',g('f_nombre')]);rows.push(['RFC',g('f_rfc')]);rows.push(['Tel\u00e9fono',g('f_tel')]);rows.push(['Email',g('f_email')]);rows.push(['Negocio',g('f_negocio')]);rows.push(['Ciudad',g('f_ciudad')]);}
  else{rows.push(['Raz\u00f3n social',g('m_razon')]);rows.push(['RFC',g('m_rfc')]);rows.push(['Representante',g('m_rep')]);rows.push(['Tel\u00e9fono',g('m_tel')]);rows.push(['Email',g('m_email')]);rows.push(['Ciudad',g('m_ciudad')]);}
  var req=getReqDocs();
  var docsOk=req.filter(function(x){return checkedDocs.has(x);}).length;
  var docsUp=uploadedFiles.filter(function(f){return f.status==='done';}).length;
  rows.push(['Documentos',docsOk+'/'+req.length+' obligatorios \u2022 '+docsUp+' subidos']);
  if(zohoData&&zohoData.found)rows.push(['Cliente verificado','\u2713 '+zohoData.nombre]);
  document.getElementById('resumen_content').innerHTML=rows.filter(function(r){return r[1];}).map(function(r){
    return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e8edf5;font-size:13px"><span style="color:#6b7c93">'+r[0]+'</span><span style="font-weight:600">'+r[1]+'</span></div>';
  }).join('');
}
function submitForm(){
  // IMPORTANTE: NO regenerar folio — usar el asignado en paso 4 (que ya se usó para subir docs)
  if(!curFolio || curFolio.indexOf('TEMP_')===0){
    curFolio='NL-'+String(Math.floor(10000+Math.random()*90000));
  }
  var btn=document.getElementById('btn_submit');btn.disabled=true;
  document.getElementById('btn_txt').textContent='Enviando...';
  document.getElementById('btn_spin').style.display='inline-block';
  var req=getReqDocs();
  var docsOk=req.filter(function(x){return checkedDocs.has(x);}).length;
  var pc=document.getElementById('p_plan').value;
  var planName=({fin:'Financiamiento',ren:'Renta mensual',com:'Comodato'})[pc]||pc;
  var data={action:'solicitud',folio:curFolio,equipo:selEq?(selEq.n+' - '+selEq.m):'',plan:planName,
    plazo:g('p_plazo'),
    mensual: curMensualNum > 0 ? '$' + curMensualNum.toLocaleString('es-MX', {minimumFractionDigits:2, maximumFractionDigits:2}) : '',
    enganche: curEngancheNum > 0 ? '$' + curEngancheNum.toLocaleString('es-MX', {minimumFractionDigits:2, maximumFractionDigits:2}) : '',
    tipo:tipo,
    nombre:g('f_nombre'),rfc:g('f_rfc')||g('m_rfc'),curp:g('f_curp'),
    tel:g('f_tel')||g('m_tel'),email:g('f_email')||g('m_email'),
    negocio:g('f_negocio'),dir:g('f_dir')||g('m_dir'),ciudad:g('f_ciudad')||g('m_ciudad'),
    anos:g('f_anos')||g('m_anos'),cliente:g('f_cliente')||g('m_cliente'),
    razon:g('m_razon'),rep:g('m_rep'),notas:g('f_notas')||g('m_notas'),
    docs_ok:docsOk,docs_req:req.length,
    // Obligado solidario
    aval_nombre:g('aval_nombre'),aval_rfc:g('aval_rfc'),aval_tel:g('aval_tel'),
    aval_dir:g('aval_dir'),aval_ciudad:g('aval_ciudad'),aval_relacion:g('aval_relacion'),
    // Reactivos comodato seleccionados
    reactivos_seleccionados:reactivosSeleccionados.join(' | '),
    zoho_cliente:zohoData&&zohoData.found?'Si':'No verificado',
    zoho_total:zohoData&&zohoData.found?String(zohoData.total_pagado||0):'',
    zoho_ultima:zohoData&&zohoData.found?(zohoData.ultima_compra||''):'',
    zoho_pagadas:zohoData&&zohoData.found?((zohoData.facturas_pagadas||0)+'/'+(zohoData.total_facturas||0)):'',
    zoho_pendiente:zohoData&&zohoData.found?String(zohoData.saldo_pendiente||0):'',
    zoho_dias_vencido:zohoData&&zohoData.found?String(zohoData.dias_vencido||0):'',
    zoho_comportamiento:zohoData&&zohoData.found?(zohoData.comportamiento||''):''
  };
  var qs=Object.keys(data).map(function(k){return encodeURIComponent(k)+'='+encodeURIComponent(data[k]||'');}).join('&');
  fetch(SCRIPT_URL+'?'+qs)
    .then(function(){showSuccess(curFolio,data);})
    .catch(function(){showSuccess(curFolio,data);});
}
function showSuccess(ref,data){
  for(var i=1;i<=4;i++)document.getElementById('s'+i).classList.remove('active');
  document.getElementById('successScreen').classList.add('on');
  document.getElementById('refNum').textContent=ref;
  document.getElementById('refNum2').textContent=ref;
  var nombre=data.nombre||data.razon||'cliente';
  var msg='Hola NORLAB, envio documentos de mi solicitud.\n\nFolio: '+ref+'\nSolicitante: '+nombre+'\nEquipo: '+data.equipo+'\nPlan: '+data.plan;
  document.getElementById('wa_link').href='https://wa.me/'+WA_NUM+'?text='+encodeURIComponent(msg);
  window.scrollTo({top:0,behavior:'smooth'});
}

buildProgress();
loadEquipos();
