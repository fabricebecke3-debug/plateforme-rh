// Tests des calculs RH. Lancer : node calculs-rh.test.js
// Les valeurs attendues sont calculées indépendamment (voir commentaires).
const assert = require('assert');
const C = require('./calculs-rh.js');
let ok = 0, ko = 0;
function test(nom, fn) {
  try { fn(); ok++; console.log('  OK   ' + nom); }
  catch (e) { ko++; console.log('  ECHEC ' + nom + ' : ' + e.message); }
}

test('ancienneté 2020-01-15 -> 2026-10-09 = 6 ans 8 mois 24 jours', () => {
  const a = C.anciennete('2020-01-15', '2026-10-09');
  assert.deepStrictEqual([a.ans, a.mois, a.jours], [6, 8, 24]);
  assert.strictEqual(a.total_jours, 2459); // (2026-10-09 - 2020-01-15).days
});

test('ancienneté avec emprunt de jours (31 mars -> 30 avril = 30 jours)', () => {
  const a = C.anciennete('2024-03-31', '2024-04-30');
  assert.deepStrictEqual([a.ans, a.mois, a.jours], [0, 0, 30]);
  assert.strictEqual(a.total_jours, 30);
});

test('ancienneté : date de référence avant le début = erreur', () => {
  assert.throws(() => C.anciennete('2026-01-01', '2025-01-01'));
});

test('date invalide = erreur', () => {
  assert.throws(() => C.anciennete('01/02/2020', '2026-01-01'));
});

test('taux horaire : 173 330 / 173,33 = 1000', () => {
  assert.strictEqual(C.tauxHoraire(173330), 1000);
});

test('heures sup : 10 h de jour, 8 premières à 120 %, 2 suivantes à 150 % = 12 600', () => {
  const r = C.heuresSupplementaires(173330, 10, 8);
  assert.strictEqual(r.montant, 12600);
  assert.strictEqual(r.detail.jour_premieres, 9600);
  assert.strictEqual(r.detail.jour_suivantes, 3000);
});

test('heures sup : + 4 h de nuit à 150 % = 18 600', () => {
  const r = C.heuresSupplementaires(173330, 10, 8, { nuit: 4 });
  assert.strictEqual(r.montant, 18600);
});

test('congés : 1 an 9 mois 8 jours = 21 mois complets x 1,5 = 31,5 jours (art. 89)', () => {
  const c = C.congesAcquis('2025-01-01', '2026-10-09');
  assert.strictEqual(c.mois_complets, 21);
  assert.strictEqual(c.acquis, 31.5);
});

test('solde de congés : 31,5 acquis - 10 pris = 21,5', () => {
  assert.strictEqual(C.soldeConges('2025-01-01', '2026-10-09', 10).solde, 21.5);
});

test('prorata : 300 000 x 15 / 30 = 150 000', () => {
  assert.strictEqual(C.salaireProrata(300000, 15), 150000);
});

test('ancienneté : 30 nov 2024 -> 1er mars 2025 = 3 mois 1 jour (pas de jours négatifs)', () => {
  const a = C.anciennete('2024-11-30', '2025-03-01');
  assert.deepStrictEqual([a.ans, a.mois, a.jours], [0, 3, 1]);
  assert.strictEqual(a.total_jours, 91);
});

test('ancienneté : jamais de jours négatifs sur une année complète de dates', () => {
  for (let m = 1; m <= 12; m++) for (let j = 1; j <= 28; j += 3) {
    const deb = `2023-${String(m).padStart(2,'0')}-${String(j).padStart(2,'0')}`;
    for (let k = 0; k < 24; k += 5) {
      const d = new Date(2023, m - 1 + k, j + 9);
      const ref = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const a = C.anciennete(deb, ref);
      assert.ok(a.jours >= 0 && a.mois >= 0 && a.mois < 12, deb + ' -> ' + ref + ' : ' + JSON.stringify(a));
    }
  }
});

console.log('\n' + ok + ' réussi(s), ' + ko + ' échec(s)');
process.exit(ko === 0 ? 0 : 1);
