/* =====================================================================
 * TERH · cnps-ia.js — IA + assistant interne du module CNPS
 * Fichier d'appoint (comme dipe-plus.js) : à garder à côté de index.html.
 *
 *  🔺 TRIANGULATION avant génération du DIPE : chaque salarié est recoupé entre
 *     4 sources — le bulletin, la fiche employé, le référentiel CNPS, le dernier DIPE.
 *     AUCUN calcul ni taux : les bulletins sont déjà calculés par Sage Paie ; on vérifie
 *     seulement que la bonne information (N° CNPS, matricule, brut, cotisable, jours) est reprise.
 *     Résultat : un score de fiabilité par salarié et un verdict global.
 *  📄 LECTURE FACILE du bulletin : gains / retenues / cotisations / totaux, lignes clés
 *     surlignées, contrôles ✔/✖ et explication en langage simple (IA, facultative).
 *  🤖 ANALYSE IA : synthèse priorisée des anomalies (données anonymisées, rien d'appliqué).
 *  💬 ASSISTANT CNPS : répond d'abord avec VOS données (sans IA, hors ligne), puis avec l'IA.
 *
 * Règle d'or : aucune valeur n'est modifiée automatiquement. L'IA n'envoie jamais
 * de nom ni de N° CNPS (remplacés par L1, L2…).
 * ===================================================================== */
(function(){
'use strict';
const X=window.TERH_CNPSIA=window.TERH_CNPSIA||{};
X.version='2026.10.1';
X.alt=null;      /* contexte de repli (module CNPS ouvert sans DIPE) */
X.ctx=null;      /* contexte DIPE (fourni par dipe-plus.js) */

/* ---------- outils ---------- */
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const digits=s=>String(s||'').replace(/\D/g,'');
const nz=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const fmt=n=>(Math.round(+n||0)).toLocaleString('fr-FR');
const STOP=new Set(['de','du','la','le','des','et','ep','epse','nee','m','mme','mr']);
const toks=s=>[...new Set(nz(s).split(' ').filter(w=>w.length>1&&!STOP.has(w)))];
function nameScore(a,b){const A=toks(a),B=toks(b);if(!A.length||!B.length)return 0;
  const c=A.filter(w=>B.includes(w)).length;if(!c)return 0;const mn=Math.min(A.length,B.length),mx=Math.max(A.length,B.length);
  if(c===A.length&&c===B.length)return 100;if(c>=2&&c===mn)return 80+c;if(c>=2&&c/mx>=.66)return 60+c;return c===mn&&mn===1&&mx===1?100:0;}
const normMi=s=>{s=String(s||'').toUpperCase().replace(/[\s\-\/.]/g,'');return /^\d+$/.test(s)?(s.replace(/^0+/,'')||'0'):s;};
const sameMi=(a,b)=>{const x=normMi(a),y=normMi(b);if(!x||!y)return false;if(x===y)return true;
  const dx=((x.match(/\d+$/)||[''])[0]).replace(/^0+/,''),dy=((y.match(/\d+$/)||[''])[0]).replace(/^0+/,'');
  return !!dx&&dx===dy&&(/^\d+$/.test(x)||/^\d+$/.test(y));};
const say=m=>{try{(X.ctx&&X.ctx.say)?X.ctx.say(m):(typeof toast==='function'?toast(m):alert(m));}catch(e){}};
const fmtPct=v=>(v>0?'+':'')+Math.round(v*100)+' %';
/* montants d'une ligne de bulletin : 146990.000 → 146990 ; 146 990 → 146990 ; 4.2 → 4 (taux, ignoré par seuil) */
const numsOf=line=>{const out=[],re=/\d{1,3}(?:[\s  ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?/g;let m;
  while((m=re.exec(String(line||'')))){let s=m[0].replace(/[\s  ]/g,'');let v;
    if(/^\d{1,3}([.,]\d{3})+$/.test(s))v=parseInt(s.replace(/[.,]/g,''),10);
    else{const d=/^(\d+)[.,]\d+$/.exec(s);v=d?parseInt(d[1],10):parseInt(s,10);}
    out.push({v,raw:m[0],dec:/[.,]\d/.test(m[0])});}
  return out;};
const linesOf=t=>String(t||'').replace(/[  ]/g,' ').split(/\n+/).map(l=>l.replace(/[ \t]+/g,' ').trim()).filter(Boolean);
const flatTxt=t=>String(t||'').replace(/[\s  .,]/g,'');

/* ---------- environnement (DIPE ouvert ou simple module CNPS) ---------- */
X.attach=function(ctx){if(ctx)X.ctx=ctx;};
function env(){
  const c=X.ctx;
  const dipeRows=c&&c.R&&c.R.length;
  if(dipeRows){
    let per='';try{per=(c.g&&c.g('d_mo')&&c.g('d_mo').value)||'';}catch(e){}
    return {mode:'dipe',R:c.R,E:c.E||[],MAT:c.MAT||{},PC:c.PC||{},period:per,incl:c.incl,say:c.say,
      prev:(window.TERH_DIPE&&window.TERH_DIPE.prev)||null};
  }
  const a=X.alt||{};
  return {mode:'fiches',R:[],E:a.E||(c&&c.E)||[],MAT:a.MAT||{},PC:a.PC||{},period:'',incl:null,say:a.say||say,prev:null};
}
function refList(){try{const S=window.TERH_CNPSREF&&window.TERH_CNPSREF.S;return (S&&S.list)||[];}catch(er){return [];}}
function slipLog(){const m=new Map();try{(window.__slipLog||[]).forEach(x=>{if(x&&x.row)m.set(x.row,x.slip||{});});}catch(e){}return m;}

/* ---------- 1. TRIANGULATION ---------- */
X.analyze=function(){
  const e=env(),R=e.R,E=e.E,MAT=e.MAT,ref=refList(),SL=slipLog();
  const findE=r=>{
    let f=r.eid?E.find(x=>String(x.id)===String(r.eid)):null;
    if(!f&&digits(r.cnps).length===11)f=E.find(x=>digits(x.cnps)===digits(r.cnps));
    if(!f&&r.mi)f=E.find(x=>MAT[x.id]&&sameMi(MAT[x.id],r.mi));
    if(!f&&r.nom){let best=null,bs=0,amb=false;E.forEach(x=>{const s=nameScore(r.nom,x.n);if(s>bs){bs=s;best=x;amb=false;}else if(s&&s===bs)amb=true;});
      if(best&&bs>=80&&!amb)f=best;}
    return f||null;};
  const findRef=(r,f)=>{
    const c=digits(r.cnps).length===11?digits(r.cnps):(f&&digits(f.cnps).length===11?digits(f.cnps):'');
    let o=c?ref.find(x=>x.c===c):null;
    if(!o&&r.nom){let best=null,bs=0,amb=false;ref.forEach(x=>{const s=nameScore(r.nom,x.n);if(s>bs){bs=s;best=x;amb=false;}else if(s&&s===bs&&best&&x.c!==best.c)amb=true;});
      if(best&&bs>=80&&!amb)o=best;}
    return o||null;};
  const prevOf=r=>{const P=e.prev;if(!P)return null;const c=digits(r.cnps);return (c&&P[c])||(r.mi&&P['m'+normMi(r.mi)])||null;};
  const per=e.period,out=[],glob=[];
  /* doublons */
  const cnt={};R.forEach(r=>{[digits(r.cnps).length===11?'c'+digits(r.cnps):'',r.mi?'m'+normMi(r.mi):''].forEach(k=>{if(k)cnt[k]=(cnt[k]||0)+1;});});

  const rowsToCheck=R.length?R.map((r,i)=>({r,i})).filter(o=>e.incl?e.incl(o.r,o.i):!o.r.excl):[];
  rowsToCheck.forEach(({r,i})=>{
    const F=[],add=(sev,code,msg)=>F.push({sev,code,msg});
    const f=findE(r),o=findRef(r,f),pv=prevOf(r),sl=SL.get(r)||{},txt=r._t||sl._t||'';
    const c=digits(r.cnps),brut=+r.brut||0,cot=+r.cot||0,jours=+r.jours||0;
    const src={nom:{B:sl.nomBul||'',F:f?f.n:'',R:o?o.n:'',P:pv?pv.nom:r.nom||''},
      cnps:{B:r.cnpsWas||(r.cnpsAuto||r.cnpsRef?'':r.cnps)||'',F:f?digits(f.cnps):'',R:o?o.c:'',P:pv?pv.cnps:''},
      mi:{B:sl.mi||(r.miAuto||r.miGen?'':r.mi)||'',F:f?(MAT[f.id]||''):'',R:'',P:pv?pv.mi:''},
      brut:{B:brut,F:'',R:'',P:pv?pv.brut:''},cot:{B:cot,F:'',R:'',P:pv?pv.cot:''},jours:{B:jours,F:'',R:'',P:pv?pv.jours:''}};
    /* --- identité --- */
    if(c.length!==11)add('err','cnps','N° CNPS invalide ou manquant ('+(r.cnps||'vide')+')');
    if(f&&digits(f.cnps).length===11&&c.length===11&&digits(f.cnps)!==c)add('err','cnps-f','N° CNPS différent de la fiche employé : DIPE '+r.cnps+' ≠ fiche '+f.cnps);
    if(o&&c.length===11&&o.c!==c)add('err','cnps-r','N° CNPS différent du référentiel CNPS : '+r.cnps+' ≠ '+o.c);
    if(r.cnpsWas&&digits(r.cnpsWas)!==c)add('info','cnps-fix','N° du bulletin ('+r.cnpsWas+') corrigé par le référentiel → '+r.cnps);
    if(c.length===11&&!o&&ref.length)add('warn','no-ref','Absent du référentiel CNPS importé (N° non confirmé par la CNPS)');
    if(!f)add('warn','no-fiche','Aucune fiche employé correspondante (salarié inconnu de la plateforme ?)');
    if(f&&o&&nameScore(f.n,o.n)<60)add('warn','nom-ref','Nom de la fiche (« '+f.n+' ») ≠ nom du référentiel (« '+o.n+' »)');
    if(f&&sl.nomBul&&nameScore(f.n,sl.nomBul)<60)add('warn','nom-b','Nom du bulletin (« '+sl.nomBul+' ») ≠ fiche (« '+f.n+' »)');
    if(src.mi.B&&src.mi.F&&!sameMi(src.mi.B,src.mi.F))add('warn','mi','Matricule du bulletin ('+src.mi.B+') ≠ matricule de la fiche ('+src.mi.F+')');
    if(r.mi&&[brut,cot,+r.net].some(v=>v&&String(Math.round(v))===digits(r.mi).replace(/^0+/,'')))add('err','mi-amount','Matricule interne ('+r.mi+') identique à un MONTANT du bulletin (brut/cotisable/net) : mauvaise ligne lue — corrigez, ou supprimez le libellé faux dans 🏷 Mes libellés');
    if(!r.mi&&!src.mi.F)add('info','no-mi','Matricule interne absent');
    if((c.length===11&&cnt['c'+c]>1)||(r.mi&&cnt['m'+normMi(r.mi)]>1))add('err','dup','Doublon dans le tableau (même N° CNPS ou même matricule)');
    /* --- période / contrat --- */
    if(f&&per&&/^\d{4}-\d{2}/.test(per)){
      if(/^\d{4}-\d{2}/.test(f.fin||'')&&f.fin.slice(0,7)<per)add('warn','fin','Contrat terminé le '+f.fin+' avant la période '+per);
      if(/^\d{4}-\d{2}/.test(f.deb||'')&&f.deb.slice(0,7)>per)add('warn','deb','Embauche le '+f.deb+' après la période '+per);}
    /* --- montants --- */
    if(!(brut>0))add('err','brut','Brut manquant (0)');
    if(!(cot>0))add('err','cot','Cotisable manquant : pas de « Pension vieillesse CNPS » lue');
    if(brut>0&&cot>brut*1.001)add('err','cot>brut','Cotisable ('+fmt(cot)+') supérieur au brut ('+fmt(brut)+')');
    if(r.cotEst&&brut>0)add('warn','cot-est','Cotisable ESTIMÉ (non recopié du bulletin) — à confirmer sur le bulletin');
    if(jours<1||jours>31)add('err','jours','Nombre de jours invalide ('+jours+')');
    else if(r.jMode==='def'&&brut>0)add('warn','jours-def','Jours = 30 PAR DÉFAUT : aucun nombre de jours ni d\'heures trouvé sur le bulletin — confirmez le nombre exact avant de déclarer');
    else if(r.jMode==='ded')add('info','jours-ded','Jours déduits du bulletin : '+((r.src&&r.src.jours)||''));
    else if(jours<30&&brut>0)add('info','jours','Mois incomplet : '+jours+' jours');
    /* --- recoupement avec le texte du bulletin --- */
    if(txt){
      const fl=flatTxt(txt),inTxt=v=>v>0&&fl.includes(String(Math.round(v)));
      if(brut>0&&!inTxt(brut))add('warn','brut-txt','Brut '+fmt(brut)+' introuvable dans le texte du bulletin');
      const P=X.pension(txt);
      if(P.found){
        if(P.base&&cot>0&&P.base!==cot)add('err','cot-line','Cotisable '+fmt(cot)+' ≠ base lue sur la ligne « Pension vieillesse » ('+fmt(P.base)+')');
        src.cot.R=P.base?P.base:'';
      }else if(cot>0)add('info','no-line','Ligne « Pension vieillesse » non retrouvée dans le texte (cotisable saisi à la main ?)');
    }
    /* --- variation vs dernier DIPE --- */
    if(pv){
      const cmp=(lab,nw,old,key)=>{if(!(nw>0)||!(old>0))return;const k=nw/old;
        if((k>=9&&k<=11)||(k>=.09&&k<=.11))add('err','x10-'+key,lab+' : '+fmt(nw)+' vs '+fmt(old)+' au dernier DIPE — erreur d\'unité probable (×10 / ÷10)');
        else if(k>1.5||k<.67)add('warn','var-'+key,lab+' : '+fmtPct(k-1)+' vs dernier DIPE ('+fmt(old)+' → '+fmt(nw)+')');};
      cmp('Brut',brut,+pv.brut,'brut');cmp('Cotisable',cot,+pv.cot,'cot');
    }else if(e.prev)add('info','new','Absent du dernier DIPE (nouveau salarié ?)');
    const err=F.filter(x=>x.sev==='err').length,warn=F.filter(x=>x.sev==='warn').length,inf=F.filter(x=>x.sev==='info').length;
    out.push({r,i,f,o,pv,F,src,err,warn,info:inf,score:Math.max(0,100-40*err-15*warn-3*inf),
      nom:r.nom||(f&&f.n)||sl.nomBul||'(nom inconnu)'});
  });

  /* --- mode fiches seules (aucun bulletin chargé) --- */
  if(!R.length){
    const cnt2={};E.forEach(x=>{const c=digits(x.cnps);if(c.length===11)cnt2[c]=(cnt2[c]||0)+1;});
    E.forEach(x=>{const F=[],add=(s,c,m)=>F.push({sev:s,code:c,msg:m});const c=digits(x.cnps),o=c.length===11?ref.find(y=>y.c===c):null;
      if(!c)add('err','cnps','N° CNPS manquant');else if(c.length!==11)add('err','cnps','N° CNPS invalide ('+x.cnps+')');
      if(c.length===11&&cnt2[c]>1)add('err','dup','N° CNPS en double dans les fiches');
      if(ref.length&&c.length===11&&!o)add('warn','no-ref','Absent du référentiel CNPS importé');
      if(o&&nameScore(x.n,o.n)<60)add('warn','nom-ref','Nom de la fiche ≠ nom du référentiel (« '+o.n+' »)');
      if(!ref.length&&c.length===11)void 0;
      const err=F.filter(y=>y.sev==='err').length,warn=F.filter(y=>y.sev==='warn').length;
      out.push({r:{nom:x.n,cnps:x.cnps},i:-1,f:x,o,pv:null,F,src:{},err,warn,info:0,score:Math.max(0,100-40*err-15*warn),nom:x.n});});
  }else{
    /* --- niveau global : fiches absentes du DIPE, effectif, masse --- */
    const inR=new Set(R.map(r=>r.eid).filter(Boolean).map(String)),inC=new Set(R.map(r=>digits(r.cnps)).filter(c=>c.length===11));
    const miss=E.filter(x=>{if(inR.has(String(x.id))||inC.has(digits(x.cnps)))return false;
      if(per&&/^\d{4}-\d{2}/.test(x.fin||'')&&x.fin.slice(0,7)<per)return false;if(per&&/^\d{4}-\d{2}/.test(x.deb||'')&&x.deb.slice(0,7)>per)return false;return true;});
    if(miss.length)glob.push({sev:'warn',msg:miss.length+' salarié(s) actif(s) des fiches absent(s) du DIPE : '+miss.slice(0,8).map(x=>x.n).join(', ')+(miss.length>8?'…':'')});
    const excl=R.filter((r,i)=>!(e.incl?e.incl(r,i):!r.excl)).length;
    if(excl)glob.push({sev:'info',msg:excl+' ligne(s) exclue(s) du DIPE (non contrôlées)'});
    const P=e.prev;if(P){const vals=Object.keys(P).filter(k=>/^\d{11}$/.test(k)).map(k=>P[k]);
      const nPrev=vals.length,bPrev=vals.reduce((s,v)=>s+(+v.brut||0),0),bNow=out.reduce((s,o)=>s+(+o.r.brut||0),0);
      if(nPrev&&Math.abs(out.length-nPrev)/nPrev>.2)glob.push({sev:'warn',msg:'Effectif du DIPE : '+out.length+' contre '+nPrev+' au dernier DIPE ('+fmtPct(out.length/nPrev-1)+')'});
      if(bPrev&&Math.abs(bNow/bPrev-1)>.25)glob.push({sev:'warn',msg:'Masse brute : '+fmt(bNow)+' contre '+fmt(bPrev)+' au dernier DIPE ('+fmtPct(bNow/bPrev-1)+')'});}
  }
  const errN=out.filter(o=>o.err).length,warnN=out.filter(o=>!o.err&&o.warn).length,okN=out.length-errN-warnN;
  const globErr=glob.filter(g=>g.sev==='warn').length;
  const score=out.length?Math.round(out.reduce((s,o)=>s+o.score,0)/out.length):0;
  const tot={brut:out.reduce((s,o)=>s+(+o.r.brut||0),0),cot:out.reduce((s,o)=>s+(+o.r.cot||0),0)};
  return {env:e,rows:out,glob,errN,warnN,okN,score,tot,
    verdict:errN?'block':(warnN||globErr?'warn':'ok')};
};

/* contrôle de la ligne « Pension vieillesse » d'un bulletin */
X.pension=function(txt){
  const L=linesOf(txt).find(l=>/pension\s+vieillesse/i.test(l));if(!L)return {found:false};
  /* uniquement les montants APRÈS le libellé (le code de ligne Sage, ex. « 8100 », n'est pas un montant) ; 1er = base, il faut au moins base + retenue */
  const m=/pension\s+vieillesse(?:\s+cnps)?/i.exec(L),ns=numsOf(L.slice(m.index+m[0].length)).filter(n=>n.v>=100);
  return {found:true,line:L,base:ns.length>=2?ns[0].v:0};
};

/* ---------- interface commune ---------- */
function panel(html,wide){
  const o=document.createElement('div');o.className='cia-ov';
  o.style.cssText='position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:10px';
  o.innerHTML='<div class="cia" style="background:var(--card,#fff);color:var(--tx,#222);max-width:'+(wide||1000)+'px;width:100%;max-height:94vh;overflow:auto;border-radius:12px;padding:16px;position:relative;font-size:13px"><button data-x style="position:absolute;right:10px;top:8px">✕</button>'+html+'</div>';
  o.addEventListener('click',ev=>{if(ev.target===o||(ev.target.dataset&&ev.target.dataset.x!==undefined))o.remove();});
  document.body.appendChild(o);return o.firstChild;}
const css=()=>{if(document.getElementById('cia_css'))return;const s=document.createElement('style');s.id='cia_css';s.textContent=
 '.cia table{border-collapse:collapse;width:100%}.cia td,.cia th{padding:3px 5px;vertical-align:top}.cia tr.t{border-top:1px solid rgba(128,128,128,.25)}'+
 '.cia .pill{display:inline-block;padding:1px 8px;border-radius:999px;font-size:11px;margin:1px 3px 1px 0;border:1px solid rgba(128,128,128,.4)}'+
 '.cia .e{background:rgba(220,50,50,.15);border-color:#d33}.cia .w{background:rgba(230,150,0,.17);border-color:#e69500}.cia .o{background:rgba(40,160,80,.15);border-color:#2a9d55}.cia .i{opacity:.75}'+
 '.cia .ban{padding:10px 12px;border-radius:10px;margin:8px 0;font-weight:600}.cia .ban.e{background:rgba(220,50,50,.14)}.cia .ban.w{background:rgba(230,150,0,.16)}.cia .ban.o{background:rgba(40,160,80,.15)}'+
 '.cia .bx{border:1px solid rgba(128,128,128,.35);border-radius:8px;padding:8px 10px;margin:8px 0;white-space:pre-wrap;line-height:1.45}'+
 '.cia .hl{background:rgba(31,95,191,.14);font-weight:600}.cia .sec{font-weight:700;padding-top:8px}'+
 '.cia .bar{height:6px;border-radius:3px;background:rgba(128,128,128,.25);min-width:50px}.cia .bar i{display:block;height:100%;border-radius:3px}'+
 '.cia .msg{margin:6px 0;padding:7px 10px;border-radius:10px;max-width:92%;white-space:pre-wrap;line-height:1.45}.cia .me{background:rgba(31,95,191,.16);margin-left:auto}.cia .bot{background:rgba(128,128,128,.14)}';
 document.head.appendChild(s);};
const SEV={err:['❌','e'],warn:['⚠','w'],info:['ℹ️','i']};
const fiab=s=>'<div class="bar" title="Fiabilité '+s+' %"><i style="width:'+s+'%;background:'+(s>=85?'#2a9d55':s>=60?'#e69500':'#d33')+'"></i></div>';
const rich=t=>esc(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\n/g,'<br>');
const maskTxt=(txt,names)=>{let t=String(txt||'');
  t=t.replace(/^(?:M\.?|MME|MLLE|MR|MONSIEUR|MADAME)\s+[A-ZÀ-Ý][A-ZÀ-Ý'’\- ]{4,60}$/gm,'M [NOM MASQUÉ]');
  t=t.replace(/(?<!\d)\d{3}[ .\-]?\d{7}\s*[\/\-]?\s*\d(?!\d)/g,'[CNPS MASQUÉ]');
  (names||[]).forEach(n=>String(n||'').split(/\s+/).filter(w=>w.length>=3).forEach(w=>{t=t.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),'***');}));
  return t;};
async function ask(messages,max){
  if(typeof window.TERH_callAI!=='function')return {err:'service IA non disponible dans cette page'};
  let r;try{r=await window.TERH_callAI({raw:true,messages,max_tokens:max||700},45000);}catch(e){return {err:e.message||String(e)};}
  const d=r&&r.data,er=r&&r.error;if(er||!d||!d.text)return {err:(er&&er.message)||'pas de réponse de l\'IA'};
  return {text:String(d.text).trim()};}
const dl=(name,rows)=>{const csv='﻿'+rows.map(r=>r.map(c=>'"'+String(c==null?'':c).replace(/"/g,'""')+'"').join(';')).join('\r\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);};

/* ---------- fenêtre TRIANGULATION ---------- */
X.openTriangulation=function(opts){
  css();opts=opts||{};const A=X.analyze();
  const vb=A.verdict==='block'?['e','❌ BLOQUANT — '+A.errN+' salarié(s) avec une erreur : corrigez avant de générer le DIPE.']:
    A.verdict==='warn'?['w','⚠ À VÉRIFIER — aucune erreur bloquante, mais des points d\'attention.']:['o','✅ PRÊT — les sources concordent, rien d\'anormal détecté.'];
  const w=panel('<h2 style="margin:0 0 4px">🔺 Triangulation avant DIPE</h2>'+
   '<p class="muted" style="font-size:12px;margin:0 0 6px">Chaque salarié est recoupé entre le <b>bulletin</b>, la <b>fiche employé</b>, le <b>référentiel CNPS</b> et le <b>dernier DIPE</b>, pour vérifier que la <b>bonne information</b> est reprise (N° CNPS, matricule, brut, cotisable, jours). Aucun calcul ni taux : les bulletins viennent de Sage Paie.'+(A.env.mode==='fiches'?' <b>Mode fiches seules</b> : aucun bulletin chargé (ouvrez « DIPE depuis bulletins » pour la triangulation complète).':'')+'</p>'+
   '<div class="ban '+vb[0]+'">'+vb[1]+'</div>'+
   '<div><span class="pill o">✅ '+A.okN+' conforme(s)</span><span class="pill w">⚠ '+A.warnN+' à vérifier</span><span class="pill e">❌ '+A.errN+' en erreur</span><span class="pill">Fiabilité globale '+A.score+' %</span>'+
   (A.env.mode==='dipe'?'<span class="pill">Σ brut '+fmt(A.tot.brut)+'</span><span class="pill">Σ cotisable '+fmt(A.tot.cot)+'</span>':'')+'</div>'+
   (A.glob.length?'<div class="bx">'+A.glob.map(g=>(SEV[g.sev]||SEV.info)[0]+' '+esc(g.msg)).join('\n')+'</div>':'')+
   '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:8px 0"><label><input type="checkbox" id="ci_only" checked> seulement les anomalies</label>'+
   '<button class="p" id="ci_ai">🤖 Analyse intelligente (IA)</button><button class="s" id="ci_as">💬 Assistant CNPS</button><button class="s" id="ci_csv">⬇ Rapport CSV</button></div>'+
   '<div id="ci_aibox"></div><div id="ci_t"></div>'+
   (opts.gate?'<div style="margin-top:12px;padding-top:10px;border-top:1px solid rgba(128,128,128,.3)">'+(A.errN?'<label style="display:block;margin-bottom:6px"><input type="checkbox" id="ci_conf"> Je confirme avoir vérifié les erreurs ci-dessus et vouloir continuer (les lignes en erreur seront exclues à l\'étape suivante).</label>':'')+
     '<button class="p" id="ci_go"'+(A.errN?' disabled':'')+'>➡ Continuer vers la validation du DIPE</button> <button class="s" id="ci_back">Revenir corriger</button></div>':''),1100);
  const T=w.querySelector('#ci_t');
  const draw=()=>{const only=w.querySelector('#ci_only').checked;
    const rows=A.rows.filter(o=>!only||o.F.some(x=>x.sev!=='info')||o.err||o.warn).sort((a,b)=>a.score-b.score);
    if(!rows.length){T.innerHTML='<p class="muted">Aucune anomalie à afficher.</p>';return;}
    T.innerHTML='<table><tr><th align="left">Salarié</th><th>Fiabilité</th><th align="left">Remarques</th><th></th></tr>'+rows.map((o,k)=>
      '<tr class="t"><td><b>'+esc(o.nom)+'</b><br><span class="muted">'+esc(o.r.cnps||'')+'</span></td><td style="min-width:70px;text-align:center">'+o.score+' %'+fiab(o.score)+'</td>'+
      '<td>'+(o.F.length?o.F.map(x=>'<span class="pill '+SEV[x.sev][1]+'">'+SEV[x.sev][0]+' '+esc(x.msg)+'</span>').join(''):'<span class="pill o">✅ conforme</span>')+'</td>'+
      '<td style="white-space:nowrap"><button class="s" data-d="'+k+'" title="Comparer les sources">🔺</button>'+(o.r._t?' <button class="s" data-b="'+k+'" title="Lire le bulletin">📄</button>':'')+(o.i>=0&&window.TERH_DIPE&&window.TERH_DIPE.focus?' <button class="s" data-f="'+k+'" title="Corriger cette ligne dans le tableau">✏</button>':'')+'</td></tr>'+
      '<tr id="ci_d'+k+'" style="display:none"><td colspan="4"></td></tr>').join('')+'</table>';
    T.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{const k=+b.dataset.d,tr=T.querySelector('#ci_d'+k);
      if(tr.style.display==='none'){tr.firstChild.innerHTML=compare(rows[k]);tr.style.display='';}else tr.style.display='none';});
    T.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{const o=rows[+b.dataset.f];w.parentNode.remove();if(!window.TERH_DIPE.focus(o.i))say('Ligne introuvable dans le tableau');});
    T.querySelectorAll('[data-b]').forEach(b=>b.onclick=()=>X.readSlip(rows[+b.dataset.b].r));};
  w.querySelector('#ci_only').onchange=draw;draw();
  w.querySelector('#ci_as').onclick=()=>X.openAssistant();
  w.querySelector('#ci_csv').onclick=()=>dl('triangulation_cnps.csv',[['Salarié','N° CNPS','Fiabilité %','Niveau','Remarques']].concat(A.rows.map(o=>[o.nom,o.r.cnps||'',o.score,o.err?'ERREUR':o.warn?'À VÉRIFIER':'OK',o.F.map(x=>SEV[x.sev][0]+' '+x.msg).join(' | ')])));
  w.querySelector('#ci_ai').onclick=async ev=>{const b=ev.currentTarget,box=w.querySelector('#ci_aibox');
    if(!A.rows.some(o=>o.F.length)&&!A.glob.length){box.innerHTML='<div class="bx">🤖 Rien à analyser : aucune anomalie.</div>';return;}
    b.disabled=true;const old=b.textContent;b.textContent='🤖 Analyse…';box.innerHTML='<div class="bx">⏳ L\'IA analyse (données anonymisées : L1, L2… à la place des noms)…</div>';
    const r=await X.aiAnalyse(A);b.disabled=false;b.textContent=old;
    box.innerHTML=r.err?'<div class="bx">🤖 IA indisponible ('+esc(r.err)+'). La triangulation ci-dessous reste valable.</div>':
      '<div class="bx">🤖 <b>Analyse de l\'IA</b> <span class="muted">(indicative — à vérifier ; elle ne modifie rien)</span>\n\n'+rich(r.text).replace(/<br>/g,'\n')+'</div>';};
  if(opts.gate){
    const go=w.querySelector('#ci_go'),cf=w.querySelector('#ci_conf');
    if(cf)cf.onchange=()=>{go.disabled=!cf.checked;};
    go.onclick=()=>{w.parentNode.remove();opts.gate();};
    w.querySelector('#ci_back').onclick=()=>w.parentNode.remove();}
  return A;
};
/* comparaison source par source d'un salarié */
function compare(o){
  const rows=[['Nom','nom'],['N° CNPS','cnps'],['Matricule','mi'],['Brut','brut'],['Cotisable','cot'],['Jours','jours']];
  const val=(k,v)=>v===''||v==null?'<span class="muted">—</span>':(typeof v==='number'?fmt(v):esc(v));
  const same=(k,a,b)=>{if(a===''||b===''||a==null||b==null)return true;
    if(k==='nom')return nameScore(a,b)>=60;if(k==='cnps')return digits(a)===digits(b);if(k==='mi')return sameMi(a,b);return +a===+b;};
  const rs=rows.map(([lab,k])=>{const s=o.src[k]||{},vals=['B','F','R','P'].map(x=>s[x]);
    const ref=vals.find(v=>v!==''&&v!=null);
    return '<tr class="t"><td><b>'+lab+'</b></td>'+vals.map((v,ix)=>{const bad=ix>0&&ref!=null&&v!==''&&v!=null&&!same(k,ref,v)&&!(k==='brut'||k==='cot'||k==='jours'?false:false);
      const tol=(k==='brut'||k==='cot'||k==='jours')&&ix===3;/* P = dernier DIPE : écart normal en montant, signalé ailleurs */
      return '<td'+(bad&&!tol?' class="e" style="background:rgba(220,50,50,.15)"':'')+'>'+val(k,v)+(bad&&!tol?' ✖':'')+'</td>';}).join('')+'</tr>';}).join('');
  return '<div style="padding:6px 8px;border-left:3px solid #1f5fbf;margin:2px 0 6px"><table style="font-size:12px"><tr><th></th><th align="left">📄 Bulletin</th><th align="left">👤 Fiche employé</th><th align="left">📚 Référentiel CNPS</th><th align="left">🗂 Dernier DIPE</th></tr>'+rs+'</table>'+
    '<div class="muted" style="font-size:11px;margin-top:4px">Pour le cotisable, la colonne « Référentiel » affiche la base lue sur la ligne « Pension vieillesse » du bulletin.</div></div>';}

/* ---------- 2. LECTURE FACILE d'un bulletin ---------- */
const SECT=[['gains','🟢 Gains / rémunération',/salaire|prime|indemnit|gratification|heures?\s+sup|h\.?\s*sup|avantage|commission|rappel|boni|transport|logement|ancien/i],
  ['ret','🔴 Retenues salarié',/pension|cnps|irpp|imp[oô]t|cac\b|cr[ée]dit\s+foncier|cfc|crtv|taxe|avance|acompte|retenue|mutuelle|pr[êe]t|syndic|cotisation/i],
  ['pat','🔵 Charges patronales',/employeur|patron|allocation|prestations?\s+familiales|accident|fne|fonds\s+national/i]];
X.readSlip=async function(row){
  css();const txt=row&&row._t;if(!txt){say('Pas de texte lu pour ce bulletin');return;}
  const L=linesOf(txt),P=X.pension(txt);
  const key=[['Total brut',/total\s+brut|brut\s+total|salaire\s+brut/i],['Pension vieillesse CNPS',/pension\s+vieillesse/i],['Net à payer',/net\s+[àa]\s+payer/i],['Total retenues',/total\s+(?:des\s+)?retenues/i]];
  const isKey=l=>key.some(k=>k[1].test(l));
  const groups={info:[],gains:[],ret:[],pat:[],tot:[],autre:[]};
  L.forEach(l=>{const n=numsOf(l);
    if(!n.length){groups.info.push(l);return;}
    if(/total|net\s+[àa]\s+payer|brut\b/i.test(l)&&!/pension|cnps/i.test(l)){groups.tot.push(l);return;}
    if(/matricule|p[ée]riode|du\s+\d|jours|bulletin|date|n[°o]|s[ée]curit/i.test(l)&&n.every(x=>x.v<100000000)&&!/pension/i.test(l)){groups.info.push(l);return;}
    for(const [k,,re] of SECT){if(re.test(l)){groups[k].push(l);return;}}
    groups.autre.push(l);});
  const row1=(l)=>{const m=/^(.*?)(\s-?\d.*)?$/.exec(l),lab=(m&&m[1]||l).trim(),nums=numsOf(l).map(x=>x.raw.trim());
    return '<tr class="t'+(isKey(l)?' hl':'')+'"><td>'+esc(lab||l)+'</td><td style="text-align:right;white-space:nowrap">'+nums.map(esc).join(' &nbsp;·&nbsp; ')+'</td></tr>';};
  const sec=(t,arr)=>arr.length?'<tr><td colspan="2" class="sec">'+t+'</td></tr>'+arr.map(row1).join(''):'';
  const chk=[];
  chk.push(['Brut lu = '+fmt(row.brut),row.brut>0&&flatTxt(txt).includes(String(Math.round(row.brut)))]);
  chk.push(['Cotisable retenu = '+fmt(row.cot)+(row.cotEst?' (estimé)':''),row.cot>0&&!row.cotEst&&(!P.found||P.base===row.cot)]);
  if(!P.found)chk.push(['Ligne « Pension vieillesse » présente',false]);
  chk.push(['Cotisable ≤ brut',!(row.cot>row.brut*1.001)]);
  const w=panel('<h2 style="margin:0 0 4px">📄 Lecture facile du bulletin</h2><div class="muted" style="font-size:12px">'+esc(row.nom||'')+(row.cnps?' · CNPS '+esc(row.cnps):'')+(row.mi?' · matricule '+esc(row.mi):'')+'</div>'+
    '<div style="margin:8px 0"><span class="pill">Brut <b>'+fmt(row.brut)+'</b></span><span class="pill">Cotisable <b>'+fmt(row.cot)+'</b></span><span class="pill">Jours <b>'+(row.jours||'?')+'</b></span>'+(row.net?'<span class="pill">Net <b>'+fmt(row.net)+'</b></span>':'')+'</div>'+
    '<div>'+chk.map(c=>'<span class="pill '+(c[1]?'o':'w')+'">'+(c[1]?'✔':'✖')+' '+esc(c[0])+'</span>').join('')+'</div>'+
    '<div style="margin:8px 0"><button class="p" id="rs_ai">🤖 Expliquer ce bulletin en langage simple</button></div><div id="rs_box"></div>'+
    '<table>'+sec('🧾 Identification',groups.info)+sec(SECT[0][1],groups.gains)+sec(SECT[1][1],groups.ret)+sec(SECT[2][1],groups.pat)+sec('Σ Totaux',groups.tot)+sec('Autres lignes',groups.autre)+'</table>',820);
  w.querySelector('#rs_ai').onclick=async ev=>{const b=ev.currentTarget,box=w.querySelector('#rs_box');b.disabled=true;box.innerHTML='<div class="bx">⏳ …</div>';
    const prompt='Voici le texte brut d\'un bulletin de paie camerounais (Sage), nom et N° CNPS masqués. Explique-le simplement en français, en 6 à 10 lignes : 1) ce que gagne le salarié (brut), 2) ce qui est retenu (CNPS, impôts, autres) et pourquoi, 3) le net à payer, 4) la base CNPS retenue pour la DIPE. Signale tout point qui te paraît incohérent. N\'invente aucun chiffre : cite uniquement ceux du texte.\n\nTEXTE :\n'+maskTxt(txt,[row.nom]);
    const r=await ask([{role:'user',content:prompt}],700);b.disabled=false;
    box.innerHTML=r.err?'<div class="bx">🤖 IA indisponible ('+esc(r.err)+').</div>':'<div class="bx">🤖 '+rich(r.text)+'<div class="muted" style="font-size:11px;margin-top:6px">Explication indicative — le bulletin ci-dessous fait foi.</div></div>';};
};

/* ---------- 3. ANALYSE IA (anonymisée) ---------- */
X.aiAnalyse=async function(A){
  const code=new Map();A.rows.forEach((o,i)=>code.set(o,'L'+(i+1)));
  const lines=A.rows.filter(o=>o.F.some(x=>x.sev!=='info')).slice(0,40).map(o=>code.get(o)+' [fiabilité '+o.score+' %] '+o.F.filter(x=>x.sev!=='info').map(x=>x.msg.replace(/« [^»]*»/g,'«…»').replace(/\b\d{3}[ .\-]?\d{7}[ .\-\/]?\d\b/g,'[CNPS]')).join(' ; '));
  const prompt='Tu es un contrôleur de paie expert de la CNPS Cameroun. Voici le résultat d\'un recoupement automatique (bulletin / fiche employé / référentiel CNPS / dernier DIPE) AVANT génération de la DIPE. Les salariés sont anonymisés (L1, L2…).\n'+
    'Effectif contrôlé : '+A.rows.length+' ; en erreur : '+A.errN+' ; à vérifier : '+A.warnN+'.\n'+
    (A.glob.length?'Alertes globales : '+A.glob.map(g=>g.msg.replace(/: .*/, '')).join(' | ')+'\n':'')+'\nANOMALIES :\n'+(lines.join('\n')||'(aucune anomalie individuelle)')+
    '\n\nRéponds en français, court et actionnable : **Verdict** (peut-on générer la DIPE ?), **Priorités** (ordre de correction), **Causes probables** (regroupées), **Quoi vérifier concrètement**. Base-toi UNIQUEMENT sur ces données : n\'invente ni chiffre, ni règle légale, ni salarié.';
  return ask([{role:'user',content:prompt}],800);
};

/* ---------- 4. PORTE avant génération du DIPE ---------- */
X.gate=function(next){
  let A;try{A=X.analyze();}catch(er){console.error('triangulation',er);say('Triangulation indisponible : '+er.message);return next();}
  if(!A.rows.length)return next();
  if(A.verdict==='ok'){say('🔺 Triangulation OK — fiabilité '+A.score+' %');return next();}
  X.openTriangulation({gate:next});
};

/* ---------- 5. ASSISTANT CNPS ---------- */
const HELP='Je peux, avec VOS données (sans IA) : lister les N° CNPS manquants, les anomalies bloquantes, résumer la triangulation, expliquer la structure d\'une ligne DIPE, fouiller un salarié (« bulletin de … », « cnps de … ») et donner les totaux. Pour le reste, je consulte l\'IA (anonymisée).';
const hist=[];
function person(q,A){
  const n=nz(q);let best=null,bs=0;
  const cand=A.rows.map(o=>({o,name:o.nom})).concat(env().E.map(f=>({f,name:f.n})));
  cand.forEach(c=>{const t=toks(c.name);if(!t.length)return;const hit=t.filter(w=>w.length>2&&n.split(' ').includes(w)).length;
    const sc=hit>=2?hit+10:(hit===1&&t.length===1?5:hit===1?1:0);if(sc>bs){bs=sc;best=c;}});
  return bs>=2?best:null;}
async function answer(q){
  const n=nz(q),e=env();let A;try{A=X.analyze();}catch(er){A={rows:[],glob:[],errN:0,warnN:0,okN:0,score:0,tot:{brut:0,cot:0,sal:0},verdict:'ok',env:e};}
  const wantSlip=/bulletin|lire|lecture/.test(n);
  const p=person(q,A);
  if(p){
    const o=p.o||A.rows.find(x=>x.f&&p.f&&x.f.id===p.f.id),f=p.f||(o&&o.f);
    if(wantSlip&&o&&o.r._t){X.readSlip(o.r);return {t:'📄 J\'ouvre la lecture facile du bulletin de **'+o.nom+'**.'};}
    let t='👤 **'+(o?o.nom:f.n)+'**\n';
    if(f)t+='• Fiche : poste '+(f.p||'—')+', contrat '+(f.t||'—')+', N° CNPS '+(f.cnps||'**manquant**')+'\n';
    if(o){t+='• DIPE : brut '+fmt(o.r.brut)+', cotisable '+fmt(o.r.cot)+', jours '+(o.r.jours||'?')+', matricule '+(o.r.mi||'—')+'\n• Fiabilité '+o.score+' %\n';
      t+=o.F.length?o.F.map(x=>SEV[x.sev][0]+' '+x.msg).join('\n'):'✅ Aucune anomalie.';}
    else t+='• Pas de ligne DIPE pour ce salarié (bulletin non lu ou ligne exclue).';
    return {t};}
  if(/manqu|sans\s+(num|n[o°]|cnps)|invalide/.test(n)&&/cnps|numero|n°|num/.test(n)){
    const bad=e.E.filter(x=>digits(x.cnps).length!==11);
    return {t:bad.length?'❌ **'+bad.length+'** salarié(s) sans N° CNPS valide :\n'+bad.slice(0,30).map(x=>'• '+x.n+(x.cnps?' ('+x.cnps+')':'')).join('\n')+(bad.length>30?'\n… et '+(bad.length-30)+' autres':''):'✅ Tous les salariés des fiches ont un N° CNPS à 11 chiffres.'};}
  if(/anomal|bloqu|probleme|erreur|alerte|verifi|corrig/.test(n)){
    const bad=A.rows.filter(o=>o.err||o.warn).sort((a,b)=>a.score-b.score);
    return {t:bad.length?'🔺 **'+A.errN+'** erreur(s), **'+A.warnN+'** point(s) à vérifier :\n'+bad.slice(0,15).map(o=>'• '+o.nom+' ('+o.score+' %) — '+o.F.filter(x=>x.sev!=='info').map(x=>x.msg).join(' ; ')).join('\n')+(bad.length>15?'\n… et '+(bad.length-15)+' autres (ouvrez la triangulation).':''):'✅ Aucune anomalie : les sources concordent.',act:'tri'};}
  if(/resum|synthese|triangul|pret|pouvoir|generer|bilan/.test(n)){
    return {t:(A.verdict==='block'?'❌ Bloquant':A.verdict==='warn'?'⚠ À vérifier':'✅ Prêt')+' — '+A.rows.length+' salarié(s) contrôlé(s) : '+A.okN+' conformes, '+A.warnN+' à vérifier, '+A.errN+' en erreur. Fiabilité globale '+A.score+' %.'+(A.glob.length?'\n'+A.glob.map(g=>'• '+g.msg).join('\n'):''),act:'tri'};}
  if(/structure|format|colonne|ligne\s+dipe|fichier\s+dipe|dipe.*(comment|contient)/.test(n)){
    return {t:'📄 Une ligne DIPE (format fixe, une par salarié) contient dans l\'ordre : l\'en-tête employeur, le mois, le N° employeur, l\'année, le **N° CNPS (11 chiffres)**, les **jours** (2), le **brut** (10), les primes exceptionnelles (10), la **base cotisable ×3** (10 chacune), un n° d\'ordre (9) et le matricule (4).'};}
  if(/total|masse|combien|somme/.test(n)){
    return {t:A.rows.length&&e.mode==='dipe'?'Σ brut **'+fmt(A.tot.brut)+'** FCFA · Σ cotisable **'+fmt(A.tot.cot)+'** (sur '+A.rows.length+' salariés).':'Effectif des fiches : **'+e.E.length+'** salariés ; aucun bulletin chargé pour calculer des totaux.'};}
  if(/^(aide|help|que sais|quoi faire)/.test(n))return {t:HELP};
  /* IA (anonymisée) */
  const names=e.E.map(x=>x.n).concat(A.rows.map(o=>o.nom));
  const ctxTxt='Contexte (anonymisé) : effectif fiches '+e.E.length+' ; DIPE '+A.rows.length+' lignes ; '+A.errN+' en erreur, '+A.warnN+' à vérifier .';
  const msgs=hist.slice(-6).map(m=>({role:m.r==='me'?'user':'assistant',content:m.t}));
  const first='Tu es l\'assistant interne CNPS de la plateforme TERH (Cameroun) : cotisations CNPS, DIPE, bulletins de paie. Réponds en français, court, précis ; si tu n\'es pas sûr d\'une règle légale, dis-le et renvoie à la CNPS. N\'invente aucun chiffre. '+ctxTxt+'\n\nQuestion : '+maskTxt(q,names);
  const r=await ask(msgs.length?msgs.slice(0,-1).concat([{role:'user',content:first}]):[{role:'user',content:first}],600);
  return r.err?{t:'🤖 L\'IA est indisponible ('+r.err+').\n\n'+HELP}:{t:r.text,ai:true};}

X.openAssistant=function(envOverride){
  css();if(envOverride)X.alt=envOverride;
  const old=document.getElementById('cia_chat');if(old){old.remove();}
  const w=panel('<h2 style="margin:0 0 4px">💬 Assistant CNPS</h2><div class="muted" style="font-size:12px">Il répond d\'abord avec vos données (sans IA). Questions ouvertes : IA en ligne, noms et N° CNPS masqués.</div>'+
    '<div id="ca_q" style="margin:8px 0"></div><div id="ca_log" style="min-height:160px;max-height:50vh;overflow:auto"></div>'+
    '<div style="display:flex;gap:6px;margin-top:8px"><input id="ca_in" placeholder="Ex. : qui n\'a pas de N° CNPS ? · bulletin de DUPONT · quelles anomalies bloquent le DIPE ?" style="flex:1"><button class="p" id="ca_go">Envoyer</button></div>',700);
  w.parentNode.id='cia_chat';
  const log=w.querySelector('#ca_log'),inp=w.querySelector('#ca_in');
  const put=(r,t)=>{const d=document.createElement('div');d.className='msg '+(r==='me'?'me':'bot');d.innerHTML=rich(t);log.appendChild(d);log.scrollTop=log.scrollHeight;hist.push({r,t});return d;};
  put('bot','Bonjour 👋 Je suis l\'assistant CNPS. '+HELP);
  const QS=['Qui n\'a pas de N° CNPS ?','Quelles anomalies bloquent le DIPE ?','Résume la triangulation','Structure d\'une ligne DIPE','Totaux'];
  w.querySelector('#ca_q').innerHTML=QS.map(q=>'<span class="pill" style="cursor:pointer" data-q="'+esc(q)+'">'+esc(q)+'</span>').join('');
  const send=async q=>{q=String(q||'').trim();if(!q)return;inp.value='';put('me',q);const d=put('bot','⏳ …');hist.pop();
    let r;try{r=await answer(q);}catch(er){r={t:'Erreur : '+er.message};}
    d.innerHTML=rich(r.t)+(r.ai?'<div class="muted" style="font-size:11px">🤖 réponse IA — à vérifier</div>':'');hist.push({r:'bot',t:r.t});
    if(r.act==='tri'){const b=document.createElement('button');b.className='s';b.textContent='🔺 Ouvrir la triangulation';b.style.marginTop='4px';b.onclick=()=>X.openTriangulation();d.appendChild(document.createElement('br'));d.appendChild(b);}
    log.scrollTop=log.scrollHeight;};
  w.querySelector('#ca_go').onclick=()=>send(inp.value);inp.onkeydown=ev=>{if(ev.key==='Enter')send(inp.value);};
  w.querySelectorAll('[data-q]').forEach(s=>s.onclick=()=>send(s.dataset.q));inp.focus();
};
})();
