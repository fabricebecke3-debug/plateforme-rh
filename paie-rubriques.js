/* paie-rubriques.js — Éditeur du catalogue de rubriques de paie */
(function(root){
'use strict';

var RUBRIQUES = [];

function charger() {
  try { RUBRIQUES = JSON.parse(localStorage.getItem('paie_rubriques')||'[]'); } catch(e){ RUBRIQUES = []; }
  if (!RUBRIQUES.length) {
    // Charger depuis Sage si dispo
    if (root.PaieDetail && root.PaieDetail.getCatalogue) {
      RUBRIQUES = root.PaieDetail.getCatalogue();
    }
  }
}
function sauver() {
  try { localStorage.setItem('paie_rubriques',JSON.stringify(RUBRIQUES)); } catch(e){}
}
function synchroniser() { charger(); return Promise.resolve(RUBRIQUES.slice()); }

function ouvrir(catalogueInitial, onSaved) {
  if (catalogueInitial && catalogueInitial.length) {
    RUBRIQUES = catalogueInitial.slice();
  } else {
    charger();
  }
  
  var ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,14,20,.6);z-index:2147483700;display:flex;align-items:center;justify-content:center;padding:16px';
  
  var cadre = document.createElement('div');
  cadre.style.cssText = 'background:#fff;border-radius:8px;padding:0;max-width:900px;width:100%;box-shadow:0 4px 20px rgba(0,0,0,.3);font-family:"Segoe UI",Arial,sans-serif;overflow:hidden;max-height:90vh;display:flex;flex-direction:column';
  
  if (!document.getElementById('pr-style')) {
    var st = document.createElement('style');
    st.id = 'pr-style';
    st.textContent = `
      .pr-cadre input,.pr-cadre select {
        background:#fff; color:#1a1a1a; border:1px solid #d0d7de; border-radius:4px;
        padding:6px 10px; font-size:13px; box-sizing:border-box;
      }
      .pr-cadre input:focus,.pr-cadre select:focus { border-color:#1f5fbf; outline:none; box-shadow:0 0 0 2px rgba(31,95,191,.15); }
      .pr-cadre .pr-header { background:#1f5fbf; color:#fff; padding:12px 16px; font-size:14px; font-weight:600; display:flex; justify-content:space-between; align-items:center; }
      .pr-cadre .pr-toolbar { padding:8px 16px; background:#f8f9fa; border-bottom:1px solid #dee2e6; display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
      .pr-cadre .pr-toolbar input[type=text] { flex:1; min-width:200px; }
      .pr-cadre .pr-body { padding:0; overflow-y:auto; flex:1; }
      .pr-cadre table { width:100%; border-collapse:collapse; font-size:12px; }
      .pr-cadre table th { background:#1f5fbf; color:#fff; padding:8px; text-align:left; font-size:11px; text-transform:uppercase; position:sticky; top:0; }
      .pr-cadre table td { padding:6px 8px; border-bottom:1px solid #e3e8ef; }
      .pr-cadre table tr:hover td { background:#f5f8ff; }
      .pr-cadre table input { width:100%; border:1px solid transparent; background:transparent; padding:4px; border-radius:3px; }
      .pr-cadre table input:focus { border-color:#1f5fbf; background:#fff; }
      .pr-cadre button {
        background:#eef2f8; color:#1a1a1a; border:1px solid #9aa5b5; border-radius:6px;
        padding:6px 12px; cursor:pointer; font-size:12px; transition:all .2s;
      }
      .pr-cadre button:hover { background:#d6e4ff; border-color:#1f5fbf; }
      .pr-cadre button.p { background:#1f5fbf; color:#fff; border-color:#1f5fbf; font-weight:600; }
      .pr-cadre button.p:hover { background:#0d47a1; }
      .pr-cadre button.d { background:#fff; color:#c0392b; border-color:#c0392b; }
      .pr-cadre button.d:hover { background:#c0392b; color:#fff; }
      .pr-cadre .pr-footer { padding:12px 16px; border-top:1px solid #dee2e6; display:flex; gap:8px; justify-content:flex-end; background:#f8f9fa; }
      .pr-cadre .pr-type-gain { color:#28a745; font-weight:600; }
      .pr-cadre .pr-type-cot { color:#dc3545; font-weight:600; }
      .pr-cadre .pr-type-ret { color:#fd7e14; font-weight:600; }
    `;
    document.head.appendChild(st);
  }
  
  var html = '<div class="pr-header"><span>⚙️ Catalogue des rubriques de paie ('+RUBRIQUES.length+')</span><button type="button" class="d" data-x="close" style="padding:4px 10px;font-size:12px">✕</button></div>';
  html += '<div class="pr-toolbar"><button type="button" class="p" data-x="add">+ Ajouter</button><button type="button" data-x="import-sage">📥 Importer Sage</button><input type="text" data-search placeholder=" Rechercher..." style="margin-left:auto"></div>';
  html += '<div class="pr-body"><table><thead><tr><th style="width:70px">Code</th><th>Désignation</th><th style="width:90px">Type</th><th style="width:60px">CNPS</th><th style="width:60px">CFC</th><th style="width:70px">Imposable</th><th style="width:50px"></th></tr></thead><tbody id="pr-tbody"></tbody></table></div>';
  html += '<div class="pr-footer"><button type="button" class="p" data-x="save">💾 Enregistrer et fermer</button><button type="button" data-x="cancel">Annuler</button></div>';
  
  cadre.innerHTML = html;
  cadre.className = 'pr-cadre';
  ov.appendChild(cadre);
  document.body.appendChild(ov);
  
  var search = '';
  
  function render() {
    var tbody = cadre.querySelector('#pr-tbody');
    var filtered = RUBRIQUES.filter(function(r){
      if (!search) return true;
      var s = search.toLowerCase();
      return r.code.toLowerCase().indexOf(s)>=0 || r.libelle.toLowerCase().indexOf(s)>=0;
    });
    tbody.innerHTML = filtered.map(function(r,i){
      var idx = RUBRIQUES.indexOf(r);
      var typeClass = r.type==='gain'?'pr-type-gain':(r.type==='cotisation'?'pr-type-cot':'pr-type-ret');
      var typeLabel = r.type==='gain'?'GAIN':(r.type==='cotisation'?'COTIS.':'RETENUE');
      return '<tr data-idx="'+idx+'">'+
        '<td><input data-k="code" value="'+echapper(r.code)+'"></td>'+
        '<td><input data-k="libelle" value="'+echapper(r.libelle)+'"></td>'+
        '<td><select data-k="type"><option value="gain"'+(r.type==='gain'?' selected':'')+'>GAIN</option><option value="cotisation"'+(r.type==='cotisation'?' selected':'')+'>COTISATION</option><option value="retenue"'+(r.type==='retenue'?' selected':'')+'>RETENUE</option></select></td>'+
        '<td style="text-align:center"><input type="checkbox" data-k="cnps"'+(r.cnps?' checked':'')+'></td>'+
        '<td style="text-align:center"><input type="checkbox" data-k="cfc"'+(r.cfc?' checked':'')+'></td>'+
        '<td style="text-align:center"><input type="checkbox" data-k="imposable"'+(r.imposable!==false?' checked':'')+'></td>'+
        '<td style="text-align:center"><button type="button" class="d" data-x="del" data-idx="'+idx+'" style="padding:2px 8px;font-size:11px">✕</button></td>'+
        '</tr>';
    }).join('');
    cadre.querySelector('.pr-header span').textContent = '⚙️ Catalogue des rubriques de paie ('+RUBRIQUES.length+')';
  }
  
  render();
  
  cadre.querySelector('[data-search]').addEventListener('input', function(e){
    search = e.target.value;
    render();
  });
  
  cadre.addEventListener('input', function(e){
    var t = e.target;
    if (t.dataset.k && t.closest('tr')) {
      var idx = +t.closest('tr').dataset.idx;
      var r = RUBRIQUES[idx];
      if (t.type==='checkbox') r[t.dataset.k] = t.checked;
      else r[t.dataset.k] = t.value;
    }
  });
  cadre.addEventListener('change', function(e){
    var t = e.target;
    if (t.dataset.k && t.closest('tr')) {
      var idx = +t.closest('tr').dataset.idx;
      RUBRIQUES[idx][t.dataset.k] = t.value;
    }
  });
  
  cadre.addEventListener('click', function(e){
    var b = e.target.closest('[data-x]'); if (!b) return;
    var x = b.dataset.x;
    if (x==='close'||x==='cancel') ov.remove();
    else if (x==='add') {
      RUBRIQUES.push({ code:'', libelle:'Nouvelle rubrique', type:'gain', cnps:false, cfc:false, imposable:true });
      render();
    }
    else if (x==='del') {
      var idx = +b.dataset.idx;
      RUBRIQUES.splice(idx,1);
      render();
    }
    else if (x==='import-sage') {
      if (root.PaieDetail && root.PaieDetail.getCatalogue) {
        var sage = root.PaieDetail.getCatalogue();
        sage.forEach(function(r){
          if (!RUBRIQUES.filter(function(x){return x.code===r.code}).length) RUBRIQUES.push(r);
        });
        render();
      } else alert('Catalogue Sage non disponible.');
    }
    else if (x==='save') {
      sauver();
      if (onSaved) onSaved(RUBRIQUES.slice());
      ov.remove();
    }
  });
}

function echapper(t){ return String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

var API = { ouvrir:ouvrir, charger:charger, sauver:sauver, synchroniser:synchroniser };
if (typeof module!=='undefined'&&module.exports) module.exports = API;
else root.PaieRubriques = API;
})(typeof window!=='undefined'?window:globalThis);