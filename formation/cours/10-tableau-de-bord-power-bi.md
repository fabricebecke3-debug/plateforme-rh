# Cours 10 — Tableau de bord RH avec Power BI

> **Nature de ce cours.** Méthode de travail et formules de gestion. Aucune règle juridique n'est présentée ici. Les noms d'interface de Power BI peuvent évoluer selon les versions : vérifiez-les dans votre version installée.

## Objectif
Construire un tableau de bord RH fiable : des données propres, un modèle simple, des mesures définies une seule fois, et des visuels lisibles.

## 1. La chaîne de travail
1. **Source** : export Excel ou Softlabor, un fichier par thème (effectifs, absences, congés).
2. **Nettoyage (Power Query)** : types de colonnes, dates, doublons, valeurs manquantes. Chaque étape est enregistrée et reproductible.
3. **Modèle** : une table de faits (mouvements, absences) reliée à des tables de dimensions (salariés, dates, sociétés).
4. **Mesures (DAX)** : chaque indicateur est écrit une fois, et réutilisé partout.
5. **Visuels** : une question par page ; un chiffre clé par carte ; une tendance par courbe.

## 2. Règles de conception
- **Un modèle en étoile** : les filtres passent par la table de dates et par les dimensions.
- **Une définition par indicateur** : pas de formule recopiée dans chaque visuel.
- **Les périodes comparables** : même périmètre, même définition, d'un mois à l'autre.
- **Pas de données personnelles inutiles** : le tableau de bord présente des totaux, les noms restent dans les fiches habilitées (cours 9).

## 3. Mesures types (formules)
| Mesure | Formule | Remarque |
|---|---|---|
| Effectif moyen | (effectif début + effectif fin) / 2 | sur la période |
| Turnover | départs / effectif moyen x 100 | en % |
| Absentéisme | jours d'absence / jours théoriques x 100 | en % |
| Taux de féminisation | femmes / effectif x 100 | en % |

En DAX, une mesure de turnover s'écrit sur le modèle : `Turnover % = DIVIDE([Départs], [Effectif moyen]) * 100`. Le `DIVIDE` évite l'erreur si le dénominateur est nul.

## 4. Visuels recommandés
- **Cartes** : effectif, turnover, absentéisme du mois.
- **Courbe** : évolution du turnover sur 12 mois.
- **Barres** : absences par service.
- **Tableau** : détail par société, sans données personnelles.

---

## Exercices

Les exercices de ce module sont dans l'onglet **✏️ Exercices** de la page Apprentissage. Chaque exercice se résout par saisie ou par choix ; le **corrigé** et son explication restent masqués jusqu'à ce que vous le demandiez.

## Erreurs fréquentes
- Recalculer un pourcentage à la main dans le visuel au lieu d'utiliser la mesure.
- Mélanger des périodes de longueurs différentes sans les comparer par mois.
- Publier un tableau contenant des noms alors que seuls les totaux sont nécessaires.
