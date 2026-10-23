// Contrôle : salarié 8000 du livre de paie Sage « TOTAL EMPLOI RH » (16/09/26 au 15/10/26)
global.window = globalThis;
globalThis.PaieMoteur = require('../paie-moteur.js'); require('../paie-bulletin-sage.js'); globalThis.PaieUnicite = require('../paie-unicite.js'); require('../paie-livre.js');
const M = globalThis.PaieMoteur, L = globalThis.PaieLivre;
const lignes = [
  { code: '1000', lib: 'Salaire de Base mensuel', nombre: 173, base: 0, taux: null, gain: 82311, cnps: true, cfc: true, irpp: true },
  { code: '1040', lib: 'Sursalaire', gain: 2804, cnps: true, cfc: true, irpp: true },
  { code: '1310', lib: 'Prime de Panier', gain: 10000, cnps: false, cfc: false, irpp: false },
  { code: '1430', lib: 'Indemnité de Transport', gain: 12347, cnps: false, cfc: true, irpp: true },
  { code: '1435', lib: 'Indemnité de Logement', gain: 24693, cnps: true, cfc: false, irpp: true },
  { code: '1442', lib: 'Indemnité de salissure', gain: 10000, cnps: false, cfc: false, irpp: false }
];
const R = M.calculer(lignes, { taux: {} });
const att = { brut: 142155, cotisations: 4612, net: 130000, netImposable: 122155, patronales: 17823, cout: 159978, IRPP: 3365, CAC: 337, CFC: 1121, TC: 770, RED: 1950 };
const got = { brut: R.brut, cnps: R.salariales.cnps, net: R.net, netImposable: R.netImposable, patronales: R.totalPatronales, cout: R.coutEmployeur, IRPP: R.salariales.irpp, CAC: R.salariales.cac, CFC: R.salariales.cfc, TC: R.salariales.taxeCommunale, RED: R.salariales.redevance };
for (const k of Object.keys(att)) {
  const g = k === 'cotisations' ? got.cnps : got[k];
  console.log(k.padEnd(14), 'PDF', String(att[k]).padStart(8), ' calcul', String(g).padStart(8), g === att[k] ? 'OK' : 'ECART ' + (g - att[k]));
}
const html = L.generer([{ matricule: '8000', nom: 'ADENGUE Henri', lignes, R, presence: 173 }], { societe: 'TOTAL EMPLOI RH', periode: 'du 16/09/26 au 15/10/26' });
console.log('lignes codes:', (html.match(/<td class="l">[^<]*<\/td>/g) || []).length);
