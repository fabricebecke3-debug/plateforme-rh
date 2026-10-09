// Tests de l'assistant de formation. Lancer : node test-assistant-formation.js
const assert = require('assert');
const A = require('./assistant-formation.js');
let ok = 0, ko = 0;
function test(nom, fn) { return fn().then(() => { ok++; console.log('  OK   ' + nom); }, e => { ko++; console.log('  ECHEC ' + nom + ' : ' + e.message); }); }
(async () => {
  await test('ancienneté -> sujet ancienneté', async () => {
    const r = await A.repondre("Comment calculer l'ancienneté ?");
    assert.strictEqual(r.source, 'local'); assert.strictEqual(r.sujet, 'anciennete');
  });
  await test('piège 31 mars / 30 avril -> sujet piège', async () => {
    const r = await A.repondre('Pourquoi 31 mars et 30 avril donnent un résultat faux ?');
    assert.strictEqual(r.sujet, 'anciennete-piege');
  });
  await test('heures supplémentaires -> sujet heures-sup', async () => {
    const r = await A.repondre('Comment calculer les heures supplémentaires ?');
    assert.strictEqual(r.sujet, 'heures-sup');
  });
  await test('solde de congés -> sujet congés', async () => {
    const r = await A.repondre('Quel est mon solde de congés ?');
    assert.strictEqual(r.sujet, 'conges');
  });
  await test('« comment calculer les congés » -> sujet congés, pas méthode', async () => {
    const r = await A.repondre('Comment calculer les congés ?');
    assert.strictEqual(r.sujet, 'conges');
  });
  await test('prorata -> sujet prorata', async () => {
    const r = await A.repondre('Comment faire un salaire proratisé pour 18 jours ?');
    assert.strictEqual(r.sujet, 'prorata');
  });
  await test('mot court « net » ne se déclenche pas dans « internet »', async () => {
    const r = await A.repondre('Ma connexion internet est lente');
    assert.notStrictEqual(r.sujet, 'brut-net');
  });
  await test('hors sujet sans IA -> réponse de repli, sans invention', async () => {
    const r = await A.repondre('Quelle est la capitale du Japon ?');
    assert.strictEqual(r.source, 'aucune');
  });
  await test('hors sujet avec IA -> l’IA répond', async () => {
    A.onAI = async q => 'réponse IA de test';
    const r = await A.repondre('Quelle est la capitale du Japon ?');
    assert.strictEqual(r.source, 'ia'); assert.strictEqual(r.texte, 'réponse IA de test');
    A.onAI = null;
  });
  await test('IA en panne -> message de repli, pas de plantage', async () => {
    A.onAI = async () => { throw new Error('panne'); };
    const r = await A.repondre('Quelle est la capitale du Japon ?');
    assert.strictEqual(r.source, 'aucune');
    A.onAI = null;
  });
  console.log('\n' + ok + ' réussi(s), ' + ko + ' échec(s)');
  process.exit(ko === 0 ? 0 : 1);
})();
