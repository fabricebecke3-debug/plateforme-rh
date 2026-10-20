/* paie-pointage-simulation.js — Pointage heures sup. et simulation
   Design moderne style Sage, compact et professionnel
*/
(function(root){
'use strict';

var CATS = [
  ['1110','Heures Supplémentaires 120%'],
  ['1130','Heures Supplémentaires 130%'],
  ['1140','Heures Supplémentaires 140%'],
  ['1150','Heures Supplémentaires 150%'],
  ['1160','Heures Supplémentaires 200%']
];

function synchroniser() { /* hook */ }

function ouvrir(opts) {
  opts = opts || {};
  var employes = opts.employes || [];
  var periode = opts.periode || '';
  var courant = opts.courant || '';
  var onApply = opts.onApply || function(){};
  
  var heures = {};
  CATS.forEach(function(c){ heures[c[0]] = 0; });
  
  var ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,14,20,.6);z-index:2147483500;display:flex;align-items:center;justify-content:center;padding:16px';
  
  var cadre = document.createElement('div');
  cadre.style.cssText = 'background:#fff;border-radius:8px;padding:0;max-width:600px;width:100%;box-shadow:0 4px 20px rgba(0,0,0,.3);font-family:"Segoe UI",Arial,sans-serif;overflow:hidden';
  
  if (!document.getElementById('pp-style')) {
    var st = document.createElement('style');
    st.id = 'pp-style';
    st.textContent = `
      .pp-cadre input,.pp-cadre select {
        background:#fff; color:#1a1a1a; border:1px solid #d0d7de; border-radius:4px;
        padding:6px 10px; font-size:13px; width:100%; box-sizing:border-box;
      }
      .pp-cadre input:focus,.pp-cadre select:focus { border-color:#1f5fbf; outline:none; box-shadow:0 0 0 2px rgba(31,95,191,.15); }
      .pp-cadre .pp-header { background:#1f5fbf; color:#fff; padding:12px 16px; font-size:14px; font-weight:600; display:flex; justify-content:space-between; align-items:center; }
      .pp-cadre .pp-body { padding:16px; }
      .pp-cadre .pp-row { display:flex; align-items:center; gap:10px; margin-bottom:10px; padding:8px; background:#f8f9fa; border-radius:6px; border:1px solid #e3e8ef; }
      .pp-cadre .pp-row label { flex:1; font-size:13px; color:#1a1a1a; font-weight:500; }
      .pp-cadre .pp-row input { width:100px; text-align:right; font-family:"Consolas",monospace; font-size:14px; }
      .pp-cadre .pp-row .pp-unit { color:#6c757d; font-size:12px; min-width:30px; }
      .pp-cadre button {
        background:#eef2f8; color:#1a1a1a; border:1px solid #9aa5b5; border-radius:6px;
        padding:8px 16px; cursor:pointer; font-size:13px; transition:all .2s;
      }
      .pp-cadre button:hover { background:#d6e4ff; border-color:#1f5fbf; }
      .pp-cadre button.p { background:#1f5fbf; color:#fff; border-color:#1f5fbf; font-weight:600; }
      .pp-cadre button.p:hover { background:#0d47a1; }
      .pp-cadre button.d { background:#fff; color:#c0392b; border-color:#c0392b; }
      .pp-cadre .pp-footer { padding:12px 16px; border-top:1px solid #dee2e6; display:flex; gap:8px; justify-content:flex-end; background:#f8f9fa; }
      .pp-cadre .pp-info { background:#e7f1ff; border:1px solid #b6d4fe; border-radius:6px; padding:8px 12px; font-size:12px; color:#084298; margin-bottom:12px; }
    `;
    document.head.appendChild(st);
  }
  
  cadre.innerHTML = '<div class="pp-header"><span> Pointage des heures supplémentaires</span><button type="button" class="d" data-x="close" style="padding:4px 10px;font-size:12px">✕</button></div>' +
    '<div class="pp-body">' +
    '<div class="pp-info">Période : <b>'+echapper(periode)+'</b> · Salarié : <b>'+echapper(courant)+'</b></div>' +
    '<div style="margin-bottom:12px"><label style="font-size:12px;font-weight:600;color:#1f5fbf">Salarié</label><select data-emp style="margin-top:4px"><option value="">— choisir —</option>'+employes.map(function(x,i){ return '<option value="'+i+'"'+(x.mat===courant||x.nom===courant?' selected':'')+'>'+echapper(x.nom)+'</option>'; }).join('')+'</select></div>' +
    '<div id="pp-rows"></div>' +
    '</div>' +
    '<div class="pp-footer"><button type="button" data-x="cancel">Annuler</button><button type="button" class="p" data-x="apply">✓ Appliquer au bulletin</button></div>';
  
  ov.appendChild(cadre);
  document.body.appendChild(ov);
  
  var rowsDiv = cadre.querySelector('#pp-rows');
  CATS.forEach(function(c){
    var row = document.createElement('div');
    row.className = 'pp-row';
    row.innerHTML = '<label>'+echapper(c[1])+'</label><input type="number" step="0.5" min="0" value="0" data-c="'+c[0]+'" class="num"><span class="pp-unit">heures</span>';
    rowsDiv.appendChild(row);
  });
  
  cadre.addEventListener('input', function(e){
    if (e.target.dataset.c) heures[e.target.dataset.c] = +e.target.value||0;
  });
  cadre.addEventListener('click', function(e){
    var b = e.target.closest('[data-x]'); if (!b) return;
    var x = b.dataset.x;
    if (x==='close'||x==='cancel') ov.remove();
    else if (x==='apply') { onApply(heures); ov.remove(); }
  });
  cadre.querySelector('[data-emp]').addEventListener('change', function(e){
    var f = employes[+e.target.value];
    if (f) { courant = f.mat||f.nom; cadre.querySelector('.pp-info').innerHTML = 'Période : <b>'+echapper(periode)+'</b> · Salarié : <b>'+echapper(courant)+'</b>'; }
  });
}

function echapper(t){ return String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

var API = { CATS:CATS, ouvrir:ouvrir, synchroniser:synchroniser };
if (typeof module!=='undefined'&&module.exports) module.exports = API;
else root.PaiePointage = API;
})(typeof window!=='undefined'?window:globalThis);