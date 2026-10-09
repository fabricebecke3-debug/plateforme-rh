/* calculs-rh.js — Calculs RH de référence (ancienneté, heures supplémentaires, congés, prorata).
 * Fonctions pures : aucune donnée envoyée, aucun accès réseau.
 * IMPORTANT : les taux et paramètres par défaut sont des PARAMÈTRES DE TRAVAIL.
 * Ils doivent être vérifiés avec le Code du travail et la convention collective applicable
 * avant toute utilisation sur des bulletins réels.
 */
(function (root) {
  'use strict';

  // Paramètres modifiables (à valider juridiquement)
  var PARAMS = {
    heures_mois: 173.33,          // 40 h x 52 semaines / 12 (base mensuelle usuelle)
    jours_mois_prorata: 30,       // base de calcul journalière pour le prorata
    conges_par_mois: 1.5,         // art. 89 de la loi 92/007 : 1,5 jour ouvrable par mois de service effectif (sauf dispositions plus favorables)
    majorations: {                // NON VÉRIFIÉS : le Code renvoie à des décrets (art. 80, al. 4). Paramétrage d'exemple uniquement.
      jour_premieres: 1.20,       // heures de jour, premières heures supplémentaires
      jour_suivantes: 1.50,       // heures de jour, au-delà
      nuit: 1.50,                 // travail de nuit
      ferie: 2.00                 // jours fériés / repos
    }
  };

  function parseDate(v) {
    if (v instanceof Date) return new Date(v.getTime());
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v));
    if (!m) throw new Error('Date invalide (format AAAA-MM-JJ) : ' + v);
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  function joursDansMois(annee, mois0) { return new Date(annee, mois0 + 1, 0).getDate(); }

  // Ajoute n mois à une date (jour ramené au dernier jour du mois si besoin)
  function ajouterMois(d, n) {
    var t = d.getMonth() + n;
    var annee = d.getFullYear() + Math.floor(t / 12);
    var mois = ((t % 12) + 12) % 12;
    var jour = Math.min(d.getDate(), joursDansMois(annee, mois));
    return new Date(annee, mois, jour);
  }

  // Ancienneté exacte : ans, mois, jours + total de jours.
  // Méthode : on compte les mois entiers écoulés, puis les jours restants depuis cette date-ancre.
  function anciennete(dateDebut, dateRef) {
    var d = parseDate(dateDebut), r = parseDate(dateRef);
    if (r < d) throw new Error('La date de référence est antérieure à la date de début');
    var m = (r.getFullYear() - d.getFullYear()) * 12 + (r.getMonth() - d.getMonth());
    if (r.getDate() < d.getDate()) m -= 1;
    var ancre = ajouterMois(d, m);
    var jours = Math.round((r - ancre) / 86400000);
    var total = Math.round((r - d) / 86400000);
    return { ans: Math.floor(m / 12), mois: m % 12, jours: jours, total_jours: total };
  }

  // Taux horaire à partir du salaire de base mensuel
  function tauxHoraire(salaireBase) {
    return salaireBase / PARAMS.heures_mois;
  }

  // Heures supplémentaires de jour : premières heures et heures suivantes
  // heures = nombre total d'heures supplémentaires de jour ; premieres = nombre d'heures à taux 1re tranche
  function heuresSupplementaires(salaireBase, heures, premieres, options) {
    var o = options || {};
    var m = PARAMS.majorations;
    var th = tauxHoraire(salaireBase);
    var p = Math.min(premieres === undefined ? 8 : premieres, heures);
    var s = Math.max(heures - p, 0);
    var montantJour = p * th * m.jour_premieres + s * th * m.jour_suivantes;
    var montantNuit = (o.nuit || 0) * th * m.nuit;
    var montantFerie = (o.ferie || 0) * th * m.ferie;
    var total = montantJour + montantNuit + montantFerie;
    return {
      taux_horaire: round2(th),
      montant: round2(total),
      detail: {
        jour_premieres: round2(p * th * m.jour_premieres),
        jour_suivantes: round2(s * th * m.jour_suivantes),
        nuit: round2(montantNuit),
        ferie: round2(montantFerie)
      }
    };
  }

  // Congés acquis à la date de référence (mois complets de présence)
  function congesAcquis(dateEmbauche, dateRef) {
    var a = anciennete(dateEmbauche, dateRef);
    var moisComplets = a.ans * 12 + a.mois;
    var acquis = round2(moisComplets * PARAMS.conges_par_mois);
    return { mois_complets: moisComplets, acquis: acquis };
  }

  // Solde de congés : acquis - pris
  function soldeConges(dateEmbauche, dateRef, joursPris) {
    var c = congesAcquis(dateEmbauche, dateRef);
    return { acquis: c.acquis, pris: joursPris, solde: round2(c.acquis - joursPris) };
  }

  // Salaire proratisé sur les jours travaillés
  function salaireProrata(salaireBase, joursTravailles) {
    return round2(salaireBase * joursTravailles / PARAMS.jours_mois_prorata);
  }

  function round2(x) { return Math.round((x + Number.EPSILON) * 100) / 100; }

  var API = {
    PARAMS: PARAMS,
    anciennete: anciennete,
    tauxHoraire: function (s) { return round2(tauxHoraire(s)); },
    heuresSupplementaires: heuresSupplementaires,
    congesAcquis: congesAcquis,
    soldeConges: soldeConges,
    salaireProrata: salaireProrata
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.CalculsRH = API;
})(typeof window !== 'undefined' ? window : globalThis);
