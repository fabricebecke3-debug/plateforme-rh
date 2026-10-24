/* aide-avatar.js — Assistant visuel PLATEFORME RH : photo de profil, aide écrite et vocale.
 *
 * - L'aide intégrée (FAQ) fonctionne SANS connexion.
 * - Si une question dépasse la FAQ et qu'une fonction onAI est fournie, elle est utilisée (si connecté).
 * - La voix utilise la reconnaissance et la synthèse vocales du navigateur (Chrome, Edge, Safari récent).
 *
 * Utilisation dans index.html (après le chargement de l'application) :
 *   <script src="aide-avatar.js"></script>
 *   <script>
 *     AideAvatar.start({
 *       nom: 'Fabrice',
 *       onPhoto: async function (blob) { ... enregistrer la photo de profil ... },
 *       onAI:    async function (question) { return 'réponse'; }   // optionnel
 *     });
 *   </script>
 */
(function (global) {
  'use strict';

  // ---------- Base d'aide intégrée (hors connexion) ----------

  // Textes : module assistant/texte.js (repli minimal si absent)
  var T = global.AssistantTexte || { FAQ: [], norm: function (t) { return String(t || ''); }, nettoyer: function (t) { return String(t || ''); },
    texteParlable: function (t) { return String(t || ''); }, decouper: function (t) { return [String(t || '')]; },
    messageErreur: function () { return "Je n'ai pas pu vous entendre. Vous pouvez réessayer ou m'écrire votre question."; },
    messageRefus: function () { return "Pouvez-vous reformuler, s'il vous plaît ?"; }, answerLocal: function () { return null; } };
  var FAQ = T.FAQ, nettoyer = T.nettoyer, texteParlable = T.texteParlable, decouper = T.decouper, messageErreur = T.messageErreur, messageRefus = T.messageRefus;
  function answerLocal(text) { return T.answerLocal(text, FAQ); }
  var FALLBACK = "Je ne suis pas sûr de bien comprendre votre demande. Pouvez-vous la reformuler ? Je peux vous aider sur les congés, la paie, les contrats, l'import de fichiers ou les alertes.";
  var SR = global.SpeechRecognition || global.webkitSpeechRecognition;
  var st = { nom: 'Assistant RH', theme: 'clair', position: 'droite', police: 'normale', vitesse: 1, afficherAv: true, couleur: '#1f5fbf', forme: 'rond', taille: 'normale', lanceur: null, utilisateur: null, onSpeak: null, videoOn: false, vid: null, btnVideo: null, onPhoto: null, onAI: null, voix: true, av: null, msgs: null, input: null, photoUrl: null, panel: null, btnVoix: null, started: false };
  // Mémoire de la conversation : module assistant/conversation.js (repli intégré si absent)
  var historique = (global.AssistantConversation && global.AssistantConversation.creer())
    || (function () {
      var h = [];
      return {
        ajouter: function (q, r) { h.push({ role: 'user', content: q }, { role: 'assistant', content: r }); while (h.length > 24) h.shift(); },
        precedents: function (n) { return h.slice(-(n || 12)); },
        estVide: function () { return h.length === 0; },
        reset: function () { h.length = 0; },
        estSalutationRepetee: function (q) { return /^(bonjour|bonsoir|salut|hello|coucou)(\s+[\p{L}-]+)?\s*[!.?,]*$/iu.test(String(q || '').trim()) && h.length > 0; }
      };
    })();

  // ---------- Outils ----------
  function norm(t) {
    return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['’]/g, ' ');
  }
  function el(tag, style, text) {
    var e = document.createElement(tag);
    if (style) e.style.cssText = style;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function initiales(n) {
    return String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(function (x) { return x[0].toUpperCase(); }).join('');
  }

  // ---------- Réponses ----------

  // ---------- Voix ----------
  function setEtat(e) {
    if (!st.av) return;
    st.av.setAttribute('data-s', e);
    st.av.style.boxShadow = e === 'parle' ? '0 0 0 4px #1f9d55' : e === 'ecoute' ? '0 0 0 4px #d97706' : e === 'pense' ? '0 0 0 4px #2563eb' : 'none';
  }
  // ---------- Écoute et voix (bouton Parler et mode conversation) ----------
  var conv = { on: false, rec: null, parle: false, minuterie: null };

  // ---------- Écoute intelligente : mesure le bruit ambiant et n'accepte que la voix ----------
  // L'analyse du son reste sur l'appareil. Aucun enregistrement n'est conservé.
  var ecoute = { ctx: null, analyser: null, flux: null, data: null, bruit: 0, seuil: 0, voix: false, suivi: null, parole: 0 };
  var PAROLES_PARASITES = ['euh', 'hum', 'hmm', 'mm', 'ah', 'oh', 'bah', 'ben', 'heu'];

  function rms(donnees) {
    var s = 0;
    for (var i = 0; i < donnees.length; i++) { var v = (donnees[i] - 128) / 128; s += v * v; }
    return Math.sqrt(s / donnees.length);
  }
  function seuilDepuis(bruit) { return Math.max(bruit * 2.5, 0.02); }
  function normaliserTexte(t) {
    return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  // Décide si une phrase reconnue doit être prise en compte. Renvoie { ok, raison }.
  function accepterTexte(texte, confiance, voixDetectee) {
    var n = normaliserTexte(texte);
    if (!n) return { ok: false, raison: 'vide' };
    if (!voixDetectee) return { ok: false, raison: 'bruit' };
    if (typeof confiance === 'number' && confiance > 0 && confiance < 0.35) return { ok: false, raison: 'peu sur' };
    var mots = n.split(' ').filter(Boolean);
    if (n.length < 3 || mots.length === 0) return { ok: false, raison: 'court' };
    if (mots.every(function (m) { return PAROLES_PARASITES.indexOf(m) !== -1; })) return { ok: false, raison: 'parasite' };
    return { ok: true, raison: '' };
  }

  function demarrerAnalyse() {
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !AC) return;
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      .then(function (flux) {
        var ctx = new AC();
        var an = ctx.createAnalyser();
        an.fftSize = 1024;
        ctx.createMediaStreamSource(flux).connect(an);
        ecoute.flux = flux; ecoute.ctx = ctx; ecoute.analyser = an;
        ecoute.data = new Uint8Array(an.fftSize);
        ecoute.seuil = 0.02;
        ecoute.suivi = setInterval(suivreVoix, 60);
        // Calibrage du bruit ambiant pendant ~0,5 seconde
        var mesures = [], t0 = Date.now();
        var cal = setInterval(function () {
          if (!ecoute.analyser) { clearInterval(cal); return; }
          an.getByteTimeDomainData(ecoute.data);
          mesures.push(rms(ecoute.data));
          if (Date.now() - t0 >= 500) {
            clearInterval(cal);
            ecoute.bruit = mesures.reduce(function (x, y) { return x + y; }, 0) / mesures.length;
            ecoute.seuil = seuilDepuis(ecoute.bruit);
          }
        }, 50);
      })
      .catch(function () { /* pas d'analyse : on se fie à la reconnaissance seule */ });
  }
  function suivreVoix() {
    if (!ecoute.analyser) return;
    ecoute.analyser.getByteTimeDomainData(ecoute.data);
    if (rms(ecoute.data) > ecoute.seuil) { ecoute.parole++; if (ecoute.parole >= 3) ecoute.voix = true; }
    else { ecoute.parole = 0; }
  }
  function arreterAnalyse() {
    clearInterval(ecoute.suivi);
    if (ecoute.flux) { ecoute.flux.getTracks().forEach(function (t) { t.stop(); }); }
    if (ecoute.ctx) { try { ecoute.ctx.close(); } catch (e) {} }
    ecoute.ctx = null; ecoute.analyser = null; ecoute.flux = null; ecoute.data = null;
    ecoute.bruit = 0; ecoute.seuil = 0; ecoute.voix = false; ecoute.suivi = null; ecoute.parole = 0;
  }

  // Parmi les hypothèses reconnues, retient celle dont la confiance est la plus élevée
  function meilleureHypothese(e) {
    var premier = e && e.results && e.results[0];
    if (!premier) return null;
    var meilleure = null, score = -1;
    for (var i = 0; i < premier.length; i++) {
      var h = premier[i];
      var c = (typeof h.confidence === 'number' && h.confidence > 0) ? h.confidence : 0.5;
      if (c > score) { score = c; meilleure = h; }
    }
    return meilleure;
  }

  function etatParler(texte) { if (st.btnParler) st.btnParler.textContent = texte; }
  function majBoutonConv() { if (st.btnConv) st.btnConv.textContent = conv.on ? '🎧 Conversation : oui' : '🎧 Conversation : non'; }


  function arreterEcoute() {
    if (conv.rec) { var r = conv.rec; conv.rec = null; try { r.abort(); } catch (e) {} }
    arreterAnalyse();
  }
  function stopParole() {
    clearTimeout(conv.minuterie);
    conv.parle = false;
    try { if (global.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
  }
  // Relance l'écoute en mode conversation, seulement si rien d'autre n'est en cours
  function reprendre() {
    if (!conv.on) return;
    setTimeout(function () { if (conv.on && !conv.parle && !conv.rec) ecouter(false); }, 500);
  }

  function ecouter(manuel) {
    if (!SR) {
      dire("La reconnaissance vocale n'est pas disponible sur ce navigateur. Utilisez Chrome, Edge ou Safari récent, ou écrivez votre question.");
      return;
    }
    if (conv.parle) {
      if (!manuel) return;     // en conversation automatique : on n'écoute pas pendant que je parle
      stopParole();            // bouton Parler : je m'arrête de parler et j'écoute
    }
    arreterEcoute();
    demarrerAnalyse();
    var r;
    try { r = new SR(); } catch (e) { dire(messageErreur('')); return; }
    r.lang = 'fr-FR';
    r.interimResults = false;
    r.maxAlternatives = 3;   // trois hypothèses : on retient la plus sûre
    r.continuous = false;
    var recu = false, demarre = false;
    ajouter('av', '🎤 Je demande l’accès au micro…');
    r.onstart = function () { demarre = true; ajouter('av', '🎤 Micro actif : je vous écoute.'); };
    // Si le navigateur ne démarre jamais l'écoute, on le dit au lieu de rester muet
    setTimeout(function () {
      if (!demarre && conv.rec === r) {
        ajouter('av', "Le micro n'a pas démarré. Vérifiez l'autorisation du micro pour ce site (cadenas à côté de l'adresse), puis réessayez.");
        try { r.abort(); } catch (e) {}
        conv.rec = null; setEtat('repos'); etatParler('🎤 Parler');
      }
    }, 4000);
    r.onresult = function (e) {
      recu = true;
      conv.rec = null;
      etatParler('🎤 Parler');
      var res = meilleureHypothese(e);
      var texte = res ? res.transcript : '';
      var confiance = res ? res.confidence : undefined;
      // Si l'analyse n'est pas disponible, on se fie à la reconnaissance seule
      var voixOk = ecoute.analyser ? ecoute.voix : true;
      var mots = normaliserTexte(texte).split(' ').filter(Boolean).length;
      var fiable = typeof confiance === 'number' && confiance >= 0.6 && mots >= 2;
      var verdict = fiable ? accepterTexte(texte, confiance, true) : accepterTexte(texte, confiance, voixOk);
      arreterAnalyse();
      if (verdict.ok) { poser(texte); return; }
      setEtat('repos');
      if (conv.on) { reprendre(); return; }      // en conversation, on écoute à nouveau sans bruit
      dire(messageRefus(verdict.raison));
    };
    r.onerror = function (e) {
      var code = (e && e.error) || '';
      conv.rec = null;
      etatParler('🎤 Parler');
      setEtat('repos');
      if (code === 'aborted') return;
      if (code === 'no-speech' && conv.on) return;
      if (conv.on) { conv.on = false; majBoutonConv(); }
      dire(messageErreur(code));
    };
    r.onend = function () {
      if (conv.rec === r) conv.rec = null;
      etatParler('🎤 Parler');
      arreterAnalyse();
      if (!recu && demarre && !conv.on) ajouter('av', 'Aucune voix reconnue. Réessayez en parlant près du micro.');
      if (!recu) { setEtat('repos'); reprendre(); }
    };
    conv.rec = r;
    setEtat('ecoute');
    etatParler('🎤 Écoute…');
    try { r.start(); }
    catch (e) { conv.rec = null; arreterAnalyse(); etatParler('🎤 Parler'); setEtat('repos'); dire(messageErreur('')); }
  }

  function toggleConv() {
    if (!SR) { dire("Le mode conversation demande la reconnaissance vocale : utilisez Chrome, Edge ou Safari récent."); return; }
    conv.on = !conv.on;
    majBoutonConv();
    if (conv.on) { dire('Mode conversation activé. Vous pouvez parler.'); }
    else { arreterEcoute(); stopParole(); setEtat('repos'); etatParler('🎤 Parler'); }
  }

  // Texte prêt à être lu : sans markdown, sans symboles ni emojis
  // Découpe en phrases courtes, pour une diction plus claire
  // Voix française du navigateur, si disponible
  function voixFr() {
    var vs = (global.speechSynthesis && speechSynthesis.getVoices) ? speechSynthesis.getVoices() : [];
    var fr = vs.filter(function (v) { return /^fr/i.test(v.lang); });
    var pref = fr.find(function (v) { return /Google|Microsoft|Amélie|Thomas|Denise|Hortense/i.test(v.name); });
    return pref || fr[0] || null;
  }
  function parler(t) {
    if (!global.speechSynthesis || !st.voix) { setEtat('repos'); reprendre(); return; }
    arreterEcoute();
    conv.parle = true;
    var morceaux = decouper(texteParlable(t));
    var fini = false;
    function fin() {
      if (fini) return;
      fini = true;
      clearTimeout(conv.minuterie);
      conv.parle = false; setEtat('repos'); reprendre();
    }
    clearTimeout(conv.minuterie);
    // Filet de sécurité : si le navigateur n'envoie jamais la fin de la lecture, on reprend quand même
    conv.minuterie = setTimeout(fin, Math.min(60000, Math.max(8000, morceaux.join(' ').length * 110)));
    try { speechSynthesis.cancel(); } catch (e) {}
    var voix = voixFr();
    if (!morceaux.length) { fin(); return; }
    morceaux.forEach(function (m, i) {
      var u = new SpeechSynthesisUtterance(m);
      u.lang = 'fr-FR';
      u.rate = 0.95;
      u.pitch = 1;
      if (voix) u.voice = voix;
      if (i === 0) u.onstart = function () { setEtat('parle'); };
      if (i === morceaux.length - 1) { u.onend = fin; u.onerror = fin; }
      u.onboundary = function (e) { if (e.name === 'word') geste('pulse'); };
      try { speechSynthesis.speak(u); } catch (e) { fin(); }
    });
  }

  // Bouton Parler : écoute une question (en mode conversation, il relance l'écoute)
  function micro() { ecouter(true); }

  // ---------- Conversation ----------
  // Nettoie le texte affiché : pas d'étoiles ni de dièses de markdown
  // ---------- Mise en forme d'une réponse (titres, gras, listes, tableaux) — échappée, sans HTML venant de l'IA ----------
  function echapper(t) {
    return String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function enLigne(t) {
    return echapper(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/__(.+?)__/g, '<b>$1</b>')
      .replace(/`([^`]+)`/g, '$1').replace(/\*(?!\s)(.+?)\*/g, '<i>$1</i>');
  }
  function rendu(t) {
    var lignes = String(t || '').replace(/\r/g, '').split('\n'), html = '', liste = null, i = 0;
    function fermer() { if (liste) { html += '</' + liste + '>'; liste = null; } }
    while (i < lignes.length) {
      var l = lignes[i], m;
      if (/^\s*\|.*\|\s*$/.test(l) && i + 1 < lignes.length && /^\s*\|?\s*:?-{2,}/.test(lignes[i + 1])) {
        fermer();
        var cellules = function (x) { return x.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (c) { return c.trim(); }); };
        html += '<div style="overflow-x:auto"><table style="border-collapse:collapse;margin:6px 0;font-size:13px"><thead><tr>' +
          cellules(l).map(function (c) { return '<th style="border:1px solid #bbb;padding:4px 6px;background:rgba(127,127,127,.15);text-align:left">' + enLigne(c) + '</th>'; }).join('') +
          '</tr></thead><tbody>';
        i += 2;
        while (i < lignes.length && /^\s*\|.*\|\s*$/.test(lignes[i])) {
          html += '<tr>' + cellules(lignes[i]).map(function (c) { return '<td style="border:1px solid #bbb;padding:4px 6px">' + enLigne(c) + '</td>'; }).join('') + '</tr>';
          i++;
        }
        html += '</tbody></table></div>';
        continue;
      }
      if ((m = /^\s*(#{1,4})\s+(.*)$/.exec(l))) { fermer(); html += '<div style="font-weight:700;margin:8px 0 3px;font-size:' + (m[1].length <= 2 ? '15px' : '14px') + '">' + enLigne(m[2]) + '</div>'; }
      else if ((m = /^\s*[-*•]\s+(.*)$/.exec(l))) { if (liste !== 'ul') { fermer(); html += '<ul style="margin:4px 0 4px 18px;padding:0">'; liste = 'ul'; } html += '<li style="margin:2px 0">' + enLigne(m[1]) + '</li>'; }
      else if ((m = /^\s*(\d+)[.)]\s+(.*)$/.exec(l))) { if (liste !== 'ol') { fermer(); html += '<ol style="margin:4px 0 4px 18px;padding:0">'; liste = 'ol'; } html += '<li style="margin:2px 0">' + enLigne(m[2]) + '</li>'; }
      else if (/^\s*$/.test(l)) { fermer(); }
      else { fermer(); html += '<div style="margin:3px 0">' + enLigne(l) + '</div>'; }
      i++;
    }
    fermer();
    return html;
  }
  // Texte brut d'une réponse (pour l'export) : mêmes règles, sans balises
  function texteBrut(t) {
    return String(t || '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/^#{1,6}\s*/gm, '').replace(/`+/g, '');
  }
  function telecharger(nom, contenu, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([contenu], { type: type }));
    a.download = nom;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function exporterWord(t) {
    var doc = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt} table{border-collapse:collapse} td,th{border:1px solid #888;padding:4px 6px}</style></head><body>' +
      rendu(t) + '</body></html>';
    telecharger('reponse-RH.doc', '\ufeff' + doc, 'application/msword');
  }
  // Excel : le tableau et le texte de la réponse, ouverts par Excel comme classeur
  function exporterExcel(t) {
    var doc = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8">' +
      '<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Reponse RH</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->' +
      '<style>table{border-collapse:collapse} td,th{border:1px solid #888;padding:4px 6px}</style></head><body>' + rendu(t) + '</body></html>';
    telecharger('reponse-RH.xls', '\ufeff' + doc, 'application/vnd.ms-excel');
  }
  function exporterTexte(t) { telecharger('reponse-RH.txt', texteBrut(t), 'text/plain;charset=utf-8'); }
  function exporterPdf(t) {
    var id = 'ia_print', d = document.getElementById(id);
    if (!d) {
      var css = document.createElement('style');
      css.textContent = '#ia_print{display:none}@media print{body>*:not(#ia_print){display:none!important}html body>#ia_print{display:block!important;position:static;color:#000;background:#fff;padding:18mm;font-family:Arial,sans-serif;font-size:11pt}}';
      document.head.appendChild(css);
      d = document.createElement('div'); d.id = id; document.body.appendChild(d);
    }
    d.innerHTML = rendu(t);
    var fin = function () { d.innerHTML = ''; window.removeEventListener('afterprint', fin); };
    window.addEventListener('afterprint', fin);
    window.print();
  }
  function barreExport(t) {
    var barre = el('div', 'display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;padding-top:6px;border-top:1px solid rgba(127,127,127,.25)');
    var boutons = [['📄 Word', exporterWord], ['📑 PDF (imprimer)', exporterPdf], ['📝 Texte', exporterTexte]];
    if (/^\s*\|.*\|\s*$/m.test(t)) boutons.splice(1, 0, ['📊 Excel', exporterExcel]);
    boutons.forEach(function (b) {
      var x = el('button', 'font-size:12px;padding:3px 8px;border-radius:8px;border:1px solid rgba(127,127,127,.4);background:transparent;color:inherit;cursor:pointer', b[0]);
      x.type = 'button';
      x.onclick = function () { b[1](t); };
      barre.appendChild(x);
    });
    return barre;
  }
  function ajouter(qui, texte) {
    var d = el('div', 'margin:6px 0;padding:8px 10px;border-radius:10px;max-width:90%;' +
      (qui === 'moi' ? 'margin-left:auto;background:#dbe9ff;color:#1a1a1a' : (st.theme === 'sombre' ? 'background:#2a303c;color:#f1f3f6' : 'background:#f1f3f6;color:#1a1a1a')));
    if (qui === 'av') {
      d.innerHTML = rendu(texte);
      if (String(texte || '').length >= 60) d.appendChild(barreExport(texte));
    } else {
      d.textContent = texte;
    }
    st.msgs.appendChild(d);
    st.msgs.scrollTop = st.msgs.scrollHeight;
  }
  function dire(t) {
    ajouter('av', t);
    geste('hoche');
    if (st.videoOn && st.onSpeak) {
      stopEcoute(); conv.parle = true; setEtat('parle');
      st.vid.onended = function () { conv.parle = false; setEtat('repos'); reprendre(); };
      Promise.resolve().then(function () { return st.onSpeak(t); })
        .then(function (url) {
          if (!url) { conv.parle = false; setEtat('repos'); reprendre(); return; }
          st.vid.src = url; st.vid.style.display = 'block'; st.vid.play().catch(function () {});
        })
        .catch(function (e) { conv.parle = false; setEtat('repos'); ajouter('av', 'Vidéo indisponible : ' + ((e && e.message) || e)); reprendre(); });
      return;
    }
    if (st.vid) { st.vid.pause(); st.vid.style.display = 'none'; }
    parler(t);
  }

  // Gestes simples de l'avatar : hochement de tête, pulsation sur chaque mot, retour au calme
  function geste(nom) {
    if (!st.av) return;
    st.av.classList.remove('aa-hoche', 'aa-pulse');
    void st.av.offsetWidth;
    st.av.classList.add(nom === 'hoche' ? 'aa-hoche' : 'aa-pulse');
  }
  function memoriser(q, rep) {
    historique.ajouter(q, rep);
  }
  function poser(q) {
    q = String(q || '').trim();
    if (!q) return;
    ajouter('moi', q);
    // Une salutation répétée au cours d'une conversation ne relance pas l'accueil
    if (historique.estSalutationRepetee(q)) {
      var deja = 'Je vous écoute. Que puis-je faire pour vous ?';
      memoriser(q, deja);
      dire(deja);
      return;
    }
    // 1) base de formation (module Apprentissage) ; 2) questions juridiques vers l'IA, sans les règles de la plateforme
    var calcul = /\d|combien|montant|calcul|indemnit|maternit|accouch|grossesse/i.test(q);
    var fa = !calcul && global.FormationAssistant && typeof global.FormationAssistant.localPour === 'function' ? global.FormationAssistant.localPour(q) : null;
    if (fa) { memoriser(q, fa); dire(fa); return; }
    var juridique = /code du travail|convention|d[ée]cret|article|\bloi\b|droit du travail|c.est quoi|qu.est.ce qu|d[ée]finition|expliqu/i.test(q);
    var a = (juridique || calcul) && st.onAI ? null : answerLocal(q);
    if (a) { memoriser(q, a); dire(a); return; }
    if (st.onAI) {
      setEtat('pense');
      var precedents = historique.precedents(12);
      Promise.resolve().then(function () { return st.onAI(q, precedents); })
        .then(function (r) { var txt = r || FALLBACK; memoriser(q, txt); dire(txt); })
        .catch(function () { dire(FALLBACK); });
      return;
    }
    dire(FALLBACK);
  }


  // ---------- Enregistrement commun (caméra ou galerie) ----------
  function enregistrerPhoto(blob) {
    if (st.photoUrl) URL.revokeObjectURL(st.photoUrl);
    st.photoUrl = URL.createObjectURL(blob);
    majAvatar();
    if (!st.onPhoto) { dire('Photo choisie. Aucun enregistrement n’est configuré pour le moment.'); return; }
    if (!confirm('Utiliser cette photo comme photo de profil ?')) { dire('Photo non enregistrée.'); return; }
    Promise.resolve().then(function () { return st.onPhoto(blob); })
      .then(function () { dire('Photo de profil enregistrée.'); })
      .catch(function (e) { dire('Enregistrement impossible : ' + ((e && e.message) || e)); });
  }

  // Galerie du téléphone ou fichiers de l'ordinateur : fonctionne même si la caméra est refusée
  function galerie() {
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.style.display = 'none';
    document.body.appendChild(inp);
    inp.onchange = function () {
      var f = inp.files && inp.files[0];
      inp.remove();
      if (f) enregistrerPhoto(f);
    };
    inp.click();
  }

  // ---------- Photo de l'avatar (séparée de la photo de profil) ----------
  function photoAvatar() {
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.style.display = 'none';
    document.body.appendChild(inp);
    inp.onchange = function () {
      var f = inp.files && inp.files[0];
      inp.remove();
      if (!f) return;
      if (!st.onAvatarPhoto) { dire("Aucun enregistrement de photo d'avatar n'est configuré."); return; }
      dire('Envoi de la photo de l’avatar…');
      Promise.resolve().then(function () { return st.onAvatarPhoto(f); })
        .then(function () { dire('Photo de l’avatar enregistrée. Votre profil n’est pas modifié.'); })
        .catch(function (e) { dire('Enregistrement impossible : ' + ((e && e.message) || e)); });
    };
    inp.click();
  }

  // ---------- Enregistrement de votre voix (pour cloner votre voix) ----------
  function enregistrerVoix() {
    if (!navigator.mediaDevices || !global.MediaRecorder) { dire("L'enregistrement audio n'est pas disponible sur cet appareil."); return; }
    if (!st.onVoice) { dire("Aucun enregistrement de voix n'est configuré."); return; }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (flux) {
      var morceaux = [], rec;
      try { rec = new MediaRecorder(flux); } catch (e) { flux.getTracks().forEach(function (t) { t.stop(); }); dire('Enregistrement impossible sur ce navigateur.'); return; }
      dire('Parlez naturellement pendant 20 secondes, dans un endroit calme.');
      rec.ondataavailable = function (e) { if (e.data && e.data.size) morceaux.push(e.data); };
      rec.onstop = function () {
        flux.getTracks().forEach(function (t) { t.stop(); });
        var blob = new Blob(morceaux, { type: rec.mimeType || 'audio/webm' });
        Promise.resolve().then(function () { return st.onVoice(blob); })
          .then(function () { dire('Voix enregistrée. Votre assistant peut maintenant parler avec votre voix.'); })
          .catch(function (e) { dire('Enregistrement de la voix impossible : ' + ((e && e.message) || e)); });
      };
      rec.start();
      setTimeout(function () { if (rec.state !== 'inactive') rec.stop(); }, 20000);
    }).catch(function (e) { dire('Micro refusé : ' + ((e && e.message) || e)); });
  }

  // ---------- Photo par caméra ----------
  function prendrePhoto() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject(new Error('caméra non disponible sur cet appareil'));
    }
    return navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false }).then(function (flux) {
      return new Promise(function (ok, ko) {
        var fond = el('div', 'position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:12px');
        var video = el('video', 'max-width:100%;max-height:70vh;border-radius:12px;background:#000');
        video.autoplay = true; video.playsInline = true; video.muted = true;
        video.srcObject = flux;
        var btns = el('div', 'display:flex;gap:10px');
        var snap = el('button', 'padding:10px 16px;font-size:16px;cursor:pointer', '📸 Prendre la photo');
        var annuler = el('button', 'padding:10px 16px;font-size:16px;cursor:pointer', 'Annuler');
        function fin() {
          flux.getTracks().forEach(function (t) { t.stop(); });
          fond.remove();
        }
        snap.onclick = function () {
          var c = document.createElement('canvas');
          c.width = video.videoWidth || 640;
          c.height = video.videoHeight || 480;
          c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
          c.toBlob(function (b) { fin(); if (b) ok(b); else ko(new Error('image non créée')); }, 'image/jpeg', 0.9);
        };
        annuler.onclick = function () { fin(); ko(new Error('annulé')); };
        btns.appendChild(snap); btns.appendChild(annuler);
        fond.appendChild(video); fond.appendChild(btns);
        document.body.appendChild(fond);
      });
    });
  }
  function photo() {
    prendrePhoto().then(function (blob) {
      if (st.photoUrl) URL.revokeObjectURL(st.photoUrl);
      st.photoUrl = URL.createObjectURL(blob);
      majAvatar();
      if (!st.onPhoto) { dire('Photo prise. Aucun enregistrement n’est configuré pour le moment.'); return; }
      if (!confirm('Utiliser cette photo comme photo de profil ?')) { dire('Photo non enregistrée.'); return; }
      Promise.resolve().then(function () { return st.onPhoto(blob); })
        .then(function () { dire('Photo de profil enregistrée.'); })
        .catch(function (e) { dire("Enregistrement impossible : " + ((e && e.message) || e)); });
    }).catch(function (e) {
      var m = String((e && e.message) || e);
      if (/annul/i.test(m)) return;
      dire("Je ne peux pas utiliser la caméra : " + m + ". Vérifiez l’autorisation du navigateur (le site doit être en https), ou utilisez 🖼 Galerie.");
    });
  }

  // ---------- Enregistrement vidéo de la personne (source privée pour générer l'avatar) ----------
  function filmer() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !global.MediaRecorder) {
      dire("L'enregistrement vidéo n'est pas disponible sur cet appareil.");
      return;
    }
    if (!st.onVideo) { dire("Aucun enregistrement vidéo n'est configuré pour le moment."); return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true }).then(function (flux) {
      var fond = el('div', 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:12px');
      var video = el('video', 'max-width:100%;max-height:65vh;border-radius:12px;background:#000');
      video.autoplay = true; video.playsInline = true; video.muted = true; video.srcObject = flux;
      var info = el('div', 'color:#fff;font-size:15px;text-align:center', 'Regardez la caméra et parlez naturellement pendant 15 secondes. Visage bien éclairé, sans lunettes de soleil.');
      var btn = el('button', 'padding:10px 16px;font-size:16px;cursor:pointer', '⏺ Démarrer');
      var annul = el('button', 'padding:10px 16px;font-size:16px;cursor:pointer', 'Annuler');
      var bar = el('div', 'display:flex;gap:10px');
      bar.appendChild(btn); bar.appendChild(annul);
      fond.appendChild(video); fond.appendChild(info); fond.appendChild(bar);
      document.body.appendChild(fond);
      function fin() { flux.getTracks().forEach(function (t) { t.stop(); }); fond.remove(); }
      annul.onclick = function () { fin(); };
      btn.onclick = function () {
        btn.disabled = true;
        info.textContent = 'Enregistrement en cours… 15 secondes';
        var morceaux = [], rec;
        try { rec = new MediaRecorder(flux); } catch (e) { fin(); dire("Enregistrement impossible sur ce navigateur."); return; }
        rec.ondataavailable = function (e) { if (e.data && e.data.size) morceaux.push(e.data); };
        rec.onstop = function () {
          var blob = new Blob(morceaux, { type: rec.mimeType || 'video/webm' });
          fin();
          Promise.resolve().then(function () { return st.onVideo(blob); })
            .then(function () { dire("Vidéo enregistrée. Elle sert uniquement à créer votre avatar et reste privée."); })
            .catch(function (e) { dire("Enregistrement de la vidéo impossible : " + ((e && e.message) || e)); });
        };
        rec.start();
        setTimeout(function () { if (rec.state !== 'inactive') rec.stop(); }, 15000);
      };
    }).catch(function (e) { dire("Caméra ou micro refusés : " + ((e && e.message) || e)); });
  }

  // ---------- Affichage ----------
  function majAvatar() {
    if (!st.av) return;
    st.av.innerHTML = '';
    if (st.photoUrl) {
      var img = el('img', 'width:100%;height:100%;object-fit:cover;border-radius:50%');
      img.src = st.photoUrl; img.alt = st.nom;
      st.av.appendChild(img);
    } else {
      st.av.innerHTML = '<svg width="52" height="52" viewBox="0 0 52 52" role="img" aria-label="Assistant"><rect width="52" height="52" fill="#E6F1FB"/><path d="M6 52 C6 38 16 34 26 34 C36 34 46 38 46 52 Z" fill="#378ADD"/><path d="M22 34 L26 40 L30 34 Z" fill="#E6F1FB"/><rect x="22" y="28" width="8" height="8" fill="#D9A58A"/><ellipse cx="26" cy="22" rx="11" ry="12.5" fill="#E8B99A"/><path d="M14 20 C14 9 38 9 38 20 C34 14 18 14 14 20 Z" fill="#3B2F2A"/><circle cx="22" cy="23" r="1.4" fill="#2C2C2A"/><circle cx="30" cy="23" r="1.4" fill="#2C2C2A"/></svg>';
    }
  }
  function construire() {
    var css = '@keyframes aaSway{0%,100%{transform:rotate(-.5deg)}50%{transform:rotate(.5deg)}}' +
      '@keyframes aaHoche{0%{transform:translateY(0)}40%{transform:translateY(3px) rotate(1deg)}100%{transform:translateY(0)}}' +
      '@keyframes aaPop{0%{transform:scale(1)}40%{transform:scale(1.05)}100%{transform:scale(1)}}' +
      '#aa-av{animation:aaSway 6s ease-in-out infinite}' +
      '#aa-av.aa-hoche{animation:aaHoche .6s ease-out 1}' +
      '#aa-av.aa-pulse{animation:aaPop .18s ease-out 1}' +
      '#aa-av[data-s="parle"]{animation:aaSway 1.6s ease-in-out infinite}';
    var s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);

    var lanceur = el('button', 'position:fixed;right:16px;bottom:64px;z-index:9999;width:48px;height:48px;border-radius:50%;border:none;background:#1f5fbf;color:#fff;font-size:24px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3)', '💬');
    lanceur.title = 'Assistant RH';
    st.lanceur = lanceur;

    var panel = el('div', 'position:fixed;right:12px;bottom:128px;z-index:9999;width:min(340px,calc(100vw - 24px));max-height:60vh;display:none;flex-direction:column;background:#fff;color:#1a1a1a;border:1px solid #d6dbe3;border-radius:14px;box-shadow:0 6px 20px rgba(0,0,0,.25);overflow:hidden;font-family:inherit');

    var entete = el('div', 'display:flex;align-items:center;gap:10px;padding:10px;background:#f5f6f8;border-bottom:1px solid #e3e6ec');
    st.av = el('div', 'width:52px;height:52px;border-radius:50%;background:#1f5fbf;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;overflow:hidden;flex:0 0 auto;transition:box-shadow .2s');
    st.av.id = 'aa-av'; st.av.setAttribute('data-s', 'repos');
    var titre = el('div', 'flex:1;min-width:0');
    titre.appendChild(el('div', 'font-weight:700', 'Assistant RH'));
    st.btnVoix = el('button', 'padding:6px 8px;font-size:12px;cursor:pointer', '🔊 Voix : oui');
    st.btnVoix.onclick = function () {
      st.voix = !st.voix;
      st.btnVoix.textContent = st.voix ? '🔊 Voix : oui' : '🔇 Voix : non';
      if (!st.voix && global.speechSynthesis) speechSynthesis.cancel();
    };
    entete.appendChild(st.av); entete.appendChild(titre); entete.appendChild(st.btnVoix);

    st.vid = el('video', 'width:100%;max-height:220px;background:#000;display:none');
    st.vid.playsInline = true; st.vid.controls = true;
    st.btnVideo = el('button', 'padding:6px 8px;font-size:12px;cursor:pointer;margin-left:6px', '🎬 Vidéo : non');
    st.btnVideo.onclick = function () {
      st.videoOn = !st.videoOn;
      st.btnVideo.textContent = st.videoOn ? '🎬 Vidéo : oui' : '🎬 Vidéo : non';
      if (!st.videoOn && st.vid) { st.vid.pause(); st.vid.style.display = 'none'; }
    };
    panel.appendChild(st.vid);
    st.msgs = el('div', 'flex:1;overflow-y:auto;padding:10px;min-height:160px;max-height:40vh;font-size:14px');

    var barre = el('div', 'display:flex;gap:6px;padding:6px 8px;border-top:1px solid #e3e6ec;flex-wrap:wrap');
    var bPhoto = el('button', 'padding:8px 10px;cursor:pointer;font-size:13px', '📷 Ma photo');
    bPhoto.onclick = photo;
    var bAv = el('button', 'padding:8px 10px;cursor:pointer;font-size:13px', '🧑 Photo avatar');
    bAv.onclick = photoAvatar;
    var bVoix = el('button', 'padding:8px 10px;cursor:pointer;font-size:13px', '🎙 Ma voix');
    bVoix.onclick = enregistrerVoix;
    var bVid = el('button', 'padding:8px 10px;cursor:pointer;font-size:13px', '🎥 Filmer');
    bVid.onclick = filmer;
    var bGal = el('button', 'padding:8px 10px;cursor:pointer;font-size:13px', '🖼 Galerie');
    bGal.onclick = galerie;
    var bMic = el('button', 'padding:8px 10px;cursor:pointer;font-size:13px', '🎤 Parler');
    bMic.onclick = micro;
    st.btnParler = bMic;
    st.btnConv = el('button', 'padding:8px 10px;cursor:pointer;font-size:13px', '🎧 Conversation : non');
    st.btnConv.onclick = toggleConv;
    st.input = el('input', 'flex:1;min-width:120px;padding:8px;font-size:14px');
    st.input.placeholder = 'Posez votre question…';
    st.input.onkeydown = function (e) { if (e.key === 'Enter') { var v = st.input.value; st.input.value = ''; poser(v); } };
    var bEnv = el('button', 'padding:8px 10px;cursor:pointer;font-size:13px', 'Envoyer');
    bEnv.onclick = function () { var v = st.input.value; st.input.value = ''; poser(v); };
    barre.appendChild(bMic); barre.appendChild(st.btnConv); barre.appendChild(st.input); barre.appendChild(bEnv);

    panel.appendChild(entete); panel.appendChild(st.msgs); panel.appendChild(barre);
    document.body.appendChild(lanceur);
    document.body.appendChild(panel);
    st.panel = panel;

    lanceur.onclick = function () {
      var ouvert = panel.style.display === 'flex';
      panel.style.display = ouvert ? 'none' : 'flex';
      if (!ouvert && !st.msgs.childNodes.length) {
        var u = (st.utilisateur && st.utilisateur()) || '';
        dire('Bonjour' + (u ? ' ' + u : '') + ', je suis votre Assistant RH.');
      }
    };
    majAvatar();
  }

  // ---------- API publique ----------
  global.AideAvatar = {
    // Efface la conversation affichée (à appeler à la déconnexion)
    reset: function () {
      if (st.msgs) st.msgs.innerHTML = '';
      historique.reset();
      conv.on = false; arreterEcoute(); stopParole(); setEtat('repos'); majBoutonConv();
    },
    _ecoute: { rms: rms, accepterTexte: accepterTexte, seuilDepuis: seuilDepuis, etat: function () { return ecoute; } },
    setStyle: function (o) {
      o = o || {};
      if (o.couleur) st.couleur = o.couleur;
      if (o.forme) st.forme = o.forme;
      if (o.taille) st.taille = o.taille;
      if (o.theme) st.theme = o.theme;
      if (o.position) st.position = o.position;
      if (o.police) st.police = o.police;
      if (o.vitesse) st.vitesse = parseFloat(o.vitesse) || 1;
      if (o.afficherAv !== undefined) st.afficherAv = !!o.afficherAv;
      var gauche = st.position === 'gauche', sombre = st.theme === 'sombre';
      if (st.lanceur) {
        st.lanceur.style.background = st.couleur;
        st.lanceur.style.left = gauche ? '16px' : 'auto';
        st.lanceur.style.right = gauche ? 'auto' : '16px';
      }
      if (st.av) { st.av.style.borderRadius = st.forme === 'carre' ? '10px' : '50%'; st.av.style.display = st.afficherAv ? 'flex' : 'none'; }
      if (st.panel) {
        st.panel.style.width = ({ petite: '300px', normale: '340px', grande: '420px' }[st.taille] || '340px');
        st.panel.style.left = gauche ? '12px' : 'auto';
        st.panel.style.right = gauche ? 'auto' : '12px';
        st.panel.style.background = sombre ? '#1b1f27' : '#fff';
        st.panel.style.color = sombre ? '#f1f3f6' : '#1a1a1a';
        st.panel.style.fontSize = ({ petite: '13px', normale: '14px', grande: '17px' }[st.police] || '14px');
      }
    },
    actions: {
      profil: function () { galerie(); },
      camera: function () { photo(); },
      avatar: function () { photoAvatar(); },
      voix: function () { enregistrerVoix(); },
      filmer: function () { filmer(); },
      toggleVideo: function () {
        st.videoOn = !st.videoOn;
        if (st.btnVideo) st.btnVideo.textContent = st.videoOn ? '🎬 Vidéo : oui' : '🎬 Vidéo : non';
        if (!st.videoOn && st.vid) { st.vid.pause(); st.vid.style.display = 'none'; }
        return st.videoOn;
      },
      videoActive: function () { return st.videoOn; }
    },
    start: function (opts) {
      if (st.started) return;
      opts = opts || {};
      st.nom = opts.nom || st.nom;
      st.onPhoto = typeof opts.onPhoto === 'function' ? opts.onPhoto : null;
      st.onAI = typeof opts.onAI === 'function' ? opts.onAI : null;
      st.onVideo = typeof opts.onVideo === 'function' ? opts.onVideo : null;
      st.onSpeak = typeof opts.onSpeak === 'function' ? opts.onSpeak : null;
      st.onVoice = typeof opts.onVoice === 'function' ? opts.onVoice : null;
      st.onAvatarPhoto = typeof opts.onAvatarPhoto === 'function' ? opts.onAvatarPhoto : null;
      st.utilisateur = typeof opts.utilisateur === 'function' ? opts.utilisateur : null;
      st.started = true;
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', construire);
      else construire();
    },
    ask: function (q) { poser(q); },
    setNom: function (n) { st.nom = n || st.nom; majAvatar(); },
    setPhoto: function (url) { st.photoUrl = url || null; majAvatar(); },
    faq: FAQ.map(function (f) { return { mots: f.q, reponse: f.a }; })
  };
})(window);
