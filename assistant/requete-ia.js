/* assistant/requete-ia.js — Construction de la requête envoyée à l'IA (étape 1 de l'extraction de l'assistant).
 * Fonction pure : aucune dépendance à la page. Le contexte est caviardé s'il passe par IAContexte.
 */
(function (root) {
  'use strict';
  var HISTORIQUE_MAX = 12;
  var CONTENU_MAX = 4000;

  // Messages : historique récent (rôles user/assistant uniquement) puis la question courante
  function messages(question, precedents) {
    var liste = (precedents || [])
      .filter(function (m) { return m && (m.role === 'user' || m.role === 'assistant'); })
      .slice(-HISTORIQUE_MAX)
      .map(function (m) { return { role: m.role, content: String(m.content || '').slice(0, CONTENU_MAX) }; });
    liste.push({ role: 'user', content: String(question || '').slice(0, CONTENU_MAX) });
    return liste;
  }

  // Contexte : caviardé si le module de minimisation est disponible
  function contexte(texte) {
    var t = String(texte || '');
    if (root.IAContexte && typeof root.IAContexte.redacter === 'function') t = root.IAContexte.redacter(t);
    return t;
  }

  // Corps de la requête, tel qu'attendu par la fonction serveur ai-chat
  function construireRequete(opts) {
    opts = opts || {};
    return {
      messages: messages(opts.question, opts.precedents),
      context: contexte(opts.contexte),
      user_first: opts.userFirst || '',
      client_hour: typeof opts.heure === 'number' ? opts.heure : 12,
      lang: opts.lang || 'fr',
      max_tokens: 800
    };
  }

  var API = { construireRequete: construireRequete, messages: messages, contexte: contexte, HISTORIQUE_MAX: HISTORIQUE_MAX };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.AssistantRequete = API;
})(typeof window !== 'undefined' ? window : globalThis);
