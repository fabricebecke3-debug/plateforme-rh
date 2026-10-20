/* paie-modeles.js — Gestion des modèles de bulletins style Sage */
(function(root){
'use strict';

var MODELES = [];
var ACTIF_ID = null;

function charger() {
  try { MODELES = JSON.parse(localStorage.getItem('paie_modeles')||'[]'); } catch(e){ MODELES = []; }
  try { ACTIF_ID = localStorage.getItem('paie_modele_actif'); } catch(e){}
}
function sauver() {
  try { localStorage.setItem('paie_modeles',JSON.stringify(MODELES)); } catch(e){}
  try { localStorage.setItem('paie_modele_actif',ACTIF_ID||''); } catch(e){}
}
function synchroniser() { charger(); }

function actif() {
  charger();
  if (!ACTIF_ID) return null;
  return MODELES.filter(function(m){ return m.id===ACTIF_ID; })[0] || null;
}

function ouvrir() {
  charger();
  var ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,14,20,.6);z-index:2147483600;display:flex;align-items:center;justify-content:center;padding:16px';
  
  var cadre = document.createElement('div');
  cadre.style.cssText = 'background:#fff;border-radius:8px;padding:0;max-width:700px;width:100%;box-shadow:0 4px 20px rgba(0,0,0,.3);font-family:"Segoe UI",Arial,sans-serif;overflow:hidden;max-height:90vh;overflow-y:auto';
  
  if (!document.getElementById('pm-style')) {
    var st = document.createElement('style');
    st.id = 'pm-style';
    st.textContent = `
      .pm-cadre input,.pm-cadre select,.pm-cadre textarea {
        background:#fff; color:#1a1a1a; border:1px solid #d0d7de; border-radius:4px;
        padding:6px 10px; font-size:13px; width:100%; box-sizing:border-box;
      }
      .pm-cadre input:focus,.pm-cadre select:focus,.pm-cadre textarea:focus { border-color:#1f5fbf; outline:none; box-shadow:0 0 0 2px rgba(31,95,191,.15); }
      .pm-cadre .pm-header { background:#1f5fbf; color:#fff; padding:12px 16px; font-size:14px; font-weight:600; display:flex; justify-content:space-between; align-items:center; }
      .pm-cadre .pm-body { padding:16px; }
      .pm-cadre .pm-list { border:1px solid #dee2e6; border-radius:6px; max-height:200px; overflow-y:auto; margin-bottom:12px; }
      .pm-cadre .pm-item { padding:8px 12px; border-bottom:1px solid #e3e8ef; display:flex; align-items:center; gap:8px; cursor:pointer; }
      .pm-cadre .pm-item:hover { background:#f5f8ff; }
      .pm-cadre .pm-item.actif { background:#e7f1ff; border-left:3px solid #1f5fbf; }
      .pm-cadre .pm-item b { flex:1; font-size:13px; }
      .pm-cadre button {
        background:#eef2f8; color:#1a1a1a; border:1px solid #9aa5b5; border-radius:6px;
        padding:8px 16px; cursor:pointer; font-size:13px; transition:all .2s;
      }
      .pm-cadre button:hover { background:#d6e4ff; border-color:#1f5fbf; }
      .pm-cadre button.p { background:#1f5fbf; color:#fff; border-color:#1f5fbf; font-weight:600; }
      .pm-cadre button.p:hover { background:#0d47a1; }
      .pm-cadre button.d { background:#fff; color:#c0392b; border-color:#c0392b; }
      .pm-cadre .pm-field { margin-bottom:10px; }
      .pm-cadre .pm-field label { display:block; font-size:12px; font-weight:600; color:#1f5fbf; margin-bottom:4px; }
      .pm-cadre .pm-checks { display:grid; grid-template-columns:repeat(2,1fr); gap:6px; margin:8px 0; }
      .pm-cadre .pm-checks label { display:flex; align-items:center; gap:6px; font-size:12px; cursor:pointer; padding:4px 8px; background:#f8f9fa; border-radius:4px; }
      .pm-cadre .pm-checks input { width:auto; }
      .pm-cadre .pm-footer { padding:12px 16px; border-top:1px solid #dee2e6; display:flex; gap:8px; justify-content:flex-end; background:#f8f9fa; }
    `;
    document.head.appendChild(st);
  }
  
  var html = '<div class="pm-header"><span>📄 Modèles de bulletin</span><button type="button" class="d" data-x="close" style="padding:4px 10px;font-size:12px">✕</button></div>';
  html += '<div class="pm-body">';
  html += '<div class="pm-list" id="pm-list"></div>';
  html += '<div style="display:flex;gap:8px;margin-bottom:12px"><button type="button" class="p" data-x="new" style="flex:1">+ Nouveau modèle</button><button type="button" data-x="edit" style="flex:1">️ Modifier</button><button type="button" class="d" data-x="del">🗑 Supprimer</button></div>';
  html += '<div id="pm-form" style="display:none;border:1px solid #dee2e6;border-radius:6px;padding:12px;background:#f8f9fa">';
  html += '<div class="pm-field"><label>Nom du modèle</label><input type="text" id="pm-nom" placeholder="ex. Modèle standard"></div>';
  html += '<div class="pm-field"><label>Couleur principale</label><input type="color" id="pm-couleur" value="#1f5fbf" style="height:40px"></div>';
  html += '<div class="pm-field"><label>Logo (PNG/JPG, max 300 Ko)</label><input type="file" id="pm-logo" accept="image/png,image/jpeg"></div>';
  html += '<div class="pm-field"><label>Position du logo</label><select id="pm-logopos"><option value="gauche">Gauche</option><option value="centre">Centre</option><option value="droite">Droite</option><option value="aucun">Aucun</option></select></div>';
  html += '<div class="pm-field"><label>Colonnes affichées</label><div class="pm-checks"><label><input type="checkbox" id="pm-col-nombre" checked> Nombre</label><label><input type="checkbox" id="pm-col-base" checked> Base</label><label><input type="checkbox" id="pm-col-taux" checked> Taux</label><label><input type="checkbox" id="pm-col-pat" checked> Charges patronales</label></div></div>';
  html += '<div class="pm-field"><label>Blocs affichés (ordre)</label><div class="pm-checks"><label><input type="checkbox" id="pm-bloc-entete" checked> En-tête</label><label><input type="checkbox" id="pm-bloc-salarie" checked> Salarié</label><label><input type="checkbox" id="pm-bloc-rubriques" checked> Rubriques</label><label><input type="checkbox" id="pm-bloc-pied" checked> Pied</label></div></div>';
  html += '<div class="pm-field"><label><input type="checkbox" id="pm-patronales" checked> Afficher les charges patronales</label></div>';
  html += '<div class="pm-field"><label><input type="checkbox" id="pm-pied-legal" checked> Afficher le pied légal</label></div>';
  html += '<div class="pm-field"><label>Texte complémentaire (pied)</label><textarea id="pm-pied" rows="2" placeholder="Texte additionnel..."></textarea></div>';
  html += '<div style="display:flex;gap:8px;margin-top:10px"><button type="button" class="p" data-x="save" style="flex:1">💾 Enregistrer</button><button type="button" data-x="cancel-form" style="flex:1">Annuler</button></div>';
  html += '</div>';
  html += '</div>';
  html += '<div class="pm-footer"><button type="button" data-x="setactif" class="p">✓ Définir comme actif</button><button type="button" data-x="close">Fermer</button></div>';
  
  cadre.innerHTML = html;
  cadre.className = 'pm-cadre';
  ov.appendChild(cadre);
  document.body.appendChild(ov);
  
  var editId = null;
  
  function renderList() {
    var list = cadre.querySelector('#pm-list');
    if (!MODELES.length) { list.innerHTML = '<div style="padding:20px;text-align:center;color:#6c757d;font-size:13px">Aucun modèle. Créez-en un avec "+ Nouveau modèle".</div>'; return; }
    list.innerHTML = MODELES.map(function(m){
      return '<div class="pm-item'+(m.id===ACTIF_ID?' actif':'')+'" data-id="'+m.id+'"><b>'+echapper(m.nom)+'</b><span style="font-size:11px;color:#6c757d">'+(m.id===ACTIF_ID?'✓ Actif':'')+'</span></div>';
    }).join('');
  }
  
  function showForm(m) {
    editId = m?m.id:null;
    cadre.querySelector('#pm-form').style.display = 'block';
    cadre.querySelector('#pm-nom').value = m?m.nom:'';
    cadre.querySelector('#pm-couleur').value = m?m.couleur:'#1f5fbf';
    cadre.querySelector('#pm-logopos').value = m?m.logoPos:'gauche';
    cadre.querySelector('#pm-col-nombre').checked = m?m.colonnes.nombre!==false:true;
    cadre.querySelector('#pm-col-base').checked = m?m.colonnes.base!==false:true;
    cadre.querySelector('#pm-col-taux').checked = m?m.colonnes.taux!==false:true;
    cadre.querySelector('#pm-col-pat').checked = m?m.colonnes.retenuePatronale!==false:true;
    cadre.querySelector('#pm-bloc-entete').checked = m?m.blocs.indexOf('entete')>=0:true;
    cadre.querySelector('#pm-bloc-salarie').checked = m?m.blocs.indexOf('salarie')>=0:true;
    cadre.querySelector('#pm-bloc-rubriques').checked = m?m.blocs.indexOf('rubriques')>=0:true;
    cadre.querySelector('#pm-bloc-pied').checked = m?m.blocs.indexOf('pied')>=0:true;
    cadre.querySelector('#pm-patronales').checked = m?m.afficherPatronales!==false:true;
    cadre.querySelector('#pm-pied-legal').checked = m?m.afficherPied!==false:true;
    cadre.querySelector('#pm-pied').value = m?m.pied||'':'';
  }
  
  function hideForm() { cadre.querySelector('#pm-form').style.display='none'; editId=null; }
  
  renderList();
  
  cadre.addEventListener('click', function(e){
    var b = e.target.closest('[data-x]'); if (!b) return;
    var x = b.dataset.x;
    if (x==='close') ov.remove();
    else if (x==='new') { showForm(null); }
    else if (x==='edit') {
      var sel = cadre.querySelector('.pm-item.actif');
      if (!sel) { alert('Sélectionnez un modèle.'); return; }
      var m = MODELES.filter(function(x){ return x.id===sel.dataset.id; })[0];
      showForm(m);
    }
    else if (x==='del') {
      var sel = cadre.querySelector('.pm-item.actif');
      if (!sel) { alert('Sélectionnez un modèle.'); return; }
      if (!confirm('Supprimer ce modèle ?')) return;
      MODELES = MODELES.filter(function(m){ return m.id!==sel.dataset.id; });
      if (ACTIF_ID===sel.dataset.id) ACTIF_ID = MODELES[0]?MODELES[0].id:null;
      sauver(); renderList();
    }
    else if (x==='save') {
      var logo = cadre.querySelector('#pm-logo').files[0];
      var saveModel = function(logoData) {
        var m = {
          id: editId || ('m_'+Date.now()),
          nom: cadre.querySelector('#pm-nom').value || 'Modèle sans nom',
          couleur: cadre.querySelector('#pm-couleur').value,
          logo: logoData || (editId?(MODELES.filter(function(x){return x.id===editId})[0]||{}).logo:''),
          logoPos: cadre.querySelector('#pm-logopos').value,
          colonnes: { nombre:cadre.querySelector('#pm-col-nombre').checked, base:cadre.querySelector('#pm-col-base').checked, taux:cadre.querySelector('#pm-col-taux').checked, retenuePatronale:cadre.querySelector('#pm-col-pat').checked },
          blocs: [],
          afficherPatronales: cadre.querySelector('#pm-patronales').checked,
          afficherPied: cadre.querySelector('#pm-pied-legal').checked,
          pied: cadre.querySelector('#pm-pied').value
        };
        if (cadre.querySelector('#pm-bloc-entete').checked) m.blocs.push('entete');
        if (cadre.querySelector('#pm-bloc-salarie').checked) m.blocs.push('salarie');
        if (cadre.querySelector('#pm-bloc-rubriques').checked) m.blocs.push('rubriques');
        if (cadre.querySelector('#pm-bloc-pied').checked) m.blocs.push('pied');
        if (editId) { var idx = MODELES.findIndex(function(x){return x.id===editId}); if (idx>=0) MODELES[idx]=m; }
        else MODELES.push(m);
        sauver(); renderList(); hideForm();
      };
      if (logo) {
        if (logo.size>300*1024) { alert('Logo trop volumineux (max 300 Ko).'); return; }
        var reader = new FileReader();
        reader.onload = function(e){ saveModel(e.target.result); };
        reader.readAsDataURL(logo);
      } else saveModel(null);
    }
    else if (x==='cancel-form') hideForm();
    else if (x==='setactif') {
      var sel = cadre.querySelector('.pm-item.actif');
      if (!sel) { alert('Sélectionnez un modèle.'); return; }
      ACTIF_ID = sel.dataset.id; sauver(); renderList();
    }
  });
  
  cadre.querySelector('#pm-list').addEventListener('click', function(e){
    var item = e.target.closest('.pm-item'); if (!item) return;
    cadre.querySelectorAll('.pm-item').forEach(function(i){ i.classList.remove('actif'); });
    item.classList.add('actif');
  });
}

function echapper(t){ return String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

var API = { ouvrir:ouvrir, actif:actif, synchroniser:synchroniser, charger:charger };
if (typeof module!=='undefined'&&module.exports) module.exports = API;
else root.PaieModeles = API;

charger();
})(typeof window!=='undefined'?window:globalThis);