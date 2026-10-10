/* assistant/conversation.js — Mémoire de la conversation (étape 2 de l'extraction de l'assistant).
 * Historique limité, sans accès réseau. Effacé par reset (déconnexion).
 */
(function (root) {
  'use strict';
  var MAX = 24;
  var SALUTATION = /^(bonjour|bonsoir|salut|hello|coucou)(\s+[\p{L}-]+)?\s*[!.?,]*$/iu;

  function creer() {
    var h = [];
    return {
      ajouter: function (question, reponse) {
        h.push({ role: 'user', content: String(question || '') }, { role: 'assistant', content: String(reponse || '') });
        while (h.length > MAX) h.shift();
      },
      precedents: function (n) { return h.slice(-(n || 12)); },
      estVide: function () { return h.length === 0; },
      reset: function () { h.length = 0; },
      // Une salutation répétée au cours d'une conversation ne relance pas l'accueil
      estSalutationRepetee: function (question) {
        return SALUTATION.test(String(question || '').trim()) && h.length > 0;
      },
      taille: function () { return h.length; }
    };
  }

  var API = { creer: creer, MAX: MAX, SALUTATION: SALUTATION };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.AssistantConversation = API;
})(typeof window !== 'undefined' ? window : globalThis);
