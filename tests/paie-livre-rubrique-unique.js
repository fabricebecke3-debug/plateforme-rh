// Une rubrique présente sur UN seul bulletin du mois doit figurer dans le livre, et dans le total général
globalThis.PaieMoteur = require('../paie-moteur.js'); require('../paie-bulletin-sage.js');
const L = require('../paie-livre.js');
const base = [{ code: '1000', lib: 'Salaire de Base mensuel', gain: 82311, cnps: true, cfc: true, irpp: true }];
const avec = base.concat([{ code: '1442', lib: 'Indemnité de salissure', gain: 10000, cnps: false, cfc: false, irpp: false }]);
const sal = [
  { matricule: '8000', nom: 'A', lignes: base, R: PaieMoteur.calculer(base, { taux: {} }), modele: { gabarit: 'sage' } },
  { matricule: '8001', nom: 'B', lignes: avec, R: PaieMoteur.calculer(avec, { taux: {} }), modele: { gabarit: 'sage' } }
];
const h = L.generer(sal, { societe: 'T', periode: 'x' });
const ligneSalissure = h.match(/<tr[^>]*><td class="l">1442[^<]*<\/td>(.*?)<\/tr>/);
console.log('1442 présent dans le livre :', !!ligneSalissure);
console.log('valeurs 1442 (A, B, total) :', ligneSalissure ? [...ligneSalissure[1].matchAll(/<td class="n">([^<]*)<\/td>/g)].map(m => m[1]).join(' | ') : '-');
