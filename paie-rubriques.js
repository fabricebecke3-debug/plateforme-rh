/* paie-rubriques.js : éditeur de rubriques de paie (catalogue).
 * Ouverture : PaieRubriques.ouvrir(catalogue, onChange)
 *   catalogue : tableau d'objets {code, libelle, type:'gain'|'retenue', imposable, cnps, cfc,
 *               mode:'fixe'|'heures'|'pct', taux_defaut, transport, logement, heures_sup}
 *   onChange(liste) est appelé à chaque enregistrement.
 * Sauvegarde locale : localStorage 'terh_paie_catalogue' (chargé automatiquement par PaieRubriques.charger()).
 * Limite : le mode de calcul est enregistré, mais les formules libres ne sont pas encore interprétées.
 */
(function (root) {
  'use strict';

  var CLE = 'terh_paie_catalogue';
  var COULEUR = '#1f5fbf';

  // Modèle inspiré des rubriques Sage du bulletin de référence
  var MODELE = [
    { code: '1000', libelle: 'Salaire de base mensuel', type: 'gain', imposable: true, cnps: true, cfc: true, mode: 'heures', taux_defaut: null },
    { code: '1040', libelle: 'Sursalaire', type: 'gain', imposable: true, cnps: true, cfc: true, mode: 'fixe', taux_defaut: null },
    { code: '1430', libelle: 'Indemnité de transport', type: 'gain', imposable: true, cnps: false, cfc: false, mode: 'fixe', taux_defaut: null, transport: true },
    { code: '1435', libelle: 'Indemnité de logement', type: 'gain', imposable: true, cnps: true, cfc: false, mode: 'fixe', taux_defaut: null, logement: true },
    { code: '1510', libelle: "Prime d'assiduité", type: 'gain', imposable: true, cnps: true, cfc: true, mode: 'fixe', taux_defaut: null },
    { code: '1310', libelle: 'Prime de panier', type: 'gain', imposable: false, cnps: false, cfc: false, mode: 'fixe', taux_defaut: null },
    { code: '1442', libelle: 'Indemnité de salissure', type: 'gain', imposable: false, cnps: false, cfc: false, mode: 'fixe', taux_defaut: null },
    { code: '1110', libelle: 'Heures supplémentaires 20 %', type: 'gain', imposable: true, cnps: true, cfc: true, mode: 'heures', taux_defaut: 120, heures_sup: true },
    { code: '1130', libelle: 'Heures supplémentaires 30 %', type: 'gain', imposable: true, cnps: true, cfc: true, mode: 'heures', taux_defaut: 130, heures_sup: true },
    { code: '1140', libelle: 'Heures supplémentaires 40 %', type: 'gain', imposable: true, cnps: true, cfc: true, mode: 'heures', taux_defaut: 140, heures_sup: true },
    { code: '1150', libelle: 'Heures supplémentaires 50 %', type: 'gain', imposable: true, cnps: true, cfc: true, mode: 'heures', taux_defaut: 150, heures_sup: true },
    { code: '2000', libelle: 'Avance sur salaire', type: 'retenue', imposable: true, cnps: false, cfc: false, mode: 'fixe', taux_defaut: null },
    { code: '2010', libelle: 'Cantine', type: 'retenue', imposable: true, cnps: false, cfc: false, mode: 'fixe', taux_defaut: null }
  ];

  var MODES = { fixe: 'Montant fixe', heures: 'Nombre × base × taux', pct: '% du salaire de base' };

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function copie(r) {
    return {
      code: String(r.code || '').trim(),
      libelle: String(r.libelle || '').trim(),
      type: r.type === 'retenue' ? 'retenue' : 'gain',
      imposable: r.imposable !== false,
      cnps: !!r.cnps,
      cfc: !!r.cfc,
      mode: MODES[r.mode] ? r.mode : 'fixe',
      taux_defaut: (r.taux_defaut === null || r.taux_defaut === '' || r.taux_defaut === undefined) ? null : Number(r.taux_defaut),
      transport: !!r.transport,
      logement: !!r.logement,
      heures_sup: !!r.heures_sup
    };
  }
  function valider(liste) {
    var vu = {};
    for (var i = 0; i < liste.length; i++) {
      var r = liste[i];
      if (!/^\d{4}$/.test(r.code)) return 'Code invalide (4 chiffres) : « ' + r.code + ' »';
      if (!r.libelle) return 'Libellé manquant pour le code ' + r.code;
      if (vu[r.code]) return 'Code en double : ' + r.code;
      if (r.taux_defaut !== null && !(r.taux_defaut >= 0)) return 'Taux invalide pour ' + r.code;
      vu[r.code] = true;
    }
    return '';
  }
  function charger() {
    try {
      var brut = root.localStorage && root.localStorage.getItem(CLE);
      if (brut) { var l = JSON.parse(brut); if (Array.isArray(l) && l.length) return l.map(copie); }
    } catch (e) {}
    return MODELE.map(copie);
  }
  function sauver(liste) {
    try { root.localStorage && root.localStorage.setItem(CLE, JSON.stringify(liste)); } catch (e) {}
    var pont = root.TERH_paieRub;
    if (pont && pont.save) {
      Promise.resolve(pont.save(liste)).catch(function (e) { console.error('Rubriques : sauvegarde base impossible', e); });
    }
  }
  // Lit le catalogue enregistré pour la société (table parametres). Renvoie la liste, ou null si rien en base.
  function synchroniser() {
    var pont = root.TERH_paieRub;
    if (!pont || !pont.load) return Promise.resolve(null);
    return Promise.resolve(pont.load()).then(function (l) {
      if (!Array.isArray(l) || !l.length) return null;
      var propre = l.map(copie);
      try { root.localStorage && root.localStorage.setItem(CLE, JSON.stringify(propre)); } catch (e) {}
      return propre;
    }).catch(function () { return null; });
  }

  function ouvrir(catalogue, onChange) {
    var id = 'pr-overlay';
    if (document.getElementById(id)) return;
    if (!document.getElementById('pr-style')) {
      var st = document.createElement('style');
      st.id = 'pr-style';
      st.textContent = '#pr-cadre,#pr-cadre *{font-family:Arial,sans-serif;box-sizing:border-box}' +
        '#pr-cadre{background:#fff;color:#1a1a1a}#pr-cadre input,#pr-cadre select{background:#fff;color:#1a1a1a;border:1px solid #9aa5b5;border-radius:6px;padding:4px 6px;font-size:12px}' +
        '#pr-cadre table th{background:' + COULEUR + ';color:#fff;padding:6px;font-size:12px;text-align:left}' +
        '#pr-cadre table td{padding:4px;border-bottom:1px solid #e3e8ef;vertical-align:middle}' +
        '#pr-cadre button{background:#eef2f8;color:#1a1a1a;border:1px solid #9aa5b5;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:12px}' +
        '#pr-cadre button.p{background:' + COULEUR + ';color:#fff;border-color:' + COULEUR + '}' +
        '#pr-cadre button.d{background:#fdecec;border-color:#e74c3c;color:#a93226}';
      document.head.appendChild(st);
    }
    var liste = (catalogue && catalogue.length ? catalogue : charger()).map(copie);

    var ov = document.createElement('div');
    ov.id = id;
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,14,20,.6);z-index:2147483500;display:flex;align-items:flex-start;justify-content:center;padding:16px;overflow:auto';
    var cadre = document.createElement('div');
    cadre.id = 'pr-cadre';
    cadre.style.cssText = 'max-width:1100px;width:100%;border-radius:12px;padding:16px';
    ov.appendChild(cadre);
    document.body.appendChild(ov);

    function lire() {
      var rows = cadre.querySelectorAll('[data-row]');
      liste = Array.prototype.map.call(rows, function (tr) {
        function g(f) { return tr.querySelector('[data-f="' + f + '"]'); }
        return copie({
          code: g('code').value, libelle: g('libelle').value, type: g('type').value,
          imposable: g('imposable').checked, cnps: g('cnps').checked, cfc: g('cfc').checked,
          mode: g('mode').value, taux_defaut: g('taux').value,
          transport: g('transport').checked, logement: g('logement').checked, heures_sup: g('hs').checked
        });
      });
    }
    function msg(t, err) {
      var m = cadre.querySelector('[data-msg]');
      if (m) { m.textContent = t; m.style.color = err ? '#c0392b' : '#1e8449'; }
    }
    function dessiner() {
      var cb = function (f, v) { return '<td style="text-align:center"><input type="checkbox" data-f="' + f + '"' + (v ? ' checked' : '') + '></td>'; };
      var lignes = liste.map(function (r, i) {
        return '<tr data-row="' + i + '">' +
          '<td><input data-f="code" value="' + esc(r.code) + '" maxlength="4" style="width:64px"></td>' +
          '<td><input data-f="libelle" value="' + esc(r.libelle) + '" style="width:230px"></td>' +
          '<td><select data-f="type"><option value="gain"' + (r.type === 'gain' ? ' selected' : '') + '>Gain</option><option value="retenue"' + (r.type === 'retenue' ? ' selected' : '') + '>Retenue</option></select></td>' +
          '<td><select data-f="mode">' + Object.keys(MODES).map(function (k) { return '<option value="' + k + '"' + (r.mode === k ? ' selected' : '') + '>' + MODES[k] + '</option>'; }).join('') + '</select></td>' +
          '<td><input data-f="taux" value="' + (r.taux_defaut === null ? '' : esc(r.taux_defaut)) + '" style="width:60px" placeholder="—"></td>' +
          cb('imposable', r.imposable) + cb('cnps', r.cnps) + cb('cfc', r.cfc) + cb('transport', r.transport) + cb('logement', r.logement) + cb('hs', r.heures_sup) +
          '<td style="white-space:nowrap"><button type="button" data-act="dup" data-i="' + i + '">⧉</button> <button type="button" class="d" data-act="del" data-i="' + i + '">✕</button></td>' +
          '</tr>';
      }).join('');
      cadre.innerHTML =
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px">' +
          '<b style="flex:1;font-size:16px;color:#1a1a1a">⚙️ Rubriques de paie</b>' +
          '<button type="button" data-act="fermer">✕ Fermer</button></div>' +
        '<p style="font-size:12px;color:#444;margin:0 0 10px">Une rubrique = un code à 4 chiffres, un libellé et un mode de calcul. ' +
          '<b>Imposable</b> : entre dans l\'IRPP. <b>CNPS</b> : entre dans la base de la pension. <b>CFC</b> : entre dans le crédit foncier. ' +
          '<b>Transport / Logement / HS</b> : rubriques spéciales reconnues par le calcul.</p>' +
        '<div style="overflow:auto;max-height:60vh"><table style="border-collapse:collapse;width:100%"><thead><tr>' +
          '<th>Code</th><th>Libellé</th><th>Type</th><th>Mode de calcul</th><th>Taux %</th>' +
          '<th style="text-align:center">Imposable</th><th style="text-align:center">CNPS</th><th style="text-align:center">CFC</th>' +
          '<th style="text-align:center">Transport</th><th style="text-align:center">Logement</th><th style="text-align:center">HS</th><th></th>' +
          '</tr></thead><tbody>' + lignes + '</tbody></table></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;align-items:center">' +
          '<button type="button" data-act="add">➕ Nouvelle rubrique</button>' +
          '<button type="button" class="p" data-act="save">💾 Enregistrer</button>' +
          '<button type="button" data-act="modele">↺ Rétablir le modèle</button>' +
          '<span data-msg style="font-size:12px;margin-left:auto"></span></div>' +
        '<p style="font-size:11px;color:#777;margin:10px 0 0">Le mode « % du salaire de base » est enregistré ; le calcul par formule libre n\'est pas encore disponible.</p>';
    }

    cadre.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var a = b.dataset.act, i = +b.dataset.i;
      if (a === 'fermer') { ov.remove(); return; }
      lire();
      if (a === 'add') {
        liste.push(copie({ code: '', libelle: 'Nouvelle rubrique', type: 'gain', imposable: true, mode: 'fixe' }));
      } else if (a === 'dup') {
        var c = copie(liste[i]); c.code = ''; c.libelle = c.libelle + ' (copie)'; liste.splice(i + 1, 0, c);
      } else if (a === 'del') {
        if (liste[i].code === '1000') { msg('La rubrique 1000 (salaire de base) ne peut pas être supprimée.', true); return; }
        liste.splice(i, 1);
      } else if (a === 'modele') {
        if (!confirm('Remplacer toutes les rubriques par le modèle de départ ?')) return;
        liste = MODELE.map(copie);
      } else if (a === 'save') {
        var err = valider(liste);
        if (err) { dessiner(); msg(err, true); return; }
        sauver(liste);
        if (typeof onChange === 'function') onChange(liste.map(copie));
        dessiner(); msg('Rubriques enregistrées (' + liste.length + ').');
        return;
      }
      dessiner();
    });

    dessiner();
  }

  root.PaieRubriques = { ouvrir: ouvrir, charger: charger, synchroniser: synchroniser, modele: function () { return MODELE.map(copie); } };
})(typeof window !== 'undefined' ? window : globalThis);
