/* paie-i18n.js — traduction anglaise des écrans et bulletins de paie.
 * Ne touche qu'à l'affichage : les montants et le calcul ne changent jamais.
 * Actif quand la langue de l'application est l'anglais (document.documentElement.lang === 'en').
 * Les sigles officiels (IRPP, CAC, CFC, CNPS, RAV, TC, FNE) restent tels quels.
 */
(function (root) {
  'use strict';
  var DICO = {
    'Rechercher une rubrique nulle (code ou nom)…': 'Search a zero item (code or name)…',
    'Rubriques nulles (cochez pour les afficher sur le bulletin) :': 'Zero items (tick to show on the payslip):',
    'Rubriques du bulletin Hôtel de l’Océan': 'Hôtel Océan payslip items',
    '(corrigé ce mois)': '(corrected this month)',
    'Saisie (tableau libre en bas)': 'Manual entry (free table below)',
    'Éléments saisis à la main (rubriques libres)': 'Manual items (free items)',
    'Total brut': 'Gross total',
    'Net à payer': 'Net pay',
    'Nombre jour': 'Number of days',
    'Base unitaire': 'Unit base',
    'Taux %': 'Rate %',
    'Origine': 'Source',
    'Modèle Océan': 'Hôtel Océan model',
    'Bulletin modèle': 'Payslip model',
    'Rubriques imprimables non nulles': 'Printable non-zero items',
    'Rubriques imprimables': 'Printable items',
    'Toutes': 'All',
    'Autres informations': 'Other information',
    'Informations principales': 'Main information',
    'Catégorie / échelon': 'Category / level',
    'Indemnité de transport': 'Transport allowance',
    'Prime d\'Assiduité': 'Attendance bonus',
    'Prime d\'Ancienneté': 'Seniority bonus',
    'Autres informations (colonnes importées)': 'Other information (imported columns)',
    'Dernière visite médicale': 'Last medical visit',
    'Type de contrat': 'Contract type',
    'Début': 'Start',
    'Fin': 'End',
    'Rubriques libres': 'Free items',
    'Éléments libres': 'Free items',
    'Salarié': 'Employee', 'Profil': 'Profile', 'Saisie en': 'Entry in', 'Valeur': 'Value', 'Jours': 'Days',
    'Heures': 'Hours', 'Samedi (h)': 'Saturday (h)', 'HS 120 %': 'OT 120 %', 'HS 130 %': 'OT 130 %',
    'HS 140 %': 'OT 140 %', 'Dimanche (h)': 'Sunday (h)', 'Nuit (h)': 'Night (h)', 'Férié (h)': 'Holiday (h)',
    'Salaire de base': 'Basic salary', 'Salaire de Base': 'Basic salary', 'Brut': 'Gross',
    'Grille de saisie (jours / heures)': 'Entry grid (days / hours)', 'Paramètres Hôtel Océan': 'Hôtel Océan settings',
    'Paramètres généraux': 'General settings', 'Particularités permanentes': 'Permanent specifics',
    'Particularités du mois': 'Monthly specifics', 'Rubriques et formules': 'Items and formulas',
    'Rubriques ajoutées': 'Added items', '+ Ajouter une rubrique': '+ Add an item', 'Enregistrer': 'Save',
    'Fermer': 'Close', 'Valeurs par défaut': 'Default values', 'Code': 'Code', 'Libellé': 'Label',
    'Formule': 'Formula', 'Affichage': 'Display', 'Par défaut': 'Default', 'Normal': 'Normal',
    'Afficher à 0 (non payée)': 'Show as 0 (not paid)', 'Ne pas afficher': 'Do not show', 'Type': 'Type',
    'Gain': 'Earning', 'Retenue': 'Deduction', 'Variables': 'Variables', 'Total Brut': 'Total Gross',
    'Total Cotisations': 'Total Deductions', 'NET A PAYER': 'NET PAY', 'Rappels': 'Arrears',
    'Avance sur Salaire': 'Salary advance', 'Unité Administrative': 'Administrative Unit',
    'Intéressé(e)': 'Employee', 'Directeur': 'Director', 'Nombre Jour': 'Days', 'Base Unitaire': 'Unit base',
    'Taux': 'Rate', 'Désignation': 'Description', 'Indemnité de Logement': 'Housing allowance',
    "Prime d'Assiduité": 'Attendance bonus', 'Indemnité de Transport': 'Transport allowance',
    "Prime d'Ancienneté": 'Seniority bonus', 'Indemnité de Congé': 'Leave allowance',
    'Crédit Foncier du Cameroun': 'Crédit Foncier du Cameroun', "Fonds National de l'Emploi": 'National Employment Fund',
    'Taxe Communale/TDL': 'Municipal tax (TDL)', 'Dettes Internes': 'Internal debts',
    'Prestation Familiale': 'Family allowance', 'Communard': 'Communal', 'TEL. :': 'TEL.:', 'BP :': 'P.O. Box:',
    'Matricule': 'Employee No.', 'Poste de travail': 'Job', 'Échelon': 'Grade', 'Catégorie': 'Category',
    'N° CNPS': 'CNPS No.', 'Ancienneté': 'Seniority', 'Mois': 'Month', 'Période': 'Period', 'Employeur': 'Employer',
    'Annuler': 'Cancel', 'Ajouter': 'Add', 'Supprimer': 'Delete', 'Modifier': 'Edit', 'Aperçu': 'Preview',
    'Imprimer': 'Print', 'Variables : ': 'Variables: ', 'Attention, formule à corriger : ': 'Warning, formula to correct: ',
    'Rubrique masquée': 'Hidden item', 'Pour vous aider à faire valoir vos droits, conservez ce bulletin de paie sans limitation de durée.':
      'To help you assert your rights, keep this payslip for an unlimited period.',
    'BULLETIN DE PAIE DU': 'PAYSLIP FROM', 'Bulletin de paie': 'Payslip',
    // ----- bulletin détaillé : libellés et contrôles -----,
    "Bulletin détaillé": "Detailed payslip",
    "🧾 Bulletin détaillé (rubriques)": "🧾 Detailed payslip (items)",
    "📄 Modèles": "📄 Templates",
    "Prime d’ancienneté": "Seniority bonus",
    "Nom affiché": "Displayed name",
    "Rubrique": "Item",
    "Nombre": "Number",
    "Base": "Base",
    "Éléments": "Elements",
    "Calculé": "Calculated",
    "Crédit foncier patronal": "Employer Crédit Foncier",
    "Total cotisations": "Total contributions",
    "⚠ Matricule interne manquant : renseignez-le ici ou dans la fiche du salarié.": "⚠ Internal ID missing: enter it here or in the employee file.",
    "⚠ N° CNPS manquant : il est lu sur la fiche du salarié.": "⚠ CNPS number missing: it is read from the employee file.",
    "⚠ Brut nul : aucune rubrique de gain n'est saisie.": "⚠ Zero gross: no earning item entered.",
    "Net imposable": "Taxable net",
    "Année": "Year",
    "🖨️ Aperçu / imprimer": "🖨️ Preview / print",
    "‹ Préc.": "‹ Prev.",
    "Suiv. ›": "Next ›",
    // ----- avis du détail -----,
    "Rubrique {c} « {l} » retirée : elle est déjà calculée par le modèle Hôtel Océan (code {e}). Corrigez-la avec « Modifier » si besoin.": "Item {c} « {l} » removed: it is already calculated by the Hôtel Océan model (code {e}). Correct it with « Modify » if needed.",
    "Code Sage {a} « {l} » remplacé par le code Océan {c}.": "Sage code {a} « {l} » replaced by Hôtel Océan code {c}.",
    "Code {k} utilisé par {n} rubriques : donnez un autre code à l'une d'elles (modifiez le champ Code).": "Code {k} used by {n} items: give another code to one of them (edit the Code field).",
    "Doublon possible : « {k} » apparaît en {l}. Gardez une seule de ces rubriques.": "Possible duplicate: « {k} » appears as {l}. Keep only one of these items.",
    "Rubrique {c} « {l} » de la grille non reprise : ce code est calculé par le modèle Hôtel Océan. Corrigez-la avec « Modifier » dans le tableau du haut.": "Item {c} « {l} » from the grid not taken into account: this code is calculated by the Hôtel Océan model. Correct it with « Modify » in the top table.",
    "{n} rubrique(s) nulle(s) masquée(s) par le filtre.": "{n} zero item(s) hidden by the filter.",
    "Afficher toutes": "Show all",
    // ----- grille de saisie, clôture mensuelle, paramètres -----
    "🧮 Grille de saisie : jours ou heures": "🧮 Entry grid: days or hours",
    "⚙ Paramètres et formules": "⚙ Settings and formulas",
    "✕ Fermer": "✕ Close",
    "Heures du mois :": "Hours this month:",
    "📊 Exporter au format Excel": "📊 Export to Excel",
    "Saisissez les jours": "Enter the days",
    "ou": "or",
    "les heures : l'autre se calcule. Les heures supplémentaires suivent le cours : samedi et 8 premières heures à 120 %, 8 suivantes à 130 %, au-delà de 16 h à 140 %, dimanche 140 %, nuit 150 % (un seul taux si dimanche et nuit), férié 200 %. Taux horaire = salaire de base ÷ 173,33.": "the hours: the other is calculated. Overtime follows the course: Saturday and the first 8 hours at 120%, the next 8 at 130%, beyond 16 h at 140%, Sunday 140%, night 150% (one rate if Sunday and night), public holiday 200%. Hourly rate = basic salary ÷ 173.33.",
    "Salarié": "Employee",
    "Net": "Net",
    "Détail": "Details",
    "Aucun salarié dans la fiche.": "No employee in the file.",
    "Total brut de la grille :": "Gross total of the grid:",
    "💾 Enregistrer": "💾 Save",
    "← Retour à la grille": "← Back to the grid",
    "Jours du mois (trentième)": "Days in the month (thirtieth)",
    "Heures du mois : méthode": "Hours in the month: method",
    "Calendrier : jours ouvrables (lun.-ven.) hors fériés × 8 h": "Calendar: working days (Mon–Fri) excluding public holidays × 8 h",
    "Quatre semaines × 40 h (méthode de votre fichier Excel : 160 h)": "Four weeks × 40 h (your Excel file method: 160 h)",
    "Saisie manuelle": "Manual entry",
    "Heures du mois si saisie manuelle": "Hours in the month if entered manually",
    "Diviseur du taux horaire (cours : 173,33)": "Hourly rate divisor (course: 173.33)",
    "Fériés de Pâques (vendredi saint, lundi de Pâques) — à vérifier": "Easter public holidays (Good Friday, Easter Monday) — to check",
    "Jours fériés fixes (MM-JJ, séparés par des virgules)": "Fixed public holidays (MM-DD, comma-separated)",
    "Variables des formules :": "Formula variables:",
    "(jours ÷ jours du mois, ou heures ÷ heures du mois),": "(days ÷ days in the month, or hours ÷ hours in the month),",
    "jours": "days",
    "heures": "hours",
    "diviseur_hs": "overtime divisor",
    ". Exemple :": ". Example:",
    "(prorata) ou": "(pro rata) or",
    "(montant fixe).": "(fixed amount).",
    "Profils automatiques par poste": "Automatic profiles by job",
    ": chaque salarié prend le profil de son poste (le mot-clé « Postes concernés » peut aussi servir). Un profil créé automatiquement est vide : remplissez ses rubriques, ou copiez celles d'un autre profil ci-dessous.": ": each employee takes the profile of their job (the keyword « Postes concernés » can also be used). A profile created automatically is empty: fill in its items, or copy those of another profile below.",
    "+ Nouveau profil": "+ New profile",
    "💾 Télécharger ce mois (fichier)": "💾 Download this month (file)",
    "📥 Importer un mois (fichier)": "📥 Import a month (file)",
    "Consulter un mois clôturé…": "View a closed month…",
    "↩ Retour au mois en cours": "↩ Back to the current month",
    "🔓 Rouvrir ce mois": "🔓 Reopen this month",
    "Mois {m} ouvert (consultation)": "Month {m} open (view only)",
    "🔒 Clôturer le mois {m}": "🔒 Close month {m}",
    "👁 Consultation du mois {m} (lecture seule)": "👁 Viewing month {m} (read only)",
    "🔒 Mois {m} clôturé (lecture seule)": "🔒 Month {m} closed (read only)",
    "Droits insuffisants : réservé à l'administrateur et à l'éditeur.": "Insufficient rights: reserved for administrators and editors.",
    "Droits insuffisants : lecture seule.": "Insufficient rights: read only.",
    "Quittez la consultation avant de clôturer.": "Leave the view before closing.",
    "Quittez la consultation avant de rouvrir.": "Leave the view before reopening.",
    "Clôture indisponible : base non connectée.": "Closing unavailable: database not connected.",
    "Réouverture indisponible : base non connectée.": "Reopening unavailable: database not connected.",
    "Consultation indisponible : base non connectée.": "Viewing unavailable: database not connected.",
    "Import indisponible : base non connectée.": "Import unavailable: database not connected.",
    "Le mois {m} est déjà clôturé.": "Month {m} is already closed.",
    "Clôturer le mois {m} ? Ses saisies seront figées. Le mois {n} s'ouvrira.": "Close month {m}? Its entries will be frozen. Month {n} will open.",
    "Le mois {m} n'est pas clôturé.": "Month {m} is not closed.",
    "Rouvrir le mois {m} ? Il redevient modifiable et remplace le mois affiché.": "Reopen month {m}? It becomes editable again and replaces the displayed month.",
    "Archive du mois {m} introuvable.": "Archive for month {m} not found.",
    "Mois introuvable : {m}": "Month not found: {m}",
    "Ce fichier n'est pas une paie mensuelle TERH.": "This file is not a TERH monthly payroll.",
    "Fichier illisible.": "Unreadable file.",
    "Remplacer l'archive du mois {m} par le fichier importé ?": "Replace the archive of month {m} with the imported file?",
    "Mois {m} importé.": "Month {m} imported.",
    "Consultation d'un mois clôturé : lecture seule.": "Viewing a closed month: read only.",
    "Mois {m} clôturé : rouvrez-le pour le modifier.": "Month {m} closed: reopen it to edit.",
  };
  // Phrases contenant une date : « BULLETIN DE PAIE DU 01/10/26 AU 31/10/26 »
  function estAnglais() {
    if (root.__PAIE_EN === true) return true;
    try { return !!(root.document && root.document.documentElement && root.document.documentElement.lang === 'en'); }
    catch (e) { return false; }
  }
  function tr(s) {
    if (!estAnglais()) return s;
    var k = String(s == null ? '' : s).trim();
    return DICO.hasOwnProperty(k) ? DICO[k] : s;
  }
  // Traduit un fragment HTML : seuls les textes entre balises sont modifiés
  function html(h) {
    if (!estAnglais()) return h;
    return String(h).replace(/>([^<>]+)</g, function (m, t) {
      var k = t.trim();
      if (DICO.hasOwnProperty(k)) return '>' + t.replace(k, DICO[k]) + '<';
      // « BULLETIN DE PAIE DU 01/10/26 AU 31/10/26 »
      // libellé suivi d'une valeur : « TEL. : 695… », « N° CNPS : 392… »
      var cle = Object.keys(DICO).filter(function (c) { return c.length >= 4 && k.indexOf(c) === 0 && /[\s:]/.test(k.charAt(c.length) || ' '); })
        .sort(function (a, b) { return b.length - a.length; })[0];
      if (cle) return '>' + t.replace(k.slice(0, cle.length), DICO[cle]) + '<';
      var mm = /^(BULLETIN DE PAIE DU)\s+(.+?)\s+AU\s+(.+)$/.exec(k);
      if (mm) return '>' + DICO['BULLETIN DE PAIE DU'] + ' ' + mm[2] + ' TO ' + mm[3] + '<';
      return m;
    });
  }
  // Traduit les textes d'un élément déjà affiché (écrans de la grille et des paramètres)
  function dom(el) {
    if (!estAnglais() || !el || !root.document) return;
    var w = root.document.createTreeWalker(el, 4 /* SHOW_TEXT */, null);
    var n; var noeuds = [];
    while ((n = w.nextNode())) noeuds.push(n);
    noeuds.forEach(function (t) {
      var k = t.nodeValue.trim();
      if (k && DICO.hasOwnProperty(k)) t.nodeValue = t.nodeValue.replace(k, DICO[k]);
    });
    el.querySelectorAll && el.querySelectorAll('input[placeholder],option').forEach(function (x) {
      if (x.placeholder && DICO.hasOwnProperty(x.placeholder.trim())) x.placeholder = DICO[x.placeholder.trim()];
    });
  }
  // Les écrans de paie sont construits après l'ouverture : on traduit chaque élément ajouté
  function surveiller() {
    if (!root.document || !root.MutationObserver) return;
    var obs = new root.MutationObserver(function (muts) {
      if (!estAnglais()) return;
      muts.forEach(function (m) {
        m.addedNodes.forEach(function (nd) {
          if (nd.nodeType !== 1) return;
          var id = nd.id || '';
          if (id === 'pg-overlay' || id === 'hok-overlay' || (nd.closest && nd.closest('#pg-overlay,#hok-overlay'))) dom(nd);
        });
      });
    });
    obs.observe(root.document.body, { childList: true, subtree: true });
  }
  if (root.document && root.document.body) surveiller();
  else if (root.document) root.document.addEventListener('DOMContentLoaded', surveiller);

  // Traduction d'un message : {variables} remplacées après traduction
  function T(s, vars) {
    var k = String(s == null ? '' : s);
    var out = (estAnglais() && DICO.hasOwnProperty(k)) ? DICO[k] : k;
    if (vars) Object.keys(vars).forEach(function (x) { out = out.split('{' + x + '}').join(vars[x]); });
    return out;
  }
  // Traduit un texte court (exact, sans espaces superflus)
  function trTexte(t) {
    if (!estAnglais()) return t;
    if (DICO.hasOwnProperty(t)) return DICO[t];
    var m = /^([^A-Za-zÀ-ÿ]*)(.*?)([\s:….!?]*)$/.exec(t);
    if (m && m[2] && DICO.hasOwnProperty(m[2])) return m[1] + DICO[m[2]] + m[3];
    return t;
  }
  // Traduit en place les textes et attributs (placeholder, title) d'un élément déjà affiché
  function noeuds(el) {
    if (!estAnglais() || !el || !el.ownerDocument) return;
    var w = el.ownerDocument.createTreeWalker(el, 4, null, false), n, liste = [];
    while ((n = w.nextNode())) liste.push(n);
    liste.forEach(function (x) {
      var p = x.parentNode;
      if (p && /^(SCRIPT|STYLE|TEXTAREA)$/.test(p.nodeName)) return;
      var s = x.nodeValue, t = s.replace(/^\s+|\s+$/g, '');
      if (!t) return;
      var out = trTexte(t);
      if (out !== t) x.nodeValue = s.replace(t, out);
    });
    el.querySelectorAll('[placeholder],[title]').forEach(function (e) {
      ['placeholder', 'title'].forEach(function (a) {
        if (!e.hasAttribute(a)) return;
        var v = e.getAttribute(a), o = trTexte(v.trim());
        if (o !== v.trim()) e.setAttribute(a, o);
      });
    });
  }
  root.PaieI18n = { tr: tr, T: T, noeuds: noeuds, html: html, dom: dom, dico: DICO, estAnglais: estAnglais };
})(typeof window !== 'undefined' ? window : globalThis);
