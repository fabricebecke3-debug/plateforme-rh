/* paie-grille.js : grille de saisie (style tableur) des jours OU des heures par salarié.
 * - Saisir des jours calcule les heures, et inversement (heures du mois = calcul automatique).
 * - Heures supplémentaires par défaut selon le cours (120 %, 130 %, 140 %, dimanche 140 %, nuit 150 %, férié 200 %),
 *   taux horaire = salaire de base ÷ 173,33. Le samedi compte comme jour ouvrable (120 %).
 * - Formules modifiables par profil (bouton Paramètres). Variables : fraction, jours, heures, base, diviseur_hs,
 *   samedi, hs120, hs130, hs140, hs_dim, hs_nuit, hs_ferie.
 * PaieGrille.ouvrir()          : grille + paramètres + export Excel.
 * PaieGrille.lignesPour(id)    : lignes de rubriques d'un salarié (reprises par le bulletin détaillé).
 * PaieGrille.heuresDuMois(st, mois) : heures du mois (calendrier : jours ouvrables lun-ven hors fériés × 8).
 */
(function (root) {
  'use strict';

  var CLE_BASE = 'terh_paie_grille';
  function cle() {
    var co = '';
    try { co = (typeof CO !== 'undefined' && CO) ? String(CO) : ''; } catch (e) { co = ''; }
    return co ? CLE_BASE + '_' + co : CLE_BASE;
  }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(n) { return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function arrondi2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function nouvelId(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function copie(o) { return JSON.parse(JSON.stringify(o)); }

  var NATURES = {
    salaire: 'Salaire (imposable, cotisable CNPS)',
    transport: 'Transport (imposable, hors CNPS et CFC)',
    logement_avantage: 'Logement en avantage (imposable, cotisable CNPS, hors CFC)',
    remboursement: 'Remboursement (non imposable, hors CNPS et CFC)',
    indemnite_non_cotisable: 'Indemnité hors CNPS (imposable, hors CFC)'
  };
  var MODES_HEURES = {
    calendrier: 'Calendrier : jours ouvrables (lun.-ven.) hors fériés × 8 h',
    quarante: 'Quatre semaines × 40 h (méthode de votre fichier Excel : 160 h)',
    manuel: 'Saisie manuelle'
  };
  // Heures supplémentaires selon le cours (section 5.3) ; dimanche + nuit : un seul taux, le plus favorable
  var RUB_HS = [
    { code: '1110', lib: 'Heures sup. 120 % (samedi et 8 premières)', nature: 'salaire', expr: 'base/diviseur_hs*1.2*(samedi+hs120)' },
    { code: '1130', lib: 'Heures sup. 130 % (8 suivantes)', nature: 'salaire', expr: 'base/diviseur_hs*1.3*hs130' },
    { code: '1140', lib: 'Heures sup. 140 % (au-delà de 16 h, dimanche)', nature: 'salaire', expr: 'base/diviseur_hs*1.4*(hs140+hs_dim)' },
    { code: '1150', lib: 'Heures sup. 150 % (nuit)', nature: 'salaire', expr: 'base/diviseur_hs*1.5*hs_nuit' },
    { code: '1160', lib: 'Heures sup. 200 % (jour férié)', nature: 'salaire', expr: 'base/diviseur_hs*2*hs_ferie' }
  ];
  // Salaire de base proratisé au nombre de jours saisis (fraction = jours ÷ jours du mois)
  var RUB_SALAIRE = { code: '1000', lib: 'Salaire de base (proratisé aux jours)', nature: 'salaire', expr: 'base*fraction' };
  function rubs(liste) { return [copie(RUB_SALAIRE)].concat(liste.concat(RUB_HS.map(copie))); }

  // Valeurs de départ : montants de vos fichiers Excel ; heures sup. selon le cours
  var DEFAUT = {
    jours_mois: 30,
    heures_methode: 'calendrier',
    heures_mois_manuel: 173.33,
    diviseur_hs: 173.33,
    fériés: ['01-01', '02-11', '05-01', '05-20', '08-15', '12-25'],
    paques_feries: true,
    mois: '',
    profils: [],
    saisies: {}
  };

  // Profils pré-remplis d'anciennes versions : ils ne concernent que d'autres sociétés, on les retire partout
  var PROFILS_RETIRES = ['Hôtesses et stewards', 'Machine operator'];
  function nettoyer(st) {
    if (!st || !Array.isArray(st.profils) || st.profils_nettoyes) return false;
    st.profils = st.profils.filter(function (p) { return PROFILS_RETIRES.indexOf(p.nom) < 0; });
    // Saisies qui pointaient vers un profil retiré : retour à la lecture automatique du poste
    Object.keys(st.saisies || {}).forEach(function (id) {
      var sv = st.saisies[id];
      if (sv && sv.profilManuel && !st.profils.some(function (p) { return p.id === sv.profil; })) { sv.profilManuel = false; sv.profil = ''; }
    });
    st.profils_nettoyes = true;
    return true;
  }
  // Profils existants : ajoute la rubrique de salaire de base (une seule fois)
  function ajouterSalaire(st) {
    if (!st || !Array.isArray(st.profils) || st.salaire_ajoute) return false;
    st.profils.forEach(function (p) {
      p.rubriques = Array.isArray(p.rubriques) ? p.rubriques : [];
      if (!p.rubriques.some(function (r) { return /fraction/.test(r.expr || ''); })) p.rubriques.unshift(copie(RUB_SALAIRE));
    });
    st.salaire_ajoute = true;
    return true;
  }
  function charger() {
    var st = null;
    try {
      var b = root.localStorage && root.localStorage.getItem(cle());
      if (b) st = JSON.parse(b);
    } catch (e) { st = null; }
    if (!st || !Array.isArray(st.profils)) st = copie(DEFAUT);
    st.saisies = st.saisies || {};
    var chg = nettoyer(st), sal = ajouterSalaire(st);
    if (chg || sal) enregistrerLocal(st);
    return st;
  }
  function enregistrerLocal(st) {
    try { root.localStorage && root.localStorage.setItem(cle(), JSON.stringify(st)); } catch (e) {}
  }
  function sauver(st) {
    enregistrerLocal(st);
    var pont = root.TERH_paieGrille;
    if (pont && pont.save) {
      return Promise.resolve(pont.save(st)).catch(function (e) { console.error('Grille : sauvegarde base impossible', e); throw e; });
    }
    return Promise.resolve();
  }

  // Évaluation sûre des formules : nombres, + - * /, parenthèses et variables (aucun eval)
  function evaluer(expr, vars) {
    var src = String(expr == null ? '' : expr).replace(/\s+/g, '').replace(/,/g, '.');
    if (src === '') return 0;
    if (!/^[0-9A-Za-z_.+\-*\/()]+$/.test(src)) throw new Error('caractères non permis');
    var pos = 0;
    function lire() { return src.charAt(pos); }
    function expression() {
      var v = terme();
      while (lire() === '+' || lire() === '-') {
        var op = src.charAt(pos++);
        var d = terme();
        v = op === '+' ? v + d : v - d;
      }
      return v;
    }
    function terme() {
      var v = facteur();
      while (lire() === '*' || lire() === '/') {
        var op = src.charAt(pos++);
        var d = facteur();
        if (op === '/' && d === 0) throw new Error('division par zéro');
        v = op === '*' ? v * d : v / d;
      }
      return v;
    }
    function facteur() {
      if (lire() === '-') { pos++; return -facteur(); }
      if (lire() === '(') {
        pos++;
        var v = expression();
        if (lire() !== ')') throw new Error('parenthèse manquante');
        pos++;
        return v;
      }
      var m = src.slice(pos).match(/^(\d+(\.\d+)?|\.\d+|[A-Za-z_][A-Za-z_0-9]*)/);
      if (!m) throw new Error('élément inattendu');
      pos += m[0].length;
      if (/^[0-9.]/.test(m[0])) return parseFloat(m[0]);
      if (!Object.prototype.hasOwnProperty.call(vars, m[0])) throw new Error('variable inconnue : ' + m[0]);
      return Number(vars[m[0]]) || 0;
    }
    var r = expression();
    if (pos !== src.length) throw new Error('fin de formule inattendue');
    if (!isFinite(r)) throw new Error('résultat invalide');
    return r;
  }

  // Pâques (algorithme anonyme grégorien) : vendredi saint et lundi de Pâques
  function paques(an) {
    var a = an % 19, b = Math.floor(an / 100), c = an % 100, d = Math.floor(b / 4), e = b % 4;
    var f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    var h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    var l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    var mois = Math.floor((h + l - 7 * m + 114) / 31), jour = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(an, mois - 1, jour);
  }
  function clef(d) { return ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function moisCourant() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
  }
  // Heures du mois selon la méthode choisie
  function heuresDuMois(st, mois) {
    if (st.heures_methode === 'manuel') return Number(st.heures_mois_manuel) || 173.33;
    if (st.heures_methode === 'quarante') return 160;
    var m = /^(\d{4})-(\d{2})$/.exec(mois || st.mois || moisCourant());
    if (!m) return 173.33;
    var an = +m[1], mo = +m[2];
    var feries = (st.fériés || []).slice();
    if (st.paques_feries !== false) {
      var p = paques(an);
      var vs = new Date(p.getTime() - 2 * 86400000), lp = new Date(p.getTime() + 86400000);
      feries.push(clef(vs), clef(lp));
    }
    var jours = new Date(an, mo, 0).getDate(), n = 0;
    for (var j = 1; j <= jours; j++) {
      var d = new Date(an, mo - 1, j), dow = d.getDay();
      if (dow >= 1 && dow <= 5 && feries.indexOf(clef(d)) < 0) n++;
    }
    return n * 8;
  }

  // Jours et heures se déduisent l'un de l'autre à partir des jours et heures du mois
  function variables(st, s) {
    var jm = Number(st.jours_mois) || 30, hm = heuresDuMois(st, s.mois) || 173.33;
    var v = Number(s.valeur) || 0;
    var enHeures = s.unite === 'heures';
    var nb = function (x) { return Number(x) || 0; };
    return {
      fraction: enHeures ? v / hm : v / jm,
      jours: enHeures ? v * jm / hm : v,
      heures: enHeures ? v : v * hm / jm,
      base: nb(s.base),
      diviseur_hs: Number(st.diviseur_hs) || 173.33,
      samedi: nb(s.samedi), hs120: nb(s.hs120), hs130: nb(s.hs130), hs140: nb(s.hs140),
      hs_dim: nb(s.hs_dim), hs_nuit: nb(s.hs_nuit), hs_ferie: nb(s.hs_ferie)
    };
  }
  function profil(st, id) {
    return st.profils.filter(function (p) { return p.id === id; })[0] || st.profils[0] || null;
  }
  function saisieValide(s) { return !!s && ((s.valeur !== '' && s.valeur != null) || hasHS(s)); }
  function hasHS(s) {
    return ['samedi', 'hs120', 'hs130', 'hs140', 'hs_dim', 'hs_nuit', 'hs_ferie'].some(function (k) { return s[k] !== '' && s[k] != null; });
  }

  // Lignes de rubriques d'un salarié (montants arrondis au franc)
  function nombreF(v) { var x = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return isFinite(x) ? x : 0; }
  // Montant de la fiche pour une rubrique : colonne précisée, sinon la rubrique correspondante de la fiche
  function montantFiche(fiche, r) {
    if (!fiche) return 0;
    var col = fiche.colonnes || {};
    if (r.colonne) {
      var k = Object.keys(col).filter(function (x) { return x.toLowerCase().indexOf(String(r.colonne).toLowerCase()) >= 0; })[0];
      return k ? nombreF(col[k]) : 0;
    }
    var mf = (root.PaieDetail && PaieDetail.montantsFiche) ? PaieDetail.montantsFiche(fiche) : {};
    return mf[String(r.code)] || 0;
  }
  // Profil automatique : celui dont un mot-clé figure dans le poste de la fiche ; sinon le profil « sans mot-clé »
  function clePoste(t) {
    return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’`]/g, "'").toUpperCase();
  }
  // Correspondance par poste rattaché (cases à cocher) ou mot-clé, sans repli
  function profilMots(st, poste) {
    var pz = clePoste(poste);
    var trouve = st.profils.filter(function (p) {
      return (p.postes || []).some(function (k) {
        var c = clePoste(k).trim();
        if (!c) return false;
        if (c.indexOf(' ') >= 0) return pz.indexOf(c) >= 0;
        return pz.split(/[^A-Z0-9]+/).some(function (w) { return w.indexOf(c) === 0; });
      });
    })[0];
    return trouve || null;
  }
  function profilAuto(st, poste) {
    return profilMots(st, poste);
  }
  // Profil effectif d'un salarié : choix manuel, sinon profil automatique d'après le poste de la fiche
  function profilDe(st, s, fiche) {
    if (!s) return null;
    if (s.profilManuel) return st.profils.filter(function (x) { return x.id === s.profil; })[0] || null;
    return profilAuto(st, fiche ? fiche.poste : '');
  }
  function lignesDe(st, s, fiche) {
    if (!saisieValide(s)) return [];
    var p = profilDe(st, s, fiche);
    if (!p) return [];
    // Salaire de base : celui saisi, à défaut celui de la fiche
    var s2 = Object.assign({}, s, { base: (s.base !== '' && s.base != null) ? s.base : (fiche ? nombreF(fiche.sb) : 0) });
    var vars0 = variables(st, s2), out = [];
    p.rubriques.forEach(function (r) {
      if (!r.code) return;
      var m = montantFiche(fiche, r);
      if (r.fiche && !m) return;          // rubrique issue de la fiche sans montant pour ce salarié
      var vars = Object.assign({}, vars0, { m: m });
      var montant = 0, erreur = null;
      try { montant = evaluer(r.expr, vars); } catch (e) { erreur = e.message; }
      var nature = r.nature || 'salaire';
      var l = { code: String(r.code), lib: r.lib || '', gain: Math.round(montant), nature: nature, auto: true, grille: true };
      if (erreur) l.erreur = erreur;
      if (root.PaieMoteur && PaieMoteur.drapeaux) Object.assign(l, PaieMoteur.drapeaux(nature));
      out.push(l);
    });
    return out;
  }
  // Appelé par le bulletin détaillé à la sélection d'un salarié (et à chaque modification)
  function lignesPour(id) {
    var st = charger();
    var fiche = (root.TERH_fichesPaie ? root.TERH_fichesPaie() : []).filter(function (x) { return String(x.id) === String(id); })[0] || null;
    return lignesDe(st, st.saisies[String(id)], fiche).filter(function (l) { return !l.erreur; });
  }

  // Export au format Excel (SpreadsheetML) : une feuille par profil, formules SUM pour les totaux
  function exporterXls(st, emps) {
    var cellule = function (v, style, formule) {
      var t = typeof v === 'number' ? 'Number' : 'String';
      return '<Cell' + (style ? ' ss:StyleID="' + style + '"' : '') + (formule ? ' ss:Formula="' + esc(formule) + '"' : '') + '><Data ss:Type="' + t + '">' + esc(v) + '</Data></Cell>';
    };
    var lettre = function (n) { var s = ''; n++; while (n > 0) { var r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };
    var feuilles = st.profils.map(function (p) {
      var entete = ['Salarié', 'Mois', 'Jours', 'Heures', 'Samedi (h)', 'HS 120 %', 'HS 130 %', 'HS 140 %', 'Dimanche (h)', 'Nuit (h)', 'Férié (h)', 'Salaire de base'];
      var ruKeys = p.rubriques.map(function (r) { return r.code + ' ' + (r.lib || ''); });
      var titres = entete.concat(ruKeys, ['Brut total']);
      var rows = ['<Row>' + titres.map(function (t) { return cellule(t, 'h'); }).join('') + '</Row>'];
      var lignesEmp = emps.filter(function (e) { var s = st.saisies[e.id]; var pe = s && profilDe(st, s, e.fiche); return pe && pe.id === p.id; });
      lignesEmp.forEach(function (e) {
        var s = st.saisies[e.id];
        var vars = variables(st, s);
        var ls = lignesDe(st, s, e.fiche);
        var valeurs = {};
        ls.forEach(function (l) { valeurs[l.code + ' ' + (l.lib || '')] = l.gain; });
        var cels = [e.nom, s.mois || '', arrondi2(vars.jours), arrondi2(vars.heures), Number(s.samedi) || 0, Number(s.hs120) || 0, Number(s.hs130) || 0, Number(s.hs140) || 0, Number(s.hs_dim) || 0, Number(s.hs_nuit) || 0, Number(s.hs_ferie) || 0, Number(s.base) || 0];
        ruKeys.forEach(function (k) { cels.push(valeurs[k] || 0); });
        var n = ruKeys.length;
        var rang = rows.length + 1;
        var xs = cels.map(function (v, i) { return cellule(v, i >= 11 ? 'n' : ''); }).join('');
        var brut = cellule(ls.reduce(function (t, l) { return t + (Number(l.gain) || 0); }, 0), 'n', n ? '=SUM(RC[-' + n + "]:RC[-1])" : '');
        rows.push('<Row>' + xs + brut + '</Row>');
      });
      var total = "";
      if (lignesEmp.length) {
        var rT = rows.length + 1;
        var colsT = titres.length;
        var tc = '';
        for (var c = 2; c < colsT; c++) tc += '<Cell ss:StyleID="n" ss:Formula="=SUM(R2C' + (c + 1) + ':R' + (rT - 1) + 'C' + (c + 1) + ')"><Data ss:Type="Number">0</Data></Cell>';
        total = '<Row>' + cellule('Total', 'b') + '<Cell/>' + tc + '</Row>';
        rows.push(total);
      }
      var nomFeuille = String(p.nom || 'Profil').replace(/[\\\/\?\*\[\]:]/g, ' ').slice(0, 31);
      return '<Worksheet ss:Name="' + esc(nomFeuille) + '"><Table>' + rows.join('') + '</Table></Worksheet>';
    }).join('');
    var xml = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>' +
      '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
      '<Styles><Style ss:ID="h"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1F5FBF" ss:Pattern="Solid"/><Alignment ss:WrapText="1"/></Style>' +
      '<Style ss:ID="n"><NumberFormat ss:Format="#,##0"/></Style><Style ss:ID="b"><Font ss:Bold="1"/></Style></Styles>' +
      (feuilles || '<Worksheet ss:Name="Vide"><Table/></Worksheet>') + '</Workbook>';
    var nomFichier = 'Simulation_salaires_' + (st.mois || moisCourant()) + '.xls';
    var blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nomFichier;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    return nomFichier;
  }

  function evenementMaj(id) {
    try { root.dispatchEvent(new CustomEvent('paie-grille-maj', { detail: { id: String(id) } })); } catch (e) {}
  }

  function ouvrir() {
    var id = 'pg-overlay';
    if (document.getElementById(id)) return;
    var st = charger();
    var touche = false;
    var emps = (root.TERH_fichesPaie ? root.TERH_fichesPaie() : []).map(function (x) {
      return { id: String(x.id), nom: x.nom || '', sb: x.sb || '', poste: x.poste || '', fiche: x };
    });
    // Chaque poste de la liste a son profil : créé automatiquement (vide) s'il n'existe pas, à remplir ensuite
    function creerProfilsPostes() {
      var n = 0;
      [...new Set(emps.map(function (e) { return e.poste; }).filter(Boolean))].sort().forEach(function (po) {
        if (!profilMots(st, po)) { st.profils.push({ id: nouvelId('p'), nom: po, postes: [po], rubriques: rubs([]) }); n++; }
      });
      return n;
    }
    if (creerProfilsPostes()) enregistrerLocal(st);
    var mode = 'grille';

    var ov = document.createElement('div');
    ov.id = id;
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,14,20,.6);z-index:2147483500;display:flex;align-items:flex-start;justify-content:center;padding:12px;overflow:auto';
    var cadre = document.createElement('div');
    cadre.style.cssText = 'background:#fff;color:#1a1a1a;width:100%;max-width:1400px;border-radius:10px;padding:14px;font:12px/1.35 Arial,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.3)';
    ov.appendChild(cadre);
    document.body.appendChild(ov);

    var IN = 'border:1px solid #9aa5b5;border-radius:4px;padding:3px 5px;font:inherit;background:#fff;color:#1a1a1a';
    var BTN = 'padding:5px 10px;border:1px solid #9aa5b5;border-radius:6px;background:#eef2f8;color:#1a1a1a;cursor:pointer';
    var BTN_P = 'padding:7px 12px;border:0;border-radius:6px;background:#1f5fbf;color:#fff;cursor:pointer';

    function msg(t, err) {
      var e = cadre.querySelector('[data-msg]');
      if (e) { e.textContent = t; e.style.color = err ? '#c0392b' : '#1e8449'; }
    }
    function sEmp(e) {
      return st.saisies[e.id] || { profil: '', unite: 'jours', valeur: '', samedi: '', hs120: '', hs130: '', hs140: '', hs_dim: '', hs_nuit: '', hs_ferie: '', base: e.sb, mois: st.mois || moisCourant() };
    }
    function ensure(e) {
      if (!st.saisies[e.id]) st.saisies[e.id] = sEmp(e);
      return st.saisies[e.id];
    }
    function brutDe(e) {
      var s = st.saisies[e.id];
      if (!saisieValide(s)) return '';
      return fmt(lignesDe(st, s, e.fiche).filter(function (l) { return !l.erreur; }).reduce(function (t, l) { return t + (Number(l.gain) || 0); }, 0));
    }
    // Net à payer du salarié pour le mois de la grille : même calcul que le bulletin (salaire saisi ici prioritaire)
    function periodeDe(mois) {
      var m = /(\d{4})-(\d{2})/.exec(mois || ''); if (!m) return '';
      var y = +m[1], mo = +m[2], last = new Date(y, mo, 0).getDate(), mm = String(mo).padStart(2, '0');
      return '01/' + mm + '/' + y + ' au ' + String(last).padStart(2, '0') + '/' + mm + '/' + y;
    }
    function netDe(e) {
      var s = st.saisies[e.id];
      if (!saisieValide(s) || !root.PaieHok) return '';
      var per = periodeDe(st.mois || moisCourant());
      var f = Object.assign({}, e.fiche || {});
      if (s.base !== '' && s.base != null) f.sb = s.base;
      var lignes = lignesDe(st, s, e.fiche).filter(function (l) { return !l.erreur; });
      var r = root.PaieHok.depuisLignes({ fiche: f, lignes: lignes, periode: per, presence: absencePour(e.id, per) });
      return fmt(Math.round(r.net));
    }
    function derives(e) {
      var s = sEmp(e);
      if (s.valeur === '' || s.valeur == null) return { j: '', h: '' };
      var v = variables(st, Object.assign({}, s, { mois: st.mois }));
      return { j: arrondi2(v.jours), h: arrondi2(v.heures) };
    }
    function majLigne(e) {
      var tr = cadre.querySelector('[data-emp="' + e.id + '"]');
      if (!tr) return;
      var d = derives(e);
      tr.querySelector('[data-jours]').textContent = d.j === '' ? '' : d.j;
      tr.querySelector('[data-heures]').textContent = d.h === '' ? '' : d.h;
      tr.querySelector('[data-brut]').textContent = brutDe(e);
      tr.querySelector('[data-net]').textContent = netDe(e);
    }
    function totaux() {
      var tot = emps.reduce(function (t, e) {
        var s = st.saisies[e.id];
        if (!saisieValide(s)) return t;
        return t + lignesDe(st, s, e.fiche).filter(function (l) { return !l.erreur; }).reduce(function (a, l) { return a + (Number(l.gain) || 0); }, 0);
      }, 0);
      var el = cadre.querySelector('[data-total]');
      if (el) el.textContent = fmt(tot);
      var h = cadre.querySelector('[data-heures-mois]');
      if (h) h.textContent = heuresDuMois(st, st.mois);
    }
    // Modification : on enregistre sur ce navigateur tout de suite et on prévient le bulletin ouvert
    function modifie(e) {
      touche = true;
      enregistrerLocal(st);
      if (e) evenementMaj(e.id);
    }

    function vueGrille() {
      var colonnes = ['Salarié', 'Profil', 'Saisie en', 'Valeur', 'Jours', 'Heures', 'Samedi (h)', 'HS 120 %', 'HS 130 %', 'HS 140 %', 'Dimanche (h)', 'Nuit (h)', 'Férié (h)', 'Salaire de base', 'Brut', 'Net'];
      var lignes = emps.map(function (e, idx) {
        var s = sEmp(e), d = derives(e), bg = idx % 2 ? '#f7f9fc' : '#fff';
        var champ = function (k, w) { return '<td><input data-hs="' + k + '" type="number" step="any" value="' + esc(s[k]) + '" style="' + IN + ';width:' + w + 'px;text-align:right"></td>'; };
        return '<tr data-emp="' + esc(e.id) + '" style="background:' + bg + '">' +
          '<td style="padding:3px 6px;white-space:nowrap">' + esc(e.nom) + '</td>' +
          '<td><select data-p style="' + IN + ';width:160px"' + (s.profilManuel ? '' : ' title="Choisi d\'après le poste : ' + esc(e.poste || 'non renseigné') + '"') + '>' + (function () {
            var auto = profilAuto(st, e.poste), actif = s.profilManuel ? s.profil : (auto ? auto.id : '');
            return '<option value=""' + (actif ? '' : ' selected') + '>— aucun profil (poste : ' + esc(e.poste || 'non renseigné') + ') —</option>' +
              st.profils.map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === actif ? ' selected' : '') + '>' + esc(p.nom) + '</option>'; }).join('');
          })() + '</select></td>' +
          '<td><select data-u style="' + IN + '"><option value="jours"' + (s.unite !== 'heures' ? ' selected' : '') + '>Jours</option><option value="heures"' + (s.unite === 'heures' ? ' selected' : '') + '>Heures</option></select></td>' +
          '<td><input data-v type="number" step="any" value="' + esc(s.valeur) + '" style="' + IN + ';width:70px;text-align:right"></td>' +
          '<td data-jours style="text-align:right;color:#555">' + (d.j === '' ? '' : d.j) + '</td>' +
          '<td data-heures style="text-align:right;color:#555">' + (d.h === '' ? '' : d.h) + '</td>' +
          champ('samedi', 60) + champ('hs120', 60) + champ('hs130', 60) + champ('hs140', 60) + champ('hs_dim', 60) + champ('hs_nuit', 60) + champ('hs_ferie', 60) +
          '<td><input data-base type="number" step="any" value="' + esc((s.base !== '' && s.base != null) ? s.base : (e.sb || '')) + '" style="' + IN + ';width:100px;text-align:right"></td>' +
          '<td data-brut style="text-align:right;font-weight:700;white-space:nowrap">' + brutDe(e) + '</td>' +
          '<td data-net style="text-align:right;font-weight:700;white-space:nowrap;color:#1e8449">' + netDe(e) + '</td></tr>';
      }).join('');
      var metaMois = '<label>Mois <input type="month" data-mois value="' + esc(st.mois || moisCourant()) + '" style="' + IN + '"></label>' +
        '<span>Heures du mois : <b data-heures-mois>' + heuresDuMois(st, st.mois) + '</b></span>';
      return '<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-bottom:8px">' + metaMois +
        '<button type="button" data-g="export" style="' + BTN + '">📊 Exporter au format Excel</button></div>' +
        (function () {
          // Postes des salariés qu'aucun profil ne reconnaît (ajoutez le mot-clé dans « Postes concernés »)
          var sans = {};
          emps.forEach(function (e) { var s0 = st.saisies[e.id]; if (!(s0 && s0.profilManuel) && !profilAuto(st, e.poste) && String(e.poste || '').trim()) sans[String(e.poste).trim()] = true; });
          var liste = Object.keys(sans);
          return liste.length ? '<div style="margin:0 0 8px;padding:8px 10px;border-left:4px solid #d68910;background:#fdf6e3;font-size:12px">⚠ Postes sans profil : <b>' + liste.map(esc).join(' · ') + '</b> — ajoutez un mot-clé à un profil (Paramètres de la grille, « Postes concernés »).</div>' : '';
        })() +
        '<p style="margin:0 0 8px;color:#555">Saisissez les jours <b>ou</b> les heures : l\'autre se calcule. Les heures supplémentaires suivent le cours : samedi et 8 premières heures à 120 %, 8 suivantes à 130 %, au-delà de 16 h à 140 %, dimanche 140 %, nuit 150 % (un seul taux si dimanche et nuit), férié 200 %. Taux horaire = salaire de base ÷ 173,33.</p>' +
        '<div style="max-height:62vh;overflow:auto;border:1px solid #cdd5e0;border-radius:6px"><table style="width:100%;border-collapse:collapse;font-size:12px">' +
        '<thead><tr style="position:sticky;top:0;background:#1f5fbf;color:#fff">' + colonnes.map(function (c) { return '<th style="padding:5px 6px;text-align:left;white-space:nowrap">' + c + '</th>'; }).join('') + '</tr></thead>' +
        '<tbody>' + (lignes || '<tr><td colspan="15" style="padding:10px;color:#777">Aucun salarié dans la fiche.</td></tr>') + '</tbody></table></div>' +
        '<div style="margin-top:6px;text-align:right">Total brut de la grille : <b data-total></b></div>';
    }

    function vueParam() {
      var choix = Object.keys(MODES_HEURES).map(function (k) {
        return '<option value="' + k + '"' + (st.heures_methode === k ? ' selected' : '') + '>' + MODES_HEURES[k] + '</option>';
      }).join('');
      var bloc = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">' +
        '<label>Jours du mois (trentième)<input type="number" step="any" data-jm value="' + esc(st.jours_mois) + '" style="' + IN + ';width:100%"></label>' +
        '<label>Heures du mois : méthode<select data-hmeth style="' + IN + ';width:100%">' + choix + '</select></label>' +
        '<label>Heures du mois si saisie manuelle<input type="number" step="any" data-hm value="' + esc(st.heures_mois_manuel) + '" style="' + IN + ';width:100%"></label>' +
        '<label>Diviseur du taux horaire (cours : 173,33)<input type="number" step="any" data-dhs value="' + esc(st.diviseur_hs) + '" style="' + IN + ';width:100%"></label>' +
        '<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-paq' + (st.paques_feries !== false ? ' checked' : '') + '> Fériés de Pâques (vendredi saint, lundi de Pâques) — à vérifier</label>' +
        '<label>Jours fériés fixes (MM-JJ, séparés par des virgules)<input data-feries value="' + esc((st.fériés || []).join(', ')) + '" style="' + IN + ';width:100%"></label></div>' +
        '<p style="color:#555;margin:0 0 10px">Variables des formules : <b>fraction</b> (jours ÷ jours du mois, ou heures ÷ heures du mois), <b>jours</b>, <b>heures</b>, <b>base</b>, <b>diviseur_hs</b>, <b>samedi</b>, <b>hs120</b>, <b>hs130</b>, <b>hs140</b>, <b>hs_dim</b>, <b>hs_nuit</b>, <b>hs_ferie</b>. Exemple : <code>12347*fraction</code> (prorata) ou <code>2804</code> (montant fixe).</p>';
      bloc += '<div style="border:1px solid #cdd5e0;border-radius:8px;padding:10px;margin-bottom:12px;background:#f7f9fc">' +
        '<b>Profils automatiques par poste</b> : chaque salarié prend le profil de son poste (le mot-clé « Postes concernés » peut aussi servir). ' +
        'Un profil créé automatiquement est vide : remplissez ses rubriques, ou copiez celles d\'un autre profil ci-dessous.</div>';
      bloc += st.profils.map(function (p, pi) {
        return '<div style="border:1px solid #cdd5e0;border-radius:8px;padding:10px;margin-bottom:12px">' +
          '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px"><b>Profil :</b>' +
          '<input data-pn="' + pi + '" value="' + esc(p.nom) + '" style="' + IN + ';flex:1">' +
          '<label>Postes concernés (mots-clés de la fiche, séparés par des virgules)<input data-pk="' + pi + '" value="' + esc((p.postes || []).join(', ')) + '" style="' + IN + ';width:300px"></label>' +
          '<button type="button" data-act="delprof" data-pi="' + pi + '" style="' + BTN + '">✕ Supprimer le profil</button></div>' +
          '<div style="margin:6px 0"><b>Remplir ce profil :</b> <select data-copie="' + pi + '" style="' + IN + '"><option value="">— copier les rubriques depuis un autre profil… —</option>' +
          st.profils.map(function (x, k) { return k === pi ? '' : '<option value="' + k + '">' + esc(x.nom) + '</option>'; }).join('') + '</select></div>' +
          '<table style="width:100%;border-collapse:collapse"><thead><tr style="background:#eef2f8">' +
          '<th style="text-align:left;padding:4px">Code</th><th style="text-align:left">Libellé</th><th style="text-align:left">Nature</th><th style="text-align:left">Formule</th><th style="text-align:left">Colonne fiche (si montant fiche)</th><th style="text-align:left">Montant de la fiche</th><th></th></tr></thead><tbody>' +
          p.rubriques.map(function (r, ri) {
            return '<tr>' +
              '<td><input data-pi="' + pi + '" data-ri="' + ri + '" data-rf="code" value="' + esc(r.code) + '" style="' + IN + ';width:70px"></td>' +
              '<td><input data-pi="' + pi + '" data-ri="' + ri + '" data-rf="lib" value="' + esc(r.lib) + '" style="' + IN + ';width:260px"></td>' +
              '<td><select data-pi="' + pi + '" data-ri="' + ri + '" data-rf="nature" style="' + IN + '">' + Object.keys(NATURES).map(function (k) {
                return '<option value="' + k + '"' + (r.nature === k ? ' selected' : '') + '>' + NATURES[k] + '</option>';
              }).join('') + '</select></td>' +
              '<td><input data-pi="' + pi + '" data-ri="' + ri + '" data-rf="expr" value="' + esc(r.expr) + '" style="' + IN + ';width:200px;font-family:monospace"></td>' +
              '<td><input data-pi="' + pi + '" data-ri="' + ri + '" data-rf="colonne" value="' + esc(r.colonne || '') + '" placeholder="auto (code)" style="' + IN + ';width:150px"></td>' +
              '<td style="text-align:center"><input type="checkbox" data-pi="' + pi + '" data-ri="' + ri + '" data-rf="fiche"' + (r.fiche ? ' checked' : '') + '></td>' +
              '<td><button type="button" data-act="delrub" data-pi="' + pi + '" data-ri="' + ri + '" style="' + BTN + '">✕</button></td></tr>';
          }).join('') + '</tbody></table>' +
          '<div style="margin-top:6px"><button type="button" data-act="addrub" data-pi="' + pi + '" style="' + BTN + '">+ Ajouter une rubrique à ce profil</button></div></div>';
      }).join('');
      return bloc + '<button type="button" data-act="addprof" style="' + BTN + '">+ Nouveau profil</button>';
    }

    function rendre() {
      cadre.innerHTML =
        '<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap">' +
          '<b style="flex:1;font-size:15px">🧮 Grille de saisie : jours ou heures</b>' +
          '<button type="button" data-g="' + (mode === 'grille' ? 'param' : 'grille') + '" style="' + BTN + '">' + (mode === 'grille' ? '⚙ Paramètres et formules' : '← Retour à la grille') + '</button>' +
          '<button type="button" data-g="fermer" style="' + BTN + '">✕ Fermer</button></div>' +
        (mode === 'grille' ? vueGrille() : vueParam()) +
        '<div style="display:flex;gap:8px;align-items:center;margin-top:12px"><button type="button" data-g="enregistrer" style="' + BTN_P + '">💾 Enregistrer</button><span data-msg style="margin-left:auto"></span></div>';
      if (mode === 'grille') totaux();
    }

    function verifier() {
      var exemple = { fraction: 1, jours: 30, heures: 173.33, base: 1000, m: 1, diviseur_hs: 173.33, samedi: 1, hs120: 1, hs130: 1, hs140: 1, hs_dim: 1, hs_nuit: 1, hs_ferie: 1 };
      for (var i = 0; i < st.profils.length; i++) {
        var p = st.profils[i];
        for (var j = 0; j < p.rubriques.length; j++) {
          var r = p.rubriques[j];
          try { evaluer(r.expr, exemple); } catch (e) {
            return 'Formule invalide (' + p.nom + ', ' + (r.code || '?') + ') : ' + e.message;
          }
        }
      }
      return '';
    }

    cadre.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-g],[data-act]');
      if (!b) return;
      if (b.dataset.g === 'fermer') { ov.remove(); return; }
      if (b.dataset.g === 'param' || b.dataset.g === 'grille') { mode = b.dataset.g; rendre(); return; }
      if (b.dataset.g === 'export') { try { var nom = exporterXls(st, emps); msg('Fichier téléchargé : ' + nom); } catch (e) { msg('Export impossible : ' + e.message, true); } return; }
      if (b.dataset.g === 'enregistrer') {
        var err = verifier();
        if (err) { msg(err, true); return; }
        sauver(st).then(function () { msg('Grille enregistrée.'); }).catch(function () { msg('Enregistrée sur ce navigateur ; la base n\'a pas répondu.', true); });
        return;
      }
      var a = b.dataset.act, pi = +b.dataset.pi, ri = +b.dataset.ri;
      touche = true;
      if (a === 'addprof') { st.profils.push({ id: nouvelId('p'), nom: 'Nouveau profil', postes: [], rubriques: rubs([]) }); rendre(); }
      else if (a === 'delprof') {
        if (!confirm('Supprimer le profil « ' + st.profils[pi].nom + ' » ?')) return;
        st.profils.splice(pi, 1); rendre();
      } else if (a === 'addrub') {
        st.profils[pi].rubriques.push({ code: '', lib: '', nature: 'salaire', expr: '0', fiche: false }); rendre();
      } else if (a === 'delrub') {
        st.profils[pi].rubriques.splice(ri, 1); rendre();
      }
    });

    // Saisie grille : seule la ligne concernée est recalculée (le champ garde le focus)
    cadre.addEventListener('input', function (ev) {
      var t = ev.target;
      if (mode === 'grille') {
        var tr = t.closest('tr');
        if (!tr || !tr.dataset.emp) return;
        var e = emps.filter(function (x) { return x.id === tr.dataset.emp; })[0];
        if (!e) return;
        var s = ensure(e);
        if (t.dataset.v != null) s.valeur = t.value;
        else if (t.dataset.hs != null) s[t.dataset.hs] = t.value;
        else if (t.dataset.base != null) { s.base = t.value; s.baseManuelle = t.value !== ''; }
        else return;
        majLigne(e); totaux(); modifie(e);
        return;
      }
      if (mode === 'param') {
        if (t.dataset.jm != null) st.jours_mois = t.value;
        else if (t.dataset.hm != null) st.heures_mois_manuel = t.value;
        else if (t.dataset.dhs != null) st.diviseur_hs = t.value;
        else if (t.dataset.feries != null) st.fériés = t.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
        else if (t.dataset.pn != null) st.profils[+t.dataset.pn].nom = t.value;
        else if (t.dataset.pk != null) st.profils[+t.dataset.pk].postes = t.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
        else if (t.dataset.rf && t.dataset.rf !== 'nature' && t.dataset.rf !== 'fiche') st.profils[+t.dataset.pi].rubriques[+t.dataset.ri][t.dataset.rf] = t.value;
        touche = true;
      }
    });
    cadre.addEventListener('change', function (ev) {
      var t = ev.target;
      if (mode === 'grille') {
        if (t.dataset.mois != null) { st.mois = t.value; touche = true; totaux(); cadre.querySelectorAll('tr[data-emp]').forEach(function (tr) { var e = emps.filter(function (x) { return x.id === tr.dataset.emp; })[0]; if (e) majLigne(e); }); enregistrerLocal(st); return; }
        var tr = t.closest('tr');
        if (!tr || !tr.dataset.emp) return;
        var e = emps.filter(function (x) { return x.id === tr.dataset.emp; })[0];
        if (!e) return;
        var s = ensure(e);
        if (t.dataset.p != null) { s.profil = t.value; s.profilManuel = true; }
        else if (t.dataset.u != null) s.unite = t.value;
        else return;
        majLigne(e); totaux(); modifie(e);
        return;
      }
      if (mode === 'param') {
        if (t.dataset.copie != null) {
          if (t.value !== '') {
            st.profils[+t.dataset.copie].rubriques = JSON.parse(JSON.stringify(st.profils[+t.value].rubriques || []));
            touche = true; rendre();
          }
          return;
        }
        if (t.dataset.hmeth != null) st.heures_methode = t.value;
        else if (t.dataset.paq != null) st.paques_feries = t.checked;
        else if (t.dataset.rf === 'nature') st.profils[+t.dataset.pi].rubriques[+t.dataset.ri].nature = t.value;
        else if (t.dataset.rf === 'fiche') st.profils[+t.dataset.pi].rubriques[+t.dataset.ri].fiche = t.checked;
        else if (t.dataset.rf === 'code') {
          // Libellé proposé depuis le catalogue si la case est vide
          var r = st.profils[+t.dataset.pi].rubriques[+t.dataset.ri];
          r.code = t.value;
          var cat = (root.PaieRubriques && root.PaieRubriques.charger) ? root.PaieRubriques.charger() : [];
          var trouve = cat.filter(function (c) { return String(c.code) === String(t.value).trim(); })[0];
          if (trouve && !r.lib) {
            r.lib = trouve.libelle || '';
            var champLib = cadre.querySelector('[data-pi="' + t.dataset.pi + '"][data-ri="' + t.dataset.ri + '"][data-rf="lib"]');
            if (champLib) champLib.value = r.lib;
          }
        }
        touche = true;
      }
    });

    rendre();
    var pont = root.TERH_paieGrille;
    if (pont && pont.load) {
      Promise.resolve(pont.load()).then(function (l) {
        // Ne remplace jamais une saisie faite pendant le chargement
        if (!touche && l && Array.isArray(l.profils) && document.getElementById(id)) { st = l; st.saisies = st.saisies || {}; var net = nettoyer(st); if (ajouterSalaire(st)) net = true; if (creerProfilsPostes() || net) { enregistrerLocal(st); if (pont.save) Promise.resolve(pont.save(st)).catch(function () {}); } rendre(); }
      }).catch(function () {});
    }
  }

  // Absences du mois pour un salarié : jours travaillés saisis dans la grille → jours d'absence (base 30 jours)
  function absencePour(id, periode) {
    var st = charger(), s = st.saisies[String(id)];
    if (!s || s.valeur === '' || s.valeur == null) return null;
    var m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(String(periode || ''));
    if (m && s.mois && s.mois !== m[3] + '-' + m[2]) return null;   // saisie d'un autre mois
    var v = variables(st, s);
    var out = { joursAbsence: Math.max(0, arrondi2((1 - v.fraction) * 30)) };
    // Salaire de base saisi à la main dans la grille pour ce mois (sinon la fiche s'applique)
    if (s.baseManuelle && s.base !== '' && s.base != null) out.base = nombreF(s.base);
    return out;
  }
  root.PaieGrille = { ouvrir: ouvrir, charger: charger, sauver: sauver, lignesPour: lignesPour, evaluer: evaluer, heuresDuMois: heuresDuMois, absencePour: absencePour, exporter: exporterXls, DEFAUT: DEFAUT };
})(typeof window !== 'undefined' ? window : globalThis);
