// Vérifie la banque de QCM : structure, identifiants uniques, réponse valide, explication présente.
// Lancer : node verifier-qcm.js
const fs = require('fs');
const path = require('path');
const q = JSON.parse(fs.readFileSync(path.join(__dirname, 'qcm.json'), 'utf8'));
let erreurs = [];
const ids = new Set();
q.forEach((x, i) => {
  const ref = x.id || ('index ' + i);
  if (!x.id) erreurs.push(ref + ' : identifiant manquant');
  if (ids.has(x.id)) erreurs.push(x.id + ' : identifiant en double');
  ids.add(x.id);
  if (!x.question || x.question.trim().length < 10) erreurs.push(ref + ' : question trop courte');
  if (!Array.isArray(x.choix) || x.choix.length < 2) erreurs.push(ref + ' : moins de 2 choix');
  if (!Number.isInteger(x.reponse) || x.reponse < 0 || x.reponse >= (x.choix || []).length) erreurs.push(ref + ' : réponse hors plage');
  if (!x.explication || x.explication.trim().length < 10) erreurs.push(ref + ' : explication absente');
  if (!x.theme) erreurs.push(ref + ' : thème absent');
});
console.log(q.length + ' question(s) vérifiée(s)');
if (erreurs.length) { console.log('ERREURS :\n - ' + erreurs.join('\n - ')); process.exit(1); }
console.log('OK : banque de QCM valide');
