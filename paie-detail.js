/* paie-detail.js — Bulletin détaillé en rubriques (style Sage).
 * Saisie : code, rubrique, nombre, base, taux, gain et cases cotisable CNPS / crédit foncier / imposable.
 * Les cotisations se calculent via paie-moteur.js. Les données ne sont pas enregistrées (session en cours).
 * Fonctions de rendu pures testées par scripts/test-paie-detail.js.
 */
(function (root) {
  'use strict';
  var EXEMPLE = [
    { code: '1000', lib: 'Salaire de base mensuel', nombre: 173.33, base: 474.88, taux: null, gain: 82311, cnps: true, cfc: true, irpp: true },
    { code: '1040', lib: 'Sursalaire', nombre: null, base: null, taux: null, gain: 2804, cnps: true, cfc: true, irpp: true },
    { code: '1310', lib: 'Prime de panier', nombre: null, base: null, taux: null, gain: 10000, cnps: false, cfc: false, irpp: false },
    { code: '1430', lib: 'Indemnité de transport', nombre: null, base: null, taux: null, gain: 12347, cnps: false, cfc: false, irpp: true },
    { code: '1435', lib: 'Indemnité de logement', nombre: null, base: null, taux: null, gain: 24693, cnps: true, cfc: false, irpp: true },
    { code: '1442', lib: 'Indemnité de salissure', nombre: null, base: null, taux: null, gain: 10000, cnps: false, cfc: false, irpp: false }
  ];
  function echapper(t) {
    return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmt(n) {
    var v = Math.round(Number(n) || 0);
    return (v < 0 ? '-' : '') + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }
  // Mise en page inspirée de Sage : en-tête, rubriques, cotisations, net
  function bulletinHTML(o) {
    var R = o.resultat, lignes = o.lignes || [], s = o.saisies || {};
    var rub = lignes.map(function (l, i) {
      var g = (R.rubriques && R.rubriques[i]) ? R.rubriques[i].gain : (l.gain || 0);
      return '<tr><td>' + echapper(l.code) + '</td><td>' + echapper(l.lib) + '</td><td class="n">' + (l.nombre != null && l.nombre !== '' ? fmt(l.nombre) : '') +
        '</td><td class="n">' + (l.base != null && l.base !== '' ? fmt(l.base) : '') + '</td><td class="n">' + (l.taux != null && l.taux !== '' ? l.taux + ' %' : '') +
        '</td><td class="n">' + fmt(g) + '</td></tr>';
    }).join('');
    var sal = R.salariales, pat = R.patronales;
    return '<div style="font-family:Arial,sans-serif;font-size:11px">' +
      '<table style="width:100%;border-collapse:collapse"><tr><td style="width:60%;font-size:17px;font-weight:700">BULLETIN DE PAIE</td>' +
      '<td style="text-align:right">Période : ' + echapper(o.periode || '') + '<br>Paiement : ' + echapper(o.paiement || '') + '</td></tr></table>' +
      '<p style="margin:6px 0"><b>' + echapper(o.nom || '') + '</b> · ' + echapper(o.employeur || '') + ' · ' + echapper(o.conv || 'CCN CC') + '</p>' +
      '<table class="sg" style="width:100%;border-collapse:collapse;margin-bottom:8px"><thead><tr><th>N°</th><th>Désignation</th><th>Nombre</th><th>Base</th><th>Taux</th><th>Gain</th></tr></thead><tbody>' + rub +
      '<tr><td></td><td><b>Total brut</b></td><td></td><td></td><td></td><td class="n"><b>' + fmt(R.brut) + '</b></td></tr></tbody></table>' +
      '<table style="width:100%;border-collapse:collapse;margin-bottom:8px"><thead><tr><th>Retenues salariales</th><th>Base</th><th>Taux</th><th>Montant</th></tr></thead><tbody>' +
      '<tr><td>CNPS pension vieillesse</td><td class="n">' + fmt(R.baseCNPS) + '</td><td class="n">' + (s.taux && s.taux.cnps_sal != null ? s.taux.cnps_sal : 4.2) + ' %</td><td class="n">' + fmt(sal.cnps) + '</td></tr>' +
      '<tr><td>Crédit foncier salarial</td><td class="n">' + fmt(R.baseCFC) + '</td><td class="n">1 %</td><td class="n">' + fmt(sal.cfc) + '</td></tr>' +
      '<tr><td>IRPP</td><td class="n"></td><td class="n">barème</td><td class="n">' + fmt(sal.irpp) + '</td></tr>' +
      '<tr><td>CAC (10 % IRPP)</td><td class="n">' + fmt(sal.irpp) + '</td><td class="n">10 %</td><td class="n">' + fmt(sal.cac) + '</td></tr>' +
      (sal.redevance ? '<tr><td>Redevance audiovisuelle</td><td class="n"></td><td class="n"></td><td class="n">' + fmt(sal.redevance) + '</td></tr>' : '') +
      (sal.taxeCommunale ? '<tr><td>Taxe communale</td><td class="n"></td><td class="n"></td><td class="n">' + fmt(sal.taxeCommunale) + '</td></tr>' : '') +
      '<tr><td><b>Total retenues</b></td><td></td><td></td><td class="n"><b>' + fmt(R.totalRetenues) + '</b></td></tr></tbody></table>' +
      '<table style="width:100%;border-collapse:collapse;margin-bottom:8px"><thead><tr><th>Charges patronales</th><th>Base</th><th>Taux</th><th>Montant</th></tr></thead><tbody>' +
      '<tr><td>CNPS prestations familiales</td><td class="n">' + fmt(R.baseCNPS) + '</td><td class="n">7 %</td><td class="n">' + fmt(pat.pf) + '</td></tr>' +
      '<tr><td>CNPS pension vieillesse</td><td class="n">' + fmt(R.baseCNPS) + '</td><td class="n">4.2 %</td><td class="n">' + fmt(pat.cnps) + '</td></tr>' +
      '<tr><td>CNPS accidents du travail</td><td class="n">' + fmt(R.baseCNPS) + '</td><td class="n">2.5 %</td><td class="n">' + fmt(pat.at) + '</td></tr>' +
      '<tr><td>Crédit foncier patronal</td><td class="n">' + fmt(R.baseCFC) + '</td><td class="n">1.5 %</td><td class="n">' + fmt(pat.cfc) + '</td></tr>' +
      '<tr><td>Fonds national de l\'emploi</td><td class="n">' + fmt(R.baseCNPS) + '</td><td class="n">1 %</td><td class="n">' + fmt(pat.fne) + '</td></tr>' +
      '<tr><td><b>Total charges patronales</b></td><td></td><td></td><td class="n"><b>' + fmt(R.totalPatronales) + '</b></td></tr></tbody></table>' +
      '<p style="font-size:22px;font-weight:700;margin:14px 0 4px">NET À PAYER : ' + fmt(R.net) + ' FCFA</p>' +
      '<p>Coût total employeur : ' + fmt(R.coutEmployeur) + '</p>' +
      '</div>';
  }
  // Interface de saisie : rubriques éditables, totaux qui se recalculent
  function ouvrir(opts) {
    var tauxSage = (opts && opts.taux) || null;
    var etat = { lignes: (opts && opts.lignes) ? opts.lignes.slice() : [{ code: '1000', lib: 'Salaire de base mensuel', nombre: null, base: null, taux: null, gain: null, cnps: true, cfc: true, irpp: true }],
      saisies: { irpp: 0, baseCFC: null, redevance: 0, taxeCommunale: 0 }, nom: (opts && opts.nom) || '', periode: (opts && opts.periode) || '', employeur: (opts && opts.employeur) || '' };
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,14,20,.6);z-index:2147483400;display:flex;align-items:flex-start;justify-content:center;padding:16px;overflow:auto';
    var cadre = document.createElement('div');
    cadre.style.cssText = 'background:#fff;color:#1a1a1a;max-width:1000px;width:100%;border-radius:12px;padding:16px;box-sizing:border-box';
    cadre.innerHTML = '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b style="flex:1;font-size:16px">🧾 Bulletin détaillé (rubriques)</b>' +
      '<button type="button" class="s" data-x="exemple">Charger l\'exemple Sage</button><button type="button" class="s" data-x="close">✕ Fermer</button></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0"><label style="font-size:12px">Salarié<input data-f="nom" value="' + echapper(etat.nom) + '" style="width:220px"></label>' +
      '<label style="font-size:12px">Période<input data-f="periode" value="' + echapper(etat.periode) + '" placeholder="ex. 01/07/26 au 31/07/26"></label>' +
      '<label style="font-size:12px">Employeur<input data-f="employeur" value="' + echapper(etat.employeur) + '"></label></div>' +
      '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px" data-tbl></table></div>' +
      '<button type="button" class="s" data-x="add" style="margin:8px 0">+ Ajouter une rubrique</button>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin:8px 0;font-size:12px">' +
      '<label>IRPP (barème, saisi)<input data-s="irpp" type="number" step="any" value="0" style="width:110px"></label>' +
      '<label>Base crédit foncier (vide = somme des rubriques)<input data-s="baseCFC" type="number" step="any" style="width:150px"></label>' +
      '<label>Plafond crédit foncier patronal (vide = BRUT)<input data-s="plafondCFPat" type="number" step="any" style="width:130px"></label>' +
      '<label>Redevance audiovisuelle<input data-s="redevance" type="number" step="any" value="0" style="width:110px"></label>' +
      '<label>Taxe communale<input data-s="taxeCommunale" type="number" step="any" value="0" style="width:110px"></label></div>' +
      '<div data-res style="border-top:1px solid #d6dbe3;padding-top:10px"></div>' +
      '<div style="display:flex;gap:8px;margin-top:10px"><button type="button" class="p" data-x="print">🖨️ Aperçu / imprimer</button></div>';
    ov.appendChild(cadre); document.body.appendChild(ov);
    function calcul() {
      var s = etat.saisies;
      var saisies = { irpp: +s.irpp || 0, redevance: +s.redevance || 0, taxeCommunale: +s.taxeCommunale || 0 };
      if (s.plafondCFPat !== undefined && s.plafondCFPat !== '' && !isNaN(+s.plafondCFPat)) saisies.plafondCFPat = +s.plafondCFPat;
      if (s.baseCFC !== null && s.baseCFC !== '' && !isNaN(+s.baseCFC)) saisies.baseCFC = +s.baseCFC;
      if (tauxSage && Object.keys(tauxSage).length) saisies.taux = tauxSage;
      return PaieMoteur.calculer(etat.lignes, saisies);
    }
    function rendre() {
      var tbl = cadre.querySelector('[data-tbl]'), R = calcul();
      var entete = '<tr style="background:#1f5fbf;color:#fff"><th>Code</th><th>Rubrique</th><th>Nombre</th><th>Base</th><th>Taux %</th><th>Gain</th><th title="Cotisable CNPS">CNPS</th><th title="Cotisable crédit foncier">CFC</th><th title="Imposable">IRPP</th><th title="Retenue : avance sur salaire, cantine, etc.">Retenue</th><th></th></tr>';
      var corps = etat.lignes.map(function (l, i) {
        var g = PaieMoteur.gainLigne(l);
        var c = function (k, v) { return '<td style="text-align:center"><input type="checkbox" data-l="' + i + '" data-k="' + k + '"' + (v ? ' checked' : '') + '></td>'; };
        var n = function (k, v, w) { return '<td><input data-l="' + i + '" data-k="' + k + '" type="number" step="any" value="' + (v == null ? '' : v) + '" style="width:' + w + 'px"></td>'; };
        return '<tr>' + '<td><input data-l="' + i + '" data-k="code" value="' + echapper(l.code) + '" style="width:60px"></td>' +
          '<td><input data-l="' + i + '" data-k="lib" value="' + echapper(l.lib) + '" style="width:200px"></td>' +
          n('nombre', l.nombre, 70) + n('base', l.base, 90) + n('taux', l.taux, 60) +
          '<td><input data-l="' + i + '" data-k="gain" type="number" step="any" value="' + (l.gain == null ? '' : l.gain) + '" style="width:100px" title="Saisir le gain, ou laisser vide pour nombre × base × taux"></td>' +
          c('cnps', l.cnps) + c('cfc', l.cfc) + c('irpp', l.irpp) + c('retenue', l.retenue) +
          '<td><button type="button" class="s" data-x="del" data-l="' + i + '">✕</button></td>' +
          '<td style="color:#666;font-size:11px">' + fmt(g) + '</td></tr>';
      }).join('');
      tbl.innerHTML = '<thead>' + entete + '</thead><tbody>' + corps + '</tbody>';
      cadre.querySelector('[data-res]').innerHTML = '<div style="display:flex;gap:18px;flex-wrap:wrap;font-size:13px"><span>Brut : <b>' + fmt(R.brut) + '</b></span>' +
        '<span>Base CNPS : <b>' + fmt(R.baseCNPS) + '</b></span><span>Retenues : <b>' + fmt(R.totalRetenues) + '</b></span>' +
        '<span>Patronales : <b>' + fmt(R.totalPatronales) + '</b></span><span style="font-size:16px">Net à payer : <b>' + fmt(R.net) + '</b></span></div>';
    }
    cadre.addEventListener('input', function (e) {
      var t = e.target;
      if (t.dataset.l != null && t.dataset.k) {
        var i = +t.dataset.l, k = t.dataset.k, l = etat.lignes[i];
        if (k === 'cnps' || k === 'cfc' || k === 'irpp' || k === 'retenue') l[k] = t.checked; else if (k === 'code' || k === 'lib') l[k] = t.value;
        else l[k] = t.value === '' ? null : +t.value;
      } else if (t.dataset.s) etat.saisies[t.dataset.s] = t.value;
      else if (t.dataset.f) etat[t.dataset.f] = t.value;
      rendre();
    });
    cadre.addEventListener('change', function (e) { if (e.target.dataset.k && (e.target.type === 'checkbox')) rendre(); });
    cadre.addEventListener('click', function (e) {
      var b = e.target.closest('[data-x]'); if (!b) return;
      var x = b.dataset.x;
      if (x === 'close') ov.remove();
      else if (x === 'add') { etat.lignes.push({ code: '', lib: 'Nouvelle rubrique', nombre: null, base: null, taux: null, gain: 0, cnps: false, cfc: false, irpp: true, retenue: false }); rendre(); }
      else if (x === 'del') { etat.lignes.splice(+b.dataset.l, 1); rendre(); }
      else if (x === 'exemple') { etat.lignes = EXEMPLE.map(function (l) { return Object.assign({}, l); }); etat.saisies.irpp = 3365; etat.saisies.baseCFC = 112081.3; etat.saisies.redevance = 1950; etat.saisies.taxeCommunale = 770; etat.saisies.plafondCFPat = 112081.3; cadre.querySelector('[data-s="plafondCFPat"]').value = 112081.3; cadre.querySelector('[data-s="irpp"]').value = 3365; cadre.querySelector('[data-s="baseCFC"]').value = 112081.3; cadre.querySelector('[data-s="redevance"]').value = 1950; cadre.querySelector('[data-s="taxeCommunale"]').value = 770; rendre(); }
      else if (x === 'print') {
        var R = calcul();
        var html = bulletinHTML({ nom: etat.nom, periode: etat.periode, employeur: etat.employeur, lignes: etat.lignes, saisies: etat.saisies, resultat: R });
        if (typeof root.printHTML === 'function') root.printHTML('Bulletin de paie', html, 'table.sg th,table td,table th{border:1px solid #999;padding:3px 5px}table th{background:#e9eef7}', { apercu: true });
      }
    });
    rendre();
  }
  var API = { EXEMPLE: EXEMPLE, bulletinHTML: bulletinHTML, ouvrir: ouvrir, fmt: fmt };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.PaieDetail = API;
})(typeof window !== 'undefined' ? window : globalThis);
