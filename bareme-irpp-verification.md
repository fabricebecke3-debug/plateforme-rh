# Vérification du barème indicatif IRPP (DGI Cameroun, fichier BAREME_IRPP_DSSI_final.pdf)

Document : barème indicatif de liquidation de l'IRPP et autres retenues salariales (hors taxe de développement local), 70 pages.
Colonnes lues sur l'image de la page 1 : base mensuelle brute | IRPP | CAC | CCF | FNE part salariale | FNE part patronale | CRTV.

## Ce qui est confirmé par le barème
| Élément | Barème | Moteur | Statut |
|---|---|---|---|
| CAC | 10 % de l'IRPP (ex. 63 500 : IRPP 12, CAC 1) | 10 % × IRPP | Cohérent |
| Redevance CRTV | 750 pour 50 001 à 100 000 | table TAXAUDIO (750 / 1 950 / …) | Cohérent |
| Seuil de l'IRPP | 0 jusqu'à une base d'environ 62 000 | seuil 62 000 de la tranche 1 | Cohérent |

## Écarts à trancher
1. **Crédit foncier salarial (CCF)** : le barème applique 1 % du **brut** (630 pour 63 000). Sage applique 1 % de la **base taxable** (rubrique 9064, 1 121 pour 112 081). Le moteur suit Sage. À confirmer.
2. **FNE** : le barème donne 1 % salarial **et** 2,5 % patronal. Le moteur ne retient que 1 % patronal (rubrique 8130 de Sage) et ne prévoit pas de FNE salarial. Le 2,5 % patronal correspond peut-être aux accidents du travail (2,5 %) ou à une autre cotisation. À confirmer.
3. **Base taxable implicite de l'IRPP** : pour une base brute de 63 000, le barème implique une base taxable d'environ 0,98 × brut, et pour 1 500 000, environ 0,95 × brut. Le barème ne détaille pas les déductions. Il n'est donc pas possible de valider les tranches 2 à 4 du moteur à partir de ce document : l'IRPP du barème pour 1 500 000 est de 255 867, contre 267 198 calculés avec un ratio de 0,979.

## Conclusion
- Le barème confirme les taux de CAC, la table de redevance et le seuil de la tranche 1.
- Il ne permet pas, à lui seul, de valider les tranches 2 à 4 ni la base taxable : il faut le détail des déductions appliquées par la DGI.
- Les points 1 et 2 relèvent de la décision à prendre dans le paramétrage de la société (CCF et FNE), à confirmer avec le bulletin Sage ou la DGI.
