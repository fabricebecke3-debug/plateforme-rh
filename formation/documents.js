/* formation/documents.js — Traitement des documents importés (logique pure, testable).
 * - formatAccepte : types autorisés (docx, pdf, md, txt) et taille maximale.
 * - pdfEstScanne : un PDF sans texte sélectionnable est refusé avec une explication.
 * - decouper : découpe un texte en passages.
 * - passagesPertinents : choisit les passages utiles à une question (pour l'assistant).
 */
(function (root) {
  'use strict';
  var TYPES = ['docx', 'pdf', 'md', 'txt'];
  var TAILLE_MAX = 10 * 1024 * 1024;          // 10 Mo
  var TEXTE_MAX = 300000;                     // caractères gardés par document

  var MESSAGE_SCAN = "Ce PDF est une image scannée : son texte ne peut pas être lu automatiquement. " +
    "Pour l'importer, enregistrez-le en PDF « avec texte » (par exemple avec l'OCR de votre scanner ou d'Adobe Acrobat), " +
    "ou importez la version Word d'origine.";

  function normaliser(t) {
    return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function formatAccepte(nom, taille) {
    var m = /\.([A-Za-z0-9]+)$/.exec(String(nom || ''));
    var ext = m ? m[1].toLowerCase() : '';
    if (TYPES.indexOf(ext) === -1) return { ok: false, type: '', raison: "Format non accepté. Formats acceptés : Word (.docx), PDF avec texte (.pdf), Markdown (.md) et texte (.txt)." };
    if (typeof taille === 'number' && taille > TAILLE_MAX) return { ok: false, type: ext, raison: 'Fichier trop volumineux (maximum 10 Mo).' };
    return { ok: true, type: ext === 'markdown' ? 'md' : ext, raison: '' };
  }

  // pages : tableau de textes extraits, une entrée par page
  function pdfEstScanne(pages) {
    var total = (pages || []).reduce(function (s, p) { return s + String(p || '').replace(/\s/g, '').length; }, 0);
    var nombre = (pages || []).length || 1;
    return (total / nombre) < 30;   // moins de 30 caractères utiles par page : image scannée
  }

  function decouper(texte, taille) {
    var max = taille || 700;
    var paragraphes = String(texte || '').split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean);
    var out = [], courant = '';
    paragraphes.forEach(function (p) {
      while (p.length > max) { if (courant) { out.push(courant); courant = ''; } out.push(p.slice(0, max)); p = p.slice(max); }
      if ((courant + '\n\n' + p).length > max && courant) { out.push(courant); courant = p; }
      else courant = courant ? courant + '\n\n' + p : p;
    });
    if (courant) out.push(courant);
    return out;
  }

  // docs : [{ titre, texte }] ; renvoie les passages les plus proches de la question
  function passagesPertinents(question, docs, max) {
    var mots = normaliser(question).split(/[^a-z0-9]+/).filter(function (m) { return m.length > 3; });
    if (!mots.length) return [];
    var scores = [];
    (docs || []).forEach(function (d) {
      decouper(d.texte).forEach(function (passage) {
        var n = normaliser(passage), s = 0;
        mots.forEach(function (m) { if (n.indexOf(m) !== -1) s++; });
        if (s > 0) scores.push({ titre: d.titre, passage: passage, score: s });
      });
    });
    scores.sort(function (a, b) { return b.score - a.score; });
    return scores.slice(0, max || 3);
  }

  var API = { TYPES: TYPES, TAILLE_MAX: TAILLE_MAX, TEXTE_MAX: TEXTE_MAX, MESSAGE_SCAN: MESSAGE_SCAN,
    formatAccepte: formatAccepte, pdfEstScanne: pdfEstScanne, decouper: decouper, passagesPertinents: passagesPertinents };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.FormationDocuments = API;
})(typeof window !== 'undefined' ? window : globalThis);
