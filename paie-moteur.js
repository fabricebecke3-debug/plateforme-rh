/* paie-moteur.js — Calcul du bulletin selon les formules Sage (constantes et rubriques vérifiées dans sage-data.json).
 * Entrées : lignes de rubriques {code, lib, nombre, base, taux, gain, irpp}. Codes utilisés comme Sage :
 *   1430 = indemnité de transport (TRANSC), 1435 = indemnité de logement (IL2 « LOG CONS »).
 *   irpp = imposable (NETIMPO). Les paniers et salissures ne sont pas imposables dans le cas CIMPOR.
 * Saisies facultatives (cas particuliers) : irpp, baseCFC, redevance, taxeCommunale, elec, veeu, veau, taxeProp, taxeDevLocal.
 * Fonctions pures. Testées par scripts/test-paie-moteur.js (bulletin Sage CIMPOR : brut 142 155, net 130 000).
 */
(function (root) {
  'use strict';
  var TAUX_DEFAUT = { cnps_sal: 4.2, cnps_pat: 4.2, at_pat: 2.5, pf_pat: 7, fne_pat: 1, cfc_sal: 1, cfc_pat: 1.5, cac: 10 };
  var PLAFOND_CNPS = 750000, SEUIL_PLAFOND = 300000;
  var TRANSPORT = '1430', LOGEMENT = '1435';
  // Tables lues dans sage-data.json (condition sur SALTAXF)
  var TAXCOM = [[15000,0],[25000,83],[50000,170],[52000,270],[75000,270],[100000,520],[125000,770],[150000,1020],[200000,1270],[330000,1520],[400000,2020],[500000,2270],[Infinity,2520]];
  var TAXDEVLO = [[61999,0],[75000,250],[100000,500],[125000,750],[150000,1000],[200000,1250],[250000,1500],[300000,2000],[500000,2250],[Infinity,2500]];
  var TAXAUDIO = [[50000,0],[100000,750],[200000,1950],[300000,3250],[400000,4550],[500000,5850],[600000,7150],[700000,8450],[800000,9750],[900000,11050],[1000000,12350],[Infinity,13000]];
  // Lecture d'une table : s ≤ borne1 → valeur1 ; borne_i < s ≤ borne_i+1 → valeur_i+1 ; dernière borne = infini
  function tranche(table, s) {
    var prec = -Infinity;
    for (var i = 0; i < table.length; i++) { if (s <= table[i][0]) return table[i][1]; prec = table[i][0]; }
    return table[table.length - 1][1];
  }
  function arr(x) { return Math.round(Number(x) || 0); }
  function gainLigne(l) {
    if (typeof l.gain === 'number' && isFinite(l.gain)) return l.gain;
    var n = Number(l.nombre), b = Number(l.base), t = (l.taux == null || l.taux === '') ? 100 : Number(l.taux);
    if (!isFinite(n) || !isFinite(b)) return 0;
    return n * b * t / 100;
  }
  // IRPP par tranches (formules Sage IRPPT1 à IRPPT4), à partir de SALTAXF
  function irppSage(s) {
    s = Number(s) || 0;
    if (s <= 62000) return 0;
    if (s <= 310000) { var tra = s * 70 / 100 - s * 2.8 / 100 - 41667; return tra * 10 / 100; }
    if (s <= 429000) { var b12 = (s - 310000) * 70 / 100 * 15 / 100; return b12 + 16693; }
    if (s <= 667000) { var c12 = (s - 429000) * 70 / 100 * 25 / 100; return c12 + 29188; }
    var d12 = (s - 667000) * 70 / 100 * 35 / 100; return d12 + 70830;
  }
  function irppTranche1(s) { return (Number(s) || 0) <= 310000 ? irppSage(s) : null; }
  function redevanceSage(s) { return tranche(TAXAUDIO, Number(s) || 0); }
  function taxeCommunaleSage(s) { return tranche(TAXCOM, Number(s) || 0); }
  function taxeDevLocalSage(s) { return tranche(TAXDEVLO, Number(s) || 0); }

  // Heures supplémentaires (rubriques Sage 1110 à 1160, 1444) : base horaire = salaire de base ÷ 173,33 (constante SALHOR1)
  var HS_TAUX = { '1110': 120, '1130': 130, '1140': 140, '1150': 150, '1160': 100, '1444': 100 };
  var HORAIRE_MENSUEL = 173.33;
  function calculer(lignes, saisies) {
    var s = saisies || {};
    var T = Object.assign({}, TAUX_DEFAUT, s.taux || {});
    var salB = (typeof s.salaireBase === 'number') ? s.salaireBase : null;
    if (salB === null) { var l1000 = (lignes || []).filter(function (l) { return String(l.code) === '1000'; })[0]; if (l1000) salB = gainLigne(l1000); }
    var entrees = (lignes || []).map(function (l) {
      var c = String(l.code || ''), x = Object.assign({}, l);
      var hsCode = HS_TAUX[c] !== undefined || !!x.heures_sup;
      if (hsCode) {
        if (HS_TAUX[c] === undefined && (x.taux == null || x.taux === '')) x.taux = 100;
        if ((x.taux == null || x.taux === '') && HS_TAUX[c] !== undefined) x.taux = HS_TAUX[c];
        if ((x.base == null || x.base === '') && salB != null && x.nombre != null && x.nombre !== '') x.base = salB / HORAIRE_MENSUEL;
      }
      return x;
    });
    var tous = entrees.map(function (l) { return { code: String(l.code || ''), lib: l.lib, gain: gainLigne(l), irpp: l.irpp !== false, retenue: !!l.retenue, transport: !!l.transport, logement: !!l.logement }; });
    // Retenues (avance sur salaire, cantine, etc.) : déduites du net, hors brut et hors bases de cotisation
    var retenuesDiv = tous.filter(function (r) { return r.retenue; }).reduce(function (t, r) { return t + r.gain; }, 0);
    var rub = tous.filter(function (r) { return !r.retenue; });
    var brut = rub.reduce(function (t, r) { return t + r.gain; }, 0);
    var netimpo = rub.filter(function (r) { return r.irpp; }).reduce(function (t, r) { return t + r.gain; }, 0);
    var transport = tous.filter(function (r) { return r.code === TRANSPORT || r.transport; }).reduce(function (t, r) { return t + r.gain; }, 0);
    var logement = tous.filter(function (r) { return r.code === LOGEMENT || r.logement; }).reduce(function (t, r) { return t + r.gain; }, 0);
    // Chaîne Sage : NETIMPOL → logement final (IL) → électricité (ELEF) → véhicule/eau (VEAU) → NETTAX → SALTAXF
    var elec = Number(s.elec) || 0, veeu = Number(s.veeu) || 0, veau = Number(s.veau) || 0;
    var netimpol = netimpo - logement - elec - veeu;
    var il = Math.min(netimpol * 15 / 100, logement);
    var elecn = netimpol * 4 / 100, elef = elec < elecn ? elec : elecn;
    var nettax = netimpol + il + elef + veau;
    var saltaxfCalc = nettax < 52000 ? 0 : nettax;
    var saltaxf = (typeof s.baseCFC === 'number') ? s.baseCFC : saltaxfCalc;
    // Base CNPS : BASECOT = NETIMPO − TRANSC, plafonnée (NETIMPOPL)
    var basecot = netimpo - transport;
    var netimpopl = basecot < SEUIL_PLAFOND ? basecot : PLAFOND_CNPS;
    var irpp = arr(typeof s.irpp === 'number' ? s.irpp : irppSage(saltaxf));
    var cac = arr(irpp * T.cac / 100);
    var cnpsSal = arr(netimpopl * T.cnps_sal / 100), cfcSal = arr(saltaxf * T.cfc_sal / 100);
    var redevance = arr(typeof s.redevance === 'number' ? s.redevance : redevanceSage(saltaxf));
    var taxeCom = arr(typeof s.taxeCommunale === 'number' ? s.taxeCommunale : taxeCommunaleSage(saltaxf));
    var taxeDev = s.taxeDevLocal ? arr(taxeDevLocalSage(saltaxf)) : 0;     // 9071 : non présente sur le bulletin de référence
    var taxeProp = s.taxeProp ? arr(netimpo * 4.8 / 100) : 0;             // 9060 : non présente sur le bulletin de référence
    var retenues = cnpsSal + cfcSal + irpp + cac + redevance + taxeCom + taxeDev + taxeProp + arr(retenuesDiv);
    // Crédit foncier patronal (constante CCF) : BRUT × 1,5 %, plafonné par le plafond du salarié si la saisie est fournie
    var baseCFPat = (typeof s.plafondCFPat === 'number') ? Math.min(brut, s.plafondCFPat) : brut;
    var patronales = {
      cnps: arr(netimpopl * T.cnps_pat / 100), at: arr(netimpopl * T.at_pat / 100),
      pf: arr(netimpopl * T.pf_pat / 100), fne: arr(netimpopl * T.fne_pat / 100), cfc: arr(baseCFPat * T.cfc_pat / 100)
    };
    var totPat = patronales.cnps + patronales.at + patronales.pf + patronales.fne + patronales.cfc;
    return {
      brut: arr(brut), netImposable: arr(netimpo), baseCNPS: arr(netimpopl), baseCFC: arr(saltaxf), saltaxf: arr(saltaxf),
      salariales: { cnps: cnpsSal, cfc: cfcSal, irpp: irpp, cac: cac, redevance: redevance, taxeCommunale: taxeCom, taxeDevLocal: taxeDev, taxeProp: taxeProp },
      patronales: patronales,
      totalRetenues: retenues, totalPatronales: totPat,
      net: arr(brut) - retenues, coutEmployeur: arr(brut) + totPat,
      retenuesDiverses: arr(retenuesDiv),
      rubriques: tous.map(function (r) { return { code: r.code, lib: r.lib, gain: r.gain, retenue: r.retenue }; })
    };
  }
  // Taux en vigueur à une date : une version est en vigueur si date_effet ≤ jour < date_fin (ou date_fin vide)
  function tauxEnVigueur(versions, jour) {
    var j = jour || new Date().toISOString().slice(0, 10), out = {};
    (versions || []).forEach(function (v) {
      if (v.date_effet <= j && (!v.date_fin || v.date_fin > j)) out[v.code] = Number(v.valeur);
    });
    return out;
  }
  var API = { tauxEnVigueur: tauxEnVigueur, calculer: calculer, gainLigne: gainLigne, TAUX_DEFAUT: TAUX_DEFAUT, irppTranche1: irppTranche1, irppSage: irppSage,
    redevanceSage: redevanceSage, taxeCommunaleSage: taxeCommunaleSage, taxeDevLocalSage: taxeDevLocalSage };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.PaieMoteur = API;
})(typeof window !== 'undefined' ? window : globalThis);
