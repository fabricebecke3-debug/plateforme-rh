// Enfants : âge, nombre de moins de 6 ans à la fin de la période, et effet sur le congé de la mère salariée
globalThis.PaieEnfants = require('../paie-enfants.js');
globalThis.PaieHok = require('../paie-hok.js');
const E = globalThis.PaieEnfants, H = globalThis.PaieHok;
let ok = 0, ko = 0;
const verif = (nom, c) => { c ? ok++ : ko++; console.log((c ? 'OK   ' : 'ECHEC') + ' ' + nom); };
const fin = E.finPeriode('01/10/26 au 31/10/26');
verif('âge 5 ans (né 15/01/2021)', E.ageAns('2021-01-15', fin) === 5);
verif('né le 31/10/2020 : 6 ans le jour de la fin de période, donc non compté', E.moins6ans(['2020-10-31'], fin) === 0);
verif('né le 01/11/2020 : encore 5 ans, compté', E.moins6ans(['2020-11-01'], fin) === 1);
verif('deux enfants jeunes, un de 9 ans : 2 compté', E.moins6ans(['2021-01-15', '2025-06-01', '2017-03-03'], fin) === 2);
verif('format JJ/MM/AAAA accepté', E.ageAns('15/01/2021', fin) === 5);
verif('date vide : pas d\'âge', E.ageAns('', fin) === null);

// Congé : deux enfants de moins de 6 ans ajoutent des jours (congé principal 18 jours : +2 par enfant)
const base = { salaireBase: 80000, ansAnciennete: 6, congePris: true, mere: true, params: H.charger() };
const jours = o => (o.gains.filter(g => g.code === '6')[0] || {}).nombre;
const sans = H.calculer(Object.assign({}, base, { enfants6: 0 }));
const avec = H.calculer(Object.assign({}, base, { enfants6: 2 }));
verif('congé : +4 jours avec 2 enfants de moins de 6 ans', jours(avec) - jours(sans) === 4);
const sansMere = H.calculer(Object.assign({}, base, { mere: false, enfants6: 2 }));
verif('congé : pas de majoration si ce n\'est pas une mère salariée', jours(sansMere) === jours(sans));

// Fiche : le nombre utilisé par le calcul vient de la liste des dates de naissance à la fin de la période
const fiche = { id: 'f1', nom: 'X', sb: 80000, enfants: ['2021-01-15', '2025-06-01', '2017-03-03'], genre: 'F' };
const hok = H.depuisLignes({ fiche, lignes: [], periode: '01/10/26 au 31/10/26', presence: null, congesPlateforme: [] });
verif('depuisLignes produit un bulletin', typeof hok.brut === 'number');
console.log('\n' + ok + ' OK, ' + ko + ' échec(s)');
process.exitCode = ko ? 1 : 0;
