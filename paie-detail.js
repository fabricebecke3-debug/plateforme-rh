/* paie-detail.js — Bulletin détaillé en rubriques (style Sage).
 * Saisie : code, rubrique, nombre, base, taux, gain et cases cotisable CNPS / crédit foncier / imposable.
 * Les cotisations se calculent via paie-moteur.js. Les données ne sont pas enregistrées (session en cours).
 * Fonctions de rendu pures testées par scripts/test-paie-detail.js.
 */
(function (root) {
  'use strict';
  var EXEMPLE = [
    { code: '1000', lib: 'Salaire de base', nombre: 173.33, base: 474.88, taux: null, gain: 82311, cnps: true, cfc: true, irpp: true },
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
  function esc(t) { return echapper(t); }
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
    var M = Object.assign({ afficherPatronales: true, afficherPied: true, afficherCout: false, pied: '', couleur: '', blocs: ['entete', 'salarie', 'rubriques', 'pied'], colonnes: {}, logo: '', logoPos: 'gauche', rubriques: [] }, o.modele || {});
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
    var identite = '<div style="font-size:11px;line-height:1.4"><b>' + echapper(o.employeur || b.societe || '') + '</b>' +
      (b.adresse ? '<br>' + echapper(b.adresse) : '') (b.siret ? '<br>N° SIRET : ' + echapper(b.siret) : '') +
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
      (M.afficherCout !== true ? '' : '<p style="margin:0 0 6px">Coût total employeur : ' + fmt(R.coutEmployeur) + ' FCFA</p>');
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
  // Style du bulletin : celui de PaieBulletinSage (densité Sage) ; repli sur un style minimal si le fichier n'est pas chargé
  function cssBulletin(b) {
    var c = (b && b.couleur) || '#1f5fbf';
    if (root.PaieBulletinSage && root.PaieBulletinSage.css) return root.PaieBulletinSage.css(c);
    return 'table td,table th{border:1px solid #999;padding:1px 4px;color:#000;line-height:1.2}table th{background:' + c + ';color:#fff}' +
      'table tr td:first-child{white-space:nowrap}';
  }
  // Rubrique du catalogue Sage (paie-rubriques-sage.js) au format du catalogue de la société
  function rubriqueSage(s) {
    return { code: String(s.code), libelle: s.libelle || '', type: 'gain', source: 'Sage',
      imposable: s.imposable !== 'Jms', cnps: false, cfc: false, taux_defaut: null, heures_sup: false };
  }
  // Catalogue affiché = rubriques de la société, puis les rubriques Sage absentes (même code : la société prime)
  // Rubrique du modèle Océan : codes 1, 2, 3, 4… (ne pas mélanger avec le catalogue Sage)
  // Suggestions du catalogue Sage (même libellés) avec les codes de l'Hôtel Océan (30 et suivants, codes libres)
  var CALC_OCEAN_RE = /irpp|cnps|\bcac\b|foncier|\brav\b|taxe|tdl|salaire de base|logement|assiduit|transport|anciennet|cong[ée]|dettes|avance|rappel|prestations? fam\w*|communard|fonds national|rappels?/i;
  function suggestionsOcean(sage, exclus) {
    var out = [], vus = Object.assign({}, exclus || {});
    sage.forEach(function (s) {
      var lib = String(s.libelle || '').trim(), k = lib.toLowerCase();
      if (!lib || CALC_OCEAN_RE.test(lib) || EQUIV_SAGE_OCEAN[String(s.code)] || vus[k]) return;
      vus[k] = true;
      out.push({ code: '', libelle: lib, type: s.type || 'gain', source: 'Océan', imposable: s.imposable !== false,
        cnps: true, cfc: true, taux_defaut: null, heures_sup: false, sugg: true });
    });
    return out;
  }
  function rubriqueOcean(o) {
    return { code: String(o.code), libelle: o.lib || '', type: o.type || 'gain', source: 'Océan',
      imposable: true, cnps: false, cfc: false, taux_defaut: null, heures_sup: false };
  }
  // Rubrique Sage déjà calculée par le modèle Hôtel Océan (1430, 1435, 1510, 1202) : code Océan à utiliser
  // Codes réservés au modèle Hôtel Océan (calculés ou fixes) : une rubrique libre ne peut pas les reprendre
  var CODES_OCEAN_RESERVES = ['1','2','3','4','5','10','11','12','13','14','15','17','22','26','27','28','29'];
  // Codes du modèle (1 à 29) réservés ; les codes à 4 chiffres (1000, 1430…) ne sont pas utilisés sur le bulletin Hôtel Océan
  function T(t, v) {
    if (root.PaieI18n && root.PaieI18n.T) return root.PaieI18n.T(t, v);
    var o = t; if (v) Object.keys(v).forEach(function (x) { o = o.split('{' + x + '}').join(v[x]); }); return o;
  }
  function codeReserve(code) { return CODES_OCEAN_RESERVES.indexOf(String(code || '').trim()) >= 0; }
  // Code à 4 chiffres (1000, 1430…) : renuméroté au premier code libre à partir de 30
  function codeSage(code) { var c = String(code || '').trim(); return /^\d+$/.test(c) && parseInt(c, 10) >= 1000; }
  // Rubriques libres : codes 30, 31, 32… (1 à 29 réservés au modèle Hôtel Océan)
  function codeLibreSuivant(lignes) {
    var utilises = {};
    (lignes || []).forEach(function (l) { utilises[String(l.code)] = true; });
    if (root.PaieHok && root.PaieHok.rubriquesOcean) { var roC = root.PaieHok.rubriquesOcean(); roC.auto.concat(roC.ajoutees, roC.catalogue).forEach(function (r) { utilises[String(r.code)] = true; }); }
    ELEMENTS_FICHE.forEach(function (e) { utilises[String(e.code)] = true; });
    var n = 30;
    while (utilises[String(n)]) n++;
    return String(n);
  }
  // Rubriques Sage déjà calculées par le modèle Hôtel Océan : doublons interdits (code 1000 = salaire, 1430 = transport…)
  var EQUIV_SAGE_OCEAN = { '1000': '1', '1435': '2', '1510': '3', '1430': '4', '1202': '5' };
  // Liste des salariés : tri alphabétique et filtre par nom (utilisé par le sélecteur et la recherche)
  function optionsSalaries(q, selIdx) {
    var v = String(q || '').trim().toLowerCase();
    var liste = window.__employesBulletin || [];
    var idx = liste.map(function (x, i) { return i; }).filter(function (i) {
      return !v || String(liste[i].nom || '').toLowerCase().indexOf(v) >= 0;
    });
    idx.sort(function (a, b) { return String(liste[a].nom || '').localeCompare(String(liste[b].nom || ''), 'fr'); });
    return '<option value="">— choisir la fiche —</option>' + idx.map(function (i) {
      return '<option value="' + i + '"' + (String(i) === String(selIdx) ? ' selected' : '') + '>' + echapper(liste[i].nom) + '</option>';
    }).join('');
  }
  function equivOcean(code) { return !!(EQUIV_SAGE_OCEAN[String(code)] || (root.PaieHok && root.PaieHok.EQUIV_OCEAN && root.PaieHok.EQUIV_OCEAN[String(code)])); }
  function fusionCatalogue(liste, ocean) {
    var perso = (liste || []).slice(), codes = {};
    perso.forEach(function (r) { codes[String(r.code)] = true; });
    if (ocean) {
      var oc = (root.PaieHok && root.PaieHok.rubriquesOcean) ? root.PaieHok.rubriquesOcean().catalogue : [];
      var sage = ((root.PaieSageCatalogue && root.PaieSageCatalogue.rubriques) || []).map(rubriqueSage);
      var modeles = oc.map(rubriqueOcean), libsModele = {};
      modeles.forEach(function (r) { libsModele[String(r.libelle).trim().toLowerCase()] = true; });
      var libres = perso.filter(function (r) {
        var lib = String(r.libelle || '').trim().toLowerCase();
        return !codeReserve(r.code) && !codeSage(r.code) && !CALC_OCEAN_RE.test(lib) && !libsModele[lib];
      }).map(function (r) { return Object.assign({}, r, { sugg: true }); });
      var exclus = {};
      libres.forEach(function (r) { exclus[String(r.libelle || '').trim().toLowerCase()] = true; });
      return libres.concat(suggestionsOcean(sage, exclus));   // rubriques du modèle : jamais proposées (déjà calculées)
    }
    var sage = ((root.PaieSageCatalogue && root.PaieSageCatalogue.rubriques) || []).map(rubriqueSage);
    return perso.concat(sage.filter(function (s) { return !codes[s.code]; }));
  }
  function ouvrir(opts) {
    var bulletinSociete = (opts && opts.bulletin) || null;
    // Réglages de la structure (risque AT, base FNE) prioritaires sur les taux par défaut
    var tauxSage = Object.assign({}, (opts && opts.taux) || {}, (root.PRH_tauxEntreprise ? root.PRH_tauxEntreprise() : {}));
    var perso = (opts && opts.rubriques && opts.rubriques.length) ? opts.rubriques.slice() : ((root.PaieRubriques && root.PaieRubriques.charger) ? root.PaieRubriques.charger() : []);
    var catalogue = fusionCatalogue(perso, false);
    // Modèle du salarié courant (Sage ou Océan) : le catalogue suit ce modèle
    function modeleOcean() {
      try {
        var m = (root.PaieModeles && root.PaieModeles.pourSalarie) ? root.PaieModeles.pourSalarie(etat.fiche, etat.employeur) : null;
        return !!(m && m.gabarit === 'ocean');
      } catch (e) { return false; }
    }
    if (root.PaieModeles) root.PaieModeles.synchroniser();
    if (root.PaieHok && root.PaieHok.synchroniser) root.PaieHok.synchroniser();
    function refreshCat() { var dl = cadre.querySelector('#pd-cat-list'); if (!dl) return; dl.innerHTML = '';
      if (estOcean()) {
        var pris = {}, calc = []; try { calc = calculOcean().lignes; } catch (e) { calc = []; }
        etat.lignes.concat(calc).forEach(function (x) { pris[String(x.code)] = true; });
        catalogue.forEach(function (r) { if (!r.sugg) pris[String(r.code)] = true; });
        var nC = 30;
        catalogue.forEach(function (r) {
          if (!r.sugg) return;
          while (pris[String(nC)] || CODES_OCEAN_RESERVES.indexOf(String(nC)) >= 0) nC++;
          r.code = String(nC); pris[String(nC)] = true; nC++;
        });
      }
      catalogue.forEach(function (r) { var o = document.createElement('option'); o.value = r.code + ' — ' + (r.libelle || ''); dl.appendChild(o); }); }
    function reconstruireCatalogue() { catalogue.splice(0, catalogue.length); fusionCatalogue(perso, modeleOcean()).forEach(function (r) { catalogue.push(r); }); root.PAIE_RUB_CACHE = perso; refreshCat(); }
    function openRubriques() { if (!root.PaieRubriques) { alert('paie-rubriques.js n\'est pas chargé.'); return; }
      root.PaieRubriques.ouvrir(perso, function (liste) { perso = liste; reconstruireCatalogue(); }); }
    // Rubrique ajoutée à la main : visible tout de suite (bas) et affichée sur le bulletin (haut, Océan)
    function nouvelleAffichee(i) {
      var l = etat.lignes[i];
      if (!l) return;
      l.ajoutee = true;
      etat.focus = i;
      if (estOcean() && root.PaieHok && root.PaieHok.afficherRubrique && String(l.code || '') !== '') {
        var nom = (etat.fiche && etat.fiche.nom) || etat.nom || '';
        root.PaieHok.afficherRubrique(nom, etat.periode, String(l.code), true);
      }
    }
    function ajouterRubrique(r) {
      if (estOcean() && r.source === 'Océan' && codeReserve(r.code)) {
        alert('La rubrique ' + r.code + ' (' + r.libelle + ') est calculée par le modèle Hôtel Océan. Utilisez « Modifier » dans le tableau du haut si une correction est nécessaire.');
        return;
      }
      if (estOcean() && (r.modele || EQUIV_SAGE_OCEAN[String(r.code)])) { var cibO = r.modele || EQUIV_SAGE_OCEAN[String(r.code)]; alert('Cette rubrique est déjà calculée par le modèle Hôtel Océan (code ' + cibO + '). Elle n\'est pas ajoutée une deuxième fois : utilisez « Modifier » si une correction est nécessaire.'); return; }
      if (estOcean() && (codeSage(r.code) || etat.lignes.some(function (x) { return String(x.code) === String(r.code); }))) { var nouveauO = codeLibreSuivant(etat.lignes); alert('Le code ' + r.code + ' devient ' + nouveauO + ' (codes du bulletin à partir de 30).'); r = Object.assign({}, r, { code: nouveauO }); }
      if (estOcean() && codeReserve(r.code)) { alert('Le code ' + r.code + ' est déjà utilisé par le modèle Hôtel Océan. Choisissez un autre code.'); return; }
      if (r.source === 'Océan' && etat.lignes.some(function (l) { return String(l.code) === String(r.code); })) {
        alert('Le code ' + r.code + ' est déjà présent sur ce bulletin : corrigez-le avec « Modifier » ou « Éléments ».'); return;
      }
      etat.lignes.push({ code: r.code, lib: r.libelle, nombre: null, base: null, taux: (r.taux_defaut != null ? r.taux_defaut : null),
        gain: null, cnps: !!r.cnps, cfc: !!r.cfc, irpp: r.imposable !== false, retenue: r.type === 'retenue',
        transport: !!r.transport, logement: !!r.logement, heures_sup: !!r.heures_sup });
      nouvelleAffichee(etat.lignes.length - 1);
      rendre();
    }
    // Prime d'ancienneté (rubrique 1202) : taux selon les années révolues, base = salaire catégoriel (rubrique 1000)
    function ajouterAnciennete() {
      var f = etat.fiche || {}, an = (root.PaieMoteur && PaieMoteur.ancienneteFiche) ? PaieMoteur.ancienneteFiche(f, new Date()) : null;
      if (!an) { alert('Date d\'entrée ou d\'ancienneté absente de la fiche (et aucune ancienneté dans le fichier du personnel) : ancienneté impossible à calculer.'); return; }
      var b1000 = etat.lignes.filter(function (l) { return String(l.code) === '1000'; })[0];
      if (!b1000) { alert('Pas de salaire de base (rubrique 1000).'); return; }
      var salaire = PaieMoteur.gainLigne(b1000), taux = PaieMoteur.tauxAnciennete(an.ans);
      var lig = etat.lignes.filter(function (l) { return String(l.code) === '1202'; })[0];
      if (!lig) { lig = { code: '1202', lib: 'Prime d\'ancienneté', nombre: 1, base: 0, taux: 0, gain: null, cnps: true, cfc: true, irpp: true, retenue: false }; etat.lignes.push(lig); }
      lig.nombre = 1; lig.base = salaire; lig.taux = taux; lig.gain = null;
      rendre();
      if (taux === 0) alert('Ancienneté : ' + an.texte + '. Seuil de 2 ans non atteint : prime à 0 %.');
    }
    // Fiche salarié transmise au bulletin Sage (en-tête : matricule, niveau, coefficient, indice, emploi, dates…)
    function salarieSage() {
      var f = etat.fiche || {};
      return { matricule: etat.mat, niveau: f.niveau, coefficient: f.coef, indice: f.indice, anciennete: etat.anciennete,
        secu: etat.cnps, categorie: f.categorie, emploi: f.poste, departement: f.dept, qualification: f.qualif,
        horaire: f.hor || 173.33, convention: f.convention || (etat.bulletin && etat.bulletin.ccn) || '',
        adresse: f.adresse, embauche: f.entree, lieu: etat.lieu, etablissement: f.etablissement, nom: etat.nom };
    }
    var etat = { lignes: (opts && opts.lignes) ? opts.lignes.slice() : [{ code: '1000', lib: 'Salaire de base', nombre: null, base: null, taux: null, gain: null, cnps: true, cfc: true, irpp: true }],
      saisies: {}, nom: (opts && opts.nom) || '', mat: (opts && opts.mat) || '', cnps: (opts && opts.cnps) || '', lieu: (opts && opts.lieu) || '', periode: (opts && opts.periode) || periodeMoisCourant(), employeur: (opts && opts.employeur) || '' };
    // Une seule source pour tous les points d'entrée : fiche + matricule + CNPS (index.html)
    var employes = root.PRH_fichesPaie ? root.PRH_fichesPaie() : ((opts && opts.employes) || []);
    window.__employesBulletin = employes;
    function indexSalarie() { return employes.findIndex(function (x) { return etat.fiche && String(x.id) === String(etat.fiche.id); }); }
    etat.bulletin = bulletinSociete;
    // Employeur : société mère (mise à disposition) ou société simple, à défaut le nom de la société active
    if (!etat.employeur) etat.employeur = (bulletinSociete && bulletinSociete.societe) || (opts && opts.employeur) || '';
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,14,20,.6);z-index:2147483400;display:flex;align-items:flex-start;justify-content:center;padding:16px;overflow:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain';
    ov.setAttribute('data-fenetre', 'defile');
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) e.stopImmediatePropagation(); });
    var cadre = document.createElement('div');
    cadre.className = 'pd-cadre';
    // Fenêtre entière dans l'écran : le contenu défile à l'intérieur, la barre du haut et le pied restent visibles
    cadre.style.maxHeight = 'calc(100vh - 24px)';
    cadre.style.overflowY = 'auto';
    cadre.style.boxSizing = 'border-box';
    cadre.style.cssText = 'background:#fff;color:#1a1a1a;max-width:1000px;width:100%;border-radius:12px;padding:16px;box-sizing:border-box';
    if (!document.getElementById('pd-style')) { var st = document.createElement('style'); st.id = 'pd-style';
      st.textContent = '.pd-cadre input,.pd-cadre select{background:#fff;color:#1a1a1a;border:1px solid #9aa5b5;border-radius:6px;padding:4px 6px;font-size:12px;min-width:0}' +
        '.pd-cadre input[type=checkbox]{width:16px;height:16px}.pd-cadre label{color:#1a1a1a}' +
        '.pd-cadre table th{background:#1f5fbf;color:#fff;font-weight:600}.pd-cadre table td{border-bottom:1px solid #e3e8ef;padding:1px 3px;height:18px;line-height:1.15;font-size:11px}.pd-cadre table th{padding:4px;font-size:11px;white-space:nowrap}.pd-cadre table td input{height:18px;padding:1px 4px;font-size:11px;box-sizing:border-box}' +
        '.pd-cadre button{background:#eef2f8;color:#1a1a1a;border:1px solid #9aa5b5;border-radius:6px;padding:4px 10px;cursor:pointer}' +
        '.pd-cadre button.p{background:#1f5fbf;color:#fff;border-color:#1f5fbf}' + '.pd-cadre tr.pd-entete th{background:#3d4550;color:#fff}'+
        '.pd-cadre table.pd-tbl,.pd-cadre table{min-width:0!important;width:100%}' +
        '.pd-cadre .pd-scroll{overflow-x:auto;width:100%;max-width:100%;scrollbar-width:auto;scrollbar-color:#8a94a6 #e6e9ef;-webkit-overflow-scrolling:touch}' +
        '.pd-cadre .pd-scroll::-webkit-scrollbar{height:12px}.pd-cadre .pd-scroll::-webkit-scrollbar-track{background:#e6e9ef;border-radius:6px}.pd-cadre .pd-scroll::-webkit-scrollbar-thumb{background:#8a94a6;border-radius:6px}' +
        '.pd-cadre td,.pd-cadre th{user-select:text;-webkit-user-select:text}' +
        '.pd-cadre tbody tr:hover td{background:#eef4fc!important;color:#1a1a1a!important}' +
        '.pd-cadre tbody tr.pd-sel td{background:#fff1b8!important;color:#1a1a1a!important;font-weight:600;box-shadow:inset 0 2px 0 #1f5fbf,inset 0 -2px 0 #1f5fbf}' +
        '.pd-cadre tbody tr td input{background:#fff;color:#1a1a1a}'; document.head.appendChild(st); }
    cadre.innerHTML = '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b style="flex:1;font-size:16px">🧾 Bulletin détaillé (rubriques)</b>' +
      '<button type="button" class="s" data-x="mod">📄 Modèles</button><button type="button" class="s" data-x="livre">📚 Livre de paie</button><button type="button" class="s" data-x="simul">🧮 Simulation</button><button type="button" class="s" data-x="cst">Constantes Sage</button><button type="button" class="s" data-x="anc">Prime d’ancienneté</button><button type="button" class="s" data-x="fiche">Composants de la fiche</button><button type="button" class="s" data-x="rub">⚙️ Rubriques</button><button type="button" class="s" data-x="liste">📋 Liste des rubriques</button><button type="button" class="s" data-x="exemple">Exemple</button><button type="button" class="s" data-x="close">✕ Fermer</button></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0;align-items:center"><label style="font-size:12px">Salarié<input data-empq placeholder="Rechercher un nom…" style="width:170px;margin-left:6px"></label><label style="font-size:12px"><select data-emp style="width:320px">' + optionsSalaries('', indexSalarie()) + '</select></label>' +
      '<label style="font-size:12px">N° CNPS (fiche)<input data-f="cnps" value="' + echapper(etat.cnps) + '" style="width:160px"></label>' +
      '<label style="font-size:12px">Nom affiché<input data-f="nom" value="' + echapper(etat.nom) + '" style="width:200px"></label>' +
      '<label style="font-size:12px">Matricule interne<input data-f="mat" value="' + echapper(etat.mat) + '" style="width:120px"></label>' +
      '<label style="font-size:12px">Période<input data-f="periode" value="' + echapper(etat.periode) + '" placeholder="ex. 01/07/26 au 31/07/26"></label>' +
      '<label style="font-size:12px">Employeur<input data-f="employeur" value="' + echapper(etat.employeur) + '"></label></div>' +
      '<div style="margin:6px 0"><select data-filtre style="font-size:12px;min-width:260px"><option value="toutes">Toutes</option><option value="imprimables">Rubriques imprimables</option><option value="non-nulles">Rubriques imprimables non nulles</option></select></div>' +
      '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px" data-tbl></table></div>' +
      '<div style="margin:8px 0;display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button type="button" class="s" data-x="add">+ Ajouter une rubrique vide</button>' +
      '<input data-catq list="pd-cat-list" placeholder="+ Rechercher une rubrique (code ou nom)…" style="width:340px"><datalist id="pd-cat-list"></datalist></div>' +
      '<div data-res style="border-top:1px solid #d6dbe3;padding-top:10px"></div>' +
      '<div style="display:flex;gap:8px;margin-top:10px"><button type="button" class="s" data-x="grille">🧮 Grille de saisie (jours / heures)</button>' + '' + '<button type="button" class="s" data-x="hokp" style="font-size:12px">⚙ Paramètres Hôtel Océan</button><button type="button" class="p" data-x="print">🖨️ Aperçu / imprimer</button></div>';
    var barre = document.createElement('div');
    barre.className = 'wbar';
    barre.style.cssText = 'position:sticky;top:0;z-index:6;display:flex;justify-content:space-between;align-items:center;gap:8px;margin:-16px -16px 10px;padding:8px 12px;background:#fff;color:#1a1a1a;border-bottom:1px solid #d6dbe3;border-radius:12px 12px 0 0';
    barre.innerHTML = '<button type="button" class="s" data-x="fermer">✕ Fermer</button><small style="flex:1;text-align:center;color:#555">Bulletin détaillé</small><span></span>';
    cadre.insertBefore(barre, cadre.firstChild);
    var pied = document.createElement('div');
    pied.style.cssText = 'position:sticky;bottom:0;z-index:6;display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px -16px -16px;padding:10px 16px;background:#fff;border-top:1px solid #d6dbe3;border-radius:0 0 12px 12px';
    pied.innerHTML = '<span style="font-size:12px">Bulletin modèle : <b data-modele></b></span><span style="flex:1"></span><button type="button" class="p" data-x="ok">Ok</button><button type="button" class="s" data-x="annuler">Annuler</button><button type="button" class="s" data-x="prec">‹ Préc.</button><button type="button" class="s" data-x="suiv">Suiv. ›</button>';
    cadre.appendChild(pied);
    ov.appendChild(cadre); document.body.appendChild(ov);
    // Un taux ou une formule modifié dans les paramètres Hôtel Océan s'applique aussitôt au bulletin ouvert
    function surParamsModifies() {
      if (!document.body.contains(ov)) { root.removeEventListener('terh-hok-params', surParamsModifies); return; }
      rendre();
    }
    root.addEventListener('terh-hok-params', surParamsModifies);
    // Écarts entre le bulletin (N° CNPS, matricule saisis ou lus) et la fiche : proposer l'enregistrement
    function ecartsFiche() {
      var f = etat.fiche, out = [];
      if (!f || !f.id) return out;
      var cn = String(etat.cnps || '').trim(), mt = String(etat.mat || '').trim();
      if (cn && cn !== String(f.cnps || '').trim()) out.push({ k: 'cnps', lib: 'N° CNPS', nouveau: cn, actuel: f.cnps || '' });
      if (mt && mt !== String(f.mat || '').trim()) out.push({ k: 'mat', lib: 'Matricule interne', nouveau: mt, actuel: f.mat || '' });
      return out;
    }
    function bandeauEcarts() {
      var e = ecartsFiche(), ctl = controleCotisable(), html = '';
      if (e.length) {
        html += '<div style="border:1px solid #f0c36d;background:#fff8e6;color:#5c4400;border-radius:8px;padding:8px 10px;margin:6px 0;font-size:12px">' +
          '<b>Informations à enregistrer dans la fiche de ' + echapper(etat.nom) + ' ?</b>' +
          e.map(function (x) { return '<div style="margin-top:4px">' + x.lib + ' : « ' + echapper(x.actuel || '—') + ' » → « ' + echapper(x.nouveau) + ' »</div>'; }).join('') +
          '<div style="margin-top:6px"><button type="button" class="p" data-x="saveEcart">Enregistrer dans la fiche</button></div></div>';
      }
      if (ctl) html += '<div style="border:1px solid #f0c36d;background:#fff8e6;border-radius:8px;padding:6px 10px;margin:6px 0;font-size:12px">' + ctl + '</div>';
      return html;
    }
    function enregistrerEcarts(btn) {
      var f = etat.fiche, e = ecartsFiche();
      if (!f || !e.length) return;
      btn.disabled = true; btn.textContent = 'Enregistrement…';
      var ch = {}, mat = null, p = Promise.resolve();
      e.forEach(function (x) { if (x.k === 'cnps') ch.cnps = x.nouveau; if (x.k === 'mat') mat = x.nouveau; });
      if (mat !== null) p = p.then(function () { return root.PRH_enregistrerMat(f.id, mat); }).then(function () { f.mat = mat; });
      if (ch.cnps !== undefined) p = p.then(function () { return root.PRH_majFiche(f.id, ch); }).then(function () { f.cnps = ch.cnps; });
      p.then(function () { alert('Enregistré dans la fiche de ' + etat.nom + '.'); rendre(); })
        .catch(function (err) { alert('Enregistrement impossible : ' + ((err && err.message) || err)); btn.disabled = false; btn.textContent = 'Enregistrer dans la fiche'; });
    }
    // Composants de la fiche (colonnes importées) : salaire de base en rubrique 1000, primes cotisables et
    // indemnités non cotisables en lignes automatiques (code PRC / IND, à rattacher à vos rubriques)
    function nombreFiche(v) { var n = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : 0; }
    // Mise à jour en direct : la grille de saisie prévient le bulletin ouvert pour ce salarié
    ACTIF = {
      id: function () { return etat.fiche ? String(etat.fiche.id) : null; },
      maj: function () {
        if (!root.PaieGrille || !root.PaieGrille.lignesPour) return;
        var gl = root.PaieGrille.lignesPour(etat.fiche.id);
        etat.lignes = etat.lignes.filter(function (l) { return !l.auto; }).concat(gl);
        rendre();
      }
    };
    function appliquerFiche(f) {
      if (!f) return;
      var hor = Number(f.hor) || 173.33, col = f.colonnes || {};
      var sb = nombreFiche(f.sbImp) || nombreFiche(f.sb);
      var b1000 = etat.lignes.filter(function (l) { return String(l.code) === '1000'; })[0];
      if (sb && b1000) { b1000.nombre = hor; b1000.base = sb / hor; b1000.gain = null; }
      // Lignes générées pour le salarié précédent : retirées ; les lignes saisies à la main restent
      etat.lignes = etat.lignes.filter(function (l) { return !l.auto; });
      // Le modèle de bulletin décide des éléments à générer (rubriques cochées)
      var modele = (root.PaieModeles && root.PaieModeles.actif) ? root.PaieModeles.actif() : null;
      var choisis = (modele && modele.rubriques && modele.rubriques.length) ? modele.rubriques.map(String) : null;
      var connus = (root.PaieRubriques && root.PaieRubriques.charger) ? root.PaieRubriques.charger().map(function (r) { return String(r.code); }) : [];
      ELEMENTS_FICHE.forEach(function (e) {
        if (estOcean() && equivOcean(e.code)) return;
        if (choisis && connus.indexOf(e.code) >= 0 && choisis.indexOf(e.code) < 0) return;
        var cle = Object.keys(col).filter(function (k) { return e.cle.test(k) && nombreFiche(col[k]) !== 0; })[0];
        var v = cle ? nombreFiche(col[cle]) : 0;
        if (!v) return;
        var dr = (root.PaieMoteur && PaieMoteur.drapeaux) ? PaieMoteur.drapeaux(e.nature) : { irpp: true, cnps: false, cfc: false };
        etat.lignes.push({ code: estOcean() ? codeLibreSuivant(etat.lignes) : e.code, lib: e.lib, nombre: null, base: null, taux: null, gain: v,
          cnps: dr.cnps, cfc: dr.cfc, irpp: dr.irpp, retenue: false, auto: true, fiche: estOcean() });
      });
    }
    // Contrôle : base CNPS du bulletin contre « salaire cotisable » de la fiche
    function controleCotisable() {
      var f = etat.fiche, c = f ? nombreFiche(f.salCotisable) : 0;
      if (!c) return '';
      var R = calcul(), ecart = Math.round(R.baseCNPS - c);
      if (Math.abs(ecart) <= 1) return '';
      return '<div style="margin-top:6px;color:#8a4b00">Base CNPS du bulletin ' + fmt(R.baseCNPS) + ' ≠ salaire cotisable de la fiche ' + fmt(c) +
        ' (écart ' + fmt(ecart) + '). Vérifiez le mode de plafond CNPS et les cases « cotisable ».</div>';
    }
    function calcul() {
      var s = etat.saisies;
      var saisies = {};   // tout est calculé automatiquement par le moteur (aucune correction manuelle)
      if (s.plafondCFPat !== undefined && s.plafondCFPat !== '' && !isNaN(+s.plafondCFPat)) saisies.plafondCFPat = +s.plafondCFPat;
      if (s.baseCFC !== null && s.baseCFC !== '' && !isNaN(+s.baseCFC)) saisies.baseCFC = +s.baseCFC;
      if (tauxSage && Object.keys(tauxSage).length) saisies.taux = tauxSage;
      return PaieMoteur.calculer(ordreCodes(etat.lignes), saisies);
    }
    // Le modèle de la fiche décide des colonnes : Océan (nombre jour, base unitaire, gain, retenue) ou Sage (montant salarial, sens)
    function estOcean() {
      try {
        var m = (root.PaieModeles && root.PaieModeles.pourSalarie) ? root.PaieModeles.pourSalarie(etat.fiche, etat.employeur) : null;
        return !!(m && m.gabarit === 'ocean');
      } catch (e) { return false; }
    }
    // Liste des rubriques, propre au modèle de la fiche (comme la « Liste des rubriques » de Sage)
    function ouvrirListeRubriques() {
      var ocean = estOcean(), rows = [];
      if (ocean) {
        var ro = (root.PaieHok && root.PaieHok.rubriquesOcean) ? root.PaieHok.rubriquesOcean() : { auto: [], ajoutees: [] };
        var GAINS_OCEAN = { '1': 1, '2': 1, '3': 1, '4': 1, '5': 1, '6': 1, '29': 1 };
        ro.auto.forEach(function (r) { rows.push({ code: r.code, lib: r.lib, type: GAINS_OCEAN[r.code] ? 'Gain' : 'Retenue', memo: 'Modèle Océan', auto: true }); });
        ro.ajoutees.forEach(function (r) { rows.push({ code: r.code, lib: r.lib, type: r.type === 'retenue' ? 'Retenue' : 'Gain', memo: 'Ajoutée (Océan)', auto: false, src: r }); });
      } else {
        var cat = (typeof catalogue !== 'undefined' && catalogue && catalogue.length) ? catalogue : [];
        cat.forEach(function (r) { rows.push({ code: String(r.code), lib: r.libelle || '', type: r.type === 'retenue' ? 'Retenue' : 'Brut', memo: r.type === 'retenue' ? 'RET' : 'BRT', auto: false, src: r }); });
      }
      var box = document.createElement('div');
      box.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:12px';
      var titre = ocean ? 'Liste des rubriques : modèle Hôtel de l’Océan' : 'Liste des rubriques : modèle Sage';
      box.innerHTML = '<div style="background:#fff;color:#111;width:min(760px,96vw);max-height:86vh;display:flex;flex-direction:column;border-radius:10px;padding:12px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center"><b>' + titre + '</b><button type="button" data-fd style="padding:4px 10px">✕</button></div>' +
        '<input data-q placeholder="Rechercher (code ou intitulé)" style="margin:8px 0;padding:6px">' +
        '<div style="overflow:auto;flex:1"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#eef2f8">' +
        '<th style="text-align:left;padding:4px">Code</th><th style="text-align:left">Intitulé</th><th style="text-align:left">Type</th><th style="text-align:left">Mémo</th></tr></thead><tbody data-tb></tbody></table></div>' +
        '<p style="font-size:12px;color:#555;margin:6px 0 0">Cliquer sur une rubrique pour l’ajouter au bulletin. Les rubriques calculées par le modèle ne s’ajoutent pas.</p></div>';
      var tb = box.querySelector('[data-tb]');
      var dessiner = function (filtre) {
        var f = (filtre || '').toLowerCase();
        tb.innerHTML = rows.filter(function (r) { return !f || r.code.toLowerCase().indexOf(f) >= 0 || r.lib.toLowerCase().indexOf(f) >= 0; }).map(function (r) {
          return '<tr data-i="' + rows.indexOf(r) + '" style="' + (r.auto ? 'color:#888;' : 'cursor:pointer;') + 'border-bottom:1px solid #eee">' +
            '<td style="padding:4px">' + esc(r.code) + '</td><td>' + esc(r.lib) + (r.auto ? ' (calculée)' : '') + '</td><td>' + esc(r.type) + '</td><td>' + esc(r.memo) + '</td></tr>';
        }).join('');
      };
      dessiner('');
      box.querySelector('[data-q]').addEventListener('input', function (e) { dessiner(e.target.value); });
      tb.addEventListener('click', function (e) {
        var tr = e.target.closest('tr[data-i]'); if (!tr) return;
        var r = rows[+tr.dataset.i]; if (!r || r.auto) return;
        var src = r.src || {};
        etat.lignes.push({ code: r.code, lib: r.lib, nombre: null, base: null, taux: src.taux_defaut != null ? src.taux_defaut : null, gain: null,
          cnps: src.cnps !== false, irpp: src.imposable !== false, cfc: src.cfc !== false, retenue: r.type === 'Retenue' });
        box.remove(); rendre();
      });
      box.addEventListener('click', function (e) { if (e.target === box || (e.target.dataset && e.target.dataset.fd !== undefined)) box.remove(); });
      document.body.appendChild(box);
    }
    // Fenêtre « Éléments » : champs propres à chaque modèle
    function ouvrirElements(i) {
      var l = etat.lignes[i]; if (!l) return;
      var ocean = estOcean();
      var champ = function (nom, label, val, type) {
        return '<label style="display:block;margin:6px 0">' + label + '<br><input data-e="' + nom + '" type="' + (type || 'text') + '" step="any" value="' + esc(val == null ? '' : val) + '" style="width:100%;padding:5px"></label>';
      };
      var corps = ocean
        ? champ('nombre', 'Nombre de jours', l.nombre, 'number') + champ('base', 'Base unitaire', l.base, 'number') +
          champ('taux', 'Taux (%)', l.taux, 'number') + champ('gain', 'Gain (vide = nombre × base × taux)', l.gain, 'number') +
          champ('commentaire', 'Commentaire', l.commentaire, 'text')
        : champ('formule', 'Formule (vide = nombre × base × taux / 100 ; variables : nombre, base, taux en %)', l.formule || '', 'text') +
          champ('nombre', 'Nombre', l.nombre, 'number') + champ('base', 'Base', l.base, 'number') +
          champ('taux', 'Taux (%)', l.taux, 'number') + champ('gain', 'Montant (vide = calculé)', l.gain, 'number') +
          '<fieldset style="margin-top:8px;border:1px solid #ccc;padding:6px"><legend>Rappels / régularisations</legend>' +
          champ('rappelDu', 'Période du', l.rappelDu, 'date') + champ('rappelAu', 'Période au', l.rappelAu, 'date') + '</fieldset>';
      var box = document.createElement('div');
      box.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:12px';
      box.innerHTML = '<div style="background:#fff;color:#111;width:min(460px,96vw);max-height:88vh;overflow:auto;border-radius:10px;padding:14px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center"><b>Éléments : ' + esc(l.code || '') + ' ' + esc(l.lib || '') + '</b><button type="button" data-fd style="padding:4px 10px">✕</button></div>' +
        corps +
        '<div style="text-align:right;margin-top:10px"><button type="button" data-ok style="padding:6px 14px">Enregistrer</button> <button type="button" data-fd style="padding:6px 14px">Annuler</button></div></div>';
      var lire = function (nom) { var x = box.querySelector('[data-e="' + nom + '"]'); return x ? x.value : ''; };
      var num = function (v) { return v === '' || v == null ? null : Number(v); };
      box.addEventListener('click', function (e) {
        if (e.target === box || (e.target.dataset && e.target.dataset.fd !== undefined)) { box.remove(); return; }
        if (e.target.dataset && e.target.dataset.ok !== undefined) {
          if (ocean) {
            l.nombre = num(lire('nombre')); l.base = num(lire('base')); l.taux = num(lire('taux'));
            l.gain = num(lire('gain')); l.commentaire = lire('commentaire');
          } else {
            l.formule = lire('formule'); l.nombre = num(lire('nombre')); l.base = num(lire('base')); l.taux = num(lire('taux'));
            l.gain = num(lire('gain')); l.rappelDu = lire('rappelDu'); l.rappelAu = lire('rappelAu');
          }
          box.remove(); rendre();
        }
      });
      document.body.appendChild(box);
    }
    // Cotisations patronales Sage (lignes en lecture seule, comme sur le bulletin Sage)
    function lignesCotisationsSage(R) {
      if (!R || !R.patronales) return [];
      var P = R.patronales, D = R.detail || {}, T = Object.assign({ cnps_sal: 4.2, cnps_pat: 4.2, at_pat: 2.5, pf_pat: 7, fne_pat: 1, cfc_pat: 1.5 }, tauxSage || {});
      var base = R.baseCNPS || D.basecot || 0;
      return [
        { code: '8100', lib: 'Pension vieillesse CNPS', base: base, tSal: T.cnps_sal, mSal: D.cnpsSal, tPat: T.cnps_pat, mPat: P.cnps },
        { code: '8110', lib: 'Accident de travail', base: base, tSal: null, mSal: null, tPat: T.at_pat, mPat: P.at },
        { code: '8120', lib: 'Prestations familiales', base: base, tSal: null, mSal: null, tPat: T.pf_pat, mPat: P.pf },
        { code: '8130', lib: "Fonds national de l'emploi", base: base, tSal: null, mSal: null, tPat: T.fne_pat, mPat: P.fne },
        { code: '8140', lib: 'Crédit foncier patronal', base: D.brut || R.brut || base, tSal: null, mSal: null, tPat: T.cfc_pat, mPat: P.cfc }
      ];
    }
    // Zone Hôtel de l'Océan : toutes les rubriques du bulletin, avec leur code et leur origine
    // Rubriques du modèle Océan : avec les corrections du mois (sansCorr = false) ou purement automatiques (true)
    function lignesOcean(sansCorr) {
      var f = etat.fiche || {}, nom = f.nom || etat.nom || '';
      var pres = (root.PaieGrille && root.PaieGrille.absencePour && f.id != null) ? root.PaieGrille.absencePour(f.id, etat.periode) : null;
      var r = root.PaieHok.depuisLignes({ fiche: f, lignes: etat.lignes, periode: etat.periode, presence: pres, sansCorrections: !!sansCorr });
      var lignes = r.gains.map(function (g) { return { code: String(g.code), lib: g.lib, nb: g.nombre, base: g.base, taux: g.taux, m: g.gain, src: g.src || 'Modèle Océan', sens: 'Gain' }; })
        .concat(r.retenues.map(function (x) { return { code: String(x.code), lib: x.lib, nb: null, base: x.base, taux: x.taux, m: x.ret, src: x.src || 'Modèle Océan', sens: 'Retenue' }; }));
      return { r: r, lignes: lignes, nom: nom };
    }
    // Montant automatique d'une rubrique (base CNPS pour la 13)
    // Rubriques corrigées en pourcentage (le montant se calcule à partir du salaire de base)
    function estTaux(code) { return String(code) === '3' || String(code) === '5'; }
    function valeurAuto(c, code) {
      var l = c.lignes.filter(function (x) { return x.code === String(code); })[0];
      if (!l) return null;
      if (estTaux(code)) return l.taux == null ? null : Number(l.taux);
      return String(code) === '13' ? l.base : l.m;
    }
    // Égalité entre une correction et le calcul automatique (taux : au centième de point ; montant : 0,5 FCFA)
    function egalCorr(code, a, b) {
      return Math.abs(Number(a) - Number(b)) < (estTaux(code) ? 1e-9 : 0.5);
    }
    function calculOcean() {
      var c = lignesOcean(false), auto = lignesOcean(true), retire = false;
      // Une correction égale au calcul automatique n'est pas une correction : elle est retirée, le calcul reprend
      c.lignes.forEach(function (l) {
        var corr = root.PaieHok.correctionRubrique(c.nom, etat.periode, l.code);
        if (corr === null || corr === undefined) return;
        var a = valeurAuto(auto, l.code);
        if (a !== null && egalCorr(l.code, corr, a)) {
          root.PaieHok.corrigerRubrique(c.nom, etat.periode, l.code, null); retire = true;
        }
      });
      return retire ? lignesOcean(false) : c;
    }
    function zoneOcean() {
      var c = calculOcean(), r = c.r;
      var fmtN = function (v) { return v == null || v === '' ? '' : fmt(v); };
      // Affichage comme sur les bulletins : codes du modèle (1, 2, 3, 4, 5, 10…)
      var oq = String(etat.oq || '').trim().toLowerCase();
      var nul = function (l) { return !(l.m || l.nb || l.base || l.taux); };
      var affichees = root.PaieHok.rubriquesAffichees(c.nom, etat.periode);
      var coche = function (l) { return affichees.indexOf(String(l.code)) >= 0; };
      // Retenues légales : toujours affichées, même à zéro (exonération ou plafond)
      var OBLIGATOIRES = ['1', '2', '3', '4', '5', '6', '10', '11', '12', '13', '14', '15'];
      // Toujours affichées en haut : rubriques standard du bulletin + rubriques ajoutées (bas) ou issues de la grille
      var TOUJOURS = OBLIGATOIRES.concat(etat.lignes.filter(function (l) { return l.ajoutee || l.grille; }).map(function (l) { return String(l.code); }));
      // Liste à cocher des rubriques nulles : cochée = affichée sur le bulletin
      var nuls = c.lignes.filter(nul).filter(function (l) { return TOUJOURS.indexOf(String(l.code)) < 0; }).filter(function (l) {
        return !oq || (String(l.code) + ' ' + String(l.lib)).toLowerCase().indexOf(oq) >= 0;
      });
      var checklist = '<div style="margin:4px 0"><input data-oq value="' + esc(etat.oq || '') + '" placeholder="Rechercher une rubrique nulle (code ou nom)…" style="width:340px;font-size:12px"></div>' +
        (nuls.length ? '<div style="margin:4px 0 8px;font-size:12px;display:flex;flex-wrap:wrap;gap:4px 14px"><b style="width:100%">Rubriques nulles (cochez pour les afficher sur le bulletin) :</b>' +
          nuls.map(function (l) {
            return '<label><input type="checkbox" data-nul="' + esc(l.code) + '"' + (coche(l) ? ' checked' : '') + '> ' + esc(l.code) + ' — ' + esc(l.lib) + '</label>';
          }).join('') + '</div>' : '');
      // Cotisations calculées (IRPP, CAC, CFC, CNPS, RAV, TC, FNE) : jamais modifiables. Seuls les gains corrigibles le sont.
      var GAINS_CORRIGEABLES = ['2', '3', '4', '5', '6'];
      var obligatoire = function (l) { return TOUJOURS.indexOf(String(l.code)) >= 0; };
      var lignes = c.lignes.filter(function (l) { return !nul(l) || coche(l) || obligatoire(l); }).map(function (l) {
        var corrige = root.PaieHok.correctionRubrique(c.nom, etat.periode, l.code) !== null;
        var modifiable = root.PaieHok.champCorrigeable(l.code) && l.src === 'Modèle Océan' && GAINS_CORRIGEABLES.indexOf(String(l.code)) >= 0;
        return '<tr><td>' + esc(l.code) + '</td><td>' + esc(l.code === '1' ? 'Salaire de base' : l.lib) + (corrige ? ' <i style="color:#c0392b">(corrigé ce mois)</i>' : '') + '</td>' +
          '<td style="text-align:right">' + fmtN(l.nb) + '</td><td style="text-align:right">' + fmtN(l.base) + '</td>' +
          '<td style="text-align:right">' + (l.taux == null ? '' : (estTaux(l.code) ? Math.round(l.taux * 10000) / 100 + ' %' : l.taux)) + '</td>' +
          '<td style="text-align:right">' + (l.sens === 'Gain' ? fmtN(l.m) : '') + '</td>' +
          '<td style="text-align:right">' + (l.sens === 'Retenue' ? fmtN(l.m) : '') + '</td>' +
          '<td>' + esc(l.src === 'Saisie' ? 'Saisie (tableau libre en bas)' : l.src) + '</td>' +
          '<td>' + (modifiable ? '<button type="button" class="s" data-x="auto" data-c="' + esc(l.code) + '">Modifier</button>' : '') + '</td></tr>';
      }).join('');
      return '<div style="margin:6px 0"><b>Rubriques du bulletin Hôtel de l’Océan</b> <span style="font-size:12px;color:#555">(codes du modèle ; « Modifier » corrige la rubrique pour ce salarié et ce mois seulement)</span></div>' +
        checklist +
        '<div class="pd-scroll"><table class="pd-tbl" style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#1f5fbf;color:#fff">' +
        '<th>Code</th><th>Désignation</th><th>Nombre</th><th>Base</th><th>Taux %</th><th>Gain</th><th>Retenue</th><th>Origine</th><th></th></tr></thead><tbody>' + lignes + '</tbody>' +
        '<tfoot><tr><td colspan="5" style="text-align:right"><b>Total brut</b></td><td style="text-align:right"><b>' + fmt(r.brut) + '</b></td><td style="text-align:right"><b>' + fmt(r.totalRetenues) + '</b></td><td colspan="2"><b>Net à payer : ' + fmt(Math.round(r.net)) + '</b></td></tr></tfoot></table></div>';
    }
    // Fenêtre de correction d'une rubrique calculée (pour ce salarié et ce mois)
    function ouvrirAuto(code) {
      var c = calculOcean();
      var l = c.lignes.filter(function (x) { return x.code === String(code); })[0];
      if (!l) return;
      var corrige = root.PaieHok.correctionRubrique(c.nom, etat.periode, code);
      var libelle = String(code) === '13' ? 'Base CNPS' : (estTaux(code) ? 'Taux (%)' : 'Montant');
      var autoV = valeurAuto(lignesOcean(true), code);
      var unite = estTaux(code) ? 100 : 1;   // taux stocké en fraction (0,05), saisi en % (5)
      var box = document.createElement('div');
      box.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:12px';
      var valeur = corrige !== null ? corrige * unite : (autoV == null ? '' : autoV * unite);
      box.innerHTML = '<div style="background:#fff;color:#111;width:min(440px,96vw);border-radius:10px;padding:14px">' +
        '<div style="display:flex;justify-content:space-between"><b>' + esc(code) + ' — ' + esc(l.lib) + '</b><button type="button" data-fd style="padding:4px 10px">✕</button></div>' +
        '<p style="font-size:12px;color:#555">Salarié : ' + esc(c.nom) + ' · Période : ' + esc(etat.periode || '') + '</p>' +
        '<p style="font-size:12px;color:#555">Calcul automatique : <b>' + (estTaux(code) ? (autoV == null ? '—' : Math.round(autoV * 10000) / 100 + ' %') : fmt(autoV)) + '</b>' + (estTaux(code) ? ' (montant : ' + fmt(l.m) + ')' : '') + (corrige !== null ? ' · corrigé : <b>' + (estTaux(code) ? Math.round(corrige * 10000) / 100 + ' %' : fmt(corrige)) + '</b>' : '') + '</p>' +
        '<label style="display:block;margin:6px 0">' + libelle + '<input data-v type="number" step="any" value="' + esc(valeur) + '" style="width:100%;padding:6px"></label>' +
        '<p style="font-size:12px;color:#555">Une valeur égale au calcul automatique n\'est pas enregistrée : le calcul reste automatique. Laisser vide revient aussi au calcul.</p>' +
        '<div style="text-align:right"><button type="button" data-ok style="padding:6px 14px">Enregistrer</button> <button type="button" data-fd style="padding:6px 14px">Annuler</button></div></div>';
      box.addEventListener('click', function (e) {
        if (e.target === box || (e.target.dataset && e.target.dataset.fd !== undefined)) { box.remove(); return; }
        if (e.target.dataset && e.target.dataset.ok !== undefined) {
          var v = box.querySelector('[data-v]').value;
          var valeurStockee = v === '' ? null : Number(v) / unite;
          var identique = valeurStockee === null || (autoV !== null && egalCorr(code, valeurStockee, autoV));
          root.PaieHok.corrigerRubrique(c.nom, etat.periode, code, identique ? null : valeurStockee);
          box.remove(); rendre();
        }
      });
      document.body.appendChild(box);
    }
    // Ligne de saisie style Sage : gain et retenue dans leur colonne, taux patronal à droite
    function ligneSage(l, i, g) {
      var ret = !!l.retenue;
      var inp = function (k, v, w) { return '<input data-l="' + i + '" data-k="' + k + '" type="number" step="any" value="' + (v == null ? '' : v) + '" style="width:' + w + 'px">'; };
      var chk = function (k, v) { return '<input type="checkbox" data-l="' + i + '" data-k="' + k + '"' + (v ? ' checked' : '') + '>'; };
      var cel = function (h, al) { return '<td style="text-align:' + (al || 'left') + '">' + h + '</td>'; };
      return '<tr>' +
        cel('<input data-l="' + i + '" data-k="code" value="' + echapper(l.code) + '" style="width:60px">') +
        cel('<input data-l="' + i + '" data-k="lib" value="' + echapper(l.lib) + '" style="width:200px">') +
        cel(inp('nombre', l.nombre, 70), 'right') + cel(inp('base', l.base, 90), 'right') + cel(inp('taux', l.taux, 60), 'right') +
        cel(ret ? '' : inp('gain', l.gain, 100), 'right') +
        cel(ret ? inp('gain', l.gain, 100) : '', 'right') +
        cel('', 'right') + cel('', 'right') +
        cel(chk('irpp', l.irpp), 'center') + cel(chk('retenue', ret), 'center') +
        cel('<button type="button" class="s" data-x="elem" data-l="' + i + '">Éléments</button>') +
        cel('<button type="button" class="s" data-x="del" data-l="' + i + '">✕</button>') +
        '<td style="color:#666;font-size:11px;text-align:right">' + fmt(g) + '</td></tr>';
    }
    // Récapitulatif Sage : Période (ce bulletin) et Année (cumuls) ; « — » si le cumul n'est pas connu
    function recapSage(R) {
      var cot = lignesCotisationsSage(R);
      var cotS = cot.reduce(function (t, c) { return t + (c.mSal || 0); }, 0);
      var cotP = cot.reduce(function (t, c) { return t + (c.mPat || 0); }, 0);
      var an = (etat.cumuls && etat.cumuls.annee) || {};
      var v = function (x) { return x == null || x === '' ? '—' : fmt(x); };
      var td = function (h, fond) { return '<td style="border:1px solid #888;padding:4px 8px;text-align:' + (fond ? 'left' : 'right') + (fond ? ';background:#f1f3f6;font-weight:700' : '') + '">' + h + '</td>'; };
      return '<table style="width:100%;max-width:860px;border-collapse:collapse;font-size:12px;margin-top:10px">' +
        '<thead><tr style="background:#3d4550;color:#fff"><th style="padding:4px 8px"></th><th style="padding:4px 8px">Brut</th><th style="padding:4px 8px">Cotisations salariales</th><th style="padding:4px 8px">Cotisations patronales</th><th style="padding:4px 8px">Net à payer</th><th style="padding:4px 8px">Net imposable</th></tr></thead>' +
        '<tbody><tr>' + td('Période', true) + td(fmt(R.brut)) + td(fmt(cotS)) + td(fmt(cotP)) + td(fmt(R.net)) + td(fmt(R.netImposable)) + '</tr>' +
        '<tr>' + td('Année', true) + td(v(an.brut)) + td(v(an.cotisationsSalariales)) + td(v(an.chargesPatronales)) + td('—') + td(v(an.netImposable)) + '</tr></tbody></table>';
    }
    // Filtre d'affichage (comme Sage) : « non nulles » masque les rubriques dont tous les montants sont à zéro
    function ligneVisible(l, g) {
      if (l.ajoutee || l.grille) return true;   // rubrique ajoutée ou issue de la grille : toujours visible en bas   // rubrique ajoutée à la main : jamais masquée par le filtre
      var f = etat.filtre || 'non-nulles';
      if (f === 'toutes' || f === 'imprimables') return true;
      return !!(g || l.nombre || l.base || l.taux || l.gain);
    }
    // Pied de page : Ok et Annuler ferment la fenêtre ; Préc. et Suiv. passent au salarié voisin
    function actionPied(fx) {
      if (fx === 'ok' || fx === 'annuler' || fx === 'fermer') { ov.remove(); return; }
      var idx = employes.findIndex(function (x) { return etat.fiche && x.id === etat.fiche.id; });
      var cible = fx === 'suiv' ? idx + 1 : idx - 1;
      if (idx < 0 || cible < 0 || cible >= employes.length) { alert('Aucun salarié ' + (fx === 'suiv' ? 'suivant' : 'précédent') + ' dans la liste.'); return; }
      var sel = cadre.querySelector('[data-emp]');
      sel.value = String(cible);
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
    // Codes à 4 chiffres (1000, 1430…) : renumérotés à partir de 30, un code par ligne
    function normaliserCodesOcean() {
      etat.lignes.forEach(function (l, i) {
        if (codeSage(l.code)) { l.code = codeLibreSuivant(etat.lignes.filter(function (x, j) { return j !== i; })); }
      });
    }
    // Impression : le salaire de base garde le libellé officiel du bulletin Sage
    function lignesImpression() {
      return ordreCodes(etat.lignes).map(function (l) {
        return (String(l.code) === '1000' && l.lib === 'Salaire de base') ? Object.assign({}, l, { lib: 'Salaire de base mensuel' }) : l;
      });
    }
    function rendre(sansTable) {
      etat.lignes.forEach(function (l) { if (String(l.code) === '1000' && /salaire de base mensuel/i.test(String(l.lib || ''))) l.lib = 'Salaire de base'; });
      if (estOcean()) etat.lignes = etat.lignes.filter(function (l) { return !(String(l.code) === '1000' && l.gain == null && l.nombre == null && l.base == null); });
      var tbl = cadre.querySelector('[data-tbl]'), R = calcul();
      var RO = estOcean() ? calculOcean().r : R;   // Océan : mêmes montants que le tableau du haut et le bulletin
      var ocean = estOcean();
      if (ocean) {
        etat.lignes = etat.lignes.filter(function (l) {
          if (!equivOcean(l.code)) return true;
          var msg = T('Rubrique {c} « {l} » ignorée : le modèle Hôtel Océan calcule déjà cette rubrique (code {e}), au prorata des jours. Supprimez-la avec la croix ✕.', { c: l.code, l: l.lib || '', e: (EQUIV_SAGE_OCEAN[String(l.code)] || root.PaieHok.EQUIV_OCEAN[String(l.code)]) });
          etat.avis = etat.avis || [];
          if (etat.avis.indexOf(msg) < 0) etat.avis.push(msg);
          return false;
        });
      }
      if (ocean) {
        etat.lignes.forEach(function (l) {
          if (!codeSage(l.code) || equivOcean(l.code)) return;
          var ancien = String(l.code);
          l.code = codeLibreSuivant(etat.lignes.filter(function (x) { return x !== l; }));
          etat.avis = etat.avis || [];
          var m = T('Code Sage {a} « {l} » remplacé par le code Océan {c}.', { a: ancien, l: l.lib || '', c: l.code });
          if (etat.avis.indexOf(m) < 0) etat.avis.push(m);
        });
      }
      // Boutons propres à Sage masqués pour le modèle Hôtel Océan (les rubriques Océan se gèrent dans Paramètres Hôtel Océan)
      cadre.querySelectorAll('[data-x="cst"],[data-x="rub"],[data-x="liste"],[data-x="exemple"],[data-x="anc"]').forEach(function (b) { b.style.display = ocean ? 'none' : ''; });
      etat.filtre = etat.filtre || 'non-nulles';
      var fl = cadre.querySelector('[data-filtre]'); if (fl) fl.value = etat.filtre;
      var mq = cadre.querySelector('[data-modele]');
      if (mq) { var mm = (root.PaieModeles && root.PaieModeles.pourSalarie) ? root.PaieModeles.pourSalarie(etat.fiche, etat.employeur) : null; mq.textContent = mm ? mm.nom : ''; }
      var entete = ocean
        ? '<tr style="background:#1f5fbf;color:#fff"><th>Code</th><th>Désignation</th><th>Nombre</th><th>Base</th><th>Taux %</th><th>Gain</th><th title="Imposable">Imposable</th><th title="Gain ou retenue">Sens</th><th>Éléments</th><th>Supprimer</th><th>Calculé</th></tr>'
        : '<tr class="pd-entete" style="background:#3d4550;color:#fff"><th>Code</th><th>Rubrique</th><th>Nombre</th><th>Base</th><th>Taux salarial</th><th>Gain</th><th>Retenue</th><th>Taux pat.</th><th>Montant pat.</th><th title="Imposable">Imp.</th><th title="Retenue (sens)">Ret.</th><th>Éléments</th><th>Supprimer</th><th>Calculé</th></tr>';
      // Rubriques Océan calculées par leur formule (ou lues sur la fiche) : ne se saisissent pas ici
      var CALC = {};
      if (ocean && root.PaieHok && root.PaieHok.rubriquesOcean) {
        var ro0 = root.PaieHok.rubriquesOcean();
        ro0.catalogue.concat(ro0.auto).forEach(function (x) { CALC[String(x.code)] = true; });
      }
      var ligneCalculee = function (l, g, i) {
        var oui = function (v) { return v ? '✔' : '—'; };
        return '<tr style="background:#f6f8fb"><td>' + echapper(l.code) + '</td><td>' + echapper(l.lib) + '</td>' +
          '<td colspan="4" style="color:#555;font-size:12px">Calculé par formule : ne se saisit pas ici (modifiable dans Paramètres Hôtel Océan)</td>' +
          '<td style="text-align:center">' + oui(l.irpp) + '</td><td style="text-align:center">' + oui(l.retenue) + '</td>' +
          '<td><button type="button" class="s" data-x="elem" data-l="' + i + '">Éléments</button></td><td></td>' +
          '<td style="color:#666;font-size:11px">' + fmt(g) + '</td></tr>';
      };
      var corps = etat.lignes.map(function (l, i) {
        var g = PaieMoteur.gainLigne(l);
        if (!ligneVisible(l, g)) return '';
        if (!ocean) return ligneSage(l, i, g);
        if (CALC[String(l.code)]) return ligneCalculee(l, g, i);
        var c = function (k, v) { return '<td style="text-align:center"><input type="checkbox" data-l="' + i + '" data-k="' + k + '"' + (v ? ' checked' : '') + '></td>'; };
        var n = function (k, v, w) { return '<td><input data-l="' + i + '" data-k="' + k + '" type="number" step="any" value="' + (v == null ? '' : v) + '" style="width:' + w + 'px"></td>'; };
        return '<tr>' + '<td><input data-l="' + i + '" data-k="code" value="' + echapper(l.code) + '" style="width:60px"></td>' +
          '<td><input data-l="' + i + '" data-k="lib" value="' + echapper(l.lib) + '" style="width:200px"></td>' +
          n('nombre', l.nombre, 70) + n('base', l.base, 90) + n('taux', l.taux, 60) +
          '<td><input data-l="' + i + '" data-k="gain" type="number" step="any" value="' + (l.gain == null ? '' : l.gain) + '" style="width:100px" title="Saisir le gain, ou laisser vide pour nombre × base × taux"></td>' +
          (ocean ? '' : '<td></td><td></td>') + c('irpp', l.irpp) + (ocean ? '<td><select data-l="' + i + '" data-k="sens" style="width:100px"><option value="gain"' + (l.retenue ? '' : ' selected') + '>Gain</option><option value="retenue"' + (l.retenue ? ' selected' : '') + '>Retenue</option></select></td>' : c('retenue', l.retenue)) +
          '<td><button type="button" class="s" data-x="elem" data-l="' + i + '">Éléments</button></td><td><button type="button" class="s" data-x="del" data-l="' + i + '">✕</button></td>' +
          '<td style="color:#666;font-size:11px">' + fmt(g) + '</td></tr>';
      }).join('');
      if (!ocean) {
        var cot = lignesCotisationsSage(R), totS = 0, totP = 0;
        corps += '<tr style="font-weight:700"><td></td><td>Total brut</td><td></td><td></td><td></td><td style="text-align:right">' + fmt(R.brut) + '</td>' + '<td></td>'.repeat(8) + '</tr>';
        corps += cot.map(function (c) {
          var f = function (v) { return v == null ? '' : fmt(v); };
          var pct = function (v) { return v == null ? '' : String(v).replace('.', ',') + ' %'; };
          totS += c.mSal || 0; totP += c.mPat || 0;
          return '<tr style="background:#f6f8fb;color:#333"><td>' + esc(c.code) + '</td><td>' + esc(c.lib) + '</td><td></td>' +
            '<td style="text-align:right">' + f(c.base) + '</td><td style="text-align:right">' + pct(c.tSal) + '</td><td></td>' +
            '<td style="text-align:right">' + f(c.mSal) + '</td><td style="text-align:right">' + pct(c.tPat) + '</td>' +
            '<td style="text-align:right">' + f(c.mPat) + '</td>' + '<td></td>'.repeat(5) + '</tr>';
        }).join('');
        corps += '<tr style="font-weight:700"><td></td><td>Total cotisations</td><td></td><td></td><td></td><td></td>' +
          '<td style="text-align:right">' + fmt(totS) + '</td><td></td><td style="text-align:right">' + fmt(totP) + '</td>' + '<td></td>'.repeat(5) + '</tr>';
      }
      var oz = cadre.querySelector('[data-oz]');
      if (!oz) { oz = document.createElement('div'); oz.setAttribute('data-oz', ''); tbl.parentNode.insertBefore(oz, tbl); }
      oz.innerHTML = (ocean && root.PaieHok && root.PaieHok.depuisLignes) ? zoneOcean() : '';
      if (ocean) oz.insertAdjacentHTML('beforeend', '<div style="margin:10px 0 4px"><b>Éléments saisis à la main (rubriques libres)</b></div>');
      if (!sansTable) tbl.innerHTML = '<thead>' + entete + '</thead><tbody>' + corps + '</tbody>';
      // Rubriques de la grille que le modèle Océan calcule lui-même : elles ne sont pas reprises, on le dit
      var avisCodes = [];
      if (ocean) {
        var nbCodes = {};
        etat.lignes.forEach(function (l) { var k = String(l.code || '').trim(); if (k) nbCodes[k] = (nbCodes[k] || 0) + 1; });
        Object.keys(nbCodes).forEach(function (k) {
          if (nbCodes[k] > 1) avisCodes.push(T('Code {k} utilisé par {n} rubriques : donnez un autre code à l\'une d\'elles (modifiez le champ Code).', { k: k, n: nbCodes[k] }));
        });
      }
      var avisDoublons = [];
      if (ocean) {
        var libs = {};
        calculOcean().lignes.forEach(function (l) {
          var k = String(l.lib || '').trim().toLowerCase();
          if (!l.m || l.sens === 'Retenue' || !k) return;
          (libs[k] = libs[k] || []).push(String(l.code));
        });
        Object.keys(libs).forEach(function (k) {
          if (libs[k].length > 1) avisDoublons.push(T('Doublon possible : « {k} » apparaît en {l}. Gardez une seule de ces rubriques.', { k: k, l: libs[k].join(' et ') }));
        });
      }
      var avisReserves = [];
      if (ocean && root.PaieHok && root.PaieHok.rubriquesOcean) {
        var resv = root.PaieHok.rubriquesOcean().auto.map(function (r) { return String(r.code); });
        etat.lignes.forEach(function (l) {
          if (!l.grille || resv.indexOf(String(l.code)) < 0) return;
          var m = T('Rubrique {c} « {l} » de la grille non reprise : ce code est calculé par le modèle Hôtel Océan. Corrigez-la avec « Modifier » dans le tableau du haut.', { c: l.code, l: l.lib || '' });
          if (avisReserves.indexOf(m) < 0) avisReserves.push(m);
        });
      }
      var alertes = ((etat.mat ? [] : ['Matricule interne manquant : renseignez-le ici ou dans la fiche du salarié.']).concat(controles(ocean ? Object.assign({}, RO, { baseCNPS: RO.cnpsBase }) : R, etat.lignes, etat.cnps)).concat(etat.avis || []).concat(avisReserves).concat(avisDoublons).concat(avisCodes)).map(function (m) { return '<div class="ban" style="margin:4px 0;background:#fff8e6;color:#5c4400;border:1px solid #f0c36d;border-radius:8px;padding:6px 10px;font-size:12px">⚠ ' + echapper(m) + '</div>'; }).join('');
      var nMasquees = etat.lignes.filter(function (l) { return !ligneVisible(l, PaieMoteur.gainLigne(l)); }).length;
      var avisMasquees = nMasquees ? '<div style="margin:4px 0;font-size:12px;color:#555">' + T('{n} rubrique(s) nulle(s) masquée(s) par le filtre.', { n: nMasquees }) + ' <button type="button" class="s" data-x="toutes">' + T('Afficher toutes') + '</button></div>' : '';
      cadre.querySelector('[data-res]').innerHTML = alertes + avisMasquees + bandeauEcarts() + (ocean ? '<div style="display:flex;gap:18px;flex-wrap:wrap;font-size:13px"><span>Brut : <b>' + fmt(RO.brut) + '</b></span>' +
        '<span>Base CNPS : <b>' + fmt(RO.cnpsBase) + '</b></span><span>Retenues : <b>' + fmt(RO.totalRetenues) + '</b></span>' +
        '<span>Patronales : <b>' + fmt(RO.totalPatronales) + '</b></span><span style="font-size:16px">Net à payer : <b>' + fmt(RO.net) + '</b></span></div>' : recapSage(R));
      refreshCat();
      if (root.PaieI18n && root.PaieI18n.noeuds) root.PaieI18n.noeuds(cadre);
      if (etat.focus != null) {
        var fi = cadre.querySelector('[data-l="' + etat.focus + '"][data-k="code"]');
        etat.focus = null;
        if (fi) { fi.focus(); fi.select(); fi.scrollIntoView({ block: 'center' }); }
      }
    }
    // Mise à jour pendant la saisie : seuls le résultat et la colonne Gain sont recalculés,
    // le tableau n'est pas reconstruit (sinon le champ perd le focus à chaque touche)
    function rendreResultat() {
      var R = calcul();
      var lignesTbl = cadre.querySelectorAll('[data-tbl] tbody tr');
      lignesTbl.forEach(function (tr) {
        var champ = tr.querySelector('[data-l]');
        if (!champ) return;   // cotisations Sage (lecture seule) : pas de ligne de saisie
        var l = etat.lignes[+champ.dataset.l], cellule = tr.lastElementChild;
        if (cellule && l) cellule.textContent = fmt(PaieMoteur.gainLigne(l));
      });
      var res = cadre.querySelector('[data-res]');
      rendre(true);
    }
    cadre.addEventListener('focusin', function (e) {
      if (e.target.matches && e.target.matches('input[type=number], input[type=text], input:not([type])')) e.target.select();
    });
    cadre.addEventListener('keydown', function (e) {
      var t = e.target;
      if (e.key !== 'Enter' || !t.dataset || t.dataset.l == null || !t.dataset.k) return;
      e.preventDefault();
      var k = t.dataset.k, i = +t.dataset.l;
      for (var j = i + 1; j < etat.lignes.length; j++) {
        var cible = cadre.querySelector('[data-l="' + j + '"][data-k="' + k + '"]');
        if (cible) { cible.focus(); cible.select(); return; }
      }
    });
    cadre.addEventListener('click', function (e) {
      var tr = e.target.closest && e.target.closest('tbody tr');
      if (!tr || e.target.closest('button,input,select,textarea,label')) return;
      var deja = tr.classList.contains('pd-sel');
      cadre.querySelectorAll('tbody tr.pd-sel').forEach(function (x) { x.classList.remove('pd-sel'); });
      if (!deja) tr.classList.add('pd-sel');
    });
    cadre.addEventListener('input', function (e) {
      var t = e.target;
      if (t.dataset.l != null && t.dataset.k) {
        var i = +t.dataset.l, k = t.dataset.k, l = etat.lignes[i];
        if (k === 'code' && estOcean() && (EQUIV_SAGE_OCEAN[String(t.value).trim()] || catalogue.some(function (x) { return String(x.code) === String(t.value).trim() && x.modele; }))) { alert('Ce code correspond à une rubrique déjà calculée par le modèle Hôtel Océan. Choisissez un autre code.'); t.value = l.code || ''; return; }
        if (k === 'code' && estOcean() && codeReserve(t.value)) { alert('Le code ' + t.value + ' est déjà utilisé par le modèle Hôtel Océan. Choisissez un autre code.'); t.value = l.code || ''; return; }
        if (k === 'code' && String(t.value).trim() !== '' && etat.lignes.some(function (x, j) { return j !== i && String(x.code) === String(t.value).trim(); })) { alert('Le code ' + t.value + ' est déjà utilisé sur ce bulletin. Choisissez un autre code.'); t.value = l.code || ''; return; }
        if (k === 'sens') return; if (k === 'cnps' || k === 'cfc' || k === 'irpp' || k === 'retenue') l[k] = t.checked; else if (k === 'code' || k === 'lib') l[k] = t.value;
        else l[k] = t.value === '' ? null : +t.value;
      } else if (t.dataset.s) etat.saisies[t.dataset.s] = t.value;
      else if (t.dataset.f) etat[t.dataset.f] = t.value;
      rendreResultat();
    });
    cadre.addEventListener('input', function (e) {
      if (e.target.dataset.empq !== undefined) {
        var sel = cadre.querySelector('[data-emp]');
        if (sel) sel.innerHTML = optionsSalaries(e.target.value, sel.value);
      }
    });
    cadre.addEventListener('change', function (e) {
      if (e.target.dataset.k === 'sens') { var ls = etat.lignes[+e.target.dataset.l]; if (ls) ls.retenue = e.target.value === 'retenue'; rendre(); return; }
      if (e.target.dataset.k === 'code' && e.target.dataset.l != null && estOcean()) {
        var lc = etat.lignes[+e.target.dataset.l];
        if (lc && lc.ajoutee && String(lc.code || '').trim() !== '') {
          root.PaieHok.afficherRubrique(((etat.fiche && etat.fiche.nom) || etat.nom || ''), etat.periode, String(lc.code).trim(), true);
          rendre(); return;
        }
      }
      if (e.target.dataset.filtre !== undefined) { etat.filtre = e.target.value; rendre(); return; }
      if (e.target.dataset.oq !== undefined) { etat.oq = e.target.value; rendre(); return; }
      if (e.target.dataset.nul !== undefined) { var cc = calculOcean(); root.PaieHok.afficherRubrique(cc.nom, etat.periode, e.target.dataset.nul, e.target.checked); rendre(); return; }
      if (e.target.dataset.k && (e.target.type === 'checkbox')) rendre();
      if (e.target.dataset.emp !== undefined) {
        var fiche = employes[+e.target.value];
        if (fiche) {
          etat.nom = fiche.nom; etat.mat = fiche.mat || ''; etat.cnps = fiche.cnps || ''; etat.lieu = fiche.lieu || ''; etat.fiche = fiche;
          if (!etat.employeur) etat.employeur = (bulletinSociete && bulletinSociete.societe) || '';
          var ie = cadre.querySelector('[data-f="employeur"]'); if (ie && !ie.value) ie.value = etat.employeur;
          // Salaire de base de la fiche : ligne 1000 = horaire × base horaire (salaire ÷ horaire), comme Sage
          appliquerFiche(fiche);
          reconstruireCatalogue();
          // Grille de saisie (jours ou heures) : remplace les lignes générées à partir de la fiche pour ce salarié
          if (root.PaieGrille && root.PaieGrille.lignesPour && fiche.id != null) {
            var gl = root.PaieGrille.lignesPour(fiche.id);
            if (gl.length) etat.lignes = etat.lignes.filter(function (l) { return !l.auto; }).concat(gl);
          }
          var an = (window.PaieMoteur && PaieMoteur.ancienneteFiche) ? PaieMoteur.ancienneteFiche(fiche, new Date()) : null; etat.anciennete = an ? an.texte : '';
          cadre.querySelector('[data-f="nom"]').value = etat.nom;
      reconstruireCatalogue();
          cadre.querySelector('[data-f="cnps"]').value = etat.cnps;
          var mi = cadre.querySelector('[data-f="mat"]'); if (mi) mi.value = etat.mat;
          rendre();
        }
      }
    });
    cadre.addEventListener('click', function (e) {
      var fx = e.target.dataset && e.target.dataset.x;
      if (fx === 'ok' || fx === 'annuler' || fx === 'fermer' || fx === 'prec' || fx === 'suiv') { actionPied(fx); return; }
      var b = e.target.closest('[data-x]'); if (!b) return;
      var x = b.dataset.x;
      if (x === 'close') ov.remove();
      else if (x === 'add') { etat.lignes.push({ code: estOcean() ? codeLibreSuivant(etat.lignes.concat(calculOcean().lignes)) : '', lib: 'Nouvelle rubrique', nombre: null, base: null, taux: null, gain: 0, cnps: estOcean(), cfc: estOcean(), irpp: true, retenue: false }); nouvelleAffichee(etat.lignes.length - 1); rendre(); }
      else if (x === 'toutes') { etat.filtre = 'toutes'; rendre(); }
      else if (x === 'del') { etat.lignes.splice(+b.dataset.l, 1); rendre(); }
      else if (x === 'elem') { ouvrirElements(+b.dataset.l); }
      else if (x === 'auto') { ouvrirAuto(b.dataset.c); }
      else if (x === 'cat') { }
      else if (x === 'rub') { openRubriques(); }
      else if (x === 'anc') { ajouterAnciennete(); }
      else if (x === 'saveEcart') { enregistrerEcarts(b); }
      else if (x === 'fiche') { if (etat.fiche) { appliquerFiche(etat.fiche); rendre(); } else alert('Choisissez d\'abord le salarié.'); }
      else if (x === 'cst') { if (root.PaieConstantes) root.PaieConstantes.ouvrir(); else alert('paie-constantes.js n\'est pas chargé.'); }
      else if (x === 'simul') { if (root.PaieSimulation) root.PaieSimulation.ouvrir({ lignes: ordreCodes(etat.lignes), saisies: { taux: tauxSage || {} }, nom: etat.nom }); else alert('paie-pointage-simulation.js n\'est pas chargé.'); }
      else if (x === 'hokp') { if (root.PaieHok) root.PaieHok.ouvrir(); else alert('paie-hok.js n\'est pas chargé.'); }
      else if (x === 'mod') { if (root.PaieModeles) root.PaieModeles.ouvrir(); else alert('paie-modeles.js n\'est pas chargé.'); }
      else if (x === 'livre') {
        if (!root.PaieLivre) { alert('paie-livre.js n\'est pas chargé.'); return; }
        // Synchronisation des paramètres et particularités avant le calcul du livre
        var lvGo = function () {
          var lv = root.PaieLivre.depuisGrille({ societe: typeof etat.employeur === 'string' ? etat.employeur : ((etat.employeur && etat.employeur.nom) || ''), periode: etat.periode || '' });
          if (typeof root.printHTML === 'function') root.printHTML('Livre de paie', lv, '@page{size:A4 landscape;margin:8mm}', { apercu: true });
        };
        if (root.PaieHok && root.PaieHok.synchroniser) root.PaieHok.synchroniser().then(lvGo); else lvGo();
      }
      else if (x === 'liste') { ouvrirListeRubriques(); }
      else if (x === 'exemple') { etat.lignes = EXEMPLE.map(function (l) { return Object.assign({}, l); }); rendre(); }
      else if (x === 'grille') { if (root.PaieGrille) root.PaieGrille.ouvrir(); else alert('paie-grille.js n\'est pas chargé.'); }
      else if (x === 'print') {
        var R = calcul();
        var modele = (root.PaieModeles && root.PaieModeles.pourSalarie) ? root.PaieModeles.pourSalarie(etat.fiche, etat.employeur) : ((root.PaieModeles && root.PaieModeles.actif) ? root.PaieModeles.actif() : null), html;
        var rendreBulletin = (modele && modele.gabarit === 'ocean' && root.PaieBulletinOcean) ? root.PaieBulletinOcean : root.PaieBulletinSage;
        if (rendreBulletin) html = rendreBulletin.html({ modele: modele, bulletin: etat.bulletin, nom: etat.nom, periode: etat.periode, paiement: etat.paiement || '', employeur: etat.employeur, lignes: lignesImpression(), resultat: R, cumuls: etat.cumuls || {}, conges: etat.conges || {}, salarie: salarieSage(), hok: (modele && modele.gabarit === 'ocean' && root.PaieHok) ? root.PaieHok.depuisLignes({ fiche: etat.fiche, lignes: lignesImpression(), conges: etat.conges, periode: etat.periode, presence: (root.PaieGrille && root.PaieGrille.absencePour && etat.fiche) ? root.PaieGrille.absencePour(etat.fiche.id, etat.periode) : null, congesPlateforme: (root.PRH_congesPour && etat.fiche) ? root.PRH_congesPour(etat.fiche.id) : [] }) : null });
        else html = bulletinHTML({ modele: modele, bulletin: etat.bulletin, nom: etat.nom, mat: etat.mat, cnps: etat.cnps, lieu: etat.lieu, anciennete: etat.anciennete, periode: etat.periode, employeur: etat.employeur, lignes: lignesImpression(), saisies: Object.assign({}, etat.saisies, { taux: tauxSage || {} }), resultat: R });
        if (root.PaieI18n && html) html = root.PaieI18n.html(html);
        var couleurModele = (modele && modele.couleur) || (etat.bulletin && etat.bulletin.couleur);
        var cssBul = cssBulletin({ couleur: couleurModele }) + ((modele && modele.gabarit === 'ocean') ? '@page{size:A4;margin:0}.bs-bulletin{padding:10mm 12mm;box-sizing:border-box}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}' : '');
        if (etat.capture) { etat.capture({ html: html, css: cssBul, resultat: R, lignes: lignesImpression(), fiche: etat.fiche, nom: etat.nom, mat: etat.mat, cnps: etat.cnps, periode: etat.periode, employeur: etat.employeur, bulletin: etat.bulletin }); }
        else if (typeof root.printHTML === 'function') root.printHTML('Bulletin de paie', html, cssBul, { apercu: true });
      }
    });
    if (root.PaieRubriques && root.PaieRubriques.synchroniser) {
      root.PaieRubriques.synchroniser().then(function (liste) {
        if (!liste) return;
        perso = liste; reconstruireCatalogue();
      });
    }
    refreshCat();
    cadre.querySelector('[data-catq]').addEventListener('change', function (e) {
      var v = e.target.value.trim(), code = v.split(' — ')[0].trim();
      e.target.value = '';
      if (!v) return;
      var r = catalogue.filter(function (x) { return String(x.code) === code; })[0];
      if (!r) { alert('Rubrique introuvable : choisissez-la dans la liste proposée.'); return; }
      if (r.sugg && estOcean()) { var calcC = []; try { calcC = calculOcean().lignes; } catch (e) {} r = Object.assign({}, r, { code: codeLibreSuivant(etat.lignes.concat(calcC)), sugg: false }); }
      ajouterRubrique(r);
    });
    rendre();
    // Mode lot : bulletin du salarié calculé comme à l'impression, transmis au lot puis fenêtre fermée
    if (opts && opts.lot) {
      var lf = opts.lot.fiche;
      etat.nom = lf.nom; etat.mat = lf.mat || ''; etat.cnps = lf.cnps || ''; etat.lieu = lf.lieu || ''; etat.fiche = lf;
      if (!etat.employeur) etat.employeur = (bulletinSociete && bulletinSociete.societe) || (opts.employeur || '');
      appliquerFiche(lf); reconstruireCatalogue(); rendre();
      etat.capture = opts.lot.onResultat;
      try { var pbtn = cadre.querySelector('[data-x="print"]'); if (pbtn) pbtn.click(); } catch (e) { }
      opts.lot.onResultat(null);
      ov.remove();
    }
  }
  // Ordre des rubriques : par code croissant (1000, 1040… puis 8100, 9019…) ; sans code en dernier. Tri stable.
  function ordreCodes(lignes) {
    return (lignes || []).map(function (l, i) { return { l: l, i: i }; }).sort(function (a, b) {
      var ca = String(a.l.code || '').trim(), cb = String(b.l.code || '').trim();
      if (!ca && cb) return 1; if (ca && !cb) return -1;
      var na = parseFloat(ca), nb2 = parseFloat(cb);
      var d = (isFinite(na) && isFinite(nb2)) ? na - nb2 : (ca < cb ? -1 : ca > cb ? 1 : 0);
      return d || a.i - b.i;
    }).map(function (x) { return x.l; });
  }
  // Contrôles affichés avant impression : plafond CNPS, net négatif, brut nul, retenues supérieures au brut
  // Éléments lus dans les colonnes importées de la fiche (le modèle de bulletin choisit ceux à générer)
  var ELEMENTS_FICHE = [
    { code: '1040', lib: 'Sursalaire', cle: /sursalaire/i, nature: 'salaire' },
    { code: '1430', lib: 'Indemnité de transport', cle: /transport/i, nature: 'transport' },
    { code: '1435', lib: 'Indemnité de logement', cle: /logement/i, nature: 'logement_avantage' },
    { code: '1310', lib: 'Prime de panier', cle: /panier/i, nature: 'remboursement' },
    { code: '1442', lib: 'Indemnité de salissure', cle: /salissure/i, nature: 'remboursement' },
    { code: '1510', lib: "Prime d'assiduité", cle: /assiduit/i, nature: 'salaire' },
    { code: '1901', lib: 'Primes cotisables (fiche)', cle: /prime.*cotisable/i, nature: 'salaire' },
    { code: '1902', lib: 'Indemnités non cotisables (fiche)', cle: /indemn.*non\s*cotisable/i, nature: 'indemnite_non_cotisable' }
  ];
  function controles(R, lignes, cnps) {
    var msg = [];
    if (!R) return msg;
    var vus = {};
    (lignes || []).forEach(function (l) {
      var c = String(l.code || '').trim();
      if (!c) msg.push('Une rubrique n\'a pas de code : « ' + (l.lib || 'sans libellé') + ' ».');
      else if (vus[c] && vus[c] !== (l.lib || '')) msg.push('Le code ' + c + ' désigne deux rubriques : « ' + vus[c] + ' » et « ' + (l.lib || '') + ' ».');
      else vus[c] = l.lib || '';
    });
    if (!String(cnps || '').trim()) msg.push('N° CNPS manquant : il est lu sur la fiche du salarié.');
    if (R.brut <= 0) msg.push('Brut nul : aucune rubrique de gain n\'est saisie.');
    if (R.net < 0) msg.push('Net négatif : les retenues dépassent le brut. Vérifiez les avances et les retenues.');
    if (R.totalRetenues > R.brut && R.brut > 0) msg.push('Retenues supérieures au brut.');
    if (R.netImposable > R.brut) msg.push('Net imposable supérieur au brut : vérifiez les cases « imposable ».');
    var base = R.netImposable - (lignes || []).filter(function (l) { return String(l.code) === '1430'; }).reduce(function (t, l) { return t + (typeof l.gain === 'number' ? l.gain : 0); }, 0);
    if (base > 750000) msg.push('Base CNPS au-delà de 750 000 : cotisation plafonnée à 31 500 (4,2 %).');
    return msg;
  }
  // Bulletin actuellement ouvert (pour la mise à jour en direct depuis la grille)
  var ACTIF = null;
  root.addEventListener('paie-grille-maj', function (ev) {
    if (ACTIF && ev.detail && ACTIF.id() === String(ev.detail.id)) ACTIF.maj();
  });
  // Montants de la fiche par code de rubrique (mêmes règles que le bulletin ; utilisé par la grille de saisie)
  function montantsFiche(f) {
    var out = {};
    if (!f) return out;
    var col = f.colonnes || {};
    var n = function (v) { var x = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return isFinite(x) ? x : 0; };
    ELEMENTS_FICHE.forEach(function (e) {
      var cle = Object.keys(col).filter(function (k) { return e.cle.test(k) && n(col[k]) !== 0; })[0];
      if (cle) out[e.code] = n(col[cle]);
    });
    out['1000'] = n(f.sbImp) || n(f.sb);
    return out;
  }
  // Bulletins de paie d'un lot (fiches du mois) : un salarié après l'autre, sans fenêtre visible
  function bulletinsEnLot(o) {
    o = o || {};
    var fiches = o.fiches || [], res = [];
    return fiches.reduce(function (chaine, f) {
      return chaine.then(function () {
        return new Promise(function (resolve) {
          var fait = false;
          function recevoir(r) { if (!fait) { fait = true; res.push(r ? r : { erreur: 'Bulletin non généré', fiche: f }); resolve(); } }
          try {
            ouvrir({ bulletin: o.bulletin, employeur: o.employeur, taux: o.taux, rubriques: o.rubriques, employes: fiches, periode: o.periode,
              lot: { fiche: f, onResultat: recevoir } });
          } catch (e) { recevoir({ erreur: String((e && e.message) || e), fiche: f }); }
        });
      });
    }, Promise.resolve()).then(function () { return res; });
  }
  var API = { bulletinsEnLot: bulletinsEnLot, montantsFiche: montantsFiche, periodeMoisCourant: periodeMoisCourant, controles: controles, EXEMPLE: EXEMPLE, bulletinHTML: bulletinHTML, ouvrir: ouvrir, fmt: fmt, fusionCatalogue: fusionCatalogue };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.PaieDetail = API;
})(typeof window !== 'undefined' ? window : globalThis);
