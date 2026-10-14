# Règles de paie Sage vérifiées (TOTAL EMPLOI RH, Sage Paie 9.01)

Sources : `SAGE_RUBRIQUES.pdf`, `SAGE_CONSTANCE.pdf` et `sage-data.json` (export structuré des constantes et rubriques, 1 995 constantes, 145 rubriques).
Cas de contrôle : bulletin CIMPOR (brut 142 155, net 130 000). Le moteur (`paie-moteur.js`) reproduit ce bulletin **sans aucune saisie manuelle**.

## Chaîne de calcul (vérifiée par les formules du JSON)
| Étape | Formule Sage | Valeur (cas CIMPOR) |
|---|---|---|
| Net imposable NETIMPO | Éléments imposables (paniers et salissures exclus) | 122 155 |
| Net imposable NETIMPOL | NETIMPO − LOG CONS (rubrique 1435) − ELEC − VEEU | 97 462 |
| Logement final IL | min(IL1 = 15 % × NETIMPOL ; LOG CONS) | 14 619 |
| Électricité ELEF | min(ELEC ; 4 % × NETIMPOL) | 0 |
| Net taxable NETTAX | NETIMPOL + IL + ELEF + VEAU | 112 081 |
| Salaire taxable SALTAXF | NETTAX, ou 0 si < 52 000 | 112 081 |
| Base CNPS BASECOT | NETIMPO − TRANSC (rubrique 1430) | 109 808 |
| Base CNPS plafonnée NETIMPOPL | BASECOT si < 300 000, sinon 750 000 | 109 808 |

## Cotisations et impôts
| Élément | Formule | Valeur | Bulletin |
|---|---|---|---|
| Pension salariale 8100 | 4,2 % × NETIMPOPL | 4 612 | 4 612 ✓ |
| Crédit foncier salarial 9064 | 1 % × SALTAXF | 1 121 | 1 121 ✓ |
| IRPP 9019 (tranche 1) | TRA1 = 70 % × SALTAXF ; TRA2 = 2,8 % × SALTAXF ; IRPP = 10 % × (TRA1 − TRA2 − 41 667) | 3 365 | 3 365 ✓ |
| IRPP tranches 2 à 4 | T2 : 15 % × 70 % × (SALTAXF − 310 000) + 16 693 ; T3 : 25 % × 70 % × (SALTAXF − 429 000) + 29 188 ; T4 : 35 % × 70 % × (SALTAXF − 667 000) + 70 830 | — | non testées (aucun cas) |
| CAC 9032 | 10 % × IRPP | 337 | 337 ✓ |
| Redevance audiovisuelle 9230 | Table TAXAUDIO | 1 950 | 1 950 ✓ |
| Taxe communale 9070 | Table TAXCOM | 770 | 770 ✓ |
| Patronal : pension 8100 / AT 8110 / PF 8120 / FNE 8130 | 4,2 % / 2,5 % / 7 % / 1 % × NETIMPOPL | 4 612 / 2 745 / 7 687 / 1 098 | ✓ |
| Patronal crédit foncier 8140 | 1,5 % × assiette | 1 681 | 1 681 ✓ (assiette : voir point 1) |

Total charges patronales : 17 823 ✓. Coût employeur : 159 978.

## Points restant à confirmer
1. **Assiette du crédit foncier patronal 8140** : la rubrique indique BRUT, mais le bulletin correspond à SALTAXF (1,5 % × 112 081). Le moteur applique SALTAXF, comme le bulletin. Vérifier dans Sage.
2. **Taxe proportionnelle 9060** (4,8 % × NETIMPO) et **taxe de développement local 9071** (750 pour ce cas) sont déclarées « toujours » dans les rubriques, mais n'apparaissent pas sur le bulletin. Le moteur les désactive par défaut (options `taxeProp`, `taxeDevLocal`). Confirmer le paramétrage de la société.
3. **Plafond CNPS** : la formule est discontinue au seuil de 300 000 (BASECOT ou 750 000). Sans effet sur ce cas ; à confirmer.
4. **Saut au seuil IRPP** : à 310 000, la tranche 1 donne 16 665 et la tranche 2 donne 16 693 (écart de 28), à cause des constantes arrondies. Sans conséquence pratique, mais à noter.
5. **Éléments non testés** : électricité (ELEC/ELECN), véhicule/eau (VEEU, VEH, EAU), dont les formules de limites (VEHN, EAUN) ne sont pas encore extraites ; le moteur les prend en saisie (`elec`, `veeu`, `veau`), à 0 par défaut.
6. **Surtaxe progressive 9061** et CAC 9063 : non implémentées.
