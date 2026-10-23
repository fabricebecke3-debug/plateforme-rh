/* paie-enfants.js — Enfants de la salariée : âge et nombre d'enfants de moins de 6 ans.
 * Dates au format AAAA-MM-JJ ou JJ/MM/AAAA. Un enfant « a moins de 6 ans » si son âge révolu est 0 à 5 à la date de référence.
 * PaieEnfants.ageAns(dateNaissance, date)  : âge en années révolues, ou null si une date est illisible.
 * PaieEnfants.moins6ans(dates, date)       : nombre d'enfants de moins de 6 ans à cette date.
 * PaieEnfants.finPeriode(periode)          : date de fin de la période du bulletin (« JJ/MM/AA au JJ/MM/AA »), ou null.
 */
(function (root) {
  'use strict';

  function parse(d) {
    if (d instanceof Date) return isNaN(d) ? null : d;
    var t = String(d || '').trim(), m;
    if ((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t))) return new Date(+m[1], +m[2] - 1, +m[3]);
    if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(t))) {
      var y = +m[3]; if (y < 100) y += 2000;
      return new Date(y, +m[2] - 1, +m[1]);
    }
    return null;
  }
  function ageAns(naissance, date) {
    var b = parse(naissance), d = parse(date);
    if (!b || !d) return null;
    var a = d.getFullYear() - b.getFullYear();
    if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) a--;
    return a;
  }
  function moins6ans(dates, date) {
    return (dates || []).filter(function (x) {
      var a = ageAns(x, date);
      return a !== null && a >= 0 && a < 6;
    }).length;
  }
  function finPeriode(periode) {
    var m = /(\d{1,2}\/\d{1,2}\/\d{2,4})\s+au\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/.exec(String(periode || ''));
    return m ? parse(m[2]) : null;
  }

  root.PaieEnfants = { ageAns: ageAns, moins6ans: moins6ans, finPeriode: finPeriode, parse: parse };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PaieEnfants;
})(typeof window !== 'undefined' ? window : globalThis);
