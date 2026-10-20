/* paie-modeles.js : bulletins modèles (mise en page du bulletin imprimé).
 * Ouverture : PaieModeles.ouvrir()
 * Un modèle règle : nom, couleur d'en-tête, bloc charges patronales, pied légal (texte libre).
 * Le modèle par défaut est utilisé à l'impression du bulletin détaillé.
 * Sauvegarde : localStorage 'terh_paie_modeles' + table parametres (clé paie_modeles_json) via window.TERH_paieModeles.
 */
(function (root) {
  'use strict';

  var CLE = 'terh_paie_modeles';
  var BLOCS_DEFAUT = ['entete', 'salarie', 'rubriques', 'pied'];
  var COLONNES_DEFAUT = { nombre: true, base: true, taux: true, retenuePatronale: true };
  var DISPOSITIONS = {
    sage: ['entete', 'salarie', 'rubriques', 'pied'],
    compact: ['entete', 'rubriques', 'pied'],
    rubriques: ['rubriques', 'entete', 'salarie', 'pied']
  };
  var DEFAUT = [{ id: 'sage', nom: 'Sage standard', couleur: '', afficherPatronales: true, afficherPied: true, pied: '', defaut: true, blocs: BLOCS_DEFAUT.slice(), colonnes: Object.assign({}, COLONNES_DEFAUT) }];

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function copie(m) {
    return {
      id: String(m.id || ('m' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6))),
      nom: String(m.nom || '').trim() || 'Modèle sans nom',
      couleur: /^#[0-9a-fA-F]{6}$/.test(m.couleur || '') ? m.couleur : '',
      afficherPatronales: m.afficherPatronales !== false,
      afficherPied: m.afficherPied !== false,
      pied: String(m.pied || ''),
      defaut: !!m.defaut,
      blocs: (Array.isArray(m.blocs) && m.blocs.length ? m.blocs.filter(function (b) { return BLOCS_DEFAUT.indexOf(b) >= 0; }) : BLOCS_DEFAUT.slice()),
      colonnes: Object.assign({}, COLONNES_DEFAUT, m.colonnes || {})
    };
  }
  function normaliser(liste) {
    var l = liste.map(copie);
    if (!l.length) l = DEFAUT.map(copie);
    var d = l.filter(function (m) { return m.defaut; });
    if (!d.length) l[0].defaut = true;
    else if (d.length > 1) { l.forEach(function (m, i) { m.defaut = (m === d[0]); }); }
    return l;
  }
  function charger() {
    try {
      var b = root.localStorage && root.localStorage.getItem(CLE);
      if (b) { var l = JSON.parse(b); if (Array.isArray(l) && l.length) return normaliser(l); }
    } catch (e) {}
    return normaliser(DEFAUT);
  }
  function sauver(liste) {
    try { root.localStorage && root.localStorage.setItem(CLE, JSON.stringify(liste)); } catch (e) {}
    var pont = root.TERH_paieModeles;
    if (pont && pont.save) Promise.resolve(pont.save(liste)).catch(function (e) { console.error('Modèles : sauvegarde base impossible', e); });
  }
  function synchroniser() {
    var pont = root.TERH_paieModeles;
    if (!pont || !pont.load) return Promise.resolve(null);
    return Promise.resolve(pont.load()).then(function (l) {
      if (!Array.isArray(l) || !l.length) return null;
      var n = normaliser(l);
      try { root.localStorage && root.localStorage.setItem(CLE, JSON.stringify(n)); } catch (e) {}
      return n;
    }).catch(function () { return null; });
  }
  function actif() {
    var l = charger();
    return l.filter(function (m) { return m.defaut; })[0] || l[0];
  }

  function ouvrir(onChange) {
    var id = 'pm-overlay';
    if (document.getElementById(id)) return;
    var liste = charger();
    var courant = liste.filter(function (m) { return m.defaut; })[0].id;

    var ov = document.createElement('div');
    ov.id = id;
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,14,20,.6);z-index:2147483500;display:flex;align-items:flex-start;justify-content:center;padding:16px;overflow:auto';
    var cadre = document.createElement('div');
    cadre.style.cssText = 'background:#fff;color:#1a1a1a;max-width:900px;width:100%;border-radius:12px;padding:16px;font-family:Arial,sans-serif;font-size:12px;box-sizing:border-box';
    ov.appendChild(cadre);
    document.body.appendChild(ov);

    function trouve() { return liste.filter(function (m) { return m.id === courant; })[0]; }
    function lireForm() {
      var m = trouve(); if (!m) return;
      var g = function (f) { return cadre.querySelector('[data-f="' + f + '"]'); };
      if (!g('nom')) return;
      m.nom = g('nom').value; m.couleur = g('couleur').value; m.afficherPatronales = g('patr').checked;
      m.afficherPied = g('pied-on').checked; m.pied = g('pied').value;
      var dispo = g('dispo'); if (dispo && DISPOSITIONS[dispo.value]) m.blocs = DISPOSITIONS[dispo.value].slice();
      var cols = ['nombre', 'base', 'taux', 'retenuePatronale'];
      cols.forEach(function (c) { var el = cadre.querySelector('[data-col="' + c + '"]'); if (el) m.colonnes[c] = el.checked; });
    }
    function msg(t, err) { var e = cadre.querySelector('[data-msg]'); if (e) { e.textContent = t; e.style.color = err ? '#c0392b' : '#1e8449'; } }
    function dessiner() {
      var m = trouve();
      var options = liste.map(function (x) {
        return '<option value="' + esc(x.id) + '"' + (x.id === courant ? ' selected' : '') + '>' + esc(x.nom) + (x.defaut ? ' (par défaut)' : '') + '</option>';
      }).join('');
      cadre.innerHTML =
        '<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px"><b style="flex:1;font-size:16px">📄 Bulletins modèles</b><button type="button" data-act="fermer">✕ Fermer</button></div>' +
        '<p style="color:#444;margin:0 0 10px">Le modèle par défaut sert à l\'impression du bulletin détaillé. Les charges patronales et le pied légal peuvent être masqués ou modifiés.</p>' +
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px"><label>Modèle <select data-act="choisir">' + options + '</select></label>' +
          '<button type="button" data-act="nouveau">➕ Nouveau</button><button type="button" data-act="dupliquer">⧉ Dupliquer</button>' +
          '<button type="button" data-act="defaut">★ Définir par défaut</button><button type="button" data-act="supprimer" style="color:#a93226">✕ Supprimer</button></div>' +
        (m ? '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
          '<label>Nom du modèle<input data-f="nom" value="' + esc(m.nom) + '" style="width:100%"></label>' +
          '<label>Couleur d\'en-tête<input data-f="couleur" type="color" value="' + (m.couleur || '#1f5fbf') + '"></label>' +
          '<label style="display:flex;gap:6px;align-items:center"><input data-f="patr" type="checkbox"' + (m.afficherPatronales ? ' checked' : '') + '> Afficher les charges patronales</label>' +
          '<label style="display:flex;gap:6px;align-items:center"><input data-f="pied-on" type="checkbox"' + (m.afficherPied ? ' checked' : '') + '> Afficher le pied légal</label>' +
          '<label style="grid-column:1/3">Texte de pied (complément)<textarea data-f="pied" rows="3" style="width:100%">' + esc(m.pied) + '</textarea></label>' +
          '<label>Disposition des blocs<select data-f="dispo">' + [['sage', 'Sage standard (en-tête, salarié, rubriques, pied)'], ['compact', 'Compact (sans bloc salarié)'], ['rubriques', 'Rubriques en premier']].map(function (d) { var actuel = (m.blocs || []).join(','); var sel = DISPOSITIONS[d[0]].join(',') === actuel; return '<option value="' + d[0] + '"' + (sel ? ' selected' : '') + '>' + d[1] + '</option>'; }).join('') + '</select></label>' +
          '<div style="grid-column:1/3;display:flex;gap:14px;flex-wrap:wrap"><b>Colonnes du tableau :</b>' +
            [['nombre', 'Nombre'], ['base', 'Base'], ['taux', 'Taux salarial'], ['retenuePatronale', 'Retenue patronale']].map(function (c) { return '<label style="display:flex;gap:4px;align-items:center"><input type="checkbox" data-col="' + c[0] + '"' + (m.colonnes[c[0]] !== false ? ' checked' : '') + '> ' + c[1] + '</label>'; }).join('') +
          '</div>' +
          '</div>' : '') +
        '<div style="display:flex;gap:8px;align-items:center;margin-top:12px"><button type="button" class="p" data-act="enregistrer" style="background:#1f5fbf;color:#fff;border-color:#1f5fbf">💾 Enregistrer</button><span data-msg style="margin-left:auto"></span></div>';
    }

    cadre.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var a = b.dataset.act;
      if (a === 'fermer') { ov.remove(); return; }
      lireForm();
      if (a === 'nouveau') { var n = copie({ nom: 'Nouveau modèle', afficherPatronales: true, afficherPied: true }); liste.push(n); courant = n.id; }
      else if (a === 'dupliquer') { var d = copie(trouve()); d.id = ''; d.nom = trouve().nom + ' (copie)'; d.defaut = false; d = copie(d); liste.push(d); courant = d.id; }
      else if (a === 'defaut') { liste.forEach(function (x) { x.defaut = (x.id === courant); }); }
      else if (a === 'supprimer') {
        if (liste.length <= 1) { msg('Il faut garder au moins un modèle.', true); return; }
        if (!confirm('Supprimer le modèle « ' + trouve().nom + ' » ?')) return;
        var wasDef = trouve().defaut;
        liste = liste.filter(function (x) { return x.id !== courant; });
        if (wasDef) liste[0].defaut = true;
        courant = liste.filter(function (x) { return x.defaut; })[0].id;
      }
      else if (a === 'enregistrer') {
        if (!trouve().nom.trim()) { dessiner(); msg('Le nom du modèle est obligatoire.', true); return; }
        liste = normaliser(liste);
        sauver(liste);
        if (typeof onChange === 'function') onChange(liste.map(copie));
        dessiner(); msg('Modèle enregistré.');
        return;
      }
      dessiner();
    });
    cadre.addEventListener('change', function (e) {
      if (e.target.matches('[data-act="choisir"]')) { lireForm(); courant = e.target.value; dessiner(); }
    });

    dessiner();
    synchroniser().then(function (n) {
      if (!n || !document.getElementById(id)) return;
      liste = n;
      if (!trouve()) courant = liste.filter(function (x) { return x.defaut; })[0].id;
      dessiner();
    });
  }

  root.PaieModeles = { ouvrir: ouvrir, charger: charger, actif: actif, synchroniser: synchroniser };
})(typeof window !== 'undefined' ? window : globalThis);
