/* paie-modeles.js — Modèles de bulletin par société (logo, emplacement du logo, couleur, rubriques prises en compte,
 * disposition des blocs, colonnes, pied). Stockage : local par société + base (paramètres de la société, clé paie_modeles).
 * Ouverture : PaieModeles.ouvrir()   Lecture : PaieModeles.charger()   Défaut : PaieModeles.actif()
 */
(function (root) {
  'use strict';
  var CLE = 'terh_paie_modeles';
  var BLOCS = ['entete', 'salarie', 'rubriques', 'pied'];
  var COLONNES = { nombre: true, base: true, taux: true, retenuePatronale: true };
  var DISPOSITIONS = { sage: ['entete', 'salarie', 'rubriques', 'pied'], compact: ['entete', 'rubriques', 'pied'], rubriques: ['rubriques', 'entete', 'salarie', 'pied'] };
  var EMPLACEMENTS = { gauche: 'Dans l\'en-tête, à gauche', droite: 'Dans l\'en-tête, à droite', pied: 'En pied de bulletin' };
  var PONT = function () { return root.TERH_paieModeles || null; };

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function cle() { var p = PONT(); return CLE + ':' + ((p && p.cle && p.cle()) || 'defaut'); }
  function id() { return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function copie(m) {
    m = m || {};
    return {
      id: String(m.id || id()),
      nom: String(m.nom || '').trim() || 'Modèle sans nom',
      couleur: /^#[0-9a-fA-F]{6}$/.test(m.couleur || '') ? m.couleur : '',
      logo: (typeof m.logo === 'string' && /^data:image\/(png|jpeg|svg\+xml);base64,/.test(m.logo)) ? m.logo : '',
      logoPos: EMPLACEMENTS[m.logoPos] ? m.logoPos : 'gauche',
      afficherPatronales: m.afficherPatronales !== false,
      afficherPied: m.afficherPied !== false,
      pied: String(m.pied || ''),
      defaut: !!m.defaut,
      blocs: (Array.isArray(m.blocs) && m.blocs.length ? m.blocs.filter(function (b) { return BLOCS.indexOf(b) >= 0; }) : BLOCS.slice()),
      colonnes: Object.assign({}, COLONNES, m.colonnes || {}),
      rubriques: Array.isArray(m.rubriques) ? m.rubriques.map(String) : []   // vide = toutes les rubriques de la structure
    };
  }
  function defautListe() {
    return [copie({ id: 'sage', nom: 'Sage standard', defaut: true })];
  }
  function normaliser(liste) {
    var l = (liste || []).map(copie);
    if (!l.length) l = defautListe();
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
    return normaliser(defautListe());
  }
  function sauverLocal(liste) { try { root.localStorage && root.localStorage.setItem(cle(), JSON.stringify(liste)); } catch (e) {} }
  // Enregistre en base (paramètres de la société). Renvoie une promesse (succès ou erreur).
  function sauver(liste) {
    sauverLocal(liste);
    var p = PONT();
    if (!p || !p.save) return Promise.resolve({ local: true, base: false });
    return Promise.resolve(p.save(liste)).then(function () { return { local: true, base: true }; });
  }
  // Première ouverture d'une société : si rien en local, on prend la base
  function synchroniser() {
    var p = PONT();
    if (!p || !p.load) return Promise.resolve(null);
    var locale = null; try { locale = root.localStorage && root.localStorage.getItem(cle()); } catch (e) {}
    if (locale) return Promise.resolve(null);
    return Promise.resolve(p.load()).then(function (l) {
      if (!Array.isArray(l) || !l.length) return null;
      var n = normaliser(l); sauverLocal(n); return n;
    }).catch(function () { return null; });
  }
  function actif() { var l = charger(); return l.filter(function (m) { return m.defaut; })[0] || l[0]; }

  // Liste des rubriques proposées (catalogue Sage, sinon catalogue de la société)
  function catalogueRubriques() {
    var sage = (root.PaieSageCatalogue && root.PaieSageCatalogue.rubriques) || [];
    return sage.map(function (r) { return { code: r.code, libelle: r.libelle }; });
  }

  function ouvrir(onChange) {
    var id0 = 'pm-overlay';
    if (document.getElementById(id0)) return;
    var liste = charger();
    var courant = (liste.filter(function (m) { return m.defaut; })[0] || liste[0]).id;
    var msgEtat = '';

    var ov = document.createElement('div');
    ov.id = id0;
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,14,20,.6);z-index:2147483500;display:flex;align-items:flex-start;justify-content:center;padding:16px;overflow:auto';
    var cadre = document.createElement('div');
    cadre.style.cssText = 'background:#fff;color:#1a1a1a;max-width:960px;width:100%;border-radius:12px;padding:16px;font-family:Arial,sans-serif;font-size:12px;box-sizing:border-box';
    ov.appendChild(cadre);
    document.body.appendChild(ov);

    function trouve() { return liste.filter(function (m) { return m.id === courant; })[0]; }
    function g(f) { return cadre.querySelector('[data-f="' + f + '"]'); }
    function lireForm() {
      var m = trouve(); if (!m || !g('nom')) return;
      m.nom = g('nom').value; m.couleur = g('couleur').value; m.afficherPatronales = g('patr').checked;
      m.afficherPied = g('pied-on').checked; m.pied = g('pied').value;
      m.logoPos = g('logopos').value;
      var dispo = g('dispo'); if (dispo && DISPOSITIONS[dispo.value]) m.blocs = DISPOSITIONS[dispo.value].slice();
      ['nombre', 'base', 'taux', 'retenuePatronale'].forEach(function (c) { var el = cadre.querySelector('[data-col="' + c + '"]'); if (el) m.colonnes[c] = el.checked; });
      var coches = cadre.querySelectorAll('[data-rub]:checked');
      m.rubriques = Array.prototype.map.call(coches, function (x) { return x.dataset.rub; });
    }
    function msg(t, err) { var e = cadre.querySelector('[data-msg]'); if (e) { e.textContent = t; e.style.color = err ? '#c0392b' : '#1e8449'; } }

    function dessiner() {
      var m = trouve();
      var options = liste.map(function (x) {
        return '<option value="' + esc(x.id) + '"' + (x.id === courant ? ' selected' : '') + '>' + esc(x.nom) + (x.defaut ? ' (par défaut de la société)' : '') + '</option>';
      }).join('');
      var rubs = catalogueRubriques();
      var cocheRub = function (r) {
        var coche = !m.rubriques.length || m.rubriques.indexOf(r.code) >= 0;
        return '<label style="display:flex;gap:6px;align-items:center;padding:1px 0"><input type="checkbox" data-rub="' + esc(r.code) + '"' + (coche ? ' checked' : '') + '> <span style="color:#555">' + esc(r.code) + '</span> ' + esc(r.libelle) + '</label>';
      };
      cadre.innerHTML =
        '<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px"><b style="flex:1;font-size:16px">🗂 Modèles de bulletin</b><button type="button" data-act="fermer">✕ Fermer</button></div>' +
        '<p style="color:#444;margin:0 0 10px">Le modèle par défaut de la société sert à tous les bulletins, sauf si la fiche du salarié indique un autre modèle. Chaque réglage ci-dessous est appliqué au bulletin imprimé.</p>' +
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px"><label>Modèle <select data-act="choisir">' + options + '</select></label>' +
          '<button type="button" data-act="nouveau">➕ Nouveau</button><button type="button" data-act="dupliquer">⧉ Dupliquer</button>' +
          '<button type="button" data-act="defaut">★ Définir par défaut</button><button type="button" data-act="supprimer" style="color:#a93226">✕ Supprimer</button></div>' +
        (m ? '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
          '<label>Nom du modèle<input data-f="nom" value="' + esc(m.nom) + '" style="width:100%"></label>' +
          '<label>Couleur d\'en-tête<input data-f="couleur" type="color" value="' + (m.couleur || '#1f5fbf') + '"></label>' +
          '<div style="grid-column:1/3;border:1px solid #d6dbe3;border-radius:8px;padding:8px"><b>Logo</b> (PNG, JPG ou SVG, 300 Ko maximum)<br>' +
            (m.logo ? '<img src="' + m.logo + '" alt="" style="max-height:50px;max-width:200px;margin:4px 0;display:block">' : '<i style="color:#777">Aucun logo : celui de la société est utilisé.</i>') +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:4px"><input type="file" data-act="logo" accept="image/png,image/jpeg,image/svg+xml">' +
            (m.logo ? '<button type="button" data-act="retirer-logo">Retirer le logo</button>' : '') +
            '<label>Emplacement <select data-f="logopos">' + Object.keys(EMPLACEMENTS).map(function (k) { return '<option value="' + k + '"' + (m.logoPos === k ? ' selected' : '') + '>' + EMPLACEMENTS[k] + '</option>'; }).join('') + '</select></label></div></div>' +
          '<label style="display:flex;gap:6px;align-items:center"><input data-f="patr" type="checkbox"' + (m.afficherPatronales ? ' checked' : '') + '> Afficher les charges patronales</label>' +
          '<label style="display:flex;gap:6px;align-items:center"><input data-f="pied-on" type="checkbox"' + (m.afficherPied ? ' checked' : '') + '> Afficher le pied légal</label>' +
          '<label style="grid-column:1/3">Texte de pied (complément)<textarea data-f="pied" rows="2" style="width:100%">' + esc(m.pied) + '</textarea></label>' +
          '<label>Disposition des blocs<select data-f="dispo">' + [['sage', 'Sage standard (en-tête, salarié, rubriques, pied)'], ['compact', 'Compact (sans bloc salarié)'], ['rubriques', 'Rubriques en premier']].map(function (d) { return '<option value="' + d[0] + '"' + (DISPOSITIONS[d[0]].join(',') === m.blocs.join(',') ? ' selected' : '') + '>' + d[1] + '</option>'; }).join('') + '</select></label>' +
          '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center"><b>Colonnes du tableau :</b>' +
            [['nombre', 'Nombre'], ['base', 'Base'], ['taux', 'Taux salarial'], ['retenuePatronale', 'Retenue patronale']].map(function (c) { return '<label style="display:flex;gap:4px;align-items:center"><input type="checkbox" data-col="' + c[0] + '"' + (m.colonnes[c[0]] !== false ? ' checked' : '') + '> ' + c[1] + '</label>'; }).join('') + '</div>' +
          '<div style="grid-column:1/3"><b>Rubriques prises en compte</b> <span style="color:#666">(gains et retenues diverses ; le salaire de base 1000 et les cotisations légales restent toujours)</span>' +
            '<div style="max-height:200px;overflow:auto;border:1px solid #d6dbe3;border-radius:8px;padding:6px;margin-top:4px">' + rubs.map(cocheRub).join('') + '</div></div>' +
          '</div>' : '') +
        '<div style="display:flex;gap:8px;align-items:center;margin-top:12px"><button type="button" data-act="enregistrer" style="background:#1f5fbf;color:#fff;border-color:#1f5fbf">💾 Enregistrer le modèle</button><span data-msg style="margin-left:auto">' + esc(msgEtat) + '</span></div>';
    }

    cadre.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var a = b.dataset.act;
      if (a === 'fermer') { ov.remove(); return; }
      if (a === 'retirer-logo') { lireForm(); trouve().logo = ''; dessiner(); return; }
      lireForm();
      if (a === 'nouveau') { var n = copie({ nom: 'Nouveau modèle' }); liste.push(n); courant = n.id; }
      else if (a === 'dupliquer') { var d = copie(trouve()); d.id = id(); d.nom = trouve().nom + ' (copie)'; d.defaut = false; liste.push(d); courant = d.id; }
      else if (a === 'defaut') { liste.forEach(function (x) { x.defaut = (x.id === courant); }); }
      else if (a === 'supprimer') {
        if (liste.length <= 1) { msgEtat = 'Il faut garder au moins un modèle.'; dessiner(); msg(msgEtat, true); return; }
        if (!confirm('Supprimer le modèle « ' + trouve().nom + ' » ?')) return;
        var wasDef = trouve().defaut;
        liste = liste.filter(function (x) { return x.id !== courant; });
        if (wasDef) liste[0].defaut = true;
        courant = (liste.filter(function (x) { return x.defaut; })[0] || liste[0]).id;
      }
      else if (a === 'enregistrer') {
        if (!trouve().nom.trim()) { msgEtat = 'Le nom du modèle est obligatoire.'; dessiner(); msg(msgEtat, true); return; }
        liste = normaliser(liste);
        msg('Enregistrement…');
        sauver(liste).then(function (r) {
          msgEtat = r.base ? '✅ Modèle enregistré pour la société.' : '✅ Modèle enregistré sur ce poste (base non disponible).';
          dessiner(); msg(msgEtat);
          if (typeof onChange === 'function') onChange(liste.map(copie));
        }).catch(function (err) {
          msgEtat = '⚠ Enregistré sur ce poste, mais pas en base : ' + ((err && err.message) || err);
          dessiner(); msg(msgEtat, true);
        });
        return;
      }
      dessiner();
    });
    cadre.addEventListener('change', function (e) {
      if (e.target.matches('[data-act="choisir"]')) { lireForm(); courant = e.target.value; dessiner(); }
      if (e.target.matches('[data-act="logo"]')) {
        var f = e.target.files && e.target.files[0]; if (!f) return;
        if (f.size > 300 * 1024) { msg('Logo trop lourd (300 Ko maximum).', true); return; }
        if (!/^image\/(png|jpeg|svg\+xml)$/.test(f.type)) { msg('Format non accepté (PNG, JPG ou SVG).', true); return; }
        var rd = new FileReader();
        rd.onload = function () { lireForm(); trouve().logo = rd.result; dessiner(); msg('Logo ajouté : pensez à enregistrer.'); };
        rd.readAsDataURL(f);
      }
    });
    dessiner();
    synchroniser().then(function (n) {
      if (!n || !document.getElementById(id0)) return;
      liste = n; if (!trouve()) courant = (liste.filter(function (x) { return x.defaut; })[0] || liste[0]).id;
      dessiner();
    });
  }

  root.PaieModeles = { ouvrir: ouvrir, charger: charger, actif: actif, synchroniser: synchroniser, EMPLACEMENTS: EMPLACEMENTS, catalogueRubriques: catalogueRubriques };
})(typeof window !== 'undefined' ? window : globalThis);
