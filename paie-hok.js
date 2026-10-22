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
    entreprise: { tel: '695364392 /670471563', niu: 'M042318119342F', cnps: '392-0100140- A' },
    logement: { taux: 0.25 },
    assiduite: { taux: 0.05 },
    anciennete: { taux: 0.06, seuil_ans: 2, tiers: [{ depuis: 2, taux: 0.06 }, { depuis: 5, taux: 0.10 }] },
    transport: { montant: 15000, exclu_cnps: 1 },
    cnps: { taux: 0.042, plafond: null },
    abattement: { taux: 0.7 },
    irpp: {
      seuils: [62000, 310000, 429000, 667000],
      taux: [0.1, 0.15, 0.25, 0.35],
      cumul: [16693, 29188, 70830],
      facteur: 0.7, charge: 0.028, deduction: 41667
    },
    conge: { base: 'salaire_base', tiers: [{ depuis: 1, taux: 0.04 }, { depuis: 2, taux: 0.02 }] },
    cac: { taux: 0.1 },
    cfc: { taux: 0.01 },
    rav: {
      tranches: [[50000, 0], [100000, 750], [200000, 1950], [300000, 3250], [400000, 4550], [500000, 5850],
        [600000, 7150], [700000, 8450], [800000, 9750], [900000, 11050], [1000000, 12350]],
      au_dela: 13000
    },
    tc: {
      regle: 'tranche', pas: 25000, montant: 250, decalage: 1, plafond: 2250,
      tranches: [[15000, 0], [25000, 83], [50000, 170], [52000, 270], [75000, 270], [100000, 520], [125000, 770],
        [150000, 1020], [200000, 1270], [330000, 1520], [400000, 2020], [500000, 2270]],
      au_dela: 2520
    }
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
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
  function charger() {
    try {
      var t = root.localStorage && root.localStorage.getItem(cle());
      if (t) return fusion(DEFAUT, JSON.parse(t));
    } catch (e) {}
    return clone(DEFAUT);
  }
  function enregistrer(p) { try { root.localStorage && root.localStorage.setItem(cle(), JSON.stringify(p)); } catch (e) {} }

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
  function tauxConge(ans, p) {
    var taux = 0;
    (p.conge.tiers || []).forEach(function (t) { if (ans >= nb(t.depuis)) taux = nb(t.taux); });
    return taux;
  }
  // Calcul pur. Montants exacts en interne ; ROUND pour les lignes arrondies comme dans le fichier.
  function calculer(o) {
    var p = o.params || charger();
    var sb = nb(o.salaireBase);
    var ans = nb(o.ansAnciennete);
    if (o.ansAnciennete === undefined && o.dateAnciennete && root.PaieMoteur && root.PaieMoteur.ancienneteDepuis) {
      var a = root.PaieMoteur.ancienneteDepuis(o.dateAnciennete);
      ans = a ? a.ans : 0;
    }
    // Ancienneté et logement : calculés sur le salaire mensuel complet ; l'assiduité sur la base du mois (proratisée)
    var smens = (o.salaireMensuel !== undefined && o.salaireMensuel !== null && o.salaireMensuel !== '') ? nb(o.salaireMensuel) : sb;
    var tauxAnc = 0;
    (p.anciennete.tiers || [{ depuis: p.anciennete.seuil_ans, taux: p.anciennete.taux }]).forEach(function (t) {
      if (ans >= nb(t.depuis)) tauxAnc = nb(t.taux);
    });
    var ancMontant = tauxAnc * smens;
    var logement = (o.logement !== undefined && o.logement !== null && o.logement !== '') ? nb(o.logement) : p.logement.taux * (smens + ancMontant);
    // Prime d'assiduité : 5 % de la base du mois ; 0 en cas d'absence (saisie possible par le paramètre assiduite)
    var assiduite = (o.assiduite !== undefined && o.assiduite !== null && o.assiduite !== '') ? nb(o.assiduite) : p.assiduite.taux * sb;
    var transport = (o.transport !== undefined && o.transport !== null && o.transport !== '') ? nb(o.transport) : nb(p.transport.montant);

    var gains = [
      { code: '1', lib: 'Salaire de Base', nombre: 30, base: sb / 30, taux: null, gain: sb },
      { code: '2', lib: 'Indemnité de Logement', nombre: null, base: null, taux: null, gain: logement },
      { code: '3', lib: "Prime d'Assiduité", nombre: null, base: null, taux: null, gain: assiduite },
      { code: '4', lib: 'Indemnité de Transport', nombre: null, base: null, taux: null, gain: transport },
      { code: '5', lib: "Prime d'Ancienneté", nombre: null, base: null, taux: p.anciennete.taux, gain: ancMontant }
    ];
    var tauxC = o.congePris ? tauxConge(ans, p) : 0;
    gains.push({ code: '6', lib: 'Indemnité de Congé', nombre: null, base: null, taux: tauxC || null, gain: tauxC * sb });
    (o.manuels || []).forEach(function (m, i) {
      gains.push({ code: m.code || String(7 + i), lib: m.lib || 'Élément complémentaire', nombre: null, base: null, taux: null, gain: nb(m.gain) });
    });

    var brut = gains.reduce(function (t, g) { return t + g.gain; }, 0);
    // Base CNPS (colonne K) : brut sans transport, plafond si défini
    var K = brut - transport * nb(p.transport.exclu_cnps);
    if (p.cnps.plafond) K = Math.min(K, nb(p.cnps.plafond));
    var cnps = p.cnps.taux * K;
    // Base imposable (colonne L) : brut × abattement − CNPS
    var L = brut * p.abattement.taux - cnps;
    // Base IRPP arrondie au multiple de 250 le plus proche ; IRPP arrondi à l'unité ; CAC = 10 % de l'IRPP arrondi
    var Lirpp = Math.round(L / 250) * 250;
    var irppMontant = Math.round(irpp(Lirpp, p));
    var cac = p.cac.taux * irppMontant;
    var cfc = L <= p.irpp.seuils[0] ? 0 : Math.floor(p.cfc.taux * L);
    var rav = tranche(p.rav.tranches, L, p.rav.au_dela);
    var tc = (p.tc.regle === 'tranche')
      ? Math.min(nb(p.tc.plafond), nb(p.tc.montant) * Math.max(0, Math.floor(L / nb(p.tc.pas)) - nb(p.tc.decalage)))
      : tranche(p.tc.tranches, L, p.tc.au_dela);
    // Salarié non assujetti aux retenues fiscales (bulletin sans IRPP, CAC, CFC, RAV, TC)
    if (o.exonere) { irppMontant = 0; cac = 0; cfc = 0; rav = 0; tc = 0; }

    // Ordre et libellés du bulletin papier Hôtel Océan (lignes fixes à 0 incluses)
    var retenues = [
      { code: '10', lib: 'IRPP', base: L, taux: null, ret: irppMontant },
      { code: '11', lib: 'CAC', base: null, taux: null, ret: cac },
      { code: '12', lib: 'Crédit Foncier du Cameroun', base: L, taux: p.cfc.taux, ret: cfc },
      { code: '17', lib: "Fonds National de l'Emploi", base: null, taux: null, ret: nb(o.fne) },
      { code: '13', lib: 'CNPS', base: K, taux: p.cnps.taux, ret: cnps },
      { code: '14', lib: 'RAV', base: null, taux: null, ret: rav },
      { code: '15', lib: 'Taxe Communale/TDL', base: null, taux: null, ret: tc },
      { code: '22', lib: 'Dettes Internes', base: null, taux: null, ret: nb(o.dettes) },
      { code: '27', lib: 'Prestation Familiale', base: null, taux: null, ret: nb(o.prestation) },
      { code: '28', lib: 'Communard', base: null, taux: null, ret: nb(o.communard) }
    ];
    (o.retenuesManuelles || []).forEach(function (r, i) {
      retenues.push({ code: r.code || String(20 + i), lib: r.lib || 'Retenue', base: null, taux: null, ret: nb(r.ret) });
    });

    var sommeRet = retenues.reduce(function (t, r) { return t + r.ret; }, 0);
    // Rappels (s'ajoutent au net) et avances (se déduisent du net), hors brut et hors retenues
    var rappel = nb(o.rappel), avance = nb(o.avance);
    var netCalc = brut + rappel - sommeRet - avance;
    return {
      entreprise: p.entreprise,
      gains: gains,
      retenues: retenues,
      brut: Math.round(brut),
      cnpsBase: Math.round(K),
      baseImposable: Math.round(L),
      ansAnciennete: ans,
      congePris: !!o.congePris,
      totalRetenues: sommeRet,
      rappel: rappel, avance: avance,
      net: netCalc,
      exact: { brut: brut, retenues: sommeRet, net: netCalc, irpp: irppMontant, cac: cac, cnps: cnps, cfc: cfc, rav: rav, tc: tc }
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

  // Calcul à partir de la fiche employé et des lignes saisies à la main (bulletin imprimé)
  function depuisLignes(o) {
    var lignes = o.lignes || [], f = o.fiche || {};
    var l1000 = lignes.filter(function (l) { return String(l.code) === '1000'; })[0];
    var sb = nb(f.sb) || (l1000 ? (nb(l1000.gain) || nb(l1000.nombre) * nb(l1000.base)) : 0);
    var gain = function (l) { return root.PaieMoteur && root.PaieMoteur.gainLigne ? root.PaieMoteur.gainLigne(l) : nb(l.gain); };
    var CODES_FIXES = ['1000', '26', '29', '17', '22', '27', '28'];
    var lig = function (code) { return lignes.filter(function (l) { return String(l.code) === code; })[0]; };
    var montantLig = function (code) { var l = lig(code); return l ? nb(root.PaieMoteur && PaieMoteur.gainLigne ? PaieMoteur.gainLigne(l) : l.gain) : 0; };
    var manuels = lignes.filter(function (l) { return !l.auto && !l.retenue && CODES_FIXES.indexOf(String(l.code)) < 0; })
      .map(function (l) { return { code: String(l.code), lib: l.lib || '', gain: gain(l) }; });
    var retenuesManuelles = lignes.filter(function (l) { return !l.auto && l.retenue && CODES_FIXES.indexOf(String(l.code)) < 0; })
      .map(function (l) { return { code: String(l.code), lib: l.lib || '', ret: gain(l) }; });
    return calculer({
      salaireBase: sb,
      ansAnciennete: (f.ans !== undefined && f.ans !== '') ? nb(f.ans) : undefined,
      salaireMensuel: (f.smens !== undefined && f.smens !== '') ? f.smens : undefined,
      logement: (f.logement !== undefined && f.logement !== '') ? f.logement : undefined,
      exonere: !!f.exonere,
      rappel: (f.rappel !== undefined && f.rappel !== '') ? f.rappel : montantLig('29'),
      avance: (f.avance !== undefined && f.avance !== '') ? f.avance : montantLig('26'),
      fne: (f.fne !== undefined && f.fne !== '') ? f.fne : montantLig('17'),
      dettes: (f.dettes !== undefined && f.dettes !== '') ? f.dettes : montantLig('22'),
      prestation: (f.prestation !== undefined && f.prestation !== '') ? f.prestation : montantLig('27'),
      communard: (f.communard !== undefined && f.communard !== '') ? f.communard : montantLig('28'),
      assiduite: (f.assiduite !== undefined && f.assiduite !== '') ? f.assiduite : undefined,
      dateAnciennete: f.dane || f.entree || '',
      transport: (f.transport !== undefined && f.transport !== '') ? f.transport : undefined,
      congePris: congePrisSurPeriode(o.conges, o.periode),
      manuels: manuels,
      retenuesManuelles: retenuesManuelles,
      params: charger()
    });
  }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // Fenêtre de paramètres : JSON modifiable ; les paramètres ajoutés sont conservés
  function ouvrir() {
    if (document.getElementById('hok-overlay')) return;
    var ov = document.createElement('div');
    ov.id = 'hok-overlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,14,20,.55);z-index:2147483600;display:flex;align-items:flex-start;justify-content:center;padding:24px 12px;box-sizing:border-box';
    ov.innerHTML = '<div style="background:#fff;color:#1a1a1a;width:min(760px,100%);border-radius:8px;padding:14px;font:12px Arial,sans-serif;max-height:88vh;display:flex;flex-direction:column;gap:8px">' +
      '<b style="font-size:14px">Paramètres Hôtel Océan</b>' +
      '<div style="color:#555">Modifiez les taux et barèmes, ou ajoutez des paramètres (format JSON). Les bulletins se recalculent à chaque impression.</div>' +
      '<textarea data-hok style="flex:1;min-height:360px;font:12px Consolas,monospace;border:1px solid #9aa5b5;border-radius:4px;padding:8px">' + esc(JSON.stringify(charger(), null, 2)) + '</textarea>' +
      '<div data-msg style="min-height:16px"></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" data-x="reset">Valeurs par défaut</button><button type="button" data-x="ferme">Fermer</button><button type="button" data-x="ok" style="background:#1f5fbf;color:#fff;border:0;border-radius:4px;padding:6px 12px">Enregistrer</button></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) {
      if (e.target === ov) { ov.remove(); return; }
      var b = e.target.closest('[data-x]'); if (!b) return;
      var x = b.getAttribute('data-x'), msg = ov.querySelector('[data-msg]');
      if (x === 'ferme') ov.remove();
      else if (x === 'reset') { ov.querySelector('[data-hok]').value = JSON.stringify(DEFAUT, null, 2); msg.style.color = '#555'; msg.textContent = 'Valeurs par défaut affichées : enregistrez pour les appliquer.'; }
      else if (x === 'ok') {
        try {
          var p = JSON.parse(ov.querySelector('[data-hok]').value);
          enregistrer(fusion(DEFAUT, p));
          msg.style.color = '#1e8449'; msg.textContent = 'Paramètres enregistrés.';
        } catch (err) { msg.style.color = '#c0392b'; msg.textContent = 'JSON invalide : ' + err.message; }
      }
    });
  }

  root.PaieHok = { charger: charger, calculer: calculer, depuisLignes: depuisLignes, ouvrir: ouvrir, DEFAUT: DEFAUT };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PaieHok;
})(typeof window !== 'undefined' ? window : globalThis);
