/* assistant/texte.js — Textes de l'assistant (étape 4 de l'extraction) : base de réponses, nettoyage,
 * découpage pour la voix, messages d'erreur. Fonctions pures, sans accès à la page.
 */
(function (root) {
  'use strict';
  var FAQ = [
    { q: ['comment vas tu', 'comment ca va', 'ca va', 'tu vas bien', 'comment allez vous', 'comment allez-vous', 'comment tu vas'], a: "Je vais très bien, merci de demander ! Et vous, comment se passe votre journée ? Dites-moi ce dont vous avez besoin, je suis là pour vous aider." },
    { q: ['merci', 'merci beaucoup'], a: "Avec plaisir ! N'hésitez pas si vous avez une autre question." },
    { q: ['au revoir', 'a bientot', 'bonne journee', 'bonne soiree', 'a plus'], a: "Au revoir, et bonne journée ! Je reste disponible pour vos questions." },
    { q: ['bonsoir'], a: "Bonsoir ! Comment puis-je vous aider ?" },
    { q: ['comment tu t appelles', 'ton nom', 'qui es tu', 'qui etes vous', 'votre nom'], a: "Je suis l'Assistant RH, un assistant IA de la plateforme. Je réponds à vos questions RH et sur l'application." },
    { q: ['bonjour', 'salut', 'bonjour a tous'], a: "Bonjour, ravi de vous accompagner ! Que puis-je faire pour vous aujourd'hui ?" },
    { q: ['ajouter un employe', 'nouvel employe', 'creer un employe', 'ajouter employe'], a: "Ouvrez l'onglet Personnel, puis « ➕ Nouvel employé ». Renseignez le nom, le poste et le type de contrat, puis enregistrez." },
    { q: ['importer', 'import', 'fichier excel', 'effectif'], a: "Cliquez sur « ⬆ Importer » et choisissez votre fichier Excel. Les colonnes inconnues sont créées automatiquement comme colonnes personnalisées." },
    { q: ['colonne', 'colonnes personnalisees', 'ajouter une colonne'], a: "Administrateur : cliquez sur « 🧱 Colonnes » pour ajouter ou supprimer une colonne. « 👁 Colonnes affichées » choisit ce qui apparaît dans la liste." },
    { q: ['conge', 'demande de conge', 'vacances'], a: "Ouvrez le module Congés, puis « nouvelle demande ». Le responsable approuve ou refuse. Ces décisions demandent la connexion." },
    { q: ['alerte', 'echeance', 'expire', 'cni', 'visite medicale'], a: "Le module 🔔 Alertes affiche les périodes d'essai à décider, les pièces qui expirent, les fins de contrat et les CDD au-delà de leurs règles." },
    { q: ['periode d essai', 'essai', 'confirmer', 'rompre'], a: "Dans 🔔 Alertes, section « Périodes d'essai à décider » : cliquez sur Confirmer ou Rompre. La décision est gardée avec sa date." },
    { q: ['contrat', 'cdd', 'ctt', 'occasionnel', 'regle'], a: "Les règles de chaque type de contrat se modifient dans 🔔 Alertes → « ⚙ Règles des contrats » : durée, renouvellements, reconduction tacite." },
    { q: ['sortie', 'dossier de sortie', 'certificat', 'solde de tout compte'], a: "Dès qu'un employé a une date de sortie, son dossier apparaît dans 🔔 Alertes : certificat, attestation CNPS, solde de tout compte, matériel." },
    { q: ['profil', 'droit', 'acces', 'permission', 'role'], a: "Les droits se règlent dans Centre de contrôle → Sociétés et accès. Le menu « Modèle rapide » applique un profil créé par l'administrateur." },
    { q: ['journal', 'audit', 'qui a modifie'], a: "Le journal enregistre automatiquement chaque modification avec son auteur. Les administrateurs de société le voient dans 🔔 Alertes ; le propriétaire dans Centre de contrôle → Audit." },
    { q: ['hors ligne', 'sans internet', 'pas de connexion', 'connexion'], a: "L'application s'ouvre sans connexion et affiche les dernières données. Vos ajouts et modifications restent sur l'appareil et sont envoyés dès le retour du réseau." },
    { q: ['photo', 'avatar', 'ma photo', 'mon image'], a: "Les photos et les réglages de l'assistant se configurent dans le Centre de contrôle, onglet Profil et web, section « Assistant RH : paramètres ». Je n'ai pas besoin de ces réglages pour répondre à vos questions." },
    { q: ['barre', 'defilement', 'defiler', 'tableau trop large'], a: "Une barre de défilement apparaît en haut et en bas des tableaux trop larges. Tirez-la pour voir les colonnes à droite." },
    { q: ['tableau de bord', 'graphique', 'statistique'], a: "Le tableau de bord affiche les effectifs et les graphiques. Le mode édition (👁 et ▲▼) permet de masquer ou réordonner les cartes." }
  ];

  function norm(t) {
    return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['’]/g, ' ');
  }

  function answerLocal(text, faq) {
    var liste = faq || FAQ, n = norm(text), best = null, score = 0;
    liste.forEach(function (f) {
      var sc = 0;
      f.q.forEach(function (k) { if (n.indexOf(norm(k)) !== -1) sc += norm(k).length; });
      if (sc > score) { score = sc; best = f; }
    });
    return best ? best.a : null;
  }
  function nettoyer(t) {
    return String(t || '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/^#{1,6}\s*/gm, '')
      .replace(/^\s*[-*]\s+/gm, '• ')
      .replace(/\s+\n/g, '\n')
      .trim();
  }
  function texteParlable(t) {
    return nettoyer(t)
      .replace(/[*#_`>|~•]+/g, ' ')
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, ' ')
      .replace(/\s+-\s+/g, ', ')
      .replace(/([.!?])\s*,\s*/g, '$1 ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function decouper(t) {
    var parties = t.match(/[^.!?;:]+[.!?;:]?/g) || [t];
    var out = [];
    parties.forEach(function (p) {
      p = p.trim();
      while (p.length > 180) {
        var i = p.lastIndexOf(' ', 180);
        if (i < 40) i = 180;
        out.push(p.slice(0, i).trim());
        p = p.slice(i).trim();
      }
      if (p) out.push(p);
    });
    return out.filter(Boolean);
  }
  function messageErreur(code) {
    var m = {
      'not-allowed': "Je n'ai pas l'autorisation d'utiliser le micro. Vous pouvez l'autoriser dans les paramètres du navigateur, puis réessayer.",
      'service-not-allowed': "Je n'ai pas l'autorisation d'utiliser le micro. Vous pouvez l'autoriser dans les paramètres du navigateur, puis réessayer.",
      'audio-capture': "Je ne trouve pas de micro sur cet appareil.",
      'network': "La reconnaissance vocale a besoin d'une connexion internet. Vous pouvez m'écrire votre question en attendant.",
      'no-speech': "Je ne vous ai pas entendu. Appuyez de nouveau sur Parler quand vous êtes prêt."
    };
    return m[code] || "Je n'ai pas pu vous entendre. Vous pouvez réessayer ou m'écrire votre question.";
  }
  function messageRefus(raison) {
    var m = {
      'bruit': "J'ai surtout entendu du bruit. Pouvez-vous reprendre votre question, un peu plus près du micro ?",
      'peu sur': "Je ne suis pas certain d'avoir bien compris. Pouvez-vous répéter, s'il vous plaît ?",
      'court': "Pouvez-vous me poser votre question en une phrase ?",
      'parasite': "Je vous écoute, dites-moi ce dont vous avez besoin.",
      'vide': "Je ne vous ai pas entendu. Vous pouvez reprendre quand vous voulez."
    };
    return m[raison] || "Pouvez-vous reformuler, s'il vous plaît ?";
  }
  var API = { FAQ: FAQ, norm: norm, answerLocal: answerLocal, nettoyer: nettoyer, texteParlable: texteParlable, decouper: decouper, messageErreur: messageErreur, messageRefus: messageRefus };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.AssistantTexte = API;
})(typeof window !== 'undefined' ? window : globalThis);
