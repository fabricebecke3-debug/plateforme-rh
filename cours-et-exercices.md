# Cours et exercices — calculs RH

> Les taux, la base mensuelle (173,33 h) et les jours de congés par mois sont des **paramètres de travail**. Vérifiez-les avec le Code du travail et votre convention collective avant tout bulletin réel. Les corrigés ci-dessous sont calculés par `outils/calculs-rh.js`, vérifié par `outils/calculs-rh.test.js`.

---

## Module 1 — L'ancienneté

**Principe.** L'ancienneté se mesure entre la date d'entrée et une date de référence, en années, mois et jours.

**Méthode pas à pas.**
1. Comptez les mois entiers écoulés.
2. Si le jour de la date de référence est plus petit que le jour d'entrée, retirez un mois.
3. Comptez les jours restants depuis la date obtenue (la date-ancre).

**Exemple.** Entrée le 15 janvier 2020, référence le 9 octobre 2026 : 6 ans, 8 mois, 24 jours.

**Piège.** Entre le 30 novembre et le 1er mars, un calcul naïf donne « -1 jour ». La méthode ci-dessus l'évite : résultat 3 mois et 1 jour.

**Exercice 1.** Entrée le 20 juin 2018, référence le 9 octobre 2026.
- **Corrigé** : 8 ans, 3 mois, 19 jours (3 033 jours au total).

**Exercice 2.** Entrée le 30 novembre 2024, référence le 1er mars 2025.
- **Corrigé** : 0 an, 3 mois, 1 jour (91 jours au total).

---

## Module 2 — Les heures supplémentaires

**Principe.** Le taux horaire se calcule à partir du salaire de base : salaire / 173,33 heures. Chaque heure supplémentaire est payée à ce taux, majoré selon la tranche.

**Formule.** Montant = taux horaire x majoration x nombre d'heures.

**Exemple.** Taux de base 1 000 FCFA ; 8 heures à 120 % et 2 heures à 150 %.
- 8 x 1 000 x 1,20 = 9 600 FCFA
- 2 x 1 000 x 1,50 = 3 000 FCFA
- Total : 12 600 FCFA

**Exercice 3.** Salaire de base 260 000 FCFA. Un salarié fait 12 heures de jour : 8 premières à 120 %, 4 suivantes à 150 %.
- **Corrigé** : taux horaire 1 500,03 FCFA ; total 23 400,45 FCFA (14 400,28 pour les 8 premières, 9 000,17 pour les suivantes).

**Exercice 4.** Même salarié, avec en plus 3 heures de nuit à 150 %.
- **Corrigé** : total 30 150,58 FCFA (les 3 heures de nuit ajoutent 6 750,13 FCFA).

---

## Module 3 — Les congés payés

**Principe.** Le salarié acquiert un nombre de jours par mois de présence. Le solde = jours acquis - jours pris.

**Exemple.** 2,5 jours par mois ; 21 mois complets : 52,5 jours acquis. Si 10 jours sont pris : solde 42,5 jours.

**Exercice 5.** Embauche le 1er février 2023, référence le 9 octobre 2026, 15 jours pris.
- **Corrigé** : 110 jours acquis, solde 95 jours.

---

## Module 4 — Le salaire proratisé

**Principe.** Un salarié présent une partie du mois est payé au prorata des jours travaillés, sur la base de 30 jours.

**Formule.** Salaire x jours travaillés / 30.

**Exercice 6.** Salaire de 225 000 FCFA, 18 jours travaillés.
- **Corrigé** : 135 000 FCFA.

---

## Pour aller plus loin
- Refaire chaque exercice sans calculatrice, puis vérifier avec `calculs-rh.js`.
- Vérifier chaque taux utilisé dans votre convention collective.
- Commencer les QCM par thème : `entrainement-qcm.html`.
