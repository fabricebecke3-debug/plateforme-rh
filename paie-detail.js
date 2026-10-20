/* paie-detail.js — Bulletin détaillé style Sage 9.01
   Catalogue complet 145 rubriques + constantes Sage
   Design moderne compact professionnel
*/
(function (root) {
'use strict';

var SAGE_DATA = null;
var CATALOGUE = [];
var CONSTANTES = [];

// Chargement async du JSON Sage
function chargerSageData() {
  if (typeof fetch !== 'undefined') {
    fetch('sage-data.json').then(function(r){ return r.json(); }).then(function(data){
      SAGE_DATA = data;
      construireCatalogue();
      construireConstantes();
      if (root.PaieDetail && root.PaieDetail._refreshCat) root.PaieDetail._refreshCat();
    });
  }
}

function construireCatalogue() {
  if (!SAGE_DATA || !SAGE_DATA.rub) return;
  CATALOGUE = SAGE_DATA.rub.map(function(r) {
    var type = 'gain';
    if (r.t === 'C') type = 'cotisation';
    else if (r.t === 'NS') type = 'retenue';
    var cnps = (r.cl === 'COT' || r.cl === 'RET');
    var imposable = (r.cl !== 'RET' && r.cl !== 'NS' && r.cl !== 'BIL');
    return {
      code: r.c, libelle: r.l, type: type, classe: r.cl || '',
      cnps: cnps, cfc: false, imposable: imposable,
      transport: (r.c === '1430'), logement: (r.c === '1435'),
      heures_sup: /^(11[0-9]|1444)$/.test(r.c)
    };
  });
}

function construireConstantes() {
  if (!SAGE_DATA || !SAGE_DATA.con) return;
  CONSTANTES = Object.keys(SAGE_DATA.con).filter(function(k){
    return SAGE_DATA.con[k].t === 'Valeur';
  }).map(function(k){
    var c = SAGE_DATA.con[k];
    var val = 0;
    if (c.o && c.o[0] && c.o[0][1] && c.o[0][1].n !== undefined) val = c.o[0][1].n;
    return { code: k, libelle: c.l, valeur: val, type: 'constante' };
  });
}

// Exemple Sage
var EXEMPLE = [
  { code:'1000', lib:'Salaire de Base mensuel', nombre:173.33, base:474.88, taux:null, gain:82311, cnps:true, cfc:true, irpp:true },
  { code:'1040', lib:'Sursalaire', gain:2804, cnps:true, cfc:true, irpp:true },
  { code:'1310', lib:'Prime de Panier', gain:10000, cnps:false, cfc:false, irpp:false },
  { code:'1430', lib:'Indemnité de Transport', gain:12347, cnps:false, cfc:false, irpp:true },
  { code:'1435', lib:'Indemnité de Logement', gain:24693, cnps:true, cfc:false, irpp:true },
  { code:'1442', lib:'Indemnité de salissure', gain:10000, cnps:false, cfc:false, irpp:false }
];

function periodeMoisCourant(d) {
  var x = d || new Date(), y = x.getFullYear(), m = x.getMonth();
  var dernier = new Date(y, m+1, 0).getDate();
  var f = function(n){ return String(n).padStart(2,'0'); }, aa = String(y).slice(2);
  return '01/'+f(m+1)+'/'+aa+' au '+f(dernier)+'/'+f(m+1)+'/'+aa;
}

function echapper(t){ return String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmt(n){ var v=Math.round(Number(n)||0); return (v<0?'-':'')+String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g,' '); }
function pc(v){ return String(v).replace('.',',')+' %'; }

// Rendu bulletin HTML style Sage
function bulletinHTML(o) {
  var R = o.resultat, lignes = o.lignes || [], s = o.saisies || {};
  var M = Object.assign({ afficherPatronales:true, afficherPied:true, pied:'', couleur:'', blocs:['entete','salarie','rubriques','pied'], colonnes:{}, logo:'', logoPos:'gauche', rubriques:[] }, o.modele||{});
  var C = Object.assign({ nombre:true, base:true, taux:true, retenuePatronale:true }, M.colonnes||{});
  var T = Object.assign({ cnps_sal:4.2, cnps_pat:4.2, at_pat:2.5, pf_pat:7, fne_pat:1, cfc_sal:1, cfc_pat:1.5, cac:10, plafond_cnps:750000 }, s.taux||{});
  var b = o.bulletin || {}, couleur = M.couleur || b.couleur || '#1f5fbf';
  var sal = R.salariales, pat = R.patronales;
  
  var thB = function(t,al){ return '<th style="padding:4px 6px;border-bottom:2px solid #333;text-align:'+(al||'right')+'">'+t+'</th>'; };
  var tdB = function(t,al){ return '<td style="padding:3px 6px;border-bottom:1px solid #ddd;text-align:'+(al||'right')+'">'+t+'</td>'; };
  
  // Gains
  var gains = lignes.map(function(l,i){ return { l:l, gain:(R.rubriques&&R.rubriques[i])?R.rubriques[i].gain:(l.gain||0) }; });
  if (M.rubriques && M.rubriques.length) {
    gains = M.rubriques.map(function(code){ return gains.filter(function(g){ return String(g.l.code)===String(code); })[0]; }).filter(Boolean);
  }
  
  var rubriques = '<table style="width:100%;border-collapse:collapse;margin-bottom:8px;font-size:11px"><thead><tr>'+thB('N°','left')+thB('Désignation','left')+
    (C.nombre?thB('Nombre'):'')+(C.base?thB('Base'):'')+(C.taux?thB('Taux'):'')+thB('Gain')+'</tr></thead><tbody>'+
    gains.map(function(g){
      var l=g.l;
      return '<tr>'+tdB(echapper(l.code),'left')+tdB(echapper(l.lib),'left')+
        (C.nombre?tdB(l.nombre!=null&&l.nombre!==''?fmt(l.nombre):''):'')+
        (C.base?tdB(l.base!=null&&l.base!==''?fmt(l.base):''):'')+
        (C.taux?tdB(l.taux!=null&&l.taux!==''?echapper(l.taux)+' %'):'')+
        tdB(fmt(g.gain))+'</tr>';
    }).join('')+
    '<tr style="font-weight:700;background:#f5f5f5">'+tdB('','left')+tdB('Total brut','left')+(C.nombre?tdB(''):'')+(C.base?tdB(''):'')+(C.taux?tdB(''):'')+tdB(fmt(R.brut))+'</tr></tbody></table>';
  
  // Cotisations
  var tableCot = function(titre,rows){
    if (!rows.length) return '';
    return '<table style="width:100%;border-collapse:collapse;margin-bottom:8px;font-size:11px"><thead><tr>'+thB(titre,'left')+
      (C.base?thB('Base'):'')+(C.taux?thB('Taux'):'')+thB('Montant')+'</tr></thead><tbody>'+
      rows.map(function(r){ return '<tr>'+tdB(echapper(r[0]),'left')+(C.base?tdB(r[1]!=null?fmt(r[1]):''):'')+(C.taux?tdB(r[2]!=null?pc(r[2]):''):'')+tdB(fmt(r[3]))+'</tr>'; }).join('')+
      '</tbody></table>';
  };
  
  var retRows = [['CNPS pension vieillesse',R.baseCNPS,T.cnps_sal,sal.cnps],['Crédit foncier salarial',R.saltaxf,T.cfc_sal,sal.cfc],['IRPP',null,null,sal.irpp],['CAC sur IRPP',sal.irpp,T.cac,sal.cac]];
  if (sal.redevance) retRows.push(['Redevance audiovisuelle',null,null,sal.redevance]);
  if (sal.taxeCommunale) retRows.push(['Taxe communale',null,null,sal.taxeCommunale]);
  if (sal.taxeDevLocal) retRows.push(['Taxe de développement local',null,null,sal.taxeDevLocal]);
  if (sal.taxeProp) retRows.push(['Taxe proportionnelle',null,null,sal.taxeProp]);
  var libelleDe = function(code){ var l=lignes.filter(function(x){ return String(x.code)===String(code); })[0]; return (l&&l.lib)||('Rubrique '+code); };
  var divRows = (R.rubriques||[]).filter(function(r){ return r.retenue; }).map(function(r){ return [libelleDe(r.code),null,null,r.gain]; });
  var patRows = [['CNPS pension vieillesse',R.baseCNPS,T.cnps_pat,pat.cnps],['CNPS accidents du travail',R.baseCNPS,T.at_pat,pat.at],['CNPS prestations familiales',R.baseCNPS,T.pf_pat,pat.pf],['Fonds national de l\'emploi',R.baseCNPS,T.fne_pat,pat.fne],['Crédit foncier patronal',R.saltaxf,T.cfc_pat,pat.cfc]];
  
  var rubriquesBloc = rubriques+tableCot('Retenues salariales',retRows)+tableCot('Retenues diverses',divRows)+((M.afficherPatronales&&C.retenuePatronale)?tableCot('Charges patronales',patRows):'');
  
  // En-tête
  var logoOk = M.logo && /^data:image\//.test(M.logo) && M.logoPos!=='aucun';
  var logoHtml = logoOk?'<img src="'+M.logo+'" alt="Logo" style="max-height:70px;max-width:200px">':'';
  var identite = '<div style="font-size:11px;line-height:1.4"><b>'+echapper(b.societe||o.employeur||'')+'</b>'+(b.adresse?'<br>'+echapper(b.adresse):'')+(b.siret?'<br>N° SIRET : '+echapper(b.siret):'')+(b.cnps?'<br>N° CNPS employeur : '+echapper(b.cnps):'')+'</div>';
  var titre = '<div style="text-align:right;font-size:16px;font-weight:700;color:'+echapper(couleur)+'">BULLETIN DE PAIE<div style="font-size:11px;color:#333;font-weight:400">Période : '+echapper(o.periode||'')+'<br>Paiement : '+echapper(o.paiement||'')+'</div></div>';
  var cellules = { gauche:[logoHtml,identite,titre], centre:[identite,logoHtml,titre], droite:[identite,titre,logoHtml], aucun:[identite,'',titre] }[M.logoPos]||[logoHtml,identite,titre];
  var entete = '<table style="width:100%;border-collapse:collapse;margin-bottom:8px;border-bottom:3px solid '+echapper(couleur)+'"><tr>'+cellules.map(function(c){ return '<td style="vertical-align:top;width:33%;padding-bottom:6px">'+c+'</td>'; }).join('')+'</tr></table>';
  var salarie = '<p style="margin:6px 0;border:1px solid #bbb;padding:6px;font-size:11px"><b>'+echapper(o.nom||'')+'</b> · Matricule interne : '+echapper(o.mat||'—')+' · N° CNPS : '+echapper(o.cnps||'—')+(o.lieu?' · Lieu : '+echapper(o.lieu):'')+(o.anciennete?' · Ancienneté : '+echapper(o.anciennete):'')+'</p>';
  var cumuls = '<table style="width:100%;border-collapse:collapse;margin:8px 0;font-size:11px"><tr>'+thB('Net imposable')+thB('Base CNPS')+thB('Base taxable')+thB('Total retenues')+thB('Charges patronales')+'</tr><tr>'+tdB(fmt(R.netImposable))+tdB(fmt(R.baseCNPS))+tdB(fmt(R.saltaxf))+tdB(fmt(R.totalRetenues))+tdB(fmt(R.totalPatronales))+'</tr></table>';
  var net = '<p style="font-size:20px;font-weight:700;margin:10px 0 4px;color:'+echapper(couleur)+'">NET À PAYER : '+fmt(R.net)+' FCFA</p><p style="margin:0 0 6px">Coût total employeur : '+fmt(R.coutEmployeur)+' FCFA</p>';
  var legal = M.afficherPied?'<div style="font-size:10px;color:#444;margin-top:10px;border-top:1px solid #ccc;padding-top:6px"><b>Pour lire ce bulletin :</b> CNPS pension : '+pc(T.cnps_sal)+' de la base, plafonnée à '+fmt(T.plafond_cnps)+'. IRPP : impôt progressif retenu à la source par l\'employeur. CAC : '+pc(T.cac)+' de l\'IRPP. Crédit foncier : '+pc(T.cfc_sal)+' de la base taxable. Redevance audiovisuelle : forfaitaire selon la tranche de brut.'+(M.pied?' '+echapper(M.pied):'')+'</div>':(M.pied?'<div style="font-size:10px;margin-top:10px">'+echapper(M.pied)+'</div>':'');
  var pied = cumuls+net+legal;
  var blocs = { entete:entete, salarie:salarie, rubriques:rubriquesBloc, pied:pied };
  var ordre = (M.blocs&&M.blocs.length)?M.blocs:['entete','salarie','rubriques','pied'];
  return '<div style="font-family:Arial,sans-serif;font-size:11px;color:#000">'+ordre.map(function(k){ return blocs[k]||''; }).join('')+'</div>';
}

function cssBulletin(b){ var c=(b&&b.couleur)||'#1f5fbf'; return 'table td,table th{border:1px solid #999;padding:3px 5px;color:#000}table th{background:'+c+';color:#fff;font-weight:600}table tr td:first-child{white-space:nowrap}'; }

// Interface principale
function ouvrir(opts) {
  var bulletinSociete = (opts&&opts.bulletin)||null;
  var tauxSage = (opts&&opts.taux)||null;
  var catalogue = CATALOGUE.slice();
  var constantes = CONSTANTES.slice();
  
  if (root.PaiePointage) root.PaiePointage.synchroniser();
  if (root.PaieModeles) root.PaieModeles.synchroniser();
  
  function appliquerPointage(h) {
    var HS = ['1110','1130','1140','1150','1160'], TX = {'1110':120,'1130':130,'1140':140,'1150':150,'1160':100};
    etat.lignes = etat.lignes.filter(function(l){ return HS.indexOf(String(l.code))<0; });
    HS.forEach(function(c){
      var n = +h[c]||0; if (n<=0) return;
      var cat = (root.PaiePointage.CATS.filter(function(x){ return x[0]===c; })[0]||[c,'Heures sup.'])[1];
      etat.lignes.push({ code:c, lib:cat, nombre:n, base:null, taux:TX[c], gain:null, cnps:true, cfc:true, irpp:true, retenue:false, heures_sup:true });
    });
    rendre();
  }
  
  function refreshCat() {
    var s = cadre.querySelector('[data-cat]'); if (!s) return;
    s.innerHTML = '<option value="">+ Choisir dans le catalogue…</option>';
    catalogue.forEach(function(r,i){
      var o = document.createElement('option');
      o.value = String(i);
      o.textContent = r.code+' — '+r.libelle+(r.type==='retenue'?' (retenue)':'');
      s.appendChild(o);
    });
  }
  
  function refreshCst() {
    var s = cadre.querySelector('[data-cst]'); if (!s) return;
    s.innerHTML = '<option value="">+ Ajouter une constante…</option>';
    constantes.forEach(function(c,i){
      var o = document.createElement('option');
      o.value = String(i);
      o.textContent = c.code+' — '+c.libelle+' ('+fmt(c.valeur)+')';
      s.appendChild(o);
    });
  }
  
  var etat = {
    lignes: (opts&&opts.lignes)?opts.lignes.slice():[{ code:'1000', lib:'Salaire de base mensuel', nombre:null, base:null, taux:null, gain:null, cnps:true, cfc:true, irpp:true }],
    saisies: {},
    nom: (opts&&opts.nom)||'', mat: (opts&&opts.mat)||'', cnps: (opts&&opts.cnps)||'',
    lieu: (opts&&opts.lieu)||'', periode: (opts&&opts.periode)||periodeMoisCourant(),
    employeur: (opts&&opts.employeur)||''
  };
  
  var employes = (opts&&opts.employes&&opts.employes.length)?opts.employes:((root.TERH_listeSalaries&&root.TERH_listeSalaries())||[]);
  etat.bulletin = bulletinSociete;
  if (!etat.employeur && bulletinSociete && bulletinSociete.societe) etat.employeur = bulletinSociete.societe;
  
  // Overlay
  var ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,14,20,.6);z-index:2147483400;display:flex;align-items:flex-start;justify-content:center;padding:16px;overflow:auto';
  
  var cadre = document.createElement('div');
  cadre.className = 'pd-cadre';
  cadre.style.cssText = 'background:#fff;color:#1a1a1a;max-width:1400px;width:100%;border-radius:8px;padding:0;box-sizing:border-box;box-shadow:0 4px 20px rgba(0,0,0,.3);font-family:"Segoe UI",Arial,sans-serif';
  
  // CSS moderne
  if (!document.getElementById('pd-style')) {
    var st = document.createElement('style');
    st.id = 'pd-style';
    st.textContent = `
      .pd-cadre input,.pd-cadre select {
        background:#fff; color:#1a1a1a; border:1px solid #d0d7de; border-radius:4px;
        padding:4px 8px; font-size:12px; min-width:0; transition:border-color .2s;
      }
      .pd-cadre input:focus,.pd-cadre select:focus { border-color:#1f5fbf; outline:none; box-shadow:0 0 0 2px rgba(31,95,191,.15); }
      .pd-cadre input[type=checkbox] { width:16px; height:16px; cursor:pointer; accent-color:#1f5fbf; }
      .pd-cadre label { color:#1a1a1a; font-size:12px; }
      .pd-cadre table { border-collapse:collapse; }
      .pd-cadre table th {
        background:#1f5fbf; color:#fff; font-weight:600; padding:6px 8px;
        border-bottom:2px solid #0d47a1; font-size:11px; text-transform:uppercase; letter-spacing:.3px;
      }
      .pd-cadre table td { border-bottom:1px solid #e3e8ef; padding:4px 6px; font-size:12px; }
      .pd-cadre table tr:hover td { background:#f5f8ff; }
      .pd-cadre button {
        background:#eef2f8; color:#1a1a1a; border:1px solid #9aa5b5; border-radius:6px;
        padding:6px 12px; cursor:pointer; font-size:12px; transition:all .2s;
      }
      .pd-cadre button:hover { background:#d6e4ff; border-color:#1f5fbf; }
      .pd-cadre button.p { background:#1f5fbf; color:#fff; border-color:#1f5fbf; font-weight:600; }
      .pd-cadre button.p:hover { background:#0d47a1; }
      .pd-cadre button.d { background:#fff; color:#c0392b; border-color:#c0392b; }
      .pd-cadre button.d:hover { background:#c0392b; color:#fff; }
      .pd-cadre .ban { background:#fff3cd; color:#856404; border:1px solid #ffc107; padding:6px 10px; border-radius:4px; font-size:12px; margin:4px 0; }
      .pd-cadre .ban.err { background:#f8d7da; color:#721c24; border-color:#f5c6cb; }
      .pd-cadre .ban.ok { background:#d4edda; color:#155724; border-color:#c3e6cb; }
      .pd-cadre .toolbar { background:#f8f9fa; border-bottom:1px solid #dee2e6; padding:8px 12px; display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
      .pd-cadre .toolbar b { font-size:14px; color:#1f5fbf; }
      .pd-cadre .info-bar { background:#e7f1ff; border-bottom:1px solid #b6d4fe; padding:6px 12px; font-size:11px; color:#084298; }
      .pd-cadre .res-bar { background:#f8f9fa; border-top:1px solid #dee2e6; padding:10px 12px; font-size:13px; display:flex; gap:18px; flex-wrap:wrap; }
      .pd-cadre .res-bar b { color:#1f5fbf; font-size:14px; }
      .pd-cadre .res-bar .net { font-size:16px; color:#1f5fbf; font-weight:700; }
      .pd-cadre input.num { text-align:right; font-family:"Consolas",monospace; }
      .pd-cadre .cat-search { width:100%; max-width:400px; }
    `;
    document.head.appendChild(st);
  }
  
  // Toolbar
  var toolbar = document.createElement('div');
  toolbar.className = 'toolbar';
  toolbar.innerHTML = '<b>🧾 Bulletin détaillé (rubriques)</b>' +
    '<button type="button" class="s" data-x="mod">📄 Modèles</button>' +
    '<button type="button" class="s" data-x="pointage">⏱ Pointage</button>' +
    '<button type="button" class="s" data-x="simul">🧮 Simulation</button>' +
    '<button type="button" class="s" data-x="rub">️ Rubriques</button>' +
    '<button type="button" class="s" data-x="exemple">📋 Exemple Sage</button>' +
    '<button type="button" class="d" data-x="close" style="margin-left:auto">✕ Fermer</button>';
  cadre.appendChild(toolbar);
  
  // Barre info salarié
  var infoBar = document.createElement('div');
  infoBar.className = 'info-bar';
  infoBar.innerHTML = '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
    '<label style="font-size:12px">Salarié <select data-emp style="width:220px"><option value="">— choisir la fiche —</option>'+employes.map(function(x,i){ return '<option value="'+i+'">'+echapper(x.nom)+'</option>'; }).join('')+'</select></label>' +
    '<label style="font-size:12px">N° CNPS <input data-f="cnps" value="'+echapper(etat.cnps)+'" style="width:140px"></label>' +
    '<label style="font-size:12px">Nom <input data-f="nom" value="'+echapper(etat.nom)+'" style="width:180px"></label>' +
    '<label style="font-size:12px">Matricule <input data-f="mat" value="'+echapper(etat.mat)+'" style="width:110px"></label>' +
    '<label style="font-size:12px">Période <input data-f="periode" value="'+echapper(etat.periode)+'" style="width:180px" placeholder="01/10/26 au 31/10/26"></label>' +
    '<label style="font-size:12px">Employeur <input data-f="employeur" value="'+echapper(etat.employeur)+'" style="width:180px"></label>' +
    '</div>';
  cadre.appendChild(infoBar);
  
  // Tableau rubriques
  var tblWrap = document.createElement('div');
  tblWrap.style.cssText = 'overflow-x:auto; max-height:400px; overflow-y:auto';
  var tbl = document.createElement('table');
  tbl.setAttribute('data-tbl','');
  tbl.style.cssText = 'width:100%; font-size:12px';
  tblWrap.appendChild(tbl);
  cadre.appendChild(tblWrap);
  
  // Barre ajout
  var addBar = document.createElement('div');
  addBar.style.cssText = 'padding:8px 12px; background:#f8f9fa; border-top:1px solid #dee2e6; display:flex; gap:8px; align-items:center; flex-wrap:wrap';
  addBar.innerHTML = '<button type="button" class="p" data-x="add">+ Ajouter une ligne</button>' +
    '<select data-cat class="cat-search" style="flex:1;min-width:300px"><option value="">+ Choisir dans le catalogue Sage (145 rubriques)…</option></select>' +
    '<select data-cst style="min-width:250px"><option value="">+ Ajouter une constante Sage…</option></select>';
  cadre.appendChild(addBar);
  
  // Résultats
  var resBar = document.createElement('div');
  resBar.className = 'res-bar';
  resBar.setAttribute('data-res','');
  cadre.appendChild(resBar);
  
  // Footer actions
  var footer = document.createElement('div');
  footer.style.cssText = 'padding:10px 12px; border-top:1px solid #dee2e6; display:flex; gap:8px; align-items:center';
  footer.innerHTML = '<button type="button" class="p" data-x="print">🖨️ Aperçu / Imprimer</button>' +
    '<span style="margin-left:auto;font-size:11px;color:#6c757d">Catalogue Sage : '+catalogue.length+' rubriques · '+constantes.length+' constantes</span>';
  cadre.appendChild(footer);
  
  ov.appendChild(cadre);
  document.body.appendChild(ov);
  
  function calcul() {
    var s = etat.saisies;
    var saisies = {};
    if (s.plafondCFPat!==undefined && s.plafondCFPat!=='' && !isNaN(+s.plafondCFPat)) saisies.plafondCFPat = +s.plafondCFPat;
    if (s.baseCFC!==null && s.baseCFC!=='' && !isNaN(+s.baseCFC)) saisies.baseCFC = +s.baseCFC;
    if (tauxSage && Object.keys(tauxSage).length) saisies.taux = tauxSage;
    return PaieMoteur.calculer(etat.lignes, saisies);
  }
  
  function rendre() {
    var tbl = cadre.querySelector('[data-tbl]'), R = calcul();
    var entete = '<thead><tr style="background:#1f5fbf;color:#fff">'+
      '<th style="width:60px">Code</th><th style="width:200px">Rubrique</th>'+
      '<th style="width:70px">Nombre</th><th style="width:90px">Base</th>'+
      '<th style="width:60px">Taux %</th><th style="width:100px">Gain</th>'+
      '<th style="width:50px" title="Imposable">Imp.</th>'+
      '<th style="width:50px" title="Cotisable CNPS">CNPS</th>'+
      '<th style="width:50px" title="Retenue">Ret.</th>'+
      '<th style="width:40px"></th>'+
      '<th style="width:90px">Calculé</th>'+
      '</tr></thead>';
    var corps = etat.lignes.map(function(l,i){
      var g = PaieMoteur.gainLigne(l);
      var n = function(k,v,w){ return '<td><input data-l="'+i+'" data-k="'+k+'" type="number" step="any" value="'+(v==null?'':v)+'" class="num" style="width:'+w+'px"></td>'; };
      var c = function(k,v){ return '<td style="text-align:center"><input type="checkbox" data-l="'+i+'" data-k="'+k+'"'+(v?' checked':'')+'></td>'; };
      return '<tr>'+
        '<td><input data-l="'+i+'" data-k="code" value="'+echapper(l.code)+'" style="width:55px"></td>'+
        '<td><input data-l="'+i+'" data-k="lib" value="'+echapper(l.lib)+'" style="width:190px"></td>'+
        n('nombre',l.nombre,65)+n('base',l.base,85)+n('taux',l.taux,55)+
        '<td><input data-l="'+i+'" data-k="gain" type="number" step="any" value="'+(l.gain==null?'':l.gain)+'" class="num" style="width:95px" title="Saisir le gain, ou laisser vide"></td>'+
        c('irpp',l.irpp)+c('cnps',l.cnps)+c('retenue',l.retenue)+
        '<td style="text-align:center"><button type="button" class="d" data-x="del" data-l="'+i+'" style="padding:2px 6px;font-size:11px">✕</button></td>'+
        '<td style="color:#666;font-size:11px;text-align:right">'+fmt(g)+'</td>'+
        '</tr>';
    }).join('');
    tbl.innerHTML = entete+'<tbody>'+corps+'</tbody>';
    
    var alertes = ((etat.mat?[]:['Matricule interne manquant.']).concat(controles(R,etat.lignes,etat.cnps))).map(function(m){ return '<div class="ban">⚠ '+echapper(m)+'</div>'; }).join('');
    cadre.querySelector('[data-res]').innerHTML = alertes +
      '<span>Brut : <b>'+fmt(R.brut)+'</b></span>' +
      '<span>Base CNPS : <b>'+fmt(R.baseCNPS)+'</b></span>' +
      '<span>Retenues : <b>'+fmt(R.totalRetenues)+'</b></span>' +
      '<span>Patronales : <b>'+fmt(R.totalPatronales)+'</b></span>' +
      '<span class="net">Net à payer : '+fmt(R.net)+' FCFA</span>';
  }
  
  cadre.addEventListener('input', function(e){
    var t = e.target;
    if (t.dataset.l!=null && t.dataset.k) {
      var i = +t.dataset.l, k = t.dataset.k, l = etat.lignes[i];
      if (k==='cnps'||k==='cfc'||k==='irpp'||k==='retenue') l[k] = t.checked;
      else if (k==='code'||k==='lib') l[k] = t.value;
      else l[k] = t.value===''?null:+t.value;
    } else if (t.dataset.s) etat.saisies[t.dataset.s] = t.value;
    else if (t.dataset.f) etat[t.dataset.f] = t.value;
    rendre();
  });
  cadre.addEventListener('change', function(e){
    if (e.target.dataset.k && (e.target.type==='checkbox')) rendre();
    if (e.target.dataset.emp!==undefined) {
      var fiche = employes[+e.target.value];
      if (fiche) {
        etat.nom = fiche.nom; etat.mat = fiche.mat||''; etat.cnps = fiche.cnps||''; etat.lieu = fiche.lieu||'';
        if (fiche.sb) {
          var hor = Number(fiche.hor)||173.33, b1000 = etat.lignes.filter(function(l){ return String(l.code)==='1000'; })[0];
          if (b1000) { b1000.nombre = hor; b1000.base = Number(fiche.sb)/hor; b1000.gain = null; }
        }
        var an = (window.PaieMoteur&&PaieMoteur.ancienneteDepuis)?PaieMoteur.ancienneteDepuis(fiche.entree,new Date()):null;
        etat.anciennete = an?an.texte:'';
        cadre.querySelector('[data-f="nom"]').value = etat.nom;
        cadre.querySelector('[data-f="cnps"]').value = etat.cnps;
        var mi = cadre.querySelector('[data-f="mat"]'); if (mi) mi.value = etat.mat;
        rendre();
      }
    }
  });
  cadre.addEventListener('click', function(e){
    var b = e.target.closest('[data-x]'); if (!b) return;
    var x = b.dataset.x;
    if (x==='close') ov.remove();
    else if (x==='add') { etat.lignes.push({ code:'', lib:'Nouvelle rubrique', nombre:null, base:null, taux:null, gain:0, cnps:false, cfc:false, irpp:true, retenue:false }); rendre(); }
    else if (x==='del') { etat.lignes.splice(+b.dataset.l,1); rendre(); }
    else if (x==='rub') { if (root.PaieRubriques) root.PaieRubriques.ouvrir(catalogue,function(liste){ catalogue.splice(0,catalogue.length); liste.forEach(function(r){ catalogue.push(r); }); refreshCat(); }); else alert('paie-rubriques.js non chargé.'); }
    else if (x==='pointage') { if (root.PaiePointage) { var fiche = employes.filter(function(f){ return f.nom===etat.nom; })[0]; root.PaiePointage.ouvrir({ employes:employes, periode:etat.periode, courant:fiche?(fiche.mat||fiche.nom):'', onApply:appliquerPointage }); } else alert('paie-pointage-simulation.js non chargé.'); }
    else if (x==='simul') { if (root.PaieSimulation) root.PaieSimulation.ouvrir({ lignes:etat.lignes, saisies:{ taux:tauxSage||{} }, nom:etat.nom }); else alert('paie-pointage-simulation.js non chargé.'); }
    else if (x==='mod') { if (root.PaieModeles) root.PaieModeles.ouvrir(); else alert('paie-modeles.js non chargé.'); }
    else if (x==='exemple') { etat.lignes = EXEMPLE.map(function(l){ return Object.assign({},l); }); rendre(); }
    else if (x==='print') {
      var R = calcul();
      var html = bulletinHTML({ modele:(root.PaieModeles&&root.PaieModeles.actif)?root.PaieModeles.actif():null, bulletin:etat.bulletin, nom:etat.nom, mat:etat.mat, cnps:etat.cnps, lieu:etat.lieu, anciennete:etat.anciennete, periode:etat.periode, employeur:etat.employeur, lignes:etat.lignes, saisies:Object.assign({},etat.saisies,{ taux:tauxSage||{} }), resultat:R });
      if (typeof root.printHTML==='function') root.printHTML('Bulletin de paie',html,cssBulletin(etat.bulletin),{ apercu:true });
    }
  });
  
  // Catalogue select
  var sel = cadre.querySelector('[data-cat]');
  catalogue.forEach(function(r,i){
    var o = document.createElement('option'); o.value = String(i);
    o.textContent = r.code+' — '+r.libelle+(r.type==='retenue'?' (retenue)':'');
    sel.appendChild(o);
  });
  sel.addEventListener('change', function(){
    var r = catalogue[+sel.value]; if (!r) return;
    etat.lignes.push({ code:r.code, lib:r.libelle, nombre:null, base:null, taux:null, gain:null, cnps:!!r.cnps, cfc:!!r.cfc, irpp:r.imposable!==false, retenue:r.type==='retenue', transport:!!r.transport, logement:!!r.logement, heures_sup:!!r.heures_sup });
    sel.value = ''; rendre();
  });
  
  // Constantes select
  var selCst = cadre.querySelector('[data-cst]');
  constantes.forEach(function(c,i){
    var o = document.createElement('option'); o.value = String(i);
    o.textContent = c.code+' — '+c.libelle+' ('+fmt(c.valeur)+')';
    selCst.appendChild(o);
  });
  selCst.addEventListener('change', function(){
    var c = constantes[+selCst.value]; if (!c) return;
    etat.lignes.push({ code:c.code, lib:c.libelle, nombre:1, base:c.valeur, taux:100, gain:null, cnps:false, cfc:false, irpp:true, retenue:false });
    selCst.value = ''; rendre();
  });
  
  // Rafraîchir si données Sage chargées async
  root.PaieDetail._refreshCat = function(){
    catalogue = CATALOGUE.slice();
    constantes = CONSTANTES.slice();
    refreshCat();
    refreshCst();
    // Mettre à jour le compteur
    var sp = cadre.querySelector('[style*="margin-left:auto"]');
    if (sp) sp.textContent = 'Catalogue Sage : '+catalogue.length+' rubriques · '+constantes.length+' constantes';
  };
  
  refreshCat();
  refreshCst();
  rendre();
}

function controles(R,lignes,cnps) {
  var msg = [];
  if (!R) return msg;
  if (!String(cnps||'').trim()) msg.push('N° CNPS manquant.');
  if (R.brut<=0) msg.push('Brut nul : aucune rubrique de gain.');
  if (R.net<0) msg.push('Net négatif : les retenues dépassent le brut.');
  if (R.totalRetenues>R.brut && R.brut>0) msg.push('Retenues supérieures au brut.');
  if (R.netImposable>R.brut) msg.push('Net imposable supérieur au brut.');
  var base = R.netImposable-(lignes||[]).filter(function(l){ return String(l.code)==='1430'; }).reduce(function(t,l){ return t+(typeof l.gain==='number'?l.gain:0); },0);
  if (base>750000) msg.push('Base CNPS au-delà de 750 000 : cotisation plafonnée à 31 500 (4,2 %).');
  return msg;
}

var API = { periodeMoisCourant:periodeMoisCourant, controles:controles, EXEMPLE:EXEMPLE, bulletinHTML:bulletinHTML, ouvrir:ouvrir, fmt:fmt,
  getCatalogue:function(){ return CATALOGUE.slice(); },
  getConstantes:function(){ return CONSTANTES.slice(); }
};
if (typeof module!=='undefined'&&module.exports) module.exports = API;
else root.PaieDetail = API;

// Chargement initial
chargerSageData();
})(typeof window!=='undefined'?window:globalThis);