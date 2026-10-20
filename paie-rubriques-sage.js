/* paie-rubriques-sage.js — catalogue des rubriques du bulletin Sage (fichier sage-data.json, 145 rubriques).
 * Généré automatiquement. typeSage : B = bulletin/brut, C = cotisation, NS = non soumise.
 * imposable : règle Sage (<>0 = si montant non nul ; Tjs = toujours ; Jms = jamais). */
(function (root) {
  'use strict';
  var RUBRIQUES = [
 {
  "code": "1000",
  "libelle": "Salaire de Base mensuel",
  "typeSage": "B",
  "imposable": "Tjs",
  "base": "BRT",
  "formule": "PRESENCE S SALHOR0 S (Calculé) S"
 },
 {
  "code": "1001",
  "libelle": "Salaire mensuel",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "0,000 S SALBASE S (Calculé) S"
 },
 {
  "code": "1003",
  "libelle": "Salaire brut Jour",
  "typeSage": "B",
  "imposable": "Tjs",
  "base": "BRT",
  "formule": "PRESENCE S SALHOR0 S (Calculé) S"
 },
 {
  "code": "1005",
  "libelle": "Salaire Journalier 5A",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "0,000 S 0,000 S (Calculé) S"
 },
 {
  "code": "1006",
  "libelle": "Salaire Journalier 4",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "0,000 S 5664,000 S (Calculé) S"
 },
 {
  "code": "1010",
  "libelle": "Salaire de base mensuel",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "SALBASE S"
 },
 {
  "code": "1011",
  "libelle": "Salaire de base Horaire",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "0,000 S 173,330 S (Calculé) S"
 },
 {
  "code": "1040",
  "libelle": "Sursalaire",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "CL05 S"
 },
 {
  "code": "1041",
  "libelle": "Sursalaire",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "8608 S"
 },
 {
  "code": "1100",
  "libelle": "Forfait heures supplémentaires",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "0 S"
 },
 {
  "code": "1110",
  "libelle": "Heures Supplémentaires 120%",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "HS01 S SALHOR1 S 120,000 S (Calculé) S"
 },
 {
  "code": "1130",
  "libelle": "Heures Supplémentaires 130%",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "HS02 S SALHOR1 S 130,000 S (Calculé) S"
 },
 {
  "code": "1140",
  "libelle": "Heures Supplémentaires 140%",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "HS03 S SALHOR1 S 140,000 S (Calculé) S"
 },
 {
  "code": "1150",
  "libelle": "Heures Supplémentaires 150%",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "HS04 S SALHOR1 S 150,000 S (Calculé) S"
 },
 {
  "code": "1151",
  "libelle": "Jour du Dimanche",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRUT",
  "formule": "0,000 S 3305,000 S 140,000 S (Calculé) S"
 },
 {
  "code": "1152",
  "libelle": "Jour du Dimanche 4",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "0,000 S 0,000 S (Calculé) S"
 },
 {
  "code": "1153",
  "libelle": "Jour du Dimanche 5A",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "0,000 S 6867,000 S 140,000 S (Calculé) S"
 },
 {
  "code": "1154",
  "libelle": "Jour du Dimanche E4",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "0,000 S 5664,000 S 140,000 S (Calculé) S"
 },
 {
  "code": "1160",
  "libelle": "Jour Ferié 100%",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "HS03 S SALHOR1 S 100,000 S (Calculé) S"
 },
 {
  "code": "1200",
  "libelle": "Prime Ancienneté Figée",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "0 S"
 },
 {
  "code": "1202",
  "libelle": "Prime d'anciénnté",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "PA",
  "formule": "0,000 S 0,000 S (Calculé) S"
 },
 {
  "code": "1210",
  "libelle": "Prime Ancienneté Nouvelle",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "BASEANC S ANCTAUX S (Calculé) S"
 },
 {
  "code": "1211",
  "libelle": "Prime Ancienneté Nouvelle",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "NR",
  "formule": "ANCIENTR S ANCT1 S 2,000 S (Calculé) S"
 },
 {
  "code": "1300",
  "libelle": "Prime de Productivité",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "T10LIB02 S"
 },
 {
  "code": "1310",
  "libelle": "Prime de Panier",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "CL03 S"
 },
 {
  "code": "1320",
  "libelle": "Prime de Rendement",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "CL08 S"
 },
 {
  "code": "1325",
  "libelle": "Panier de nuit",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "0,000 S 0,000 S (Calculé) S"
 },
 {
  "code": "1326",
  "libelle": "Prime de Panier",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRUT",
  "formule": "0,000 S 500,000 S (Calculé) S"
 },
 {
  "code": "1330",
  "libelle": "Prime de Technicité",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "T10LIB01 S"
 },
 {
  "code": "1331",
  "libelle": "Allocation Congés",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "0 S"
 },
 {
  "code": "1332",
  "libelle": "Indemnité de préavis",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "0 S"
 },
 {
  "code": "1333",
  "libelle": "Rappel(s) :",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "0 S"
 },
 {
  "code": "1340",
  "libelle": "Prime forfait de mission",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "CL07",
  "formule": "S"
 },
 {
  "code": "1341",
  "libelle": "Prime d'astreinte",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "0 S"
 },
 {
  "code": "1345",
  "libelle": "Prime de Caisse",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "CL05 S"
 },
 {
  "code": "1350",
  "libelle": "Prime Penibilité",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "CL02 S"
 },
 {
  "code": "1351",
  "libelle": "Prime de risque",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "CL02 S"
 },
 {
  "code": "1352",
  "libelle": "Précarité",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "0 S"
 },
 {
  "code": "1355",
  "libelle": "Gratifications",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "0 S"
 },
 {
  "code": "1370",
  "libelle": "Prime de Séparation",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "0 S"
 },
 {
  "code": "1375",
  "libelle": "Prime Spéciale",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "0 S"
 },
 {
  "code": "1380",
  "libelle": "Prime congé non Imposable",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "VCONGSUP S"
 },
 {
  "code": "1385",
  "libelle": "Prime Exceptionnelle",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "TXLIB03 S"
 },
 {
  "code": "1390",
  "libelle": "Prime d'Assiduité",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "CL03 S"
 },
 {
  "code": "1395",
  "libelle": "Prime de Responsabilité",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "CL03 S"
 },
 {
  "code": "1400",
  "libelle": "Indemnité de Licenciement",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "0 S"
 },
 {
  "code": "1410",
  "libelle": "Indemnité de Suggestion",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "0 S"
 },
 {
  "code": "1420",
  "libelle": "Indemnité de Représentation",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "CL08 S"
 },
 {
  "code": "1421",
  "libelle": "Indemnité de panier",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "0,000 S 0,000 S (Calculé) S"
 },
 {
  "code": "1425",
  "libelle": "Indemnité de rendement",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "0 S"
 },
 {
  "code": "1426",
  "libelle": "Indemnité d'assiduité",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "0 S"
 },
 {
  "code": "1429",
  "libelle": "Transport 3.4",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "0,000 S 0,000 S (Calculé) S"
 },
 {
  "code": "1430",
  "libelle": "Indemnité de Transport",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "CL01 S"
 },
 {
  "code": "1431",
  "libelle": "Indemnité d'électricité",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "CL06 S"
 },
 {
  "code": "1432",
  "libelle": "Indemnite d'eau",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "CL09 S"
 },
 {
  "code": "1435",
  "libelle": "Indemnité de Logement",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "CL02 S"
 },
 {
  "code": "1436",
  "libelle": "Avantage en Nature",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "AVANTURT S"
 },
 {
  "code": "1437",
  "libelle": "Indemnité d'habillement",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "0 S"
 },
 {
  "code": "1438",
  "libelle": "Assurance maladie",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "CL03 S"
 },
 {
  "code": "1439",
  "libelle": "Indemnité de lait",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "0 S"
 },
 {
  "code": "1440",
  "libelle": "Indemnité d'usage Véhicule",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "CL11 S"
 },
 {
  "code": "1441",
  "libelle": "Indemnité d'entretien de véh",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "CL04 S"
 },
 {
  "code": "1442",
  "libelle": "Indemnité de salissure",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "CL06 S"
 },
 {
  "code": "1443",
  "libelle": "Indemnité d'outillage",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "0 S"
 },
 {
  "code": "1444",
  "libelle": "Heure Férié à 100%",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "HF",
  "formule": "HS3 S SALHOR1 S 100,000 S (Calculé) S"
 },
 {
  "code": "1445",
  "libelle": "Indemnité de panier",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "0 S"
 },
 {
  "code": "1450",
  "libelle": "Indemnité de Déplacement",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "T10LIB04 S"
 },
 {
  "code": "1460",
  "libelle": "Autres Indemnités",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRUT",
  "formule": "0 S"
 },
 {
  "code": "1461",
  "libelle": "Indemnité de fin de carrière",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "0 S"
 },
 {
  "code": "1462",
  "libelle": "Indemnité de rupture du contra",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "0 S"
 },
 {
  "code": "1463",
  "libelle": "Indemnité de décès",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "0 S"
 },
 {
  "code": "1464",
  "libelle": "Indemnité de depart en retrai",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "0 S"
 },
 {
  "code": "1465",
  "libelle": "Prime de reconversion",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "0 S"
 },
 {
  "code": "1466",
  "libelle": "Prime de bonne séparation",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "0 S"
 },
 {
  "code": "1467",
  "libelle": "Penalite sur preavis",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "0 S"
 },
 {
  "code": "1468",
  "libelle": "Forfait frais de mission",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "CL07 S"
 },
 {
  "code": "1500",
  "libelle": "Prêts Immobiliers",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "RET",
  "formule": "0,000 S 0,000 S 0,000 S (Calculé) S"
 },
 {
  "code": "2000",
  "libelle": "Avantage en Nature",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "S_TOT_1 S COEF S (Calculé) S"
 },
 {
  "code": "3500",
  "libelle": "Préavis",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "0 S"
 },
 {
  "code": "4100",
  "libelle": "Congés Payés :",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "CL04 S"
 },
 {
  "code": "4110",
  "libelle": "Congés Supplémentaires",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "CONGE",
  "formule": "VCONGSUP S"
 },
 {
  "code": "4800",
  "libelle": "Rappel Imposable",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "0 S"
 },
 {
  "code": "4850",
  "libelle": "Rappel non Imposable",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "0,000 S 0,000 S 0,000 S (Calculé) S"
 },
 {
  "code": "4900",
  "libelle": "Rappel Arrondis",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "ARRONDISCU S"
 },
 {
  "code": "9370",
  "libelle": "Frais de repas",
  "typeSage": "B",
  "imposable": "<>0",
  "base": "RET",
  "formule": "0 S"
 },
 {
  "code": "5080",
  "libelle": "CRE",
  "typeSage": "C",
  "imposable": "<>0",
  "base": "COT",
  "formule": "0 S PLAFOND S 4,00 S"
 },
 {
  "code": "8100",
  "libelle": "Pension vieillesse CNPS",
  "typeSage": "C",
  "imposable": "<>0",
  "base": "RET",
  "formule": "NETIMPOPL S 4,200 S (Calculé) S PLAFOND S 4,00 S"
 },
 {
  "code": "8110",
  "libelle": "Accident de Travail",
  "typeSage": "C",
  "imposable": "<>0",
  "base": "COT",
  "formule": "NETIMPOPL S 0,000 S (Calculé) S PLAFOND S 4,00 S"
 },
 {
  "code": "8120",
  "libelle": "Prestations Famiales",
  "typeSage": "C",
  "imposable": "<>0",
  "base": "COT",
  "formule": "NETIMPOPL S 0,000 S (Calculé) S PLAFOND S 4,00 S"
 },
 {
  "code": "8130",
  "libelle": "Fonds National de l'Emploi",
  "typeSage": "C",
  "imposable": "<>0",
  "base": "COT",
  "formule": "NETIMPOPL S 0,000 S (Calculé) S PLAFOND S 4,00 S"
 },
 {
  "code": "8140",
  "libelle": "Credit Foncier Patronal",
  "typeSage": "C",
  "imposable": "<>0",
  "base": "COT",
  "formule": "BRUT S 0,000 S (Calculé) S PLAFOND S 4,00 S"
 },
 {
  "code": "1",
  "libelle": "Panier de nuit",
  "typeSage": "NS",
  "imposable": "<>0",
  "base": "1361",
  "formule": "0,000 S 500,000 S (Calculé) S"
 },
 {
  "code": "980",
  "libelle": "Redevance CRTV",
  "typeSage": "NS",
  "imposable": "<>0",
  "base": "BRT",
  "formule": "TAXAUDIO S"
 },
 {
  "code": "1360",
  "libelle": "Paniers de nuit",
  "typeSage": "NS",
  "imposable": "<>0",
  "base": "GAIN",
  "formule": "0 S"
 },
 {
  "code": "1361",
  "libelle": "Panier de nuit",
  "typeSage": "NS",
  "imposable": "<>0",
  "base": "GAIN",
  "formule": "0,000 S 0,000 S (Calculé) S"
 },
 {
  "code": "1365",
  "libelle": "Arrondi Net Salarial",
  "typeSage": "NS",
  "imposable": "<>0",
  "base": "GAIN",
  "formule": "0 S"
 },
 {
  "code": "9005",
  "libelle": "Retenue Prêt 1",
  "typeSage": "NS",
  "imposable": "<>0",
  "base": "RET",
  "formule": "0 S"
 },
 {
  "code": "9007",
  "libelle": "Retenue Mutuelle",
  "typeSage": "NS",
  "imposable": "<>0",
  "base": "RET",
  "formule": "RETMUSEC S"
 },
 {
  "code": "9010",
  "libelle": "Retenue Carburant",
  "typeSage": "NS",
  "imposable": "<>0",
  "base": "RET",
  "formule": "0 S"
 },
 {
  "code": "9013",
  "libelle": "Retenue Spéciale",
  "typeSage": "NS",
  "imposable": "<>0",
  "base": "RET",
  "formule": "0 S"
 },
 {
  "code": "9015",
  "libelle": "Avance Congés",
  "typeSage": "NS",
  "imposable": "<>0",
  "base": "RET",
  "formule": "0 S"
 },
 {
  "code": "9016",
  "libelle": "Cassecroûte",
  "typeSage": "NS",
  "imposable": "<>0",
  "base": "0",
  "formule": "S"
 },
 {
  "code": "9019",
  "libelle": "IRPP",
  "typeSage": "NS",
  "imposable": "<>0",
  "base": "RET",
  "formule": "IRPPT S"
 },
 {
  "code": "9020",
  "libelle": "Retenue Pharmacie",
  "typeSage": "NS",
  "imposable": "<>0",
  "base": "RET",
  "formule": "0 S"
 },
 {
  "code": "9021",
  "libelle": "Impots sur retenue salariaux",
  "typeSage": "NS",
  "imposable": "<>0",
  "base": "RET",
  "formule": "IRS S"
 },
 {
  "code": "9022",
  "libelle": "Acompte Quinzaine",
  "typeSage": "NS",
  "imposable": "<>0",
  "base": "RET",
  "formule": "0 S"
 },
 {
  "code": "9023",
  "libelle": "IRPP05",
  "typeSage": "NS",
  "imposable": "<>0",
  "base": "NS",
  "formule": "IRPP05 S"
 },
 {
  "code": "9025",
  "libelle": "Avance Exceptionnelle",
  "typeSage": "NS",
  "imposable": "<>0",
  "base": "RET",
  "formule": "MTAVEXP S"
 },
 {
  "code": "9028",
  "libelle": "C/C PERSONNEL",
  "typeSage": "NS",
  "imposable": "<>0",
  "base": "RET",
  "formule": "0 S"
 },
 {
  "code": "9030",
  "libelle": "Rembour Prêt de la Mutuelle",
  "typeSage": "NS",
  "imposable": "<>0",
  "base": "PRE",
  "formule": "CL09 S"
 },
 {
  "code": "9031",
  "libelle": "C A C/ I R S",
  "typeSage": "NS",
  "imposable": "<>0",
  "base": "IRS",
  "formule": "S 10,000 S (Calculé) S"
 },
 {
  "code": "9032",
  "libelle": "C A C /IRPP",
  "typeSage": "NS",
  "imposable": "<>0",
  "base": "RET",
  "formule": "IRPPT S 10,000 S (Calculé) S"
 },
 {
  "code": "9033",
  "libelle": "C A C /IRPP05",
  "typeSage": "NS",
  "imposable": "<>0",
  "base": "NS",
  "formule": "IRPP05 S 10,000 S (Calculé) S"
 },
 {
  "code": "9035",
  "libelle": "Cotisation Mutuelle",
  "typeSage": "NS",
  "imposable": "<>0",
  "base": "RET",
  "formule": "RETMUSEC S"
 },
 {
  "code": "9040",
  "libelle": "Autres Prêts",
  "typeSage": "NS",
  "imposable": "<>0",
  "base": "RET",
  "formule": "0 S"
 },
 {
  "code": "9045",
  "libelle": "Prêt Crédit Foncier",
  "typeSage": "NS",
  "imposable": "<>0",
  "base": "RET",
  "formule": "0 S"
 },
 {
  "code": "9050",
  "libelle": "Règlé Mois en cours",
  "typeSage": "NS",
  "imposable": "<>0",
  "base": "RET",
  "formule": "0 S"
 },
 {
  "code": "9052",
  "libelle": "Prêt Museco",
  "typeSage": "NS",
  "imposable": "<>0",
  "base": "RET",
  "formule": "MTMUSECO S"
 },
 {
  "code": "9055",
  "libelle": "Prêt scolaire",
  "typeSage": "NS",
  "imposable": "<>0",
  "base": "RET",
  "formule": "MTAUTRE S"
 },
 {
  "code": "9060",
  "libelle": "Taxe proportionnelle",
  "typeSage": "NS",
  "imposable": "Tjs",
  "base": "RET",
  "formule": "BASECFCTP S 4,800 S (Calculé) S"
 },
 {
  "code": "9061",
  "libelle": "Surtaxe progressive",
  "typeSage": "NS",
  "imposable": "Tjs",
  "base": "RET",
  "formule": "SURTAXPROG S"
 },
 {
  "code": "9062",
  "libelle": "CAC / TP",
  "typeSage": "NS",
  "imposable": "Tjs",
  "base": "RET",
  "formule": "CAC01 S"
 },
 {
  "code": "9063",
  "libelle": "CAC/TP-SP",
  "typeSage": "NS",
  "imposable": "<>0",
  "base": "RET",
  "formule": "CAC S"
 },
 {
  "code": "9064",
  "libelle": "Crédit Foncier sal. CFC",
  "typeSage": "NS",
  "imposable": "<>0",
  "base": "RET",
  "formule": "SALTAXF S 1,000 S (Calculé) S"
 },
 {
  "code": "9065",
  "libelle": "CAC / SP",
  "typeSage": "NS",
  "imposable": "Tjs",
  "base": "RET",
  "formule": "CAC02 S"
 },
 {
  "code": "9070",
  "libelle": "Taxe communale",
  "typeSage": "NS",
  "imposable": "Tjs",
  "base": "RET",
  "formule": "TAXCOM S"
 },
 {
  "code": "9071",
  "libelle": "Taxe sur developpement local",
  "typeSage": "NS",
  "imposable": "Tjs",
  "base": "RET",
  "formule": "TAXDEVLO S"
 },
 {
  "code": "9072",
  "libelle": "Rappel retenue Mutuelle",
  "typeSage": "NS",
  "imposable": "<>0",
  "base": "RET",
  "formule": "0 S"
 },
 {
  "code": "9075",
  "libelle": "Arrondi salaire brut",
  "typeSage": "NS",
  "imposable": "<>0",
  "base": "RET",
  "formule": "0 S"
 },
 {
  "code": "9100",
  "libelle": "Nombre de billets de 10000",
  "typeSage": "NS",
  "imposable": "Jms",
  "base": "BIL",
  "formule": "NDIXMIL S"
 },
 {
  "code": "9110",
  "libelle": "Nombre de billets de 5000",
  "typeSage": "NS",
  "imposable": "Jms",
  "base": "BIL",
  "formule": "NCINQMIL S"
 },
 {
  "code": "9120",
  "libelle": "Nombre de billets de 2000",
  "typeSage": "NS",
  "imposable": "Jms",
  "base": "BIL",
  "formule": "NDEUMIL S"
 },
 {
  "code": "9130",
  "libelle": "Nombre de billets de 1000",
  "typeSage": "NS",
  "imposable": "Jms",
  "base": "BIL",
  "formule": "NMILLE S"
 },
 {
  "code": "9140",
  "libelle": "Nombre de billets de 500",
  "typeSage": "NS",
  "imposable": "Jms",
  "base": "BIL",
  "formule": "NCINQCENT S"
 },
 {
  "code": "9150",
  "libelle": "Nombre de pièces de 100",
  "typeSage": "NS",
  "imposable": "Jms",
  "base": "BIL",
  "formule": "NCENT S"
 },
 {
  "code": "9160",
  "libelle": "Nombre de pièces de 50",
  "typeSage": "NS",
  "imposable": "Jms",
  "base": "BIL",
  "formule": "NCINQANT S"
 },
 {
  "code": "9200",
  "libelle": "Abattement 20% CD10",
  "typeSage": "NS",
  "imposable": "Jms",
  "base": "CD10",
  "formule": "ABATCD10 S"
 },
 {
  "code": "9210",
  "libelle": "Net à déclarer CD10",
  "typeSage": "NS",
  "imposable": "Jms",
  "base": "CD10",
  "formule": "NETDECLAR S"
 },
 {
  "code": "9230",
  "libelle": "Redevance audiovisuelle",
  "typeSage": "NS",
  "imposable": "<>0",
  "base": "RET",
  "formule": "TAXAUDIO S"
 },
 {
  "code": "9350",
  "libelle": "Acompte",
  "typeSage": "NS",
  "imposable": "<>0",
  "base": "RET",
  "formule": "0 S"
 },
 {
  "code": "9360",
  "libelle": "Frais de repas",
  "typeSage": "NS",
  "imposable": "<>0",
  "base": "RET",
  "formule": "0 S"
 },
 {
  "code": "9500",
  "libelle": "Arrondis Paie du Mois",
  "typeSage": "NS",
  "imposable": "<>0",
  "base": "RET",
  "formule": "ARONDIS1 S"
 },
 {
  "code": "9600",
  "libelle": "Arrondi net salarial :",
  "typeSage": "NS",
  "imposable": "<>0",
  "base": "RET",
  "formule": "0 S"
 },
 {
  "code": "9980",
  "libelle": "Retenues Diverses",
  "typeSage": "NS",
  "imposable": "<>0",
  "base": "0",
  "formule": "S"
 },
 {
  "code": "9999",
  "libelle": "TEST",
  "typeSage": "NS",
  "imposable": "<>0",
  "base": "NETIMPOL",
  "formule": "S"
 }
];
  var VARIABLES = [{"nom": "RET", "occurrences": 36}, {"nom": "BIL", "occurrences": 7}, {"nom": "SALHOR1", "occurrences": 6}, {"nom": "PLAFOND", "occurrences": 6}, {"nom": "COT", "occurrences": 5}, {"nom": "BRUT", "occurrences": 4}, {"nom": "CL03", "occurrences": 4}, {"nom": "NETIMPOPL", "occurrences": 4}, {"nom": "CL02", "occurrences": 3}, {"nom": "GAIN", "occurrences": 3}, {"nom": "PRESENCE", "occurrences": 2}, {"nom": "SALHOR0", "occurrences": 2}, {"nom": "SALBASE", "occurrences": 2}, {"nom": "CL05", "occurrences": 2}, {"nom": "HS03", "occurrences": 2}, {"nom": "CL08", "occurrences": 2}, {"nom": "CL07", "occurrences": 2}, {"nom": "VCONGSUP", "occurrences": 2}, {"nom": "CL06", "occurrences": 2}, {"nom": "CL09", "occurrences": 2}, {"nom": "CL04", "occurrences": 2}, {"nom": "TAXAUDIO", "occurrences": 2}, {"nom": "RETMUSEC", "occurrences": 2}, {"nom": "IRPPT", "occurrences": 2}, {"nom": "IRS", "occurrences": 2}, {"nom": "IRPP05", "occurrences": 2}, {"nom": "CD10", "occurrences": 2}, {"nom": "HS01", "occurrences": 1}, {"nom": "HS02", "occurrences": 1}, {"nom": "HS04", "occurrences": 1}, {"nom": "BASEANC", "occurrences": 1}, {"nom": "ANCTAUX", "occurrences": 1}, {"nom": "ANCIENTR", "occurrences": 1}, {"nom": "ANCT1", "occurrences": 1}, {"nom": "T10LIB02", "occurrences": 1}, {"nom": "T10LIB01", "occurrences": 1}, {"nom": "TXLIB03", "occurrences": 1}, {"nom": "CL01", "occurrences": 1}, {"nom": "AVANTURT", "occurrences": 1}, {"nom": "CL11", "occurrences": 1}, {"nom": "HS3", "occurrences": 1}, {"nom": "T10LIB04", "occurrences": 1}, {"nom": "S_TOT_1", "occurrences": 1}, {"nom": "COEF", "occurrences": 1}, {"nom": "CONGE", "occurrences": 1}, {"nom": "ARRONDISCU", "occurrences": 1}, {"nom": "MTAVEXP", "occurrences": 1}, {"nom": "PRE", "occurrences": 1}, {"nom": "MTMUSECO", "occurrences": 1}, {"nom": "MTAUTRE", "occurrences": 1}, {"nom": "BASECFCTP", "occurrences": 1}, {"nom": "SURTAXPROG", "occurrences": 1}, {"nom": "CAC01", "occurrences": 1}, {"nom": "CAC", "occurrences": 1}, {"nom": "SALTAXF", "occurrences": 1}, {"nom": "CAC02", "occurrences": 1}, {"nom": "TAXCOM", "occurrences": 1}, {"nom": "TAXDEVLO", "occurrences": 1}, {"nom": "NDIXMIL", "occurrences": 1}, {"nom": "NCINQMIL", "occurrences": 1}];
  root.PaieSageCatalogue = { rubriques: RUBRIQUES, variables: VARIABLES };
})(typeof window !== 'undefined' ? window : globalThis);
