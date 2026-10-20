/* paie-pointage-simulation.js — Pointage des heures sup. et simulation de salaire (présentation Sage).
 * PaiePointage.ouvrir({employes, periode, courant, onApply}) : saisie des heures sup. par salarié et par période.
 *   onApply(heures) reçoit {1110: n, 1130: n, 1140: n, 1150: n, 1160: n} (nombre d'heures) pour le bulletin.
 * PaieSimulation.ouvrir({lignes, saisies, nom})              : compare le bulletin actuel à un salaire simulé (% ou montant).
 * Pointage stocké : localStorage 'terh_paie_pointage' + table parametres (paie_pointage_json) via window.TERH_paiePoint.
 */
(function (root) {
  'use strict';

  var CLE = 'terh_paie_pointage';
  var COULEUR = '#1f5fbf';
  var CATS = [
    ['1110', 'Heures sup. 1re tranche (120 %)'], ['1130', 'Heures sup. 2e tranche (130 %)'], ['1140', 'Heures sup. 3e tranche (140 %)'],
    ['1150', 'Heures de nuit (150 %)'], ['1160', 'Jour férié (200 %)']
  ];

  var STYLE =
    '.pp-card{background:#fff;color:#1a1a1a;max-width:560px;width:100%;border-radius:6px;padding:12px 14px;box-sizing:border-box;font:12px/1.35 Arial,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.3)}' +
    '.pp-head{display:flex;align-items:center;gap:8px;background:' + COULEUR + ';color:#fff;margin:-12px -14px 10px;padding:8px 14px;border-radius:6px 6px 0 0}' +
    '.pp-head b{flex:1;font-size:14px}' +
    '.pp-card button{padding:3px 10px;border:1px solid #9aa5b5;background:#eef2f8;color:#1a1a1a;border-radius:4px;cursor:pointer;font:12px Arial,sans-serif}' +
    '.pp-card button.primary{background:' + COULEUR + ';color:#fff;border-color:' + COULEUR + '}' +
    '.pp-card button.pp-x{background:transparent;color:#fff;border-color:rgba(255,255,255,.6)}' +
    '.pp-card select,.pp-card input{background:#fff;color:#1a1a1a;border:1px solid #9aa5b5;border-radius:4px;padding:3px 6px;font:12px Arial,sans-serif;box-sizing:border-box}' +
    '.pp-lbl{display:flex;flex-direction:column;gap:2px;font-size:11px;color:#444}' +
    '.pp-table{width:100%;border-collapse:collapse;table-layout:fixed}' +
    '.pp-table th{background:#eef2f8;color:#1a3a6b;text-align:left;padding:4px 8px;border-bottom:2px solid ' + COULEUR + ';font-size:11px}' +
    '.pp-table td{padding:3px 8px;border-bottom:1px solid #e3e8ef;height:22px;vertical-align:middle}' +
    '.pp-table .r{text-align:right;font-variant-numeric:tabular-nums}' +
    '.pp-table input{width:90px;text-align:right}' +
    '.pp-up{color:#1e8449}.pp-down{color:#c0392b}' +
    '.pp-note{font-size:11px;color:#666;margin:8px 0 0}' +
    '.pp-msg{margin-left:auto;font-size:12px}';

  function injecterStyle() {
    if (document.getElementById('pp-style')) return;
    var st = document.createElement('style');
    st.id = 'pp-style';
    st.textContent = STYLE;
    document.head.appendChild(st);
  }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function nombre(v) { var n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) && n >= 0 ? n : 0; }
  function fmt(n) { var v = Math.round(Number(n) || 0); return (v < 0 ? '-' : '') + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }

  function lire() { try { var b = root.localStorage && root.localStorage.getItem(CLE); return b ? JSON.parse(b) : {}; } catch (e) { return {}; } }
  function ecrire(o) {
    try { root.localStorage && root.localStorage.setItem(CLE, JSON.stringify(o)); } catch (e) {}
    var p = root.TERH_paiePoint;
    if (p && p.save) Promise.resolve(p.save(o)).catch(function (e) { console.error('Pointage : sauvegarde base impossible', e); });
  }
  function synchroniser() {
    var p = root.TERH_paiePoint;
    if (!p || !p.load) return Promise.resolve(null);
    return Promise.resolve(p.load()).then(function (o) {
      if (o && typeof o === 'object') { try { root.localStorage && root.localStorage.setItem(CLE, JSON.stringify(o)); } catch (e) {} return o; }
      return null;
    }).catch(function () { return null; });
  }

  function ouvrirPointage(opts) {
    var id = 'pp-overlay';
    if (document.getElementById(id)) return;
    injecterStyle();
    opts = opts || {};
    var employes = (opts.employes || []).filter(function (e) { return e.nom; }).map(function (e) { return { key: e.mat || e.nom, nom: e.nom, mat: e.mat || '' }; });
    var courant = opts.courant || '';
    var periode = opts.periode || '';

    var ov = document.createElement('div');
    ov.id = id;
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,14,20,.55);z-index:2147483500;display:flex;align-items:flex-start;justify-content:center;padding:24px 12px;overflow:auto;box-sizing:border-box';
    var cadre = document.createElement('div');
    cadre.className = 'pp-card';
    ov.appendChild(cadre);
    document.body.appendChild(ov);

    function msg(t, err) { var m = cadre.querySelector('[data-msg]'); if (m) { m.textContent = t; m.style.color = err ? '#c0392b' : '#1e8449'; } }
    function heuresLues() {
      var h = {};
      CATS.forEach(function (c) { var el = cadre.querySelector('[data-h="' + c[0] + '"]'); h[c[0]] = el ? nombre(el.value) : 0; });
      return h;
    }
    function remplir(key, nom) {
      var mois = lire()[periode] || {};
      var pt = mois[key] || mois[nom] || {};
      CATS.forEach(function (c) { var el = cadre.querySelector('[data-h="' + c[0] + '"]'); if (el) el.value = pt[c[0]] || ''; });
    }
    function enregistrer(key, nom) {
      var d = lire();
      d[periode] = d[periode] || {};
      d[periode][key] = heuresLues();
      if (nom && nom !== key) delete d[periode][nom];
      ecrire(d);
    }

    cadre.innerHTML =
      '<div class="pp-head"><b>⏱ Pointage des heures supplémentaires</b><button type="button" class="pp-x" data-act="fermer">Fermer</button></div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:10px">' +
        '<label class="pp-lbl">Salarié<select data-sel style="min-width:240px"><option value="">— choisir —</option>' +
          employes.map(function (e) { return '<option value="' + esc(e.key) + '" data-nom="' + esc(e.nom) + '"' + (e.key === courant ? ' selected' : '') + '>' + esc(e.nom) + (e.mat ? ' (matricule ' + esc(e.mat) + ')' : '') + '</option>'; }).join('') + '</select></label>' +
        '<label class="pp-lbl">Période<input data-per value="' + esc(periode) + '" style="width:180px"></label>' +
      '</div>' +
      '<table class="pp-table"><colgroup><col><col style="width:130px"></colgroup>' +
        '<thead><tr><th>Catégorie</th><th class="r">Heures</th></tr></thead><tbody>' +
        CATS.map(function (c) { return '<tr><td>' + c[0] + ' — ' + esc(c[1]) + '</td><td class="r"><input data-h="' + c[0] + '" inputmode="decimal"></td></tr>'; }).join('') +
      '</tbody></table>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;align-items:center">' +
        '<button type="button" data-act="enregistrer">💾 Enregistrer</button>' +
        '<button type="button" class="primary" data-act="appliquer">➜ Appliquer au bulletin</button>' +
        '<span class="pp-msg" data-msg></span>' +
      '</div>' +
      '<p class="pp-note">Les heures sont multipliées par la base horaire (salaire de base ÷ 173,33) et par le taux de la catégorie lors du calcul du bulletin.</p>';

    cadre.addEventListener('change', function (e) {
      var sel = cadre.querySelector('[data-sel]');
      if (e.target.matches('[data-sel]')) remplir(sel.value, sel.selectedOptions[0] ? sel.selectedOptions[0].dataset.nom : '');
      if (e.target.matches('[data-per]')) { periode = e.target.value; if (sel.value) remplir(sel.value, sel.selectedOptions[0].dataset.nom); }
    });
    cadre.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var a = b.dataset.act;
      if (a === 'fermer') { ov.remove(); return; }
      var sel = cadre.querySelector('[data-sel]');
      var key = sel ? sel.value : '';
      if (!key) { msg('Choisissez un salarié.', true); return; }
      if (!periode) { msg('Indiquez la période.', true); return; }
      enregistrer(key, sel.selectedOptions[0] ? sel.selectedOptions[0].dataset.nom : '');
      if (a === 'enregistrer') msg('Pointage enregistré.');
      if (a === 'appliquer') {
        if (typeof opts.onApply === 'function') opts.onApply(heuresLues());
        ov.remove();
      }
    });
    // Pré-remplissage du salarié courant
    if (courant) { var s0 = cadre.querySelector('[data-sel]'); if (s0 && s0.value) remplir(s0.value, s0.selectedOptions[0] ? s0.selectedOptions[0].dataset.nom : ''); }
  }

  // ---------- Simulation ----------
  function ouvrirSimulation(opts) {
    var id = 'ps-overlay';
    if (document.getElementById(id)) return;
    injecterStyle();
    opts = opts || {};
    var M = root.PaieMoteur;
    if (!M) { alert('paie-moteur.js n\'est pas chargé.'); return; }
    var lignes = (opts.lignes || []).map(function (l) { return Object.assign({}, l); });
    var l1000 = lignes.filter(function (l) { return String(l.code) === '1000'; })[0];
    var salaireActuel = l1000 ? M.gainLigne(l1000) : 0;
    var saisies = opts.saisies || {};

    var ov = document.createElement('div');
    ov.id = id;
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,14,20,.55);z-index:2147483500;display:flex;align-items:flex-start;justify-content:center;padding:24px 12px;overflow:auto;box-sizing:border-box';
    var cadre = document.createElement('div');
    cadre.className = 'pp-card';
    ov.appendChild(cadre);
    document.body.appendChild(ov);

    function simule(mode, valeur) {
      var nouveau = mode === 'pct' ? salaireActuel * (1 + valeur / 100) : valeur;
      var avant = M.calculer(lignes, saisies);
      var sim = lignes.map(function (l) {
        if (String(l.code) !== '1000') return l;
        return Object.assign({}, l, { nombre: null, base: null, gain: nouveau });
      });
      var apres = M.calculer(sim, saisies);
      return { avant: avant, apres: apres, nouveau: nouveau };
    }
    function dessiner(res) {
      var ligne = function (lib, a, b) {
        var d = b - a;
        return '<tr><td>' + lib + '</td>' +
          '<td class="r">' + fmt(a) + '</td>' +
          '<td class="r">' + fmt(b) + '</td>' +
          '<td class="r ' + (d > 0 ? 'pp-up' : (d < 0 ? 'pp-down' : '')) + '">' + (d > 0 ? '+' : '') + fmt(d) + '</td></tr>';
      };
      var out = res ? '<table class="pp-table" style="margin-top:12px"><colgroup><col><col style="width:110px"><col style="width:110px"><col style="width:100px"></colgroup>' +
        '<thead><tr><th>Élément</th><th class="r">Actuel</th><th class="r">Simulé</th><th class="r">Écart</th></tr></thead><tbody>' +
        ligne('Salaire de base', salaireActuel, res.nouveau) +
        ligne('Brut', res.avant.brut, res.apres.brut) +
        ligne('Total retenues', res.avant.totalRetenues, res.apres.totalRetenues) +
        ligne('<b>Net à payer</b>', res.avant.net, res.apres.net) +
        ligne('Charges patronales', res.avant.totalPatronales, res.apres.totalPatronales) +
        ligne('<b>Coût employeur</b>', res.avant.coutEmployeur, res.apres.coutEmployeur) +
        '</tbody></table>' : '';
      cadre.innerHTML =
        '<div class="pp-head"><b>🧮 Simulation de salaire' + (opts.nom ? ' — ' + esc(opts.nom) : '') + '</b><button type="button" class="pp-x" data-act="fermer">Fermer</button></div>' +
        '<p class="pp-note" style="margin:0 0 10px">Salaire de base actuel : <b>' + fmt(salaireActuel) + '</b> FCFA. Le calcul reprend les rubriques, taux et constantes du bulletin en cours, sans rien enregistrer.</p>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">' +
          '<label class="pp-lbl">Mode<select data-mode><option value="pct">Augmentation en %</option><option value="montant">Nouveau salaire de base</option></select></label>' +
          '<label class="pp-lbl">Valeur<input data-val inputmode="decimal" value="10" style="width:120px"></label>' +
          '<button type="button" class="primary" data-act="calc">▶ Simuler</button>' +
        '</div>' + out;
    }

    cadre.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'fermer') { ov.remove(); return; }
      var mode = cadre.querySelector('[data-mode]').value;
      var v = parseFloat(String(cadre.querySelector('[data-val]').value).replace(',', '.'));
      if (!isFinite(v) || (mode === 'montant' && v < 0)) { alert('Valeur invalide.'); return; }
      if (!l1000) { alert('Pas de salaire de base dans le bulletin.'); return; }
      dessiner(simule(mode, v));
    });
    dessiner(null);
  }

  root.PaiePointage = { ouvrir: ouvrirPointage, lire: lire, synchroniser: synchroniser, CATS: CATS };
  root.PaieSimulation = { ouvrir: ouvrirSimulation };
})(typeof window !== 'undefined' ? window : globalThis);
