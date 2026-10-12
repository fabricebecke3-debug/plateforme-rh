/* export-outils.js — Exports CSV (Excel, Power BI), seuil de réussite et attestation de suivi.
 * Fonctions pures, sans accès réseau. Testées par scripts/test-exports.js.
 * Le seuil de réussite est fixé à 70 % au QCM (décision à confirmer par l'employeur).
 */
(function (root) {
  'use strict';
  var SEUIL_REUSSITE = 70;   // % au QCM
  var COURS_REQUIS = 11;     // nombre de cours à lire pour l'attestation

  function echapper(t) {
    return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  // CSV compatible Excel français et Power BI : séparateur « ; », UTF-8 avec BOM
  function cellule(v) {
    if (v == null) return '';
    var s = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
    if (/[;"\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function csvDeModule(cols, lignes) {
    var entete = cols.map(function (c) { return cellule(c.l || c.k); }).join(';');
    var corps = (lignes || []).map(function (r) {
      return cols.map(function (c) { return cellule(r[c.k]); }).join(';');
    });
    return '\ufeff' + [entete].concat(corps).join('\r\n');
  }
  // Éligibilité à l'attestation : un QCM au-dessus du seuil ET tous les cours lus
  function attestationEligible(lignes, opts) {
    var seuil = (opts && opts.seuil) || SEUIL_REUSSITE;
    var requis = (opts && opts.coursRequis) || COURS_REQUIS;
    var l = lignes || [];
    var scores = l.filter(function (r) { return /^qcm-/.test(r.module || '') && typeof r.score === 'number'; })
                  .map(function (r) { return r.score; });
    var meilleur = scores.length ? Math.max.apply(null, scores) : null;
    var cours = {};
    l.forEach(function (r) { if (/^lu-/.test(r.module || '')) cours[r.module] = true; });
    var coursLus = Object.keys(cours).length;
    var manque = [];
    if (meilleur == null || meilleur < seuil) manque.push('un QCM réussi à ' + seuil + ' % (meilleur score : ' + (meilleur == null ? 'aucun' : meilleur + ' %') + ')');
    if (coursLus < requis) manque.push('la lecture de tous les cours (' + coursLus + ' / ' + requis + ')');
    return { ok: manque.length === 0, meilleur: meilleur, coursLus: coursLus, coursRequis: requis, seuil: seuil, manque: manque };
  }
  // Contenu imprimable de l'attestation de suivi (non diplômante)
  function attestationHTML(o) {
    var e = attestationEligible(o.lignes, o);
    var modules = (o.lignes || []).filter(function (r) { return r.termine; }).map(function (r) {
      var nom = o.libelle ? o.libelle(r.module || '') : (r.module || '');
      return '<li>' + echapper(nom) + (typeof r.score === 'number' ? ' — ' + r.score + ' %' : '') + '</li>';
    }).join('');
    return '<div style="font-family:Arial,sans-serif;color:#000">' +
      '<h1 style="font-size:20pt;text-align:center;margin:0 0 6px">Attestation de suivi de formation</h1>' +
      '<p style="text-align:center;margin:0 0 22px;font-style:italic">Formation de sensibilisation, non diplômante</p>' +
      '<p>Il est attesté que <b>' + echapper(o.nom || '—') + '</b> a suivi le module Apprentissage de la plateforme (cours, exercices et QCM).</p>' +
      '<p>Cours lus : ' + e.coursLus + ' / ' + e.coursRequis + '. Meilleur score au QCM : ' + (e.meilleur == null ? '—' : e.meilleur + ' %') + ' (seuil de réussite : ' + e.seuil + ' %).</p>' +
      (modules ? '<ul>' + modules + '</ul>' : '') +
      '<p style="font-size:9pt;color:#444;margin-top:18px">Cette attestation atteste d\'un suivi de formation. Elle ne constitue pas un diplôme ni un avis juridique : les textes applicables doivent être vérifiés à la source officielle.</p>' +
      '<p style="margin-top:30px">Délivrée le ' + echapper(o.date || '') + '.</p>' +
      '<p style="margin-top:30px">Signature : ____________________</p>' +
      '</div>';
  }
  var API = { SEUIL_REUSSITE: SEUIL_REUSSITE, COURS_REQUIS: COURS_REQUIS, csvDeModule: csvDeModule, attestationEligible: attestationEligible, attestationHTML: attestationHTML };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.ExportOutils = API;
})(typeof window !== 'undefined' ? window : globalThis);
