/* apprentissage-outils.js — Outils de la page Apprentissage.
 * - mdToHtml : convertit le markdown des cours en HTML lisible (titres, listes, tableaux, code, liens).
 * - expliquerErreur : transforme un message technique en explication et en démarche à suivre.
 * Le contenu est échappé avant conversion : aucun HTML du fichier n'est exécuté.
 */
(function (root) {
  'use strict';

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function inline(s) {
    s = esc(s);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/(^|[\s(])(https?:\/\/[^\s)<]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
    return s;
  }

  function mdToHtml(md) {
    var lines = String(md || '').replace(/\r/g, '').split('\n');
    var out = [], para = [], i = 0;
    function flush() { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } }
    function cellules(r) { return r.trim().replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map(function (c) { return c.trim(); }); }
    while (i < lines.length) {
      var l = lines[i];
      if (/^```/.test(l)) {
        flush(); var code = []; i++;
        while (i < lines.length && !/^```/.test(lines[i])) { code.push(lines[i]); i++; }
        i++; out.push('<pre><code>' + esc(code.join('\n')) + '</code></pre>'); continue;
      }
      var h = l.match(/^(#{1,6})\s+(.*)$/);
      if (h) { flush(); var n = h[1].length; out.push('<h' + n + '>' + inline(h[2]) + '</h' + n + '>'); i++; continue; }
      if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { flush(); out.push('<hr>'); i++; continue; }
      if (/^\s*\|/.test(l) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
        flush(); var head = cellules(l); i += 2; var rows = [];
        while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(cellules(lines[i])); i++; }
        out.push('<table><thead><tr>' + head.map(function (c) { return '<th>' + inline(c) + '</th>'; }).join('') +
          '</tr></thead><tbody>' + rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>'; }).join('') +
          '</tbody></table>');
        continue;
      }
      if (/^>\s?/.test(l)) {
        flush(); var q = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) { q.push(lines[i].replace(/^>\s?/, '')); i++; }
        out.push('<blockquote>' + inline(q.join(' ')) + '</blockquote>'); continue;
      }
      if (/^\s*-\s+/.test(l)) {
        flush(); var items = [];
        while (i < lines.length && /^\s*-\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*-\s+/, '')); i++; }
        out.push('<ul>' + items.map(function (x) { return '<li>' + inline(x) + '</li>'; }).join('') + '</ul>'); continue;
      }
      if (/^\s*\d+\.\s+/.test(l)) {
        flush(); var num = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { num.push(lines[i].replace(/^\s*\d+\.\s+/, '')); i++; }
        out.push('<ol>' + num.map(function (x) { return '<li>' + inline(x) + '</li>'; }).join('') + '</ol>'); continue;
      }
      if (l.trim() === '') { flush(); i++; continue; }
      para.push(l.trim()); i++;
    }
    flush();
    return out.join('\n');
  }

  // Message technique -> explication et démarche à suivre
  function expliquerErreur(m) {
    m = String(m || '');
    if (/Failed to send|Failed to fetch|not found|404|Function not found|NetworkError/i.test(m))
      return "La fonction serveur « formation-comptes » n'est pas encore déployée. Démarche : DEPLOIEMENT.md, étape 3 (supabase functions deploy formation-comptes).";
    if (/does not exist|42P01|42703|relation|schema cache|Could not find the table/i.test(m))
      return "Les tables de la formation n'existent pas encore dans la base. Démarche : exécuter sql/formation-comptes.sql dans Supabase (SQL Editor), étape 2.";
    if (/401|Connexion requise|JWT|not authenticated|non connecté/i.test(m))
      return "Vous n'êtes pas connecté. Reconnectez-vous puis réessayez.";
    if (/403|Droit insuffisant|Réservé|permission|policy/i.test(m))
      return "Votre compte n'a pas le droit de faire cette action. Seul le propriétaire, ou un administrateur de la société, peut gérer les apprenants.";
    if (/Invitation impossible|already|déjà/i.test(m))
      return "Cette adresse e-mail a déjà un compte ou une invitation en attente. " + m;
    return m || "Erreur inconnue. Consultez la console du navigateur (F12) pour le détail.";
  }

  var API = { mdToHtml: mdToHtml, expliquerErreur: expliquerErreur };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.ApprentissageOutils = API;
})(typeof window !== 'undefined' ? window : globalThis);
