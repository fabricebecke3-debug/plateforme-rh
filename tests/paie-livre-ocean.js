// Contrôle : un salarié de l'Hôtel Océan doit apparaître avec les codes de SON bulletin (1 à 28), pas les codes Sage
globalThis.PaieMoteur = require('../paie-moteur.js');
globalThis.PaieHok = require('../paie-hok.js');
require('../paie-bulletin-sage.js');
const L = require('../paie-livre.js');
const fiche = { id: 'h1', matricule: 'B126', nom: 'ABDOURAMANE IBRAHIMA', sb: 71500, smens: 71500, transport: 15000 };
const H = globalThis.PaieHok.depuisLignes({ fiche, lignes: [], periode: '01/10/26 au 31/10/26' });
const hok = { modele: { gabarit: 'ocean' } };
const html = L.generer([{ matricule: 'B126', nom: fiche.nom, fiche, lignes: [], modele: { gabarit: 'ocean' }, periode: '01/10/26 au 31/10/26' }], { societe: 'HOTEL DE L\'OCEAN' });
const codes = [...html.matchAll(/<td class="l">(\d+) /g)].map(m => m[1]);
console.log('codes livre Océan :', codes.join(' '));
const codesBulletin = [...H.gains.map(g => String(g.code)), ...H.retenues.map(r => String(r.code))];
const manquants = codesBulletin.filter(c => !codes.includes(c));
const sage = ['1000','8100','9019'].filter(c => codes.includes(c));
console.log('codes du bulletin absents du livre :', manquants.length ? manquants.join(' ') : 'aucun');
console.log('codes Sage présents (doit être vide) :', sage.length ? sage.join(' ') : 'aucun');
console.log('Net à payer :', H.net, '| Total Brut :', H.brut);
