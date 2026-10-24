/* paie-hok.js — Calcul « Hôtel Océan » (HOK), reprend les formules du fichier Salaires_HOK_utiliser.xlsx.
 * Paramètres (taux, barèmes IRPP / RAV / TC, coordonnées de l'entreprise) : PaieHok.charger(), modifiables
 * via PaieHok.ouvrir() (JSON), enregistrés dans localStorage 'terh_hok_params'.
 * PaieHok.depuisLignes({fiche, lignes}) : calcul pour le bulletin imprimé (salaire et ancienneté pris sur la fiche,
 *   éléments complémentaires = lignes saisies à la main : prime de caisse, indemnité de congé, retenues…).
 * PaieHok.calculer({salaireBase, dateAnciennete | ansAnciennete, manuels, retenuesManuelles, params}) : calcul pur.
 * Points à confirmer (hypothèses du fichier) : seuil d'ancienneté, barème TC au-delà de 500 000, écart IRPP/TC
 * avec le bulletin de référence (IRPP 4 032 sur le bulletin contre 4 037 calculé ; TC 750 contre 770).
 */
(function (root) {
  'use strict';

  var CLE = 'terh_hok_params';
  var DEFAUT = {
    // Version des règles légales (TDL et ancienneté) : si elle change, les anciens paliers enregistrés sont remplacés
    regles_version: 'tdl-tableau-anciennete-cours-1',
    // Version du barème TDL (tableau de l'image « TDL / Prélèvement annuel », ÷ 12 pour le mensuel) : si elle change, le barème enregistré est remplacé
    tdl_version: 'tdl-image-sept-2026',
    entreprise: { bp: '', tel: '695364392 /670471563', niu: 'M042318119342F', cnps: '392-0100140- A' },
    absences: { heures_mois: 173.33 },
    logement: { taux: 0.25 },
    assiduite: { taux: 0.05 },
    anciennete: { seuil_ans: 2, taux_depart: 0.04, hausse_par_an: 0.02 },
    transport: { montant: 15000, exclu_cnps: 1 },
    cnps: { taux: 0.042, plafond: null },
    abattement: { taux: 0.7 },
    irpp: {
      seuils: [62000, 310000, 429000, 667000],
      taux: [0.1, 0.15, 0.25, 0.35],
      cumul: [16693, 29188, 70830],
      facteur: 0.7, charge: 0.028, deduction: 41667
    },
    cac: { taux: 0.1 },
    // Charges patronales (taux légaux, comme le moteur Sage) : CNPS sur la base CNPS, CFC patronal sur la base CFC. À confirmer par l'hôtel.
    patronales: { cnps: 4.2, at: 2.5, pf: 7, fne: 1, cfc: 1.5 },
    cfc: { taux: 0.01 },
    rav: {
      tranches: [[50000, 0], [100000, 750], [200000, 1950], [300000, 3250], [400000, 4550], [500000, 5850],
        [600000, 7150], [700000, 8450], [800000, 9750], [900000, 11050], [1000000, 12350]],
      au_dela: 13000
    },
    // TDL (taxe communale) : base mensuelle L ; montant mensuel = prélèvement annuel / 12 (barème officiel)
    tc: {
      regle: 'table',
      tranches: [[62000, 0], [75000, 250], [100000, 500], [125000, 750], [150000, 1000], [200000, 1250],
        [250000, 1500], [300000, 2000], [500000, 2250]],
      // Au-delà de 500 000 : non précisé par le tableau, maintenu à 2 250 (à confirmer)
      au_dela: 2250
    }
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  var FORMULE_CCF_ANCIENNE = 'si(Lcfc>p_seuil_cfc, floor(p_cfc*Lcfc), 0)';
  // Fusion : les objets sont fusionnés, les listes et valeurs sont remplacées (ajout de paramètres possible)
  function fusion(base, sur) {
    var out = clone(base);
    Object.keys(sur || {}).forEach(function (k) {
      var v = sur[k];
      var objet = v && typeof v === 'object' && !Array.isArray(v);
      if (objet && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) out[k] = fusion(base[k], v);
      else out[k] = v;
    });
    return out;
  }
  // Paramètres propres à l'entreprise ouverte (même logique que les modèles)
  function cle() {
    var co = '';
    try { co = (typeof CO !== 'undefined' && CO) ? String(CO) : ''; } catch (e) { co = ''; }
    return co ? CLE + '_' + co : CLE;
  }
  // Formules figées (consultation d'un mois clôturé) : le calcul lit alors la copie du mois, jamais les formules en cours
  var GEL = null;
  function reglagesReels() { var g = GEL; GEL = null; try { return clone(charger()); } finally { GEL = g; } }
  function charger() {
    if (GEL) return GEL;
    try {
      var t = root.localStorage && root.localStorage.getItem(cle());
      if (t) {
        var s = JSON.parse(t);
        if (s.regles_version !== DEFAUT.regles_version) { delete s.anciennete; }
        if (s.tdl_version !== DEFAUT.tdl_version) { delete s.tc; }
        // Ancienne formule du CCF (1 % du net imposable tronqué) remplacée par 1 % de la base arrondie : on retire l'ancienne
        var ovr = s.lignes && s.lignes.overrides && s.lignes.overrides['12'];
        if (ovr && ovr.expr === FORMULE_CCF_ANCIENNE) { delete ovr.expr; if (!Object.keys(ovr).length) delete s.lignes.overrides['12']; }
        return fusion(DEFAUT, s);
      }
    } catch (e) {}
    return clone(DEFAUT);
  }
  // Sauvegarde partagée (table parametres, comme les modèles et le pointage) : le navigateur garde une copie locale
  var CLE_PONT = { params: 'hok_params_json', perm: 'hok_perm_json', mois: 'hok_mois_json' };
  function pont() { return root.PRH_paieHok || null; }
  function vers(nom, obj) {
    var p = pont();
    if (p && p.save) Promise.resolve(p.save(CLE_PONT[nom], obj)).catch(function (e) { console.error('Hôtel Océan : sauvegarde base impossible', e); });
  }
  function enregistrer(p) { if (GEL) return; try { root.localStorage && root.localStorage.setItem(cle(), JSON.stringify(p)); } catch (e) {} vers('params', p); }

  // Particularités PERMANENTES par salarié (restent d'un mois à l'autre) : modifiables, supprimables.
  //   ex. prime de caisse récurrente, base CNPS incluant le transport.
  // Particularités DU MOIS (par période) : elles ne sont saisies que si le mois l'exige (congé, retenues fixes,
  //   rappels, ancienneté, logement, assiduité, transport, base CNPS). Sans saisie pour la période, tout est
  //   calculé automatiquement par le modèle. Elles n'affectent que le salarié et la période concernés.
  var PERM_CLE = 'terh_hok_perm', MOIS_CLE = 'terh_hok_mois';
  // Données de chaque mois saisies par l'utilisateur (aucune donnée de salarié dans le code)
  var PERM_DEFAUT = {};
  // Données de chaque mois saisies par l'utilisateur (aucune donnée de salarié dans le code)
  var MOIS_DEFAUT = {};
  function cleCo(base) {
    var co = '';
    try { co = (typeof CO !== 'undefined' && CO) ? String(CO) : ''; } catch (e) { co = ''; }
    return co ? base + '_' + co : base;
  }
  function lire(cle, defaut) {
    try { var t = root.localStorage && root.localStorage.getItem(cle); if (t) return JSON.parse(t); } catch (e) {}
    return clone(defaut);
  }
  function ecrire(cle, obj) { try { root.localStorage && root.localStorage.setItem(cle, JSON.stringify(obj)); } catch (e) {} }
  function chargerPermanentes() { return lire(cleCo(PERM_CLE), PERM_DEFAUT); }
  function chargerMois() { return lire(cleCo(MOIS_CLE), MOIS_DEFAUT); }
  function enregistrerPermanentes(obj) { ecrire(cleCo(PERM_CLE), obj); vers('perm', obj); }
  function enregistrerMois(obj) { ecrire(cleCo(MOIS_CLE), obj); vers('mois', obj); }
  // Lit les trois jeux de données dans la base. Si la base est vide et que ce navigateur a déjà des données,
  // elles sont envoyées à la base (aucune donnée n'est perdue). Sinon la base fait foi.
  function synchroniser() {
    var p = pont();
    if (!p || !p.load) return Promise.resolve(false);
    var noms = ['params', 'perm', 'mois'];
    var locales = { params: cle(), perm: cleCo(PERM_CLE), mois: cleCo(MOIS_CLE) };
    return Promise.all(noms.map(function (n) {
      return Promise.resolve(p.load(CLE_PONT[n])).catch(function () { return null; });
    })).then(function (dist) {
      noms.forEach(function (n, i) {
        var distant = dist[i];
        var local = null;
        try { var t = root.localStorage && root.localStorage.getItem(locales[n]); if (t) local = JSON.parse(t); } catch (e) { local = null; }
        if (distant && typeof distant === 'object' && Object.keys(distant).length) {
          try { root.localStorage && root.localStorage.setItem(locales[n], JSON.stringify(distant)); } catch (e) {}
        } else if (local && typeof local === 'object' && Object.keys(local).length) {
          vers(n, local);
        }
      });
      return true;
    }).catch(function () { return false; });
  }
  // Clé de période : « JJ/MM/AAAA au JJ/MM/AAAA » (le texte du bulletin peut varier)
  function cleperiode(periode) {
    var m = /(\d{1,2}\/\d{1,2}\/\d{2,4})\s+au\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/.exec(String(periode || ''));
    return m ? m[1] + ' au ' + m[2] : String(periode || '').trim();
  }
  // Nom normalisé pour la correspondance : majuscules, sans accents, sans ponctuation
  function nomNorm(x) {
    var t = String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
      .replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    return t.replace(/^(MME|MLLE|MR|M) /, '');   // civilités retirées : « Mme.EKOBO » = « EKOBO »
  }
  // Une clé (ex. « DUPONT J. ») désigne le salarié dont le nom complet commence par elle (ex. « NGONO TSALA ALBERT »).
  // La clé la plus longue qui correspond gagne ; une correspondance à moins de 4 caractères est refusée.
  function cleCorrespond(cle, nom) {
    var ta = nomNorm(cle).split(' '), tb = nomNorm(nom).split(' ');
    if (!ta[0] || !tb[0] || ta[0].length < 3 || ta.length > tb.length) return 0;
    var score = 0;
    for (var i = 0; i < ta.length; i++) {
      var x = ta[i], y = tb[i];
      if (x === y) score += x.length;
      else if (x.length === 1 && y.charAt(0) === x) score += 1;          // initiale : « T » pour « TSALA »
      else return 0;
    }
    return score;
  }
  function trouverCle(obj, nom) {
    var meilleure = null, score = 0;
    Object.keys(obj || {}).forEach(function (k) {
      var c = cleCorrespond(k, nom);
      if (c > score) { score = c; meilleure = k; }
    });
    return meilleure;
  }
  // Rubriques calculées par le modèle Océan qu'on peut corriger pour un salarié et un mois
  // (code -> champ des particularités du mois). Le bulletin reprend la valeur corrigée ; l'effacer rétablit le calcul.
  var CHAMPS_CORRIGEABLES = { '2': 'logement', '3': 'tauxAssiduite', '4': 'transport', '5': 'tauxAnc', '6': 'congeMontant',
    '10': 'irpp', '11': 'cac', '12': 'cfc', '14': 'rav', '15': 'tc', '17': 'fne', '13': 'cnpsBase' };
  var RETENUE_FIXE = { irpp: 1, cac: 1, cfc: 1, rav: 1, tc: 1, fne: 1 };
  // Rubriques du catalogue Sage déjà calculées par le modèle Hôtel Océan : même montant, code Océan.
  // Elles ne s'ajoutent jamais en élément libre (sinon le montant est compté deux fois).
  var EQUIV_OCEAN = { '1435': '2', '1510': '3', '1430': '4', '1202': '5' };
  // Particularités du MOIS retirées (corrections) : seules les valeurs permanentes restent.
  // Sert à calculer le montant automatique, pour le comparer à une correction.
  function particulariteSansCorrection(nom, periode) {
    var p = particularite(nom, periode);
    var perms = chargerPermanentes(), kp = trouverCle(perms, nom), perm = kp ? perms[kp] : {};
    Object.keys(CHAMPS_CORRIGEABLES).forEach(function (code) {
      var champ = CHAMPS_CORRIGEABLES[code];
      if (RETENUE_FIXE[champ]) {
        p.retenues = Object.assign({}, p.retenues);
        if (perm.retenues && perm.retenues[champ] !== undefined) p.retenues[champ] = perm.retenues[champ];
        else delete p.retenues[champ];
      } else if (perm[champ] !== undefined) p[champ] = perm[champ];
      else delete p[champ];
    });
    return p;
  }
  function champCorrigeable(code) { return CHAMPS_CORRIGEABLES.hasOwnProperty(String(code)); }
  // Enregistre (valeur) ou efface (null) la correction d'une rubrique pour un salarié et un mois
  function corrigerRubrique(nom, periode, code, valeur) {
    var champ = CHAMPS_CORRIGEABLES[String(code)];
    if (!champ) return false;
    var store = chargerMois(), cle = cleperiode(periode);
    store[cle] = store[cle] || {};
    var k = trouverCle(store[cle], nom) || String(nom || '').trim();
    var d = store[cle][k] = store[cle][k] || {};
    var vide = (valeur === null || valeur === undefined || valeur === '');
    if (RETENUE_FIXE[champ]) {
      d.retenues = d.retenues || {};
      if (vide) delete d.retenues[champ]; else d.retenues[champ] = nb(valeur);
      if (!Object.keys(d.retenues).length) delete d.retenues;
    } else {
      if (vide) delete d[champ]; else d[champ] = nb(valeur);
    }
    if (!Object.keys(d).length) delete store[cle][k];
    if (!Object.keys(store[cle]).length) delete store[cle];
    enregistrerMois(store);
    return true;
  }
  // Valeur corrigée enregistrée pour ce salarié et ce mois (null si le calcul s'applique)
  function correctionRubrique(nom, periode, code) {
    var champ = CHAMPS_CORRIGEABLES[String(code)];
    if (!champ) return null;
    var mo = particularite(nom, periode);
    if (RETENUE_FIXE[champ]) return (mo.retenues && mo.retenues[champ] !== undefined) ? mo.retenues[champ] : null;
    return (mo[champ] !== undefined) ? mo[champ] : null;
  }
  // Rubriques nulles affichées sur le bulletin pour ce salarié et ce mois (par défaut : masquées)
  function rubriquesAffichees(nom, periode) {
    var mo = chargerMois()[cleperiode(periode)] || {}, k = trouverCle(mo, nom);
    return (k && mo[k] && Array.isArray(mo[k].afficher)) ? mo[k].afficher.slice() : [];
  }
  function afficherRubrique(nom, periode, code, actif) {
    var store = chargerMois(), cle = cleperiode(periode);
    store[cle] = store[cle] || {};
    var k = trouverCle(store[cle], nom) || String(nom || '').trim();
    var d = store[cle][k] = store[cle][k] || {};
    var liste = (Array.isArray(d.afficher) ? d.afficher : []).filter(function (c) { return String(c) !== String(code); });
    if (actif) liste.push(String(code));
    if (liste.length) d.afficher = liste; else delete d.afficher;
    if (!Object.keys(d).length) delete store[cle][k];
    if (!Object.keys(store[cle]).length) delete store[cle];
    enregistrerMois(store);
    return liste;
  }
  // Particularités applicables à un salarié pour une période : permanentes, complétées/remplacées par celles du mois
  function particularite(nom, periode) {
    var perms = chargerPermanentes(), mois = chargerMois()[cleperiode(periode)] || {};
    var kp = trouverCle(perms, nom), km = trouverCle(mois, nom);
    var perm = kp ? perms[kp] : {}, mo = km ? mois[km] : {};
    var out = {};
    Object.keys(perm).forEach(function (c) { out[c] = perm[c]; });
    Object.keys(mo).forEach(function (c) {
      if (c === 'retenues' && out.retenues) { out.retenues = Object.assign({}, out.retenues, mo.retenues); }
      else if (c === 'manuels') { out.manuels = (out.manuels || []).concat(mo.manuels); }
      else out[c] = mo[c];
    });
    return out;
  }

  function nb(x) {
    if (typeof x === 'string') x = x.replace(/\s/g, '').replace(',', '.');
    var n = Number(x);
    return isFinite(n) ? n : 0;
  }
  function tranche(table, s, auDela) {
    for (var i = 0; i < table.length; i++) { if (s <= table[i][0]) return table[i][1]; }
    return auDela;
  }
  // IRPP : formules IF imbriquées du fichier (feuille Salaires, colonne M)
  function irpp(L, p) {
    var I = p.irpp, s = I.seuils, t = I.taux, c = I.cumul, f = I.facteur, ch = I.charge, d = I.deduction;
    if (L <= s[0]) return 0;
    if (L <= s[1]) return (L * f - L * ch - d) * t[0];
    if (L <= s[2]) return c[0] + (L - s[1]) * f * t[1];
    if (L <= s[3]) return c[1] + (L - s[2]) * f * t[2];
    return c[2] + (L - s[3]) * f * t[3];
  }

  // Taux de l'indemnité de congé selon les années complètes d'ancienneté (dernier palier atteint)
  // Taux de présence du mois : 30 jours - absences en jours - absences en heures (base 173,33 h/mois)
  // Retourne une valeur entre 0 et 1 ; 1 si aucune absence saisie.
  function presence(o, p) {
    var jabs = nb(o.joursAbsence), habs = nb(o.heuresAbsence);
    var h = nb(p.absences && p.absences.heures_mois) || 173.33;
    return Math.max(0, Math.min(1, 1 - jabs / 30 - habs / h));
  }
  // ===== Évaluateur de formules (sûr : pas d'eval) =====
  // Opérateurs : + - * / ( ) et comparaisons < > <= >= == ; nombres ; variables ; fonctions.
  // Fonctions : min, max, round, floor, ceil, abs, si(cond, a, b), arrondi250(x), bareme_irpp(x),
  // bareme_rav(x), bareme_tc(x) (barèmes des paramètres).
  function tokeniser(src) {
    var t = [], i = 0, s = String(src || '');
    while (i < s.length) {
      var c = s.charAt(i);
      if (/\s/.test(c)) { i++; continue; }
      var deux = s.substr(i, 2);
      if (deux === '<=' || deux === '>=' || deux === '==') { t.push({ k: 'op', v: deux }); i += 2; continue; }
      if ('+-*/(),<>'.indexOf(c) >= 0) { t.push({ k: 'op', v: c }); i++; continue; }
      var m = /^\d+([.,]\d+)?/.exec(s.slice(i));
      if (m) { t.push({ k: 'num', v: parseFloat(m[0].replace(',', '.')) }); i += m[0].length; continue; }
      m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i));
      if (m) { t.push({ k: 'id', v: m[0] }); i += m[0].length; continue; }
      throw new Error('caractère non reconnu : ' + c);
    }
    return t;
  }
  function evaluerFormule(src, ctx) {
    var t = tokeniser(src), pos = 0;
    function voir() { return t[pos]; }
    function prendre() { return t[pos++]; }
    function attendre(v) { var x = prendre(); if (!x || x.v !== v) throw new Error('« ' + v + ' » attendu'); }
    function comparaison() {
      var a = somme(), x = voir();
      if (x && x.k === 'op' && ['<', '>', '<=', '>=', '=='].indexOf(x.v) >= 0) {
        prendre(); var b = somme(), v = x.v;
        return (v === '<' ? a < b : v === '>' ? a > b : v === '<=' ? a <= b : v === '>=' ? a >= b : a === b) ? 1 : 0;
      }
      return a;
    }
    function somme() {
      var a = produit(), x;
      while ((x = voir()) && x.k === 'op' && (x.v === '+' || x.v === '-')) { prendre(); var b = produit(); a = x.v === '+' ? a + b : a - b; }
      return a;
    }
    function produit() {
      var a = unaire(), x;
      while ((x = voir()) && x.k === 'op' && (x.v === '*' || x.v === '/')) {
        prendre(); var b = unaire(); if (x.v === '/' && b === 0) throw new Error('division par zéro'); a = x.v === '*' ? a * b : a / b;
      }
      return a;
    }
    function unaire() {
      var x = voir();
      if (x && x.k === 'op' && (x.v === '-' || x.v === '+')) { prendre(); var v = unaire(); return x.v === '-' ? -v : v; }
      return primaire();
    }
    var FONCTIONS = {
      min: function () { return Math.min.apply(null, arguments); },
      max: function () { return Math.max.apply(null, arguments); },
      round: function (x) { return Math.round(x); },
      floor: function (x) { return Math.floor(x); },
      ceil: function (x) { return Math.ceil(x); },
      abs: function (x) { return Math.abs(x); },
      si: function (c, a, b) { return c ? a : b; },
      arrondi250: function (x) { return Math.round(x / 250) * 250; },
      bareme_irpp: function (x) { return Math.round(irpp(x, ctx.p)); },
      bareme_rav: function (x) { return tranche(ctx.p.rav.tranches, x, ctx.p.rav.au_dela); },
      bareme_tc: function (x) {
        var p = ctx.p;
        return (p.tc.regle === 'tranche')
          ? Math.min(nb(p.tc.plafond), nb(p.tc.montant) * Math.max(0, Math.floor(x / nb(p.tc.pas)) - nb(p.tc.decalage)))
          : tranche(p.tc.tranches, x, p.tc.au_dela);
      }
    };
    function primaire() {
      var x = prendre();
      if (!x) throw new Error('expression incomplète');
      if (x.k === 'num') return x.v;
      if (x.k === 'op' && x.v === '(') { var v = comparaison(); attendre(')'); return v; }
      if (x.k === 'id') {
        if (voir() && voir().v === '(') {
          prendre();
          var args = [];
          if (!(voir() && voir().v === ')')) { args.push(comparaison()); while (voir() && voir().v === ',') { prendre(); args.push(comparaison()); } }
          attendre(')');
          if (!FONCTIONS.hasOwnProperty(x.v)) throw new Error('fonction inconnue : ' + x.v);
          return FONCTIONS[x.v].apply(null, args);
        }
        if (!Object.prototype.hasOwnProperty.call(ctx.v, x.v)) throw new Error('variable inconnue : ' + x.v);
        return nb(ctx.v[x.v]);
      }
      throw new Error('élément inattendu');
    }
    var r = comparaison();
    if (pos < t.length) throw new Error('élément en trop après la formule');
    return r;
  }
  // Prime d'ancienneté (barème du cours) : 0 % avant le seuil ; taux de départ au seuil, puis + hausse par année révolue
  function tauxAnciennete(ans, p) {
    var a = p.anciennete || {}, n = Math.floor(nb(ans));
    if (n < nb(a.seuil_ans)) return 0;
    var t = nb(a.taux_depart) + nb(a.hausse_par_an) * (n - nb(a.seuil_ans));
    return Math.round(t * 10000) / 10000;
  }
  // Codes réservés du bulletin Océan : avance (26), rappels (29), prime d'ancienneté Sage (1202)
  var CODES_RESERVES = ['26', '29', '1202'];
  // Formules standard (affichées dans l'éditeur ; le calcul est le même que par défaut)
  // Codes affichés : ceux du moteur Océan (1, 2, 10…) ; modifiables dans l'éditeur Océan
  var CODES_DEFAUT = {};
  // Rubriques calculées par le modèle Océan : une ligne de grille ne doit jamais les reprendre (double comptage)
  var CODES_AUTO = ['1', '2', '3', '4', '5', '6', '10', '11', '12', '13', '14', '15', '17', '22', '26', '27', '28', '29'];
  // Liste pour le sélecteur de la grille : rubriques du modèle (auto) et rubriques ajoutées dans les paramètres Océan
  function rubriquesOcean() {
    var lp = charger().lignes || {}, codes = lp.codes || {};
    var auto = CODES_AUTO.map(function (c) {
      var d = FORMULES_DEFAUT[c];
      return { code: String(codes[c] || CODES_DEFAUT[c] || c), lib: d ? d.lib : (c === '26' ? 'Avance sur salaire' : 'Rappels'), auto: true };
    });
    var ajoutees = (lp.ajoutees || []).map(function (r) { return { code: String(r.code), lib: r.lib || '', type: r.type || 'gain', auto: false }; });
    // Catalogue des rubriques du modèle Océan (codes 1, 2, 3, 4…), à proposer dans l'éditeur
    var catalogue = Object.keys(FORMULES_DEFAUT).map(function (c) {
      return { code: String(codes[c] || CODES_DEFAUT[c] || c), lib: FORMULES_DEFAUT[c].lib, type: Number(c) >= 10 ? 'retenue' : 'gain' };
    });
    return { auto: auto, ajoutees: ajoutees, catalogue: catalogue };
  }
  var FORMULES_DEFAUT = {
    '1': { lib: 'Salaire de Base', formule: 'sb', note: 'salaire du mois × présence' },
    '2': { lib: 'Indemnité de Logement', formule: 'p_logement*(smens+anc)', note: '25 % (salaire + ancienneté)' },
    '3': { lib: "Prime d'Assiduité", formule: 'p_assiduite*sb', note: '5 % du salaire ; au prorata de la présence' },
    '4': { lib: 'Indemnité de Transport', formule: 'p_transport*pres', note: 'montant × présence' },
    '5': { lib: "Prime d'Ancienneté", formule: 'taux_anc*smens', note: 'barème du cours : taux de départ au seuil, + hausse par année (paramètres ci-dessous)' },
    '6': { lib: 'Indemnité de Congé', formule: 'conge', note: 'congé pris ce mois' },
    '10': { lib: 'IRPP', formule: 'bareme_irpp(Lirpp)', note: 'barème sur base imposable arrondie à 250' },
    '11': { lib: 'CAC', formule: 'p_cac*irpp', note: '10 % de l\'IRPP' },
    '12': { lib: 'Crédit Foncier du Cameroun', formule: 'si(Lcfc>p_seuil_cfc, round(p_cfc*Lirpp), 0)', note: '1 % de la base imposable arrondie à 250 (impôt)' },
    '13': { lib: 'CNPS', formule: 'cnps', note: '4,2 % de la base CNPS' },
    '14': { lib: 'RAV', formule: 'bareme_rav(L)', note: 'barème RAV' },
    '15': { lib: 'Taxe Communale/TDL', formule: 'bareme_tc(L)', note: 'barème TC' },
    '17': { lib: "Fonds National de l'Emploi", formule: 'fne', note: 'montant de la fiche' },
    '22': { lib: 'Dettes Internes', formule: 'dettes', note: 'montant saisi' },
    '27': { lib: 'Prestation Familiale', formule: 'prestation', note: 'montant saisi' },
    '28': { lib: 'Communard', formule: 'communard', note: 'montant saisi' },
    '26': { lib: 'Avance sur Salaire', formule: 'avance', note: 'montant de la fiche ; toujours imprimée et déduite' },
    '29': { lib: 'Rappels', formule: 'rappel', note: 'montant de la fiche ; toujours imprimée et ajoutée' }
  };
  // Calcul pur. Montants exacts en interne ; les rubriques suivent la définition des paramètres (lignes).
  // Registre des rubriques libres : un libellé garde le même code d'un mois et d'un salarié à l'autre.
  // Un code ne désigne jamais deux libellés. Les libellés nouveaux reçoivent un code libre (ou le code demandé s'il est libre).
  var POOL_REGISTRE = ['7', '8', '9', '16', '18', '19', '20', '21', '23', '24', '25', '30', '31', '32', '33', '34', '35'];
  function memoriserCodes(p, elements) {
    var reg = Object.assign({}, p.codes_libres || {});
    var off = {};
    Object.keys(FORMULES_DEFAUT).forEach(function (c) { off[c] = true; });
    CODES_RESERVES.forEach(function (c) { off[c] = true; });
    (p.lignes && p.lignes.ajoutees || []).forEach(function (r) { off[String(r.code)] = true; });
    var utilise = {};
    Object.keys(reg).forEach(function (k) { utilise[reg[k].code] = k; });
    var changed = false;
    (elements || []).forEach(function (e) {
      var k = String(e.lib || '').trim().toLowerCase();
      if (!k || reg[k]) return;
      var demande = e.code ? String(e.code).trim() : '';
      var code = (demande && !off[demande] && !utilise[demande]) ? demande : null;
      if (!code) {
        for (var i = 0; i < POOL_REGISTRE.length; i++) {
          var c = POOL_REGISTRE[i];
          if (!off[c] && !utilise[c]) { code = c; break; }
        }
      }
      if (!code) return;
      reg[k] = { code: code, lib: String(e.lib).trim() };
      utilise[code] = k;
      changed = true;
    });
    if (!changed) return p;
    var q = Object.assign({}, p, { codes_libres: reg });
    enregistrer(q);
    return q;
  }
  function calculer(o) {
    var p = o.params || charger();
    var lp = p.lignes || {}, ov = lp.overrides || {}, masq = lp.masquees || [], ajout = lp.ajoutees || [];
    var estMasquee = function (c) { return masq.indexOf(String(c)) >= 0; };
    var zeros = lp.zeros || [];
    var estZero = function (c) { return zeros.indexOf(String(c)) >= 0; };
    var codesLp = lp.codes || {};
    var codeAff = function (c) { return String(codesLp[c] || CODES_DEFAUT[c] || c); };
    var sbPlein = nb(o.salaireBase);
    var pres = presence(o, p);
    var sb = sbPlein * pres;
    var ans = nb(o.ansAnciennete);
    if (o.ansAnciennete === undefined && o.dateAnciennete && root.PaieMoteur && root.PaieMoteur.ancienneteDepuis) {
      var a = root.PaieMoteur.ancienneteDepuis(o.dateAnciennete);
      ans = a ? a.ans : 0;
    }
    // Ancienneté et logement : sur le salaire proratisé (formules du modèle)
    var smens = ((o.salaireMensuel !== undefined && o.salaireMensuel !== null && o.salaireMensuel !== '') ? nb(o.salaireMensuel) : sbPlein) * pres;
    // Taux d'ancienneté : celui de la table (années), ou le taux corrigé du mois (pourcentage)
    var tauxAnc = (o.tauxAnc !== undefined && o.tauxAnc !== null && o.tauxAnc !== '') ? nb(o.tauxAnc) : tauxAnciennete(ans, p);
    var ancMontant = (o.ancMontant !== undefined && o.ancMontant !== null && o.ancMontant !== '') ? nb(o.ancMontant) : tauxAnc * smens;
    var logement = (o.logement !== undefined && o.logement !== null && o.logement !== '') ? nb(o.logement) : p.logement.taux * (smens + ancMontant);
    // Prime d'assiduité : 0 en cas d'absence (jours ou heures)
    // Taux d'assiduité (5 % par défaut, ou taux corrigé du mois) appliqué au salaire de base
    var tauxAss = (o.tauxAssiduite !== undefined && o.tauxAssiduite !== null && o.tauxAssiduite !== '') ? nb(o.tauxAssiduite) : p.assiduite.taux;
    var assiduite = (o.assiduite !== undefined && o.assiduite !== null && o.assiduite !== '') ? nb(o.assiduite) : tauxAss * sb;
    // Transport proratisé : montant × présence
    var transport = (o.transport !== undefined && o.transport !== null && o.transport !== '') ? nb(o.transport) : nb(p.transport.montant) * pres;
    // Congé payé (cours et décret 75/28) : congé principal 1,5 jour par mois sur 12 mois = 18 jours,
    // + 2 jours par tranche entière de 5 ans d'ancienneté ; allocation principale = rémunération totale × 1/16 ;
    // jours supplémentaires payés à la valeur d'un jour du congé principal.
    // Rémunération totale approchée par (salaire + logement + ancienneté + assiduité) × 12 mois, hors transport (frais).
    var congeJours = null, congeValeurJour = null, congeCalc = null;
    if (o.congePris) {
      var MOIS_CONGE = 12, principal = Math.ceil(MOIS_CONGE * 1.5), supp = 2 * Math.floor(Math.max(0, ans) / 5);
      // Majoration enfants (mères salariées) : +2 par enfant de moins de 6 ans ; +1 si le congé principal ne dépasse pas 6 jours
      var nEnf = o.mere ? Math.max(0, Math.floor(nb(o.enfants6))) : 0;
      supp += nEnf * (principal <= 6 ? 1 : 2);
      var remunTotale = (sb + logement + assiduite + ancMontant) * MOIS_CONGE;
      var allocPrinc = remunTotale * 1.5 / 24;
      congeValeurJour = allocPrinc / principal;
      congeJours = principal + supp;
      congeCalc = allocPrinc + supp * congeValeurJour;
    }
    var conge = (o.congeMontant !== undefined && o.congeMontant !== null && o.congeMontant !== '') ? nb(o.congeMontant)
      : (congeCalc !== null ? congeCalc : 0);

    // Variables disponibles dans les formules
    var v = {
      sbPlein: sbPlein, sb: sb, pres: pres, smens: smens, ans: ans, taux_anc: tauxAnc, anc: ancMontant,
      logement: logement, assiduite: assiduite, transport: transport, conge: conge,
      p_logement: p.logement.taux, p_assiduite: p.assiduite.taux, p_transport: nb(p.transport.montant),
      p_cnps: p.cnps.taux, p_cac: p.cac.taux, p_cfc: p.cfc.taux, p_abat: p.abattement.taux,
      p_seuil_cfc: nb(p.irpp.seuils[0]), fne: nb(o.fne), dettes: nb(o.dettes), prestation: nb(o.prestation), communard: nb(o.communard)
    };
    var ctx = { v: v, p: p }, erreurs = [];
    function essayer(expr, repli, lib) {
      try { return nb(evaluerFormule(expr, ctx)); }
      catch (e) { erreurs.push((lib || 'Rubrique') + ' : ' + e.message); return repli; }
    }
    // Rubriques de gain standard : formule modifiée (ov) ou masquée (masq)
    var STD_GAIN = [['1', 'sb', sb, 'Salaire de Base', max0(30 * pres), sbPlein / 30, null],
      ['2', 'logement', logement, 'Indemnité de Logement', null, null, null],
      ['3', 'assiduite', assiduite, "Prime d'Assiduité", null, null, tauxAss],
      ['4', 'transport', transport, 'Indemnité de Transport', null, null, null],
      ['5', 'anc', ancMontant, "Prime d'Ancienneté", null, null, tauxAnc || null],
      ['6', 'conge', conge, 'Indemnité de Congé', (congeJours !== null && !(o.congeMontant !== undefined && o.congeMontant !== null && o.congeMontant !== '')) ? congeJours : null, (congeValeurJour !== null && !(o.congeMontant !== undefined && o.congeMontant !== null && o.congeMontant !== '')) ? congeValeurJour : null, null]];
    function max0(x) { return Math.max(0, x); }
    // Lignes n'apparaissant que si un montant est saisi : congé (6), dettes (22), avance (26), rappel (29)
    var NON_SI_ZERO = { '6': true, '22': true, '26': true, '29': true };
    var gains = [];
    STD_GAIN.forEach(function (g) {
      var code = g[0], varNom = g[1], val = g[2];
      if (ov[code] && ov[code].expr) { val = essayer(ov[code].expr, val, g[3]); }
      if (estZero(code)) val = 0;               // affichée à 0 : non payée, ne compte pas
      v[varNom] = val; if (code === '1') v.sb = val;
      if (code === '5') v.anc = val;
      if (estMasquee(code)) return;
      // Indemnité de congé : n'apparaît que si elle est due ce mois (sauf affichage à 0 choisi dans les paramètres)
      if (NON_SI_ZERO[code] && !nb(val) && !estZero(code)) return;
      gains.push({ code: codeAff(code), lib: (ov[code] && ov[code].lib) || g[3], nombre: g[4], base: g[5], taux: g[6], gain: val, src: 'Modèle Océan' });
    });
    // Éléments libres (saisis à la main) puis rubriques ajoutées dans les paramètres
    var libres = [];
    // Codes : un élément libre ne reprend jamais un code déjà utilisé (rubrique standard, réservée, ajoutée ou libre)
    var pris = {};
    Object.keys(FORMULES_DEFAUT).forEach(function (c) { pris[c] = true; });
    CODES_RESERVES.forEach(function (c) { pris[c] = true; });
    ajout.forEach(function (r) { pris[String(r.code)] = true; });
    var POOL_LIBRE = ['7', '8', '9', '16', '18', '19', '20', '21', '23', '24', '25', '30', '31', '32', '33', '34', '35'];
    var reg = p.codes_libres || {};
    function codeLibre(demande, lib) {
      var rg = reg[String(lib || '').trim().toLowerCase()];
      if (rg && !pris[rg.code]) { pris[rg.code] = true; return rg.code; }   // même libellé = même code, pour tous les salariés
      var c = (demande === undefined || demande === null) ? '' : String(demande).trim();
      if (c && !pris[c]) { pris[c] = true; return c; }
      for (var i = 0; i < POOL_LIBRE.length; i++) {
        if (!pris[POOL_LIBRE[i]]) { pris[POOL_LIBRE[i]] = true; return POOL_LIBRE[i]; }
      }
      return c;
    }
    (o.manuels || []).forEach(function (m) {
      var g = { code: codeLibre(m.code, m.lib), lib: m.lib || 'Élément complémentaire', nombre: null, base: null, taux: null, gain: nb(m.gain), src: m.src || 'Saisie' };
      gains.push(g); libres.push({ gain: g.gain, cnps: m.cnps, irpp: m.irpp, cfc: m.cfc });
    });
    ajout.forEach(function (r) {
      if (r.type === 'retenue') return;
      var val = essayer(r.expr, 0, r.lib);
      v['R' + r.code] = val;
      var g = { code: String(r.code), lib: r.lib || 'Rubrique', nombre: null, base: null, taux: null, gain: val, src: 'Paramètres Océan' };
      gains.push(g); libres.push({ gain: val, cnps: r.cnps, irpp: r.irpp, cfc: r.cfc });
    });

    var brut = gains.reduce(function (t, g) { return t + g.gain; }, 0);
    var nonCnps = libres.reduce(function (t, m) { return t + (m.cnps === false ? nb(m.gain) : 0); }, 0);
    var nonIrpp = libres.reduce(function (t, m) { return t + (m.irpp === false ? nb(m.gain) : 0); }, 0);
    // Hors base CFC : seulement les éléments déjà retenus dans la base IRPP ne sont pas comptés deux fois
    var nonCfc = libres.reduce(function (t, m) { return t + ((m.cfc === false && m.irpp !== false) ? nb(m.gain) : 0); }, 0);
    // Base CNPS : brut sans transport (sauf particularité), moins les libres non cotisables, plafond si défini
    // Transport masqué : non payé, donc rien à retrancher de la base CNPS
    var transportPaye = (estMasquee('4') || estZero('4')) ? 0 : transport;
    var K = brut - nonCnps - transportPaye * nb(p.transport.exclu_cnps);
    if (o.cnpsInclutTransport) K = brut - nonCnps;
    if (o.cnpsBase !== undefined && o.cnpsBase !== null && o.cnpsBase !== '') K = nb(o.cnpsBase);
    if (p.cnps.plafond) K = Math.min(K, nb(p.cnps.plafond));
    var cnps = p.cnps.taux * K;
    // Base imposable (IRPP) : brut hors libres non imposables, × abattement, − CNPS
    var L = (brut - nonIrpp) * p.abattement.taux - cnps;
    var Lirpp = Math.round(L / 250) * 250;
    var irppMontant = Math.round(irpp(Lirpp, p));
    var cac = p.cac.taux * irppMontant;
    // Base CFC : hors libres non soumises à la CFC
    var Lcfc = (brut - nonIrpp - nonCfc) * p.abattement.taux - cnps;
    // CCF = 1 % de la base imposable arrondie à 250 (base de calcul du barème, cf. bulletins de septembre 2026)
    var cfc = Lcfc <= p.irpp.seuils[0] ? 0 : Math.round(p.cfc.taux * Lirpp);
    // Charges patronales : taux du paramétrage sur la base CNPS (K) et la base CFC (Lcfc), arrondis par ligne
    var PP = p.patronales || DEFAUT.patronales;
    var patr = {
      cnps: Math.round(nb(PP.cnps) / 100 * K), at: Math.round(nb(PP.at) / 100 * K), pf: Math.round(nb(PP.pf) / 100 * K),
      fne: Math.round(nb(PP.fne) / 100 * K), cfc: Math.round(nb(PP.cfc) / 100 * Math.max(0, Lcfc))
    };
    var totalPatr = patr.cnps + patr.at + patr.pf + patr.fne + patr.cfc;
    var rav = tranche(p.rav.tranches, L, p.rav.au_dela);
    var tc = (p.tc.regle === 'tranche')
      ? Math.min(nb(p.tc.plafond), nb(p.tc.montant) * Math.max(0, Math.floor(L / nb(p.tc.pas)) - nb(p.tc.decalage)))
      : tranche(p.tc.tranches, L, p.tc.au_dela);
    // Salarié exonéré des retenues fiscales (bulletin sans IRPP, CAC, CFC, RAV, TC)
    if (o.exonere) { irppMontant = 0; cac = 0; cfc = 0; rav = 0; tc = 0; }
    // Variables des retenues
    Object.assign(v, { K: K, L: L, Lirpp: Lirpp, Lcfc: Lcfc, brut: brut, cnps: cnps, irpp: irppMontant, cac: cac, cfc: cfc, rav: rav, tc: tc });

    // Retenues standard : libellés et bases du bulletin ; formule modifiée ou masquée
    var STD_RET = [
      ['10', 'IRPP', L, null, irppMontant, 'irpp'],
      ['11', 'CAC', null, null, cac, 'cac'],
      ['12', 'Crédit Foncier du Cameroun', L, p.cfc.taux, cfc, 'cfc'],
      ['17', "Fonds National de l'Emploi", null, null, nb(o.fne), 'fne'],
      ['13', 'CNPS', K, p.cnps.taux, cnps, 'cnps'],
      ['14', 'RAV', null, null, rav, 'rav'],
      ['15', 'Taxe Communale/TDL', null, null, tc, 'tc'],
      ['22', 'Dettes Internes', null, null, nb(o.dettes), 'dettes'],
      ['27', 'Prestation Familiale', null, null, nb(o.prestation), 'prestation'],
      ['28', 'Communard', null, null, nb(o.communard), 'communard']
    ];
    var retenues = [];
    STD_RET.forEach(function (r) {
      var code = r[0], val = r[4];
      if (ov[code] && ov[code].expr && !o.exonere) { val = essayer(ov[code].expr, val, r[1]); }
      if (estZero(code)) val = 0;
      v[r[5]] = val;
      if (estMasquee(code)) return;
      // Dettes internes : n'apparaît que si un montant est saisi (sauf affichage à 0 choisi dans les paramètres)
      if (NON_SI_ZERO[code] && !nb(val) && !estZero(code)) return;
      retenues.push({ code: codeAff(code), lib: (ov[code] && ov[code].lib) || r[1], base: r[2], taux: r[3], ret: val, src: 'Modèle Océan' });
    });
    (o.retenuesManuelles || []).forEach(function (r) {
      retenues.push({ code: codeLibre(r.code, r.lib), lib: r.lib || 'Retenue', base: null, taux: null, ret: nb(r.ret), src: 'Saisie' });
    });
    ajout.forEach(function (r) {
      if (r.type !== 'retenue') return;
      var val = essayer(r.expr, 0, r.lib);
      retenues.push({ code: String(r.code), lib: r.lib || 'Retenue', base: null, taux: null, ret: val, src: 'Paramètres Océan' });
    });

    // Retenues saisies à la main (particularités) : remplacent le calcul ; CAC = 10 % de l'IRPP si non saisie
    var fixes = o.retenues || {};
    var parCode = function (c) { return retenues.filter(function (r) { return r.code === c; })[0]; };
    var CODE_FIXE = { '10': 'irpp', '11': 'cac', '12': 'cfc', '17': 'fne', '14': 'rav', '15': 'tc' };
    retenues.forEach(function (r) {
      var k = CODE_FIXE[r.code];
      if (k && fixes[k] !== undefined && fixes[k] !== null && fixes[k] !== '') r.ret = nb(fixes[k]);
    });
    if (fixes.irpp !== undefined && (fixes.cac === undefined || fixes.cac === null) && parCode('11')) parCode('11').ret = 0.1 * nb(fixes.irpp);
    var sommeRet = retenues.reduce(function (t, r) { return t + r.ret; }, 0);
    var rappel = nb(o.rappel), avance = nb(o.avance);
    v.rappel = rappel; v.avance = avance;
    if (ov['29'] && ov['29'].expr) rappel = essayer(ov['29'].expr, rappel, 'Rappels');
    if (ov['26'] && ov['26'].expr) avance = essayer(ov['26'].expr, avance, 'Avance sur salaire');
    if (estZero('29')) rappel = 0;
    if (estZero('26')) avance = 0;
    var netCalc = brut + rappel - sommeRet - avance;
    var val = function (c) { var r = parCode(c); return r ? r.ret : 0; };
    return {
      entreprise: Object.assign({}, p.entreprise, (root.PRH_entrepriseInfos ? root.PRH_entrepriseInfos() : {})),
      gains: gains,
      retenues: retenues,
      brut: Math.round(brut),
      cnpsBase: Math.round(K),
      baseImposable: Math.round(L),
      ansAnciennete: ans,
      congePris: !!o.congePris,
      totalRetenues: sommeRet,
      patronales: patr, totalPatronales: totalPatr,
      // Net imposable : brut hors éléments libres non imposables ; coût employeur = brut + charges patronales (définition Sage)
      netImposable: Math.round(brut - nonIrpp),
      coutEmployeur: Math.round(brut) + totalPatr,
      rappel: rappel, avance: avance,
      // Rubriques validées « Afficher à 0 » (Paramètres Océan) : seules imprimées quand leur montant est nul
      zeros: (lp.zeros || []).map(String),
      libRappel: (ov['29'] && ov['29'].lib) || 'Rappels', libAvance: (ov['26'] && ov['26'].lib) || 'Avance sur Salaire',
      net: netCalc,
      erreurs: erreurs,
      exact: { brut: brut, retenues: sommeRet, net: netCalc,
        irpp: val('10'), cac: val('11'), cnps: val('13'), cfc: val('12'), rav: val('14'), tc: val('15') }
    };
  }
  // Date saisie (JJ/MM/AAAA, JJ/MM/AA ou AAAA-MM-JJ) -> jours depuis 1970, ou null
  function dateSaisie(s) {
    var t = String(s || '').trim(), m;
    if ((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t))) return Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000;
    if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(t))) {
      var y = +m[3]; if (y < 100) y += 2000;
      return Date.UTC(y, +m[2] - 1, +m[1]) / 86400000;
    }
    return null;
  }
  // Congé pris = dates du congé qui chevauchent la période du bulletin
  function congePrisSurPeriode(conges, periode) {
    var c = conges || {};
    var du = dateSaisie(c.du), au = dateSaisie(c.au);
    var m = /(\d{1,2}\/\d{1,2}\/\d{2,4})\s+au\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/.exec(String(periode || ''));
    if (du === null || au === null || !m) return false;
    return du <= dateSaisie(m[2]) && au >= dateSaisie(m[1]);
  }

  // Congé de la période : (1) saisi pour le mois, (2) congé approuvé de la plateforme qui chevauche la période,
  // (3) sinon congé par défaut au mois d'anniversaire de l'embauche (à partir d'un an de service),
  // sauf si un congé est déjà programmé pendant cette année de congé.
  var STATUTS_CONGE = ['approuve', 'approuvee', 'planifie', 'planifiee', 'termine', 'terminee', 'en cours'];
  function statutCongeValide(s) {
    var t = String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    return STATUTS_CONGE.indexOf(t) >= 0;
  }
  function congePourPeriode(o, f) {
    if (congePrisSurPeriode(o.conges, o.periode)) return true;
    var m = /(\d{1,2}\/\d{1,2}\/\d{2,4})\s+au\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/.exec(String(o.periode || ''));
    if (!m) return false;
    var debut = dateSaisie(m[1]), fin = dateSaisie(m[2]);
    if (debut === null || fin === null) return false;
    var liste = (o.congesPlateforme || []).filter(function (c) {
      return statutCongeValide(c.statut) && dateSaisie(c.du) !== null && dateSaisie(c.au) !== null;
    });
    if (liste.some(function (c) { return dateSaisie(c.du) <= fin && dateSaisie(c.au) >= debut; })) return true;
    var h = dateSaisie(f.dane || f.entree);
    if (h === null) return false;
    var hd = new Date(h * 86400000), pd = new Date(debut * 86400000);
    if (pd.getUTCMonth() !== hd.getUTCMonth()) return false;
    if (pd.getUTCFullYear() - hd.getUTCFullYear() < 1) return false;
    var anniv = Date.UTC(pd.getUTCFullYear(), hd.getUTCMonth(), hd.getUTCDate()) / 86400000;
    var suivant = Date.UTC(pd.getUTCFullYear() + 1, hd.getUTCMonth(), hd.getUTCDate()) / 86400000;
    return !liste.some(function (c) { var d = dateSaisie(c.du); return d >= anniv && d < suivant; });
  }
  // Calcul à partir de la fiche employé et des lignes saisies à la main (bulletin imprimé)
  function depuisLignes(o) {
    var lignes = o.lignes || [], f = o.fiche || {};
    var l1000 = lignes.filter(function (l) { return String(l.code) === '1000'; })[0];
    // Salaire de base : saisi explicitement dans la grille pour le mois, sinon celui de la fiche
    var sb = (o.presence && o.presence.base) ? nb(o.presence.base) : (nb(f.sb) || (l1000 ? (nb(l1000.gain) || nb(l1000.nombre) * nb(l1000.base)) : 0));
    var gain = function (l) { return root.PaieMoteur && root.PaieMoteur.gainLigne ? root.PaieMoteur.gainLigne(l) : nb(l.gain); };
    // 5 (ancienneté) et 1202 (prime d'ancienneté du modèle Sage) sont calculées ici : jamais reprises comme élément libre
    var CODES_FIXES = ['1000', '26', '29', '17', '22', '27', '28', '5', '1202'];
    var lig = function (code) { return lignes.filter(function (l) { return String(l.code) === code; })[0]; };
    var montantLig = function (code) { var l = lig(code); return l ? nb(root.PaieMoteur && PaieMoteur.gainLigne ? PaieMoteur.gainLigne(l) : l.gain) : 0; };
    // Éléments libres : lignes saisies à la main et lignes de la grille (heures sup., rubriques ajoutées).
    // Le salaire de base (1000) reste calculé par le moteur à partir de la fiche et des absences.
    var estLibre = function (l) { return (!l.auto || l.grille || l.fiche) && !l.retenue && String(l.code) !== '1000' && CODES_FIXES.indexOf(String(l.code)) < 0 && CODES_AUTO.indexOf(String(l.code)) < 0 && !EQUIV_OCEAN[String(l.code)]; };
    var manuels = lignes.filter(estLibre)
      .map(function (l) { return { code: String(l.code), lib: l.lib || '', gain: gain(l), cnps: l.cnps !== false, irpp: l.irpp !== false, cfc: l.cfc !== false, src: l.grille ? 'Grille' : (l.fiche ? 'Fiche' : 'Saisie') }; });
    var retenuesManuelles = lignes.filter(function (l) { return !l.auto && l.retenue && CODES_FIXES.indexOf(String(l.code)) < 0 && CODES_AUTO.indexOf(String(l.code)) < 0; })
      .map(function (l) { return { code: String(l.code), lib: l.lib || '', ret: gain(l) }; });
    var part = o.sansCorrections ? particulariteSansCorrection(f.nom || o.nom, o.periode) : particularite(f.nom || o.nom, o.periode);
    var libres = manuels.concat(part.manuels || []).map(function (m) { return { code: m.code, lib: m.lib }; })
      .concat(retenuesManuelles.map(function (r) { return { code: r.code, lib: r.lib }; }));
    var pCodes = memoriserCodes(charger(), libres);
    return calculer({
      manuels: manuels.concat((part.manuels || []).map(function (m) { return Object.assign({}, m, { src: 'Particularité du mois' }); })),
      ancMontant: undefined, tauxAnc: part.tauxAnc, congeMontant: part.congeMontant, cnpsInclutTransport: part.cnpsInclutTransport,
      cnpsBase: part.cnpsBase, retenues: part.retenues,
      logement: (f.logement !== undefined && f.logement !== '') ? f.logement : part.logement,
      salaireBase: sb,
      transport: (f.transport !== undefined && f.transport !== '') ? f.transport : undefined,
      ansAnciennete: (f.ans !== undefined && f.ans !== '') ? nb(f.ans) : undefined,
      salaireMensuel: (f.smens !== undefined && f.smens !== '') ? f.smens : undefined,
      exonere: !!f.exonere,
      rappel: (f.rappel !== undefined && f.rappel !== '') ? f.rappel : (part.rappel !== undefined ? part.rappel : montantLig('29')),
      avance: (f.avance !== undefined && f.avance !== '') ? f.avance : (part.avance !== undefined ? part.avance : montantLig('26')),
      fne: (f.fne !== undefined && f.fne !== '') ? f.fne : montantLig('17'),
      dettes: (f.dettes !== undefined && f.dettes !== '') ? f.dettes : montantLig('22'),
      prestation: (f.prestation !== undefined && f.prestation !== '') ? f.prestation : montantLig('27'),
      communard: (f.communard !== undefined && f.communard !== '') ? f.communard : montantLig('28'),
      assiduite: (f.assiduite !== undefined && f.assiduite !== '') ? f.assiduite : undefined, tauxAssiduite: part.tauxAssiduite,
      joursAbsence: (f.jabs !== undefined && f.jabs !== '') ? f.jabs : (o.presence && o.presence.joursAbsence), heuresAbsence: (f.habs !== undefined && f.habs !== '') ? f.habs : (o.presence && o.presence.heuresAbsence),
      dateAnciennete: f.dane || f.entree || '',
      transport: (f.transport !== undefined && f.transport !== '') ? f.transport : part.transport,
      congePris: congePourPeriode(o, f),
      congesPlateforme: o.congesPlateforme,
      enfants6: (f.enfants && f.enfants.length && root.PaieEnfants)
        ? root.PaieEnfants.moins6ans(f.enfants, root.PaieEnfants.finPeriode(o.periode)) : f.enfants6,
      mere: String(f.genre || '').toUpperCase() === 'F',
      retenuesManuelles: retenuesManuelles,
      params: pCodes
    });
  }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // Fenêtre de paramètres : JSON modifiable ; les paramètres ajoutés sont conservés
  // ===== Éditeur des rubriques et formules (fenêtre Paramètres Hôtel Océan) =====
  var VARIABLES_AIDE = 'sbPlein, sb (salaire × présence), pres (présence), smens, ans, taux_anc, anc, logement, assiduite, transport, conge, ' +
    'brut, K (base CNPS), L (base imposable), Lirpp, Lcfc (base CFC), cnps, irpp, cac, cfc, rav, tc, fne, dettes, prestation, communard, ' +
    'p_logement, p_assiduite, p_transport, p_cnps, p_cac, p_cfc, p_abat, p_seuil_cfc, rappel, avance, R<code> (rubrique ajoutée). ' +
    'Fonctions : min, max, round, floor, ceil, abs, si(condition, a, b), arrondi250, bareme_irpp, bareme_rav, bareme_tc. ' +
    'Opérateurs : + - * / et < > <= >= ==.';
  function ligneAjout(r) {
    r = r || { code: '', lib: '', type: 'gain', expr: '', cnps: true, irpp: true, cfc: true };
    // Rubrique ancienne (sans nature enregistrée) : « Personnalisée », pour ne pas afficher une nature inexacte
    var nat = r.nature || (r.code === undefined || r.code === '' ? 'salaire' : 'personnalisee');
    return '<tr data-add><td><input data-acode value="' + esc(r.code) + '" style="width:56px"></td>' +
      '<td><input data-alib value="' + esc(r.lib) + '" style="width:100%"></td>' +
      '<td><select data-atype><option value="gain"' + (r.type !== 'retenue' ? ' selected' : '') + '>Gain</option>' +
      '<option value="retenue"' + (r.type === 'retenue' ? ' selected' : '') + '>Retenue</option></select></td>' +
      '<td><select data-anat style="width:100%">' +
        '<option value="salaire"' + (nat === 'salaire' ? ' selected' : '') + '>Salaire / accessoire (imposable, cotisable)</option>' +
        '<option value="transport"' + (nat === 'transport' ? ' selected' : '') + '>Prime de transport (imposable, non cotisable)</option>' +
        '<option value="remboursement"' + (nat === 'remboursement' ? ' selected' : '') + '>Remboursement de frais (non imposable, non cotisable)</option>' +
        '<option value="personnalisee"' + (nat === 'personnalisee' ? ' selected' : '') + '>Personnalisée</option></select></td>' +
      '<td><input data-aexpr value="' + esc(r.expr) + '" style="width:100%;font:12px Consolas,monospace"></td>' +
      '<td style="text-align:center"><input type="checkbox" data-acnps' + (r.cnps !== false ? ' checked' : '') + '></td>' +
      '<td style="text-align:center"><input type="checkbox" data-airpp' + (r.irpp !== false ? ' checked' : '') + '></td>' +
      '<td style="text-align:center"><input type="checkbox" data-acfc' + (r.cfc !== false ? ' checked' : '') + '></td>' +
      '<td><button type="button" data-x="suppr">✕</button></td></tr>';
  }
  function editeurRubriques(lp) {
    lp = lp || {};
    var ovr = lp.overrides || {}, masq = lp.masquees || [], ajout = lp.ajoutees || [];
    var std = Object.keys(FORMULES_DEFAUT).sort(function (a, b) { return +a - +b; }).map(function (c) {
      var d = FORMULES_DEFAUT[c], f = (ovr[c] && ovr[c].expr) || d.formule, lib = (ovr[c] && ovr[c].lib) || d.lib;
      var codeAf = (lp.codes && lp.codes[c]) || CODES_DEFAUT[c] || c;
      return '<tr data-std="' + c + '"><td><input data-code value="' + esc(codeAf) + '" style="width:64px"></td><td><input data-lib value="' + esc(lib) + '" style="width:100%"></td>' +
        '<td><input data-expr value="' + esc(f) + '" style="width:100%;font:12px Consolas,monospace"></td>' +
        '<td><select data-etat style="width:100%">' +
          '<option value="normal"' + (masq.indexOf(c) < 0 && (lp.zeros || []).indexOf(c) < 0 ? ' selected' : '') + '>Normal</option>' +
          '<option value="zero"' + ((lp.zeros || []).indexOf(c) >= 0 ? ' selected' : '') + '>Afficher à 0 (non payée)</option>' +
          (c === '26' || c === '29' ? '' : '<option value="masque"' + (masq.indexOf(c) >= 0 ? ' selected' : '') + '>Ne pas afficher</option>') + '</select></td>' +
        '<td style="color:#666;font-size:11px">' + esc(d.note) + '</td></tr>';
    }).join('');
    return '<table style="width:100%;border-collapse:collapse;font-size:12px" data-tabstd><thead><tr style="background:#eef2f8">' +
      '<th style="text-align:left">Code</th><th style="text-align:left">Libellé</th><th style="text-align:left">Formule</th><th>Affichage</th><th style="text-align:left">Par défaut</th></tr></thead><tbody>' +
      std + '</tbody></table>' +
      '<div style="font-weight:700;margin-top:10px">Rubriques ajoutées</div>' +
      '<table style="width:100%;border-collapse:collapse;font-size:12px" data-tabajout><thead><tr style="background:#eef2f8">' +
      '<th style="text-align:left">Code</th><th style="text-align:left">Libellé</th><th>Type</th><th style="text-align:left">Formule</th>' +
      '<th>Nature</th><th>CNPS</th><th>IRPP</th><th>CFC</th><th></th></tr></thead><tbody>' + ajout.map(ligneAjout).join('') + '</tbody></table>' +
      '<div><button type="button" data-x="ajouter">+ Ajouter une rubrique</button></div>' +
      '<div style="color:#555;font-size:11px;margin-top:4px">Variables : ' + esc(VARIABLES_AIDE) + '</div>';
  }
  // Lit l'éditeur et renvoie les rubriques (lignes), ou une erreur
  function lireRubriques(ov) {
    var ovr = {}, masq = [], zeros = [], ajout = [], codes = {}, vus = {};
    var std = ov.querySelectorAll('[data-std]');
    Array.prototype.forEach.call(std, function (tr) {
      var c = tr.getAttribute('data-std'), d = FORMULES_DEFAUT[c];
      var f = tr.querySelector('[data-expr]').value.trim(), lib = tr.querySelector('[data-lib]').value.trim();
      var o = {};
      if (f && f !== d.formule) o.expr = f;
      if (lib && lib !== d.lib) o.lib = lib;
      if (Object.keys(o).length) ovr[c] = o;
      var cd = tr.querySelector('[data-code]').value.trim();
      if (cd && cd !== (CODES_DEFAUT[c] || c)) codes[c] = cd;
      var etat = tr.querySelector('[data-etat]').value;
      if (etat === 'masque') masq.push(c);
      if (etat === 'zero') zeros.push(c);
    });
    var lignes = ov.querySelectorAll('[data-add]'), codes = {};
    for (var i = 0; i < lignes.length; i++) {
      var tr = lignes[i];
      var code = tr.querySelector('[data-acode]').value.trim(), expr = tr.querySelector('[data-aexpr]').value.trim();
      var lib = tr.querySelector('[data-alib]').value.trim(), type = tr.querySelector('[data-atype]').value;
      if (!code && !expr && !lib) continue;
      if (!code) throw new Error('rubrique « ' + lib + ' » : code manquant');
      if (FORMULES_DEFAUT[code]) throw new Error('code ' + code + ' déjà utilisé par une rubrique standard');
      if (CODES_RESERVES.indexOf(String(code)) >= 0) throw new Error('code ' + code + ' réservé (avance, rappels ou prime d\'ancienneté)');
      if (codes[code]) throw new Error('code ' + code + ' en double');
      codes[code] = true;
      ajout.push({ code: code, lib: lib || 'Rubrique', type: type, expr: expr, nature: tr.querySelector('[data-anat]') ? tr.querySelector('[data-anat]').value : 'personnalisee',
        cnps: tr.querySelector('[data-acnps]').checked, irpp: tr.querySelector('[data-airpp]').checked, cfc: tr.querySelector('[data-acfc]').checked });
    }
    // Codes uniques sur le bulletin : rubriques standard affichées + rubriques ajoutées
    var vu = {};
    Object.keys(FORMULES_DEFAUT).forEach(function (c) {
      if (masq.indexOf(c) >= 0) return;
      var cc = codes[c] || CODES_DEFAUT[c] || c;
      if (vu[cc]) throw new Error('code ' + cc + ' en double');
      vu[cc] = true;
    });
    ajout.forEach(function (r) {
      if (vu[r.code]) throw new Error('code ' + r.code + ' déjà utilisé');
      vu[r.code] = true;
    });
    return { overrides: ovr, masquees: masq, zeros: zeros, codes: codes, ajoutees: ajout };
  }
  // Vérifie chaque formule sur un salaire d'exemple avant enregistrement
  function verifierRubriques(lp, p) {
    var pt = clone(p); pt.lignes = lp;
    var r = calculer({ salaireBase: 100000, ansAnciennete: 3, congePris: false, params: pt });
    return r.erreurs || [];
  }
  // Paramètres généraux affichés en champs : chemin dans les paramètres, libellé, type de saisie.
  // Seule la présentation est décrite ici ; les valeurs sont celles des paramètres enregistrés.
  var CHAMPS_GENERAUX = [
    ['Logement — taux', 'logement.taux', 'pct'],
    ['Assiduité — taux', 'assiduite.taux', 'pct'],
    ['Transport — montant mensuel (FCFA)', 'transport.montant', 'num'],
    ['Heures de référence par mois', 'absences.heures_mois', 'num'],
    ['CNPS salarié — taux', 'cnps.taux', 'pct'],
    ['CNPS — plafond (vide = aucun)', 'cnps.plafond', 'numvide'],
    ['Abattement — taux', 'abattement.taux', 'pct'],
    ['IRPP — seuils (FCFA ; séparés par ;)', 'irpp.seuils', 'liste'],
    ['IRPP — taux par tranche (% ; séparés par ;)', 'irpp.taux', 'listepct'],
    ['IRPP — cumuls (FCFA ; séparés par ;)', 'irpp.cumul', 'liste'],
    ['IRPP — facteur', 'irpp.facteur', 'num'],
    ['IRPP — charge', 'irpp.charge', 'pct'],
    ['IRPP — déduction (FCFA)', 'irpp.deduction', 'num'],
    ['CAC — taux (% de l’IRPP)', 'cac.taux', 'pct'],
    ['CFC salarié — taux', 'cfc.taux', 'pct'],
    ['CNPS patronale (%)', 'patronales.cnps', 'num'],
    ['Accidents du travail (%)', 'patronales.at', 'num'],
    ['Prestations familiales (%)', 'patronales.pf', 'num'],
    ['FNE (%)', 'patronales.fne', 'num'],
    ['CFC patronal (%)', 'patronales.cfc', 'num'],
    ['RAV — tranches (base:montant ; …)', 'rav.tranches', 'tranches'],
    ['RAV — au-delà (FCFA)', 'rav.au_dela', 'num'],
    ['TDL — tranches (base:montant ; …)', 'tc.tranches', 'tranches'],
    ['TDL — au-delà (FCFA)', 'tc.au_dela', 'num']
  ];
  function lirePath(o, chemin) { return chemin.split('.').reduce(function (x, k) { return x == null ? undefined : x[k]; }, o); }
  function poserPath(o, chemin, v) {
    var ks = chemin.split('.'), x = o;
    ks.slice(0, -1).forEach(function (k) { x[k] = x[k] || {}; x = x[k]; });
    x[ks[ks.length - 1]] = v;
  }
  // Valeur enregistrée -> texte affiché (taux stockés en fraction, affichés en %)
  function versTexte(v, type) {
    if (v == null) return '';
    if (type === 'pct') return String(+(nb(v) * 100).toFixed(6));
    if (type === 'listepct') return (v || []).map(function (x) { return String(+(nb(x) * 100).toFixed(6)); }).join(' ; ');
    if (type === 'liste') return (v || []).join(' ; ');
    if (type === 'tranches') return (v || []).map(function (t) { return t.join(':'); }).join(' ; ');
    return String(v);
  }
  // Texte saisi -> valeur enregistrée ; lève une erreur si la saisie n'est pas valide
  function depuisTexte(t, type, libelle) {
    t = String(t == null ? '' : t).trim();
    var nombre = function (s) {
      var n = Number(String(s).replace(',', '.').trim());
      if (String(s).trim() === '' || !isFinite(n)) throw new Error(libelle + ' : valeur numérique attendue');
      return n;
    };
    if (type === 'numvide') return t === '' ? null : nombre(t);
    if (type === 'num') return nombre(t);
    if (type === 'pct') return +(nombre(t) / 100).toFixed(10);
    var morceaux = t === '' ? [] : t.split(';').map(function (s) { return s.trim(); }).filter(function (s) { return s !== ''; });
    if (type === 'liste') return morceaux.map(nombre);
    if (type === 'listepct') return morceaux.map(function (s) { return +(nombre(s) / 100).toFixed(10); });
    if (type === 'tranches') return morceaux.map(function (s) {
      var c = s.split(':');
      if (c.length !== 2) throw new Error(libelle + ' : format « base:montant » attendu');
      return [nombre(c[0]), nombre(c[1])];
    });
    return t;
  }
  function champsGeneraux(p) {
    return CHAMPS_GENERAUX.map(function (c) {
      return '<label style="font-size:12px;display:flex;flex-direction:column;gap:2px"><span>' + esc(c[0]) + '</span>' +
        '<input data-gen="' + esc(c[1]) + '" data-type="' + c[2] + '" data-lib="' + esc(c[0]) + '" value="' + esc(versTexte(lirePath(p, c[1]), c[2])) +
        '" style="padding:4px 6px;border:1px solid #9aa5b5;border-radius:4px"></label>';
    }).join('');
  }
  function remplirGeneraux(ov, p) {
    ov.querySelectorAll('[data-gen]').forEach(function (inp) {
      inp.value = versTexte(lirePath(p, inp.getAttribute('data-gen')), inp.getAttribute('data-type'));
    });
  }
  function lireGeneraux(ov) {
    var out = {};
    ov.querySelectorAll('[data-gen]').forEach(function (inp) {
      poserPath(out, inp.getAttribute('data-gen'), depuisTexte(inp.value, inp.getAttribute('data-type'), inp.getAttribute('data-lib')));
    });
    return out;
  }
  // Enregistre aussitôt les paramètres saisis (taux, barèmes, formules, ancienneté) : les bulletins ouverts se recalculent
  function sauverDirect(ov) {
    var msg = ov.querySelector('[data-msg]');
    try {
      var p = fusion(charger(), lireGeneraux(ov));
      p.anciennete = {
        seuil_ans: nb(ov.querySelector('[data-anc-seuil]').value),
        taux_depart: nb(ov.querySelector('[data-anc-depart]').value) / 100,
        hausse_par_an: nb(ov.querySelector('[data-anc-hausse]').value) / 100
      };
      var lp = lireRubriques(ov);
      var err = verifierRubriques(lp, p);
      if (err.length) { msg.style.color = '#c0392b'; msg.textContent = 'Formule à corriger : ' + err.join(' ; '); return false; }
      p.lignes = lp;
      enregistrer(fusion(DEFAUT, p));
      msg.style.color = '#1e8449'; msg.textContent = 'Enregistré : les bulletins ouverts sont recalculés.';
      try { root.dispatchEvent(new CustomEvent('terh-hok-params')); } catch (e) {}
      return true;
    } catch (err) { msg.style.color = '#c0392b'; msg.textContent = 'Valeur incorrecte : ' + err.message; return false; }
  }
  function ouvrir() {
    if (document.getElementById('hok-overlay')) return;
    synchroniser();
    var ov = document.createElement('div');
    ov.id = 'hok-overlay';
    ov.setAttribute('data-fenetre', 'defile');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,14,20,.55);z-index:2147483600;display:flex;align-items:flex-start;justify-content:center;padding:24px 12px;box-sizing:border-box';
    ov.innerHTML = '<div style="background:#fff;color:#1a1a1a;width:min(760px,100%);border-radius:8px;padding:14px;font:12px Arial,sans-serif;max-height:88vh;overflow:auto;display:flex;flex-direction:column;gap:8px">' +
      '<b style="font-size:14px">Paramètres Hôtel Océan</b>' +
      '<div style="color:#555">Modifiez les taux, barèmes et formules : chaque changement est enregistré aussitôt et les bulletins ouverts se recalculent. Les particularités (données des salariés) restent en JSON.</div>' +
      '<div style="font-weight:700">Prime d\'ancienneté (barème du cours)</div>' +
      '<div style="display:flex;gap:12px;flex-wrap:wrap">' +
      '<label>Seuil (années révolues)<br><input type="number" min="0" step="1" data-anc-seuil value="' + esc(charger().anciennete.seuil_ans) + '" style="width:110px"></label>' +
      '<label>Taux au seuil (%)<br><input type="number" min="0" step="0.01" data-anc-depart value="' + esc(+(nb(charger().anciennete.taux_depart) * 100).toFixed(4)) + '" style="width:110px"></label>' +
      '<label>Hausse par année (%)<br><input type="number" min="0" step="0.01" data-anc-hausse value="' + esc(+(nb(charger().anciennete.hausse_par_an) * 100).toFixed(4)) + '" style="width:110px"></label>' +
      '</div>' +
      '<div style="font-weight:700">Paramètres généraux</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 14px">' + champsGeneraux(charger()) + '</div>' +
      '<div style="font-weight:700">Particularités permanentes (restent d\'un mois à l\'autre) — clé = nom du salarié ; supprimer une clé la retire</div>' +
      '<textarea data-perm style="min-height:110px;font:12px Consolas,monospace;border:1px solid #9aa5b5;border-radius:4px;padding:8px">' + esc(JSON.stringify(chargerPermanentes(), null, 2)) + '</textarea>' +
      '<div style="font-weight:700">Particularités du mois — clé = période puis nom du salarié. Rien saisi = calcul automatique du modèle. Exemple : {"01/10/2026 au 31/10/2026": {"NOM": {"congeMontant": 0}}}</div>' +
      '<textarea data-mois style="min-height:150px;font:12px Consolas,monospace;border:1px solid #9aa5b5;border-radius:4px;padding:8px">' + esc(JSON.stringify(chargerMois(), null, 2)) + '</textarea>' +
      '<div style="font-weight:700">Rubriques et formules du bulletin Océan (modifiables, ajoutables, masquables)</div>' +
      '<div data-rub style="overflow:auto;max-height:300px">' + editeurRubriques(charger().lignes) + '</div>' +
      '<div data-msg style="min-height:16px"></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;position:sticky;bottom:0;background:#fff;padding-top:6px;border-top:1px solid #d5dbe5"><button type="button" data-x="reset">Valeurs par défaut</button><button type="button" data-x="ferme">Fermer</button><button type="button" data-x="ok" style="background:#1f5fbf;color:#fff;border:0;border-radius:4px;padding:6px 12px">Enregistrer</button></div></div>';
    document.body.appendChild(ov);
    // Enregistrement immédiat à chaque modification (sans attendre un bouton)
    var attente = null;
    function planifier() { clearTimeout(attente); attente = setTimeout(function () { sauverDirect(ov); }, 300); }
    ov.addEventListener('input', planifier);
    ov.addEventListener('change', planifier);
    // Nature : coche CNPS / IRPP / CFC selon le tableau des bases taxable et cotisable (Personnalisée = inchangé)
    var BASES_NATURE = { salaire: [true, true, true], transport: [false, true, true], remboursement: [false, false, false] };
    ov.addEventListener('change', function (e) {
      var sel = e.target.closest && e.target.closest('[data-anat]'); if (!sel) return;
      var tr = sel.closest('tr'), b = BASES_NATURE[sel.value]; if (!tr || !b) return;
      tr.querySelector('[data-acnps]').checked = b[0];
      tr.querySelector('[data-airpp]').checked = b[1];
      tr.querySelector('[data-acfc]').checked = b[2];
    });
    ov.addEventListener('click', function (e) {
      if (e.target === ov) return;   // clic à côté : rien ne se ferme (les saisies restent)
      var b = e.target.closest('[data-x]'); if (!b) return;
      var x = b.getAttribute('data-x'), msg = ov.querySelector('[data-msg]');
      if (x === 'ferme') ov.remove();
      else if (x === 'ajouter') { ov.querySelector('[data-tabajout] tbody').insertAdjacentHTML('beforeend', ligneAjout()); }
      else if (x === 'suppr') { b.closest('tr').remove(); }
      else if (x === 'reset') { remplirGeneraux(ov, DEFAUT); ov.querySelector('[data-anc-seuil]').value = DEFAUT.anciennete.seuil_ans; ov.querySelector('[data-anc-depart]').value = +(DEFAUT.anciennete.taux_depart * 100).toFixed(4); ov.querySelector('[data-anc-hausse]').value = +(DEFAUT.anciennete.hausse_par_an * 100).toFixed(4); ov.querySelector('[data-perm]').value = JSON.stringify(PERM_DEFAUT, null, 2); ov.querySelector('[data-mois]').value = JSON.stringify(MOIS_DEFAUT, null, 2); ov.querySelector('[data-rub]').innerHTML = editeurRubriques({}); sauverDirect(ov); }
      else if (x === 'ok') {
        try {
          var perm = JSON.parse(ov.querySelector('[data-perm]').value);
          var mois = JSON.parse(ov.querySelector('[data-mois]').value);
          enregistrerPermanentes(perm);
          enregistrerMois(mois);
          if (sauverDirect(ov)) { msg.style.color = '#1e8449'; msg.textContent = 'Paramètres, particularités permanentes et du mois enregistrés.'; }
        } catch (err) { msg.style.color = '#c0392b'; msg.textContent = 'Erreur : ' + err.message; }
      }
    });
  }

  root.PaieHok = { reglages: reglagesReels, geler: function (o) { GEL = clone(o); }, degeler: function () { GEL = null; }, parametresCourants: function () { return charger(); }, synchroniser: synchroniser, rubriquesAffichees: rubriquesAffichees, afficherRubrique: afficherRubrique, _champs: { CHAMPS_GENERAUX: CHAMPS_GENERAUX, versTexte: versTexte, depuisTexte: depuisTexte, lirePath: lirePath }, EQUIV_OCEAN: EQUIV_OCEAN, particulariteSansCorrection: particulariteSansCorrection, corrigerRubrique: corrigerRubrique, correctionRubrique: correctionRubrique, champCorrigeable: champCorrigeable, evaluer: function (src, vars) { return evaluerFormule(src, { v: vars || {}, p: charger() }); }, rubriquesOcean: rubriquesOcean, memoriserCodes: memoriserCodes, charger: charger, calculer: calculer, depuisLignes: depuisLignes, ouvrir: ouvrir, DEFAUT: DEFAUT, particularite: particularite, cleperiode: cleperiode, chargerPermanentes: chargerPermanentes, chargerMois: chargerMois, enregistrerPermanentes: enregistrerPermanentes, enregistrerMois: enregistrerMois, PERM_DEFAUT: PERM_DEFAUT, MOIS_DEFAUT: MOIS_DEFAUT };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PaieHok;
})(typeof window !== 'undefined' ? window : globalThis);
