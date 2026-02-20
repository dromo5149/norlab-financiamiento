const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxGw_QkMRqPO6Z3Cgkg1qj7IEkvnuMjowox5SoL7Kg3RlP9ipsYGL9LqrHWPbft7HsX/exec';
const WA_NUM = '525621836094';
const PLAN_LABELS = {fin:'Financiamiento', ren:'Renta mensual', com:'Comodato'};
const PLAN_HINTS  = {
  fin:'Adquiere el equipo en pagos fijos. Tu eres el dueno al finalizar.',
  ren:'Renta mensual fija. Sin enganche.',
  com:'El equipo es tuyo comprando los reactivos minimos mensualmente.'
};
const REQ_FISICA = ['d_ine','d_dom','d_ec','d_cif'];
const REQ_MORAL  = ['dm_acta','dm_poder','dm_cif','dm_dom','dm_ec'];
const STEPS = ['Equipo','Tipo','Datos','Documentos'];

// Map doc ID to doc type label
const DOC_TYPE = {
  'd_ine':   'INE',
  'd_dom':   'Comprobante de domicilio',
  'd_ec':    'Estado de cuenta',
  'd_cif':   'Constancia SAT',
  'd_curp':  'CURP',
  'dm_acta':  'Acta constitutiva',
  'dm_poder': 'Poder notarial',
  'dm_cif':   'Constancia SAT',
  'dm_dom':   'Comprobante de domicilio',
  'dm_ec':    'Estado de cuenta',
  'dm_ef':    'Estados financieros'
};

var curStep=1, tipo='', selEq=null, zohoData=null, uploadedFiles=[], curFolio='';
var checkedDocs=new Set();
var expandedDoc=null;
var EQ=[];

function g(id){var el=document.getElementById(id);return el?el.value:'';}

function buildProgress(){
  var w=document.getElementById('progSteps');w.innerHTML='';
  STEPS.forEach(function(l,i){
    var n=i+1,done=n<curStep,active=n===curStep;
    var d=document.createElement('div');
    d.className='ps'+(done?' done':active?' active':'');
    d.innerHTML='<div class="ps-dot">'+(done?'&#10003;':n)+'</div>'+(i<STEPS.length-1?'<div class="ps-line"></div>':'');
    w.appendChild(d);
  });
  document.getElementById('progPct').textContent='Paso '+curStep+' de '+STEPS.length;
}

function loadEquipos(){
  var cb='nlEQ_'+Date.now(),sc=document.createElement('script');
  var to=setTimeout(function(){cleanup();populateEquipos([]);},7000);
  window[cb]=function(data){clearTimeout(to);cleanup();EQ=Array.isArray(data)?data:[];populateEquipos(EQ);};
  sc.src=SCRIPT_URL+'?callback='+cb+'&ts='+Date.now();
  sc.onerror=function(){clearTimeout(to);cleanup();populateEquipos([]);};
  document.head.appendChild(sc);
  function cleanup(){if(document.head.contains(sc))document.head.removeChild(sc);delete window[cb];}
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
  ['plazo_wrap','eng_wrap','mensual_wrap'].forEach(function(id){document.getElementById(id).style.display='none';});
  document.getElementById('plan_hint').classList.remove('on');
  if(!selEq)return;
  ps.disabled=false;
  var planNames={fin:'Financiamiento',ren:'Renta mensual',com:'Comodato'};
  selEq.pl.forEach(function(code){
    var o=document.createElement('option');o.value=code;o.textContent=(planNames[code]||code);ps.appendChild(o);
  });
  document.getElementById('p_equipo').classList.remove('er');
  document.getElementById('e_equipo').classList.remove('on');
}

function onPlanChange(){
  var code=document.getElementById('p_plan').value;
  if(!code||!selEq)return;
  document.getElementById('plan_hint').textContent=PLAN_HINTS[code]||'';
  document.getElementById('plan_hint').classList.add('on');
  var pw=document.getElementById('plazo_wrap'),ew=document.getElementById('eng_wrap'),mw=document.getElementById('mensual_wrap');
  if(code==='fin'){
    pw.style.display='flex';ew.style.display='flex';mw.style.display='flex';
    var ps2=document.getElementById('p_plazo');ps2.innerHTML='';
    [6,12,18,24].filter(function(m){return m<=(selEq.mx||24);}).forEach(function(m){
      var o=document.createElement('option');o.value=m;o.textContent=m+' meses';ps2.appendChild(o);
    });
    calcPreview();
  }else if(code==='ren'){
    pw.style.display='none';ew.style.display='none';mw.style.display='flex';
    document.getElementById('p_mensual').value='$'+(selEq.p*0.025).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})+' + IVA/mes';
  }else if(code==='com'){
    pw.style.display='none';ew.style.display='flex';mw.style.display='flex';
    var mr=selEq.co*(selEq.mr||0.3),dep=selEq.p*(selEq.dm||3)*0.025;
    document.getElementById('p_mensual').value='Compra min. $'+Math.round(mr).toLocaleString('es-MX')+'/mes en reactivos';
    document.getElementById('p_enganche').value='Dep\u00f3sito: $'+Math.round(dep).toLocaleString('es-MX');
  }
  document.getElementById('p_plan').classList.remove('er');
  document.getElementById('e_plan').classList.remove('on');
}

function calcPreview(){
  if(!selEq)return;
  var m=parseInt(document.getElementById('p_plazo').value)||12;
  var e=selEq.p*0.30,cap=selEq.p-e;
  var tasa=(selEq.nota&&selEq.nota.indexOf('0%')!==-1)?0:0.015;
  var mn=tasa===0?cap/m:cap*tasa*Math.pow(1+tasa,m)/(Math.pow(1+tasa,m)-1);
  document.getElementById('p_enganche').value='$'+Math.round(e).toLocaleString('es-MX')+' (30%)';
  document.getElementById('p_mensual').value='$'+mn.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})+' + IVA';
}

function goStep(n){
  if(n>curStep&&!validateStep(curStep))return;
  document.getElementById('s'+curStep).classList.remove('active');
  curStep=n;
  document.getElementById('s'+curStep).classList.add('active');
  buildProgress();
  if(n===4)buildResumen();
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
  document.getElementById('form_fisica').style.display=t==='fisica'?'block':'none';
  document.getElementById('form_moral').style.display=t==='moral'?'block':'none';
  document.getElementById('docs_fisica').style.display=t==='fisica'?'block':'none';
  document.getElementById('docs_moral').style.display=t==='moral'?'block':'none';
}

function onEmailBlur(t){
  var cv=document.getElementById(t==='fisica'?'f_cliente':'m_cliente').value;
  if(cv==='si') doZohoLookup(t);
}
function onClienteChange(t){
  var cv=document.getElementById(t==='fisica'?'f_cliente':'m_cliente').value;
  var box=document.getElementById('zoho_'+t);
  if(cv!=='si'){box.className='zoho-box';return;}
  var email=document.getElementById(t==='fisica'?'f_email':'m_email').value.trim();
  if(!email||!/^[^@]+@[^@]+\.[^@]+$/.test(email)){
    box.className='zoho-box notfound show';
    box.innerHTML='&#9888; Ingresa tu email primero y luego selecciona esta opci\u00f3n nuevamente.';
    return;
  }
  doZohoLookup(t);
}
function doZohoLookup(t){
  var email=document.getElementById(t==='fisica'?'f_email':'m_email').value.trim();
  if(!email||!/^[^@]+@[^@]+\.[^@]+$/.test(email))return;
  var cv=document.getElementById(t==='fisica'?'f_cliente':'m_cliente').value;
  if(cv!=='si')return;
  var box=document.getElementById('zoho_'+t);
  box.className='zoho-box loading show';
  box.innerHTML='&#8635; Verificando en nuestro sistema...';
  var cb='zl_'+Date.now(),sc=document.createElement('script');
  var to=setTimeout(function(){cleanup();box.className='zoho-box notfound show';box.innerHTML='No se pudo verificar. Continuaremos con revisi\u00f3n manual.';},8000);
  window[cb]=function(data){clearTimeout(to);cleanup();zohoData=data;renderZoho(box,data,t);};
  sc.src=SCRIPT_URL+'?action=zoho_lookup&email='+encodeURIComponent(email)+'&callback='+cb+'&ts='+Date.now();
  sc.onerror=function(){clearTimeout(to);cleanup();box.className='zoho-box notfound show';box.innerHTML='Error de conexi\u00f3n.';};
  document.head.appendChild(sc);
  function cleanup(){if(document.head.contains(sc))document.head.removeChild(sc);delete window[cb];}
}
function renderZoho(box,d,t){
  if(!d||!d.found){box.className='zoho-box notfound show';box.innerHTML='&#9888; '+(d&&d.message||'No encontrado en nuestros registros.');return;}
  box.className='zoho-box found show';
  box.innerHTML='<strong style="color:#2e7d32">&#10003; Cliente verificado: '+d.nombre+'</strong><br>'+
    'Total compras: $'+(d.total_pagado||0).toLocaleString('es-MX',{maximumFractionDigits:0})+
    ' &bull; Facturas pagadas: '+(d.facturas_pagadas||0)+'/'+(d.total_facturas||0)+
    ' &bull; \u00daltima compra: '+(d.ultima_compra||'N/A')+
    (d.saldo_pendiente>0?' &bull; <span style="color:#c62828">Saldo pendiente: $'+d.saldo_pendiente.toLocaleString('es-MX',{maximumFractionDigits:0})+'</span>':'');
  if(t==='fisica'){if(d.nombre&&!g('f_nombre'))document.getElementById('f_nombre').value=d.nombre;if(d.telefono&&!g('f_tel'))document.getElementById('f_tel').value=d.telefono;if(d.ciudad&&!g('f_ciudad'))document.getElementById('f_ciudad').value=d.ciudad;}
  else{if(d.nombre&&!g('m_razon'))document.getElementById('m_razon').value=d.nombre;if(d.telefono&&!g('m_tel'))document.getElementById('m_tel').value=d.telefono;if(d.ciudad&&!g('m_ciudad'))document.getElementById('m_ciudad').value=d.ciudad;}
}

// ─── INLINE EXPAND & UPLOAD ──────────────────────────────────────────────────

function toggleDoc(id){
  // If already expanded, collapse it
  if(expandedDoc===id){
    collapseDoc(id);
    return;
  }
  // Collapse any open one first
  if(expandedDoc) collapseDoc(expandedDoc);
  expandedDoc=id;

  var el=document.getElementById(id);
  var zone=document.getElementById('zone_'+id);
  el.classList.add('expanded');
  if(zone){zone.style.display='block';}
}

function collapseDoc(id){
  var el=document.getElementById(id);
  var zone=document.getElementById('zone_'+id);
  el.classList.remove('expanded');
  if(zone) zone.style.display='none';
  if(expandedDoc===id) expandedDoc=null;
}

function checkDoc(id){
  var el=document.getElementById(id);
  checkedDocs.add(id);
  el.classList.add('checked');
  updateDocWarn();
}

function updateDocWarn(){
  var req=tipo==='fisica'?REQ_FISICA:REQ_MORAL;
  var miss=req.filter(function(x){return !checkedDocs.has(x);});
  var warnId=tipo==='fisica'?'warn_fisica':'warn_moral';
  document.getElementById(warnId).classList.toggle('on',miss.length>0);
}

function onDocDrop(e,docId){
  e.preventDefault();
  var zone=document.getElementById('zone_'+docId);
  if(zone) zone.querySelector('.doc-upload-inner').classList.remove('drag');
  processDocFiles(Array.from(e.dataTransfer.files), docId);
}
function onDocDragOver(e,docId){
  e.preventDefault();
  var zone=document.getElementById('zone_'+docId);
  if(zone) zone.querySelector('.doc-upload-inner').classList.add('drag');
}
function onDocDragLeave(e,docId){
  var zone=document.getElementById('zone_'+docId);
  if(zone) zone.querySelector('.doc-upload-inner').classList.remove('drag');
}
function onDocFileSelect(e,docId){
  processDocFiles(Array.from(e.target.files), docId);
}

function processDocFiles(files, docId){
  if(!files.length) return;
  files.forEach(function(file){
    if(file.size>10*1024*1024){alert(file.name+' excede el l\u00edmite de 10MB');return;}
    var uid='f'+Date.now()+Math.random().toString(36).substr(2,4);
    var docType=DOC_TYPE[docId]||'Documento';
    var item={uid:uid,name:file.name,docId:docId,docType:docType,tipo:tipo,status:'reading'};
    uploadedFiles.push(item);

    // Show file item in this doc's zone
    addDocFileItem(item, docId);

    var reader=new FileReader();
    reader.onload=function(ev){
      item.b64=ev.target.result.split(',')[1];
      item.mime=file.type||'application/octet-stream';
      item.status='uploading';
      updateDocFileItem(item);
      uploadFile(item);
      // Auto-check the doc item
      checkDoc(docId);
    };
    reader.readAsDataURL(file);
  });
}

function uploadFile(item){
  var nombre=tipo==='fisica'?(g('f_nombre')||'solicitante'):(g('m_razon')||g('m_rep')||'solicitante');
  var folio=curFolio||('TEMP_'+Date.now());
  fetch(SCRIPT_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain'},
    body:JSON.stringify({action:'upload_doc',folio:folio,nombre:nombre,tipo_doc:item.docType,
      file:item.b64,mime:item.mime,filename:folio+'_'+item.docType.replace(/ /g,'_')+'_'+item.name})
  }).then(function(){
    item.status='done';
    item.analysis='Guardado en Drive. An\u00e1lisis Claude enviado por email.';
    updateDocFileItem(item);
    // Mark doc as checked and collapse after short delay
    checkDoc(item.docId);
    setTimeout(function(){collapseDoc(item.docId);},800);
  }).catch(function(){
    item.status='done';
    item.analysis='Enviado correctamente.';
    updateDocFileItem(item);
    checkDoc(item.docId);
    setTimeout(function(){collapseDoc(item.docId);},800);
  });
}

function addDocFileItem(item, docId){
  var list=document.getElementById('flist_'+docId);
  if(!list) return;
  var d=document.createElement('div');
  d.id='fi_'+item.uid;
  d.className='fi-row';
  list.appendChild(d);
  updateDocFileItem(item);
}

function updateDocFileItem(item){
  var el=document.getElementById('fi_'+item.uid);if(!el)return;
  var icons={reading:'&#128196;',uploading:'&#9203;',done:'&#9989;',error:'&#10060;'};
  var stat={reading:'Leyendo...',uploading:'Subiendo y analizando con Claude...',done:'Guardado en Drive',error:'Error'};
  el.className='fi-row '+(item.status==='done'?'done':item.status==='uploading'?'uploading':'');
  el.innerHTML='<span style="font-size:16px;flex-shrink:0">'+(icons[item.status]||'&#128196;')+'</span>'+
    '<div style="flex:1;min-width:0">'+
    '<div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+item.name+'</div>'+
    '<div style="font-size:11px;color:#6b7c93">'+(stat[item.status]||'')+'</div>'+
    (item.status==='uploading'?'<div style="height:2px;background:#e8edf5;border-radius:2px;margin-top:4px;overflow:hidden"><div style="height:100%;background:#1976d2;width:70%"></div></div>':'')+
    '</div>'+
    (item.status!=='uploading'?'<button style="background:none;border:none;cursor:pointer;color:#aaa;font-size:14px;padding:0 2px" onclick="removeDocFile(\''+item.uid+'\',\''+item.docId+'\')">&#x2715;</button>':'');
}

function removeDocFile(uid, docId){
  uploadedFiles=uploadedFiles.filter(function(f){return f.uid!==uid;});
  var el=document.getElementById('fi_'+uid);if(el)el.remove();
  // If no files left for this doc, uncheck it
  var remaining=uploadedFiles.filter(function(f){return f.docId===docId&&f.status==='done';});
  if(remaining.length===0){
    var docEl=document.getElementById(docId);
    if(docEl) docEl.classList.remove('checked');
    checkedDocs.delete(docId);
    updateDocWarn();
  }
}

function buildResumen(){
  var rows=[];
  if(selEq)rows.push(['Equipo',selEq.n+' \u2014 '+selEq.m]);
  var pc=document.getElementById('p_plan').value;
  rows.push(['Plan',({fin:'Financiamiento',ren:'Renta mensual',com:'Comodato'})[pc]||pc]);
  var pl=g('p_plazo');if(pl)rows.push(['Plazo',pl+' meses']);
  var mn=g('p_mensual');if(mn)rows.push(['Mensualidad estimada',mn]);
  rows.push(['Tipo',tipo==='fisica'?'Persona F\u00edsica':'Persona Moral']);
  if(tipo==='fisica'){rows.push(['Nombre',g('f_nombre')]);rows.push(['RFC',g('f_rfc')]);rows.push(['Tel\u00e9fono',g('f_tel')]);rows.push(['Email',g('f_email')]);rows.push(['Negocio',g('f_negocio')]);rows.push(['Ciudad',g('f_ciudad')]);}
  else{rows.push(['Raz\u00f3n social',g('m_razon')]);rows.push(['RFC',g('m_rfc')]);rows.push(['Representante',g('m_rep')]);rows.push(['Tel\u00e9fono',g('m_tel')]);rows.push(['Email',g('m_email')]);rows.push(['Ciudad',g('m_ciudad')]);}
  var req=tipo==='fisica'?REQ_FISICA:REQ_MORAL;
  var docsOk=req.filter(function(x){return checkedDocs.has(x);}).length;
  var docsUp=uploadedFiles.filter(function(f){return f.status==='done';}).length;
  rows.push(['Documentos',docsOk+'/'+req.length+' obligatorios \u2022 '+docsUp+' subidos']);
  if(zohoData&&zohoData.found)rows.push(['Cliente verificado','\u2705 '+zohoData.nombre]);
  document.getElementById('resumen_content').innerHTML=rows.filter(function(r){return r[1];}).map(function(r){
    return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e8edf5;font-size:13px"><span style="color:#6b7c93">'+r[0]+'</span><span style="font-weight:600">'+r[1]+'</span></div>';
  }).join('');
}

function submitForm(){
  curFolio='NL-'+String(Math.floor(10000+Math.random()*90000));
  var btn=document.getElementById('btn_submit');btn.disabled=true;
  document.getElementById('btn_txt').textContent='Enviando...';
  document.getElementById('btn_spin').style.display='inline-block';
  var req=tipo==='fisica'?REQ_FISICA:REQ_MORAL;
  var docsOk=req.filter(function(x){return checkedDocs.has(x);}).length;
  var pc=document.getElementById('p_plan').value;
  var planName=({fin:'Financiamiento',ren:'Renta mensual',com:'Comodato'})[pc]||pc;
  var data={action:'solicitud',folio:curFolio,
    equipo:selEq?(selEq.n+' - '+selEq.m):'',plan:planName,
    plazo:g('p_plazo'),mensual:g('p_mensual'),enganche:g('p_enganche'),tipo:tipo,
    nombre:g('f_nombre'),rfc:g('f_rfc')||g('m_rfc'),curp:g('f_curp'),
    tel:g('f_tel')||g('m_tel'),email:g('f_email')||g('m_email'),
    negocio:g('f_negocio'),dir:g('f_dir')||g('m_dir'),ciudad:g('f_ciudad')||g('m_ciudad'),
    anos:g('f_anos')||g('m_anos'),cliente:g('f_cliente')||g('m_cliente'),
    razon:g('m_razon'),rep:g('m_rep'),notas:g('f_notas')||g('m_notas'),
    docs_ok:docsOk,docs_req:req.length,
    zoho_cliente:zohoData&&zohoData.found?'Si':'No verificado',
    zoho_total:zohoData&&zohoData.found?String(zohoData.total_pagado||0):'',
    zoho_ultima:zohoData&&zohoData.found?(zohoData.ultima_compra||''):'',
    zoho_pagadas:zohoData&&zohoData.found?((zohoData.facturas_pagadas||0)+'/'+(zohoData.total_facturas||0)):'',
    zoho_pendiente:zohoData&&zohoData.found?String(zohoData.saldo_pendiente||0):'',
    zoho_comportamiento:zohoData&&zohoData.found?(zohoData.comportamiento||''):''
  };
  var cb='sub_'+Date.now(),sc=document.createElement('script');
  var to=setTimeout(function(){cleanup();showSuccess(curFolio,data);},8000);
  window[cb]=function(){clearTimeout(to);cleanup();showSuccess(curFolio,data);};
  var qs=Object.keys(data).map(function(k){return encodeURIComponent(k)+'='+encodeURIComponent(data[k]||'');}).join('&');
  sc.src=SCRIPT_URL+'?'+qs+'&callback='+cb;
  sc.onerror=function(){clearTimeout(to);cleanup();showSuccess(curFolio,data);};
  document.head.appendChild(sc);
  function cleanup(){if(document.head.contains(sc))document.head.removeChild(sc);delete window[cb];}
}

function showSuccess(ref,data){
  for(var i=1;i<=4;i++)document.getElementById('s'+i).classList.remove('active');
  document.getElementById('successScreen').classList.add('on');
  document.getElementById('refNum').textContent=ref;
  document.getElementById('refNum2').textContent=ref;
  var nombre=data.nombre||data.razon||'cliente';
  var msg='Hola NORLAB, env\u00edo documentos de mi solicitud.\n\nFolio: '+ref+'\nSolicitante: '+nombre+'\nEquipo: '+data.equipo+'\nPlan: '+data.plan;
  document.getElementById('wa_link').href='https://wa.me/'+WA_NUM+'?text='+encodeURIComponent(msg);
  window.scrollTo({top:0,behavior:'smooth'});
}

buildProgress();
loadEquipos();
