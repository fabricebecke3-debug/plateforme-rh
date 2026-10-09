const fs = require('fs');
const { JSDOM } = require('jsdom');
const aide = fs.readFileSync('../aide-avatar.js', 'utf8');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window;
w.speechSynthesis = { cancel(){}, speak(){} }; w.HTMLMediaElement.prototype.pause = function(){}; w.HTMLMediaElement.prototype.play = function(){ return Promise.resolve(); }; w.SpeechSynthesisUtterance = function(t){ this.text=t; };
w.eval(aide);
w.AideAvatar.start({ nom: 'Assistant RH' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await sleep(300);
  const dernier = () => w.document.body.textContent;
  let ok = 0, ko = 0;
  const cas = [['comment vas tu', /bien/], ['merci', /plaisir/], ['bonsoir', /Bonsoir/], ['au revoir', /Au revoir/]];
  for (const [q, re] of cas) {
    w.AideAvatar.ask(q); await sleep(50);
    const r = dernier();
    if (re.test(r)) { ok++; console.log('  OK   « ' + q + ' » -> ' + r.slice(0, 70)); } else { ko++; console.log('  ECHEC « ' + q + ' » -> ' + r.slice(0, 70)); }
  }
  console.log(ok + ' réussi(s), ' + ko + ' échec(s)');
  process.exit(ko ? 1 : 0);
})();
