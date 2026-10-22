const path=process.argv[2];
const H=require(path||require('path').join(__dirname,'..','paie-hok.js'));
const inp=require(require('path').join(__dirname,'bulletins-septembre-2026.json'));
const names={};
const fs=require('fs');

const ansOf=t=>{const m=/(\d+)\s*an/.exec(t||'');return m?+m[1]:0;};
let ok=0,rows=[];
for(const [sk,v] of Object.entries(inp)){
  const manuels=(v.other||[]).map(([lib,r,gain],i)=>({code:String(r),lib,gain}));
  const o=H.calculer({salaireBase:v.sb,salaireMensuel:v.smens,assiduite:v.ass_in,logement:v.log,ansAnciennete:ansOf(v.anc),transport:v.tr,manuels,congePris:false,exonere:v.exon,rappel:v.rappel,avance:v.avance,params:H.charger()});
  const e=o.exact;
  const cmp={brut:e.brut-v.brut, cnps:e.cnps-v.cnps, irpp:e.irpp-v.irpp, cac:e.cac-v.cac, cfc:e.cfc-v.cfc, rav:e.rav-v.rav, tc:e.tc-v.tc, net:e.net-v.net};
  const bad=Object.entries(cmp).filter(([k,d])=>Math.abs(d)>1);
  if(!bad.length) ok++;
  rows.push([sk, bad.map(([k,d])=>k+':'+d.toFixed(2)).join(' ')||'OK']);
}
rows.forEach(r=>console.log(r[0].padEnd(16),r[1]));
console.log('exacts (tolerance 1 FCFA sur chaque poste):',ok,'/',Object.keys(inp).length);
