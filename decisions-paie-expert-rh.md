# Décisions : périmètre du module Paie et règles de calcul

## 1. Périmètre (décision)
Le module Paie calcule **le salaire jusqu'au brut, puis le net**, et applique le résultat dans le bulletin.
Les éléments de facturation client (assurance, frais de gestion, marges, « Autres 12 % », etc.) sont **retirés du périmètre**.
Les rubriques, taux, plafonds et constantes restent **modifiables** par l'administrateur, pour s'adapter à chaque société.

## 2. Heures supplémentaires : majorations (Masphere et autres)
- **Heures supplémentaires en jours ouvrables** : 120 %, 130 % et 140 % sont les taux configurés dans les rubriques 1110, 1130 et 1140 de Sage. Ces taux sont des paramètres de la société : l'administrateur peut les modifier.
- **Samedi** : c'est un jour ouvrable. Il n'est pas majoré en lui-même ; seules les heures au-delà de la durée normale de travail sont des heures supplémentaires.
- **Jours fériés et jours de repos** : la rubrique 1150 de Sage applique 150 % (base + 50 %). Cela correspond à la majoration de 50 % de l'article 51 de la Convention collective nationale du commerce (vérifiée sur image), lorsque cette convention s'applique.
- **Point à confirmer** : la majoration légale minimale des heures supplémentaires dans le Code du travail (art. 80 et décret d'application) ne figure pas dans les fichiers que nous avons vérifiés. Le taux de 130 % ou 140 % de Masphere doit être confronté au texte exact avant d'être appliqué comme minimum légal.

## 3. Congés payés (cours fourni, art. 89-92 du Code du travail, décret 75/28)
- Droit : 1,5 jour ouvrable par mois de service effectif (2,5 pour un jeune de moins de 18 ans).
- Durée = congé principal (arrondi à l'entier supérieur) + majoration d'ancienneté (+2 jours par tranche de 5 ans) + majoration enfants (mères salariées : +2 jours par enfant de moins de 6 ans ; +1 si le congé principal ne dépasse pas 6 jours).
- Allocation principale = rémunération totale × 1/16 (soit droit mensuel ÷ 24).
- Jours supplémentaires payés à la valeur d'un jour du congé principal.
- Module : `paie-conges.js`, testé sur les exercices du cours et recoupé avec l'indemnité Masphere de mars (cumul ÷ 16 = 50 689,31).

## 4. Points à confirmer avant application
1. Le cours indique une majoration enfants de « +1 si le congé principal ≤ 6 jours » : je l'ai retenue telle quelle ; à vérifier dans le texte du décret.
2. La majoration légale des heures supplémentaires (voir point 2).
3. Les conventions collectives peuvent être plus favorables que le Code : à vérifier pour chaque client avant calcul.
