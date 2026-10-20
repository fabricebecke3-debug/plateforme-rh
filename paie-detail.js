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
  function fusionCatalogue(liste) {
    var perso = (liste || []).slice(), codes = {};
    perso.forEach(function (r) { codes[String(r.code)] = true; });
    var sage = ((root.PaieSageCatalogue && root.PaieSageCatalogue.rubriques) || []).map(rubriqueSage);
    return perso.concat(sage.filter(function (s) { return !codes[s.code]; }));
  }
  function ouvrir(opts) {
    var bulletinSociete = (opts && opts.bulletin) || null;
    // Réglages de la structure (risque AT, base FNE) prioritaires sur les taux par défaut
    var tauxSage = Object.assign({}, (opts && opts.taux) || {}, (root.TERH_tauxEntreprise ? root.TERH_tauxEntreprise() : {}));
    var perso = (opts && opts.rubriques && opts.rubriques.length) ? opts.rubriques.slice() : ((root.PaieRubriques && root.PaieRubriques.charger) ? root.PaieRubriques.charger() : []);
    var catalogue = fusionCatalogue(perso);
    if (root.PaiePointage) root.PaiePointage.synchroniser();
    if (root.PaieModeles) root.PaieModeles.synchroniser();
    function appliquerPointage(h) {
      var HS = ['1110', '1130', '1140', '1150', '1160'], TX = { '1110': 120, '1130': 130, '1140': 140, '1150': 150, '1160': 200 };
      etat.lignes = etat.lignes.filter(function (l) { return HS.indexOf(String(l.code)) < 0; });
      HS.forEach(function (c) {
        var n = +h[c] || 0; if (n <= 0) return;
        var cat = (root.PaiePointage.CATS.filter(function (x) { return x[0] === c; })[0] || [c, 'Heures sup.'])[1];
        etat.lignes.push({ code: c, lib: cat, nombre: n, base: null, taux: TX[c], gain: null, cnps: true, cfc: true, irpp: true, retenue: false, heures_sup: true });
      });
      rendre();
    }
    function refreshCat() { var dl = cadre.querySelector('#pd-cat-list'); if (!dl) return; dl.innerHTML = '';
      catalogue.forEach(function (r) { var o = document.createElement('option'); o.value = r.code + ' — ' + (r.libelle || ''); dl.appendChild(o); }); }
    function reconstruireCatalogue() { catalogue.splice(0, catalogue.length); fusionCatalogue(perso).forEach(function (r) { catalogue.push(r); }); root.PAIE_RUB_CACHE = perso; refreshCat(); }
    function openRubriques() { if (!root.PaieRubriques) { alert('paie-rubriques.js n\'est pas chargé.'); return; }
      root.PaieRubriques.ouvrir(perso, function (liste) { perso = liste; reconstruireCatalogue(); }); }
    function ajouterRubrique(r) {
      etat.lignes.push({ code: r.code, lib: r.libelle, nombre: null, base: null, taux: (r.taux_defaut != null ? r.taux_defaut : null),
        gain: null, cnps: !!r.cnps, cfc: !!r.cfc, irpp: r.imposable !== false, retenue: r.type === 'retenue',
        transport: !!r.transport, logement: !!r.logement, heures_sup: !!r.heures_sup });
      rendre();
    }
    // Prime d'ancienneté (rubrique 1202) : taux selon les années révolues, base = salaire catégoriel (rubrique 1000)
    function ajouterAnciennete() {
      var f = etat.fiche || {}, an = (root.PaieMoteur && PaieMoteur.ancienneteDepuis) ? PaieMoteur.ancienneteDepuis(f.entree, new Date()) : null;
      if (!an) { alert('Date d\'entrée absente de la fiche : ancienneté impossible à calculer.'); return; }
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
    var etat = { lignes: (opts && opts.lignes) ? opts.lignes.slice() : [{ code: '1000', lib: 'Salaire de base mensuel', nombre: null, base: null, taux: null, gain: null, cnps: true, cfc: true, irpp: true }],
      saisies: {}, nom: (opts && opts.nom) || '', mat: (opts && opts.mat) || '', cnps: (opts && opts.cnps) || '', lieu: (opts && opts.lieu) || '', periode: (opts && opts.periode) || periodeMoisCourant(), employeur: (opts && opts.employeur) || '' };
    // Une seule source pour tous les points d'entrée : fiche + matricule + CNPS (index.html)
    var employes = root.TERH_fichesPaie ? root.TERH_fichesPaie() : ((opts && opts.employes) || []);
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
        '.pd-cadre table th{background:#1f5fbf;color:#fff;font-weight:600}.pd-cadre table td{border-bottom:1px solid #e3e8ef;padding:2px 4px;height:22px;line-height:1.2}.pd-cadre table th{padding:4px;font-size:11px;white-space:nowrap}.pd-cadre table td input{height:20px;box-sizing:border-box}' +
        '.pd-cadre button{background:#eef2f8;color:#1a1a1a;border:1px solid #9aa5b5;border-radius:6px;padding:4px 10px;cursor:pointer}' +
        '.pd-cadre button.p{background:#1f5fbf;color:#fff;border-color:#1f5fbf}'; document.head.appendChild(st); }
    cadre.innerHTML = '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b style="flex:1;font-size:16px">🧾 Bulletin détaillé (rubriques)</b>' +
      '<button type="button" class="s" data-x="mod">📄 Modèles</button><button type="button" class="s" data-x="pointage">⏱ Pointage</button><button type="button" class="s" data-x="simul">🧮 Simulation</button><button type="button" class="s" data-x="cst">Constantes Sage</button><button type="button" class="s" data-x="anc">Prime d’ancienneté</button><button type="button" class="s" data-x="fiche">Composants de la fiche</button><button type="button" class="s" data-x="rub">⚙️ Rubriques</button><button type="button" class="s" data-x="exemple">Exemple</button><button type="button" class="s" data-x="close">✕ Fermer</button></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0"><label style="font-size:12px">Salarié<select data-emp style="width:240px"><option value="">— choisir la fiche —</option>' + employes.map(function (x, i) { return '<option value="' + i + '">' + echapper(x.nom) + '</option>'; }).join('') + '</select></label>' +
      '<label style="font-size:12px">N° CNPS (fiche)<input data-f="cnps" value="' + echapper(etat.cnps) + '" style="width:160px"></label>' +
      '<label style="font-size:12px">Nom affiché<input data-f="nom" value="' + echapper(etat.nom) + '" style="width:200px"></label>' +
      '<label style="font-size:12px">Matricule interne<input data-f="mat" value="' + echapper(etat.mat) + '" style="width:120px"></label>' +
      '<label style="font-size:12px">Période<input data-f="periode" value="' + echapper(etat.periode) + '" placeholder="ex. 01/07/26 au 31/07/26"></label>' +
      '<label style="font-size:12px">Employeur<input data-f="employeur" value="' + echapper(etat.employeur) + '"></label></div>' +
      '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px" data-tbl></table></div>' +
      '<div style="margin:8px 0;display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button type="button" class="s" data-x="add">+ Ajouter une rubrique vide</button>' +
      '<input data-catq list="pd-cat-list" placeholder="+ Rechercher une rubrique (code ou nom)…" style="width:340px"><datalist id="pd-cat-list"></datalist></div>' +
      '<div data-res style="border-top:1px solid #d6dbe3;padding-top:10px"></div>' +
      '<div style="display:flex;gap:8px;margin-top:10px"><button type="button" class="p" data-x="print">🖨️ Aperçu / imprimer</button></div>';
    ov.appendChild(cadre); document.body.appendChild(ov);
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
      if (mat !== null) p = p.then(function () { return root.TERH_enregistrerMat(f.id, mat); }).then(function () { f.mat = mat; });
      if (ch.cnps !== undefined) p = p.then(function () { return root.TERH_majFiche(f.id, ch); }).then(function () { f.cnps = ch.cnps; });
      p.then(function () { alert('Enregistré dans la fiche de ' + etat.nom + '.'); rendre(); })
        .catch(function (err) { alert('Enregistrement impossible : ' + ((err && err.message) || err)); btn.disabled = false; btn.textContent = 'Enregistrer dans la fiche'; });
    }
    // Composants de la fiche (colonnes importées) : salaire de base en rubrique 1000, primes cotisables et
    // indemnités non cotisables en lignes automatiques (code PRC / IND, à rattacher à vos rubriques)
    function nombreFiche(v) { var n = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : 0; }
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
        if (choisis && connus.indexOf(e.code) >= 0 && choisis.indexOf(e.code) < 0) return;
        var cle = Object.keys(col).filter(function (k) { return e.cle.test(k) && nombreFiche(col[k]) !== 0; })[0];
        var v = cle ? nombreFiche(col[cle]) : 0;
        if (!v) return;
        var dr = (root.PaieMoteur && PaieMoteur.drapeaux) ? PaieMoteur.drapeaux(e.nature) : { irpp: true, cnps: false, cfc: false };
        etat.lignes.push({ code: e.code, lib: e.lib, nombre: null, base: null, taux: null, gain: v,
          cnps: dr.cnps, cfc: dr.cfc, irpp: dr.irpp, retenue: false, auto: true });
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
      cadre.querySelector('[data-res]').innerHTML = alertes + bandeauEcarts() + '<div style="display:flex;gap:18px;flex-wrap:wrap;font-size:13px"><span>Brut : <b>' + fmt(R.brut) + '</b></span>' +
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
          etat.nom = fiche.nom; etat.mat = fiche.mat || ''; etat.cnps = fiche.cnps || ''; etat.lieu = fiche.lieu || ''; etat.fiche = fiche;
          // Salaire de base de la fiche : ligne 1000 = horaire × base horaire (salaire ÷ horaire), comme Sage
          appliquerFiche(fiche); var an = (window.PaieMoteur && PaieMoteur.ancienneteDepuis) ? PaieMoteur.ancienneteDepuis(fiche.entree, new Date()) : null; etat.anciennete = an ? an.texte : '';
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
      else if (x === 'anc') { ajouterAnciennete(); }
      else if (x === 'saveEcart') { enregistrerEcarts(b); }
      else if (x === 'fiche') { if (etat.fiche) { appliquerFiche(etat.fiche); rendre(); } else alert('Choisissez d\'abord le salarié.'); }
      else if (x === 'cst') { if (root.PaieConstantes) root.PaieConstantes.ouvrir(); else alert('paie-constantes.js n\'est pas chargé.'); }
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
        var modele = (root.PaieModeles && root.PaieModeles.actif) ? root.PaieModeles.actif() : null, html;
        if (root.PaieBulletinSage) html = root.PaieBulletinSage.html({ modele: modele, bulletin: etat.bulletin, nom: etat.nom, periode: etat.periode, paiement: etat.paiement || '', employeur: etat.employeur, lignes: etat.lignes, resultat: R, cumuls: etat.cumuls || {}, conges: etat.conges || {}, salarie: salarieSage() });
        else html = bulletinHTML({ modele: modele, bulletin: etat.bulletin, nom: etat.nom, mat: etat.mat, cnps: etat.cnps, lieu: etat.lieu, anciennete: etat.anciennete, periode: etat.periode, employeur: etat.employeur, lignes: etat.lignes, saisies: Object.assign({}, etat.saisies, { taux: tauxSage || {} }), resultat: R });
        var couleurModele = (modele && modele.couleur) || (etat.bulletin && etat.bulletin.couleur);
        if (typeof root.printHTML === 'function') root.printHTML('Bulletin de paie', html, cssBulletin({ couleur: couleurModele }), { apercu: true });
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
      ajouterRubrique(r);
    });
    rendre();
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
    if (!String(cnps || '').trim()) msg.push('N° CNPS manquant : il est lu sur la fiche du salarié.');
    if (R.brut <= 0) msg.push('Brut nul : aucune rubrique de gain n\'est saisie.');
    if (R.net < 0) msg.push('Net négatif : les retenues dépassent le brut. Vérifiez les avances et les retenues.');
    if (R.totalRetenues > R.brut && R.brut > 0) msg.push('Retenues supérieures au brut.');
    if (R.netImposable > R.brut) msg.push('Net imposable supérieur au brut : vérifiez les cases « imposable ».');
    var base = R.netImposable - (lignes || []).filter(function (l) { return String(l.code) === '1430'; }).reduce(function (t, l) { return t + (typeof l.gain === 'number' ? l.gain : 0); }, 0);
    if (base > 750000) msg.push('Base CNPS au-delà de 750 000 : cotisation plafonnée à 31 500 (4,2 %).');
    return msg;
  }
  var API = { periodeMoisCourant: periodeMoisCourant, controles: controles, EXEMPLE: EXEMPLE, bulletinHTML: bulletinHTML, ouvrir: ouvrir, fmt: fmt, fusionCatalogue: fusionCatalogue };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.PaieDetail = API;
})(typeof window !== 'undefined' ? window : globalThis);
