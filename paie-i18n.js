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
    'BULLETIN DE PAIE DU': 'PAYSLIP FROM', 'Bulletin de paie': 'Payslip'
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
  root.PaieI18n = { tr: tr, html: html, dom: dom, dico: DICO, estAnglais: estAnglais };
})(typeof window !== 'undefined' ? window : globalThis);
