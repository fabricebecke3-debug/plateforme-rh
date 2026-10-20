/* paie-constantes.js — Constantes Sage (valeurs fixes) lues dans sage-data.json, à côté de index.html.
 * PaieConstantes.ouvrir()  : fenêtre de consultation, recherche par code ou libellé. Lecture seule.
 * PaieConstantes.charger() : Promise de la liste [{code, libelle, type, valeur}] (valeurs numériques uniquement).
 */
(function (root) {
  'use strict';
  var cache = null, enCours = null, CHEMIN = 'sage-data.json', MAX = 400;

  var STYLE =
    '#pc-overlay{position:fixed;inset:0;background:rgba(10,14,20,.55);z-index:2147483600;display:flex;align-items:flex-start;justify-content:center;padding:24px 12px;box-sizing:border-box}' +
    '#pc-box{background:#fff;color:#1a1a1a;width:min(720px,100%);max-height:88vh;display:flex;flex-direction:column;border-radius:6px;box-shadow:0 8px 28px rgba(0,0,0,.3);font:12px/1.3 Arial,sans-serif;overflow:hidden}' +
    '#pc-head{display:flex;align-items:center;gap:8px;background:#1f5fbf;color:#fff;padding:8px 12px;font-size:14px;font-weight:700}' +
    '#pc-head span{flex:1}' +
    '#pc-head button{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.6);border-radius:4px;padding:2px 10px;cursor:pointer}' +
    '#pc-bar{padding:8px 12px;border-bottom:1px solid #d6dbe3}' +
    '#pc-bar input{width:100%;box-sizing:border-box;padding:5px 8px;border:1px solid #9aa5b5;border-radius:4px;font-size:12px;background:#fff;color:#1a1a1a}' +
    '#pc-list{overflow:auto;flex:1;min-height:120px}' +
    '#pc-list table{width:100%;border-collapse:collapse;table-layout:fixed}' +
    '#pc-list th{position:sticky;top:0;background:#eef2f8;color:#1a3a6b;text-align:left;padding:4px 8px;border-bottom:2px solid #1f5fbf;font-size:11px}' +
    '#pc-list td{padding:3px 8px;border-bottom:1px solid #e3e8ef;height:20px;vertical-align:top;line-height:1.25}' +
    '#pc-list .pc-c{white-space:nowrap;font-family:Consolas,monospace;font-size:11px}' +
    '#pc-list .pc-v{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}' +
    '#pc-list tbody tr:nth-child(even) td{background:#f7f9fc}' +
    '#pc-foot{padding:6px 12px;border-top:1px solid #d6dbe3;color:#555;font-size:11px;min-height:16px}';

  function echapper(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // Une constante Sage a une liste de valeurs ; on retient la première, si elle est numérique
  function valeurDe(c) {
    var o = c && c.o && c.o[0] && c.o[0][1];
    return (o && typeof o.n === 'number' && isFinite(o.n)) ? o.n : null;
  }
  function formater(v) { return String(v).replace('.', ','); }

  function charger() {
    if (cache) return Promise.resolve(cache);
    if (enCours) return enCours;
    enCours = fetch(CHEMIN, { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('sage-data.json : HTTP ' + r.status);
        return r.json();
      })
      .then(function (d) {
        var con = (d && d.con) || {};
        cache = Object.keys(con).map(function (k) {
          var c = con[k];
          return { code: String(c.c || k), libelle: String(c.l || ''), type: String(c.t || ''), valeur: c.t === 'Valeur' ? valeurDe(c) : null };
        }).filter(function (c) { return c.valeur !== null; });
        cache.sort(function (a, b) { return a.code < b.code ? -1 : (a.code > b.code ? 1 : 0); });
        enCours = null;
        return cache;
      })
      .catch(function (e) { enCours = null; throw e; });
    return enCours;
  }

  function ouvrir() {
    if (document.getElementById('pc-overlay')) return;
    if (!document.getElementById('pc-style')) {
      var st = document.createElement('style');
      st.id = 'pc-style';
      st.textContent = STYLE;
      document.head.appendChild(st);
    }
    var ov = document.createElement('div');
    ov.id = 'pc-overlay';
    ov.innerHTML =
      '<div id="pc-box" role="dialog" aria-label="Constantes Sage">' +
        '<div id="pc-head"><span>Constantes Sage</span><button type="button" data-x="fermer">Fermer</button></div>' +
        '<div id="pc-bar"><input type="search" data-q placeholder="Rechercher par code ou libellé (ex. CAC, 1000, plafond)…"></div>' +
        '<div id="pc-list"><div style="padding:12px;color:#666">Chargement…</div></div>' +
        '<div id="pc-foot"></div>' +
      '</div>';
    document.body.appendChild(ov);

    var liste = ov.querySelector('#pc-list'), pied = ov.querySelector('#pc-foot'), champ = ov.querySelector('[data-q]');
    var donnees = [];

    function fermer() {
      document.removeEventListener('keydown', surClavier);
      ov.remove();
    }
    function surClavier(e) { if (e.key === 'Escape') fermer(); }

    function dessiner() {
      var q = champ.value.trim().toLowerCase();
      var res = q ? donnees.filter(function (c) { return (c.code + ' ' + c.libelle).toLowerCase().indexOf(q) >= 0; }) : donnees;
      var affichees = res.slice(0, MAX);
      liste.innerHTML =
        '<table><colgroup><col style="width:110px"><col><col style="width:120px"></colgroup>' +
        '<thead><tr><th class="pc-c">Code</th><th>Libellé</th><th class="pc-v">Valeur</th></tr></thead><tbody>' +
        affichees.map(function (c) {
          return '<tr><td class="pc-c">' + echapper(c.code) + '</td><td>' + echapper(c.libelle) + '</td><td class="pc-v">' + echapper(formater(c.valeur)) + '</td></tr>';
        }).join('') +
        '</tbody></table>';
      pied.textContent = res.length + ' constante(s)' +
        (res.length > MAX ? ' · affichage des ' + MAX + ' premières : précisez la recherche' : '');
    }

    ov.addEventListener('click', function (e) {
      if (e.target === ov || (e.target.closest && e.target.closest('[data-x="fermer"]'))) fermer();
    });
    champ.addEventListener('input', dessiner);
    document.addEventListener('keydown', surClavier);

    charger().then(function (d) {
      donnees = d;
      dessiner();
      champ.focus();
    }).catch(function (e) {
      liste.innerHTML = '<div style="padding:12px;color:#c0392b">Impossible de lire sage-data.json : vérifiez qu\'il est déployé à côté de index.html.</div>';
      pied.textContent = String((e && e.message) || e);
    });
  }

  root.PaieConstantes = { ouvrir: ouvrir, charger: charger };
})(typeof window !== 'undefined' ? window : globalThis);
