/* aide-avatar.js — Assistant visuel TERH : photo de profil, aide écrite et vocale.
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
  var FAQ = [
    { q: ['bonjour', 'salut', 'aide'], a: "Bonjour ! Je peux vous expliquer une fonction de l'application, prendre votre photo de profil ou répondre à vos questions. Que voulez-vous faire ?" },
    { q: ['ajouter un employe', 'nouvel employe', 'creer un employe', 'ajouter employe'], a: "Ouvrez l'onglet Personnel, puis « ➕ Nouvel employé ». Renseignez le nom, le poste et le type de contrat, puis enregistrez." },
    { q: ['importer', 'import', 'fichier excel', 'effectif'], a: "Cliquez sur « ⬆ Importer » et choisissez votre fichier Excel. Les colonnes inconnues sont créées automatiquement comme colonnes personnalisées." },
    { q: ['colonne', 'colonnes personnalisees', 'ajouter une colonne'], a: "Administrateur : cliquez sur « 🧱 Colonnes » pour ajouter ou supprimer une colonne. « 👁 Colonnes affichées » choisit ce qui apparaît dans la liste." },
    { q: ['conge', 'demande de conge', 'vacances'], a: "Ouvrez le module Congés, puis « nouvelle demande ». Le responsable approuve ou refuse. Ces décisions demandent la connexion." },
    { q: ['alerte', 'echeance', 'expire', 'cni', 'visite medicale'], a: "Le module 🔔 Alertes affiche les périodes d'essai à décider, les pièces qui expirent, les fins de contrat et les CDD au-delà de leurs règles." },
    { q: ['periode d essai', 'essai', 'confirmer', 'rompre'], a: "Dans 🔔 Alertes, section « Périodes d'essai à décider » : cliquez sur Confirmer ou Rompre. La décision est gardée avec sa date." },
    { q: ['contrat', 'cdd', 'ctt', 'occasionnel', 'regle'], a: "Les règles de chaque type de contrat se modifient dans 🔔 Alertes → « ⚙ Règles des contrats » : durée, renouvellements, reconduction tacite." },
    { q: ['sortie', 'dossier de sortie', 'certificat', 'solde de tout compte'], a: "Dès qu'un employé a une date de sortie, son dossier apparaît dans 🔔 Alertes : certificat, attestation CNPS, solde de tout compte, matériel." },
    { q: ['profil', 'droit', 'acces', 'permission', 'role'], a: "Les droits se règlent dans Centre de contrôle → Sociétés et accès. Le menu « Modèle rapide » applique un profil créé par l'administrateur." },
    { q: ['journal', 'audit', 'qui a modifie'], a: "Le journal enregistre automatiquement chaque modification avec son auteur. Les administrateurs de société le voient dans 🔔 Alertes ; le propriétaire dans Centre de contrôle → Audit." },
    { q: ['hors ligne', 'sans internet', 'pas de connexion', 'connexion'], a: "L'application s'ouvre sans connexion et affiche les dernières données. Vos ajouts et modifications restent sur l'appareil et sont envoyés dès le retour du réseau." },
    { q: ['photo', 'avatar', 'ma photo', 'mon image'], a: "Appuyez sur « 📷 Ma photo » pour prendre une photo avec la caméra. Vous choisissez ensuite si elle devient votre photo de profil." },
    { q: ['barre', 'defilement', 'defiler', 'tableau trop large'], a: "Une barre de défilement apparaît en haut et en bas des tableaux trop larges. Tirez-la pour voir les colonnes à droite." },
    { q: ['tableau de bord', 'graphique', 'statistique'], a: "Le tableau de bord affiche les effectifs et les graphiques. Le mode édition (👁 et ▲▼) permet de masquer ou réordonner les cartes." }
  ];

  var FALLBACK = "Je n'ai pas trouvé de réponse précise. Essayez des mots comme : importer, congé, alertes, contrat, profil, journal, hors ligne.";
  var SR = global.SpeechRecognition || global.webkitSpeechRecognition;
  var st = { nom: 'Assistant', onSpeak: null, videoOn: false, vid: null, btnVideo: null, onPhoto: null, onAI: null, voix: true, av: null, msgs: null, input: null, photoUrl: null, panel: null, btnVoix: null, started: false };

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
  function answerLocal(text) {
    var n = norm(text), best = null, score = 0;
    FAQ.forEach(function (f) {
      var sc = 0;
      f.q.forEach(function (k) { if (n.indexOf(norm(k)) !== -1) sc += norm(k).length; });
      if (sc > score) { score = sc; best = f; }
    });
    return best ? best.a : null;
  }

  // ---------- Voix ----------
  function setEtat(e) {
    if (!st.av) return;
    st.av.setAttribute('data-s', e);
    st.av.style.boxShadow = e === 'parle' ? '0 0 0 4px #1f9d55' : e === 'ecoute' ? '0 0 0 4px #d97706' : e === 'pense' ? '0 0 0 4px #2563eb' : 'none';
  }
  function parler(t) {
    if (!global.speechSynthesis || !st.voix) { setEtat('repos'); return; }
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(t);
    u.lang = 'fr-FR';
    u.rate = 1;
    u.onstart = function () { setEtat('parle'); };
    u.onboundary = function (e) { if (e.name === 'word') geste('pulse'); };
    u.onend = function () { setEtat('repos'); };
    u.onerror = function () { setEtat('repos'); };
    speechSynthesis.speak(u);
  }
  function micro() {
    if (!SR) {
      dire("La reconnaissance vocale n'est pas disponible sur ce navigateur. Utilisez Chrome, Edge ou Safari récent, ou écrivez votre question.");
      return;
    }
    var r = new SR();
    r.lang = 'fr-FR';
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = function (e) { poser(e.results[0][0].transcript); };
    r.onerror = function () { setEtat('repos'); dire("Je n'ai pas bien entendu. Réessayez ou écrivez votre question."); };
    r.onend = function () { if (st.av && st.av.getAttribute('data-s') === 'ecoute') setEtat('repos'); };
    setEtat('ecoute');
    try { r.start(); } catch (e) { setEtat('repos'); }
  }

  // ---------- Conversation ----------
  function ajouter(qui, texte) {
    var d = el('div', 'margin:6px 0;padding:8px 10px;border-radius:10px;max-width:90%;' +
      (qui === 'moi' ? 'margin-left:auto;background:#dbe9ff' : 'background:#f1f3f6'), texte);
    st.msgs.appendChild(d);
    st.msgs.scrollTop = st.msgs.scrollHeight;
  }
  function dire(t) {
    ajouter('av', t);
    geste('hoche');
    if (st.videoOn && st.onSpeak) {
      setEtat('parle');
      Promise.resolve().then(function () { return st.onSpeak(t); })
        .then(function (url) {
          if (!url) { setEtat('repos'); return; }
          st.vid.src = url; st.vid.style.display = 'block'; st.vid.play().catch(function () {});
        })
        .catch(function (e) { setEtat('repos'); ajouter('av', 'Vidéo indisponible : ' + ((e && e.message) || e)); });
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
  function poser(q) {
    q = String(q || '').trim();
    if (!q) return;
    ajouter('moi', q);
    var a = answerLocal(q);
    if (a) { dire(a); return; }
    if (st.onAI) {
      setEtat('pense');
      Promise.resolve().then(function () { return st.onAI(q); })
        .then(function (r) { dire(r || FALLBACK); })
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
      st.av.textContent = initiales(st.nom);
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

    var lanceur = el('button', 'position:fixed;right:16px;bottom:64px;z-index:9999;width:56px;height:56px;border-radius:50%;border:none;background:#1f5fbf;color:#fff;font-size:24px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3)', '💬');
    lanceur.title = 'Assistant';

    var panel = el('div', 'position:fixed;right:12px;bottom:128px;z-index:9999;width:min(360px,calc(100vw - 24px));max-height:70vh;display:none;flex-direction:column;background:#fff;border:1px solid #d6dbe3;border-radius:14px;box-shadow:0 6px 20px rgba(0,0,0,.25);overflow:hidden;font-family:inherit');

    var entete = el('div', 'display:flex;align-items:center;gap:10px;padding:10px;background:#f5f6f8;border-bottom:1px solid #e3e6ec');
    st.av = el('div', 'width:52px;height:52px;border-radius:50%;background:#1f5fbf;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;overflow:hidden;flex:0 0 auto;transition:box-shadow .2s');
    st.av.id = 'aa-av'; st.av.setAttribute('data-s', 'repos');
    var titre = el('div', 'flex:1;min-width:0');
    titre.appendChild(el('div', 'font-weight:700', 'Assistant de Fabrice'));
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
    st.input = el('input', 'flex:1;min-width:120px;padding:8px;font-size:14px');
    st.input.placeholder = 'Posez votre question…';
    st.input.onkeydown = function (e) { if (e.key === 'Enter') { var v = st.input.value; st.input.value = ''; poser(v); } };
    var bEnv = el('button', 'padding:8px 10px;cursor:pointer;font-size:13px', 'Envoyer');
    bEnv.onclick = function () { var v = st.input.value; st.input.value = ''; poser(v); };
    barre.appendChild(bMic); barre.appendChild(st.input); barre.appendChild(bEnv);

    panel.appendChild(entete); panel.appendChild(st.msgs); panel.appendChild(barre);
    document.body.appendChild(lanceur);
    document.body.appendChild(panel);
    st.panel = panel;

    lanceur.onclick = function () {
      var ouvert = panel.style.display === 'flex';
      panel.style.display = ouvert ? 'none' : 'flex';
      if (!ouvert && !st.msgs.childNodes.length) {
        dire('Bonjour ' + st.nom + ' ! Je peux vous expliquer l’application, prendre votre photo ou répondre à vos questions à l’écrit ou à la voix.');
      }
    };
    majAvatar();
  }

  // ---------- API publique ----------
  global.AideAvatar = {
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
