/* assistant-formation.js — Assistant de formation RH.
 * - Répond hors connexion à partir d'une base de connaissances locale (cours et règles de méthode).
 * - Si aucune réponse locale n'est trouvée et qu'une IA est fournie (onAI), elle est interrogée.
 * - Les réponses juridiques restent des aides : elles renvoient toujours au texte officiel.
 *
 * Usage :
 *   (charger le fichier assistant-formation.js avec une balise script de type src)
 *   FormationAssistant.repondre('comment calculer l’ancienneté ?').then(r => console.log(r.texte));
 *   FormationAssistant.onAI = async q => '...';   // facultatif, quand l'application est connectée
 */
(function (root) {
  'use strict';

  var BASE = [
    { sujet: 'anciennete', mots: ['anciennete', 'ancien', 'annees de service', 'date d entree'],
      reponse: "L'ancienneté se calcule entre la date d'entrée et une date de référence, en années, mois et jours. Méthode : 1) comptez les mois entiers écoulés ; 2) si le jour de référence est plus petit que le jour d'entrée, retirez un mois ; 3) comptez les jours restants depuis cette date. Exemple : entrée le 15 janvier 2020, référence le 9 octobre 2026 = 6 ans, 8 mois, 24 jours." },
    { sujet: 'anciennete-piege', mots: ['31 mars', '30 avril', 'jours negatifs', 'moins un jour', 'emprunt'],
      reponse: "Piège fréquent : quand le jour de référence est plus petit que le jour d'entrée (par exemple 30 avril et 31 mars), il faut emprunter les jours du mois précédent. Entre le 30 novembre 2024 et le 1er mars 2025, le résultat est 3 mois et 1 jour, jamais un nombre de jours négatif." },
    { sujet: 'heures-sup', mots: ['heure sup', 'heures sup', 'heures supplementaires', 'majoration', 'majorations', 'taux horaire'],
      reponse: "Durée légale : 40 heures par semaine dans les établissements non agricoles (art. 80 du Code du travail). Le Code renvoie à des décrets pour les modalités et les majorations des heures supplémentaires (art. 80, al. 4) : consultez le décret applicable avant tout calcul. Taux horaire = salaire de base / nombre d’heures mensuelles de référence (40 h x 52 semaines / 12 = 173,33 h, base usuelle à confirmer). Méthode : heure supplémentaire = taux horaire x (1 + majoration). Source : https://faolex.fao.org/docs/pdf/cmr198304.pdf" },
    { sujet: 'conges', mots: ['conge', 'conges', 'solde de conges', 'jours acquis', 'jours ouvrables', 'jours ouvres'],
      reponse: "Le salarié acquiert 1,5 jour ouvrable de congé par mois de service effectif (art. 89 du Code du travail), sauf dispositions plus favorables. Solde = jours acquis - jours pris. Exemple : 21 mois de service = 31,5 jours acquis ; 10 jours pris = solde 21,5 jours. Le droit au congé est acquis après un an de service (art. 92). Source : https://faolex.fao.org/docs/pdf/cmr198304.pdf" },
    { sujet: 'prorata', mots: ['prorata', 'proratise', 'jours travailles', 'entree en cours de mois', 'sortie en cours de mois'],
      reponse: "Pour un salarié présent une partie du mois : salaire proratisé = salaire x jours travaillés / 30. Exemple : 225 000 FCFA pour 18 jours = 135 000 FCFA." },
    { sujet: 'brut-net', mots: ['brut', 'net', 'salaire brut', 'salaire net', 'retenue'],
      reponse: "Le salaire brut est le montant avant retenues. Le salaire net est le brut diminué des cotisations et retenues salariales. Les taux de cotisation se vérifient auprès de la CNPS et du service fiscal." },
    { sujet: 'cdd-cdi', mots: ['cdd', 'cdi', 'duree determinee', 'duree indeterminee', 'type de contrat'],
      reponse: "CDD (art. 25 du Code du travail) : durée déterminée fixée à l’avance, 2 ans maximum, renouvelable pour la même durée ; pour un salarié camerounais, il ne peut être renouvelé qu’une fois avec la même entreprise, puis il devient à durée indéterminée. Un CDD de plus de 3 mois doit être écrit (art. 27). Source : https://faolex.fao.org/docs/pdf/cmr198304.pdf" },
    { sujet: 'reconduction', mots: ['reconduction', 'tacite', 'ctt', 'temporaire'],
      reponse: "La reconduction tacite prolonge un contrat sans nouvel écrit, lorsque le salarié continue de travailler après le terme. Ses conditions et ses limites dépendent du type de contrat : vérifiez-les avec le Code du travail." },
    { sujet: 'essai', mots: ['periode d essai', 'essai'],
      reponse: "Période d’essai (art. 28 du Code du travail) : l’engagement à l’essai doit être écrit ; il ne peut porter, renouvellement compris, que sur 6 mois maximum (8 mois pour les cadres). Si la relation se poursuit après l’essai sans nouveau contrat, elle vaut engagement définitif. Source : https://faolex.fao.org/docs/pdf/cmr198304.pdf" },
    { sujet: 'sortie', mots: ['sortie', 'certificat de travail', 'solde de tout compte', 'attestation de fin de contrat'],
      reponse: "Le certificat de travail est obligatoire à la fin du contrat, quel que soit le motif (art. 44 du Code du travail). Il indique la date d’entrée, la date de sortie, la nature et les dates des emplois occupés. Les autres documents (attestation de fin de contrat, solde de tout compte, bulletins) dépendent du motif de rupture et des exigences de la CNPS : vérifiez-les. Source : https://faolex.fao.org/docs/pdf/cmr198304.pdf" },
    { sujet: 'donnees', mots: ['donnees personnelles', 'piece d identite', 'cni', 'conservation', 'rgpd'],
      reponse: "Les données personnelles et les pièces d'identité ne sont accessibles qu'aux personnes habilitées, pour une finalité précise, pendant la durée nécessaire. La durée de conservation doit être définie, justifiée et validée juridiquement." },
    { sujet: 'methode', mots: ['methode', 'aide', 'exercice', 'entrainement'],
      reponse: "Méthode conseillée : refaites chaque calcul sans calculatrice, puis vérifiez avec l'outil. Commencez les QCM par thème, lisez l'explication après chaque réponse, puis revoyez les questions manquées." }
  ];

  var AVERTISSEMENT = " (Aide de formation : pour un cas réel, vérifiez le texte officiel ou consultez un professionnel.)";

  function normaliser(t) {
    return String(t || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/['’\-]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Score simple : nombre et longueur des mots-clés trouvés dans la question
  function meilleure(question) {
    var q = normaliser(question), best = null, score = 0;
    BASE.forEach(function (entree) {
      var s = 0;
      entree.mots.forEach(function (m) {
        var mm = normaliser(m);
        if ((' ' + q + ' ').indexOf(' ' + mm + ' ') !== -1) s += mm.length;
      });
      if (s > score) { score = s; best = entree; }
    });
    return best;
  }

  var API = {
    onAI: null,
    base: BASE,
    // Renvoie { texte, source: 'local' | 'ia' | 'aucune' }
    repondre: function (question) {
      var local = meilleure(question);
      if (local) return Promise.resolve({ texte: local.reponse + AVERTISSEMENT, source: 'local', sujet: local.sujet });
      if (typeof API.onAI === 'function') {
        return Promise.resolve().then(function () { return API.onAI(question); })
          .then(function (t) { return t ? { texte: t, source: 'ia' } : { texte: "Je n'ai pas de réponse précise. Essayez : ancienneté, heures supplémentaires, congés, prorata, contrat, sortie.", source: 'aucune' }; })
          .catch(function () { return { texte: "L'IA n'est pas disponible pour le moment. Essayez une question sur l'ancienneté, les heures supplémentaires, les congés ou le prorata.", source: 'aucune' }; });
      }
      return Promise.resolve({ texte: "Je n'ai pas de réponse locale à cette question. Essayez : ancienneté, heures supplémentaires, congés, prorata, contrat, sortie.", source: 'aucune' });
    },
    normaliser: normaliser
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.FormationAssistant = API;
})(typeof window !== 'undefined' ? window : globalThis);
