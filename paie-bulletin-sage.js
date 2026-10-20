/* paie-bulletin-sage.js — Bulletin de paie dans la mise en page Sage (4 blocs) :
 *  1. En-tête : employeur | période, paiement, mode | matricule, niveau, coefficient, indice, ancienneté, N° sécurité sociale
 *             | catégorie, emploi occupé, département | qualification, horaire, convention
 *  2. Zone salarié (nom, adresse) et congés (acquis, reste à prendre, pris ; dates de congés)
 *  3. Tableau des rubriques : N° | désignation | nombre | base | part salariale (taux, gain, retenue) | part patronale (taux, retenue)
 *  4. Pied : cumuls (période et année) et NET À PAYER
 * Entrée : PaieBulletinSage.html(o) avec o = {salarie, bulletin, nom, periode, paiement, lignes, resultat, cumuls}
 * Les montants viennent du moteur (PaieMoteur) : aucun calcul ici.
 */
(function (root) {
  'use strict';

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(n) {
    var v = Math.round(Number(n) || 0);
    return (v < 0 ? '-' : '') + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }
  function nb(v, dec) {
    if (v === null || v === undefined || v === '' || !isFinite(Number(v))) return '';
    return Number(v).toFixed(dec === undefined ? 0 : dec).replace('.', ',');
  }
  function vide(v) { return (v === null || v === undefined || v === '') ? '' : v; }
  function teinte(c) { return /^#[0-9a-fA-F]{6}$/.test(c || '') ? c : '#cfe8cf'; }

  // Date « JJ/MM/AA au JJ/MM/AA » -> { debut, fin } en JJ/MM/AA
  function bornes(periode) {
    var m = /(\d{2}\/\d{2}\/\d{2,4})\s+au\s+(\d{2}\/\d{2}\/\d{2,4})/.exec(String(periode || ''));
    return m ? { debut: m[1], fin: m[2] } : { debut: '', fin: '' };
  }

  function cellule(lib, val, w) {
    return '<td style="border:1px solid #444;padding:1px 4px;vertical-align:top;width:' + (w || 'auto') + '">' +
      '<div style="font-size:8px;color:#333">' + lib + '</div><div style="font-size:10px">' + esc(vide(val)) + '</div></td>';
  }

  // Logo : celui du modèle, sinon celui de la société ; emplacement choisi dans le modèle
  function logoDuBulletin(o) {
    var mod = o.modele || {};
    var src = mod.logo || (o.bulletin || {}).logo || '';
    if (!/^data:image\/(png|jpeg|svg\+xml);base64,/.test(src)) return { html: '', pos: '' };
    return { html: '<img src="' + src + '" alt="" style="max-height:60px;max-width:180px;display:block;margin-bottom:4px">', pos: mod.logoPos || 'gauche' };
  }
  function enTete(o, R, couleur) {
    var s = o.salarie || {}, b = o.bulletin || {}, per = bornes(o.periode);
    var logo = logoDuBulletin(o);
    var logoG = logo.pos === 'gauche' ? logo.html : '';
    var logoD = logo.pos === 'droite' ? logo.html : '';
    var paiement = o.paiement || per.fin || '';
    var anc = s.anciennete || '';
    return '<table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:0">' +
      '<tr>' +
        '<td style="border:1px solid #444;width:40%;padding:4px 6px;background:' + couleur + ';font-size:14px;font-weight:700;vertical-align:middle">' + logoD + 'BULLETIN DE PAIE</td>' +
        '<td style="border:1px solid #444;padding:3px 6px;vertical-align:top">Période du : <b>' + esc(per.debut) + '</b> &nbsp; au : <b>' + esc(per.fin) + '</b></td>' +
        '<td style="border:1px solid #444;padding:3px 6px;vertical-align:top">Paiement le : <b>' + esc(paiement) + '</b> &nbsp; par : Virement</td>' +
      '</tr>' +
      '<tr>' +
        '<td rowspan="3" style="border:1px solid #444;padding:4px 6px;vertical-align:top;line-height:1.35">' +
          logoG + '<b>' + esc(b.societe || o.employeur || '') + '</b><br>' + esc(b.adresse || '') +
          (b.siret ? '<br>N° SIRET : ' + esc(b.siret) : '') + (b.cnps ? '<br>N° CNPS employeur : ' + esc(b.cnps) : '') + '</td>' +
        '<td style="border:1px solid #444;padding:0"><table style="width:100%;border-collapse:collapse"><tr>' +
          cellule('Matricule', s.matricule, '20%') + cellule('Niveau', s.niveau, '14%') + cellule('Coefficient', s.coefficient, '18%') +
          cellule('Indice', s.indice, '14%') + cellule('Ancienneté', anc, '34%') + '</tr></table></td>' +
        '<td style="border:1px solid #444;padding:0"><table style="width:100%;border-collapse:collapse"><tr>' +
          cellule('N° de sécurité sociale (CNPS)', s.secu || o.cnps, '100%') + '</tr></table></td>' +
      '</tr>' +
      '<tr>' +
        '<td style="border:1px solid #444;padding:0"><table style="width:100%;border-collapse:collapse"><tr>' +
          cellule('Catégorie', s.categorie, '30%') + cellule('Emploi occupé', s.emploi, '40%') + cellule('Département', s.departement, '30%') + '</tr></table></td>' +
        '<td style="border:1px solid #444;padding:0"><table style="width:100%;border-collapse:collapse"><tr>' +
          cellule('Date d\'embauche', s.embauche, '50%') + cellule('Lieu de travail', s.lieu, '50%') + '</tr></table></td>' +
      '</tr>' +
      '<tr>' +
        '<td style="border:1px solid #444;padding:0"><table style="width:100%;border-collapse:collapse"><tr>' +
          cellule('Qualification', s.qualification, '34%') + cellule('Horaire (h/mois)', nb(s.horaire || 173.33, 3), '33%') + cellule('Convention collective', s.convention, '33%') + '</tr></table></td>' +
        '<td style="border:1px solid #444;padding:0"><table style="width:100%;border-collapse:collapse"><tr>' +
          cellule('Établissement', s.etablissement, '100%') + '</tr></table></td>' +
      '</tr>' +
    '</table>';
  }

  function zoneSalarie(o) {
    var s = o.salarie || {}, c = o.conges || {};
    return '<table style="width:100%;border-collapse:collapse;font-size:10px;margin-top:0"><tr>' +
      '<td style="border:1px solid #444;width:38%;vertical-align:top;padding:4px 6px;font-size:10px">' +
        '<table style="width:100%;border-collapse:collapse;font-size:9px"><tr><th style="border:1px solid #888;background:#f2f2f2"></th><th style="border:1px solid #888;background:#f2f2f2">Acquis</th><th style="border:1px solid #888;background:#f2f2f2">Reste à prendre</th><th style="border:1px solid #888;background:#f2f2f2">Pris</th></tr>' +
        '<tr><td style="border:1px solid #888">Repos comp.</td><td style="border:1px solid #888;text-align:right">' + nb(c.reposAcquis, 3) + '</td><td style="border:1px solid #888;text-align:right">' + nb(c.reposReste, 3) + '</td><td style="border:1px solid #888;text-align:right">' + nb(c.reposPris, 3) + '</td></tr>' +
        '<tr><td style="border:1px solid #888">Congés</td><td style="border:1px solid #888;text-align:right">' + nb(c.congesAcquis, 3) + '</td><td style="border:1px solid #888;text-align:right">' + nb(c.congesReste, 3) + '</td><td style="border:1px solid #888;text-align:right">' + nb(c.congesPris, 3) + '</td></tr></table>' +
        '<div style="margin-top:6px;font-size:9px">Dates de congés : du ' + esc(vide(c.du)) + ' au ' + esc(vide(c.au)) + '</div></td>' +
      '<td style="border:1px solid #444;vertical-align:top;padding:6px 10px;background:#eef7ee">' +
        '<div style="font-size:12px;font-weight:700">' + esc(vide(o.nom || s.nom)) + '</div>' +
        '<div style="font-size:10px;margin-top:4px">' + esc(vide(s.adresse)) + '</div>' +
        (o.commentaire ? '<div style="font-size:9px;margin-top:6px;color:#333">Commentaire : ' + esc(o.commentaire) + '</div>' : '') +
      '</td></tr></table>';
  }

  // Lignes du tableau : (code, désignation, nombre, base, taux sal., gain, retenue sal., taux pat., retenue pat.)
  function lignesTableau(o, R) {
    var L = [];
    var gains = (o.lignes || []).filter(function (l) { return !l.retenue; });
    var rubG = (R.rubriques || []).filter(function (r) { return !r.retenue; });
    gains.forEach(function (l, i) {
      var g = rubG[i] ? rubG[i].gain : 0;
      L.push({ code: l.code, lib: l.lib || '', nombre: l.nombre, base: l.base, taux: l.taux, gain: g, gainLigne: true });
    });
    L.push({ total: 'Total brut', gain: R.brut });
    var S = R.salariales, P = R.patronales;
    L.push({ code: '8100', lib: 'Pension vieillesse CNPS', base: R.baseCNPS, tauxS: 4.2, ret: S.cnps, tauxP: 4.2, retP: P.cnps });
    L.push({ code: '8110', lib: 'Accident de Travail', base: (R.baseAT != null ? R.baseAT : R.baseCNPS), tauxS: 0, ret: 0, tauxP: 2.5, retP: P.at });
    L.push({ code: '8120', lib: 'Prestations Familiales', base: R.baseCNPS, tauxS: 0, ret: 0, tauxP: 7, retP: P.pf });
    L.push({ code: '8130', lib: "Fonds National de l'Emploi", base: R.baseCNPS, tauxS: 0, ret: 0, tauxP: 1, retP: P.fne });
    L.push({ code: '8140', lib: 'Crédit Foncier Patronal', base: R.baseCFC, tauxS: 0, ret: 0, tauxP: 1.5, retP: P.cfc });
    L.push({ total: 'Total cotisations', ret: S.cnps, retP: P.cnps + P.at + P.pf + P.fne + P.cfc, totalCot: true });
    L.push({ code: '9019', lib: 'IRPP', ret: S.irpp });
    L.push({ code: '9032', lib: 'C A C / IRPP', base: S.irpp, tauxS: 10, ret: S.cac });
    L.push({ code: '9064', lib: 'Crédit Foncier sal. CFC', base: R.saltaxf, tauxS: 1, ret: S.cfc });
    if (S.taxeCommunale) L.push({ code: '9070', lib: 'Taxe communale', ret: S.taxeCommunale });
    if (S.taxeDevLocal) L.push({ code: '9071', lib: 'Taxe de développement local', ret: S.taxeDevLocal });
    if (S.taxeProp) L.push({ code: '9060', lib: 'Taxe proportionnelle', ret: S.taxeProp });
    L.push({ code: '9230', lib: 'Redevance audiovisuelle', ret: S.redevance });
    (o.lignes || []).filter(function (l) { return l.retenue; }).forEach(function (l) {
      L.push({ code: l.code, lib: l.lib || '', ret: Number(l.gain) || 0, retenueDiverse: true });
    });
    return L;
  }

  // Colonnes du tableau, selon le modèle (nombre, base, taux, retenue patronale peuvent être masqués)
  var COLS = [['nombre', 'Nombre'], ['base', 'Base'], ['taux', 'Taux'], ['gain', 'Gain'], ['ret', 'Retenue salariale'], ['tauxP', 'Taux pat.'], ['retP', 'Retenue patronale']];
  function colonnesVisibles(mod) {
    var c = (mod && mod.colonnes) || {};
    return COLS.filter(function (k) {
      if (k[0] === 'nombre') return c.nombre !== false;
      if (k[0] === 'base') return c.base !== false;
      if (k[0] === 'taux' || k[0] === 'tauxP') return c.taux !== false;
      if (k[0] === 'retP') return c.retenuePatronale !== false;
      return true;
    });
  }
  // Valeurs affichées pour une ligne (chaque clé = une colonne)
  function valeursLigne(r, sansPatr) {
    var v = {};
    if (r.total) {
      if (r.totalCot) { v.ret = fmt(r.ret); v.retP = sansPatr ? '' : fmt(r.retP); }
      else { v.gain = fmt(r.gain); }
      return v;
    }
    if (r.gainLigne) {
      v.nombre = (r.nombre != null && r.nombre !== '') ? nb(r.nombre, 3) : '';
      v.base = (r.base != null && r.base !== '') ? nb(r.base, 3) : '';
      v.taux = (r.taux != null && r.taux !== '') ? nb(r.taux, 3) : '';
      v.gain = fmt(r.gain);
      return v;
    }
    v.base = r.base != null ? fmt(r.base) : '';
    v.taux = r.tauxS != null ? nb(r.tauxS, 3) : '';
    v.ret = r.ret ? fmt(r.ret) : (r.ret === 0 && r.code ? '0' : '');
    v.tauxP = r.tauxP != null ? nb(r.tauxP, 3) : '';
    v.retP = sansPatr ? '' : (r.retP ? fmt(r.retP) : (r.retP === 0 && r.code ? '0' : ''));
    return v;
  }
  function corpsTableau(L, cols, sansPatr) {
    return L.map(function (r) {
      var v = valeursLigne(r, sansPatr);
      var gras = r.total ? 'font-weight:700;' : '';
      var td = function (x, al) { return '<td style="border:1px solid #bbb;padding:1px 4px;text-align:' + (al || 'right') + ';white-space:nowrap">' + x + '</td>'; };
      return '<tr style="' + gras + '">' + td(r.total ? '' : esc(r.code || ''), 'left') +
        td(r.total ? esc(r.total) : esc(r.lib || ''), 'left') +
        cols.map(function (c) { return td(v[c[0]] || ''); }).join('') + '</tr>';
    }).join('');
  }
  function tableau(o, R, couleur) {
    var mod = o.modele || {};
    var cols = colonnesVisibles(mod);
    var L = lignesTableau(o, R);
    var th = function (t, al) { return '<th style="border:1px solid #444;background:' + couleur + ';padding:2px 4px;font-size:9px;text-align:' + (al || 'center') + '">' + t + '</th>'; };
    return '<table style="width:100%;border-collapse:collapse;font-size:9.5px;margin-top:0">' +
      '<thead><tr>' + th('N°', 'left') + th('Désignation', 'left') + cols.map(function (c) { return th(c[1]); }).join('') + '</tr></thead>' +
      '<tbody>' + corpsTableau(L, cols, o._sansPatronales) + '</tbody></table>';
  }

  function pied(o, R, couleur) {
    var c = o.cumuls || {}, per = c.periode || {}, an = c.annee || {};
    var S = R.salariales, P = R.patronales;
    var cotSal = S.cnps + S.cfc + S.irpp + S.cac + S.redevance + S.taxeCommunale + (S.taxeDevLocal || 0) + (S.taxeProp || 0);
    var heures = (o.lignes || []).filter(function (l) { return String(l.code) === '1000'; })[0];
    var hTrav = heures && heures.nombre ? Math.round(Number(heures.nombre)) : '';
    var hSup = (o.lignes || []).filter(function (l) { return l.heures_sup; }).reduce(function (t, l) { return t + (Number(l.nombre) || 0); }, 0);
    var ligne = function (lib, v) {
      return '<tr><td style="border:1px solid #444;padding:2px 4px;text-align:left;width:9%">' + lib + '</td>' +
        '<td style="border:1px solid #444;padding:2px 4px;text-align:right">' + v[0] + '</td>' +
        '<td style="border:1px solid #444;padding:2px 4px;text-align:right">' + v[1] + '</td>' +
        '<td style="border:1px solid #444;padding:2px 4px;text-align:right">' + v[2] + '</td>' +
        '<td style="border:1px solid #444;padding:2px 4px;text-align:right">' + v[3] + '</td>' +
        '<td style="border:1px solid #444;padding:2px 4px;text-align:right">' + v[4] + '</td>' +
        '<td style="border:1px solid #444;padding:2px 4px;text-align:right">' + v[5] + '</td>' +
        '<td style="border:1px solid #444;padding:2px 4px;text-align:right">' + v[6] + '</td></tr>';
    };
    var periodeV = [fmt(R.brut), fmt(R.netImposable), fmt(cotSal), fmt(R.totalPatronales), hTrav, fmt(hSup), '0'];
    var anneeV = [fmt(an.brut), fmt(an.netImposable), fmt(an.cotisationsSalariales), fmt(an.chargesPatronales), fmt(an.heures), fmt(an.heuresSup), '0'];
    return '<table style="width:100%;border-collapse:collapse;font-size:9.5px;margin-top:8px">' +
      '<tr><th style="border:1px solid #444;background:' + couleur + ';padding:2px 4px;width:9%">Cumuls</th><th style="border:1px solid #444;background:' + couleur + ';padding:2px 4px">Salaire brut</th><th style="border:1px solid #444;background:' + couleur + ';padding:2px 4px">Net imposable</th><th style="border:1px solid #444;background:' + couleur + ';padding:2px 4px">Cotisations salariales</th><th style="border:1px solid #444;background:' + couleur + ';padding:2px 4px">Charges patronales</th><th style="border:1px solid #444;background:' + couleur + ';padding:2px 4px">Heures travaillées</th><th style="border:1px solid #444;background:' + couleur + ';padding:2px 4px">Heures sup.</th><th style="border:1px solid #444;background:' + couleur + ';padding:2px 4px">Avantages en nature</th></tr>' +
      ligne('Période', periodeV) + ligne('Année', anneeV) + '</table>' +
      '<table style="width:100%;border-collapse:collapse;margin-top:6px"><tr>' +
        '<td style="border:2px solid #444;padding:8px 10px;font-size:15px;font-weight:700;background:' + couleur + ';width:45%">NET À PAYER</td>' +
        '<td style="border:2px solid #444;padding:8px 10px;font-size:18px;font-weight:700;text-align:right">' + fmt(R.net) + ' FCFA</td></tr></table>' +
      (o._sansPied ? '' : '<p style="font-size:8.5px;color:#333;margin:8px 0 0">Pour vous aider à faire valoir vos droits, conservez ce bulletin de paie sans limitation de durée. ' + esc(o._pied || '') + '</p>') +
      (o._sansPatronales ? '' : '<p style="font-size:8.5px;color:#333;margin:4px 0 0">Coût total employeur : ' + fmt(R.coutEmployeur) + ' FCFA.</p>');
  }

  function html(o) {
    var R = o.resultat;
    if (!R) return '';
    var mod = o.modele || {};
    var couleur = teinte(mod.couleur || (o.bulletin || {}).couleur);
    if (mod.afficherPatronales === false) o = Object.assign({}, o, { _sansPatronales: true });
    if (mod.afficherPied === false) o = Object.assign({}, o, { _sansPied: true });
    o = Object.assign({}, o, { _pied: mod.pied || '' });
    var blocs = (mod.blocs && mod.blocs.length) ? mod.blocs : ['entete', 'salarie', 'rubriques', 'pied'];
    var rendu = {
      entete: function () { return enTete(o, R, couleur); },
      salarie: function () { return zoneSalarie(o); },
      rubriques: function () { return tableau(o, R, couleur); },
      pied: function () { return pied(o, R, couleur); }
    };
    var pied_logo = logoDuBulletin(o).pos === 'pied' ? '<div style="margin-top:6px">' + logoDuBulletin(o).html + '</div>' : '';
    return '<div style="font-family:Arial,sans-serif;color:#000;font-size:10px;width:100%">' +
      blocs.map(function (b) { return rendu[b] ? rendu[b]() : ''; }).join('') + pied_logo + '</div>';
  }

  root.PaieBulletinSage = { html: html, lignesTableau: lignesTableau, bornes: bornes };
})(typeof window !== 'undefined' ? window : globalThis);
