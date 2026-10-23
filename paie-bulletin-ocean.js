/* paie-bulletin-ocean.js — Bulletin de paie « Hôtel Océan » (mise en page officielle).
 * Entrée : PaieBulletinOcean.html(o) avec o.hok (résultat de PaieHok), o.nom, o.periode, o.salarie.
 * Aucun calcul ici : les montants viennent de PaieHok.
 */
(function (root) {
  'use strict';

  var ENTETE_FR = ['REPUBLIQUE DU CAMEROUN', 'Paix-Travail-Patrie', 'MINISTERE DU TOURISME ET DES LOISIRS',
    'PARC HOTELIER DE L\'ETAT', 'HOTEL DE L\'OCEAN', 'UNITE ADMINISTRATIVE'];
  var ENTETE_EN = ['REPUBLIC OF CAMEROON', 'Peace-Work-Fatherland', 'MINISTRY OF TOURISM AND LEISURE',
    'OCEAN STATE-OWNED POOL', 'HOTEL OCEAN', 'ADMINISTRATIVE UNIT'];
  var BLOCS_DEFAUT = ['entete', 'salarie', 'rubriques', 'pied'];
  var TD = 'border:1px solid #000;padding:2px 4px;font-size:10.5px;vertical-align:middle;color:#000';
  // En-tête : fond et texte forcés (couleur du modèle, sinon bleu nuit) pour que le thème sombre ne les éclaircisse pas
  var TH = 'border:1px solid #000;padding:3px 4px;font-size:10.5px;vertical-align:middle;text-align:center;' +
    'font-weight:700;text-transform:none';
  // Lignes de total : fond bleu pâle, texte noir gras
  var TOT = 'background:#e4ecf8;font-weight:700';
  var TDD = TD + ';text-align:right';

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function vide(v) { return (v === null || v === undefined) ? '' : v; }
  function fmt(n) {
    var v = Math.round(Number(n) || 0);
    return (v < 0 ? '-' : '') + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }
  function nb(v, dec) {
    if (v === null || v === undefined || v === '' || !isFinite(Number(v))) return '';
    return Number(v).toFixed(dec === undefined ? 0 : dec).replace('.', ',');
  }
  function pct(t) { return t ? nb(Number(t) * 100, 2) + '%' : ''; }
  function bornes(periode) {
    return (root.PaieBulletinSage && root.PaieBulletinSage.bornes) ? root.PaieBulletinSage.bornes(periode) : { debut: '', fin: '' };
  }
  function cell(t, style) { return '<td style="' + TD + (style || '') + '">' + t + '</td>'; }

  // Ligne d'astérisques proportionnelle au texte (comme sur le modèle officiel)
  function etoiles(t) {
    var n = Math.max(4, Math.round(String(t).length * 0.75));
    return new Array(n + 1).join('*');
  }
  function entete(o, mod) {
    var per = bornes(o.periode);
    var E = (o.hok && o.hok.entreprise) || {};
    var colonne = function (lignes) {
      return '<td style="border:0;width:37%;vertical-align:top;text-align:center;font-family:\'Times New Roman\',Times,serif;font-size:9.5px;line-height:1.25">' +
        lignes.map(function (l) {
          return '<div>' + esc(l) + '</div><div style="font-size:9px;letter-spacing:0.5px;line-height:1.1">' + etoiles(l) + '</div>';
        }).join('') + '</td>';
    };
    // Centre : logo du modèle (dans l'en-tête) puis nom de la société
    var h = (mod && mod.logoH) ? Number(mod.logoH) : 18;
    // Position libre (X, Y en mm, réglée dans l'éditeur) : logo placé à cet endroit ; sinon logo centré dans l'en-tête
    var libre = (mod && mod.logo && mod.logoPos !== 'aucun' && mod.logoX !== undefined && mod.logoY !== undefined);
    var logo = (mod && mod.logo && mod.logoPos !== 'aucun' && !libre)
      ? '<img src="' + mod.logo + '" alt="" style="height:' + h + 'mm;width:auto;display:block;margin:0 auto 4px">' : '';
    var centre = '<td style="border:0;width:26%;text-align:center;vertical-align:middle">' + logo +
      '<div style="font-weight:700;font-size:13px;font-family:Arial,sans-serif">' + esc(o.employeur || '') + '</div></td>';
    return '<table style="width:100%;border:0;border-collapse:collapse;margin-bottom:8px"><tr>' +
      colonne(ENTETE_FR) + centre + colonne(ENTETE_EN) +
      '</tr></table>' +
      '<div style="font-size:11px;font-weight:700;margin:4px 0 6px">BULLETIN DE PAIE DU ' +
        esc(vide(per.debut)) + ' AU ' + esc(vide(per.fin)) + '</div>';
  }

  // Coordonnées de l'entreprise (gauche) et du salarié (droite), remplies depuis la fiche
  function zoneSalarie(o) {
    var E = (o.hok && o.hok.entreprise) || {}, s = o.salarie || {};
    var employeur = '<td style="width:45%;vertical-align:top;font-size:10px;line-height:1.5">' +
      (E.bp ? 'BP : ' + esc(E.bp) + '<br>' : '') +
      (E.tel ? 'TEL. : ' + esc(E.tel) + '<br>' : '') +
      (E.niu ? 'NIU : ' + esc(E.niu) + '<br>' : '') +
      (E.cnps ? 'N° CNPS : ' + esc(E.cnps) : '') + '</td>';
    var salarie = '<td style="width:55%;vertical-align:top"><div style="border:1px solid #000;padding:5px 8px;font-size:10.5px;line-height:1.6">' +
      '<div style="font-size:12px"><b>' + esc(vide(o.nom || s.nom)) + '</b></div>' +
      '<div>Matricule : <b>' + esc(vide(s.matricule)) + '</b> &nbsp; Poste de travail : <b>' + esc(vide(s.emploi)) + '</b></div>' +
      '<div>Échelon : <b>' + esc(vide(s.niveau)) + '</b> &nbsp; Catégorie : <b>' + esc(vide(s.categorie)) + '</b></div>' +
      '<div>N° CNPS : <b>' + esc(vide(s.secu)) + '</b></div>' +
      '<div>Ancienneté : <b>' + esc(vide(s.anciennete)) + '</b></div>' +
      '</div></td>';
    return '<table style="width:100%;border-collapse:collapse;margin-bottom:6px"><tr>' + employeur + salarie + '</tr></table>';
  }

  // Couleurs du modèle (couleur d'en-tête choisie dans l'éditeur ; bleu nuit par défaut)
  function hexRgb(h) {
    var m = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(String(h || ''));
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
  }
  function couleurs(mod) {
    var rgb = hexRgb(mod && mod.couleur) || [31, 59, 111];
    var hex = function (c) { return '#' + c.map(function (v) { return Math.round(v).toString(16).padStart(2, '0'); }).join(''); };
    var clair = rgb.map(function (v) { return v * 0.15 + 255 * 0.85; });
    var lum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
    return { tete: hex(rgb), texte: lum > 140 ? '#000' : '#fff', total: hex(clair) };
  }

  // Tableau : N° | Désignation | Nombre jour | Base unitaire | Taux | Gain | Retenue
  // Nombre, base et taux suivent les colonnes cochées dans le modèle ; N°, désignation, gain et retenue sont toujours imprimés.
  function tableau(o, mod) {
    var H = o.hok, C = couleurs(mod), cols = (mod && mod.colonnes) || {};
    var entetes = [['N°', null], ['Désignation', null], ['Nombre<br>Jour', 'nombre'], ['Base<br>Unitaire', 'base'], ['Taux', 'taux'], ['Gain', null], ['Retenue', null]];
    var vis = entetes.map(function (e) { return !e[1] || cols[e[1]] !== false; });
    var TH_ = TH + ';background:' + C.tete + ';color:' + C.texte;
    var TOT_ = TOT + ';background:' + C.total;
    var droite = ';text-align:right';
    // Une ligne = 7 cellules (une par colonne) ; les colonnes masquées sont retirées
    var rang = function (c) { return '<tr>' + c.filter(function (x, i) { return vis[i]; }).join('') + '</tr>'; };
    var lignes = '';
    // Rubrique à zéro : imprimée seulement si elle a été validée « Afficher à 0 » dans les paramètres Océan
    var VALIDEES = (H.zeros || []).map(String);
    var visible = function (code, montant) { return !!Number(montant) || VALIDEES.indexOf(String(code)) >= 0; };
    H.gains.forEach(function (g) {
      if (!visible(g.code, g.gain)) return;
      lignes += rang([cell(esc(g.code)), cell(esc(g.lib)),
        cell(g.nombre != null ? nb(g.nombre, 0) : '', droite),
        cell(g.base != null ? fmt(g.base) : '', droite),
        cell(pct(g.taux), droite), cell(fmt(g.gain), droite), cell('')]);
    });
    lignes += rang([cell('', TOT_), cell('<b>Total Brut</b>', TOT_), cell('', TOT_), cell('', TOT_), cell('', TOT_),
      cell('<b>' + fmt(H.brut) + '</b>', TOT_ + droite), cell('', TOT_)]);
    H.retenues.forEach(function (r) {
      if (!visible(r.code, r.ret)) return;
      lignes += rang([cell(esc(r.code)), cell(esc(r.lib)), cell(''),
        cell(r.base != null ? fmt(r.base) : '', droite), cell(pct(r.taux), droite),
        cell(''), cell(fmt(r.ret), droite)]);
    });
    lignes += rang([cell('', TOT_), cell('<b>Total Cotisations</b>', TOT_), cell('', TOT_), cell('', TOT_), cell('', TOT_),
      cell('', TOT_), cell('<b>' + fmt(H.totalRetenues) + '</b>', TOT_ + droite)]);
    // Rappels et avances : lignes du bulletin papier, hors total cotisations
    // Rappels et avances : imprimés seulement s'ils sont saisis (montant non nul)
    if (visible('29', H.rappel)) lignes += rang([cell('29'), cell(H.libRappel || 'Rappels'), cell(''), cell(''), cell(''), cell(''), cell(fmt(H.rappel), droite)]);
    if (visible('26', H.avance)) lignes += rang([cell('26'), cell(H.libAvance || 'Avance sur Salaire'), cell(''), cell(''), cell(''), cell(''), cell(fmt(H.avance), droite)]);
    var alerte = (H.erreurs && H.erreurs.length) ? '<div style="color:#c0392b;font-size:10px;font-weight:700;margin-bottom:4px">Attention, formule à corriger : ' + esc(H.erreurs.join(' ; ')) + '</div>' : '';
    return alerte + '<table style="width:100%;border-collapse:collapse;margin-bottom:6px"><thead><tr>' +
      entetes.filter(function (e, i) { return vis[i]; }).map(function (e) { return '<th style="' + TH_ + '"><b>' + e[0] + '</b></th>'; }).join('') +
      '</tr></thead><tbody>' + lignes + '</tbody></table>';
  }

  function pied(o, mod) {
    var signatures = ['Unité Administrative', 'Intéressé(e)', 'Directeur'].map(function (t) {
      return '<td style="width:33%;border:1px solid #000;padding:4px;vertical-align:top;height:58px">' +
        '<div style="font-size:10.5px;font-weight:700;text-decoration:underline;text-align:center">' + t + '</div></td>';
    }).join('<td style="width:2%"></td>');
    return '<table style="width:100%;border-collapse:collapse;margin-bottom:8px"><tr>' +
      '<td style="' + TD + ';font-size:12px;font-weight:700">NET A PAYER</td>' +
      '<td style="' + TDD + ';font-size:13px;font-weight:700;width:30%">' + fmt(o.hok.net) + '</td></tr></table>' +
      '<table style="width:100%;border-collapse:collapse"><tr>' + signatures + '</tr></table>' +
      (mod.afficherPied === false ? '' :
        '<p style="font-size:9.5px;font-weight:700;text-align:center;margin:8px 0 0">Pour vous aider à faire valoir vos droits, conservez ce bulletin de paie sans limitation de durée.' +
        (mod.pied ? ' ' + esc(mod.pied) : '') + '</p>');
  }

  function html(o) {
    if (!o.hok) return '';
    var mod = o.modele || {};
    var blocs = (mod.blocs && mod.blocs.length) ? mod.blocs : BLOCS_DEFAUT;
    var rendu = {
      entete: function () { return entete(o, mod); },
      salarie: function () { return zoneSalarie(o); },
      rubriques: function () { return tableau(o, mod); },
      pied: function () { return pied(o, mod); }
    };
    var libreLogo = (mod.logo && mod.logoPos !== 'aucun' && mod.logoX !== undefined && mod.logoY !== undefined)
      ? '<img src="' + mod.logo + '" alt="" style="position:absolute;left:' + (Number(mod.logoX) || 0) + 'mm;top:' + (Number(mod.logoY) || 0) + 'mm;height:' + (Number(mod.logoH) || 15) + 'mm;width:auto">' : '';
    return '<div class="bs-bulletin" style="position:relative;height:297mm;box-sizing:border-box;display:flex;flex-direction:column;font-family:Arial,sans-serif;color:#000;font-size:10px;width:100%;-webkit-print-color-adjust:exact;print-color-adjust:exact">' + libreLogo + 
      blocs.map(function (b) { return b === 'pied' ? '<div style="margin-top:auto">' + rendu.pied() + '</div>' : (rendu[b] ? rendu[b]() : ''); }).join('') + '</div>';
  }

  root.PaieBulletinOcean = { html: html };
})(typeof window !== 'undefined' ? window : globalThis);
