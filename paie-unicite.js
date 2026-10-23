/* paie-unicite.js — Unicité des identifiants de paie.
 *  - un CODE de rubrique désigne UNE seule rubrique (même code = même libellé partout) ;
 *  - un MATRICULE appartient à UN seul salarié ;
 *  - un N° CNPS appartient à UN seul salarié.
 * Chaque fonction renvoie la liste des conflits (vide = rien à corriger).
 */
(function (root) {
  'use strict';

  function norm(x) { return String(x == null ? '' : x).trim(); }
  function chiffres(x) { return norm(x).replace(/\D/g, ''); }
  function libNorm(x) { return norm(x).toLowerCase().replace(/\s+/g, ' '); }

  // Matricules : deux fiches avec le même matricule = conflit
  function matricules(fiches) {
    var par = {};
    (fiches || []).forEach(function (f) {
      var m = norm(f.matricule || f.mat); if (!m) return;
      (par[m] = par[m] || []).push(norm(f.nom) || norm(f.id));
    });
    return Object.keys(par).filter(function (m) { return par[m].length > 1; })
      .map(function (m) { return 'Matricule « ' + m + ' » attribué à ' + par[m].length + ' salariés : ' + par[m].join(', '); });
  }

  // N° CNPS : mêmes chiffres = même personne ; deux salariés avec le même numéro = conflit
  function cnps(fiches) {
    var par = {};
    (fiches || []).forEach(function (f) {
      var c = chiffres(f.cnps); if (!c) return;
      (par[c] = par[c] || []).push(norm(f.nom) || norm(f.id));
    });
    return Object.keys(par).filter(function (c) { return par[c].length > 1; })
      .map(function (c) { return 'N° CNPS ' + c + ' attribué à ' + par[c].length + ' salariés : ' + par[c].join(', '); });
  }

  // Codes de rubrique : un code ne peut avoir qu'un libellé dans toute la paie (rows = [{code, lib}] de tous les salariés)
  function codes(rows) {
    var libs = {};
    (rows || []).forEach(function (r) {
      var c = norm(r.code); if (!c) return;
      libs[c] = libs[c] || {};
      libs[c][libNorm(r.lib)] = norm(r.lib);
    });
    return Object.keys(libs).filter(function (c) { return Object.keys(libs[c]).length > 1; })
      .map(function (c) { return 'Code ' + c + ' désigne plusieurs rubriques : ' + Object.keys(libs[c]).map(function (k) { return '« ' + libs[c][k] + ' »'; }).join(', '); });
  }

  root.PaieUnicite = { matricules: matricules, cnps: cnps, codes: codes };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PaieUnicite;
})(typeof window !== 'undefined' ? window : globalThis);
