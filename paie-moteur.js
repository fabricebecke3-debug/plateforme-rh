/* paie-moteur.js — version PRO, alignée sur les formules Sage. Calcul pur, sans affichage.
 * Cas de contrôle :
 *  - bulletin Sage avril 2026 (NTSOH, matricule 2033) : brut 197 815, net 175 000, IRPP 8 995, CAC 900,
 *    crédit foncier salarial 1 959, pension 7 741, redevance 1 950, taxe communale 1 270,
 *    total patronales 30 032 (AT 4 608, PF 12 902, FNE 1 843, CF patronal 2 938) ;
 *  - bulletin CIMPOR (brut 142 155, net 130 000).
 * Entrées : lignes {code, lib, gain | nombre + base + taux, irpp, cnps, retenue, transport, logement}
 *   et saisies {salaireBase, taux, cnpsPlafondMode, irpp, baseCFC, redevance, taxeCommunale,
 *   taxeDevLocal, taxeProp, elec, veeu, veau, plafondCFPat}.
 * Modifications par rapport aux versions précédentes :
 *  1. Le net est calculé à partir des montants NON arrondis, comme Sage (avril 2026 : 175 000 et non 174 999).
 *  2. Indicateur cnps par rubrique (optionnel). S'il est présent, la base CNPS = somme des rubriques cnps=true.
 *     Sinon, règle Sage d'origine : imposable − transport (1430).
 *  3. Totaux cohérents : total retenues = brut − net ; les lignes affichées s'additionnent au total arrondi.
 *  4. Sortie « detail » (montants exacts) pour le contrôle, code mort supprimé.
 * Décision en attente : mode « sage » (base CNPS = plafond dès 300 000) ou « legal » (min(base, plafond)).
 * Le mode « sage » reproduit le bulletin d'août 2026 ; à confirmer avant d'appliquer à toutes les sociétés.
 */
(function (root) {
  'use strict';

  var TAUX_DEFAUT = {
    cnps_sal: 4.2, cnps_pat: 4.2, at_pat: 2.5, pf_pat: 7, fne_pat: 1,
    cfc_sal: 1, cfc_pat: 1.5, cac: 10, plafond_cnps: 750000, cnps_plafond_mode: 'sage'
  };
  var PLAFOND_CNPS = 750000;
  var TRANSPORT = '1430', LOGEMENT = '1435';
  var HORAIRE_MENSUEL = 173.33;
  var HS_TAUX = { '1110': 120, '1130': 130, '1140': 140, '1150': 150, '1160': 100, '1444': 100 };

  // Tables Sage (condition sur SALTAXF) : borne haute incluse ; la dernière borne est l'infini
  var TAXCOM = [[15000,0],[25000,83],[50000,170],[52000,270],[75000,270],[100000,520],[125000,770],[150000,1020],[200000,1270],[330000,1520],[400000,2020],[500000,2270],[Infinity,2520]];
  var TAXDEVLO = [[61999,0],[75000,250],[100000,500],[125000,750],[150000,1000],[200000,1250],[250000,1500],[300000,2000],[500000,2250],[Infinity,2500]];
  var TAXAUDIO = [[50000,0],[100000,750],[200000,1950],[300000,3250],[400000,4550],[500000,5850],[600000,7150],[700000,8450],[800000,9750],[900000,11050],[1000000,12350],[Infinity,13000]];

  function tranche(table, s) {
    for (var i = 0; i < table.length; i++) { if (s <= table[i][0]) return table[i][1]; }
    return table[table.length - 1][1];
  }
  function arr(x) { return Math.round(Number(x) || 0); }
  function nb(x) { var n = Number(x); return isFinite(n) ? n : 0; }

  function gainLigne(l) {
    if (typeof l.gain === 'number' && isFinite(l.gain)) return l.gain;
    var n = Number(l.nombre), b = Number(l.base), t = (l.taux == null || l.taux === '') ? 100 : Number(l.taux);
    if (!isFinite(n) || !isFinite(b)) return 0;
    return n * b * t / 100;
  }

  // IRPP par tranches (formules Sage IRPPT1 à IRPPT4), à partir de SALTAXF (montant non arrondi)
  function irppSage(s) {
    s = nb(s);
    if (s <= 62000) return 0;
    if (s <= 310000) return (s * 70 / 100 - s * 2.8 / 100 - 41667) * 10 / 100;
    if (s <= 429000) return (s - 310000) * 70 / 100 * 15 / 100 + 16693;
    if (s <= 667000) return (s - 429000) * 70 / 100 * 25 / 100 + 29188;
    return (s - 667000) * 70 / 100 * 35 / 100 + 70830;
  }
  function irppTranche1(s) { return nb(s) <= 310000 ? irppSage(s) : null; }
  function redevanceSage(s) { return tranche(TAXAUDIO, nb(s)); }
  function taxeCommunaleSage(s) { return tranche(TAXCOM, nb(s)); }
  function taxeDevLocalSage(s) { return tranche(TAXDEVLO, nb(s)); }

  function calculer(lignes, saisies) {
    var s = saisies || {};
    var T = Object.assign({}, TAUX_DEFAUT, s.taux || {});

    // Salaire de base (base horaire des heures supplémentaires = salaire ÷ 173,33)
    var salB = (typeof s.salaireBase === 'number') ? s.salaireBase : null;
    if (salB === null) {
      var l1000 = (lignes || []).filter(function (l) { return String(l.code) === '1000'; })[0];
      if (l1000) salB = gainLigne(l1000);
    }

    var entrees = (lignes || []).map(function (l) {
      var c = String(l.code || ''), x = Object.assign({}, l);
      var hsCode = HS_TAUX[c] !== undefined || !!x.heures_sup;
      if (hsCode) {
        if ((x.taux == null || x.taux === '') && HS_TAUX[c] !== undefined) x.taux = HS_TAUX[c];
        if ((x.taux == null || x.taux === '')) x.taux = 100;
        if ((x.base == null || x.base === '') && salB != null && x.nombre != null && x.nombre !== '') x.base = salB / HORAIRE_MENSUEL;
      }
      return x;
    });

    var tous = entrees.map(function (l) {
      return {
        code: String(l.code || ''), lib: l.lib, gain: gainLigne(l),
        irpp: l.irpp !== false,
        cnps: (typeof l.cnps === 'boolean') ? l.cnps : undefined,
        retenue: !!l.retenue,
        transport: !!l.transport || String(l.code) === TRANSPORT,
        logement: !!l.logement || String(l.code) === LOGEMENT
      };
    });

    // Retenues (avance, cantine…) : déduites du net, hors brut et hors bases
    var rub = tous.filter(function (r) { return !r.retenue; });
    var retenuesDiv = tous.filter(function (r) { return r.retenue; }).reduce(function (t, r) { return t + r.gain; }, 0);
    var brut = rub.reduce(function (t, r) { return t + r.gain; }, 0);
    var netimpo = rub.filter(function (r) { return r.irpp; }).reduce(function (t, r) { return t + r.gain; }, 0);
    var transport = tous.filter(function (r) { return r.transport; }).reduce(function (t, r) { return t + r.gain; }, 0);
    var logement = tous.filter(function (r) { return r.logement; }).reduce(function (t, r) { return t + r.gain; }, 0);

    // Chaîne Sage : NETIMPOL → logement final (IL) → électricité (ELEF) → véhicule/eau → NETTAX → SALTAXF
    var elec = nb(s.elec), veeu = nb(s.veeu), veau = nb(s.veau);
    var netimpol = netimpo - logement - elec - veeu;
    var il = Math.min(netimpol * 15 / 100, logement);
    var elecn = netimpol * 4 / 100, elef = elec < elecn ? elec : elecn;
    var nettax = netimpol + il + elef + veau;
    var saltaxfCalc = nettax < 52000 ? 0 : nettax;
    var saltaxf = (typeof s.baseCFC === 'number') ? s.baseCFC : saltaxfCalc;

    // Base CNPS (NETIMPOPL)
    var basecot;
    var indicateurCnps = rub.some(function (r) { return r.cnps !== undefined; });
    if (indicateurCnps) {
      basecot = rub.filter(function (r) { return r.cnps === true; }).reduce(function (t, r) { return t + r.gain; }, 0);
    } else {
      basecot = netimpo - transport;
    }
    var plafond = (typeof s.taux === 'object' && s.taux && typeof s.taux.plafond_cnps === 'number') ? s.taux.plafond_cnps : PLAFOND_CNPS;
    var mode = s.cnpsPlafondMode || (s.taux && s.taux.cnps_plafond_mode) || TAUX_DEFAUT.cnps_plafond_mode;
    var netimpopl = (mode === 'legal') ? Math.min(basecot, plafond) : (basecot < 300000 ? basecot : plafond);

    // Retenues salariales (montants exacts)
    var irppRaw = (typeof s.irpp === 'number') ? s.irpp : irppSage(saltaxf);
    var cacRaw = irppRaw * T.cac / 100;
    var cnpsSalRaw = netimpopl * T.cnps_sal / 100;
    var cfcSalRaw = saltaxf * T.cfc_sal / 100;
    var redevanceRaw = (typeof s.redevance === 'number') ? s.redevance : redevanceSage(saltaxf);
    var taxeComRaw = (typeof s.taxeCommunale === 'number') ? s.taxeCommunale : taxeCommunaleSage(saltaxf);
    var taxeDevRaw = s.taxeDevLocal ? taxeDevLocalSage(saltaxf) : 0;
    var taxePropRaw = s.taxeProp ? netimpo * 4.8 / 100 : 0;
    var retenuesRaw = cnpsSalRaw + cfcSalRaw + irppRaw + cacRaw + redevanceRaw + taxeComRaw + taxeDevRaw + taxePropRaw + retenuesDiv;

    // Charges patronales (montants exacts)
    var baseCFPat = (typeof s.plafondCFPat === 'number') ? Math.min(saltaxf, s.plafondCFPat) : saltaxf;
    var patRaw = {
      cnps: netimpopl * T.cnps_pat / 100,
      at: netimpopl * T.at_pat / 100,
      pf: netimpopl * T.pf_pat / 100,
      fne: netimpopl * T.fne_pat / 100,
      cfc: baseCFPat * T.cfc_pat / 100
    };
    var totPatRaw = patRaw.cnps + patRaw.at + patRaw.pf + patRaw.fne + patRaw.cfc;

    // Net : calculé sur les montants exacts, puis arrondi (règle Sage)
    var net = Math.round(brut - retenuesRaw);
    var brutArr = Math.round(brut);
    var totalRetenues = brutArr - net;           // cohérent : brut − retenues = net

    return {
      brut: brutArr,
      netImposable: arr(netimpo),
      baseCNPS: arr(netimpopl),
      baseCFC: arr(saltaxf),
      saltaxf: arr(saltaxf),
      salariales: {
        cnps: arr(cnpsSalRaw), cfc: arr(cfcSalRaw), irpp: arr(irppRaw), cac: arr(cacRaw),
        redevance: arr(redevanceRaw), taxeCommunale: arr(taxeComRaw),
        taxeDevLocal: arr(taxeDevRaw), taxeProp: arr(taxePropRaw)
      },
      patronales: {
        cnps: arr(patRaw.cnps), at: arr(patRaw.at), pf: arr(patRaw.pf), fne: arr(patRaw.fne), cfc: arr(patRaw.cfc)
      },
      totalRetenues: totalRetenues,
      totalPatronales: Math.round(totPatRaw),
      net: net,
      coutEmployeur: Math.round(brut + totPatRaw),
      retenuesDiverses: arr(retenuesDiv),
      rubriques: tous.map(function (r) { return { code: r.code, lib: r.lib, gain: r.gain, retenue: r.retenue }; }),
      detail: {
        brut: brut, netImposable: netimpo, transport: transport, logement: logement,
        basecot: basecot, netimpopl: netimpopl, saltaxf: saltaxf,
        irpp: irppRaw, cac: cacRaw, cnpsSal: cnpsSalRaw, cfcSal: cfcSalRaw,
        retenues: retenuesRaw, patronales: totPatRaw, netExact: brut - retenuesRaw,
        modeCnps: mode, baseCnpsParIndicateur: indicateurCnps
      }
    };
  }

  // Taux en vigueur à une date : version active si date_effet ≤ jour < date_fin (ou date_fin vide)
  function tauxEnVigueur(versions, jour) {
    var j = jour || new Date().toISOString().slice(0, 10), out = {};
    (versions || []).forEach(function (v) {
      if (v.date_effet <= j && (!v.date_fin || v.date_fin > j)) out[v.code] = Number(v.valeur);
    });
    return out;
  }

  // Ancienneté à partir de la date d'entrée (AAAA-MM-JJ), au mois près
  function ancienneteDepuis(dateEntree, ref) {
    if (!dateEntree) return null;
    var d = new Date(String(dateEntree).slice(0, 10) + 'T00:00:00'), r = ref || new Date();
    if (isNaN(d.getTime())) return null;
    var m = (r.getFullYear() - d.getFullYear()) * 12 + (r.getMonth() - d.getMonth());
    if (m < 0) return null;
    var ans = Math.floor(m / 12), mois = m % 12;
    return { ans: ans, mois: mois, texte: ans + ' an(s) et ' + mois + ' mois' };
  }

  var API = {
    calculer: calculer,
    gainLigne: gainLigne,
    ancienneteDepuis: ancienneteDepuis,
    tauxEnVigueur: tauxEnVigueur,
    irppSage: irppSage,
    irppTranche1: irppTranche1,
    redevanceSage: redevanceSage,
    taxeCommunaleSage: taxeCommunaleSage,
    taxeDevLocalSage: taxeDevLocalSage,
    TAUX_DEFAUT: TAUX_DEFAUT,
    TABLES: { TAXCOM: TAXCOM, TAXDEVLO: TAXDEVLO, TAXAUDIO: TAXAUDIO }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.PaieMoteur = API;
})(typeof window !== 'undefined' ? window : globalThis);
