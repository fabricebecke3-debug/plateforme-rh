/* lettres-modeles.js — Lettres RH à partir des modèles téléversés par chaque société.
 * LettresModeles.generer({ modele:{url,nom}, valeurs:{nom,poste,date,societe,titre,texte}, texte })
 *   -> Promise<{ blob, ext }>
 *  - Word (.docx) : remplace les repères {nom}, {poste}, {date}, {societe}, {titre}, {texte} dans le document.
 *  - PDF : le modèle sert de papier à en-tête (sa première page) ; le texte est écrit dans la zone centrale.
 *  - Image (PNG, JPG) : même principe, l'image occupe toute la page A4.
 * Bibliothèques chargées à la demande (versions fixées) : JSZip (Word), pdf-lib (PDF).
 */
(function (root) {
  'use strict';

  var URL_JSZIP = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
  var URL_PDFLIB = 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
  // Marges de la zone de texte, en points (1 mm = 2,8346 pt). Haut : sous l'en-tête du modèle.
  var MARGES = { gauche: 71, droite: 57, haut: 170, bas: 99 };
  var A4 = [595.28, 841.89];
  var TAILLE_TEXTE = 11;

  function chargerScript(url, nomGlobal) {
    if (root[nomGlobal]) return Promise.resolve(root[nomGlobal]);
    return new Promise(function (ok, ko) {
      var s = document.createElement('script');
      s.src = url;
      s.onload = function () { root[nomGlobal] ? ok(root[nomGlobal]) : ko(new Error('bibliothèque absente')); };
      s.onerror = function () { ko(new Error('bibliothèque non chargée : vérifiez la connexion')); };
      document.head.appendChild(s);
    });
  }

  function esc(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  // Valeur placée dans un paragraphe Word : les retours à la ligne deviennent des sauts de ligne
  function valeurXml(v) {
    return esc(v).split('\n').join('</w:t><w:br/><w:t xml:space="preserve">');
  }

  // Un repère peut être coupé en plusieurs morceaux par Word (mise en forme différente) :
  // on reconstruit alors le paragraphe entier, en gardant la mise en forme de son premier morceau.
  function remplacerDansParagraphes(xml, valeurs) {
    return xml.replace(/<w:p(?: [^>]*)?>[\s\S]*?<\/w:p>/g, function (p) {
      var textes = [];
      p.replace(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g, function (m, t) { textes.push(t); return m; });
      var plein = textes.join('');
      if (!/\{\w+\}/.test(plein)) return p;
      var ouverture = (p.match(/^<w:p(?: [^>]*)?>/) || ['<w:p>'])[0];
      var pPr = (p.match(/<w:pPr>[\s\S]*?<\/w:pPr>/) || [''])[0];
      var rPr = (p.match(/<w:rPr>[\s\S]*?<\/w:rPr>/) || [''])[0];
      var contenu = plein.split(/(\{\w+\})/).map(function (morceau) {
        var m = /^\{(\w+)\}$/.exec(morceau);
        if (m && Object.prototype.hasOwnProperty.call(valeurs, m[1])) return valeurXml(valeurs[m[1]]);
        return esc(morceau);
      }).join('');
      return ouverture + pPr + '<w:r>' + rPr + '<w:t xml:space="preserve">' + contenu + '</w:t></w:r></w:p>';
    });
  }

  async function genererDocx(octets, valeurs) {
    var JSZip = await chargerScript(URL_JSZIP, 'JSZip');
    var zip = await JSZip.loadAsync(octets);
    var fichiers = Object.keys(zip.files).filter(function (n) { return /^word\/(document|header\d*|footer\d*)\.xml$/.test(n); });
    for (var i = 0; i < fichiers.length; i++) {
      var xml = await zip.file(fichiers[i]).async('string');
      zip.file(fichiers[i], remplacerDansParagraphes(xml, valeurs));
    }
    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  // Texte compatible WinAnsi (police standard du PDF) : les autres caractères deviennent « ? »
  function texteSur(t) {
    return String(t || '').replace(/[^\x00-\xFF‘’“”–—…€]/g, '?');
  }

  function decoupe(paragraphe, police, taille, largeur) {
    var mots = texteSur(paragraphe).split(' '), lignes = [], ligne = '';
    mots.forEach(function (mot) {
      var essai = ligne ? ligne + ' ' + mot : mot;
      if (police.widthOfTextAtSize(essai, taille) > largeur && ligne) { lignes.push(ligne); ligne = mot; }
      else ligne = essai;
    });
    lignes.push(ligne);
    return lignes;
  }

  async function genererPdf(octets, type, texte) {
    var PDFLib = await chargerScript(URL_PDFLIB, 'PDFLib');
    var doc = await PDFLib.PDFDocument.create();
    var fond, largeur = A4[0], hauteur = A4[1], dessiner;
    if (type === 'pdf') {
      var modele = await PDFLib.PDFDocument.load(octets);
      if (!modele.getPageCount()) throw new Error('PDF vide');
      var pg = modele.getPage(0);
      largeur = pg.getWidth(); hauteur = pg.getHeight();
      var [embarquee] = await doc.embedPages([pg]);
      fond = embarquee;
      dessiner = function (page) { page.drawPage(fond, { x: 0, y: 0, width: largeur, height: hauteur }); };
    } else {
      var image = type === 'png' ? await doc.embedPng(octets) : await doc.embedJpg(octets);
      dessiner = function (page) { page.drawImage(image, { x: 0, y: 0, width: largeur, height: hauteur }); };
    }
    var police = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
    var zoneLargeur = largeur - MARGES.gauche - MARGES.droite;
    var page = null, y = 0;
    function nouvellePage() {
      page = doc.addPage([largeur, hauteur]);
      dessiner(page);
      y = hauteur - MARGES.haut;
    }
    nouvellePage();
    String(texte || '').split('\n').forEach(function (paragraphe) {
      decoupe(paragraphe, police, TAILLE_TEXTE, zoneLargeur).forEach(function (ligne) {
        if (y < MARGES.bas) nouvellePage();
        if (ligne) page.drawText(ligne, { x: MARGES.gauche, y: y, size: TAILLE_TEXTE, font: police });
        y -= TAILLE_TEXTE * 1.45;
      });
      y -= TAILLE_TEXTE * 0.5;
    });
    return doc.save();
  }

  async function generer(opts) {
    var modele = opts && opts.modele;
    if (!modele || !modele.url) throw new Error('aucun modèle');
    var ext = String(modele.nom || '').split('.').pop().toLowerCase();
    var reponse = await fetch(modele.url);
    if (!reponse.ok) throw new Error('modèle inaccessible');
    var octets = await reponse.arrayBuffer();
    if (ext === 'docx') {
      return { blob: await genererDocx(octets, opts.valeurs || {}), ext: 'docx' };
    }
    if (ext === 'pdf') {
      var pdf = await genererPdf(octets, 'pdf', opts.texte);
      return { blob: new Blob([pdf], { type: 'application/pdf' }), ext: 'pdf' };
    }
    if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') {
      var img = await genererPdf(octets, ext === 'png' ? 'png' : 'jpg', opts.texte);
      return { blob: new Blob([img], { type: 'application/pdf' }), ext: 'pdf' };
    }
    throw new Error('format ' + ext + ' non utilisable : enregistrez le modèle en .docx, .pdf, .png ou .jpg');
  }

  var API = { generer: generer, genererDocx: genererDocx, genererPdf: genererPdf, remplacerDansParagraphes: remplacerDansParagraphes };
  root.LettresModeles = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
