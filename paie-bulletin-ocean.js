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
  var TD = 'border:1px solid #000;padding:2px 4px;font-size:10.5px;vertical-align:middle';
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
    var logo = (mod && mod.logo && mod.logoPos !== 'aucun')
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

  // Tableau : N° | Désignation | Nombre jour | Base unitaire | Taux | Gain | Retenue
  function tableau(o) {
    var H = o.hok;
    var entetes = ['N°', 'Désignation', 'Nombre<br>Jour', 'Base<br>Unitaire', 'Taux', 'Gain', 'Retenue'];
    var droite = ';text-align:right';
    var lignes = '';
    H.gains.forEach(function (g) {
      lignes += '<tr>' + cell(esc(g.code)) + cell(esc(g.lib)) +
        cell(g.nombre != null ? nb(g.nombre, 0) : '', droite) +
        cell(g.base != null ? fmt(g.base) : '', droite) +
        cell(pct(g.taux), droite) + cell(fmt(g.gain), droite) + cell('') + '</tr>';
    });
    lignes += '<tr>' + cell('') + cell('<b>Total Brut</b>') + cell('') + cell('') + cell('') +
      cell('<b>' + fmt(H.brut) + '</b>', droite) + cell('') + '</tr>';
    H.retenues.forEach(function (r) {
      lignes += '<tr>' + cell(esc(r.code)) + cell(esc(r.lib)) + cell('') +
        cell(r.base != null ? fmt(r.base) : '', droite) + cell(pct(r.taux), droite) +
        cell('', droite) + cell(fmt(r.ret), droite) + '</tr>';
    });
    lignes += '<tr>' + cell('') + cell('<b>Total Cotisations</b>') + cell('') + cell('') + cell('') +
      cell('') + cell('<b>' + fmt(H.totalRetenues) + '</b>', droite) + '</tr>';
    // Rappels et avances : lignes du bulletin papier, hors total cotisations
    lignes += '<tr>' + cell('29') + cell(H.libRappel || 'Rappels') + cell('') + cell('') + cell('') + cell('') + cell(fmt(H.rappel || 0), droite) + '</tr>';
    lignes += '<tr>' + cell('26') + cell(H.libAvance || 'Avance sur Salaire') + cell('') + cell('') + cell('') + cell('') + cell(fmt(H.avance || 0), droite) + '</tr>';
    var alerte = (H.erreurs && H.erreurs.length) ? '<div style="color:#c0392b;font-size:10px;font-weight:700;margin-bottom:4px">Attention, formule à corriger : ' + esc(H.erreurs.join(' ; ')) + '</div>' : '';
    return alerte + '<table style="width:100%;border-collapse:collapse;margin-bottom:6px"><thead><tr>' +
      entetes.map(function (t) { return '<th style="' + TD + ';background:#f2f2f2;font-size:10px">' + t + '</th>'; }).join('') +
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
      rubriques: function () { return tableau(o); },
      pied: function () { return pied(o, mod); }
    };
    return '<div class="bs-bulletin" style="position:relative;font-family:Arial,sans-serif;color:#000;font-size:10px;width:100%">' + 
      blocs.map(function (b) { return rendu[b] ? rendu[b]() : ''; }).join('') + '</div>';
  }

  root.PaieBulletinOcean = { html: html };
})(typeof window !== 'undefined' ? window : globalThis);
