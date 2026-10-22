// V3.56 — tests de l'ancienneté (dates exactes, texte du fichier) et du choix du modèle de bulletin par société.
// Usage : node tests/paie-anciennete-modeles.js
const path = require('path');
const assert = require('assert');
const base = path.join(__dirname, '..');
const M = require(path.join(base, 'paie-moteur.js'));

let n = 0;
const t = (nom, f) => { f(); n++; console.log('OK  ' + nom); };

t('ancienneteDepuis : 15/10/2021 au 14/10/2026 = 4 ans 11 mois (et non 5 ans)', () => {
  const a = M.ancienneteDepuis('2021-10-15', new Date(2026, 9, 14));
  assert.deepStrictEqual([a.ans, a.mois], [4, 11]);
});
t('ancienneteDepuis : 15/10/2021 au 15/10/2026 = 5 ans 0 mois', () => {
  const a = M.ancienneteDepuis('2021-10-15', new Date(2026, 9, 15));
  assert.deepStrictEqual([a.ans, a.mois], [5, 0]);
});
t('ancienneteDepuis : 31/01/2024 au 28/02/2026 = 2 ans 0 mois (anniversaire non atteint)', () => {
  const a = M.ancienneteDepuis('2024-01-31', new Date(2026, 1, 28));
  assert.deepStrictEqual([a.ans, a.mois], [2, 0]);
});
t('ancienneteDepuis : date future ou vide -> null', () => {
  assert.strictEqual(M.ancienneteDepuis('2030-01-01', new Date(2026, 9, 22)), null);
  assert.strictEqual(M.ancienneteDepuis('', new Date(2026, 9, 22)), null);
});
t('ancienneteDepuisTexte : « 3 an(s) 3 mois » du fichier du personnel', () => {
  const a = M.ancienneteDepuisTexte('3 an(s) 3 mois');
  assert.deepStrictEqual([a.ans, a.mois, a.source], [3, 3, 'fichier']);
});
t('ancienneteFiche : sans aucune date, le texte du fichier est utilisé (5 ans 11 mois -> 10 % Océan)', () => {
  const a = M.ancienneteFiche({ entree: '', dane: '', ancTexte: '5 an(s) 11 mois' }, new Date(2026, 9, 22));
  assert.strictEqual(a.ans, 5);
  assert.strictEqual(M.tauxAnciennete(a.ans), 10);
});
t('ancienneteFiche : la date d\'ancienneté prime sur la date d\'entrée, puis sur le texte', () => {
  const a = M.ancienneteFiche({ entree: '2025-01-01', dane: '2020-06-01', ancTexte: '1 an(s)' }, new Date(2026, 9, 22));
  assert.strictEqual(a.ans, 6);
  const b = M.ancienneteFiche({ entree: '2025-01-01', ancTexte: '9 an(s)' }, new Date(2026, 9, 22));
  assert.strictEqual(b.ans, 1);
});
t('ancienneteFiche : aucune information -> null (le bulletin n\'affiche rien, au lieu de 0 %)', () => {
  assert.strictEqual(M.ancienneteFiche({}, new Date()), null);
});

// Sélection du modèle de bulletin
globalThis.localStorage = (() => {
  const store = {};
  return { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
})();
require(path.join(base, 'paie-modeles.js'));
const PM = globalThis.PaieModeles;

t('cleSociete : « Hôtel de l\'Océan » et « HOTEL L\'OCEAN » désignent la même société', () => {
  assert.strictEqual(PM.cleSociete("Hôtel de l'Océan"), PM.cleSociete("HOTEL L'OCEAN"));
  assert.notStrictEqual(PM.cleSociete("Hôtel de l'Océan"), PM.cleSociete('TOTAL EMPLOI RH'));
});
// Deux modèles : Sage par défaut, Océan rattaché à sa société (copie ancienne sans champ société)
globalThis.localStorage.setItem('terh_paie_modeles', JSON.stringify([
  { id: 'sage', nom: 'Sage standard', defaut: true },
  { id: 'ocean', nom: 'Hôtel Océan', gabarit: 'ocean' }
]));
t('pourSalarie : le bulletin d\'un salarié de l\'Hôtel de l\'Océan prend le gabarit Océan (et non le modèle par défaut)', () => {
  const m = PM.pourSalarie({}, "HOTEL L'OCEAN");
  assert.strictEqual(m.id, 'ocean');
  assert.strictEqual(m.gabarit, 'ocean');
});
t('pourSalarie : une autre société garde le modèle par défaut (Sage)', () => {
  assert.strictEqual(PM.pourSalarie({}, 'TOTAL EMPLOI RH').id, 'sage');
  assert.strictEqual(PM.pourSalarie({}, '').id, 'sage');
});
t('pourSalarie : le modèle propre au salarié (fiche.mod) est prioritaire sur la société', () => {
  assert.strictEqual(PM.pourSalarie({ mod: 'sage' }, "HOTEL L'OCEAN").id, 'sage');
});

console.log('\n' + n + ' tests réussis');
