// Contrôles d'unicité : code = une rubrique ; matricule = un salarié ; N° CNPS = un salarié
globalThis.PaieMoteur = require('../paie-moteur.js');
globalThis.PaieHok = require('../paie-hok.js');
globalThis.PaieUnicite = require('../paie-unicite.js');
const U = globalThis.PaieUnicite, H = globalThis.PaieHok;
let ok = 0, ko = 0;
const verif = (nom, cond) => { cond ? ok++ : ko++; console.log((cond ? 'OK   ' : 'ECHEC') + ' ' + nom); };

// 1. matricules
verif('matricule en double détecté', U.matricules([{ id: 1, matricule: 'B126', nom: 'A' }, { id: 2, matricule: 'B126', nom: 'B' }]).length === 1);
verif('matricules distincts acceptés', U.matricules([{ id: 1, matricule: 'B126' }, { id: 2, matricule: 'B127' }]).length === 0);
verif('matricule vide ignoré', U.matricules([{ id: 1, matricule: '' }, { id: 2, matricule: '' }]).length === 0);

// 2. N° CNPS (avec ou sans tirets/espaces = même numéro)
verif('CNPS en double détecté (tirets différents)', U.cnps([{ id: 1, cnps: '390-1024355-8', nom: 'A' }, { id: 2, cnps: '3901024355 8', nom: 'B' }]).length === 1);
verif('CNPS distincts acceptés', U.cnps([{ id: 1, cnps: '390-1024355-8' }, { id: 2, cnps: '390-1024356-8' }]).length === 0);

// 3. codes : un code = une rubrique
verif('même code, deux libellés : conflit', U.codes([{ code: '7', lib: 'Prime de caisse' }, { code: '7', lib: 'Panier' }]).length === 1);
verif('même code, même libellé (casse/espaces) : pas de conflit', U.codes([{ code: '7', lib: 'Prime de caisse' }, { code: '7', lib: ' prime  de CAISSE ' }]).length === 0);

// 4. rubrique libre de l'hôtel : même libellé = même code pour tous les salariés
const p0 = Object.assign({}, H.charger(), { codes_libres: {} });
const p1 = H.memoriserCodes(p0, [{ lib: 'Prime de caisse' }, { lib: 'Cantine' }]);
const codeCaisse = p1.codes_libres['prime de caisse'].code;
const codeCantine = p1.codes_libres['cantine'].code;
verif('deux libellés reçoivent deux codes différents', codeCaisse !== codeCantine);
const c1 = H.calculer({ salaireBase: 71500, ansAnciennete: 3, manuels: [{ code: '', lib: 'Prime de caisse', gain: 5000 }], params: p1 });
const c2 = H.calculer({ salaireBase: 80000, ansAnciennete: 3, manuels: [{ code: '', lib: 'Prime de caisse', gain: 3000 }, { code: '', lib: 'Cantine', gain: 0 }], params: p1 });
const cod = (o, lib) => (o.gains.concat(o.retenues).filter(r => r.lib === lib)[0] || {}).code;
verif('même libellé = même code sur deux salariés', cod(c1, 'Prime de caisse') === codeCaisse && cod(c2, 'Prime de caisse') === codeCaisse);
verif('un code ne désigne jamais deux libellés dans un calcul', U.codes(c2.gains.map(g => ({ code: g.code, lib: g.lib }))).length === 0);
// 5. une demande de code déjà prise par un autre libellé est refusée (le registre prime)
const p2 = H.memoriserCodes(p1, [{ code: codeCaisse, lib: 'Autre libellé' }]);
verif('code déjà pris ailleurs : le nouveau libellé reçoit un autre code', p2.codes_libres['autre libellé'].code !== codeCaisse);

console.log('\n' + ok + ' OK, ' + ko + ' échec(s)');
process.exitCode = ko ? 1 : 0;
