/* paie-modeles.js : bulletins modèles (mise en page du bulletin imprimé).
 * PaieModeles.ouvrir()  : éditeur (nom, couleur, logo et sa position, rubriques affichées et leur ordre,
 *                         disposition des blocs, colonnes du tableau, pied légal, charges patronales).
 * PaieModeles.actif()   : modèle par défaut, utilisé à l'impression du bulletin détaillé.
 * Sauvegarde : localStorage 'terh_paie_modeles' + table parametres (clé paie_modeles_json) via window.TERH_paieModeles.
 */
(function (root) {
  'use strict';

  var CLE_BASE = 'terh_paie_modeles';
  // Clé par entreprise : les modèles d'une société ne doivent jamais apparaître dans une autre
  function cle() {
    var co = '';
    try { co = (typeof CO !== 'undefined' && CO) ? String(CO) : ''; } catch (e) { co = ''; }
    return co ? CLE_BASE + '_' + co : CLE_BASE;
  }
  var TAILLE_LOGO_MAX = 300 * 1024;          // logo enregistré (après redimensionnement)
  var TAILLE_FICHIER_MAX = 5 * 1024 * 1024;  // fichier choisi à l'import
  var FORMATS_LOGO = 'image/png,image/jpeg,image/webp,image/gif,image/bmp,image/svg+xml';
  var PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  var PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  var TESSERACT_URL = 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.1/tesseract.min.js';
  var TESSDATA_FRA = 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/fra/4.0.0_best_int';
  var BLOCS = [
    ['entete', 'En-tête (titre, employeur, logo, période)'],
    ['salarie', 'Bloc salarié (nom, matricule, CNPS, ancienneté)'],
    ['rubriques', 'Rubriques, retenues et charges'],
    ['pied', 'Pied (net à payer, cumuls, mention légale)']
  ];
  var DISPOSITIONS = {
    standard: ['entete', 'salarie', 'rubriques', 'pied'],
    compact: ['entete', 'rubriques', 'pied'],
    rubriques_en_premier: ['rubriques', 'entete', 'salarie', 'pied']
  };
  var LIBELLE_DISPO = {
    standard: 'Standard (en-tête, salarié, rubriques, pied)',
    compact: 'Compact (sans bloc salarié)',
    rubriques_en_premier: 'Rubriques en premier'
  };
  var POS_LOGO = { gauche: 'À gauche', centre: 'Au centre', droite: 'À droite', aucun: 'Ne pas afficher' };
  var COLONNES = [['nombre', 'Nombre'], ['base', 'Base'], ['taux', 'Taux'], ['retenuePatronale', 'Charges patronales']];

  var DEFAUT = [{
    id: 'sage', nom: 'Sage standard', couleur: '', afficherPatronales: true, afficherPied: true, pied: '', defaut: true,
    blocs: DISPOSITIONS.standard.slice(), colonnes: { nombre: true, base: true, taux: true, retenuePatronale: true },
    logo: '', logoPos: 'gauche', rubriques: []
  }];

  // Gabarit « Hôtel Océan » : proposé en plus du modèle Sage, jamais par défaut
  var OCEAN = {
    id: 'ocean', nom: 'Hôtel Océan', gabarit: 'ocean', couleur: '', afficherPatronales: false, afficherPied: true,
    afficherCout: false, pied: '', defaut: false, blocs: DISPOSITIONS.standard.slice(),
    colonnes: { nombre: true, base: true, taux: true, retenuePatronale: false }, logo: '', logoPos: 'centre', rubriques: []
  };

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function nouvelId() { return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function copie(m) {
    return {
      id: String(m.id || nouvelId()),
      gabarit: m.gabarit === 'ocean' ? 'ocean' : 'sage',
      nom: String(m.nom || '').trim() || 'Modèle sans nom',
      couleur: /^#[0-9a-fA-F]{6}$/.test(m.couleur || '') ? m.couleur : '',
      afficherPatronales: m.afficherPatronales !== false,
      afficherPied: m.afficherPied !== false,
      afficherCout: m.afficherCout === true,
      pied: String(m.pied || ''),
      defaut: !!m.defaut,
      blocs: (Array.isArray(m.blocs) && m.blocs.length)
        ? m.blocs.filter(function (b) { return BLOCS.some(function (x) { return x[0] === b; }); })
        : DISPOSITIONS.standard.slice(),
      colonnes: Object.assign({ nombre: true, base: true, taux: true, retenuePatronale: true }, m.colonnes || {}),
      logo: /^data:image\/(png|jpe?g|gif|webp);base64,/.test(m.logo || '') ? m.logo : '',
      logoPos: POS_LOGO[m.logoPos] ? m.logoPos : 'gauche',
      rubriques: Array.isArray(m.rubriques) ? m.rubriques.map(String) : []
    };
  }
  function normaliser(liste) {
    var l = (liste && liste.length ? liste : DEFAUT).map(copie);
    var d = l.filter(function (m) { return m.defaut; });
    if (!d.length) l[0].defaut = true;
    else if (d.length > 1) l.forEach(function (m) { m.defaut = (m === d[0]); });
    return l;
  }
  function charger() {
    try {
      var b = root.localStorage && root.localStorage.getItem(cle());
      if (b) { var l = JSON.parse(b); if (Array.isArray(l) && l.length) return normaliser(l); }
    } catch (e) {}
    return normaliser(DEFAUT);
  }
  function sauver(liste) {
    try { root.localStorage && root.localStorage.setItem(cle(), JSON.stringify(liste)); } catch (e) {}
    var pont = root.TERH_paieModeles;
    if (pont && pont.save) {
      Promise.resolve(pont.save(liste)).catch(function (e) { console.error('Modèles : sauvegarde base impossible', e); });
    }
  }
  function synchroniser() {
    var pont = root.TERH_paieModeles;
    if (!pont || !pont.load) return Promise.resolve(null);
    return Promise.resolve(pont.load()).then(function (l) {
      if (!Array.isArray(l) || !l.length) return null;
      var n = normaliser(l);
      try { root.localStorage && root.localStorage.setItem(cle(), JSON.stringify(n)); } catch (e) {}
      return n;
    }).catch(function () { return null; });
  }
  function parId(id) {
    var l = charger();
    return l.filter(function (m) { return m.id === String(id); })[0] || actif();
  }
  function options() {
    return charger().map(function (m) {
      return '<option value="' + esc(m.id) + '"' + (m.defaut ? ' selected' : '') + '>' + esc(m.nom) + '</option>';
    }).join('');
  }
  function actif() {
    var l = charger();
    return l.filter(function (m) { return m.defaut; })[0] || l[0];
  }

  // Catalogue de rubriques de la société (paie-rubriques.js)
  function catalogue() {
    var c = (root.PaieRubriques && root.PaieRubriques.charger) ? root.PaieRubriques.charger() : [];
    return c.filter(function (r) { return r.code; });
  }

  // Logo : toute image courante, redimensionnée et compressée pour rester sous 300 Ko
  function preparerLogo(fichier) {
    return new Promise(function (ok, ko) {
      if (!fichier) return ko(new Error('Aucun fichier.'));
      if (fichier.size > TAILLE_FICHIER_MAX) return ko(new Error('Fichier trop lourd (' + Math.round(fichier.size / 1024) + ' Ko). Maximum 5 Mo.'));
      var url = URL.createObjectURL(fichier);
      var img = new Image();
      img.onerror = function () { URL.revokeObjectURL(url); ko(new Error('Image illisible : utilisez PNG, JPG, WebP, GIF, BMP ou SVG.')); };
      img.onload = function () {
        URL.revokeObjectURL(url);
        var w = img.naturalWidth || 400, h = img.naturalHeight || 200;
        var echelle = Math.min(1, 600 / Math.max(w, h));
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w * echelle)); c.height = Math.max(1, Math.round(h * echelle));
        var x = c.getContext('2d');
        x.drawImage(img, 0, 0, c.width, c.height);
        var png = c.toDataURL('image/png');
        if (png.length * 0.75 <= TAILLE_LOGO_MAX) return ok(png);
        // Trop lourd en PNG : fond blanc et JPEG à qualité décroissante
        var f = document.createElement('canvas'); f.width = c.width; f.height = c.height;
        var fx = f.getContext('2d'); fx.fillStyle = '#fff'; fx.fillRect(0, 0, f.width, f.height); fx.drawImage(c, 0, 0);
        for (var q = 0.9; q >= 0.4; q -= 0.1) {
          var jpg = f.toDataURL('image/jpeg', q);
          if (jpg.length * 0.75 <= TAILLE_LOGO_MAX) return ok(jpg);
        }
        ko(new Error('Logo trop complexe même compressé : utilisez une image plus simple.'));
      };
      img.src = url;
    });
  }

  // Lignes de rubriques d'un bulletin Sage (texte extrait du PDF) : « 1000 Salaire de Base mensuel ... »
  function rubriquesDuTexte(texte, confs) {
    var vus = {}, out = [];
    String(texte || '').split(/\r?\n/).forEach(function (l) {
      var ligne = l.trim();
      var m = ligne.match(/^(\d{4})\s+([A-Za-zÀ-ÿ][^\d]*?)(?:\s{2,}|\s+\d|\s*$)/);
      if (!m || vus[m[1]]) return;
      var libelle = m[2].replace(/\s+/g, ' ').trim();
      if (/^total/i.test(libelle)) return;
      vus[m[1]] = true;
      // Dernier montant de la ligne (gain ou retenue), tel qu'il est lu
      // Toutes les valeurs numériques de la ligne (base, taux, nombre, gain, retenue…), dans l'ordre du bulletin
      var colonnes = ligne.replace(/^\d{4}\s+/, '').split(/\s{2,}/).map(function (c) { return c.trim(); });
      var valeurs = colonnes.filter(function (c) { return /^-?\d[\d.,]*$/.test(c); });
      if (!valeurs.length) valeurs = (ligne.match(/-?\d[\d.,]*/g) || []).slice(-4);
      var conf = (confs && confs[ligne] != null) ? confs[ligne] : 100;
      out.push({ code: m[1], libelle: libelle, valeurs: valeurs, montant: valeurs.length ? valeurs[valeurs.length - 1] : '', confiance: Math.round(conf) });
    });
    return out;
  }
  function chargerPdfJs() {
    if (root.pdfjsLib) return Promise.resolve(root.pdfjsLib);
    return new Promise(function (ok, ko) {
      var sc = document.createElement('script');
      sc.src = PDFJS_URL;
      sc.onload = function () {
        if (!root.pdfjsLib) return ko(new Error('pdf.js indisponible.'));
        root.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
        ok(root.pdfjsLib);
      };
      sc.onerror = function () { ko(new Error('Impossible de charger le lecteur PDF (connexion ?).')); };
      document.head.appendChild(sc);
    });
  }
  function chargerTesseract() {
    if (root.Tesseract) return Promise.resolve(root.Tesseract);
    return new Promise(function (ok, ko) {
      var sc = document.createElement('script');
      sc.src = TESSERACT_URL;
      sc.onload = function () { root.Tesseract ? ok(root.Tesseract) : ko(new Error('OCR indisponible.')); };
      sc.onerror = function () { ko(new Error('Impossible de charger l\'OCR (connexion ?).')); };
      document.head.appendChild(sc);
    });
  }
  // Bulletin scanné : chaque page est rendue en image puis lue par OCR (français)
  function texteParOcr(doc) {
    return chargerTesseract().then(function (T) {
      var pages = [];
      for (var i = 1; i <= doc.numPages; i++) pages.push(i);
      return pages.reduce(function (p, n) {
        return p.then(function (acc) {
          return doc.getPage(n).then(function (pg) {
            var vp = pg.getViewport({ scale: 2.5 });
            var c = document.createElement('canvas');
            c.width = Math.round(vp.width); c.height = Math.round(vp.height);
            return pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise.then(function () {
              return T.recognize(c, 'fra', { langPath: TESSDATA_FRA });
            }).then(function (res) {
              (res.data.lines || []).forEach(function (l) {
                var t = String(l.text || '').trim();
                if (t) acc.confs[t] = Math.min(acc.confs[t] != null ? acc.confs[t] : 100, l.confidence);
              });
              acc.texte.push(res.data.text);
              return acc;
            });
          });
        });
      }, Promise.resolve({ texte: [], confs: {} })).then(function (acc) { return { texte: acc.texte.join('\n'), confs: acc.confs }; });
    });
  }
  // Texte du PDF, ligne par ligne (les morceaux de même hauteur sont réunis, espaces selon l'écart)
  function texteDuPdf(fichier) {
    return chargerPdfJs().then(function (pdfjs) {
      return fichier.arrayBuffer().then(function (buf) { return pdfjs.getDocument({ data: buf }).promise; });
    }).then(function (doc) {
      return texteNatif(doc).then(function (texte) {
        if (texte.replace(/\s/g, '').length >= 80) return { texte: texte, confs: {} };
        // Pas de texte dans le PDF : bulletin scanné, lecture par OCR
        return texteParOcr(doc);
      });
    });
  }
  function texteNatif(doc) {
    return (function () {
      var pages = [];
      for (var i = 1; i <= doc.numPages; i++) pages.push(i);
      return pages.reduce(function (p, n) {
        return p.then(function (acc) {
          return doc.getPage(n).then(function (pg) {
            return pg.getTextContent().then(function (tc) {
              var lignes = {};
              tc.items.forEach(function (it) {
                if (!it.str) return;
                var y = Math.round(it.transform[5] / 3) * 3;
                (lignes[y] = lignes[y] || []).push({ x: it.transform[4], w: it.width || 0, s: it.str });
              });
              Object.keys(lignes).map(Number).sort(function (a, b) { return b - a; }).forEach(function (y) {
                var items = lignes[y].sort(function (a, b) { return a.x - b.x; });
                var txt = '', fin = null;
                items.forEach(function (it) {
                  if (fin !== null) txt += (it.x - fin > 12 ? '  ' : ' ');
                  txt += it.s; fin = it.x + it.w;
                });
                acc.push(txt);
              });
              return acc;
            });
          });
        });
      }, Promise.resolve([])).then(function (acc) { return acc.join('\n'); });
    })();
  }

  function ouvrir(onChange) {
    var id = 'pm-overlay';
    if (document.getElementById(id)) return;
    if (!document.getElementById('pm-style')) {
      var st = document.createElement('style');
      st.id = 'pm-style';
      st.textContent = '#pm-cadre,#pm-cadre *{font-family:Arial,sans-serif;box-sizing:border-box}' +
        '#pm-cadre{background:#fff!important;color:#1a1a1a!important}' +
        '#pm-cadre input:not([type=checkbox]):not([type=color]),#pm-cadre select,#pm-cadre textarea{background:#fff!important;color:#1a1a1a!important;border:1px solid #9aa5b5;border-radius:6px;padding:5px 7px;font-size:12px}' +
        '#pm-cadre input[type=checkbox]{width:16px;height:16px}' +
        '#pm-cadre button{background:#eef2f8!important;color:#1a1a1a!important;border:1px solid #9aa5b5;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:12px}' +
        '#pm-cadre button.p{background:#1f5fbf!important;color:#fff!important;border-color:#1f5fbf}' +
        '#pm-cadre table{border-collapse:collapse;width:100%}#pm-cadre th{background:#1f5fbf;color:#fff;padding:5px;text-align:left}' +
        '#pm-cadre td{padding:4px;border-bottom:1px solid #e3e8ef}';
      document.head.appendChild(st);
    }

    var liste = charger();
    var courant = liste.filter(function (m) { return m.defaut; })[0].id;
    var ordreEdit = null, cochesEdit = null, ordreDe = null;
    var cat = catalogue();

    var ov = document.createElement('div');
    ov.id = id;
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,14,20,.6);z-index:2147483500;display:flex;align-items:flex-start;justify-content:center;padding:16px;overflow:auto';
    var cadre = document.createElement('div');
    cadre.id = 'pm-cadre';
    cadre.style.cssText = 'max-width:960px;width:100%;border-radius:12px;padding:16px';
    ov.appendChild(cadre);
    document.body.appendChild(ov);

    function trouve() { return liste.filter(function (m) { return m.id === courant; })[0]; }
    function msg(t, err) { var e = cadre.querySelector('[data-msg]'); if (e) { e.textContent = t; e.style.color = err ? '#c0392b' : '#1e8449'; } }

    // Ordre de départ des rubriques d'un modèle : celles du modèle d'abord, puis le reste du catalogue
    function ordreInitial(m) {
      var codes = cat.map(function (r) { return r.code; });
      if (!m.rubriques.length) return codes;
      var choisis = m.rubriques.filter(function (c) { return codes.indexOf(c) >= 0; });
      return choisis.concat(codes.filter(function (c) { return choisis.indexOf(c) < 0; }));
    }
    function reinitialiserEdition() { ordreEdit = null; cochesEdit = null; ordreDe = null; }
    function initialiserEdition(m) {
      if (ordreDe === m.id && ordreEdit) return;
      ordreDe = m.id;
      ordreEdit = ordreInitial(m);
      cochesEdit = {};
      ordreEdit.forEach(function (c) { cochesEdit[c] = !m.rubriques.length || m.rubriques.indexOf(c) >= 0; });
    }

    // Recopie les champs affichés dans le modèle en mémoire
    function lireForm() {
      var m = trouve(); if (!m || !cadre.querySelector('[data-f="nom"]')) return;
      var g = function (f) { return cadre.querySelector('[data-f="' + f + '"]'); };
      m.nom = g('nom').value;
      m.couleur = g('couleur').value;
      m.logoPos = g('logopos').value;
      m.afficherPatronales = g('patr').checked;
      m.afficherPied = g('pied-on').checked;
      m.afficherCout = g('cout-on').checked;
      m.pied = g('pied').value;
      var dispo = g('dispo').value;
      if (DISPOSITIONS[dispo]) m.blocs = DISPOSITIONS[dispo].slice();
      COLONNES.forEach(function (c) { var el = cadre.querySelector('[data-col="' + c[0] + '"]'); if (el) m.colonnes[c[0]] = el.checked; });
      if (ordreDe === m.id && ordreEdit) {
        cadre.querySelectorAll('[data-rub]').forEach(function (el) { cochesEdit[el.getAttribute('data-rub')] = el.checked; });
      }
    }

    function dessiner() {
      var m = trouve();
      var options = liste.map(function (x) {
        return '<option value="' + esc(x.id) + '"' + (x.id === courant ? ' selected' : '') + '>' + esc(x.nom) + (x.defaut ? ' (par défaut)' : '') + '</option>';
      }).join('');
      var entete = '<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px"><b style="flex:1;font-size:16px">📄 Bulletins modèles</b><button type="button" data-act="fermer">✕ Fermer</button></div>';
      var barre = '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px"><label>Modèle <select data-act="choisir">' + options + '</select></label>' +
        '<button type="button" data-act="nouveau">➕ Nouveau</button><button type="button" data-act="dupliquer">⧉ Dupliquer</button>' +
        '<button type="button" data-act="defaut">★ Définir par défaut</button><button type="button" data-act="ocean">🏨 Ajouter le gabarit Hôtel Océan</button><button type="button" data-act="supprimer">✕ Supprimer</button>' +
        '<label style="margin-left:auto"><button type="button" data-act="importer-pdf">📥 Créer depuis un bulletin PDF</button><input type="file" accept="application/pdf,.pdf" data-pdf-file style="display:none"></label></div>';
      if (!m) { cadre.innerHTML = entete + barre; return; }

      initialiserEdition(m);
      var dispo = Object.keys(DISPOSITIONS).filter(function (k) { return DISPOSITIONS[k].join(',') === m.blocs.join(','); })[0] || 'standard';
      var logoAff = m.logo ? '<img src="' + m.logo + '" alt="" style="max-height:60px;max-width:180px;border:1px solid #ccc;padding:2px;background:#fff">' : '<span style="color:#777">Aucun logo</span>';

      var lignesRub = ordreEdit.map(function (code, i) {
        var r = cat.filter(function (x) { return x.code === code; })[0] || { libelle: '' };
        return '<tr><td style="width:40px;text-align:center"><input type="checkbox" data-rub="' + esc(code) + '"' + (cochesEdit[code] ? ' checked' : '') + '></td>' +
          '<td>' + esc(code) + '</td><td>' + esc(r.libelle) + '</td>' +
          '<td style="white-space:nowrap"><button type="button" data-act="haut" data-i="' + i + '">▲</button> <button type="button" data-act="bas" data-i="' + i + '">▼</button></td></tr>';
      }).join('');

      cadre.innerHTML = entete + barre +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
          '<label>Nom du modèle<input data-f="nom" value="' + esc(m.nom) + '" style="width:100%"></label>' +
          '<label>Couleur d\'en-tête<input data-f="couleur" type="color" value="' + (m.couleur || '#1f5fbf') + '"></label>' +
          '<div style="grid-column:1/3;border:1px solid #cdd5e0;border-radius:8px;padding:10px"><b>Logo</b><div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:6px">' + logoAff +
            '<label>Importer (PNG, JPG, WebP, GIF, BMP, SVG : redimensionné automatiquement)<input type="file" accept="' + FORMATS_LOGO + '" data-logo-file></label>' +
            '<label>Position<select data-f="logopos">' + Object.keys(POS_LOGO).map(function (k) { return '<option value="' + k + '"' + (m.logoPos === k ? ' selected' : '') + '>' + POS_LOGO[k] + '</option>'; }).join('') + '</select></label>' +
            (m.logo ? '<button type="button" data-act="logo-retirer">Retirer le logo</button>' : '') +
          '</div></div>' +
          '<label style="display:flex;gap:6px;align-items:center"><input data-f="patr" type="checkbox"' + (m.afficherPatronales ? ' checked' : '') + '> Afficher les charges patronales</label>' +
          '<label style="display:flex;gap:6px;align-items:center"><input data-f="pied-on" type="checkbox"' + (m.afficherPied ? ' checked' : '') + '> Afficher la mention légale</label>' +
          '<label style="display:flex;gap:6px;align-items:center"><input data-f="cout-on" type="checkbox"' + (m.afficherCout === true ? ' checked' : '') + '> Afficher le coût total employeur <small>(copie interne seulement)</small></label>' +
          '<label>Disposition des blocs<select data-f="dispo">' + Object.keys(LIBELLE_DISPO).map(function (k) { return '<option value="' + k + '"' + (dispo === k ? ' selected' : '') + '>' + LIBELLE_DISPO[k] + '</option>'; }).join('') + '</select></label>' +
          '<label>Texte complémentaire du pied<textarea data-f="pied" rows="2" style="width:100%">' + esc(m.pied) + '</textarea></label>' +
          '<div style="grid-column:1/3;display:flex;gap:16px;flex-wrap:wrap;align-items:center"><b>Colonnes du tableau :</b>' +
            COLONNES.map(function (c) { return '<label style="display:flex;gap:4px;align-items:center"><input type="checkbox" data-col="' + c[0] + '"' + (m.colonnes[c[0]] !== false ? ' checked' : '') + '> ' + c[1] + '</label>'; }).join('') + '</div>' +
        '</div>' +
        '<h4 style="margin:14px 0 6px">Rubriques affichées sur le bulletin</h4>' +
        '<p style="color:#555;margin:0 0 6px">Cochez les rubriques à imprimer et ordonnez-les avec ▲ ▼. Les rubriques décochées restent dans le calcul, mais n\'apparaissent pas sur le bulletin.</p>' +
        (cat.length ? '<div style="max-height:260px;overflow:auto;border:1px solid #cdd5e0;border-radius:8px"><table><thead><tr><th></th><th>Code</th><th>Libellé</th><th></th></tr></thead><tbody>' + lignesRub + '</tbody></table></div>' +
          '<div style="margin-top:6px"><button type="button" data-act="tout">Tout cocher</button></div>'
          : '<p style="color:#a93226">Aucune rubrique dans le catalogue : créez-les d\'abord dans « ➕ Gains &amp; retenues » → « Catalogue des rubriques de paie ».</p>') +
        '<div style="display:flex;gap:8px;align-items:center;margin-top:14px"><button type="button" class="p" data-act="enregistrer">💾 Enregistrer le modèle</button><span data-msg style="margin-left:auto"></span></div>';
    }

    cadre.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var a = b.getAttribute('data-act');
      if (a === 'fermer') { ov.remove(); return; }
      lireForm();
      var m = trouve();
      if (a === 'ocean') {
        if (!liste.some(function (x) { return x.id === OCEAN.id; })) liste.push(copie(OCEAN));
        courant = OCEAN.id; reinitialiserEdition(); sauver(liste);
      } else if (a === 'nouveau') {
        var n = copie({ nom: 'Nouveau modèle', afficherPatronales: true, afficherPied: true });
        liste.push(n); courant = n.id; reinitialiserEdition();
      } else if (a === 'dupliquer' && m) {
        var d = copie(Object.assign({}, m, { id: '', nom: m.nom + ' (copie)', defaut: false }));
        liste.push(d); courant = d.id; reinitialiserEdition();
      } else if (a === 'defaut' && m) {
        liste.forEach(function (x) { x.defaut = (x.id === courant); });
      } else if (a === 'supprimer' && m) {
        if (liste.length <= 1) { msg('Il faut garder au moins un modèle.', true); return; }
        if (!confirm('Supprimer le modèle « ' + m.nom + ' » ?')) return;
        var eraDef = m.defaut;
        liste = liste.filter(function (x) { return x.id !== courant; });
        if (eraDef) liste[0].defaut = true;
        courant = liste.filter(function (x) { return x.defaut; })[0].id; reinitialiserEdition();
      } else if (a === 'importer-pdf') {
        var sel = cadre.querySelector('[data-pdf-file]'); if (sel) sel.click();
        return;
      } else if (a === 'logo-retirer' && m) {
        m.logo = '';
      } else if (a === 'tout' && m) {
        Object.keys(cochesEdit).forEach(function (c) { cochesEdit[c] = true; });
      } else if ((a === 'haut' || a === 'bas') && m) {
        var i = +b.getAttribute('data-i'), j = a === 'haut' ? i - 1 : i + 1;
        if (j >= 0 && j < ordreEdit.length) { var t = ordreEdit[i]; ordreEdit[i] = ordreEdit[j]; ordreEdit[j] = t; }
      } else if (a === 'enregistrer' && m) {
        if (!m.nom.trim()) { dessiner(); msg('Le nom du modèle est obligatoire.', true); return; }
        var coches = ordreEdit.filter(function (c) { return cochesEdit[c]; });
        if (cat.length && !coches.length) { dessiner(); msg('Cochez au moins une rubrique.', true); return; }
        m.rubriques = cat.length ? coches : [];
        liste = normaliser(liste);
        sauver(liste);
        if (typeof onChange === 'function') onChange(liste.map(copie));
        reinitialiserEdition();
        dessiner(); msg('Modèle enregistré.');
        return;
      }
      dessiner();
    });

    cadre.addEventListener('change', function (e) {
      var el = e.target;
      if (el.matches('[data-act="choisir"]')) { lireForm(); courant = el.value; reinitialiserEdition(); dessiner(); return; }
      if (el.matches('[data-logo-file]')) {
        var f = el.files && el.files[0]; if (!f) return;
        preparerLogo(f).then(function (data) {
          lireForm();
          var mm = trouve();
          mm.logo = data;
          dessiner(); msg('Logo importé. Enregistrez pour l\'appliquer aux bulletins.');
        }).catch(function (e) { msg(e.message || String(e), true); });
        el.value = '';
        return;
      }
      if (el.matches('[data-pdf-file]')) {
        var pdf = el.files && el.files[0]; if (!pdf) return;
        if (!/\.pdf$/i.test(pdf.name) && pdf.type !== 'application/pdf') { msg('Choisissez un bulletin au format PDF.', true); el.value = ''; return; }
        lireForm();
        msg('Lecture du bulletin…');
        msg('Lecture du bulletin…');
        texteDuPdf(pdf).then(function (res) {
          var trouves = rubriquesDuTexte(res.texte, res.confs);
          if (!trouves.length) { msg('Aucune rubrique lue. Vérifiez que le PDF est un bulletin de paie.', true); return; }
          ouvrirRevue(trouves, pdf.name);
        }).catch(function (e) { msg('Lecture impossible : ' + (e.message || e), true); });
        el.value = '';
      }
    });

    // Vérification des rubriques lues avant création du modèle (OCR : codes et montants à contrôler)
    function ouvrirRevue(trouves, nomFichier) {
      var codesCat = cat.map(function (r) { return r.code; });
      var ov2 = document.createElement('div');
      ov2.id = 'pm-revue';
      ov2.style.cssText = 'position:fixed;inset:0;background:rgba(10,14,20,.6);z-index:2147483600;display:flex;align-items:flex-start;justify-content:center;padding:16px;overflow:auto';
      var box = document.createElement('div');
      box.style.cssText = 'background:#fff;color:#1a1a1a;max-width:900px;width:100%;border-radius:12px;padding:16px;font-family:Arial,sans-serif;font-size:12px';
      var lignes = trouves.map(function (r, i) {
        var doute = r.confiance < 80 || !/^\d{4}$/.test(r.code) || !r.montant;
        var choix = (r.valeurs && r.valeurs.length) ? r.valeurs : (r.montant ? [r.montant] : []);
        var champMont = choix.length
          ? '<select data-rv-mont="' + i + '" style="width:130px;text-align:right">' + choix.map(function (v) { return '<option value="' + esc(v) + '"' + (v === r.montant ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join('') + '</select>'
          : '<input data-rv-mont="' + i + '" value="" style="width:110px;text-align:right">';
        var dansCat = codesCat.indexOf(r.code) >= 0;
        return '<tr' + (doute ? ' style="background:#fff4e5"' : '') + '>' +
          '<td style="text-align:center"><input type="checkbox" data-rv-ok="' + i + '" checked></td>' +
          '<td><input data-rv-code="' + i + '" value="' + esc(r.code) + '" style="width:70px"></td>' +
          '<td><input data-rv-lib="' + i + '" value="' + esc(r.libelle) + '" style="width:100%"></td>' +
          '<td>' + champMont + '</td>' +
          '<td style="white-space:nowrap">' + (r.confiance < 100 ? r.confiance + ' %' : '') + '</td>' +
          '<td>' + (doute ? '<b style="color:#b9770e">à vérifier</b>' : '') + (dansCat ? '' : ' <span style="color:#a93226">absent du catalogue</span>') + '</td></tr>';
      }).join('');
      box.innerHTML =
        '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px"><b style="flex:1;font-size:15px">Vérifier les rubriques lues : ' + esc(nomFichier) + '</b><button type="button" data-rv="annuler">✕ Annuler</button></div>' +
        '<p style="color:#555;margin:0 0 8px">Corrigez les codes si besoin. Pour chaque ligne, choisissez la colonne du montant à retenir (ex. gain ou retenue) : les valeurs proviennent de la ligne du bulletin, de gauche à droite. Les lignes en orange sont lues avec doute (OCR). Décochez une ligne pour l\'exclure.</p>' +
        '<div style="max-height:60vh;overflow:auto;border:1px solid #cdd5e0;border-radius:8px"><table style="width:100%;border-collapse:collapse"><thead><tr style="background:#1f5fbf;color:#fff"><th></th><th>Code</th><th>Libellé</th><th>Montant (choisir la colonne)</th><th>Confiance</th><th></th></tr></thead><tbody>' + lignes + '</tbody></table></div>' +
        '<div style="display:flex;gap:8px;align-items:center;margin-top:12px"><button type="button" data-rv="creer" style="background:#1f5fbf;color:#fff;border:0;border-radius:6px;padding:7px 12px;cursor:pointer">Créer le modèle</button><span data-rv-msg style="margin-left:auto"></span></div>';
      ov2.appendChild(box);
      document.body.appendChild(ov2);
      function msgRv(t, err) { var e = box.querySelector('[data-rv-msg]'); if (e) { e.textContent = t; e.style.color = err ? '#c0392b' : '#1e8449'; } }
      box.addEventListener('click', function (e) {
        var b = e.target.closest('[data-rv]'); if (!b) return;
        if (b.getAttribute('data-rv') === 'annuler') { ov2.remove(); return; }
        var retenus = [], erreur = '';
        trouves.forEach(function (r, i) {
          if (!box.querySelector('[data-rv-ok="' + i + '"]').checked) return;
          var code = box.querySelector('[data-rv-code="' + i + '"]').value.trim();
          if (!/^\d{4}$/.test(code)) erreur = erreur || ('Code invalide à la ligne ' + (i + 1) + ' : 4 chiffres attendus.');
          var mEl = box.querySelector('[data-rv-mont="' + i + '"]');
          retenus.push({ code: code, libelle: box.querySelector('[data-rv-lib="' + i + '"]').value.trim(), montant: mEl ? String(mEl.value).trim() : '' });
        });
        if (erreur) { msgRv(erreur, true); return; }
        if (!retenus.length) { msgRv('Gardez au moins une rubrique.', true); return; }
        var codes = []; retenus.forEach(function (r) { if (codes.indexOf(r.code) < 0) codes.push(r.code); });
        var absents = retenus.filter(function (r) { return codesCat.indexOf(r.code) < 0; }).map(function (r) { return r.code + ' ' + r.libelle; });
        var nouveau = copie({ nom: 'Bulletin importé – ' + nomFichier.replace(/\.pdf$/i, ''), afficherPatronales: true, afficherPied: true, rubriques: codes });
        lireForm();
        liste.push(nouveau); courant = nouveau.id; reinitialiserEdition();
        ov2.remove();
        dessiner();
        msg(codes.length + ' rubrique(s) importée(s). Vérifiez, puis enregistrez.' +
          (absents.length ? ' Absentes du catalogue (à créer dans « Catalogue des rubriques ») : ' + absents.join(' ; ') + '.' : ''), absents.length > 0);
      });
    }

    dessiner();
    synchroniser().then(function (n) {
      if (!n || !document.getElementById(id)) return;
      liste = n;
      if (!trouve()) courant = liste.filter(function (x) { return x.defaut; })[0].id;
      reinitialiserEdition();
      dessiner();
    });
  }

  // Modèle par défaut de l'entreprise (utilisé pour tous ses bulletins)
  function definirDefaut(id) {
    var l = charger();
    l.forEach(function (m) { m.defaut = (m.id === String(id)); });
    sauver(l);
    return l;
  }
  root.PaieModeles = { definirDefaut: definirDefaut, ouvrir: ouvrir, charger: charger, actif: actif, parId: parId, options: options, synchroniser: synchroniser, BLOCS: BLOCS, DISPOSITIONS: DISPOSITIONS };
})(typeof window !== 'undefined' ? window : globalThis);
