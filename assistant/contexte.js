/* assistant/contexte.js — Construction du contexte de l'assistant (étape 3 de l'extraction).
 * Fonction pure : reçoit les chiffres déjà calculés par la page, ne lit rien dans la page.
 * N'inclut un bloc que si la question le concerne (sujets), et ne contient aucun nom de personne.
 */
(function (root) {
  'use strict';

  function construire(d) {
    d = d || {};
    var s = d.sujets || { contrats: true, cnps: true, visites: true, discipline: true };
    var e = d.effectif || {};
    var disc = d.disciplinaire || {};
    var parts = [d.entete || ''];
    parts.push('Effectif actif ' + (e.total || 0) + ' (' + (e.femmes || 0) + ' femmes) : CDI ' + (e.cdi || 0) +
      ', CDD ' + (e.cdd || 0) + ', CTT ' + (e.ctt || 0) + ', occasionnels ' + (e.occasionnels || 0) + '.');
    if (s.contrats) parts.push('Contrats expirés ou à échéance sous 90 j : ' + (d.contratsEcheance || 0) + '.');
    if (s.cnps) parts.push('CNPS en retard : ' + (d.cnpsRetard || 0) + '.');
    if (s.visites) parts.push('Visites médicales expirées : ' + (d.visitesExpirees || 0) + '.');
    if (s.discipline) parts.push('Suivi disciplinaire : ' + (disc.dossiers || 0) + ' dossier(s), ' +
      (disc.attente || 0) + ' demande(s) en attente, ' + (disc.sanctions || 0) + ' sanction(s).');
    return parts.join(' ');
  }

  var API = { construire: construire };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.AssistantContexte = API;
})(typeof window !== 'undefined' ? window : globalThis);
