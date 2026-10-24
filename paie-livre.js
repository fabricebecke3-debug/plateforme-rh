/* paie-livre.js — Livre de paie « Ventilation par salarié » (format Sage, paysage A4).
 * Chaque salarié est traité avec SON modèle de paie (PaieModeles.pourSalarie), comme son bulletin :
 *  - modèle Sage  : PaieGrille.lignesPour -> PaieMoteur.calculer -> PaieBulletinSage.lignesTableau (codes 1000, 8100, 9019…)
 *  - modèle Océan : PaieHok.depuisLignes (codes 1 à 28, rappels 29, avance 26 — mêmes totaux que le bulletin Océan)
 * PaieLivre.depuisGrille(opts)     : livre de tous les salariés de la fiche (PRH_fichesPaie).
 * PaieLivre.generer(salaries, opts): mise en page. salaries = [{matricule, nom, fiche, lignes, modele?, presence?}]
 */
(function (root) {
  'use strict';

  var PAR_PAGE = 7;

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>\"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(n) {
    if (n === null || n === undefined || n === '' || !isFinite(Number(n))) return '';
    var v = Math.round(Number(n));
    return (v < 0 ? '-' : '') + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }
  function num(v) { var x = Number(v); return isFinite(x) ? x : 0; }

  // Lignes d'un salarié selon son modèle. Chaque ligne : {code, lib, v (gain > 0, retenue < 0), kind}
  //   kind : 'g' gain · 'c' cotisation/retenue incluse dans « Total cotisation » · 'r' autre retenue · 'p' rappel/avance (après le total)
  function lignesSage(s) {
    var R = s.R, L = (root.PaieBulletinSage && PaieBulletinSage.lignesTableau) ? PaieBulletinSage.lignesTableau({ lignes: s.lignes || [] }, R) : [];
    var out = [], cot = 0;
    L.forEach(function (r) {
      if (!r.code || /^81[1-4]\d$/.test(String(r.code))) return;   // patronales : hors du livre détaillé
      var code = String(r.code);
      if (r.gainLigne) out.push({ code: code, lib: r.lib, v: num(r.gain), kind: 'g' });
      else {
        var c = /^8/.test(code);
        if (c) cot += num(r.ret);
        out.push({ code: code, lib: r.lib, v: -num(r.ret), kind: c ? 'c' : 'r' });
      }
    });
    return {
      rows: out, brut: num(R.brut), cotisations: cot, retenues: num(R.totalRetenues), patronales: num(R.totalPatronales),
      net: num(R.net), netImposable: num(R.netImposable), cout: num(R.coutEmployeur), patrDispo: true
    };
  }
  // Modèle Océan : même calcul et mêmes rubriques que le bulletin Océan (PaieHok)
  function lignesOcean(s) {
    var H = root.PaieHok.depuisLignes({ fiche: s.fiche || {}, lignes: s.lignes || [], periode: s.periode || '',
      presence: s.presence && s.presence.objet ? s.presence.objet : null, congesPlateforme: s.congesPlateforme || [] });
    var out = [];
    H.gains.forEach(function (g) { out.push({ code: String(g.code), lib: g.lib, v: num(g.gain), kind: 'g' }); });
    H.retenues.forEach(function (r) { out.push({ code: String(r.code), lib: r.lib, v: -num(r.ret), kind: 'c' }); });
    out.push({ code: '29', lib: H.libRappel || 'Rappels', v: num(H.rappel), kind: 'p' });
    out.push({ code: '26', lib: H.libAvance || 'Avance sur salaire', v: -num(H.avance), kind: 'p' });
    return {
      rows: out, brut: num(H.brut), cotisations: num(H.totalRetenues), retenues: num(H.totalRetenues),
      patronales: num(H.totalPatronales), net: num(H.net), netImposable: num(H.netImposable), cout: num(H.coutEmployeur), patrDispo: true
    };
  }

  function colonneSalarie(s) {
    var ocean = s.modele && s.modele.gabarit === 'ocean' && root.PaieHok;
    var d = ocean ? lignesOcean(s) : lignesSage(s);
    var rub = {};
    d.rows.forEach(function (r) { r.key = cle(r); rub[r.key] = r; });
    return {
      matricule: s.matricule || '', nom: s.nom || '', rows: d.rows, rub: rub, gabarit: ocean ? 'ocean' : 'sage',
      brut: d.brut, cotisations: d.cotisations, retenues: d.retenues, patronales: d.patronales, net: d.net,
      netImposable: d.netImposable, cout: d.cout, patrDispo: d.patrDispo,
      presence: s.presence !== undefined && s.presence !== null && s.presence !== '' ? num(s.presence) : null
    };
  }

  function cle(r) { return String(r.code) + '|' + String(r.lib || '').trim().toLowerCase(); }

  // Rubriques d'une page : union des codes, triés, en gardant l'ordre du bulletin (gains, total brut, cotisations, autres, total cotisation, rappels/avances)
  // Rubriques du livre : celles de TOUS les salariés du modèle (comme le bulletin : une rubrique absente d'un bulletin n'y figure pas,
  // mais une rubrique présente sur un seul bulletin du mois apparaît dans le livre, et son total est juste)
  function codesDe(cols) {
    var seen = {};
    cols.forEach(function (c) { c.rows.forEach(function (r) { if (!seen[r.key]) seen[r.key] = r; }); });
    return Object.keys(seen).map(function (k) { return seen[k]; }).sort(function (a, b) {
      return (+a.code - +b.code) || (a.lib < b.lib ? -1 : a.lib > b.lib ? 1 : 0);
    });
  }

  function ligne(label, cellules, style) {
    return '<tr style="' + (style || '') + '"><td class="l">' + label + '</td>' +
      cellules.map(function (v) { return '<td class="n">' + v + '</td>'; }).join('') + '</tr>';
  }

  function totalisation(cols) {
    var t = { brut: 0, cotisations: 0, retenues: 0, patronales: 0, net: 0, netImposable: 0, cout: 0, presence: 0, rub: {} };
    cols.forEach(function (c) {
      ['brut', 'cotisations', 'retenues', 'patronales', 'net', 'netImposable', 'cout'].forEach(function (k) { t[k] += c[k]; });
      t.presence += num(c.presence);
      c.rows.forEach(function (r) { t.rub[r.key] = (t.rub[r.key] || 0) + r.v; });
    });
    return t;
  }

  function page(cols, dernier, tous) {
    var codes = codesDe(tous);
    var tot = dernier ? totalisation(tous) : null;
    var entete = '<tr><th class="l">Rubriques</th>' + cols.map(function (c) {
      return '<th>' + esc(c.matricule) + '</th>';
    }).join('') + (dernier ? '<th>Total</th>' : '') + '</tr>' +
      '<tr><th class="l"></th>' + cols.map(function (c) { return '<th class="nom">' + esc(c.nom) + '</th>'; }).join('') +
      (dernier ? '<th class="nom">Total général</th>' : '') + '</tr>';
    // Valeur par colonne salarié ; colonne Total (c = null) sur la dernière page
    var valeurs = function (fn) {
      var out = cols.map(function (c) { return fn(c, null); });
      if (dernier) out.push(fn(null, tot));
      return out;
    };
    var rubriqueLigne = function (r) {
      return ligne(esc(r.code) + ' ' + esc(r.lib), valeurs(function (c, t) {
        if (c) return c.rub[r.key] ? fmt(c.rub[r.key].v) : '';
        return t.rub[r.key] !== undefined ? fmt(t.rub[r.key]) : '';
      }));
    };
    var TOT_STYLE = 'font-weight:700;background:#eef3fb';
    var totalBrut = function () { return ligne('<b>Total Brut</b>', valeurs(function (x, t) { return x ? fmt(x.brut) : fmt(t.brut); }), TOT_STYLE); };
    var totalCot = function () { return ligne('<b>Total Cotisation</b>', valeurs(function (x, t) { return x ? fmt(-x.cotisations) : fmt(-t.cotisations); }), TOT_STYLE); };
    // Ordre du bulletin : gains · Total Brut · cotisations (8xxx ou toutes les retenues Océan) · Total Cotisation · autres retenues · rappels/avances
    var grp = function (k) { return codes.filter(function (r) { return r.kind === k; }); };
    var corps = grp('g').map(rubriqueLigne).join('') + totalBrut() +
      grp('c').map(rubriqueLigne).join('') + totalCot() +
      grp('r').map(rubriqueLigne).join('') + grp('p').map(rubriqueLigne).join('');
    var pied = '';
    pied += ligne('Présence', valeurs(function (x, t) { var v = x ? x.presence : (t && t.presence); return v == null || v === 0 ? '' : fmt(v); }));
    pied += ligne('<b>Brut</b>', valeurs(function (x, t) { return x ? fmt(x.brut) : fmt(t.brut); }), 'font-weight:700');
    pied += ligne('Total retenues salariales', valeurs(function (x, t) { return x ? fmt(-x.retenues) : fmt(-t.retenues); }));
    pied += ligne('Cotisations patronales', valeurs(function (x, t) { return fmt((x || t).patronales); }));
    pied += ligne('<b>Net à payer</b>', valeurs(function (x, t) { return x ? fmt(x.net) : fmt(t.net); }), 'font-weight:700;background:#e4ecf8');
    pied += ligne('Net imposable', valeurs(function (x, t) { return fmt((x || t).netImposable); }));
    pied += ligne('Coût total', valeurs(function (x, t) { return fmt((x || t).cout); }));
    pied += ligne('Nombre de salariés', valeurs(function (x, t) { return x ? '1' : String(tous.length); }));
    return '<table class="livre"><thead>' + entete + '</thead><tbody>' + corps + pied + '</tbody></table>';
  }

  function enTete(opts) {
    return '<div class="lv-entete"><div><b>' + esc(opts.societe || '') + '</b></div>' +
      '<div>Livre de paie — ' + esc(opts.periode || '') + '</div>' +
      '<div>Edition en Francs CFA' + (opts.avantCloture ? ' (avant clôture mensuelle)' : '') + '</div>' +
      '<div class="lv-date">Date du jour ' + esc(opts.date || '') + '</div></div>';
  }

  // Contrôle d'unicité avant impression : code = une rubrique, matricule = un salarié, N° CNPS = un salarié
  function conflits(salaries, cols, opts) {
    var U = root.PaieUnicite;
    if (!U) return [];
    var fiches = (opts.fiches || salaries.map(function (s) {
      return { id: s.fiche && s.fiche.id, matricule: s.matricule, nom: s.nom, cnps: s.cnps || (s.fiche && s.fiche.cnps) };
    }));
    var lignes = [];
    cols.forEach(function (c) { c.rows.forEach(function (r) { lignes.push({ code: r.code, lib: r.lib }); }); });
    return [].concat(U.matricules(fiches), U.cnps(fiches), U.codes(lignes));
  }

  function generer(salaries, opts) {
    opts = opts || {};
    var cols = (salaries || []).map(colonneSalarie);
    if (!cols.length) return '<p>Aucun salarié à imprimer.</p>';
    var erreurs = conflits(salaries, cols, opts);
    if (erreurs.length) {
      return '<div style="border:2px solid #c0392b;border-radius:6px;padding:12px;font:12px Arial,sans-serif;color:#1a1a1a">' +
        '<b style="color:#c0392b">Livre de paie non imprimé : identifiants en conflit</b>' +
        '<p style="margin:6px 0">Corrigez les points suivants, puis relancez le livre :</p><ul>' +
        erreurs.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul></div>';
    }
    // Un livre ne mélange pas deux modèles : les salariés d'un autre modèle sont mis dans un livre à part
    var groupes = {};
    cols.forEach(function (c) { (groupes[c.gabarit] = groupes[c.gabarit] || []).push(c); });
    var css = '<style>.livre{border-collapse:collapse;width:100%;font:9.5px Arial,sans-serif;margin-bottom:10px}' +
      '.livre th,.livre td{border:1px solid #444;padding:2px 4px}' +
      '.livre th{background:#1f3b6f;color:#fff;font-weight:700;text-align:center}' +
      '.livre th.nom{background:#e4ecf8;color:#000;font-weight:600;font-size:8.5px}' +
      '.livre td.n{text-align:right;white-space:nowrap}.livre td.l{text-align:left;white-space:nowrap}' +
      '.lv-entete{font:10px Arial,sans-serif;margin-bottom:8px;line-height:1.4}' +
      '.lv-date{font-size:9px;color:#333}</style>';
    var html = css;
    Object.keys(groupes).forEach(function (g, gi) {
      var liste = groupes[g];
      var pages = [];
      for (var i = 0; i < liste.length; i += PAR_PAGE) pages.push(liste.slice(i, i + PAR_PAGE));
      var titre = g === 'ocean' ? 'Modèle Hôtel Océan' : 'Modèle Sage';
      pages.forEach(function (p, n) {
        var dernier = n === pages.length - 1;
        html += (gi || n ? '<div style="page-break-before:always"></div>' : '') + enTete(opts) +
          '<div style="font-size:9px;margin-bottom:4px">' + esc(titre) + ' — matricule ' + esc(p[0].matricule) + ' à ' + esc(p[p.length - 1].matricule) +
          ' — page ' + (n + 1) + '/' + pages.length + '</div>' + page(p, dernier, liste);
      });
    });
    return html;
  }

  // Salariés du mois, chacun avec le modèle qui lui est affecté (comme son bulletin)
  function depuisGrille(opts) {
    opts = opts || {};
    var fiches = (root.PRH_fichesPaie ? root.PRH_fichesPaie() : []).slice().sort(function (a, b) {
      return String(a.matricule || '').localeCompare(String(b.matricule || ''), 'fr', { numeric: true });
    });
    var taux = root.PAIE_TAUX_CACHE || {};
    var salaries = [];
    fiches.forEach(function (f) {
      var lignes = (root.PaieGrille && PaieGrille.lignesPour) ? PaieGrille.lignesPour(f.id) : [];
      if (!lignes.length) return;
      var modele = (root.PaieModeles && PaieModeles.pourSalarie) ? PaieModeles.pourSalarie(f, opts.employeur || '') : null;
      var s = { matricule: f.matricule || f.id, nom: f.nom || '', fiche: f, lignes: lignes, modele: modele, presence: f.presence, periode: opts.periode || '' };
      if (modele && modele.gabarit !== 'ocean') s.R = root.PaieMoteur.calculer(lignes, { taux: taux });
      salaries.push(s);
    });
    opts.fiches = fiches.map(function (f) { return { id: f.id, matricule: f.matricule || f.id, nom: f.nom || '', cnps: f.cnps || '' }; });
    return generer(salaries, opts);
  }

  root.PaieLivre = { generer: generer, depuisGrille: depuisGrille, colonneSalarie: colonneSalarie, PAR_PAGE: PAR_PAGE };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PaieLivre;
})(typeof window !== 'undefined' ? window : globalThis);
