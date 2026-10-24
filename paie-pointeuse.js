/* paie-pointeuse.js : pointages des salariés (pointeuse) pour le calcul des heures du mois.
 * PaiePointeuse.ouvrir({ mois, fiches, onReporter(mois, heuresParMatricule) })
 *  - Fichiers lus : CSV (.csv, .txt) et Excel (.xlsx). Le PDF n'est pas lu (mise en page, pas de tableau).
 *  - Colonnes : détectées automatiquement, puis corrigeables dans l'aperçu. Le format choisi est mémorisé.
 *  - Lecture automatique (sans fichier à charger) : préparée, désactivée tant que le format n'est pas validé
 *    sur un export réel (config.lecture_auto = true à activer après vérification).
 * Configuration : localStorage 'prh_pointeuse_config' (aucun secret enregistré).
 */
(function (root) {
  'use strict';

  var CFG = 'prh_pointeuse_config';
  var EXCELJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
  var SOURCES = [
    { id: 'fichier', nom: 'Import d\'un fichier (CSV ou Excel) — actif', actif: true },
    { id: 'push', nom: 'Envoi automatique par la pointeuse — à configurer', actif: false },
    { id: 'api', nom: 'API du fabricant ou logiciel de pointage — à configurer', actif: false }
  ];
  var CHAMPS_RESERVES = [
    ['marque', 'Marque de la pointeuse'],
    ['modele', 'Modèle'],
    ['adresse', 'Adresse d\'envoi ou de l\'API'],
    ['fuseau', 'Fuseau horaire des pointages'],
    ['notes', 'Notes sur le format exporté']
  ];
  // Rôles de colonnes attendus
  var ROLES = [
    { id: 'mat', lib: 'Matricule' },
    { id: 'date', lib: 'Date' },
    { id: 'heure', lib: 'Heure' },
    { id: 'dt', lib: 'Date et heure (une colonne)' },
    { id: 'sens', lib: 'Sens (entrée / sortie)' }
  ];
  var MOTIFS = {
    mat: [/^(matricule|mat|identifiant|id|badge|n°|numero)/],
    dt: [/(date.?heure|horodatage|datetime|timestamp)/],
    date: [/^date/],
    heure: [/^(heure|hh|time|hora)/],
    sens: [/(sens|type|etat|direction|pointage)/]
  };

  function lireCfg() { try { return JSON.parse(root.localStorage.getItem(CFG)) || {}; } catch (e) { return {}; } }
  function ecrireCfg(o) { try { root.localStorage.setItem(CFG, JSON.stringify(o)); } catch (e) { } }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function sansAccents(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
  function fmtH(n) { return (Math.round(n * 100) / 100).toFixed(2).replace('.', ','); }
  function matNorm(m) { var s = String(m == null ? '' : m).trim(); return /^\d+$/.test(s) ? String(parseInt(s, 10)) : s.toLowerCase(); }

  // ----- Lecture des fichiers : tout est ramené à un tableau de lignes (chaînes) -----
  function decouper(ligne, sep) {
    var out = [], cur = '', q = false;
    for (var i = 0; i < ligne.length; i++) {
      var c = ligne[i];
      if (c === '"') { q = !q; continue; }
      if (c === sep && !q) { out.push(cur.trim()); cur = ''; continue; }
      cur += c;
    }
    out.push(cur.trim());
    return out;
  }
  function tableauCsv(texte) {
    var lignes = String(texte || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(function (l) { return l.trim() !== ''; });
    if (!lignes.length) return [];
    var sep = [';', ',', '\t'].map(function (s) { return { s: s, n: lignes[0].split(s).length }; }).sort(function (a, b) { return b.n - a.n; })[0].s;
    return lignes.map(function (l) { return decouper(l, sep); });
  }
  function ajouterZero(n) { return String(n).padStart(2, '0'); }
  // Cellule Excel -> texte exploitable : date, heure ou nombre (fraction de jour pour une heure, numéro de série pour une date)
  function texteCellule(v) {
    if (v == null) return '';
    if (v instanceof Date) return ajouterZero(v.getDate()) + '/' + ajouterZero(v.getMonth() + 1) + '/' + v.getFullYear() + ' ' + ajouterZero(v.getHours()) + ':' + ajouterZero(v.getMinutes()) + ':' + ajouterZero(v.getSeconds());
    if (typeof v === 'object') {
      if (v.result !== undefined) return texteCellule(v.result);
      if (v.text !== undefined) return String(v.text);
      if (Array.isArray(v.richText)) return v.richText.map(function (r) { return r.text; }).join('');
      return '';
    }
    if (typeof v === 'number') {
      if (v >= 0 && v < 1) { var s = Math.round(v * 86400); return ajouterZero(Math.floor(s / 3600)) + ':' + ajouterZero(Math.floor(s / 60) % 60) + ':' + ajouterZero(s % 60); }
      if (v > 20000 && v < 80000) { var d = new Date(Math.round((v - 25569) * 86400000)); return ajouterZero(d.getUTCDate()) + '/' + ajouterZero(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear() + ' 00:00:00'; }
      return String(v);
    }
    return String(v);
  }
  function chargerExcelJS() {
    if (root.ExcelJS) return Promise.resolve(root.ExcelJS);
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = EXCELJS_URL;
      s.onload = function () { root.ExcelJS ? resolve(root.ExcelJS) : reject(new Error('ExcelJS indisponible')); };
      s.onerror = function () { reject(new Error('Bibliothèque Excel impossible à charger (connexion ?)')); };
      document.head.appendChild(s);
    });
  }
  function tableauExcel(buffer) {
    return chargerExcelJS().then(function (X) {
      var wb = new X.Workbook();
      return wb.xlsx.load(buffer).then(function () {
        var ws = wb.worksheets[0];
        if (!ws) return [];
        var lignes = [];
        ws.eachRow({ includeEmpty: false }, function (row) {
          var l = [];
          for (var c = 1; c <= row.cellCount; c++) l.push(texteCellule(row.getCell(c).value));
          lignes.push(l);
        });
        return lignes;
      });
    });
  }

  // ----- Détection des colonnes et lecture des pointages -----
  function detecter(entete) {
    var norm = entete.map(sansAccents), map = {};
    Object.keys(MOTIFS).forEach(function (role) {
      map[role] = -1;
      for (var i = 0; i < norm.length && map[role] < 0; i++) {
        if (MOTIFS[role].some(function (re) { return re.test(norm[i]); })) map[role] = i;
      }
    });
    return map;
  }
  function lireDate(s) {
    s = String(s || '').trim();
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s) || /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/.exec(s);
    if (!m) return null;
    return /^\d{4}/.test(s) ? [+m[1], +m[2], +m[3]] : [+m[3], +m[2], +m[1]];
  }
  function lireHeure(s) {
    var m = /(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(String(s || ''));
    return m ? [+m[1], +m[2], +(m[3] || 0)] : null;
  }
  function sensDe(v) {
    var s = sansAccents(v);
    if (!s) return null;
    if (/^(e|in|entree|arrivee|1)$/.test(s) || /entr|arriv/.test(s)) return 'E';
    if (/^(s|out|sortie|depart|0)$/.test(s) || /sort|depart/.test(s)) return 'S';
    return null;
  }
  // lignes : tableau de lignes (la 1re = entête) ; map : indices de colonnes par rôle (-1 = absent)
  function lirePointagesTableau(lignes, map) {
    var res = { pointages: [], anomalies: [] };
    if (!lignes || lignes.length < 2) { res.anomalies.push('Fichier vide ou sans données.'); return res; }
    map = map || detecter(lignes[0]);
    if (map.mat < 0) { res.anomalies.push('Colonne matricule non renseignée.'); return res; }
    if (map.dt < 0 && (map.date < 0 || map.heure < 0)) { res.anomalies.push('Colonnes date et heure non renseignées.'); return res; }
    for (var i = 1; i < lignes.length; i++) {
      var c = lignes[i], d, h;
      if (map.dt >= 0) {
        var t = String(c[map.dt] || '').trim();
        d = lireDate(t.split(/\s+/)[0]); h = lireHeure(t);
      } else {
        d = lireDate(c[map.date]); h = lireHeure(c[map.heure]);
      }
      var mat = String(c[map.mat] || '').trim();
      if (!d || !h || !mat) { res.anomalies.push('Ligne ' + (i + 1) + ' ignorée (date, heure ou matricule illisible).'); continue; }
      res.pointages.push({ mat: matNorm(mat), t: new Date(d[0], d[1] - 1, d[2], h[0], h[1], h[2]), sens: map.sens >= 0 ? sensDe(c[map.sens]) : null });
    }
    return res;
  }
  function lirePointages(texte) { return lirePointagesTableau(tableauCsv(texte)); }

  // ----- Calcul des heures par salarié pour un mois -----
  function calculer(pointages, mois) {
    var parMat = {};
    pointages.forEach(function (p) { (parMat[p.mat] = parMat[p.mat] || []).push(p); });
    var out = {};
    Object.keys(parMat).forEach(function (mat) {
      var liste = parMat[mat].slice().sort(function (a, b) { return a.t - b.t; });
      var heures = 0, jours = {}, anomalies = 0, ouvert = null, alterne = 0, dansMois = 0;
      liste.forEach(function (p) {
        var ym = p.t.getFullYear() + '-' + ajouterZero(p.t.getMonth() + 1);
        if (ym !== mois) return;
        dansMois++;
        var sens = p.sens || (alterne++ % 2 === 0 ? 'E' : 'S');
        if (sens === 'E') { if (ouvert) anomalies++; ouvert = p.t; }
        else if (ouvert) { heures += (p.t - ouvert) / 3600000; jours[ouvert.toDateString()] = true; ouvert = null; }
        else { anomalies++; }
      });
      if (ouvert) anomalies++;
      if (!dansMois) return;
      out[mat] = { heures: Math.round(heures * 100) / 100, jours: Object.keys(jours).length, anomalies: anomalies };
    });
    return out;
  }
  function moisDes(pointages) {
    var c = {};
    pointages.forEach(function (p) { var ym = p.t.getFullYear() + '-' + ajouterZero(p.t.getMonth() + 1); c[ym] = (c[ym] || 0) + 1; });
    return Object.keys(c).sort();
  }

  // ----- Fenêtre -----
  function ouvrir(opts) {
    opts = opts || {};
    var cfg = lireCfg();
    var fiches = opts.fiches || [];
    var index = {};
    fiches.forEach(function (f) { index[matNorm(f.mat)] = f; });
    var etat = { lignes: [], map: null, pointages: [], anomalies: [], resultat: null, mois: opts.mois || '', source: cfg.source || 'fichier', nomFichier: '' };

    var fond = document.createElement('div');
    fond.style.cssText = 'position:fixed;inset:0;background:rgba(10,14,20,.6);z-index:2147483450;display:flex;align-items:flex-start;justify-content:center;padding:16px;overflow:auto';
    var cadre = document.createElement('div');
    cadre.style.cssText = 'background:#fff;color:#1a1a1a;border-radius:10px;padding:16px;width:min(920px,100%);font:14px system-ui,sans-serif';
    fond.appendChild(cadre);
    document.body.appendChild(fond);

    function fermer() { fond.remove(); }
    function msg(t, err) { var m = cadre.querySelector('[data-msg]'); if (m) { m.textContent = t; m.style.color = err ? '#c0392b' : '#1e8449'; } }

    function sourcesHtml() {
      return SOURCES.map(function (s) {
        return '<label style="display:block;margin:3px 0;color:' + (s.actif ? '#1a1a1a' : '#888') + '"><input type="radio" name="src" value="' + s.id + '"' +
          (s.actif ? '' : ' disabled') + (etat.source === s.id ? ' checked' : '') + '> ' + esc(s.nom) + '</label>';
      }).join('');
    }
    function champsHtml() {
      return CHAMPS_RESERVES.map(function (c) {
        return '<label style="display:block;margin:4px 0;font-size:13px">' + esc(c[1]) + '<input data-cfg="' + c[0] + '" value="' + esc(cfg[c[0]] || '') + '" placeholder="à renseigner" style="width:100%;padding:4px;border:1px solid #9aa5b5;border-radius:4px"></label>';
      }).join('');
    }
    // Colonnes lues : menus pour corriger la détection
    function colonnesHtml() {
      if (!etat.lignes.length) return '';
      var entete = etat.lignes[0];
      var opt = function (role, sel) {
        return '<option value="-1">— aucune —</option>' + entete.map(function (h, i) {
          return '<option value="' + i + '"' + (sel === i ? ' selected' : '') + '>' + esc(h || ('colonne ' + (i + 1))) + '</option>';
        }).join('');
      };
      return '<div style="margin:8px 0;padding:8px;background:#f5f8fc;border-radius:6px"><b style="font-size:13px">Colonnes lues (corrigez si besoin) :</b>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;margin-top:6px">' +
        ROLES.map(function (r) {
          return '<label style="font-size:13px">' + esc(r.lib) + '<select data-map="' + r.id + '" style="width:100%;padding:3px">' + opt(r.id, etat.map[r.id]) + '</select></label>';
        }).join('') + '</div>' +
        '<div style="font-size:12px;color:#555;margin-top:6px">Format mémorisé pour les prochains imports : ' + (cfg.format_valide ? 'oui' : 'non, à valider sur un export réel') + '</div></div>';
    }

    function rendre() {
      var res = etat.resultat, lignes = '';
      if (res) {
        var mats = Object.keys(res.par).sort(function (a, b) { return String(a).localeCompare(String(b), 'fr', { numeric: true }); });
        lignes = mats.map(function (m) {
          var f = index[m], r = res.par[m];
          return '<tr><td style="padding:4px;border-bottom:1px solid #eee">' + esc(f ? f.mat : m) + '</td><td style="padding:4px;border-bottom:1px solid #eee">' +
            (f ? esc(f.nom) : '<span style="color:#b03a2e">Matricule absent de la base</span>') + '</td><td style="text-align:right;padding:4px;border-bottom:1px solid #eee">' + r.jours +
            '</td><td style="text-align:right;padding:4px;border-bottom:1px solid #eee"><b>' + fmtH(r.heures) + '</b></td><td style="text-align:right;padding:4px;border-bottom:1px solid #eee;color:' +
            (r.anomalies ? '#b03a2e' : '#555') + '">' + r.anomalies + '</td></tr>';
        }).join('');
      }
      var anom = etat.anomalies.slice(0, 20).map(function (a) { return '<div style="color:#8a4b00;font-size:12px">' + esc(a) + '</div>'; }).join('');
      cadre.innerHTML =
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><h3 style="margin:0;flex:1">⏱ Pointeuse : heures des salariés</h3><button type="button" data-x="fermer" style="padding:5px 10px">✕ Fermer</button></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:12px">' +
        '<div><b>Source des pointages</b>' + sourcesHtml() +
        '<details style="margin-top:8px"><summary style="cursor:pointer">Paramètres de la pointeuse (à compléter plus tard)</summary>' + champsHtml() + '</details>' +
        '<label style="display:block;margin-top:10px;font-size:13px;color:#888"><input type="checkbox" disabled' + (cfg.lecture_auto ? ' checked' : '') + '> Lecture automatique sans fichier — désactivée tant que le format n\'est pas validé</label></div>' +
        '<div><b>Import du fichier</b>' +
        '<p style="font-size:12px;color:#555;margin:4px 0">Fichier de la pointeuse : Excel (.xlsx) ou CSV. Colonnes : matricule, date et heure (ou date et heure dans une colonne), et si possible le sens (entrée / sortie). Les PDF ne sont pas lus.</p>' +
        '<input type="file" accept=".xlsx,.csv,.txt" data-fichier style="margin:6px 0"><div style="margin:6px 0">Mois à calculer : <input type="month" data-mois value="' + esc(etat.mois) + '" style="padding:3px"></div>' +
        '<div style="font-size:12px;color:#555">' + (etat.nomFichier ? 'Fichier : ' + esc(etat.nomFichier) + ' — ' + etat.pointages.length + ' pointage(s)' : 'Aucun fichier lu.') + '</div>' +
        colonnesHtml() + '</div></div>' +
        (res ? '<div style="margin-top:12px;max-height:320px;overflow:auto;border:1px solid #d6dbe3;border-radius:6px"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#eef2f8"><th style="text-align:left;padding:6px">Matricule</th><th style="text-align:left;padding:6px">Nom</th><th style="text-align:right;padding:6px">Jours</th><th style="text-align:right;padding:6px">Heures</th><th style="text-align:right;padding:6px">Anomalies</th></tr></thead><tbody>' + lignes + '</tbody></table></div>' : '') +
        anom +
        '<div style="display:flex;gap:8px;justify-content:flex-end;align-items:center;margin-top:12px;flex-wrap:wrap"><span data-msg style="flex:1;font-size:13px"></span>' +
        '<button type="button" data-x="valider" style="padding:6px 10px;border:1px solid #9aa5b5;border-radius:6px;background:#eef2f8"' + (etat.lignes.length ? '' : ' disabled') + '>Format correct : mémoriser</button>' +
        '<button type="button" data-x="reporter" style="padding:7px 12px;border:0;border-radius:6px;background:#1f5fbf;color:#fff"' + (res ? '' : ' disabled') + '>Reporter les heures dans la grille</button></div>';
      cadre.querySelector('[data-fichier]').onchange = function (e) { lireFichier(e.target.files && e.target.files[0]); };
      cadre.querySelector('[data-mois]').onchange = function (e) { etat.mois = e.target.value; calcul(); };
      cadre.querySelectorAll('[data-map]').forEach(function (s) {
        s.onchange = function () { etat.map[s.dataset.map] = +s.value; relire(); };
      });
    }

    function relire() {
      var r = lirePointagesTableau(etat.lignes, etat.map);
      etat.pointages = r.pointages; etat.anomalies = r.anomalies;
      calcul();
    }
    function calcul() {
      if (!etat.pointages.length) { etat.resultat = null; rendre(); return; }
      if (!etat.mois) { msg('Choisissez le mois à calculer.', true); return; }
      var autres = moisDes(etat.pointages).filter(function (m) { return m !== etat.mois; });
      if (autres.length) etat.anomalies.push('Pointages d\'autres mois ignorés : ' + autres.join(', ') + ' (mois choisi : ' + etat.mois + ').');
      etat.resultat = { par: calculer(etat.pointages, etat.mois) };
      rendre();
      if (!Object.keys(etat.resultat.par).length) msg('Aucun pointage pour ' + etat.mois + '.', true);
    }

    function lireFichier(f) {
      if (!f) return;
      var nom = (f.name || '').toLowerCase();
      var fini = function (lignes) {
        etat.lignes = lignes; etat.nomFichier = f.name;
        etat.map = (cfg.format && cfg.format.map) ? cfg.format.map : detecter(lignes[0] || []);
        if (!etat.mois) { var r0 = lirePointagesTableau(lignes, etat.map); etat.mois = moisDes(r0.pointages).slice(-1)[0] || ''; }
        relire();
        msg(etat.pointages.length + ' pointage(s) lu(s).');
      };
      var echec = function (e) { msg('Lecture impossible : ' + ((e && e.message) || 'fichier illisible'), true); };
      if (/\.xlsx$/.test(nom)) {
        var fr = new FileReader();
        fr.onload = function () { tableauExcel(fr.result).then(fini).catch(echec); };
        fr.onerror = echec;
        fr.readAsArrayBuffer(f);
      } else if (/\.pdf$/.test(nom)) {
        msg('Les PDF ne sont pas lus : exportez en Excel ou CSV depuis la pointeuse.', true);
      } else {
        var fc = new FileReader();
        fc.onload = function () { fini(tableauCsv(fc.result)); };
        fc.onerror = echec;
        fc.readAsText(f, 'UTF-8');
      }
    }

    cadre.addEventListener('click', function (e) {
      var x = e.target.dataset && e.target.dataset.x;
      if (x === 'fermer') fermer();
      if (x === 'valider' && etat.lignes.length) {
        cfg.format = { map: etat.map, exemple: (etat.lignes[0] || []).join(' ; ') };
        cfg.format_valide = true; ecrireCfg(cfg); msg('Format mémorisé pour les prochains imports.'); rendre();
      }
      if (x === 'reporter' && etat.resultat) {
        var heures = {};
        Object.keys(etat.resultat.par).forEach(function (m) { heures[m] = etat.resultat.par[m].heures; });
        if (typeof opts.onReporter === 'function') opts.onReporter(etat.mois, heures);
      }
    });
    cadre.addEventListener('change', function (e) {
      if (e.target.name === 'src') { etat.source = e.target.value; cfg.source = etat.source; ecrireCfg(cfg); }
      if (e.target.dataset && e.target.dataset.cfg) { cfg[e.target.dataset.cfg] = e.target.value; ecrireCfg(cfg); msg('Paramètre enregistré sur cet appareil.'); }
    });
    rendre();
    return { fermer: fermer };
  }

  root.PaiePointeuse = { ouvrir: ouvrir, lirePointages: lirePointages, lirePointagesTableau: lirePointagesTableau, tableauCsv: tableauCsv, detecter: detecter, calculer: calculer, ROLES: ROLES };
})(typeof window !== 'undefined' ? window : globalThis);
