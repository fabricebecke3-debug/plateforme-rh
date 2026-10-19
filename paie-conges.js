/* paie-conges.js — Congés payés (Code du travail, art. 89-92 ; décret 75/28), selon le cours fourni.
 * Fonctions pures. Testées par scripts/test-paie-conges.js.
 * Règles légales fixes ; les paramètres (jours par mois, tranches, etc.) restent modifiables.
 */
(function (root) {
  'use strict';
  var PARAM = { droitMensuelAdulte: 1.5, droitMensuelJeune: 2.5, majorationAnciennetePar5Ans: 2, majorationEnfant: 2, majorationEnfantSiPrincipalCourt: 1, seuilPrincipalCourt: 6 };
  // Durée du congé principal : mois × droit mensuel, arrondi à l'entier supérieur (décret 75/28, art. 1 al. 4)
  function congePrincipal(mois, jeune) {
    var droit = jeune ? PARAM.droitMensuelJeune : PARAM.droitMensuelAdulte;
    return Math.ceil(Number(mois || 0) * droit);
  }
  // Majoration d'ancienneté : +2 jours par tranche entière de 5 ans
  function majorationAnciennete(ans) {
    return PARAM.majorationAnciennetePar5Ans * Math.floor(Math.max(0, Number(ans) || 0) / 5);
  }
  // Majoration enfants (mères salariées seulement) : +2 par enfant de moins de 6 ans ; +1 si le congé principal est ≤ 6 jours
  function majorationEnfants(nbEnfants, principal, estMere) {
    if (!estMere) return 0;
    var n = Math.max(0, Math.floor(Number(nbEnfants) || 0));
    var par = principal <= PARAM.seuilPrincipalCourt ? PARAM.majorationEnfantSiPrincipalCourt : PARAM.majorationEnfant;
    return n * par;
  }
  // Allocation de congé : rémunération totale × (droit mensuel ÷ 24) ; pour 1,5 jour/mois = 1/16
  // Jours supplémentaires payés à la valeur d'un jour du congé principal
  function allocationConge(o) {
    var remun = Number(o.remunerationTotale) || 0;
    var mois = Number(o.mois) || 0;
    var principal = congePrincipal(mois, o.jeune);
    var anc = majorationAnciennete(o.ansAnciennete);
    var enf = majorationEnfants(o.nbEnfants, principal, o.estMere);
    var total = principal + anc + enf;
    var droit = o.jeune ? PARAM.droitMensuelJeune : PARAM.droitMensuelAdulte;
    var allocPrincipale = remun * droit / 24;
    var valeurJour = principal > 0 ? allocPrincipale / principal : 0;
    var supp = total - principal;
    var allocSupp = supp * valeurJour;
    return {
      principal: principal, anciennete: anc, enfants: enf, total: total,
      allocationPrincipale: allocPrincipale, valeurJour: valeurJour,
      allocationSupplementaire: allocSupp, allocationTotale: allocPrincipale + allocSupp
    };
  }
  var API = { PARAM: PARAM, congePrincipal: congePrincipal, majorationAnciennete: majorationAnciennete, majorationEnfants: majorationEnfants, allocationConge: allocationConge };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.PaieConges = API;
})(typeof window !== 'undefined' ? window : globalThis);
