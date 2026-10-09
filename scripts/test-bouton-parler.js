const fs = require('fs');
const { JSDOM } = require('jsdom');
const aide = fs.readFileSync('../aide-avatar.js', 'utf8');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window;
let instances = 0, scenario = 'ok', lectureBloquee = false;
class FakeSR {
  constructor(){ instances++; this.id = instances; }
  start(){ this.started = true; setTimeout(() => {
      if (scenario === 'ok' && this.onresult) this.onresult({ results: [[{ transcript: 'comment importer un fichier' }]] });
      else if (scenario === 'refus' && this.onerror) this.onerror({ error: 'not-allowed' });
      if (this.onend) this.onend();
    }, 50); }
  abort(){ this.aborted = true; if (this.onerror) this.onerror({ error: 'aborted' }); if (this.onend) this.onend(); }
}
w.webkitSpeechRecognition = FakeSR;
w.speechSynthesis = { cancel(){}, speak(u){ if (lectureBloquee) return; setTimeout(() => { if (u.onend) u.onend(); }, 60); }, speaking: false };
w.SpeechSynthesisUtterance = function (t) { this.text = t; };
w.HTMLMediaElement.prototype.pause = function(){}; w.HTMLMediaElement.prototype.play = function(){ return Promise.resolve(); };
w.eval(aide);
w.AideAvatar.start({ nom: 'Assistant RH' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const texte = () => w.document.body.textContent;
const bouton = () => [...w.document.querySelectorAll('button')].find(b => /Parler|Écoute/.test(b.textContent));
const conv = () => [...w.document.querySelectorAll('button')].find(b => /Conversation/.test(b.textContent));
let ok = 0, ko = 0;
const t = (nom, c) => { if (c) { ok++; console.log('  OK   ' + nom); } else { ko++; console.log('  ECHEC ' + nom); } };
(async () => {
  await sleep(300);
  // A. Bouton Parler simple : la question est reconnue et répondue
  bouton().click(); await sleep(200);
  t('A. Parler : la question reconnue reçoit une réponse', /importer/.test(texte()) && /Pour importer|importer/.test(texte()));
  t('A. le bouton revient à « Parler » après l\'écoute', /🎤 Parler/.test(bouton().textContent));
  // B. Micro refusé : message clair, pas de silence
  scenario = 'refus'; bouton().click(); await sleep(200);
  t('B. micro refusé : message explicite', /n'est pas autorisé/.test(texte()));
  // C. Mode conversation puis lecture bloquée : le filet de sécurité relance l'écoute
  scenario = 'ok'; lectureBloquee = true;
  conv().click(); await sleep(150);
  const avant = instances;
  bouton().click(); await sleep(200);
  t('C. Parler en mode conversation démarre une écoute', instances > avant);
  await sleep(18000);
  t('C. lecture bloquée : l\'écoute reprend toute seule (filet de sécurité)', instances > avant + 1);
  // D. Parler reste utilisable même si la lecture est bloquée
  const avant2 = instances;
  bouton().click(); await sleep(200);
  t('D. Parler reste utilisable pendant une lecture bloquée', instances > avant2);
  console.log('\n' + ok + ' réussi(s), ' + ko + ' échec(s)');
  process.exit(ko ? 1 : 0);
})();
