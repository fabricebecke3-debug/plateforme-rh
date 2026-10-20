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
    var M = Object.assign({ afficherPatronales: true, afficherPied: true, pied: '', couleur: '', blocs: ['entete', 'salarie', 'rubriques', 'pied'], colonnes: {}, logo: '', logoPos: 'gauche', rubriques: [] }, o.modele || {});
    var C = Object.assign({ nombre: true, base: true, taux: true, retenuePatronale: true }, M.colonnes || {});
    var T = Object.assign({ cnps_sal: 4.2, cnps_pat: 4.2, at_pat: 2.5, pf_pat: 7, fne_pat: 1, cfc_sal: 1, cfc_pat: 1.5, cac: 10, plafond_cnps: 750000 }, s.taux || {});
    var b = o.bulletin || {}, couleur = M.couleur || b.couleur || '#1f5fbf';
    var sal = R.salariales, pat = R.patronales;
    var pc = function (v) { return String(v).replace('.', ',') + ' %'; };
    var thB = function (t, al) { return '<th style="padding:4px 6px;border-bottom:2px solid #333;text-align:' + (al || 'right') + '">' + t + '</th>'; };
    var tdB = function (t, al) { return '<td style="padding:3px 6px;border-bottom:1px solid #ddd;text-align:' + (al || 'right') + '">' + t + '</td>'; };

    // Rubriques de gain : ordre et choix du modèle (une rubrique décochée reste dans le calcul)
    var gains = lignes.map(function (l, i) { return { l: l, gain: (R.rubriques && R.rubriques[i]) ? R.rubriques[i].gain : (l.gain || 0) }; });
    if (M.rubriques && M.rubriques.length) {
      gains = M.rubriques.map(function (code) { return gains.filter(function (g) { return String(g.l.code) === String(code); })[0]; }).filter(Boolean);
    }
    var nbCols = 2 + (C.nombre ? 1 : 0) + (C.base ? 1 : 0) + (C.taux ? 1 : 0) + 1;
    var rubriques = '<table style="width:100%;border-collapse:collapse;margin-bottom:8px"><thead><tr>' + thB('N°', 'left') + thB('Désignation', 'left') +
      (C.nombre ? thB('Nombre') : '') + (C.base ? thB('Base') : '') + (C.taux ? thB('Taux') : '') + thB('Gain') + '</tr></thead><tbody>' +
      gains.map(function (g) {
        var l = g.l;
        return '<tr>' + tdB(echapper(l.code), 'left') + tdB(echapper(l.lib), 'left') +
          (C.nombre ? tdB(l.nombre != null && l.nombre !== '' ? fmt(l.nombre) : '') : '') +
          (C.base ? tdB(l.base != null && l.base !== '' ? fmt(l.base) : '') : '') +
          (C.taux ? tdB(l.taux != null && l.taux !== '' ? echapper(l.taux) + ' %' : '') : '') +
          tdB(fmt(g.gain)) + '</tr>';
      }).join('') +
      '<tr style="font-weight:700">' + tdB('', 'left') + tdB('Total brut', 'left') + (C.nombre ? tdB('') : '') + (C.base ? tdB('') : '') + (C.taux ? tdB('') : '') + tdB(fmt(R.brut)) + '</tr></tbody></table>';

    // Tableaux de retenues et de charges
    var tableCot = function (titre, rows) {
      if (!rows.length) return '';
      return '<table style="width:100%;border-collapse:collapse;margin-bottom:8px"><thead><tr>' + thB(titre, 'left') +
        (C.base ? thB('Base') : '') + (C.taux ? thB('Taux') : '') + thB('Montant') + '</tr></thead><tbody>' +
        rows.map(function (r) { return '<tr>' + tdB(echapper(r[0]), 'left') + (C.base ? tdB(r[1] != null ? fmt(r[1]) : '') : '') + (C.taux ? tdB(r[2] != null ? pc(r[2]) : '') : '') + tdB(fmt(r[3])) + '</tr>'; }).join('') +
        '</tbody></table>';
    };
    var retRows = [['CNPS pension vieillesse', R.baseCNPS, T.cnps_sal, sal.cnps], ['Crédit foncier salarial', R.saltaxf, T.cfc_sal, sal.cfc],
      ['IRPP', null, null, sal.irpp], ['CAC sur IRPP', sal.irpp, T.cac, sal.cac]];
    if (sal.redevance) retRows.push(['Redevance audiovisuelle', null, null, sal.redevance]);
    if (sal.taxeCommunale) retRows.push(['Taxe communale', null, null, sal.taxeCommunale]);
    if (sal.taxeDevLocal) retRows.push(['Taxe de développement local', null, null, sal.taxeDevLocal]);
    if (sal.taxeProp) retRows.push(['Taxe proportionnelle', null, null, sal.taxeProp]);
    var libelleDe = function (code) { var l = lignes.filter(function (x) { return String(x.code) === String(code); })[0]; return (l && l.lib) || ('Rubrique ' + code); };
    var divRows = (R.rubriques || []).filter(function (r) { return r.retenue; }).map(function (r) { return [libelleDe(r.code), null, null, r.gain]; });
    var patRows = [['CNPS pension vieillesse', R.baseCNPS, T.cnps_pat, pat.cnps], ['CNPS accidents du travail', R.baseCNPS, T.at_pat, pat.at],
      ['CNPS prestations familiales', R.baseCNPS, T.pf_pat, pat.pf], ['Fonds national de l\'emploi', R.baseCNPS, T.fne_pat, pat.fne],
      ['Crédit foncier patronal', R.saltaxf, T.cfc_pat, pat.cfc]];
    var rubriquesBloc = rubriques + tableCot('Retenues salariales', retRows) + tableCot('Retenues diverses', divRows) +
      ((M.afficherPatronales && C.retenuePatronale) ? tableCot('Charges patronales', patRows) : '');

    // En-tête : logo, employeur, titre ; position du logo choisie dans le modèle
    var logoOk = M.logo && /^data:image\//.test(M.logo) && M.logoPos !== 'aucun';
    var logoHtml = logoOk ? '<img src="' + M.logo + '" alt="Logo" style="max-height:70px;max-width:200px">' : '';
    var identite = '<div style="font-size:11px;line-height:1.4"><b>' + echapper(b.societe || o.employeur || '') + '</b>' +
      (b.adresse ? '<br>' + echapper(b.adresse) : '') + (b.siret ? '<br>N° SIRET : ' + echapper(b.siret) : '') +
      (b.cnps ? '<br>N° CNPS employeur : ' + echapper(b.cnps) : '') + '</div>';
    var titre = '<div style="text-align:right;font-size:16px;font-weight:700;color:' + echapper(couleur) + '">BULLETIN DE PAIE' +
      '<div style="font-size:11px;color:#333;font-weight:400">Période : ' + echapper(o.periode || '') + '<br>Paiement : ' + echapper(o.paiement || '') + '</div></div>';
    var cellules = { gauche: [logoHtml, identite, titre], centre: [identite, logoHtml, titre], droite: [identite, titre, logoHtml], aucun: [identite, '', titre] }[M.logoPos] || [logoHtml, identite, titre];
    var entete = '<table style="width:100%;border-collapse:collapse;margin-bottom:8px;border-bottom:3px solid ' + echapper(couleur) + '"><tr>' +
      cellules.map(function (c) { return '<td style="vertical-align:top;width:33%;padding-bottom:6px">' + c + '</td>'; }).join('') + '</tr></table>';

    var salarie = '<p style="margin:6px 0;border:1px solid #bbb;padding:6px"><b>' + echapper(o.nom || '') + '</b> · Matricule interne : ' + echapper(o.mat || '—') +
      ' · N° CNPS : ' + echapper(o.cnps || '—') + (o.lieu ? ' · Lieu : ' + echapper(o.lieu) : '') + (o.anciennete ? ' · Ancienneté : ' + echapper(o.anciennete) : '') + '</p>';

    var cumuls = '<table style="width:100%;border-collapse:collapse;margin:8px 0;font-size:11px"><tr>' +
      thB('Net imposable') + thB('Base CNPS') + thB('Base taxable') + thB('Total retenues') + thB('Charges patronales') + '</tr><tr>' +
      tdB(fmt(R.netImposable)) + tdB(fmt(R.baseCNPS)) + tdB(fmt(R.saltaxf)) + tdB(fmt(R.totalRetenues)) + tdB(fmt(R.totalPatronales)) + '</tr></table>';
    var net = '<p style="font-size:20px;font-weight:700;margin:10px 0 4px;color:' + echapper(couleur) + '">NET À PAYER : ' + fmt(R.net) + ' FCFA</p>' +
      '<p style="margin:0 0 6px">Coût total employeur : ' + fmt(R.coutEmployeur) + ' FCFA</p>';
    var legal = M.afficherPied
      ? '<div style="font-size:10px;color:#444;margin-top:10px;border-top:1px solid #ccc;padding-top:6px"><b>Pour lire ce bulletin :</b> ' +
        'CNPS pension : ' + pc(T.cnps_sal) + ' de la base, plafonnée à ' + fmt(T.plafond_cnps) + '. IRPP : impôt progressif retenu à la source par l\'employeur. ' +
        'CAC : ' + pc(T.cac) + ' de l\'IRPP. Crédit foncier : ' + pc(T.cfc_sal) + ' de la base taxable. ' +
        'Redevance audiovisuelle : forfaitaire selon la tranche de brut.' + (M.pied ? ' ' + echapper(M.pied) : '') + '</div>'
      : (M.pied ? '<div style="font-size:10px;margin-top:10px">' + echapper(M.pied) + '</div>' : '');
    var pied = cumuls + net + legal;

    var blocs = { entete: entete, salarie: salarie, rubriques: rubriquesBloc, pied: pied };
    var ordre = (M.blocs && M.blocs.length) ? M.blocs : ['entete', 'salarie', 'rubriques', 'pied'];
    return '<div style="font-family:Arial,sans-serif;font-size:11px;color:#000">' + ordre.map(function (k) { return blocs[k] || ''; }).join('') + '</div>';
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
    var employes = (opts && opts.employes && opts.employes.length) ? opts.employes : ((root.TERH_listeSalaries && root.TERH_listeSalaries()) || []);
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
