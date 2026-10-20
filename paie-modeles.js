/* paie-modeles.js : bulletins modèles (mise en page du bulletin imprimé).
 * PaieModeles.ouvrir()  : éditeur (nom, couleur, logo et sa position, rubriques affichées et leur ordre,
 *                         disposition des blocs, colonnes du tableau, pied légal, charges patronales).
 * PaieModeles.actif()   : modèle par défaut, utilisé à l'impression du bulletin détaillé.
 * Sauvegarde : localStorage 'terh_paie_modeles' + table parametres (clé paie_modeles_json) via window.TERH_paieModeles.
 */
(function (root) {
  'use strict';

  var CLE = 'terh_paie_modeles';
  var TAILLE_LOGO_MAX = 300 * 1024;
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

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function nouvelId() { return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function copie(m) {
    return {
      id: String(m.id || nouvelId()),
      nom: String(m.nom || '').trim() || 'Modèle sans nom',
      couleur: /^#[0-9a-fA-F]{6}$/.test(m.couleur || '') ? m.couleur : '',
      afficherPatronales: m.afficherPatronales !== false,
      afficherPied: m.afficherPied !== false,
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
      var b = root.localStorage && root.localStorage.getItem(CLE);
      if (b) { var l = JSON.parse(b); if (Array.isArray(l) && l.length) return normaliser(l); }
    } catch (e) {}
    return normaliser(DEFAUT);
  }
  function sauver(liste) {
    try { root.localStorage && root.localStorage.setItem(CLE, JSON.stringify(liste)); } catch (e) {}
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
      try { root.localStorage && root.localStorage.setItem(CLE, JSON.stringify(n)); } catch (e) {}
      return n;
    }).catch(function () { return null; });
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
        '<button type="button" data-act="defaut">★ Définir par défaut</button><button type="button" data-act="supprimer">✕ Supprimer</button></div>';
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
            '<label>Importer (PNG, JPG, max 300 Ko)<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-logo-file></label>' +
            '<label>Position<select data-f="logopos">' + Object.keys(POS_LOGO).map(function (k) { return '<option value="' + k + '"' + (m.logoPos === k ? ' selected' : '') + '>' + POS_LOGO[k] + '</option>'; }).join('') + '</select></label>' +
            (m.logo ? '<button type="button" data-act="logo-retirer">Retirer le logo</button>' : '') +
          '</div></div>' +
          '<label style="display:flex;gap:6px;align-items:center"><input data-f="patr" type="checkbox"' + (m.afficherPatronales ? ' checked' : '') + '> Afficher les charges patronales</label>' +
          '<label style="display:flex;gap:6px;align-items:center"><input data-f="pied-on" type="checkbox"' + (m.afficherPied ? ' checked' : '') + '> Afficher la mention légale</label>' +
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
      if (a === 'nouveau') {
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
        if (f.size > TAILLE_LOGO_MAX) { msg('Logo trop lourd (' + Math.round(f.size / 1024) + ' Ko). Maximum 300 Ko.', true); el.value = ''; return; }
        var lecteur = new FileReader();
        lecteur.onload = function () {
          lireForm();
          var mm = trouve();
          var data = String(lecteur.result || '');
          if (!/^data:image\/(png|jpe?g|gif|webp);base64,/.test(data)) { msg('Format d\'image non reconnu.', true); return; }
          mm.logo = data;
          dessiner(); msg('Logo importé. Enregistrez pour l\'appliquer aux bulletins.');
        };
        lecteur.readAsDataURL(f);
      }
    });

    dessiner();
    synchroniser().then(function (n) {
      if (!n || !document.getElementById(id)) return;
      liste = n;
      if (!trouve()) courant = liste.filter(function (x) { return x.defaut; })[0].id;
      reinitialiserEdition();
      dessiner();
    });
  }

  root.PaieModeles = { ouvrir: ouvrir, charger: charger, actif: actif, synchroniser: synchroniser, BLOCS: BLOCS, DISPOSITIONS: DISPOSITIONS };
})(typeof window !== 'undefined' ? window : globalThis);
