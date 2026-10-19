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
  // Période du mois courant au format de la grille : 01/MM/AA au JJ/MM/AA
  function periodeMoisCourant(d) {
    var x = d || new Date(), y = x.getFullYear(), m = x.getMonth();
    var dernier = new Date(y, m + 1, 0).getDate();
    var f = function (n) { return String(n).padStart(2, '0'); }, aa = String(y).slice(2);
    return '01/' + f(m + 1) + '/' + aa + ' au ' + f(dernier) + '/' + f(m + 1) + '/' + aa;
  }
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
    var M = Object.assign({ afficherPatronales: true, afficherPied: true, pied: '', couleur: '' }, o.modele || {});
    var T = Object.assign({ cnps_sal: 4.2, cnps_pat: 4.2, at_pat: 2.5, pf_pat: 7, fne_pat: 1, cfc_sal: 1, cfc_pat: 1.5, cac: 10, plafond_cnps: 750000 }, s.taux || {});
    var pc = function (v) { return String(v).replace('.', ',') + ' %'; };
    var rub = lignes.map(function (l, i) {
      var g = (R.rubriques && R.rubriques[i]) ? R.rubriques[i].gain : (l.gain || 0);
      return '<tr><td>' + echapper(l.code) + '</td><td>' + echapper(l.lib) + '</td><td class="n">' + (l.nombre != null && l.nombre !== '' ? fmt(l.nombre) : '') +
        '</td><td class="n">' + (l.base != null && l.base !== '' ? fmt(l.base) : '') + '</td><td class="n">' + (l.taux != null && l.taux !== '' ? l.taux + ' %' : '') +
        '</td><td class="n">' + fmt(g) + '</td></tr>';
    }).join('');
    var sal = R.salariales, pat = R.patronales;
    var b = o.bulletin || {}, couleur = M.couleur || b.couleur || '#1f5fbf';
    var logo = (b.logo && /^data:image\//.test(b.logo)) ? '<img src="' + b.logo + '" alt="" style="max-height:64px;max-width:200px">' : '';
    var identite = '<div style="font-size:11px;line-height:1.4"><b>' + echapper(b.societe || o.employeur || '') + '</b>' +
      (b.adresse ? '<br>' + echapper(b.adresse) : '') + (b.siret ? '<br>N° SIRET : ' + echapper(b.siret) : '') +
      (b.cnps ? '<br>N° CNPS employeur : ' + echapper(b.cnps) : '') + '</div>';
    var retenues = '<table style="width:100%;border-collapse:collapse;margin-bottom:8px"><thead><tr><th>Retenues salariales</th><th>Base</th><th>Taux</th><th>Montant</th></tr></thead><tbody>' +
      '<tr><td>CNPS pension vieillesse</td><td class="n">' + fmt(R.baseCNPS) + '</td><td class="n">' + pc(T.cnps_sal) + '</td><td class="n">' + fmt(sal.cnps) + '</td></tr>' +
      '<tr><td>Crédit foncier salarial</td><td class="n">' + fmt(R.saltaxf) + '</td><td class="n">' + pc(T.cfc_sal) + '</td><td class="n">' + fmt(sal.cfc) + '</td></tr>' +
      '<tr><td>IRPP</td><td class="n"></td><td class="n">barème</td><td class="n">' + fmt(sal.irpp) + '</td></tr>' +
      '<tr><td>CAC</td><td class="n">' + fmt(sal.irpp) + '</td><td class="n">' + pc(T.cac) + '</td><td class="n">' + fmt(sal.cac) + '</td></tr>' +
      (sal.redevance ? '<tr><td>Redevance audiovisuelle</td><td class="n"></td><td class="n"></td><td class="n">' + fmt(sal.redevance) + '</td></tr>' : '') +
      (sal.taxeCommunale ? '<tr><td>Taxe communale</td><td class="n"></td><td class="n"></td><td class="n">' + fmt(sal.taxeCommunale) + '</td></tr>' : '') +
      (sal.taxeDevLocal ? '<tr><td>Taxe de développement local</td><td class="n"></td><td class="n"></td><td class="n">' + fmt(sal.taxeDevLocal) + '</td></tr>' : '') +
      (sal.taxeProp ? '<tr><td>Taxe proportionnelle</td><td class="n"></td><td class="n"></td><td class="n">' + fmt(sal.taxeProp) + '</td></tr>' : '') +
      '<tr><td><b>Total retenues</b></td><td></td><td></td><td class="n"><b>' + fmt(R.totalRetenues) + '</b></td></tr></tbody></table>';
    var patronales = M.afficherPatronales ? '<table style="width:100%;border-collapse:collapse;margin-bottom:8px"><thead><tr><th>Charges patronales</th><th>Base</th><th>Taux</th><th>Montant</th></tr></thead><tbody>' +
      '<tr><td>CNPS prestations familiales</td><td class="n">' + fmt(R.baseCNPS) + '</td><td class="n">' + pc(T.pf_pat) + '</td><td class="n">' + fmt(pat.pf) + '</td></tr>' +
      '<tr><td>CNPS pension vieillesse</td><td class="n">' + fmt(R.baseCNPS) + '</td><td class="n">' + pc(T.cnps_pat) + '</td><td class="n">' + fmt(pat.cnps) + '</td></tr>' +
      '<tr><td>CNPS accidents du travail</td><td class="n">' + fmt(R.baseCNPS) + '</td><td class="n">' + pc(T.at_pat) + '</td><td class="n">' + fmt(pat.at) + '</td></tr>' +
      '<tr><td>Crédit foncier patronal</td><td class="n">' + fmt(R.saltaxf) + '</td><td class="n">' + pc(T.cfc_pat) + '</td><td class="n">' + fmt(pat.cfc) + '</td></tr>' +
      '<tr><td>Fonds national de l\'emploi</td><td class="n">' + fmt(R.baseCNPS) + '</td><td class="n">' + pc(T.fne_pat) + '</td><td class="n">' + fmt(pat.fne) + '</td></tr>' +
      '<tr><td><b>Total charges patronales</b></td><td></td><td></td><td class="n"><b>' + fmt(R.totalPatronales) + '</b></td></tr></tbody></table>' : '';
    var pied = M.afficherPied ? '<div style="font-size:10px;color:#444;margin-top:12px;border-top:1px solid #ccc;padding-top:6px"><b>Pour lire ce bulletin :</b> ' +
      'CNPS pension : ' + pc(T.cnps_sal) + ' de la base, plafonnée à ' + fmt(T.plafond_cnps) + '. ' +
      'IRPP : impôt progressif retenu à la source par l\'employeur. CAC : ' + pc(T.cac) + ' de l\'IRPP. ' +
      'Crédit foncier : ' + pc(T.cfc_sal) + ' de la base taxable. Redevance audiovisuelle : forfaitaire selon la tranche de brut. ' +
      'Le coût employeur inclut les charges patronales.' + (M.pied ? ' ' + echapper(M.pied) : '') + '</div>' : (M.pied ? '<div style="font-size:10px;margin-top:12px">' + echapper(M.pied) + '</div>' : '');
    return '<div style="font-family:Arial,sans-serif;font-size:11px;color:#000">' +
      '<table style="width:100%;border-collapse:collapse;margin-bottom:8px"><tr><td style="width:22%;vertical-align:top">' + logo + '</td>' +
      '<td style="width:48%;vertical-align:top">' + identite + '</td>' +
      '<td style="text-align:right;vertical-align:top;font-size:16px;font-weight:700;color:' + echapper(couleur) + '">BULLETIN DE PAIE</td></tr></table>' +
      '<table style="width:100%;border-collapse:collapse"><tr><td style="width:60%;font-size:17px;font-weight:700">&nbsp;</td>' +
      '<td style="text-align:right">Période : ' + echapper(o.periode || '') + '<br>Paiement : ' + echapper(o.paiement || '') + '</td></tr></table>' +
      '<p style="margin:6px 0"><b>' + echapper(o.nom || '') + '</b> · Matricule interne : ' + echapper(o.mat || '—') + ' · N° CNPS : ' + echapper(o.cnps || '—') + (o.lieu ? ' · Lieu de travail : ' + echapper(o.lieu) : '') + (o.anciennete ? ' · Ancienneté : ' + echapper(o.anciennete) : '') + ' · ' + echapper(o.employeur || '') + '</p>' +
      '<table class="sg" style="width:100%;border-collapse:collapse;margin-bottom:8px"><thead><tr><th>N°</th><th>Désignation</th><th>Nombre</th><th>Base</th><th>Taux</th><th>Gain</th></tr></thead><tbody>' + rub +
      '<tr><td></td><td><b>Total brut</b></td><td></td><td></td><td></td><td class="n"><b>' + fmt(R.brut) + '</b></td></tr></tbody></table>' +
      retenues + patronales +
      '<table style="width:100%;border-collapse:collapse;margin:10px 0;font-size:11px"><tr><td>Net imposable</td><td class="n">' + fmt(R.netImposable) + '</td><td>Base CNPS</td><td class="n">' + fmt(R.baseCNPS) + '</td></tr>' +
      '<tr><td>Base taxable (IRPP, crédit foncier)</td><td class="n">' + fmt(R.saltaxf) + '</td><td>Total des retenues</td><td class="n">' + fmt(R.totalRetenues) + '</td></tr></table>' +
      '<p style="font-size:22px;font-weight:700;margin:14px 0 4px">NET À PAYER : ' + fmt(R.net) + ' FCFA</p>' +
      '<p>Coût total employeur : ' + fmt(R.coutEmployeur) + '</p>' + pied + '</div>';
  }
  // Interface de saisie : rubriques éditables, totaux qui se recalculent
  // Couleurs du bulletin : en-têtes de la couleur de la société, texte blanc sur fond foncé, noir sur fond clair
  function cssBulletin(b) {
    var c = (b && b.couleur) || '#1f5fbf';
    return 'table td,table th{border:1px solid #999;padding:3px 5px;color:#000}table th{background:' + c + ';color:#fff}' +
      'table tr td:first-child{white-space:nowrap}';
  }
  function ouvrir(opts) {
    var bulletinSociete = (opts && opts.bulletin) || null;
    var tauxSage = (opts && opts.taux) || null;
    var catalogue = (opts && opts.rubriques && opts.rubriques.length) ? opts.rubriques : ((root.PaieRubriques && root.PaieRubriques.charger) ? root.PaieRubriques.charger() : []);
    if (root.PaiePointage) root.PaiePointage.synchroniser();
    if (root.PaieModeles) root.PaieModeles.synchroniser();
    function appliquerPointage(h) {
      var HS = ['1110', '1130', '1140', '1150', '1160'], TX = { '1110': 120, '1130': 130, '1140': 140, '1150': 150, '1160': 100 };
      etat.lignes = etat.lignes.filter(function (l) { return HS.indexOf(String(l.code)) < 0; });
      HS.forEach(function (c) {
        var n = +h[c] || 0; if (n <= 0) return;
        var cat = (root.PaiePointage.CATS.filter(function (x) { return x[0] === c; })[0] || [c, 'Heures sup.'])[1];
        etat.lignes.push({ code: c, lib: cat, nombre: n, base: null, taux: TX[c], gain: null, cnps: true, cfc: true, irpp: true, retenue: false, heures_sup: true });
      });
      rendre();
    }
    function refreshCat() { var s = cadre.querySelector('[data-cat]'); if (!s) return; s.innerHTML = '<option value="">+ Choisir dans le catalogue…</option>';
      catalogue.forEach(function (r, i) { var o = document.createElement('option'); o.value = String(i); o.textContent = r.code + ' — ' + r.libelle + (r.type === 'retenue' ? ' (retenue)' : ''); s.appendChild(o); }); }
    function openRubriques() { if (!root.PaieRubriques) { alert('paie-rubriques.js n\'est pas chargé.'); return; }
      root.PaieRubriques.ouvrir(catalogue, function (liste) { catalogue.splice(0, catalogue.length); liste.forEach(function (r) { catalogue.push(r); }); root.PAIE_RUB_CACHE = catalogue; refreshCat(); }); }
    var etat = { lignes: (opts && opts.lignes) ? opts.lignes.slice() : [{ code: '1000', lib: 'Salaire de base mensuel', nombre: null, base: null, taux: null, gain: null, cnps: true, cfc: true, irpp: true }],
      saisies: {}, nom: (opts && opts.nom) || '', mat: (opts && opts.mat) || '', cnps: (opts && opts.cnps) || '', lieu: (opts && opts.lieu) || '', periode: (opts && opts.periode) || periodeMoisCourant(), employeur: (opts && opts.employeur) || '' };
    var employes = (opts && opts.employes) || [];
    etat.bulletin = bulletinSociete;
    if (!etat.employeur && bulletinSociete && bulletinSociete.societe) etat.employeur = bulletinSociete.societe;
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,14,20,.6);z-index:2147483400;display:flex;align-items:flex-start;justify-content:center;padding:16px;overflow:auto';
    var cadre = document.createElement('div');
    cadre.className = 'pd-cadre';
    cadre.style.cssText = 'background:#fff;color:#1a1a1a;max-width:1000px;width:100%;border-radius:12px;padding:16px;box-sizing:border-box';
    if (!document.getElementById('pd-style')) { var st = document.createElement('style'); st.id = 'pd-style';
      st.textContent = '.pd-cadre input,.pd-cadre select{background:#fff;color:#1a1a1a;border:1px solid #9aa5b5;border-radius:6px;padding:4px 6px;font-size:12px;min-width:0}' +
        '.pd-cadre input[type=checkbox]{width:16px;height:16px}.pd-cadre label{color:#1a1a1a}' +
        '.pd-cadre table th{background:#1f5fbf;color:#fff;font-weight:600}.pd-cadre table td{border-bottom:1px solid #e3e8ef}' +
        '.pd-cadre button{background:#eef2f8;color:#1a1a1a;border:1px solid #9aa5b5;border-radius:6px;padding:4px 10px;cursor:pointer}' +
        '.pd-cadre button.p{background:#1f5fbf;color:#fff;border-color:#1f5fbf}'; document.head.appendChild(st); }
    cadre.innerHTML = '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b style="flex:1;font-size:16px">🧾 Bulletin détaillé (rubriques)</b>' +
      '<button type="button" class="s" data-x="mod">📄 Modèles</button><button type="button" class="s" data-x="pointage">⏱ Pointage</button><button type="button" class="s" data-x="simul">🧮 Simulation</button><button type="button" class="s" data-x="rub">⚙️ Rubriques</button><button type="button" class="s" data-x="exemple">Charger l\'exemple Sage</button><button type="button" class="s" data-x="close">✕ Fermer</button></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0"><label style="font-size:12px">Salarié<select data-emp style="width:240px"><option value="">— choisir la fiche —</option>' + employes.map(function (x, i) { return '<option value="' + i + '">' + echapper(x.nom) + '</option>'; }).join('') + '</select></label>' +
      '<label style="font-size:12px">N° CNPS (fiche)<input data-f="cnps" value="' + echapper(etat.cnps) + '" style="width:160px"></label>' +
      '<label style="font-size:12px">Nom affiché<input data-f="nom" value="' + echapper(etat.nom) + '" style="width:200px"></label>' +
      '<label style="font-size:12px">Matricule interne<input data-f="mat" value="' + echapper(etat.mat) + '" style="width:120px"></label>' +
      '<label style="font-size:12px">Période<input data-f="periode" value="' + echapper(etat.periode) + '" placeholder="ex. 01/07/26 au 31/07/26"></label>' +
      '<label style="font-size:12px">Employeur<input data-f="employeur" value="' + echapper(etat.employeur) + '"></label></div>' +
      '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px" data-tbl></table></div>' +
      '<div style="margin:8px 0;display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button type="button" class="s" data-x="add">+ Ajouter une rubrique vide</button>' +
      '<select data-cat style="font-size:12px"><option value="">+ Choisir dans le catalogue…</option></select>' +
      '<select data-cst style="font-size:12px"><option value="">+ Ajouter une constante…</option></select></div>' +
      '<div data-res style="border-top:1px solid #d6dbe3;padding-top:10px"></div>' +
      '<div style="display:flex;gap:8px;margin-top:10px"><button type="button" class="p" data-x="print">🖨️ Aperçu / imprimer</button></div>';
    ov.appendChild(cadre); document.body.appendChild(ov);
    function calcul() {
      var s = etat.saisies;
      var saisies = {};   // tout est calculé automatiquement par le moteur (aucune correction manuelle)
      if (s.plafondCFPat !== undefined && s.plafondCFPat !== '' && !isNaN(+s.plafondCFPat)) saisies.plafondCFPat = +s.plafondCFPat;
      if (s.baseCFC !== null && s.baseCFC !== '' && !isNaN(+s.baseCFC)) saisies.baseCFC = +s.baseCFC;
      if (tauxSage && Object.keys(tauxSage).length) saisies.taux = tauxSage;
      return PaieMoteur.calculer(etat.lignes, saisies);
    }
    function rendre() {
      var tbl = cadre.querySelector('[data-tbl]'), R = calcul();
      var entete = '<tr style="background:#1f5fbf;color:#fff"><th>Code</th><th>Rubrique</th><th>Nombre</th><th>Base</th><th>Taux %</th><th>Gain</th><th title="Imposable">Imposable</th><th title="Retenue : avance sur salaire, cantine, etc.">Retenue</th><th></th></tr>';
      var corps = etat.lignes.map(function (l, i) {
        var g = PaieMoteur.gainLigne(l);
        var c = function (k, v) { return '<td style="text-align:center"><input type="checkbox" data-l="' + i + '" data-k="' + k + '"' + (v ? ' checked' : '') + '></td>'; };
        var n = function (k, v, w) { return '<td><input data-l="' + i + '" data-k="' + k + '" type="number" step="any" value="' + (v == null ? '' : v) + '" style="width:' + w + 'px"></td>'; };
        return '<tr>' + '<td><input data-l="' + i + '" data-k="code" value="' + echapper(l.code) + '" style="width:60px"></td>' +
          '<td><input data-l="' + i + '" data-k="lib" value="' + echapper(l.lib) + '" style="width:200px"></td>' +
          n('nombre', l.nombre, 70) + n('base', l.base, 90) + n('taux', l.taux, 60) +
          '<td><input data-l="' + i + '" data-k="gain" type="number" step="any" value="' + (l.gain == null ? '' : l.gain) + '" style="width:100px" title="Saisir le gain, ou laisser vide pour nombre × base × taux"></td>' +
          c('irpp', l.irpp) + c('retenue', l.retenue) +
          '<td><button type="button" class="s" data-x="del" data-l="' + i + '">✕</button></td>' +
          '<td style="color:#666;font-size:11px">' + fmt(g) + '</td></tr>';
      }).join('');
      tbl.innerHTML = '<thead>' + entete + '</thead><tbody>' + corps + '</tbody>';
      var alertes = ((etat.mat ? [] : ['Matricule interne manquant : renseignez-le ici ou dans la fiche du salarié.']).concat(controles(R, etat.lignes, etat.cnps))).map(function (m) { return '<div class="ban" style="margin:4px 0">⚠ ' + echapper(m) + '</div>'; }).join('');
      cadre.querySelector('[data-res]').innerHTML = alertes + '<div style="display:flex;gap:18px;flex-wrap:wrap;font-size:13px"><span>Brut : <b>' + fmt(R.brut) + '</b></span>' +
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
    cadre.addEventListener('change', function (e) {
      if (e.target.dataset.k && (e.target.type === 'checkbox')) rendre();
      if (e.target.dataset.emp !== undefined) {
        var fiche = employes[+e.target.value];
        if (fiche) {
          etat.nom = fiche.nom; etat.mat = fiche.mat || ''; etat.cnps = fiche.cnps || ''; etat.lieu = fiche.lieu || '';
          // Salaire de base de la fiche : ligne 1000 = horaire × base horaire (salaire ÷ horaire), comme Sage
          if (fiche.sb) {
            var hor = Number(fiche.hor) || 173.33, b1000 = etat.lignes.filter(function (l) { return String(l.code) === '1000'; })[0];
            if (b1000) { b1000.nombre = hor; b1000.base = Number(fiche.sb) / hor; b1000.gain = null; }
          } var an = (window.PaieMoteur && PaieMoteur.ancienneteDepuis) ? PaieMoteur.ancienneteDepuis(fiche.entree, new Date()) : null; etat.anciennete = an ? an.texte : '';
          cadre.querySelector('[data-f="nom"]').value = etat.nom;
          cadre.querySelector('[data-f="cnps"]').value = etat.cnps;
          var mi = cadre.querySelector('[data-f="mat"]'); if (mi) mi.value = etat.mat;
          rendre();
        }
      }
    });
    cadre.addEventListener('click', function (e) {
      var b = e.target.closest('[data-x]'); if (!b) return;
      var x = b.dataset.x;
      if (x === 'close') ov.remove();
      else if (x === 'add') { etat.lignes.push({ code: '', lib: 'Nouvelle rubrique', nombre: null, base: null, taux: null, gain: 0, cnps: false, cfc: false, irpp: true, retenue: false }); rendre(); }
      else if (x === 'del') { etat.lignes.splice(+b.dataset.l, 1); rendre(); }
      else if (x === 'cat') { }
      else if (x === 'rub') { openRubriques(); }
      else if (x === 'pointage') {
        if (!root.PaiePointage) { alert('paie-pointage-simulation.js n\'est pas chargé.'); }
        else { var fiche = employes.filter(function (f) { return f.nom === etat.nom; })[0];
          root.PaiePointage.ouvrir({ employes: employes, periode: etat.periode, courant: fiche ? (fiche.mat || fiche.nom) : '', onApply: appliquerPointage }); }
      }
      else if (x === 'simul') { if (root.PaieSimulation) root.PaieSimulation.ouvrir({ lignes: etat.lignes, saisies: { taux: tauxSage || {} }, nom: etat.nom }); else alert('paie-pointage-simulation.js n\'est pas chargé.'); }
      else if (x === 'mod') { if (root.PaieModeles) root.PaieModeles.ouvrir(); else alert('paie-modeles.js n\'est pas chargé.'); }
      else if (x === 'exemple') { etat.lignes = EXEMPLE.map(function (l) { return Object.assign({}, l); }); rendre(); }
      else if (x === 'print') {
        var R = calcul();
        var html = bulletinHTML({ modele: (root.PaieModeles && root.PaieModeles.actif) ? root.PaieModeles.actif() : null, bulletin: etat.bulletin, nom: etat.nom, mat: etat.mat, cnps: etat.cnps, lieu: etat.lieu, anciennete: etat.anciennete, periode: etat.periode, employeur: etat.employeur, lignes: etat.lignes, saisies: Object.assign({}, etat.saisies, { taux: tauxSage || {} }), resultat: R });
        if (typeof root.printHTML === 'function') root.printHTML('Bulletin de paie', html, cssBulletin(etat.bulletin), { apercu: true });
      }
    });
    if (root.PaieRubriques && root.PaieRubriques.synchroniser) {
      root.PaieRubriques.synchroniser().then(function (liste) {
        if (!liste) return;
        catalogue.splice(0, catalogue.length); liste.forEach(function (x) { catalogue.push(x); });
        root.PAIE_RUB_CACHE = catalogue; refreshCat();
      });
    }
    var sel = cadre.querySelector('[data-cat]');
    catalogue.forEach(function (r, i) {
      var o = document.createElement('option'); o.value = String(i); o.textContent = r.code + ' — ' + r.libelle + (r.type === 'retenue' ? ' (retenue)' : '');
      sel.appendChild(o);
    });
    var selCst = cadre.querySelector('[data-cst]');
    (opts && opts.constantes || []).forEach(function (c, i) {
      var o = document.createElement('option'); o.value = String(i); o.textContent = c.code + ' — ' + c.libelle + ' (' + c.valeur + ')';
      selCst.appendChild(o);
    });
    selCst.addEventListener('change', function () {
      var c = (opts && opts.constantes || [])[+selCst.value]; if (!c) return;
      etat.lignes.push({ code: c.code.replace(/^cst_/, '').toUpperCase(), lib: c.libelle, nombre: 1, base: c.valeur, taux: 100,
        gain: null, cnps: false, cfc: false, irpp: true, retenue: false });
      selCst.value = ''; rendre();
    });
    sel.addEventListener('change', function () {
      var r = catalogue[+sel.value]; if (!r) return;
      etat.lignes.push({ code: r.code, lib: r.libelle, nombre: null, base: null, taux: r.taux_defaut,
        gain: null, cnps: !!r.cnps, cfc: !!r.cfc, irpp: r.imposable !== false, retenue: r.type === 'retenue',
        transport: !!r.transport, logement: !!r.logement, heures_sup: !!r.heures_sup });
      sel.value = ''; rendre();
    });
    rendre();
  }
  // Contrôles affichés avant impression : plafond CNPS, net négatif, brut nul, retenues supérieures au brut
  function controles(R, lignes, cnps) {
    var msg = [];
    if (!R) return msg;
    if (!String(cnps || '').trim()) msg.push('N° CNPS manquant : il est lu sur la fiche du salarié.');
    if (R.brut <= 0) msg.push('Brut nul : aucune rubrique de gain n\'est saisie.');
    if (R.net < 0) msg.push('Net négatif : les retenues dépassent le brut. Vérifiez les avances et les retenues.');
    if (R.totalRetenues > R.brut && R.brut > 0) msg.push('Retenues supérieures au brut.');
    if (R.netImposable > R.brut) msg.push('Net imposable supérieur au brut : vérifiez les cases « imposable ».');
    var base = R.netImposable - (lignes || []).filter(function (l) { return String(l.code) === '1430'; }).reduce(function (t, l) { return t + (typeof l.gain === 'number' ? l.gain : 0); }, 0);
    if (base > 750000) msg.push('Base CNPS au-delà de 750 000 : cotisation plafonnée à 31 500 (4,2 %).');
    return msg;
  }
  var API = { periodeMoisCourant: periodeMoisCourant, controles: controles, EXEMPLE: EXEMPLE, bulletinHTML: bulletinHTML, ouvrir: ouvrir, fmt: fmt };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.PaieDetail = API;
})(typeof window !== 'undefined' ? window : globalThis);
