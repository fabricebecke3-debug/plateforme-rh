/* graphiques.js — Graphiques SVG du tableau de bord (sans bibliothèque externe).
 * Fonctions pures : elles reçoivent des données déjà chargées par la plateforme.
 * Testées par scripts/test-graphiques.js.
 */
(function (root) {
  'use strict';
  var CLE_PREFS = 'terh_graph_prefs';
  var CFG = null;   // configuration fournie par l'application : {lire(), ecrire(obj)} — stockage par entreprise
  var TOUS = [
    { id: 'genre', titre: 'Répartition par genre' },
    { id: 'contrats', titre: 'Effectif par type de contrat' },
    { id: 'statuts', titre: 'Effectif par statut' },
    { id: 'ages', titre: "Répartition par tranche d'âge" },
    { id: 'evolution', titre: 'Entrées et sorties par mois (12 derniers mois)' },
    { id: 'absenteisme', titre: 'Taux d\'absentéisme par mois (%)' },
    { id: 'couts', titre: 'Masse salariale brute par mois (FCFA)' }
  ];
  var HEURES_MOIS = 173.33;   // horaire mensuel de référence (40 h x 52 semaines / 12)
  var COULEURS = ['#1f5fbf', '#c0392b', '#1f9d55', '#b7791f', '#7c3aed', '#0e7490'];

  function echapper(t) {
    return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function repartition(liste, champ, libelle) {
    var c = {};
    (liste || []).forEach(function (r) {
      var v = typeof champ === 'function' ? champ(r) : r[champ];
      if (v == null || v === '') v = 'Non renseigné';
      c[v] = (c[v] || 0) + 1;
    });
    return Object.keys(c).map(function (k) { return { label: libelle ? libelle(k) : k, n: c[k] }; })
      .sort(function (a, b) { return b.n - a.n; });
  }
  function tranchesAge(liste) {
    var t = [{ label: '< 25 ans', n: 0 }, { label: '25-34 ans', n: 0 }, { label: '35-44 ans', n: 0 }, { label: '45-54 ans', n: 0 }, { label: '55 ans et +', n: 0 }];
    (liste || []).forEach(function (r) {
      var a = Number(r.age);
      if (!isFinite(a) || a <= 0) return;
      if (a < 25) t[0].n++; else if (a < 35) t[1].n++; else if (a < 45) t[2].n++; else if (a < 55) t[3].n++; else t[4].n++;
    });
    return t;
  }
  // Mois glissants (12 derniers) : entrées = début du contrat en cours, sorties = date d'arrêt enregistrée
  function evolution(liste, aujourdhui, n) {
    n = n || 12;
    var d = aujourdhui instanceof Date ? aujourdhui : new Date();
    var mois = [];
    for (var i = n - 1; i >= 0; i--) {
      var x = new Date(d.getFullYear(), d.getMonth() - i, 1);
      mois.push({ cle: x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'), label: String(x.getMonth() + 1).padStart(2, '0') + '/' + String(x.getFullYear()).slice(2), entrees: 0, sorties: 0 });
    }
    var index = {}; mois.forEach(function (m) { index[m.cle] = m; });
    (liste || []).forEach(function (r) {
      var e = String(r.deb || '').slice(0, 7), s = String(r.darret || '').slice(0, 7);
      if (index[e]) index[e].entrees++;
      if (index[s]) index[s].sorties++;
    });
    return mois;
  }
  function barres(donnees, titre) {
    var max = Math.max.apply(null, [1].concat((donnees || []).map(function (d) { return d.n; })));
    var ligne = 26, gauche = 150, large = 300, h = (donnees || []).length * ligne + 8;
    var rendu = (donnees || []).map(function (d, i) {
      var y = i * ligne + 4, w = Math.round(d.n / max * (large - 40));
      return '<text x="' + (gauche - 8) + '" y="' + (y + 15) + '" text-anchor="end" font-size="12" fill="currentColor">' + echapper(d.label) + '</text>' +
        '<rect x="' + gauche + '" y="' + y + '" width="' + Math.max(w, 2) + '" height="18" rx="3" fill="#1f5fbf"></rect>' +
        '<text x="' + (gauche + w + 6) + '" y="' + (y + 14) + '" font-size="12" fill="currentColor">' + d.n + '</text>';
    }).join('');
    return '<svg viewBox="0 0 ' + (gauche + large) + ' ' + h + '" width="100%" role="img" aria-label="' + echapper(titre) + '">' + rendu + '</svg>';
  }
  function anneau(donnees, titre) {
    var total = (donnees || []).reduce(function (s, d) { return s + d.n; }, 0);
    var r = 60, c = 2 * Math.PI * r, offset = 0;
    var parts = total ? (donnees || []).map(function (d, i) {
      var len = d.n / total * c;
      var s = '<circle cx="80" cy="80" r="' + r + '" fill="none" stroke="' + COULEURS[i % COULEURS.length] + '" stroke-width="28" stroke-dasharray="' + len + ' ' + (c - len) + '" stroke-dashoffset="' + (-offset) + '" transform="rotate(-90 80 80)"></circle>';
      offset += len; return s;
    }).join('') : '';
    var legende = (donnees || []).map(function (d, i) {
      return '<div style="font-size:12px;margin:2px 0"><span style="display:inline-block;width:10px;height:10px;background:' + COULEURS[i % COULEURS.length] + ';margin-right:6px"></span>' +
        echapper(d.label) + ' : ' + d.n + (total ? ' (' + Math.round(d.n / total * 100) + ' %)' : '') + '</div>';
    }).join('');
    return '<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><svg viewBox="0 0 160 160" width="150" role="img" aria-label="' + echapper(titre) + '">' +
      '<circle cx="80" cy="80" r="' + r + '" fill="none" stroke="rgba(127,127,127,.2)" stroke-width="28"></circle>' + parts + '</svg><div>' + legende + '</div></div>';
  }
  function groupes(donnees, titre) {
    var max = Math.max.apply(null, [1].concat((donnees || []).reduce(function (a, d) { return a.concat([d.entrees, d.sorties]); }, [])));
    var larg = 26, espace = 10, h = 170, base = 140, pas = larg * 2 + espace + 14;
    var rendu = (donnees || []).map(function (d, i) {
      var x = 10 + i * pas, he = Math.round(d.entrees / max * (base - 20)), hs = Math.round(d.sorties / max * (base - 20));
      return '<rect x="' + x + '" y="' + (base - he) + '" width="' + larg + '" height="' + he + '" fill="#1f9d55"></rect>' +
        '<rect x="' + (x + larg + 4) + '" y="' + (base - hs) + '" width="' + larg + '" height="' + hs + '" fill="#c0392b"></rect>' +
        '<text x="' + (x + larg) + '" y="' + (base + 14) + '" text-anchor="middle" font-size="10" fill="currentColor">' + echapper(d.label) + '</text>';
    }).join('');
    var w = 10 + (donnees || []).length * pas;
    return '<div style="font-size:12px;margin-bottom:4px"><span style="color:#1f9d55">■</span> entrées &nbsp; <span style="color:#c0392b">■</span> sorties</div>' +
      '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" role="img" aria-label="' + echapper(titre) + '">' + rendu + '</svg>' +
      '<div class="muted" style="font-size:11px;margin-top:4px">Entrées : début du contrat en cours. Sorties : date d\'arrêt enregistrée. Ce n\'est pas un historique complet des effectifs.</div>';
  }
  // Colonnes verticales (valeurs mensuelles)
  function colonnes(points, titre, unite) {
    var vals = (points || []).map(function (p) { return p.v; }).filter(function (v) { return v != null && isFinite(v); });
    var max = Math.max.apply(null, [1].concat(vals));
    var larg = 22, pas = 34, base = 130, h = 170;
    var rendu = (points || []).map(function (p, i) {
      var v = p.v == null ? 0 : p.v, he = Math.round(v / max * (base - 20)), x = 10 + i * pas;
      return '<rect x="' + x + '" y="' + (base - he) + '" width="' + larg + '" height="' + Math.max(he, 0) + '" fill="#1f5fbf"></rect>' +
        '<text x="' + (x + larg / 2) + '" y="' + (base - he - 4) + '" text-anchor="middle" font-size="9" fill="currentColor">' + (p.v == null ? '—' : (Math.round(v * 10) / 10)) + '</text>' +
        '<text x="' + (x + larg / 2) + '" y="' + (base + 14) + '" text-anchor="middle" font-size="9" fill="currentColor">' + echapper(p.label) + '</text>';
    }).join('');
    var w = 20 + (points || []).length * pas;
    return '<div class="muted" style="font-size:11px;margin-bottom:4px">' + echapper(unite) + '</div>' +
      '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" role="img" aria-label="' + echapper(titre) + '">' + rendu + '</svg>';
  }
  var DONNEES = {};
  function configurer(c) { CFG = c; }
  // Objet de préférences : {ordre:[ids dans l'ordre], actifs:[ids affichés], position:'avant'|'apres'}
  function prefsObjet() {
    var defaut = { ordre: TOUS.map(function (t) { return t.id; }), actifs: TOUS.map(function (t) { return t.id; }), position: 'avant' };
    var lu = null;
    try { lu = CFG ? CFG.lire() : JSON.parse(root.localStorage ? root.localStorage.getItem(CLE_PREFS) : 'null'); } catch (e) { lu = null; }
    if (!lu || typeof lu !== 'object') return defaut;
    var ids = TOUS.map(function (t) { return t.id; });
    var ordre = (Array.isArray(lu.ordre) ? lu.ordre : []).filter(function (x) { return ids.indexOf(x) >= 0; });
    ids.forEach(function (x) { if (ordre.indexOf(x) < 0) ordre.push(x); });
    var actifs = Array.isArray(lu.actifs) ? lu.actifs.filter(function (x) { return ids.indexOf(x) >= 0; }) : ids;
    return { ordre: ordre, actifs: actifs, position: lu.position === 'apres' ? 'apres' : 'avant' };
  }
  function prefsEcrire(obj, persister) {
    try { if (CFG) { return CFG.ecrire(obj, !!persister); } else if (root.localStorage) root.localStorage.setItem(CLE_PREFS, JSON.stringify(obj)); } catch (e) {}
    return null;
  }
  // Liste des graphiques à afficher, dans l'ordre choisi
  function prefsLire() {
    var o = prefsObjet();
    return o.ordre.filter(function (x) { return o.actifs.indexOf(x) >= 0; });
  }
  // Mois glissants : 'AAAA-MM' et libellé court
  function moisGlissants(n, aujourdhui) {
    var d = aujourdhui instanceof Date ? aujourdhui : new Date(), out = [];
    for (var i = n - 1; i >= 0; i--) {
      var x = new Date(d.getFullYear(), d.getMonth() - i, 1);
      out.push({ cle: x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'), label: String(x.getMonth() + 1).padStart(2, '0') + '/' + String(x.getFullYear()).slice(2) });
    }
    return out;
  }
  // Effectif présent en fin de mois : entré avant la fin du mois et non sorti avant le début
  function effectifFinMois(liste, cle) {
    var fin = cle + '-31', debut = cle + '-01', n = 0;
    (liste || []).forEach(function (r) {
      var entree = String(r.deb || '').slice(0, 10), sortie = String(r.darret || '').slice(0, 10);
      if (entree && entree > fin) return;
      if (sortie && sortie < debut) return;
      n++;
    });
    return n;
  }
  // Absentéisme : heures d'absence / heures théoriques du mois (effectif x 173,33 h)
  function absenteismeMensuel(employes, absences, aujourdhui, n) {
    return moisGlissants(n || 12, aujourdhui).map(function (m) {
      var heures = 0, nb = 0;
      (absences || []).forEach(function (a) {
        if (String(a.date || '').slice(0, 7) !== m.cle) return;
        heures += Number(a.duree_heures) || 0; nb++;
      });
      var eff = effectifFinMois(employes, m.cle);
      var theo = eff * HEURES_MOIS;
      return { cle: m.cle, mois: m.label, effectif: eff, heuresAbsence: Math.round(heures * 100) / 100, nbAbsences: nb,
        tauxPct: theo > 0 ? Math.round(heures / theo * 10000) / 100 : null };
    });
  }
  // Coûts : bulletins du mois (hors brouillons) — masse brute, retenues, net, nombre de bulletins
  function coutsMensuels(paies, aujourdhui, n) {
    return moisGlissants(n || 12, aujourdhui).map(function (m) {
      var brut = 0, net = 0, ret = 0, nb = 0;
      (paies || []).forEach(function (p) {
        if (String(p.mois || '').slice(0, 7) !== m.cle) return;
        if (p.statut === 'Brouillon') return;
        var b = (Number(p.salaire_base) || 0) + (Number(p.primes) || 0) + (Number(p.heures_sup) || 0);
        brut += b; net += Number(p.net_a_payer) || 0; ret += Number(p.retenues) || 0; nb++;
      });
      return { cle: m.cle, mois: m.label, bulletins: nb, masseBrute: Math.round(brut), retenues: Math.round(ret), netAPayer: Math.round(net) };
    });
  }
  // Tableau unique « Power BI » : une ligne par mois
  function indicateursCsvRows(employes, absences, paies, aujourdhui) {
    var ab = absenteismeMensuel(employes, absences, aujourdhui, 12);
    var co = coutsMensuels(paies, aujourdhui, 12);
    return ab.map(function (a, i) {
      return { Mois: a.cle, Effectif: a.effectif, 'Heures absence': a.heuresAbsence, 'Nombre absences': a.nbAbsences,
        'Taux absentéisme (%)': a.tauxPct, Bulletins: co[i].bulletins, 'Masse salariale brute (FCFA)': co[i].masseBrute,
        'Retenues (FCFA)': co[i].retenues, 'Net à payer (FCFA)': co[i].netAPayer };
    });
  }
  // Chiffres du graphique, lignes à plat (pour le CSV)
  function donneesGraphique(id, E, aujourdhui) {
    if (id === 'genre') return repartition(E, function (r) { return r.g === 'F' ? 'Féminin' : (r.g === 'M' ? 'Masculin' : null); }).map(function (x) { return { Catégorie: x.label, Effectif: x.n }; });
    if (id === 'contrats') return repartition(E, 't').map(function (x) { return { Catégorie: x.label, Effectif: x.n }; });
    if (id === 'statuts') return repartition(E, 'sc').map(function (x) { return { Catégorie: x.label, Effectif: x.n }; });
    if (id === 'ages') return tranchesAge(E).map(function (x) { return { Catégorie: x.label, Effectif: x.n }; });
    if (id === 'evolution') return evolution(E, aujourdhui || new Date(), 12).map(function (x) { return { Mois: x.label, Entrées: x.entrees, Sorties: x.sorties }; });
    if (id === 'absenteisme') return absenteismeMensuel(E, DONNEES.absences || [], aujourdhui || new Date(), 12).map(function (x) { return { Mois: x.mois, 'Taux (%)': x.tauxPct, 'Heures absence': x.heuresAbsence, Effectif: x.effectif }; });
    if (id === 'couts') return coutsMensuels(DONNEES.paie || [], aujourdhui || new Date(), 12).map(function (x) { return { Mois: x.mois, 'Masse brute (FCFA)': x.masseBrute, 'Net à payer (FCFA)': x.netAPayer, Bulletins: x.bulletins }; });
    return [];
  }
  // CSV compatible Excel français et Power BI : séparateur « ; », UTF-8 avec BOM
  function csvGraphique(lignes) {
    if (!lignes || !lignes.length) return '\ufeff';
    var cles = Object.keys(lignes[0]);
    var cel = function (v) { var t = typeof v === 'number' ? String(v) : String(v == null ? '' : v); return /[;"\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    return '\ufeff' + [cles.join(';')].concat(lignes.map(function (r) { return cles.map(function (k) { return cel(r[k]); }).join(';'); })).join('\r\n');
  }
  // Panneau : choix des graphiques (mémorisé dans ce navigateur) puis graphiques sélectionnés
  function panneau(employes, prefs, donnees) {
    var E = employes || [];
    DONNEES = donnees || DONNEES || {};
    var choisis = prefs || prefsLire();   // ordre et sélection
    var cases = TOUS.map(function (t) {
      return '<label style="font-size:12px;margin-right:12px"><input type="checkbox" data-gr-pref="' + t.id + '"' + (choisis.indexOf(t.id) >= 0 ? ' checked' : '') + '> ' + echapper(t.titre) + '</label>';
    }).join('');
    var figures = {
      genre: function () { return anneau(repartition(E, function (r) { return r.g === 'F' ? 'Féminin' : (r.g === 'M' ? 'Masculin' : null); }), 'Répartition par genre'); },
      contrats: function () { return barres(repartition(E, 't'), 'Effectif par type de contrat'); },
      statuts: function () { return barres(repartition(E, 'sc'), 'Effectif par statut'); },
      ages: function () { return barres(tranchesAge(E), "Répartition par tranche d'âge"); },
      evolution: function () { return groupes(evolution(E, new Date(), 12), 'Entrées et sorties par mois'); },
      absenteisme: function () {
        var ab = absenteismeMensuel(E, DONNEES.absences || [], new Date(), 12);
        if (!(DONNEES.absences || []).length) return '<div class="muted">Aucune absence enregistrée dans le module Absences.</div>';
        return colonnes(ab.map(function (x) { return { label: x.mois, v: x.tauxPct }; }), 'Taux d\'absentéisme par mois', 'Heures d\'absence / heures théoriques (effectif × 173,33 h). L\'effectif est reconstitué à partir des dates d\'entrée et d\'arrêt.');
      },
      couts: function () {
        var co = coutsMensuels(DONNEES.paie || [], new Date(), 12);
        if (!(DONNEES.paie || []).length) return '<div class="muted">Aucun bulletin dans le module Paie.</div>';
        return colonnes(co.map(function (x) { return { label: x.mois, v: x.masseBrute }; }), 'Masse salariale brute par mois', 'Salaire de base + primes + heures supplémentaires, bulletins hors brouillons.');
      }
    };
    var cartes = choisis.map(function (id) { return TOUS.filter(function (t) { return t.id === id; })[0]; }).filter(Boolean).map(function (t) {
      var rows = encodeURIComponent(JSON.stringify(donneesGraphique(t.id, E, new Date())));
      var btn = function (cls, label) { return '<button class="s" type="button" data-gr-' + cls + '="' + t.id + '" style="font-size:11px;padding:2px 7px">' + label + '</button>'; };
      return '<div class="c" data-gr-rows="' + rows + '" style="padding:12px"><div class="gr-entete" style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px"><b style="font-size:13px">' + echapper(t.titre) + '</b>' +
        '<span class="gr-btns" style="display:flex;gap:4px;flex-wrap:wrap">' + btn('png', '🖼️ PNG') + btn('svg', '🧩 SVG') + btn('pdf', '📄 PDF') + btn('csv', '📊 CSV') + '</span></div>' + figures[t.id]() + '</div>';
    }).join('');
    return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;margin-top:8px">' + (cartes || '<div class="muted">Aucun graphique sélectionné.</div>') + '</div>';
  }
  // Export PNG d'un graphique : SVG → image → fichier (hors ligne, aucune bibliothèque)
  function exporterPng(carte, nom) {
    var svg = carte.querySelector('svg');
    if (!svg) return;
    var clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    var vb = (svg.getAttribute('viewBox') || '0 0 400 300').split(/\s+/).map(Number);
    var l = vb[2] || 400, h = vb[3] || 300, echelle = 2;
    clone.setAttribute('width', l); clone.setAttribute('height', h);
    clone.style.color = '#1a1a1a';
    var xml = new XMLSerializer().serializeToString(clone);
    var img = new Image();
    img.onload = function () {
      var c = document.createElement('canvas');
      c.width = l * echelle; c.height = h * echelle;
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.scale(echelle, echelle); ctx.drawImage(img, 0, 0, l, h);
      c.toBlob(function (blob) {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = (nom || 'graphique').replace(/[^a-zA-Z0-9_-]+/g, '-') + '.png';
        document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      }, 'image/png');
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
  }
  function telechargerTexte(nom, contenu, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([contenu], { type: type }));
    a.download = nom;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  // SVG : image vectorielle, nette à toutes les tailles
  function exporterSvg(carte, nom) {
    var svg = carte.querySelector('svg');
    if (!svg) return;
    var clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.style.color = '#1a1a1a';
    telechargerTexte(nom.replace(/[^a-zA-Z0-9_-]+/g, '-') + '.svg', '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone), 'image/svg+xml;charset=utf-8');
  }
  // PDF : boîte d'impression ne contenant que ce graphique (choisir « Enregistrer au format PDF »)
  function imprimerGraphique(carte) {
    var st = document.getElementById('gr_print_style');
    if (!st) {
      st = document.createElement('style'); st.id = 'gr_print_style';
      st.textContent = '#gr_print{display:none}@media print{body>*:not(#gr_print){display:none!important}html body>#gr_print{display:block!important;position:static;background:#fff;color:#000;padding:18mm;font-family:Arial,sans-serif}html body>#gr_print .gr-btns{display:none!important}}';
      document.head.appendChild(st);
    }
    var d = document.getElementById('gr_print') || document.createElement('div');
    d.id = 'gr_print';
    d.innerHTML = carte.innerHTML;
    d.querySelectorAll('.gr-btns').forEach(function (x) { x.remove(); });
    if (!d.parentNode) document.body.appendChild(d);
    var fin = function () { d.innerHTML = ''; window.removeEventListener('afterprint', fin); };
    window.addEventListener('afterprint', fin);
    window.print();
  }
  // Contrôle : le nombre de fiches représentées doit égaler le nombre réel sur le serveur
  function controleBase(chargees, serveur) {
    if (serveur == null || isNaN(serveur)) return { ok: null, message: '' };
    if (Number(chargees) === Number(serveur)) return { ok: true, message: '' };
    return { ok: false, message: 'Attention : ' + chargees + ' fiche(s) chargée(s) sur ' + serveur + ' sur le serveur. Les graphiques sont incomplets : rechargez la page (Ctrl+F5).' };
  }
  // Branchement des cases à cocher et des boutons PNG (une seule fois, côté navigateur)
  if (typeof document !== 'undefined' && document.addEventListener) {
    var rafraichir = function () {
      if (typeof root.refreshGraphiques === 'function') root.refreshGraphiques();
      var pane = document.getElementById('pane-gra');
      if (pane) pane.innerHTML = choixHTML();
    };
    document.addEventListener('change', function (e) {
      var c = e.target && e.target.closest && e.target.closest('[data-gr-actif]');
      var pos = e.target && e.target.closest && e.target.closest('[data-gr-pos]');
      if (!c && !pos) return;
      var o = prefsObjet();
      if (c) { var id = c.dataset.grActif; o.actifs = c.checked ? o.actifs.concat([id]).filter(function (x, i, a) { return a.indexOf(x) === i; }) : o.actifs.filter(function (x) { return x !== id; }); }
      if (pos) o.position = pos.dataset.grPos;
      prefsEcrire(o); rafraichir();
    });
    document.addEventListener('click', function (e) {
      var mv = e.target && e.target.closest && e.target.closest('[data-gr-up],[data-gr-down]');
      if (mv) {
        var o = prefsObjet(), id2 = mv.dataset.grUp || mv.dataset.grDown, i = o.ordre.indexOf(id2), j = mv.dataset.grUp ? i - 1 : i + 1;
        if (j >= 0 && j < o.ordre.length) { var t = o.ordre[j]; o.ordre[j] = id2; o.ordre[i] = t; prefsEcrire(o); rafraichir(); }
        return;
      }
      var sv = e.target && e.target.closest && e.target.closest('[data-gr-save]');
      if (sv) {
        var r = prefsEcrire(prefsObjet(), true);
        if (CFG && r && typeof r.then === 'function') r.then(function () { if (typeof root.toast === 'function') root.toast('Graphiques enregistrés pour l\'entreprise.'); });
        return;
      }
      var b = e.target && e.target.closest && e.target.closest('[data-gr-png],[data-gr-svg],[data-gr-pdf],[data-gr-csv]');
      if (!b) return;
      var carte = b.closest('.c');
      if (!carte) return;
      var id = b.dataset.grPng || b.dataset.grSvg || b.dataset.grPdf || b.dataset.grCsv;
      if (b.dataset.grPng) exporterPng(carte, 'graphique-' + id);
      else if (b.dataset.grSvg) exporterSvg(carte, 'graphique-' + id);
      else if (b.dataset.grPdf) imprimerGraphique(carte);
      else if (b.dataset.grCsv) {
        var lignes = []; try { lignes = JSON.parse(decodeURIComponent(carte.dataset.grRows || '%5B%5D')); } catch (x) {}
        telechargerTexte('graphique-' + id + '.csv', csvGraphique(lignes), 'text/csv;charset=utf-8');
      }
    });
  }
  // Liste des graphiques affichés : utilisée dans Paramètres > Graphiques
  function choixHTML(){
    var o = prefsObjet();
    var lignes = o.ordre.map(function (id, i) {
      var t = TOUS.filter(function (x) { return x.id === id; })[0];
      return '<div style="display:flex;align-items:center;gap:8px;margin:6px 0;font-size:13px">' +
        '<button class="s" type="button" data-gr-up="' + id + '" style="padding:2px 7px"' + (i === 0 ? ' disabled' : '') + '>▲</button>' +
        '<button class="s" type="button" data-gr-down="' + id + '" style="padding:2px 7px"' + (i === o.ordre.length - 1 ? ' disabled' : '') + '>▼</button>' +
        '<label style="flex:1"><input type="checkbox" data-gr-actif="' + id + '"' + (o.actifs.indexOf(id) >= 0 ? ' checked' : '') + '> ' + echapper(t.titre) + '</label></div>';
    }).join('');
    return '<div class="c" style="padding:14px;max-width:700px"><h2 style="margin-top:0">📊 Graphiques du tableau de bord</h2>' +
      '<p class="muted" style="font-size:12px;margin:0 0 8px">Cochez les graphiques à afficher et ordonnez-les avec ▲ ▼. Le réglage est enregistré pour toute l\'entreprise.</p>' +
      lignes +
      '<div style="margin:10px 0;font-size:13px">Position sur le tableau de bord : ' +
      '<label style="margin-right:12px"><input type="radio" name="gr_pos" data-gr-pos="avant"' + (o.position === 'avant' ? ' checked' : '') + '> au-dessus des widgets</label>' +
      '<label><input type="radio" name="gr_pos" data-gr-pos="apres"' + (o.position === 'apres' ? ' checked' : '') + '> en dessous des widgets</label></div>' +
      '<button class="p" type="button" data-gr-save="1">Enregistrer</button></div>';
  }
  var API = { configurer: configurer, prefsObjet: prefsObjet, choixHTML: choixHTML, absenteismeMensuel: absenteismeMensuel, coutsMensuels: coutsMensuels, indicateursCsvRows: indicateursCsvRows, effectifFinMois: effectifFinMois, repartition: repartition, tranchesAge: tranchesAge, evolution: evolution, barres: barres, anneau: anneau, groupes: groupes, donneesGraphique: donneesGraphique, csvGraphique: csvGraphique,
    panneau: panneau, controleBase: controleBase, prefsLire: prefsLire, prefsEcrire: prefsEcrire, TOUS: TOUS, echapper: echapper };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.GraphiquesTdb = API;
})(typeof window !== 'undefined' ? window : globalThis);
