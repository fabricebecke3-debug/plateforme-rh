/* ia-contexte.js — Minimisation des données envoyées au fournisseur d'IA.
 * - redacter : remplace les coordonnées et identifiants par un marqueur.
 * - sujetsPertinents : indique quels blocs de données la question concerne réellement.
 * Fonctions pures, sans accès réseau. Testées par scripts/test-ia-contexte.js.
 */
(function (root) {
  'use strict';
  function normaliser(t) {
    return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  function redacter(texte) {
    return String(texte || '')
      .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[adresse]')
      .replace(/\b\d{3}-\d{7}-\d\b/g, '[n° CNPS]')
      .replace(/\+?\d[\d ]{7,}\d/g, '[numéro]')
      .replace(/\b\d{9,}\b/g, '[numéro]');
  }
  function sujetsPertinents(question) {
    var q = normaliser(question);
    return {
      contrats: /contrat|cdd|ctt|temporaire|occasionnel|echeance|expir|renouvel|periode d.essai|essai/.test(q),
      cnps: /cnps|cotis|declaration|dipe/.test(q),
      visites: /visite|medical|aptitude/.test(q),
      discipline: /disciplin|sanction|avertissement|mise a pied|demande d.explication|faute|licenci/.test(q)
    };
  }
  var API = { redacter: redacter, sujetsPertinents: sujetsPertinents, normaliser: normaliser };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.IAContexte = API;
})(typeof window !== 'undefined' ? window : globalThis);
