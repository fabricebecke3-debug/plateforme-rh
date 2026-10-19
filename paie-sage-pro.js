/* paie-sage-pro.js : module paie style Sage (bulletin, constantes, rubriques).
 * Calcul : PaieMoteur (paie-moteur.js), vérifié sur le bulletin Sage d'avril 2026.
 * Ordre de chargement : window.db, puis paie-moteur.js, puis paie-sage-pro.js.
 * Onglets : Bulletin | Constantes (taux, plafonds) | Rubriques (codes, types, imposable, heures sup).
 * Sauvegarde : window.db.parametres et localStorage du navigateur.
 * Pour une sauvegarde partagée (Supabase), définir : PaiePro.onSave = function (p) { ... };
 * Intégration : data-module="paie" sur le bouton de menu ; sinon un bouton flottant est créé.
 */
(function (root) {
  'use strict';

  var OV_ID = 'paie-pro-overlay';
  var BTN_ID = 'btn-paie-pro';
  var CLE = 'terh_paie_parametres';
  var COULEUR = '#1a3a6b';
  var HORAIRE_DEFAUT = 173.33;

  var TAUX_DEFAUT = {
    cnps_sal: 4.2, cnps_pat: 4.2, at_pat: 2.5, pf_pat: 7, fne_pat: 1,
    cfc_sal: 1, cfc_pat: 1.5, cac: 10, plafond_cnps: 750000
  };
  var TAUX_LIBELLES = [
    ['cnps_sal', 'Pension vieillesse, part salariale (%)'],
    ['cnps_pat', 'Pension vieillesse, part patronale (%)'],
    ['at_pat', 'Accidents du travail, patronal (%)'],
    ['pf_pat', 'Prestations familiales, patronal (%)'],
    ['fne_pat', 'FNE, patronal (%)'],
    ['cfc_sal', 'Crédit foncier, salarial (%)'],
    ['cfc_pat', 'Crédit foncier, patronal (%)'],
    ['cac', 'CAC sur IRPP (%)'],
    ['plafond_cnps', 'Plafond CNPS (FCFA)']
  ];

  // Rubriques du bulletin Sage. taux > 0 : heures supplémentaires (saisie en nombre d'heures).
  // imposable : false = exclue de l'IRPP (ex. paniers, salissure).
  var RUBRIQUES_DEFAUT = [
    { code: '1000', libelle: 'Salaire de Base mensuel', type: 'gain', imposable: true, taux: 0 },
    { code: '1040', libelle: 'Sursalaire', type: 'gain', imposable: true, taux: 0 },
    { code: '1430', libelle: 'Indemnité de Transport', type: 'gain', imposable: true, taux: 0 },
    { code: '1435', libelle: 'Indemnité de Logement', type: 'gain', imposable: true, taux: 0 },
    { code: '1510', libelle: "Prime d'assiduité", type: 'gain', imposable: true, taux: 0 },
    { code: '1310', libelle: 'Prime de panier', type: 'gain', imposable: false, taux: 0 },
    { code: '1442', libelle: 'Indemnité de salissure', type: 'gain', imposable: false, taux: 0 },
    { code: '1110', libelle: 'Heures supplémentaires 20 %', type: 'gain', imposable: true, taux: 120 },
    { code: '1130', libelle: 'Heures supplémentaires 30 %', type: 'gain', imposable: true, taux: 130 },
    { code: '1140', libelle: 'Heures supplémentaires 40 %', type: 'gain', imposable: true, taux: 140 },
    { code: '1150', libelle: 'Heures supplémentaires 50 %', type: 'gain', imposable: true, taux: 150 },
    { code: '2000', libelle: 'Avance sur salaire', type: 'retenue', imposable: true, taux: 0 },
    { code: '2010', libelle: 'Cantine', type: 'retenue', imposable: true, taux: 0 }
  ];

  // ---------- Utilitaires ----------
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // Montant FCFA avec espaces (écrans)
  function fmt(n) {
    var v = Math.round(Number(n) || 0);
    return (v < 0 ? '-' : '') + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }
  // Montant entier, sans séparateur (bulletin, comme Sage)
  function entier(n) { return String(Math.round(Number(n) || 0)); }
  // Décimal à 3 chiffres avec virgule (bases, taux, nombres, comme Sage)
  function dec(n) { return (Number(n) || 0).toFixed(3).replace('.', ','); }
  // Lecture d'un nombre saisi ; défaut si vide ou invalide
  function nombre(v, defaut) {
    var n = parseFloat(String(v == null ? '' : v).replace(',', '.').replace(/\s/g, ''));
    return isFinite(n) && n >= 0 ? n : (defaut || 0);
  }
  function moisCourant() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  function periodeInfos(periode) {
    var m = /^(\d{4})-(\d{2})$/.exec(periode || '');
    var d = m ? new Date(Number(m[1]), Number(m[2]) - 1, 1) : new Date();
    var y = d.getFullYear(), mo = d.getMonth();
    function jj(x) {
      return String(x.getDate()).padStart(2, '0') + '/' + String(x.getMonth() + 1).padStart(2, '0') + '/' + String(x.getFullYear()).slice(-2);
    }
    return { debut: jj(new Date(y, mo, 1)), fin: jj(new Date(y, mo + 1, 0)) };
  }

  // ---------- Paramètres (constantes et rubriques) ----------
  function copieRubrique(r) {
    return {
      code: String(r.code),
      libelle: String(r.libelle || ''),
      type: r.type === 'retenue' ? 'retenue' : 'gain',
      imposable: r.imposable !== false,
      taux: Number(r.taux) > 0 ? Number(r.taux) : 0
    };
  }
  function valideParams(s) {
    var out = { taux: Object.assign({}, TAUX_DEFAUT), rubriques: RUBRIQUES_DEFAUT.map(copieRubrique) };
    if (!s || typeof s !== 'object') return out;
    if (s.taux && typeof s.taux === 'object') {
      Object.keys(TAUX_DEFAUT).forEach(function (k) {
        var v = Number(s.taux[k]);
        if (isFinite(v) && v >= 0) out.taux[k] = v;
      });
    }
    if (Array.isArray(s.rubriques) && s.rubriques.length) {
      out.rubriques = s.rubriques
        .filter(function (r) { return r && /^\d{4}$/.test(String(r.code)) && String(r.libelle || '').trim(); })
        .map(copieRubrique);
    }
    return out;
  }
  function chargerParametres() {
    var src = (root.db && root.db.parametres) || null;
    if (!src) {
      try {
        var brut = root.localStorage && root.localStorage.getItem(CLE);
        if (brut) src = JSON.parse(brut);
      } catch (e) { src = null; }
    }
    return valideParams(src);
  }
  function sauverParametres(p) {
    root.db = root.db || {};
    root.db.parametres = p;
    try { root.localStorage && root.localStorage.setItem(CLE, JSON.stringify(p)); } catch (e) {}
    if (root.PaiePro && typeof root.PaiePro.onSave === 'function') {
      root.PaiePro.onSave(p);
    }
  }
  function validerRubriques(list) {
    var vu = {};
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      if (!/^\d{4}$/.test(r.code)) return 'Code invalide (4 chiffres) : « ' + r.code + ' »';
      if (!r.libelle) return 'Libellé manquant pour le code ' + r.code;
      if (vu[r.code]) return 'Code en double : ' + r.code;
      vu[r.code] = true;
    }
    if (!vu['1000']) return 'La rubrique 1000 (salaire de base) est obligatoire.';
    return '';
  }

  // ---------- Calcul (délégué au moteur) ----------
  function construireLignes(saisie, rubriques) {
    var lignes = [];
    rubriques.forEach(function (r) {
      var v = nombre(saisie[r.code]);
      if (!v) return;
      var l = { code: r.code, irpp: r.imposable !== false, retenue: r.type === 'retenue' };
      if (r.taux) { l.nombre = v; l.taux = r.taux; l.heures_sup = true; }
      else { l.gain = v; }
      lignes.push(l);
    });
    return lignes;
  }
  function calculer(saisie, p) {
    var M = root.PaieMoteur;
    if (!M || typeof M.calculer !== 'function') {
      throw new Error('paie-moteur.js introuvable : chargez-le avant paie-sage-pro.js.');
    }
    var salB = nombre(saisie['1000']);
    if (!(salB > 0)) throw new Error('Renseignez le salaire de base (rubrique 1000).');
    return M.calculer(construireLignes(saisie, p.rubriques), { salaireBase: salB, taux: p.taux });
  }

  // ---------- Bulletin ----------
  function grille(titres, valeurs) {
    var th = titres.map(function (t) {
      return '<th style="padding:3px 6px;border:1px solid #bbb;background:#f0f0f0;font-weight:600;text-align:left">' + esc(t) + '</th>';
    }).join('');
    var td = valeurs.map(function (v) {
      return '<td style="padding:3px 6px;border:1px solid #bbb">' + esc(v == null ? '' : v) + '</td>';
    }).join('');
    return '<table style="width:100%;border-collapse:collapse;margin-bottom:6px"><tr>' + th + '</tr><tr>' + td + '</tr></table>';
  }

  function ligneBulletin(cells, style) {
    return '<tr style="' + (style || '') + '">' + cells.map(function (v, i) {
      var al = (i === 1) ? 'left' : 'right';
      return '<td style="padding:3px 5px;border:1px solid #bbb;text-align:' + al + '">' + esc(v == null ? '' : v) + '</td>';
    }).join('') + '</tr>';
  }

  function rendreBulletin(zone, emp, soc, p, saisie, periode) {
    var R;
    try { R = calculer(saisie, p); }
    catch (err) {
      zone.innerHTML = '<div style="color:#c0392b;padding:20px">' + esc(err.message) + '</div>';
      return;
    }
    var T = p.taux, S = R.salariales, P = R.patronales;
    var horaire = Number(emp.horaire_mensuel) || HORAIRE_DEFAUT;
    var baseH = nombre(saisie['1000']) / horaire;
    var per = periodeInfos(periode);
    var rubs = {};
    p.rubriques.forEach(function (r) { rubs[r.code] = r; });
    var anc = root.PaieMoteur && root.PaieMoteur.ancienneteDepuis ? root.PaieMoteur.ancienneteDepuis(emp.date_embauche) : null;
    var heuresSup = 0;
    var lignes = [];

    // Gains
    R.rubriques.filter(function (r) { return !r.retenue; }).forEach(function (r) {
      var rub = rubs[r.code] || {};
      var cells;
      if (r.code === '1000') {
        cells = [r.code, rub.libelle || 'Salaire de base', dec(horaire), dec(baseH), '', entier(r.gain), '', ''];
      } else if (rub.taux) {
        var h = nombre(saisie[r.code]);
        heuresSup += h;
        cells = [r.code, rub.libelle, dec(h), dec(baseH), dec(rub.taux), entier(r.gain), '', ''];
      } else {
        cells = [r.code, rub.libelle || ('Rubrique ' + r.code), '', '', '', entier(r.gain), '', ''];
      }
      lignes.push(ligneBulletin(cells));
    });
    lignes.push(ligneBulletin(['', 'Total brut', '', '', '', entier(R.brut), '', ''], 'font-weight:700;background:#f5f6fa'));

    // Cotisations de sécurité sociale
    lignes.push(ligneBulletin(['8100', 'Pension vieillesse CNPS', '', dec(R.baseCNPS), dec(T.cnps_sal), entier(S.cnps), dec(T.cnps_pat), entier(P.cnps)]));
    lignes.push(ligneBulletin(['8110', 'Accident de travail', '', dec(R.baseCNPS), dec(0), entier(0), dec(T.at_pat), entier(P.at)]));
    lignes.push(ligneBulletin(['8120', 'Prestations familiales', '', dec(R.baseCNPS), '', '', dec(T.pf_pat), entier(P.pf)]));
    lignes.push(ligneBulletin(['8130', "Fonds national de l'emploi", '', dec(R.baseCNPS), '', '', dec(T.fne_pat), entier(P.fne)]));
    lignes.push(ligneBulletin(['8140', 'Crédit foncier patronal', '', dec(R.saltaxf), '', '', dec(T.cfc_pat), entier(P.cfc)]));
    var totPat = R.totalPatronales;
    lignes.push(ligneBulletin(['', 'Total cotisations', '', '', '', entier(S.cnps), '', entier(totPat)], 'font-weight:700;background:#f5f6fa'));

    // Impôts et taxes
    lignes.push(ligneBulletin(['9019', 'IRPP', '', '', '', entier(S.irpp), '', '']));
    lignes.push(ligneBulletin(['9032', 'CAC / IRPP', '', entier(S.irpp), dec(T.cac), entier(S.cac), '', '']));
    lignes.push(ligneBulletin(['9064', 'Crédit foncier salarial (CFC)', '', dec(R.saltaxf), dec(T.cfc_sal), entier(S.cfc), '', '']));
    lignes.push(ligneBulletin(['9070', 'Taxe communale', '', '', '', entier(S.taxeCommunale), '', '']));
    lignes.push(ligneBulletin(['9230', 'Redevance audiovisuelle', '', '', '', entier(S.redevance), '', '']));
    if (S.taxeDevLocal) lignes.push(ligneBulletin(['9071', 'Taxe de développement local', '', '', '', entier(S.taxeDevLocal), '', '']));
    if (S.taxeProp) lignes.push(ligneBulletin(['9060', 'Taxe proportionnelle', '', '', '', entier(S.taxeProp), '', '']));

    // Retenues diverses (avances, cantine)
    R.rubriques.filter(function (r) { return r.retenue; }).forEach(function (r) {
      var rub = rubs[r.code] || {};
      lignes.push(ligneBulletin([r.code, rub.libelle || ('Rubrique ' + r.code), '', '', '', entier(r.gain), '', '']));
    });
    lignes.push(ligneBulletin(['', 'Total retenues', '', '', '', entier(R.totalRetenues), '', ''], 'font-weight:700;background:#f5f6fa'));

    // Cumuls
    var A = emp.cumuls_annee || null;
    var cumEntetes = ['Salaire brut', 'Net imposable', 'Charges salariales', 'Charges patronales', 'Heures travaillées', 'Heures sup.', 'Avantages en nature', 'NET À PAYER'];
    var cumPeriode = [entier(R.brut), entier(R.netImposable), entier(R.totalRetenues), entier(totPat), entier(horaire), entier(heuresSup), '0', entier(R.net)];
    var cumAnnee = A
      ? [A.brut, A.netImposable, A.chargesSal, A.chargesPat, A.heures, A.heuresSup, A.avantages, A.net].map(entier)
      : ['—', '—', '—', '—', '—', '—', '—', '—'];

    var box = function (html) {
      return '<div style="flex:1;min-width:240px;border:1px solid #bbb;padding:6px">' + html + '</div>';
    };

    zone.innerHTML =
      '<div id="pp-bulletin" style="font-family:Arial,sans-serif;font-size:11px;color:#000;background:#fff;padding:12px;border:1px solid #999">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:6px">' +
          '<div style="font-size:15px;font-weight:700">BULLETIN DE PAIE</div>' +
          '<div style="text-align:right">Période du : ' + esc(per.debut) + ' au : ' + esc(per.fin) + '<br>Paiement le : ' + esc(per.fin) +
            ' par : ' + esc(emp.mode_paiement || 'Virement') + '</div>' +
        '</div>' +
        grille(['Matricule', 'Niveau', 'Coefficient', 'Indice', 'Ancienneté', 'N° Sécurité Sociale'],
          [emp.matricule, emp.niveau, emp.coefficient, emp.indice, anc ? anc.texte : '', emp.cnps]) +
        grille(['Catégorie', 'Emploi occupé', 'Département'], [emp.categorie, emp.emploi, emp.departement]) +
        grille(['Qualification', 'Horaire'], [emp.qualification, dec(horaire)]) +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:6px 0">' +
          box('<b>' + esc(soc.nom || '') + '</b><br>' + esc(soc.adresse || '') + '<br>N° CNPS : ' + esc(soc.cnps || '') +
            (soc.ccn ? '<br>CCN : ' + esc(soc.ccn) : '')) +
          box('<b>' + esc((emp.nom || '') + ' ' + (emp.prenom || '')) + '</b><br>' + esc(emp.adresse || '') + '<br>' + esc(emp.ville || '')) +
        '</div>' +
        grille(['Repos comp. acquis', 'Repos comp. reste', 'Repos comp. pris', 'Congés acquis', 'Congés reste', 'Congés pris'],
          emp.conges ? [emp.conges.repos_acquis, emp.conges.repos_reste, emp.conges.repos_pris, emp.conges.acquis, emp.conges.reste, emp.conges.pris] : ['', '', '', '', '', '']) +
        '<table style="width:100%;border-collapse:collapse;margin-top:6px">' +
          '<tr style="background:#f0f0f0;font-weight:600">' +
            '<th style="padding:4px;border:1px solid #bbb">N°</th><th style="padding:4px;border:1px solid #bbb;text-align:left">Désignation</th>' +
            '<th style="padding:4px;border:1px solid #bbb">Nombre</th><th style="padding:4px;border:1px solid #bbb">Base</th>' +
            '<th style="padding:4px;border:1px solid #bbb">Taux sal.</th><th style="padding:4px;border:1px solid #bbb">Gain / Retenue sal.</th>' +
            '<th style="padding:4px;border:1px solid #bbb">Taux pat.</th><th style="padding:4px;border:1px solid #bbb">Retenue pat.</th>' +
          '</tr>' + lignes.join('') +
        '</table>' +
        '<div style="display:flex;justify-content:flex-end;margin-top:8px;font-size:14px;font-weight:700">NET À PAYER : ' + fmt(R.net) + ' FCFA</div>' +
        '<div style="margin-top:8px;font-weight:700">Cumuls</div>' +
        '<table style="width:100%;border-collapse:collapse;font-size:10.5px">' +
          '<tr style="background:#f0f0f0">' + cumEntetes.map(function (t) { return '<th style="padding:3px;border:1px solid #bbb">' + esc(t) + '</th>'; }).join('') + '</tr>' +
          '<tr>' + cumPeriode.map(function (v) { return '<td style="padding:3px;border:1px solid #bbb;text-align:right">' + esc(v) + '</td>'; }).join('') + '</tr>' +
          '<tr>' + cumAnnee.map(function (v) { return '<td style="padding:3px;border:1px solid #bbb;text-align:right">' + esc(v) + '</td>'; }).join('') + '</tr>' +
        '</table>' +
        '<div style="margin-top:6px;font-size:9.5px;color:#444">Ligne Année : valeurs enregistrées dans la fiche (cumuls_annee), à mettre à jour chaque mois.</div>' +
        '<div style="margin-top:8px;font-size:9.5px">Pour vous aider à faire valoir vos droits, conservez ce bulletin de paie sans limitation de durée.</div>' +
      '</div>';
  }

  // ---------- Fenêtre du module ----------
  function styleImpression() {
    if (document.getElementById('pp-print-style')) return;
    var s = document.createElement('style');
    s.id = 'pp-print-style';
    s.textContent = '@media print{body *{visibility:hidden}#pp-bulletin,#pp-bulletin *{visibility:visible}' +
      '#pp-bulletin{position:absolute;left:0;top:0;width:100%;border:none!important}}';
    document.head.appendChild(s);
  }

  function ouvrir() {
    if (document.getElementById(OV_ID)) return;
    styleImpression();

    var db = root.db || {};
    var employes = Array.isArray(db.employes) ? db.employes : [];
    var soc = db.societe || {};
    var P = chargerParametres();
    var onglet = 'bulletin';
    var empIdx = -1;
    var saisie = {};
    var periode = moisCourant();

    var ov = document.createElement('div');
    ov.id = OV_ID;
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,14,20,.85);z-index:99999;display:flex;' +
      'align-items:flex-start;justify-content:center;padding:20px;overflow:auto;font-family:Arial,sans-serif';
    var cadre = document.createElement('div');
    cadre.style.cssText = 'background:#fff;max-width:1300px;width:100%;border-radius:8px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.5)';
    ov.appendChild(cadre);
    document.body.appendChild(ov);

    function msg(texte, erreur) {
      var m = cadre.querySelector('[data-msg]');
      if (m) { m.textContent = texte; m.style.color = erreur ? '#c0392b' : '#27ae60'; }
    }

    // Lit les champs de l'onglet Bulletin dans la mémoire
    function lireBulletin() {
      var sel = cadre.querySelector('[data-emp]');
      var per = cadre.querySelector('[data-per]');
      if (sel) empIdx = sel.value === '' ? -1 : Number(sel.value);
      if (per && per.value) periode = per.value;
      cadre.querySelectorAll('[data-sai]').forEach(function (el) {
        saisie[el.getAttribute('data-sai')] = el.value;
      });
    }
    // Lit les taux de l'onglet Constantes ; null si une valeur est invalide
    function lireTaux() {
      var t = {}, ok = true;
      cadre.querySelectorAll('[data-taux]').forEach(function (el) {
        var v = Number(String(el.value).replace(',', '.').replace(/\s/g, ''));
        if (!isFinite(v) || v < 0) ok = false;
        t[el.getAttribute('data-taux')] = v;
      });
      return ok ? t : null;
    }
    // Lit les lignes de l'onglet Rubriques
    function lireRubriques() {
      var tab = cadre.querySelector('[data-rub-tab]');
      if (!tab) return;
      P.rubriques = Array.prototype.map.call(tab.querySelectorAll('[data-rub-row]'), function (tr) {
        function g(f) { return tr.querySelector('[data-f="' + f + '"]'); }
        return copieRubrique({
          code: g('code').value.trim(),
          libelle: g('libelle').value.trim(),
          type: g('type').value,
          imposable: g('imposable').checked,
          taux: nombre(g('taux').value)
        });
      });
    }
    // Mémorise ce qui est affiché avant de changer d'onglet
    function memoriserOnglet() {
      if (onglet === 'bulletin') lireBulletin();
      if (onglet === 'constantes') { var t = lireTaux(); if (t) P.taux = Object.assign({}, TAUX_DEFAUT, t); }
      if (onglet === 'rubriques') lireRubriques();
    }

    function vueBulletin(corps) {
      var opts = employes.map(function (e, i) {
        return '<option value="' + i + '"' + (i === empIdx ? ' selected' : '') + '>' +
          esc(e.matricule) + ' - ' + esc(e.nom) + ' ' + esc(e.prenom) + '</option>';
      }).join('');
      var champs = P.rubriques.map(function (r) {
        var v = saisie[r.code] != null ? saisie[r.code] : '';
        return '<label style="font-size:12px;font-weight:600;display:flex;flex-direction:column;gap:3px">' +
          esc(r.code + ' - ' + r.libelle) +
          '<span style="font-weight:400;color:#666">' + (r.taux ? "nombre d'heures" : 'montant') + '</span>' +
          '<input type="text" inputmode="decimal" data-sai="' + esc(r.code) + '" value="' + esc(v) +
          '" style="padding:5px;border:1px solid #ccc;border-radius:4px"></label>';
      }).join('');
      corps.innerHTML =
        '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;background:#f5f6fa;padding:10px;border-radius:6px">' +
          '<label style="font-size:12px;font-weight:600;display:flex;flex-direction:column;gap:3px">Employé' +
            '<select data-emp style="padding:6px;min-width:260px"><option value="">— Choisir —</option>' + opts + '</select></label>' +
          '<label style="font-size:12px;font-weight:600;display:flex;flex-direction:column;gap:3px">Période' +
            '<input type="month" data-per value="' + esc(periode) + '" style="padding:5px"></label>' +
          '<button type="button" data-act="calculer" style="background:#27ae60;color:#fff;border:none;padding:9px 16px;border-radius:4px;cursor:pointer;font-weight:600">▶ Calculer</button>' +
          '<button type="button" data-act="imprimer" style="background:#2c3e50;color:#fff;border:none;padding:9px 16px;border-radius:4px;cursor:pointer;font-weight:600">🖨 Imprimer</button>' +
        '</div>' +
        '<details style="margin:12px 0"><summary style="cursor:pointer;font-weight:600">Éléments de la période (saisie)</summary>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px;margin-top:8px">' + champs + '</div>' +
        '</details>' +
        '<div data-zone></div>';
      var zone = corps.querySelector('[data-zone]');
      if (empIdx >= 0 && employes[empIdx]) rendreBulletin(zone, employes[empIdx], soc, P, saisie, periode);
      else zone.innerHTML = '<div style="text-align:center;color:#888;padding:30px">Sélectionnez un employé.</div>';
    }

    function vueConstantes(corps) {
      corps.innerHTML =
        '<p style="color:#555;font-size:12px;margin:0 0 10px">Taux et plafonds utilisés par le calcul des bulletins. Enregistrez pour les appliquer.</p>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px">' +
        TAUX_LIBELLES.map(function (t) {
          return '<label style="font-size:12px;font-weight:600;display:flex;flex-direction:column;gap:3px">' + esc(t[1]) +
            '<input type="text" inputmode="decimal" data-taux="' + t[0] + '" value="' + esc(P.taux[t[0]]) +
            '" style="padding:6px;border:1px solid #ccc;border-radius:4px"></label>';
        }).join('') +
        '</div>' +
        '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">' +
          '<button type="button" data-act="save-taux" style="background:#27ae60;color:#fff;border:none;padding:9px 16px;border-radius:4px;cursor:pointer;font-weight:600">💾 Enregistrer</button>' +
          '<button type="button" data-act="reset-taux" style="background:#95a5a6;color:#fff;border:none;padding:9px 16px;border-radius:4px;cursor:pointer">↺ Valeurs par défaut</button>' +
        '</div>' +
        '<p style="font-size:11px;color:#777;margin-top:10px">Les tables IRPP, taxe communale et redevance audiovisuelle sont dans paie-moteur.js (TAXCOM, TAXAUDIO, tranches IRPP).</p>';
    }

    function vueRubriques(corps) {
      var lignes = P.rubriques.map(function (r, i) {
        return '<tr data-rub-row>' +
          '<td style="padding:3px"><input data-f="code" value="' + esc(r.code) + '" maxlength="4" style="width:70px"></td>' +
          '<td style="padding:3px"><input data-f="libelle" value="' + esc(r.libelle) + '" style="width:100%;min-width:220px"></td>' +
          '<td style="padding:3px"><select data-f="type">' +
            '<option value="gain"' + (r.type === 'gain' ? ' selected' : '') + '>Gain</option>' +
            '<option value="retenue"' + (r.type === 'retenue' ? ' selected' : '') + '>Retenue</option></select></td>' +
          '<td style="padding:3px;text-align:center"><input type="checkbox" data-f="imposable"' + (r.imposable ? ' checked' : '') + '></td>' +
          '<td style="padding:3px"><input data-f="taux" value="' + esc(r.taux || '') + '" style="width:70px" placeholder="—"></td>' +
          '<td style="padding:3px"><button type="button" data-act="del-rub" data-i="' + i + '" style="background:#e74c3c;color:#fff;border:none;padding:4px 8px;border-radius:3px;cursor:pointer">✕</button></td>' +
        '</tr>';
      }).join('');
      corps.innerHTML =
        '<p style="color:#555;font-size:12px;margin:0 0 10px">Rubriques du bulletin. <b>Taux</b> (120, 130, 140, 150…) : heures supplémentaires, saisies en nombre d\'heures. ' +
        '<b>Non imposable</b> : exclue de l\'IRPP (paniers, salissure). <b>Retenue</b> : déduite du net, hors brut et hors bases de cotisation.</p>' +
        '<div data-rub-tab style="overflow:auto;max-height:60vh"><table style="border-collapse:collapse;width:100%;font-size:12px">' +
          '<thead><tr style="background:' + COULEUR + ';color:#fff"><th style="padding:6px;text-align:left">Code</th><th style="padding:6px;text-align:left">Libellé</th>' +
          '<th style="padding:6px">Type</th><th style="padding:6px">Imposable</th><th style="padding:6px">Taux HS</th><th></th></tr></thead>' +
          '<tbody>' + lignes + '</tbody></table></div>' +
        '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">' +
          '<button type="button" data-act="add-rub" style="background:#2980b9;color:#fff;border:none;padding:9px 16px;border-radius:4px;cursor:pointer">➕ Ajouter une rubrique</button>' +
          '<button type="button" data-act="save-rub" style="background:#27ae60;color:#fff;border:none;padding:9px 16px;border-radius:4px;cursor:pointer;font-weight:600">💾 Enregistrer</button>' +
          '<button type="button" data-act="reset-rub" style="background:#95a5a6;color:#fff;border:none;padding:9px 16px;border-radius:4px;cursor:pointer">↺ Rubriques par défaut</button>' +
        '</div>';
    }

    function dessiner() {
      var onglets = [['bulletin', 'Bulletin'], ['constantes', 'Constantes'], ['rubriques', 'Rubriques']];
      cadre.innerHTML =
        '<div style="background:' + COULEUR + ';color:#fff;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
          '<div style="font-size:16px;font-weight:600">Module paie (style Sage)</div>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
            onglets.map(function (t) {
              var actif = onglet === t[0];
              return '<button type="button" data-onglet="' + t[0] + '" style="' +
                (actif ? 'background:#fff;color:' + COULEUR + ';border:none' : 'background:transparent;color:#fff;border:1px solid #fff') +
                ';padding:6px 12px;border-radius:4px;cursor:pointer;font-weight:600">' + t[1] + '</button>';
            }).join('') +
            '<button type="button" data-act="fermer" style="background:#e74c3c;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer">✕ Fermer</button>' +
          '</div>' +
        '</div>' +
        '<div data-msg style="padding:6px 16px;font-size:12px;min-height:18px"></div>' +
        '<div data-corps style="padding:12px 16px 16px"></div>';
      var corps = cadre.querySelector('[data-corps]');
      if (onglet === 'bulletin') vueBulletin(corps);
      else if (onglet === 'constantes') vueConstantes(corps);
      else vueRubriques(corps);
    }

    function fermer() {
      document.removeEventListener('keydown', onKey);
      ov.remove();
    }
    function onKey(e) { if (e.key === 'Escape') fermer(); }
    document.addEventListener('keydown', onKey);

    cadre.addEventListener('click', function (e) {
      var t = e.target.closest('[data-onglet],[data-act]');
      if (!t) return;
      if (t.hasAttribute('data-onglet')) {
        memoriserOnglet();
        onglet = t.getAttribute('data-onglet');
        dessiner();
        return;
      }
      var a = t.getAttribute('data-act');
      if (a === 'fermer') { fermer(); return; }
      if (a === 'calculer') {
        lireBulletin();
        if (empIdx < 0 || !employes[empIdx]) { msg('Sélectionnez un employé.', true); return; }
        rendreBulletin(cadre.querySelector('[data-zone]'), employes[empIdx], soc, P, saisie, periode);
        return;
      }
      if (a === 'imprimer') { window.print(); return; }
      if (a === 'save-taux') {
        var taux = lireTaux();
        if (!taux) { msg('Taux invalide : valeurs positives attendues.', true); return; }
        P.taux = Object.assign({}, TAUX_DEFAUT, taux);
        sauverParametres(P);
        msg('Constantes enregistrées.');
        return;
      }
      if (a === 'reset-taux') { P.taux = Object.assign({}, TAUX_DEFAUT); dessiner(); msg('Valeurs légales par défaut rétablies (non enregistrées).'); return; }
      if (a === 'add-rub') {
        lireRubriques();
        P.rubriques.push(copieRubrique({ code: '', libelle: '', type: 'gain', imposable: true, taux: 0 }));
        dessiner();
        return;
      }
      if (a === 'del-rub') {
        lireRubriques();
        P.rubriques.splice(Number(t.getAttribute('data-i')), 1);
        dessiner();
        return;
      }
      if (a === 'save-rub') {
        lireRubriques();
        var err = validerRubriques(P.rubriques);
        if (err) { msg(err, true); return; }
        sauverParametres(P);
        msg('Rubriques enregistrées.');
        return;
      }
      if (a === 'reset-rub') { P.rubriques = RUBRIQUES_DEFAUT.map(copieRubrique); dessiner(); msg('Rubriques par défaut rétablies (non enregistrées).'); return; }
    });

    // Changement d'employé : nouvelle saisie avec son salaire de base
    cadre.addEventListener('change', function (e) {
      if (!e.target.hasAttribute('data-emp')) return;
      lireBulletin();
      var emp = employes[empIdx];
      saisie = {};
      if (emp && emp.salaire_base) saisie['1000'] = String(emp.salaire_base);
      dessiner();
    });

    ov.addEventListener('mousedown', function (e) { if (e.target === ov) fermer(); });

    dessiner();
  }

  // ---------- Intégration ----------
  function integrer() {
    var declencheur = document.querySelector('[data-module="paie"]');
    if (declencheur) {
      declencheur.addEventListener('click', function (e) { e.preventDefault(); ouvrir(); });
      return;
    }
    if (document.getElementById(BTN_ID)) return;
    var b = document.createElement('button');
    b.id = BTN_ID;
    b.type = 'button';
    b.textContent = '💰 Paie';
    b.style.cssText = 'position:fixed;bottom:20px;right:20px;background:' + COULEUR + ';color:#fff;border:none;' +
      'padding:12px 20px;border-radius:30px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.3);z-index:99998;font-weight:600';
    b.addEventListener('click', ouvrir);
    document.body.appendChild(b);
  }

  root.PaiePro = {
    ouvrir: ouvrir,
    onSave: null,
    parametres: chargerParametres,
    calculerBulletin: function (saisie, parametres) { return calculer(saisie || {}, parametres || chargerParametres()); },
    fmt: fmt
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', integrer);
  else integrer();
})(typeof window !== 'undefined' ? window : globalThis);
