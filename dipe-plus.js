/* =====================================================================
 * TERH · dipe-plus.js — améliorations du module « DIPE depuis les bulletins »
 * Fichier d'appoint (comme sage-data.json) : à garder à côté de index.html.
 *
 *  ✔ Lecture du salaire COTISABLE recopié tel quel depuis Sage (aucun calcul ni estimation)
 *  ✔ Lecture du MATRICULE INTERNE (lié à la fiche employé)
 *  ✔ Colonnes : matricule interne, CNPS, période, jours, brut, cotisable, net
 *  ✔ Suppression en lot (sélection, vides, doublons, absents) + Annuler
 *  ✔ Compléter les manquants (fiches, matricules à générer, enregistrement)
 *  ✔ « Apprendre un libellé » : cliquez une ligne du bulletin → mémorisé
 *  ✔ N° CNPS : le RÉFÉRENTIEL CNPS fait foi dans le DIPE, automatiquement (avant la fiche, avant le bulletin)
 *  ✔ Étape ① : Total brut = 0 ET Pension vieillesse CNPS = 0 → exclusion PROPOSÉE, appliquée seulement après votre validation
 *  ✔ Étape ② : vérification IA (cnps-ia.js) : exactitude des infos, lecture améliorée, corrections vérifiées appliquées automatiquement (annulables)
 *  ✔ Exclure / réinclure des lignes (sans les supprimer), fusionner 2 lignes,
 *    ajouter les salariés des fiches absents du tableau, supprimer les lignes complètes
 *
 * Personnaliser les libellés reconnus : modifiez T.LABELS ci-dessous
 * (expressions régulières, sans tenir compte des majuscules).
 * ===================================================================== */
(function(){
'use strict';
const T=window.TERH_DIPE=window.TERH_DIPE||{};
T.version='2026.10.12';
T.custom=T.custom||{};
/* chargement à la demande de cnps-ia.js (triangulation, IA, assistant CNPS) */
T.ia=function(cb,fallback){
  const run=()=>{try{window.TERH_CNPSIA.attach(T.ctx);cb(window.TERH_CNPSIA);}catch(e){console.error('cnps-ia',e);try{(T.ctx&&T.ctx.say)&&T.ctx.say('Module IA CNPS : erreur '+e.message);}catch(x){}if(fallback)fallback();}};
  if(window.TERH_CNPSIA&&window.TERH_CNPSIA.analyze)return run();
  const sc=document.createElement('script');sc.src='cnps-ia.js?t='+Date.now();sc.onload=run;
  sc.onerror=()=>{console.warn('cnps-ia.js introuvable');try{(T.ctx&&T.ctx.say)&&T.ctx.say('cnps-ia.js introuvable : placez-le à côté de index.html (triangulation/IA désactivées)');}catch(x){}if(fallback)fallback();};
  document.head.appendChild(sc);};

/* ---------- libellés reconnus (modifiables) ---------- */
T.LABELS={
  mi:['matricule\\s+interne','n[°o]?\\s*matricule','\\bmatricule\\b','\\bmatr?\\.(?=\\s*[:\\-]?\\s*[A-Za-z0-9])','\\bmle\\b','n[°o]\\s*(?:interne|employ[ée]|salari[ée]|agent|personnel)','code\\s+(?:salari[ée]|employ[ée]|agent)'],
  /* « pension vieillesse cnps » cible directement la ligne de la base de calcul (vérifiée : montant ≈ base × taux) */
  cot:['pension\\s+vieillesse\\s+cnps','salaire\\s+cotisable','assiette\\s+(?:cnps|de\\s+cotisation\\w*|cotisable|plafonn\\w+)','base\\s+(?:cnps|cotisable|plafonn\\w+|de\\s+cotisation\\w*)','brut\\s+(?:cotisable|plafonn\\w+)','salaire\\s+plafonn\\w+','\\bbasecot\\b','total\\s+cotisable','cotisable'],
  brut:['total\\s+brut','brut\\s+total','salaire\\s+brut(?!\\s+(?:jour|journalier|horaire|heure))','gains?\\s+bruts?','total\\s+(?:des\\s+)?gains','total\\s+r[ée]mun[ée]ration','brut\\s+imposable','\\bbrut\\b'],
  net:['net\\s+[àa]\\s+payer','net\\s+pay[ée]'],
  jours:['nombre\\s+de\\s+jours','nb\\.?\\s*(?:de\\s*)?jours','jours?\\s+(?:travaill\\w+|pay\\w+|pr[ée]sence|de\\s+travail)'],
  exc:['(?:prime|salaire|indemnit[ée]|gratification)\\s+exceptionnel\\w*']
};

/* ---------- outils ---------- */
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nz=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const digits=s=>String(s||'').replace(/\D/g,'');
const pNum=v=>{if(v==null)return 0;let s=String(v).replace(/[\s\u00a0\u202f]/g,'');s=s.replace(/,\d{1,2}$/,'').replace(/\.\d{1,2}$/,m=>m.length===4?m:'');s=s.replace(/[.,]/g,'');return parseInt(s,10)||0;};
const normMi=s=>{s=String(s||'').toUpperCase().replace(/[\s\-\/.]/g,'');return /^\d+$/.test(s)?(s.replace(/^0+/,'')||'0'):s;};
const sameMi=(a,b)=>{const na=normMi(a),nb=normMi(b);if(!na||!nb)return false;if(na===nb)return true;
  const da=((na.match(/\d+$/)||[''])[0]).replace(/^0+/,''),db=((nb.match(/\d+$/)||[''])[0]).replace(/^0+/,'');
  return !!da&&da===db&&(/^\d+$/.test(na)||/^\d+$/.test(nb));};
const custRe=t=>new RegExp(String(t).replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+'),'i');
const normLines=t=>String(t||'').replace(/[\u00a0\u202f]/g,' ').split(/\n+/).map(l=>l.replace(/[ \t]+/g,' ').trim()).filter(Boolean);
const say=m=>{try{(T.ctx&&T.ctx.say)?T.ctx.say(m):(window.toast&&toast(m));}catch(e){}};

/* garde-fous : un libellé « matricule » ne peut pas être une rubrique de montant, et inversement */
T.badLabel=(k,l)=>{l=String(l||'');
  /* un libellé appris ne contient ni chiffre (montant d'un bulletin précis), ni trait, et doit avoir de vraies lettres */
  if(/\d/.test(l)||/[_\-=.]{3,}/.test(l)||!/[A-Za-zÀ-ÿ]{3}/.test(l))return true;
  if(k==='cot'&&/\b(?:total|brut|net|gains?)\b/i.test(l)&&!/cotis|pension|vieillesse|assiette|base|plafon/i.test(l))return true;
  if(k==='mi')return /total|brut|net\b|cotis|pension|salaire|montant|base|gain|retenue|cnps|assiette|imposable/i.test(l);
  if(k==='brut'||k==='cot'||k==='net'||k==='jours'||k==='exc')return /matricule|\bmle\b|n[°o]\s*(?:interne|employ|salari|agent)/i.test(l);
  return false;};
T.cleanCustom=()=>{let ch=false;Object.keys(T.custom||{}).forEach(k=>{if(!Array.isArray(T.custom[k]))return;const n=T.custom[k].filter(l=>!T.badLabel(k,l));if(n.length!==T.custom[k].length){T.custom[k]=n;ch=true;}});return ch;};
/* matricule égal au brut / cotisable / net du même bulletin = lecture erronée */
T.miIsAmount=(mi,r)=>{const d=digits(mi);if(!d)return false;return [r.brut,r.cot,r.net,r.exc].some(v=>v&&String(Math.round(v))===d.replace(/^0+/,''));};
T.fixBadMi=R=>{let n=0;(R||[]).forEach(r=>{if(r.mi&&T.miIsAmount(r.mi,r)){r.mi='';r.mat='';r.miAuto=false;r.miGen=false;n++;}});return n;};

T.nums=l=>nums(l);
/* N° CNPS : le RÉFÉRENTIEL CNPS est la SEULE source (référentiel > rien). Le N° lu sur le bulletin ou la fiche n'est PAS retenu :
   il peut appartenir à un autre salarié. Mettre T.strictRef=false pour tolérer un N° hors référentiel (conservé mais signalé). */
T.strictRef=true;
const _stop=new Set(['de','du','la','le','des','et','ep','epse','nee']);
const tkz=s=>[...new Set(nz(s).split(' ').filter(w=>w.length>1&&!_stop.has(w)))];
const lev1=(a,b)=>{if(a===b)return true;if(Math.abs(a.length-b.length)>1)return false;let i=0;while(i<a.length&&i<b.length&&a[i]===b[i])i++;
  if(a.length===b.length)return a.slice(i+1)===b.slice(i+1)||(a[i]===b[i+1]&&a[i+1]===b[i]&&a.slice(i+2)===b.slice(i+2));
  return a.length>b.length?a.slice(i+1)===b.slice(i):b.slice(i+1)===a.slice(i);};
const tokEq=(a,b,fz)=>a===b||(fz&&a.length>=5&&b.length>=5&&lev1(a,b));
function nameScore2(A,B,fz){if(!A.length||!B.length)return 0;const used=new Set();let c=0;
  A.forEach(a=>{const j=B.findIndex((b,ix)=>!used.has(ix)&&tokEq(a,b,fz));if(j>-1){used.add(j);c++;}});if(!c)return 0;
  const mn=Math.min(A.length,B.length),mx=Math.max(A.length,B.length);
  if(c===A.length&&c===B.length)return 100;if(c>=2&&c===mn)return 80+c;if(c>=2&&c/mx>=.66)return 60+c;return 0;}
const cleanN=s=>{let w=String(s||'').replace(/\s+/g,' ').trim().split(' ').filter(Boolean);
  if(w.length>=2&&w.length%2===0){const h=w.length/2;if(w.slice(0,h).map(nz).join(' ')===w.slice(h).map(nz).join(' '))w=w.slice(0,h);}return w.join(' ');};
/* cherche la personne dans le référentiel PAR SON NOM (exact d'abord, puis orthographe approchante) */
T.refFind=function(names,cur){
  const C=window.TERH_CNPSREF,list=(C&&C.S&&C.S.list)||[];
  const A=(names||[]).filter(Boolean).map(tkz).filter(a=>a.length);
  if(!A.length)return {o:null,amb:false,near:[]};
  for(const fz of [false,true]){
    let best=[],bs=0;
    list.forEach(o=>{const B=tkz(o.n);let sc=0;A.forEach(a=>{sc=Math.max(sc,nameScore2(a,B,fz));});if(!sc)return;
      if(sc>bs){bs=sc;best=[o];}else if(sc===bs)best.push(o);});
    if(!best.length)continue;
    const u=[...new Map(best.map(o=>[o.c,o])).values()];
    if(u.length===1)return {o:u[0],amb:false,fuzzy:fz};
    const same=u.find(o=>o.c===cur);if(same)return {o:same,amb:false,fuzzy:fz};
    return {o:null,amb:true,cands:u};}
  const near=list.filter(o=>{const B=tkz(o.n);return A.some(a=>a.some(x=>x.length>=4&&B.some(y=>tokEq(x,y,true))));}).slice(0,3);
  return {o:null,amb:false,near};};
T.refSyncRows=function(R,E,MAT){
  const C=window.TERH_CNPSREF;if(!C||!C.S||!C.S.list||!C.S.list.length)return 0;
  E=E||[];MAT=MAT||{};let n=0;
  const dropW=(r,re)=>{if(r.warn)r.warn=r.warn.split(' · ').filter(x=>!re.test(x)).join(' · ');};
  const addW=(r,t)=>{r.warn=String(r.warn||'').includes(t)?r.warn:(r.warn?r.warn+' · ':'')+t;};
  (R||[]).forEach(r=>{
    if(r.cnpsManual)return;                                   /* saisi à la main : respecté */
    const before=digits(r.cnps);
    const f=(r.eid?E.find(y=>String(y.id)===String(r.eid)):null)||(r.mi?E.find(y=>MAT[y.id]&&sameMi(MAT[y.id],r.mi)):null);
    const m=T.refFind([r.nom,r.nomBul,f&&f.n],before);
    dropW(r,/appartient à|plusieurs personnes|introuvable dans le référentiel|homonymes|nom approchant|remplacé par celui du référentiel|N° CNPS lu/);
    if(m.o){                                                  /* la personne est dans le référentiel : SON numéro, point */
      if(before!==m.o.c){r.cnpsWas=before;r.cnps=m.o.c;n++;
        if(before){const ow=C.S.byC&&C.S.byC.get(before);
          addW(r,'N° CNPS lu ('+before+(ow&&ow.c!==m.o.c?', appartenant à « '+cleanN(ow.n)+' »':'')+') remplacé par celui du référentiel');}}
      if(m.fuzzy)addW(r,'nom approchant du référentiel : « '+cleanN(m.o.n)+' » — vérifiez');
      r.cnpsAuto=false;r.cnpsRef=true;r.cnpsSrc='ref';r.cnpsNoRef=false;return;}
    /* personne introuvable (ou homonymes) dans le référentiel */
    const ow=before.length===11&&C.S.byC?C.S.byC.get(before):null;
    const owned=!!ow;                                         /* ce N° appartient à quelqu'un d'autre dans le référentiel */
    if(m.amb){addW(r,'plusieurs personnes du référentiel portent ce nom : '+m.cands.slice(0,3).map(o=>cleanN(o.n)+' → '+o.c).join(' / ')+' : saisissez le bon N°');}
    else{addW(r,'introuvable dans le référentiel CNPS — N° CNPS à fournir (voir « Imprimer le rapport »)'+(before?' (N° '+before+(owned?' appartenant à « '+cleanN(ow.n)+' »':'')+' ignoré)':'')+
      (m.near&&m.near.length?' · proches : '+m.near.map(o=>cleanN(o.n)+' → '+o.c).join(' / '):''));}
    if(T.strictRef||owned||m.amb){
      if(before){r.cnpsWas=before;r.cnpsWasOwned=owned;n++;}
      r.cnps='';r.cnpsRef=false;r.cnpsAuto=false;r.cnpsNoRef=true;r.cnpsSrc=m.amb?'ambigu':'absent';
    }else{r.cnpsRef=false;r.cnpsSrc=digits(r.cnps).length===11?'hors':'';}
  });
  return n;};
/* Total brut = 0 ET Pension vieillesse CNPS (cotisable) = 0 : pas de paie à déclarer */
T.isZero=r=>!(+r.brut>0)&&!(+r.cot>0);
/* montants d'une ligne : ignore dates, taux (%) et années */
function nums(line){
  const out=[],re=/(\d{1,3}(?:[ \u00a0\u202f.]\d{3}(?!\d))+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/g;let m;
  const hasDate=/(janv|f[ée]v|mars|avr|mai|juin|juil|ao[uû]|sept|oct|nov|d[ée]c|p[ée]riode|mois|ann[ée]e|date)/i.test(line);
  while((m=re.exec(line))){
    const s=m.index,e=s+m[0].length,prev=line[s-1]||'',next=line.slice(e);
    if(/[\/\-]/.test(prev)&&/\d/.test(line[s-2]||''))continue;
    if(/^\s*%/.test(next)||/^\/\d/.test(next))continue;
    if(hasDate&&/^(19|20)\d{2}$/.test(m[0]))continue;
    const v=pNum(m[0]);if(v>0)out.push({v,raw:m[0],i:s});
  }
  return out;
}
function findAmt(lines,res,mode,minV){
  for(const re of res){
    for(let i=0;i<lines.length;i++){
      const m=re.exec(lines[i]);if(!m)continue;
      let n=nums(lines[i].slice(m.index+m[0].length)),k=0;
      while(!n.length&&k<2&&lines[i+1+k]){const nx=lines[i+1+k];if((nx.match(/[A-Za-zÀ-ÿ]/g)||[]).length>6)break;n=nums(nx);k++;}
      if(minV)n=n.filter(x=>x.v>=minV);
      if(n.length)return {v:mode==='first'?n[0].v:Math.max(...n.map(x=>x.v)),label:m[0].trim(),line:i};
    }
  }
  return null;
}
/* base de la retenue CNPS : on cherche (base, montant) avec montant ≈ base × taux */
function baseFromRetenue(lines,PC){
  const rate=(+PC.cnps_sal||4.2)/100;
  for(const L of lines){
    if(!/(pension|vieillesse|pvid|cnps)/i.test(L))continue;
    const n=nums(L).map(x=>x.v);
    for(const b of n){if(b<5000)continue;for(const a of n){if(a!==b&&Math.abs(b*rate-a)<=1.5)return b;}}
  }
  return 0;
}
/* matricule interne */
function miOk(t){t=String(t||'').trim();if(t.length<2||t.length>16||!/\d/.test(t))return false;
  if(digits(t).length===11&&/^[\d\s.\-]+$/.test(t))return false;
  if(/^\d{1,2}[\/\-]\d{2,4}$/.test(t))return false;return true;}  /* un matricule de 4 chiffres (ex. 1967) n'est PAS une année */
function miToken(s){const m=/^[\s:.\-–=]*([A-Za-z]{0,6}[-\/]?\d{1,12}[A-Za-z]?|[A-Za-z0-9][A-Za-z0-9\-\/]{2,14})/.exec(s);if(!m)return '';const t=m[1].trim();return miOk(t)?t:'';}
function findMi(lines,custom,cnpsDigits){
  const res=(custom||[]).map(custRe).concat(T.LABELS.mi.map(s=>new RegExp(s,'i')));
  for(const re of res){
    for(let i=0;i<lines.length;i++){
      const L=lines[i],m=re.exec(L);if(!m)continue;
      const after=L.slice(m.index+m[0].length);
      if(/^\s*(?:n[°o]?\s*)?(?:cnps|c\.n\.p\.s|s[ée]curit|immatric|ss\b)/i.test(after))continue;
      let tok=miToken(after);
      if(!tok&&lines[i+1]){
        const hw=L.split(/\s+/),vw=lines[i+1].split(/\s+/),idx=hw.findIndex(w=>/matricule|matr|mle/i.test(w));
        tok=(idx>=0&&hw.length===vw.length&&miOk(vw[idx]))?vw[idx]:miToken(lines[i+1]);
      }
      if(tok&&digits(tok)!==cnpsDigits)return {v:tok,label:m[0].trim()};
    }
  }
  return null;
}

/* ---------- jours EXACTS : lus sur le bulletin, sinon déduits des heures / absences (jamais « 30 pour tous ») ---------- */
const fl=s=>{const m=/\d+(?:[.,]\d+)?/.exec(s);return m?parseFloat(m[0].replace(',','.')):0;};
T.deriveDays=function(lines,R,hmois,r){
  const out={mode:'def',jours:30,label:'aucune info jours/heures sur le bulletin → 30 par défaut'};
  const after=(re)=>{for(let i=0;i<lines.length;i++){const m=re.exec(lines[i]);if(!m)continue;
    let v=fl(lines[i].slice(m.index+m[0].length));if(!v&&lines[i+1]&&(lines[i+1].match(/[A-Za-zÀ-ÿ]/g)||[]).length<=6)v=fl(lines[i+1]);
    if(v>0)return {v,label:m[0].trim()};}return null;};
  /* 0. lignes Sage « Salaire de Base mensuel » (colonne Nombre = HEURES) et « Salaire brut Jour » (colonne Nombre = JOURS) ;
        « Horaire » de l'en-tête = heures du mois (ex. 173.330). Une seule des deux lignes est en général remplie ; si les deux le sont, on additionne. */
  const colNombre=re=>{for(let i=0;i<lines.length;i++){const m=re.exec(lines[i]);if(!m)continue;
    let seg=lines[i].slice(m.index+m[0].length),v=seg.match(/\d+(?:[.,]\d+)?/);
    if(!v&&lines[i+1]&&(lines[i+1].match(/[A-Za-zÀ-ÿ]/g)||[]).length<=6)v=lines[i+1].match(/\d+(?:[.,]\d+)?/);
    if(v)return {v:parseFloat(v[0].replace(',','.')),label:m[0].trim()};}return null;};
  const sH=colNombre(/salaire\s+de\s+base\s+mensuel/i),sJ=colNombre(/salaire\s+brut\s+jour(?:nalier)?/i);
  if(sH||sJ){
    let hs=0;{for(let i=0;i<lines.length&&!hs;i++){if(!/\bhoraire\b/i.test(lines[i])||/taux\s+horaire|salaire\s+horaire/i.test(lines[i]))continue;
      for(let k=0;k<=2&&lines[i+k];k++){const f=(lines[i+k].match(/\d+(?:[.,]\d+)?/g)||[]).map(x=>parseFloat(x.replace(',','.'))).find(x=>x>=100&&x<=260);if(f){hs=f;break;}}}}
    const hm0=hs||+hmois||173.33,dj=sJ&&sJ.v>0?sJ.v:0,hh=sH&&sH.v>0?sH.v:0;
    if(dj||hh){
      const dH=hh?(hh>=hm0*.995?30:30*hh/hm0):0,tot=Math.max(1,Math.min(30,Math.round(dj+dH)));
      out.mode=dj&&!hh?'lu':'ded';out.jours=tot;
      out.label=(dj?'Salaire brut Jour : '+dj+' j':'')+(dj&&hh?' + ':'')+(hh?'Salaire de Base mensuel : '+hh+' h ÷ '+hm0+' h × 30 = '+(Math.round(dH*10)/10)+' j':'');
      return out;}
  }
  /* 1. nombre de jours écrit sur le bulletin */
  const j=findAmt(lines,R('jours'),'first',0);
  /* 2. déduction par les heures : jours = 30 × heures travaillées ÷ heures du mois */
  const H=after(/heures?\s+(?:normales?\s+)?(?:travaill[a-zà-ÿ]*|pay[a-zà-ÿ]*|effectu[a-zà-ÿ]*|r[ée]alis[a-zà-ÿ]*|de\s+travail)(?!\s+sup)|nombre\s+d.?\s*heures(?!\s+sup)|heures\s+normales(?!\s+sup)/i);
  const ref=after(/heures?\s+(?:contractuelles?|mensuelles?|du\s+mois|th[ée]oriques?|l[ée]gales?)/i);
  const hm=(ref&&ref.v>=100&&ref.v<=260)?ref.v:(+hmois||173.33);
  let dh=0;if(H&&H.v>0&&H.v<=hm*1.5){dh=H.v>=hm*.995?30:Math.max(1,Math.min(30,Math.round(30*H.v/hm)));}
  /* 3. déduction par les absences non payées : jours = 30 − absences */
  let da=0,ab=null;
  for(const L of lines){if(!/absence|sans\s+solde|non\s+pay[ée]/i.test(L)||/pay[ée]e?s?\b(?!.*non)/i.test(L)&&!/non\s+pay|sans\s+solde/i.test(L))continue;
    const m=/(?:absences?|sans\s+solde|non\s+pay[a-zà-ÿ]*)[^\d]{0,40}(\d{1,2}(?:[.,]\d+)?)/i.exec(L);if(m){const v=parseFloat(m[1].replace(',','.'));if(v>0&&v<=30){ab={v,label:L.slice(0,40)};break;}}}
  if(ab)da=Math.max(1,30-Math.round(ab.v));
  if(j&&j.v>=1&&j.v<=31){out.mode='lu';out.jours=Math.min(30,j.v);out.label=j.label;
    if(dh&&Math.abs(dh-out.jours)>1)out.alt='jours lus ('+out.jours+') ≠ jours déduits des heures ('+dh+' = 30 × '+H.v+' h ÷ '+hm+' h)';}
  else if(dh){out.mode='ded';out.jours=dh;out.label=dh===30?'heures du mois complètes ('+H.v+' h)':'déduit : 30 × '+H.v+' h ÷ '+hm+' h = '+dh+' j';}
  else if(da){out.mode='ded';out.jours=da;out.label='déduit : 30 − '+ab.v+' j d\'absence = '+da+' j';}
  return out;};

/* ---------- 1. lecture enrichie d'un bulletin (appelée par l'index) ---------- */
T.enrich=function(r,text,fn){
  const ctx=T.ctx||{},PC=Object.assign({plafond:750000,cnps_sal:4.2},ctx.PC||{}),E=ctx.E||(typeof E!=='undefined'?E:[]),MAT=ctx.MAT||{};
  const lines=normLines(text),C=T.custom||{},src=r.src={};
  const R=k=>(C[k]||[]).map(custRe).concat((T.LABELS[k]||[]).map(s=>new RegExp(s,'i')));
  /* nom : ligne « M NOM PRENOMS » (sans deux-points) */
  if(!r.nomBul){for(const L of lines){const m=/^(?:M\.?|MME|MLLE|MR|MONSIEUR|MADAME)\s+([A-ZÀ-Ý][A-ZÀ-Ý'’\-]{2,}(?:\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’\-]*){0,5})$/.exec(L);if(m){r.nomBul=m[1].trim();if(!r.nom||(!r.eid&&fn&&r.nom===String(fn).slice(0,60)))r.nom=r.nomBul;break;}}}
  /* N° CNPS : JAMAIS lu sur le bulletin. Seul le NOM est lu ; le N° vient du référentiel CNPS (voir T.refSyncRows / fixRow). */
  r.cnps='';r.cnpsBul=false;
  const b=findAmt(lines,R('brut'),'max',1000);if(b){r.brut=b.v;src.brut=b.label;}
  /* cotisable : jamais supérieur au brut, jamais le simple « plafond » */
  let c=findAmt(lines,R('cot'),'max',1000);
  /* ligne « pension vieillesse » : on recopie UNIQUEMENT le 1er montant (la base), et seulement si la ligne en porte au moins 2 (base + retenue) ; un seul montant = la retenue, pas la base */
  if(c&&/pension|vieillesse/i.test(c.label)){const L0=lines[c.line],mm=new RegExp(c.label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+'),'i').exec(L0);let n0=mm?nums(L0.slice(mm.index+mm[0].length)):[];
    for(let k=1;n0.length<2&&k<=2&&lines[c.line+k];k++){const nx=lines[c.line+k];if((nx.match(/[A-Za-zÀ-ÿ]/g)||[]).length>6)break;n0=n0.concat(nums(nx));}
    if(n0.length<2)c=null;else c.v=n0[0].v;}  /* 1er montant après le libellé = colonne Base */
  /* « Total Brut » : montant souvent 1 à 3 lignes sous le libellé (après un trait) → recherche explicite */
  const tb=(()=>{const i=lines.findIndex(l=>/total\s+brut/i.test(l));if(i<0)return 0;let best=0;
    for(let k=i;k<Math.min(lines.length,i+5);k++){if(k>i&&/pension|vieillesse|accident|prestations|total\s+cotis/i.test(lines[k]))break;
      const seg=k===i?lines[k].replace(/^.*total\s+brut/i,''):lines[k];nums(seg).forEach(x=>{if(x.v>=1000&&x.v>best)best=x.v;});}
    return best;})();
  if(tb){r.brut=tb;src.brut='Total Brut';}
  if(c&&r.brut&&c.v>r.brut*1.001){
    if(tb)c=null;
    else r.warn=(r.warn?r.warn+' · ':'')+'brut lu ('+r.brut+') < cotisable : vérifiez le brut (🔎)';}
  /* garde-fou : cotisable lu == brut alors que la ligne « Pension vieillesse » donne une autre base (ex. libellé appris faux) */
  if(c&&r.brut&&c.v===r.brut){const pb=baseFromRetenue(lines,PC);
    if(pb&&pb!==c.v){c={v:pb,label:'Pension vieillesse CNPS (base)',line:c.line};r.warn=(r.warn?r.warn+' · ':'')+'cotisable = brut : corrigé avec la base de la ligne Pension vieillesse ('+pb+') — vérifiez vos libellés appris';}
    else if(!pb)r.warn=(r.warn?r.warn+' · ':'')+'cotisable identique au brut, base Pension vieillesse non lue : vérifiez le bulletin';}
  if(c){r.cot=c.v;r.cotEst=false;src.cot=c.label;}
  else{r.cot=0;r.cotEst=false;src.cot='non trouvé sur le bulletin';}  /* aucune estimation : case vide et rouge */
  const n=findAmt(lines,R('net'),'max',1000);if(n){r.net=n.v;src.net=n.label;}
  {const d=T.deriveDays(lines,R,PC.hmois,r);r.jours=d.jours;r.jMode=d.mode;src.jours=d.label;
    if(d.alt)r.warn=(r.warn?r.warn+' · ':'')+d.alt;}
  const x=findAmt(lines,R('exc'),'max',1000);if(x){r.exc=x.v;src.exc=x.label;}
  const po=/(?:emploi|poste|fonction|qualification)\s*[:\-]\s*([A-Za-zÀ-ÿ' \/\-]{3,40})/i.exec(lines.join('\n'));if(po)r.poste=po[1].split(/\s{2,}|\s+(?:matricule|cnps|date|cat)/i)[0].trim();
  /* matricule interne + rattachement à la fiche employé */
  let mv=findMi(lines,C.mi,digits(r.cnps));
  if(mv&&T.miIsAmount(mv.v,r))mv=findMi(lines,[],digits(r.cnps));   /* le libellé appris donnait un montant : on revient aux libellés standard */
  if(mv&&T.miIsAmount(mv.v,r))mv=null;
  if(!mv){const i=lines.findIndex(l=>/\bmatricule\b/i.test(l));
    if(i>=0)for(let k=1;k<=2&&lines[i+k];k++){const m=/^\s*(\d{3,8})(?!\d)/.exec(lines[i+k]);if(m&&miOk(m[1])&&m[1]!==digits(r.cnps)){mv={v:m[1],label:'Matricule (ligne suivante)'};break;}}}
  if(mv){r.mi=mv.v;src.mi=mv.label;}
  let e=r.eid?E.find(y=>String(y.id)===String(r.eid)):null;
  if(r.mi){const byMi=E.find(y=>MAT[y.id]&&sameMi(MAT[y.id],r.mi));
    if(byMi){
      if(e&&e.id!==byMi.id){
        /* le NOM du bulletin fait foi : on garde la fiche trouvée par le nom, et le matricule du bulletin est retenu */
        r.warn='matricule du bulletin ('+r.mi+') ≠ fiche « '+(e.n||r.nom)+' » ('+(MAT[e.id]||'—')+') : nom confirmé, matricule du bulletin retenu';
        r.miFromSlip=true;
      }else{e=byMi;r.eid=byMi.id;r.nom=byMi.n;}
    }}
  if(!e&&r.cnps&&digits(r.cnps).length===11)e=E.find(y=>digits(y.cnps)===digits(r.cnps));
  /* N° CNPS erroné sur le bulletin : on prend celui de la fiche (le référentiel CNPS, appliqué ensuite, a le dernier mot) */
  if(e&&digits(e.cnps).length===11&&digits(r.cnps)!==digits(e.cnps)){
    const was=digits(r.cnps);if(was)r.cnpsWas=was;r.cnps=digits(e.cnps);r.cnpsAuto=true;
    if(was)r.warn=(r.warn?r.warn+' · ':'')+'N° CNPS du bulletin ('+was+') ≠ fiche : N° de la fiche utilisé';}
  if(e){if(!r.eid){r.eid=e.id;r.nom=e.n;}
    if(!r.mi&&MAT[e.id]){r.mi=MAT[e.id];r.miAuto=true;src.mi='fiche employé';}
    else if(r.mi&&MAT[e.id]&&!sameMi(MAT[e.id],r.mi))r.warn=(r.warn?r.warn+' · ':'')+'matricule du bulletin ≠ fiche ('+MAT[e.id]+')';}
  if(r.mi&&!r.mat)r.mat=String(r.mi).slice(-4);
  return r;
};
T.find=function(R,r){if(!r.mi)return -1;return R.findIndex(y=>y.mi&&sameMi(y.mi,r.mi));};
/* rapprochement bulletin → ligne du tableau : CNPS (si le nom ne le contredit pas) → fiche → matricule → NOM (même approximatif) */
T.findRow=function(R,r){
  const tk=s=>[...new Set(nz(s).split(' ').filter(w=>w.length>1))];
  const sc=(a,b)=>{if(!a.length||!b.length)return 0;const c=a.filter(w=>b.includes(w)).length;if(!c)return 0;
    const mn=Math.min(a.length,b.length),mx=Math.max(a.length,b.length);
    if(c===a.length&&c===b.length)return 100;if(c>=2&&c===mn)return 80+c;if(c>=2&&c/mx>=.66)return 60+c;return 0;};
  const names=[r.nom,r.nomBul].filter(Boolean).map(tk).filter(a=>a.length);
  const ns=x=>x.nom?Math.max(0,...names.map(n=>sc(n,tk(x.nom)))):0;
  let j=-1;
  if(digits(r.cnps).length===11)j=R.findIndex(x=>digits(x.cnps)===digits(r.cnps)&&(!names.length||!x.nom||ns(x)>0));
  if(j<0&&r.eid)j=R.findIndex(x=>x.eid&&String(x.eid)===String(r.eid));
  if(j<0)j=T.find(R,r);
  if(j<0&&names.length){let best=-1,bs=0,amb=false;
    R.forEach((x,i)=>{const v=ns(x);if(v>bs){bs=v;best=i;amb=false;}else if(v&&v===bs)amb=true;});
    if(best>-1&&bs>=60&&!amb)j=best;}
  return j;
};
T.merge=function(o,r){
  ['mi','net','poste','src','cotEst','warn','miAuto','per','jMode'].forEach(k=>{if(r[k]!==undefined&&r[k]!=='')o[k]=r[k];});
  if(r.mat)o.mat=r.mat;
  if(r.cot&&!r.cotEst)o.cot=r.cot;
};

/* ---------- 2. interface (appelée à l'ouverture du module DIPE) ---------- */
T.mount=function(ctx){
  T.ctx=ctx;const R=ctx.R,el=ctx.el,g=ctx.g,E=ctx.E,MAT=ctx.MAT;
  if(el.querySelector('#dpx_bar'))return;
  /* instantané du dernier DIPE (avant lecture des bulletins) : sert à la triangulation */
  T.prev={};R.forEach(r=>{if(!r.mem)return;const c=digits(r.cnps);const o={nom:r.nom,cnps:c,mi:r.mi||'',brut:r.brut||0,cot:r.cot||0,jours:r.jours||0};if(c.length===11)T.prev[c]=o;if(r.mi)T.prev['m'+normMi(r.mi)]=o;});
  /* libellés mémorisés pour cette entreprise */
  Promise.resolve(ctx.rd('dipe_labels')).then(v=>{if(v&&typeof v==='object')T.custom=v;if(T.cleanCustom()){Promise.resolve(ctx.wr('dipe_labels',T.custom)).catch(()=>{});say('🧹 Libellé(s) appris incohérent(s) supprimé(s) (ex. un libellé de montant utilisé pour le matricule)');}}).catch(()=>{});
  const css=document.createElement('style');css.textContent=
   '#dpx_bar .chip{display:inline-block;padding:2px 8px;border-radius:999px;border:1px solid var(--bd,#bbb);font-size:11px;margin:2px 3px 2px 0;cursor:pointer;background:var(--card,#fff);color:inherit}'+
   '#dpx_bar .chip.on{background:var(--pr,#1f5fbf);color:#fff;border-color:transparent}'+
   '#dpx_bar button,#dpx_bar select,#dpx_bar input{font-size:12px}'+
   '#d_t table.d3 th{position:sticky;top:0;background:var(--card,#fff);z-index:1;font-size:11px;padding:4px}'+
   '#d_t table.d3 td{padding:2px 3px;vertical-align:middle}'+
   '#d_t table.d3 input.dx{font-size:12px;padding:3px}'+
   '#d_t table.d3 input.dx.bad{outline:2px solid #d33;background:rgba(220,50,50,.12)}'+
   '#d_t table.d3 input.dx.est{outline:2px solid #e69500;background:rgba(230,150,0,.12)}'+
   '#d_t table.d3 tr.sel{background:rgba(31,95,191,.10)}#d_t table.d3 tr.old td{opacity:.6}#d_t table.d3 tr.exc td{opacity:.45}'+
   '#d_t .st{font-size:11px;white-space:nowrap}';
  el.appendChild(css);
  const bar=document.createElement('div');bar.id='dpx_bar';bar.style.cssText='margin:6px 0';
  bar.innerHTML=
   '<div id="dpx_chips"></div>'+
   '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:4px 0">'+
    '<input id="dpx_q" placeholder="🔍 Nom, CNPS, matricule…" style="min-width:180px">'+
    '<button class="s" id="dpx_all">☑ Tout (filtre)</button><button class="s" id="dpx_none">☐ Aucun</button>'+
    '<button class="s" id="dpx_delsel">🗑 Supprimer la sélection</button>'+
    '<select id="dpx_del"><option value="">🗑 Supprimer…</option><option value="empty">les lignes vides (sans CNPS ni brut)</option><option value="nobrut">les lignes sans bulletin (brut 0)</option><option value="abs">les anciens absents des bulletins</option><option value="dup">les doublons (même CNPS ou matricule)</option><option value="bad">toutes les lignes à corriger (incomplètes)</option><option value="ok">les lignes complètes (bonnes)</option><option value="excl">les lignes exclues</option><option value="new">les nouveaux (hors ancien modèle)</option><option value="nomi">les lignes sans matricule interne</option><option value="nocnps">les lignes sans CNPS valide</option></select>'+
    '<button class="s" id="dpx_undo" disabled>↩ Annuler</button>'+
   '</div>'+
   '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:4px 0">'+
    '<button class="p" id="dpx_comp">🧩 Compléter les manquants</button>'+
    '<button class="s" id="dpx_gen">🔢 Générer les matricules manquants</button>'+
    '<button class="s" id="dpx_save">💾 Enregistrer dans les fiches</button>'+
    '<button class="s" id="dpx_re">↻ Relire avec les libellés appris</button>'+
    '<button class="s" id="dpx_lab">🏷 Mes libellés</button>'+
    '<button class="p" id="dpx_tri" title="Recoupe bulletin / fiche / référentiel CNPS / dernier DIPE">🔺 Triangulation</button>'+
    '<button class="s" id="dpx_ia">🤖 Assistant CNPS</button>'+
   '</div>'+
   '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:4px 0">'+
    '<button class="s" id="dpx_exc">🚫 Exclure la sélection</button><button class="s" id="dpx_inc">✔ Réinclure la sélection</button><button class="s" id="dpx_excabs">🚫 Exclure les absents des bulletins</button><button class="s" id="dpx_rep">📋 Rapport de lecture</button><button class="p" id="dpx_valabs">✅ Valider les absents des bulletins…</button>'+
    '<button class="s" id="dpx_addemp">➕ Ajouter les salariés des fiches absents du tableau</button><button class="s" id="dpx_merge">🔗 Fusionner 2 lignes cochées</button>'+
   '</div>'+
   '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:4px 0;padding:6px 8px;border:1px dashed var(--bd,#bbb);border-radius:8px"><b style="font-size:12px">Étapes automatiques :</b>'+
    '<button class="p" id="dpx_zero" title="Total brut = 0 et Pension vieillesse CNPS = 0 : proposer l\'exclusion (avec validation)">① Exclusions à valider (brut = 0 et pension = 0)</button>'+
    '<button class="p" id="dpx_s2" title="L\'IA vérifie l\'exactitude des infos et améliore la lecture">② 🧠 Vérification IA</button>'+
    '<button class="s" id="dpx_refsync" title="Remplace les N° CNPS par ceux du référentiel">📚 Appliquer le référentiel CNPS</button>'+
    '<button class="s" id="dpx_refback" title="Reprendre le N° du bulletin/fiche pour les personnes introuvables dans le référentiel (sauf N° appartenant à quelqu\'un d\'autre)">↩ Reprendre les N° des absents du référentiel</button>'+
   '</div><div id="dpx_info" class="muted" style="font-size:12px"></div><div id="dpx_s2_info" style="font-size:12px"></div>';
  g('d_t').before(bar);
  const $=id=>el.querySelector('#'+id);
  let filter='all',limit=150,sel=new Set(),undo=[];
  const miss=(r,i)=>ctx.getMiss()(r,i);
  const incl=(r,i)=>ctx.incl?ctx.incl(r,i):!(r.excl||(r.old&&!r.seen));
  const isDup=(()=>{let c={};return {build(){c={};R.forEach(r=>{[digits(r.cnps).length===11?'c'+digits(r.cnps):'',r.mi?'m'+normMi(r.mi):''].forEach(k=>{if(k)c[k]=(c[k]||0)+1;});});},
    has(r){return (digits(r.cnps).length===11&&c['c'+digits(r.cnps)]>1)||(r.mi&&c['m'+normMi(r.mi)]>1);}};})();
  const cats={
    all:r=>true,
    bad:(r,i)=>miss(r,i).length>0,
    ok:(r,i)=>miss(r,i).length===0,
    excl:(r,i)=>!incl(r,i),
    new:r=>!r.old,
    abs:r=>r.old&&!r.seen,
    dup:r=>isDup.has(r),
    est:r=>r.cotEst&&r.brut>0,
    jconf:r=>r.jMode==='def',
    nomi:r=>!r.mi,
    nocnps:r=>digits(r.cnps).length!==11
  };
  const CHIPS=[['all','Tous'],['bad','À corriger'],['ok','Complets'],['excl','Exclus'],['new','Nouveaux'],['abs','Absents des bulletins'],['dup','Doublons'],['est','Cotisable estimé'],['jconf','Jours à confirmer (30 par défaut)'],['nomi','Sans matricule interne'],['nocnps','Sans CNPS valide']];
  const cols=[['nom','Nom',150],['mi','Matricule interne',100],['cnps','N° CNPS',112],['jours','Jours',40],['brut','Brut',84],['exc','Except.',64],['cot','Cotisable',84],['mat','Matr. DIPE',54]];
  const status=(r,i)=>{const m=miss(r,i),b=[];
    b.push(r.old&&!r.seen?((r.keep&&!r.excl)?'✅ absent du bulletin · validé':'⚪ absent'):r.old?'🔄 mis à jour':'🆕 nouveau');
    if(!incl(r,i))b.push('🚫 exclu du DIPE');
    if(r.cnpsAuto)b.push('CNPS fiche');if(r.cnpsRef)b.push('📚 CNPS référentiel'+(r.cnpsWas?' (bulletin : '+esc(r.cnpsWas)+')':''));if(r.miAuto)b.push('matr. fiche');if(r.miGen)b.push('matr. généré');
    if(r.cnpsSrc==='hors'&&digits(r.cnps).length===11)b.push('⚠ N° CNPS hors référentiel (non confirmé)');
    if(r.cnpsSrc==='absent')b.push('⚠ personne introuvable dans le référentiel : N° vide');
    if(r.cnpsSrc==='ambigu')b.push('⚠ homonymes dans le référentiel : N° vide');
    if(r.auto&&Object.keys(r.auto).length)b.push('🧠 corrigé automatiquement : '+esc(Object.keys(r.auto).join(', ')));
    if(!incl(r,i)&&r.exclWhy)b.push('('+esc(r.exclWhy)+')');
    if(r.cotEst&&r.brut>0)b.push('⚠ cotisable estimé');
    if(r.jMode==='ded')b.push('🕒 jours déduits ('+esc((r.src&&r.src.jours)||'')+')');
    if(r.jMode==='def')b.push('⚠ jours : 30 par défaut (rien sur le bulletin)');
    if(isDup.has(r))b.push('⚠ doublon');
    if(r.warn)b.push('⚠ '+esc(r.warn));
    if(m.length)b.push('⚠ '+[...new Set(m)].join(', '));else b.push('✅');
    return b.join(' · ');};
  const cls=(r,i,k,m)=>{if(k==='cot'&&r.cotEst&&r.brut>0)return 'dx est';if(m.includes(k))return 'dx bad';return 'dx'+(r[k]?' ok':'');};
  function counts(){isDup.build();const o={};Object.keys(cats).forEach(k=>o[k]=0);R.forEach((r,i)=>{Object.keys(cats).forEach(k=>{if(cats[k](r,i))o[k]++;});});return o;}
  function visible(){const q=nz($('dpx_q').value),qd=digits($('dpx_q').value);
    return R.map((r,i)=>[r,i]).filter(([r,i])=>cats[filter](r,i)&&(!g('d_flt').checked||miss(r,i).length>0)&&(!q||nz(r.nom).includes(q)||(qd&&digits(r.cnps).includes(qd))||nz(r.mi).includes(q)));}
  function chips(){const c=counts();$('dpx_chips').innerHTML=CHIPS.map(([k,l])=>'<span class="chip'+(filter===k?' on':'')+'" data-f="'+k+'">'+l+' ('+c[k]+')</span>').join('');
    $('dpx_chips').querySelectorAll('.chip').forEach(x=>x.onclick=()=>{filter=x.dataset.f;limit=150;render();});
    $('dpx_undo').disabled=!undo.length;}
  function render(){
    const box=g('d_t'),top=box.scrollTop;chips();
    if(!R.length){box.innerHTML='<p class="muted">Aucune ligne. Chargez des bulletins puis « Lire les bulletins ».</p>';return;}
    const V=visible(),shown=V.slice(0,limit);
    box.innerHTML='<table class="d3" style="border-collapse:collapse;width:100%"><tr><th><input type="checkbox" id="dpx_ck"></th><th>#</th><th title="Inclure dans le DIPE">Incl.</th>'+cols.map(c=>'<th style="text-align:left">'+c[1]+'</th>').join('')+'<th>Net</th><th>Période</th><th>État</th><th></th></tr>'+
    shown.map(([r,i])=>{const m=miss(r,i);
      return '<tr data-r="'+i+'" class="'+(sel.has(r)?'sel ':'')+(r.old&&!r.seen?'old':'')+(incl(r,i)?'':' exc')+'"><td><input type="checkbox" data-s="'+i+'"'+(sel.has(r)?' checked':'')+'></td><td>'+(i+1)+'</td><td><input type="checkbox" data-x="'+i+'"'+(incl(r,i)?' checked':'')+' title="Décochez pour exclure du DIPE sans supprimer"></td>'+
      cols.map(c=>'<td><input class="'+cls(r,i,c[0],m)+'" data-i="'+i+'" data-k="'+c[0]+'" value="'+esc(r[c[0]]==null?'':r[c[0]])+'" style="width:'+c[2]+'px"'+(r.src&&r.src[c[0]]?' title="Lu sur : '+esc(r.src[c[0]])+'"':'')+'></td>').join('')+
      '<td style="font-size:11px;text-align:right">'+(r.net?Math.round(r.net).toLocaleString('fr-FR'):'')+'</td><td style="font-size:11px">'+esc(r.per||'')+'</td>'+
      '<td class="st">'+status(r,i)+'</td><td style="white-space:nowrap"><button data-t="'+i+'" title="Texte lu / apprendre un libellé">🔎</button><button data-del="'+i+'" title="Supprimer cette ligne">✕</button></td></tr>';}).join('')+'</table>'+
    '<p class="muted" style="font-size:12px">'+V.length+' ligne(s) affichée(s) sur '+R.length+(V.length>shown.length?' · <a href="#" id="dpx_more">afficher '+Math.min(150,V.length-shown.length)+' de plus</a>':'')+' · '+sel.size+' sélectionnée(s) · <b>'+R.filter((r,i)=>incl(r,i)&&!miss(r,i).length).length+'</b> prête(s) pour le DIPE · '+R.filter((r,i)=>!incl(r,i)).length+' exclue(s) · '+R.filter((r,i)=>incl(r,i)&&miss(r,i).length).length+' à corriger. Rouge = à corriger · orange = cotisable estimé (non lu). Survolez une case lue pour voir le libellé trouvé.</p>';
    box.scrollTop=top;
    const more=box.querySelector('#dpx_more');if(more)more.onclick=ev=>{ev.preventDefault();limit+=150;render();};
    box.querySelector('#dpx_ck').onclick=ev=>{shown.forEach(([r])=>ev.target.checked?sel.add(r):sel.delete(r));render();};
    box.querySelectorAll('[data-s]').forEach(x=>x.onchange=()=>{const r=R[+x.dataset.s];x.checked?sel.add(r):sel.delete(r);x.closest('tr').classList.toggle('sel',x.checked);chips();});
    box.querySelectorAll('[data-x]').forEach(x=>x.onchange=()=>{const r=R[+x.dataset.x];if(x.checked){r.excl=false;r.keep=true;r.zeroKeep=true;r.exclWhy='';}else{r.excl=true;r.keep=false;r.exclWhy='exclu par vous';}render();});
    box.querySelectorAll('input.dx').forEach(x=>x.onchange=()=>edit(x));
    box.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>removeRows([R[+b.dataset.del]]));
    box.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>openText(+b.dataset.t));
  }
  function edit(x){
    const i=+x.dataset.i,k=x.dataset.k,r=R[i],num=['jours','brut','cot','exc'].includes(k);
    r[k]=num?pNum(x.value):(k==='cnps'?x.value.replace(/\D/g,''):x.value.trim());
    r.ed=r.ed||{};r.ed[k]=1;
    if(k==='mi'){r.miAuto=false;r.miGen=false;if(r.mi)r.mat=String(r.mi).slice(-4);const e=E.find(y=>MAT[y.id]&&sameMi(MAT[y.id],r.mi));if(e&&!r.eid){r.eid=e.id;if(!r.nom)r.nom=e.n;}}
    if(k==='cot')r.cotEst=false;
    if(k==='cnps'){r.cnpsAuto=false;r.cnpsRef=false;r.cnpsManual=digits(r.cnps).length>0;}
    /* mise à jour de la ligne seulement : le focus reste dans le tableau */
    const tr=x.closest('tr'),m=miss(r,i);isDup.build();
    tr.querySelectorAll('input.dx').forEach(inp=>{const kk=inp.dataset.k;if(document.activeElement!==inp&&String(r[kk]==null?'':r[kk])!==inp.value)inp.value=r[kk]==null?'':r[kk];inp.className=cls(r,i,kk,m);});
    tr.querySelector('.st').innerHTML=status(r,i);chips();
  }
  function removeRows(rows){
    rows=rows.filter(r=>R.includes(r));if(!rows.length){say('Rien à supprimer');return;}
    if(rows.length>1&&!confirm('Supprimer '+rows.length+' ligne(s) ? (vous pourrez annuler)'))return;
    undo.push(rows.map(r=>({r,i:R.indexOf(r)})).sort((a,b)=>a.i-b.i));
    rows.forEach(r=>{const j=R.indexOf(r);if(j>-1)R.splice(j,1);sel.delete(r);});
    render();try{ctx.showAbs();}catch(e){}say('🗑 '+rows.length+' ligne(s) supprimée(s) — « Annuler » pour les remettre');
  }
  $('dpx_undo').onclick=()=>{const last=undo.pop();if(!last)return;last.forEach(({r,i})=>R.splice(Math.min(i,R.length),0,r));render();try{ctx.showAbs();}catch(e){}say('↩ '+last.length+' ligne(s) remise(s)');};
  $('dpx_all').onclick=()=>{visible().forEach(([r])=>sel.add(r));render();};
  $('dpx_none').onclick=()=>{sel.clear();render();};
  $('dpx_delsel').onclick=()=>removeRows([...sel]);
  $('dpx_q').oninput=()=>{limit=150;render();};
  $('dpx_del').onchange=ev=>{
    const v=ev.target.value;ev.target.value='';if(!v)return;isDup.build();let rows=[];
    if(v==='empty')rows=R.filter(r=>digits(r.cnps).length!==11&&!(r.brut>0));
    if(v==='nobrut')rows=R.filter(r=>!(r.brut>0));
    if(v==='abs')rows=R.filter(r=>r.old&&!r.seen);
    if(v==='bad')rows=R.filter((r,i)=>miss(r,i).length>0);
    if(['ok','excl','new','nomi','nocnps'].includes(v)){rows=R.filter((r,i)=>cats[v](r,i));if(v==='ok'&&rows.length&&!confirm('⚠ Supprimer les '+rows.length+' ligne(s) COMPLÈTES (bonnes) ? Seules les lignes à corriger resteront. (Vous pourrez annuler.)'))return;}
    if(v==='dup'){const seen=new Map();R.forEach(r=>{[digits(r.cnps).length===11?'c'+digits(r.cnps):'',r.mi?'m'+normMi(r.mi):''].forEach(k=>{if(!k)return;const a=seen.get(k);if(!a)seen.set(k,r);else{const keep=(r.brut>0&&!(a.brut>0))?r:a,drop=keep===r?a:r;if(!rows.includes(drop))rows.push(drop);seen.set(k,keep);}});});}
    removeRows(rows);};

  /* --- exclure / réinclure (sans supprimer) --- */
  const setExcl=(rows,on)=>{rows.forEach(r=>{if(on){r.excl=true;r.keep=false;r.exclWhy='exclu par vous';}else{r.excl=false;r.keep=true;r.zeroKeep=true;r.exclWhy='';}});render();};
  $('dpx_exc').onclick=()=>{if(!sel.size){say('Cochez d\'abord des lignes (case à gauche)');return;}const n=sel.size;setExcl([...sel],true);say('🚫 '+n+' ligne(s) exclue(s) du DIPE (toujours dans le tableau)');};
  $('dpx_inc').onclick=()=>{if(!sel.size){say('Cochez d\'abord des lignes (case à gauche)');return;}const n=sel.size;setExcl([...sel],false);say('✔ '+n+' ligne(s) réincluse(s)');};
  $('dpx_excabs').onclick=()=>{const a=R.filter(r=>r.old&&!r.seen);if(!a.length){say('Aucun ancien salarié absent des bulletins');return;}setExcl(a,true);say('🚫 '+a.length+' ancien(s) salarié(s) absent(s) des bulletins exclu(s)');};

  $('dpx_rep').onclick=()=>T.report(false);
  /* --- valider les anciens salariés absents des bulletins --- */
  $('dpx_valabs').onclick=()=>{
    const A=R.filter(r=>r.old&&!r.seen);
    if(!A.length){say('Aucun ancien salarié absent des bulletins');return;}
    const w=ctx.openWin('<h3 style="margin:0 0 6px">✅ Valider les absents des bulletins ('+A.length+')</h3><p class="muted" style="font-size:12px;margin:0 0 8px">Ces salariés sont dans l\'ancien DIPE mais aucun bulletin n\'a été trouvé. <b>Cochez ceux à garder</b> dans le DIPE (ils conservent leurs valeurs de l\'ancien DIPE, modifiables ensuite). Les non cochés seront exclus (sans être supprimés).</p><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px"><button class="s" id="va_all">☑ Tout cocher</button><button class="s" id="va_none">☐ Tout décocher</button><button class="p" id="va_ok">✅ Appliquer (cochés = validés, autres = exclus)</button><button class="s" id="va_only">✔ Valider seulement les cochés (ne pas toucher aux autres)</button><button class="s" id="va_close">Fermer</button></div><div style="max-height:62vh;overflow:auto"><table id="va_t" style="border-collapse:collapse;width:100%;font-size:12px"></table></div>');
    const t=w.querySelector('#va_t');
    t.innerHTML='<tr><th></th><th style="text-align:left">Nom</th><th style="text-align:left">Matricule</th><th style="text-align:left">N° CNPS</th><th style="text-align:right">Brut</th><th style="text-align:right">Cotisable</th><th style="text-align:left">État</th></tr>'+
      A.map((r,k)=>'<tr style="border-top:1px solid rgba(128,128,128,.25)"><td><input type="checkbox" data-a="'+k+'"'+((r.keep&&!r.excl)?' checked':'')+'></td><td>'+esc(r.nom||'(nom inconnu)')+'</td><td>'+esc(r.mi||r.mat||'')+'</td><td>'+esc(r.cnps||'')+'</td><td style="text-align:right">'+(r.brut||0).toLocaleString('fr-FR')+'</td><td style="text-align:right">'+(r.cot||0).toLocaleString('fr-FR')+'</td><td>'+((r.keep&&!r.excl)?'✅ validé':(r.excl?'🚫 exclu':'⚪ à décider'))+'</td></tr>').join('');
    const cks=()=>[...t.querySelectorAll('[data-a]')];
    w.querySelector('#va_all').onclick=()=>cks().forEach(c=>c.checked=true);
    w.querySelector('#va_none').onclick=()=>cks().forEach(c=>c.checked=false);
    w.querySelector('#va_close').onclick=()=>w.remove();
    const apply=ex=>{let v=0,x=0;
      cks().forEach(c=>{const r=A[+c.dataset.a];
        if(c.checked){r.keep=true;r.excl=false;v++;}
        else if(ex){r.excl=true;r.keep=false;x++;}});
      w.remove();render();try{ctx.showAbs();}catch(e){}
      say('✅ '+v+' absent(s) validé(s) dans le DIPE'+(x?' · 🚫 '+x+' exclu(s)':'')+' — vérifiez leur cotisable (case rouge si 0)');};
    w.querySelector('#va_ok').onclick=()=>apply(true);
    w.querySelector('#va_only').onclick=()=>apply(false);
  };

  /* --- IA : relecture des bulletins signalés, SANS rien appliquer sans votre validation --- */
  const maskTxt=(txt,row)=>{let t=String(txt||'');
    t=t.replace(/^(?:M\.?|MME|MLLE|MR|MONSIEUR|MADAME)\s+[A-ZÀ-Ý][A-ZÀ-Ý'’\-]{2,}(?:\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’\-]*){0,5}$/gm,'M [NOM MASQUÉ]');
    t=t.replace(/(?<!\d)\d{3}[ .\-]?\d{7}\s*[\/\-]?\s*\d(?!\d)/g,'[CNPS MASQUÉ]');
    String((row&&row.nom)||'').split(/\s+/).filter(w=>w.length>=3).forEach(w=>{t=t.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),'***');});
    return t;};
  async function aiRead(a){
    const sl=a.x.slip,row=a.x.row,txt=sl._t||row._t||'';
    if(!txt)return {err:'pas de texte lu pour ce bulletin'};
    if(typeof window.TERH_callAI!=='function')return {err:'service IA non disponible dans cette page'};
    const prompt='Tu lis le texte brut (extrait d\'un PDF) d\'un bulletin de paie camerounais (Sage). Réponds UNIQUEMENT par un objet JSON, sans texte autour : {"matricule":"","brut":0,"base_pension_vieillesse_cnps":0,"jours":0}.\n'+
      '- matricule : la valeur sous l\'en-tête « Matricule » (pas le N° de Sécurité Sociale).\n- brut : le montant de « Total Brut » (entier, sans séparateur).\n'+
      '- base_pension_vieillesse_cnps : le PREMIER montant (colonne Base) de la ligne « Pension vieillesse CNPS » ; null si cette ligne n\'existe pas.\n- jours : nombre de jours payés si indiqué, sinon null.\n'+
      'N\'invente RIEN : si tu n\'es pas sûr, mets null. Recopie les montants tels qu\'écrits (146990.000 → 146990).\n\nTEXTE DU BULLETIN :\n'+maskTxt(txt,row);
    let r;try{r=await window.TERH_callAI({raw:true,messages:[{role:'user',content:prompt}],max_tokens:300},30000);}catch(e){return {err:e.message||String(e)};}
    const data=r&&r.data,error=r&&r.error;
    if(error||!data||!data.text)return {err:(error&&error.message)||'pas de réponse de l\'IA'};
    let j=null;try{j=JSON.parse((/\{[\s\S]*\}/.exec(data.text)||[''])[0]);}catch(e){}
    if(!j)return {err:'réponse illisible'};
    const num=v=>{if(v==null||v==='')return 0;const n=typeof v==='number'?v:parseFloat(String(v).replace(/[\s\u00a0\u202f]/g,'').replace(',','.'));return n>0?Math.round(n):0;};
    const flat=String(txt).replace(/[\s\u00a0\u202f.,]/g,'');
    const okN=v=>v>0&&flat.includes(String(v));
    const mi=j.matricule?String(j.matricule).trim():'';
    const okM=!!mi&&new RegExp('(?<!\\d)'+mi.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?!\\d)').test(txt)&&digits(mi).length!==11;
    const prop={mi,brut:num(j.brut),cot:num(j.base_pension_vieillesse_cnps),jours:num(j.jours)};
    /* garde-fou anti-invention : une valeur de l'IA n'est « vérifiée » que si elle figure réellement dans le texte du bulletin */
    const ver={mi:okM,brut:okN(prop.brut),cot:okN(prop.cot)&&(!prop.brut||prop.cot<=prop.brut*1.001),jours:prop.jours>=1&&prop.jours<=31};
    return {prop,ver};}
  function aiPropose(items){ /* items : [{a,res}] */
    const F=[['mi','Matricule'],['brut','Brut'],['cot','Cotisable (Pension vieillesse)']],rows=[];
    items.forEach(({a,res})=>{if(!res||!res.prop)return;F.forEach(([k,lab])=>{const cur=k==='mi'?(a.x.slip.mi||''):(a.x.slip[k]||0),nw=res.prop[k];
      if(nw&&String(nw)!==String(cur))rows.push({a,k,lab,cur,nw,ok:res.ver[k]});});});
    if(!rows.length){say('🤖 L\'IA n\'a trouvé aucune valeur différente de la lecture actuelle');return;}
    const f=v=>typeof v==='number'?v.toLocaleString('fr-FR'):esc(v);
    const w=ctx.openWin('<h3 style="margin:0 0 6px">🤖 Propositions de l\'IA — à valider</h3><p class="muted" style="font-size:12px;margin:0 0 8px">Rien n\'est appliqué sans votre accord. ✔ = la valeur figure bien dans le texte du bulletin (cochée par défaut). ✖ = introuvable dans le texte : probablement inventée, décochée.</p><div style="display:flex;gap:8px;margin-bottom:8px"><button class="p" id="ai_ok">✅ Appliquer les valeurs cochées</button><button class="s" id="ai_no">Annuler</button></div><div style="max-height:60vh;overflow:auto"><table id="ai_t" style="border-collapse:collapse;width:100%;font-size:12px"></table></div>');
    w.querySelector('#ai_t').innerHTML='<tr><th></th><th style="text-align:left">Nom</th><th style="text-align:left">Champ</th><th style="text-align:right">Lu actuellement</th><th style="text-align:right">Proposé par l\'IA</th><th>Vérifié</th></tr>'+
      rows.map((o,i)=>'<tr style="border-top:1px solid rgba(128,128,128,.25)"><td><input type="checkbox" data-p="'+i+'"'+(o.ok?' checked':'')+'></td><td>'+esc(o.a.x.row.nom||o.a.x.slip.nomBul||'')+'</td><td>'+o.lab+'</td><td style="text-align:right">'+(o.cur?f(o.cur):'—')+'</td><td style="text-align:right"><b>'+f(o.nw)+'</b></td><td style="text-align:center">'+(o.ok?'✔':'✖')+'</td></tr>').join('');
    w.querySelector('#ai_no').onclick=()=>w.remove();
    w.querySelector('#ai_ok').onclick=()=>{let n=0;
      w.querySelectorAll('[data-p]').forEach(c=>{if(!c.checked)return;const o=rows[+c.dataset.p],row=o.a.x.row,sl=o.a.x.slip;
        row.src=row.src||{};
        if(o.k==='mi'){row.mi=o.nw;row.mat=String(o.nw).slice(-4);row.miAuto=false;sl.mi=o.nw;row.src.mi='IA (validé par vous)';}
        else{row[o.k]=o.nw;sl[o.k]=o.nw;if(o.k==='cot')row.cotEst=false;row.src[o.k]='IA (validé par vous)';}
        n++;});
      w.remove();render();say('🤖 '+n+' valeur(s) de l\'IA appliquée(s) après validation');};}
  T.aiPropose=aiPropose;T.aiRead=aiRead;

  /* --- rapport de lecture : ce qui a été lu sur chaque bulletin et où ça a été placé --- */
  T.report=function(auto){
    const log=(window.__slipLog||[]).filter(x=>x&&x.row);
    if(!log.length){if(!auto)say('Aucun bulletin lu : lancez d\'abord « Lire les bulletins »');return;}
    const refOk=!!(window.TERH_CNPSREF&&TERH_CNPSREF.S&&TERH_CNPSREF.S.list&&TERH_CNPSREF.S.list.length);
    const an=log.map(x=>{const r=x.row,sl=x.slip,p=[];
      if(!x.matched)p.push('🆕 non rattaché à une ligne existante (nouvelle ligne)');
      if(!(sl.cot>0))p.push('❌ pas de « Pension vieillesse CNPS » → cotisable 0 → exclu du DIPE');
      if(!(sl.brut>0))p.push('❌ brut non lu');
      if(!sl.mi)p.push('⚠ matricule non lu sur le bulletin');
      if(digits(r.cnps).length!==11)p.push(refOk?'❌ N° CNPS introuvable dans le référentiel CNPS — à fournir / compléter':'❌ référentiel CNPS non chargé : N° CNPS non renseigné');
      if(r.warn)p.push('⚠ '+r.warn);
      return {x,p,bad:p.some(t=>/^(❌|🆕)/.test(t))||p.length>0};});
    const nb=an.filter(a=>a.p.length).length;
    if(auto&&!nb)return;
    const w=ctx.openWin('<h3 style="margin:0 0 6px">📋 Rapport de lecture des bulletins ('+log.length+')</h3><p class="muted" style="font-size:12px;margin:0 0 8px"><b>'+nb+'</b> bulletin(s) avec remarque. Pour chacun : ce qui a été lu sur le bulletin (matricule, brut, Pension vieillesse CNPS = cotisable) et la ligne du tableau où c\'est placé. 🔎 ouvre le texte lu pour apprendre un libellé.</p><div style="display:flex;gap:10px;align-items:center;margin-bottom:8px"><label><input type="checkbox" id="rp_only" checked> Remarques seulement</label><button class="p" id="rp_ai">🤖 Relire les bulletins signalés avec l\'IA</button><button class="p" id="rp_print">🖨 Imprimer le rapport</button><button class="s" id="rp_close">Fermer</button></div><div style="max-height:64vh;overflow:auto"><table id="rp_t" style="border-collapse:collapse;width:100%;font-size:12px"></table></div>');
    const t=w.querySelector('#rp_t');
    const draw=()=>{const only=w.querySelector('#rp_only').checked;
      t.innerHTML='<tr><th style="text-align:left">Nom (ligne)</th><th>Matr. bulletin</th><th>CNPS retenu</th><th style="text-align:right">Brut lu</th><th style="text-align:right">Cotisable lu</th><th style="text-align:left">Remarques</th><th></th></tr>'+
      an.map((a,k)=>{if(only&&!a.p.length)return '';const r=a.x.row,sl=a.x.slip;
        return '<tr style="border-top:1px solid rgba(128,128,128,.25)"><td>'+esc(r.nom||sl.nomBul||'(nom inconnu)')+'</td><td>'+esc(sl.mi||'—')+'</td><td>'+esc(r.cnps||'')+'</td><td style="text-align:right">'+(sl.brut||0).toLocaleString('fr-FR')+'</td><td style="text-align:right">'+(sl.cot||0).toLocaleString('fr-FR')+'</td><td>'+(a.p.length?a.p.map(esc).join('<br>'):'✅')+'</td><td style="white-space:nowrap"><button data-k="'+k+'">🔎</button><button data-ai="'+k+'" title="Relire ce bulletin avec l\'IA">🤖</button></td></tr>';}).join('');
      t.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>{const r=an[+b.dataset.k].x.row,i=R.indexOf(r);if(i>-1)openText(i);else say('Ligne introuvable');});};
    const runAI=async list=>{
      if(!list.length){say('Aucun bulletin à relire');return;}
      if(!confirm('Envoyer le texte de '+list.length+' bulletin(s) au service IA en ligne ? (nom et N° CNPS masqués ; rien ne sera appliqué sans votre validation)'))return;
      const out=[],bt=w.querySelector('#rp_ai'),old=bt.textContent;let err=0;
      for(let i=0;i<list.length;i++){bt.textContent='🤖 '+(i+1)+'/'+list.length+'…';bt.disabled=true;
        const res=await aiRead(list[i]);if(res.err){err++;console.warn('IA',res.err);}out.push({a:list[i],res});}
      bt.textContent=old;bt.disabled=false;
      if(err===list.length){say('🤖 IA indisponible ou sans réponse ('+((out[0]&&out[0].res.err)||'?')+')');return;}
      aiPropose(out);};
    w.querySelector('#rp_ai').onclick=()=>runAI(an.filter(a=>a.p.some(t=>/^(❌|⚠ matricule non lu)/.test(t))).slice(0,25));
    t.addEventListener('click',ev=>{const b=ev.target.closest('[data-ai]');if(b)runAI([an[+b.dataset.ai]]);});
    w.querySelector('#rp_only').onchange=draw;w.querySelector('#rp_close').onclick=()=>w.remove();
    w.querySelector('#rp_print').onclick=()=>{
      const only=w.querySelector('#rp_only').checked,fm=v=>(v||0).toLocaleString('fr-FR');
      const rows=an.filter(a=>!only||a.p.length),noRef=an.filter(a=>digits(a.x.row.cnps).length!==11);
      const per=(typeof ctx.g==='function'&&ctx.g('d_mo'))?(ctx.g('d_mo').value||''):'';
      const tr=a=>{const r=a.x.row,sl=a.x.slip;return '<tr><td>'+esc(r.nom||sl.nomBul||'(nom inconnu)')+'</td><td>'+esc(sl.mi||'—')+'</td><td>'+esc(r.cnps||'—')+'</td><td style="text-align:right">'+fm(sl.brut)+'</td><td style="text-align:right">'+fm(sl.cot)+'</td><td>'+(a.p.length?a.p.map(esc).join('<br>'):'OK')+'</td></tr>';};
      const th='<tr><th>Nom (lu sur le bulletin)</th><th>Matricule</th><th>N° CNPS</th><th>Brut</th><th>Cotisable</th><th>Remarques</th></tr>';
      const body='<h2>Rapport de lecture des bulletins de paie'+(per?' — '+esc(per):'')+'</h2><p>'+log.length+' bulletin(s) lu(s) · '+an.filter(a=>a.p.length).length+' avec remarque · <b>'+noRef.length+' sans N° CNPS (introuvable dans le référentiel)</b>. Le N° CNPS n\'est jamais lu sur le bulletin : il est cherché dans le référentiel CNPS à partir du nom.</p>'+
        (noRef.length?'<h3>Salariés sans N° CNPS — à traiter</h3><table>'+th+noRef.map(tr).join('')+'</table>':'')+
        '<h3>'+(only?'Bulletins avec remarque':'Tous les bulletins')+'</h3><table>'+th+rows.map(tr).join('')+'</table>';
      if(typeof window.printHTML==='function'){try{window.printHTML('Rapport de lecture des bulletins',body);return;}catch(e){}}
      const pw=window.open('','_blank');if(!pw){say('Autorisez les fenêtres pop-up pour imprimer');return;}
      pw.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Rapport de lecture</title><style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial,sans-serif;font-size:12px}table{border-collapse:collapse;width:100%;margin-bottom:12px}th,td{border:1px solid #999;padding:3px 5px;text-align:left;vertical-align:top}th{background:#eee}</style></head><body>'+body+'</body></html>');pw.document.close();setTimeout(()=>{try{pw.focus();pw.print();}catch(e){}},300);};
    draw();};
  /* --- triangulation AUTOMATIQUE à la fin de la lecture des bulletins --- */
  T.refresh=()=>render();
  T.focus=i=>{filter='all';render();const tr=el.querySelector('tr[data-r="'+i+'"]');if(!tr)return false;tr.scrollIntoView({block:'center'});const inp=tr.querySelector('input.dx[data-k="brut"]');if(inp)inp.focus();tr.style.outline='2px solid #1f5fbf';setTimeout(()=>{tr.style.outline='';},3000);return true;};
  T.banner=()=>T.ia(x=>{
    if(T.fixBadMi(R))render();
    const A=x.analyze();let info=$('dpx_tri_info');if(!info){info=document.createElement('div');info.id='dpx_tri_info';info.style.fontSize='12px';$('dpx_info').after(info);}if(!A.rows.length)return;
    const jd=A.rows.filter(o=>o.r.jMode==='def').length,col=A.verdict==='block'?'#d33':A.verdict==='warn'?'#e69500':'#2a9d55';
    info.innerHTML='<div style="border-left:4px solid '+col+';padding:6px 10px;margin:6px 0"><b>🔺 Triangulation automatique : '+(A.verdict==='block'?'❌ bloquant':A.verdict==='warn'?'⚠ à vérifier':'✅ prêt')+'</b> — '+A.rows.length+' salarié(s) : '+A.okN+' conformes, '+A.warnN+' à vérifier, '+A.errN+' en erreur · fiabilité '+A.score+' %'+(jd?' · '+jd+' sans info de jours (30 par défaut)':'')+' <button class="s" id="dpx_tri2">Voir le détail</button></div>';
    const b=info.querySelector('#dpx_tri2');if(b)b.onclick=()=>x.openTriangulation();});
  /* après « Lire les bulletins » : N° CNPS du référentiel → ① exclusions à valider → ② vérification IA → triangulation */
  T.afterRead=()=>{try{T.refSync(true);}catch(e){console.warn(e);}render();
    T.askZero(()=>T.ia(x=>{
      if(x.step2)Promise.resolve(x.step2({ask:true})).catch(e=>console.warn('étape 2',e)).then(()=>T.banner());
      else T.banner();},()=>{}));};
  /* --- validation obligatoire avant de générer le DIPE --- */
  const dlb=g('d_dl');
  const reason={cnps:'N° CNPS absent (introuvable dans le référentiel) ou invalide',brut:'brut manquant',jours:'jours invalides',cot:'pas de Pension vieillesse CNPS (cotisable 0)'};
  function recap(){
    const inc=[],exc=[];
    R.forEach((r,i)=>{if(!incl(r,i))return;const m=[...new Set(miss(r,i))];(m.length?exc:inc).push({r,i,m});});
    if(!inc.length){say('Aucune ligne valide à générer : corrigez les cases rouges');return;}
    const f=n=>(n||0).toLocaleString('fr-FR');
    const w=ctx.openWin('<h3 style="margin:0 0 6px">✅ Validez avant de générer le DIPE</h3><p class="muted" style="font-size:12px;margin:0 0 8px"><b>'+inc.length+'</b> salarié(s) seront dans le DIPE (décochez ceux à retirer). <b>'+exc.length+'</b> ligne(s) incomplète(s) seront <b>exclues</b> (listées en bas).</p><div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap"><button class="p" id="rc_ok">✅ Valider et générer le DIPE</button><button class="s" id="rc_no">Annuler (corriger d\'abord)</button></div><div style="max-height:56vh;overflow:auto"><table style="border-collapse:collapse;width:100%;font-size:12px"><tr><th></th><th style="text-align:left">Nom</th><th>Matricule</th><th>N° CNPS</th><th>Jours</th><th style="text-align:right">Brut</th><th style="text-align:right">Cotisable</th></tr>'+
      inc.map((o,k)=>'<tr style="border-top:1px solid rgba(128,128,128,.25)"><td><input type="checkbox" data-c="'+k+'" checked></td><td>'+esc(o.r.nom||'')+'</td><td>'+esc(o.r.mi||o.r.mat||'')+'</td><td>'+esc(o.r.cnps||'')+'</td><td>'+(o.r.jours||'')+'</td><td style="text-align:right">'+f(o.r.brut)+'</td><td style="text-align:right">'+f(o.r.cot)+'</td></tr>').join('')+'</table>'+
      (exc.length?'<h4 style="margin:12px 0 4px">🚫 Exclues du DIPE ('+exc.length+')</h4><table style="border-collapse:collapse;width:100%;font-size:12px">'+exc.map(o=>'<tr style="border-top:1px solid rgba(128,128,128,.25)"><td>'+esc(o.r.nom||'(nom inconnu)')+'</td><td>'+esc(o.r.mi||'')+'</td><td>'+o.m.map(k=>reason[k]||k).join(' · ')+'</td></tr>').join('')+'</table>':'')+'</div>');
    w.querySelector('#rc_no').onclick=()=>w.remove();
    w.querySelector('#rc_ok').onclick=()=>{
      w.querySelectorAll('[data-c]').forEach(c=>{if(!c.checked){const r=inc[+c.dataset.c].r;r.excl=true;r.keep=false;}});
      w.remove();render();T._go=true;dlb.click();};}
  dlb.addEventListener('click',ev=>{if(T._go){T._go=false;return;}ev.stopImmediatePropagation();ev.preventDefault();
    try{T.refSync(true);}catch(e){}render();
    T.askZero(()=>T.ia(x=>{const go=()=>x.gate(recap);
      if(x.step2)Promise.resolve(x.step2({local:true})).catch(()=>{}).then(go);else go();},recap));},true);

  /* --- ajouter les salariés des fiches qui ne sont pas dans le tableau --- */
  $('dpx_addemp').onclick=()=>{
    const haveE=new Set(R.map(r=>r.eid).filter(Boolean).map(String)),haveC=new Set(R.map(r=>digits(r.cnps)).filter(c=>c.length===11)),haveN=new Set(R.map(r=>nz(r.nom)).filter(Boolean));
    const add=E.filter(e=>{if(haveE.has(String(e.id)))return false;const c=digits(e.cnps);if(c.length===11&&haveC.has(c))return false;return !haveN.has(nz(e.n));});
    if(!add.length){say('Tous les salariés des fiches sont déjà dans le tableau');return;}
    if(!confirm('Ajouter '+add.length+' salarié(s) des fiches employés (brut à saisir ou à lire sur leur bulletin) ?'))return;
    add.forEach(e=>{const c=digits(e.cnps),m=MAT[e.id]||'';R.push({nom:e.n,eid:e.id,cnps:c.length===11?c:'',cnpsAuto:c.length===11,jours:30,brut:0,cot:0,exc:0,mat:String(m).slice(-4),mi:m,miAuto:!!m});});
    T.refSync(true);filter='all';render();$('dpx_info').textContent='➕ '+add.length+' salarié(s) ajouté(s) : lisez leurs bulletins ou saisissez le brut ; supprimez ensuite ceux qui n\'ont pas de paie ce mois (🗑 Supprimer… → « lignes sans bulletin »).';};

  /* --- fusionner 2 lignes (ex. ancien absent + nouveau bulletin du même salarié) --- */
  $('dpx_merge').onclick=()=>{
    const a=[...sel].filter(r=>R.includes(r));if(a.length!==2){say('Cochez exactement 2 lignes (ex. l\'ancien « absent » et le « nouveau » du même salarié)');return;}
    const keep=(a[0]._t&&!a[1]._t)?a[0]:(a[1]._t&&!a[0]._t)?a[1]:((a[0].brut||0)>=(a[1].brut||0)?a[0]:a[1]),don=keep===a[0]?a[1]:a[0];
    if(!confirm('Fusionner « '+(don.nom||'?')+' » dans « '+(keep.nom||'?')+' » ? La ligne « '+(don.nom||'?')+' » sera retirée (vous pourrez annuler).'))return;
    ['nom','eid','mi','mat','poste'].forEach(k=>{if(!keep[k]&&don[k])keep[k]=don[k];});
    if(digits(keep.cnps).length!==11&&digits(don.cnps).length===11){keep.cnps=digits(don.cnps);keep.cnpsAuto=false;}
    if(!(keep.brut>0)&&don.brut>0){keep.brut=don.brut;keep.cot=don.cot;keep.cotEst=don.cotEst;}
    keep.old=keep.old||don.old;keep.seen=true;keep.excl=false;keep.mem=keep.mem||don.mem;
    undo.push([{r:don,i:R.indexOf(don)}]);R.splice(R.indexOf(don),1);sel.clear();render();try{ctx.showAbs();}catch(e){}say('🔗 Lignes fusionnées — « Annuler » remet la ligne retirée');};

  /* --- compléter les manquants --- */
  function fillAll(){let n=0,nm=0,nc=0;
    try{n=ctx.fillFromEmp()||0;}catch(e){}
    R.forEach(r=>{
      let e=r.eid?E.find(y=>String(y.id)===String(r.eid)):null;
      if(!e&&r.nom)e=ctx.matchEmp(r.nom,r.nom);
      if(!e&&r.mi)e=E.find(y=>MAT[y.id]&&sameMi(MAT[y.id],r.mi));
      if(e){if(!r.eid){r.eid=e.id;if(!r.nom)r.nom=e.n;}
        const c=digits(e.cnps);if(digits(r.cnps).length!==11&&c.length===11&&!r.cnpsNoRef){r.cnps=c;r.cnpsAuto=true;nc++;}
        if(!r.mi&&MAT[e.id]){r.mi=MAT[e.id];r.miAuto=true;nm++;}}
      if(r.mi&&!r.mat)r.mat=String(r.mi).slice(-4);
      if(!(r.jours>=1&&r.jours<=30))r.jours=30;});
    return {nm,nc};}
  function genMis(){
    const pool=[...Object.values(MAT),...R.map(r=>r.mi).filter(Boolean)].map(String),cnt={};
    pool.forEach(v=>{const m=v.match(/^(.*?)(\d+)$/);if(m){const k=m[1]+'\u0001'+m[2].length;cnt[k]=(cnt[k]||0)+1;}});
    const best=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0];let prefix='',width=4;if(best){const p=best[0].split('\u0001');prefix=p[0];width=+p[1];}
    let max=0;pool.forEach(v=>{const m=v.match(/^(.*?)(\d+)$/);if(m&&m[1]===prefix)max=Math.max(max,parseInt(m[2],10));});
    let n=0;R.forEach(r=>{if(r.mi||!(r.nom||digits(r.cnps)))return;max++;r.mi=prefix+String(max).padStart(width,'0');r.miGen=true;r.mat=r.mi.slice(-4);n++;});
    return {n,sample:prefix+String(max+1).padStart(width,'0')};}
  $('dpx_comp').onclick=()=>{const a=fillAll();T.refSync(true);render();
    const left=R.filter((r,i)=>miss(r,i).length||!r.mi).length;
    $('dpx_info').innerHTML='🧩 Depuis les fiches : '+a.nc+' N° CNPS et '+a.nm+' matricule(s) complété(s). '+(left?left+' ligne(s) restent incomplètes : filtrez « À corriger » ou « Sans matricule interne », saisissez les valeurs, ou utilisez « Générer les matricules manquants ».':'✅ Tout est complet.');};
  $('dpx_gen').onclick=()=>{const miss0=R.filter(r=>!r.mi&&(r.nom||digits(r.cnps))).length;if(!miss0){say('Aucun matricule à générer');return;}
    if(!confirm('Générer '+miss0+' matricule(s) interne(s) à la suite de la numérotation existante ?'))return;
    const o=genMis();render();$('dpx_info').textContent='🔢 '+o.n+' matricule(s) généré(s) (prochain : '+o.sample+'). Vérifiez puis « Enregistrer dans les fiches ».';};
  $('dpx_save').onclick=async()=>{
    try{if(typeof CAN!=='undefined'&&CAN.edit&&!CAN.edit()){say('Permission refusée');return;}}catch(e){}
    const mats={},ciu=[];let nfix=0;
    R.forEach(r=>{if(!r.eid)return;if(r.mi&&String(MAT[r.eid]||'')!==String(r.mi))mats[r.eid]=r.mi;
      const e=E.find(y=>String(y.id)===String(r.eid));if(e&&digits(r.cnps).length===11){const fc=digits(e.cnps);if(fc.length!==11)ciu.push([e,digits(r.cnps)]);else if(r.cnpsRef&&fc!==digits(r.cnps)){ciu.push([e,digits(r.cnps)]);nfix++;}}});
    const nm=Object.keys(mats).length;
    if(!nm&&!ciu.length){say('Rien de nouveau à enregistrer (seules les lignes rattachées à une fiche employé sont concernées)');return;}
    if(!confirm(nm+' matricule(s) et '+ciu.length+' N° CNPS seront enregistrés dans les fiches employés (un N° déjà renseigné n\'est remplacé que s\'il diffère du référentiel CNPS : '+nfix+' correction(s)). Continuer ?'))return;
    let ko=0;
    try{if(nm){Object.assign(MAT,mats);await ctx.wr('matricules_json',MAT);}}catch(e){ko++;console.error(e);}
    for(const [e,c] of ciu){try{const cf=(window.TERH_CNPSREF&&TERH_CNPSREF.fmt)?TERH_CNPSREF.fmt(c):c;await updateEmp(e.id,{...e,cnps:cf});e.cnps=cf;}catch(er){ko++;console.error(er);}}
    say(ko?'⚠ Enregistré avec '+ko+' erreur(s) (voir la console)':'✅ Fiches mises à jour');};

  /* --- texte lu + apprentissage de libellé --- */
  function learn(i,line,k,next){
    const r=R[i];let label='',val=null;
    if(k==='mi'){const m=/([A-Za-z]{0,6}[-\/]?\d{1,12}[A-Za-z]?)/.exec(line.replace(/^[^:]*:/,m=>m));
      const re=/[A-Za-z]{0,6}[-\/]?\d{1,12}[A-Za-z]?/g;let mm,tok=null;while((mm=re.exec(line))){if(miOk(mm[0])){tok=mm;break;}}
      if(!tok){say('Aucun matricule sur cette ligne');return;}
      val=tok[0];label=line.slice(0,tok.index);}
    else{line=line.replace(/^\s*\d{3,6}\s+(?=[A-Za-zÀ-ÿ])/,'');   /* code rubrique (ex. 8100) retiré */
      let n=nums(line);if(!n.length&&next)n=nums(next);if(!n.length){say('Aucun montant sur cette ligne (ni sur la suivante)');return;}
      val=(k==='jours'||(k==='cot'&&/pension|vieillesse/i.test(line)))?n[0].v:Math.max(...n.map(x=>x.v));label=nums(line).length?line.slice(0,nums(line)[0].i):line;}
    label=label.replace(/[\s:.\-–=]+$/,'').replace(/^[\s:.\-–=]+/,'').trim();
    if(T.badLabel(k,label)||(k==='mi'&&T.miIsAmount(val,r))){say('⛔ Refusé : « '+label+' » est une rubrique de '+(k==='mi'?'montant (brut, cotisable, net…), pas un matricule':'matricule, pas un montant')+'. Choisissez la ligne « Matricule » du bulletin.');return;}
    if(label.length<3){label=(prompt('Libellé trop court. Recopiez le nom de la rubrique (ex. « Salaire cotisable ») :',label)||'').trim();if(label.length<3)return;}
    T.custom[k]=[label].concat((T.custom[k]||[]).filter(x=>x!==label));
    Promise.resolve(ctx.wr('dipe_labels',T.custom)).catch(()=>{try{localStorage.setItem('terh_dipe_labels',JSON.stringify(T.custom));}catch(e){}});
    if(k==='mi'){r.mi=val;r.mat=String(val).slice(-4);r.miAuto=false;}else{r[k]=val;if(k==='cot')r.cotEst=false;}
    r.src=r.src||{};r.src[k]=label;render();say('🏷 Libellé « '+label+' » mémorisé pour '+({mi:'le matricule',cot:'le cotisable',brut:'le brut',jours:'les jours'}[k])+' — valeur lue : '+val);}
  function openText(i){
    const r=R[i],lines=normLines(r._t||'');
    if(!lines.length){say('Pas de texte lu pour cette ligne (ancien modèle ou saisie manuelle)');return;}
    const w=ctx.openWin('<h3 style="margin:0 0 6px">🔎 Texte lu — '+esc(r.nom||'')+'</h3><p class="muted" style="font-size:12px;margin:0 0 6px">Cliquez le bouton d\'une ligne pour dire « cette ligne est le brut / cotisable / matricule / jours » : le libellé est mémorisé et servira pour tous les bulletins.</p><div id="dpx_ln" style="max-height:68vh;overflow:auto;font-size:12px"></div><div style="margin-top:8px"><button class="s" id="dpx_lnx">✕ Fermer</button></div>');
    const closeW=()=>{try{w.remove();}catch(e){}};w.querySelector('#dpx_lnx').onclick=closeW;
    w.addEventListener('click',ev=>{if(ev.target===w)closeW();});
    const onKey=ev=>{if(ev.key==='Escape'){closeW();document.removeEventListener('keydown',onKey);}};document.addEventListener('keydown',onKey);
    const box=w.querySelector('#dpx_ln');
    box.innerHTML='<table style="border-collapse:collapse;width:100%">'+lines.map((L,j)=>'<tr style="border-bottom:1px solid rgba(128,128,128,.25)"><td style="padding:2px 4px;font-family:monospace;white-space:pre-wrap">'+esc(L)+'</td><td style="white-space:nowrap;padding:2px"><button data-l="'+j+'" data-k="brut">Brut</button><button data-l="'+j+'" data-k="cot">Cotis.</button><button data-l="'+j+'" data-k="mi">Matr.</button><button data-l="'+j+'" data-k="jours">Jours</button></td></tr>').join('')+'</table>';
    box.querySelectorAll('[data-l]').forEach(b=>b.onclick=()=>{learn(i,lines[+b.dataset.l],b.dataset.k,lines[+b.dataset.l+1]);closeW();});}
  $('dpx_re').onclick=()=>{const rows=R.filter(r=>r._t);if(!rows.length){say('Aucun bulletin lu à relire');return;}
    if(!confirm('Relire '+rows.length+' bulletin(s) avec vos libellés ? Les valeurs corrigées à la main seront remplacées.'))return;
    T.cleanCustom();let n=0;rows.forEach(r=>{try{if(r.mi&&T.miIsAmount(r.mi,r)){r.mi='';r.mat='';}const x=ctx.parseSlip2(r._t,r.nom||'');['brut','cot','exc','jours','mi','mat','net','poste','src','cotEst','warn'].forEach(k=>{if(x[k]!==undefined&&x[k]!=='')r[k]=x[k];});n++;}catch(e){}});
    T.fixBadMi(R);render();say('↻ '+n+' bulletin(s) relu(s)');};
  $('dpx_tri').onclick=()=>T.ia(x=>x.openTriangulation());
  $('dpx_ia').onclick=()=>T.ia(x=>x.openAssistant());
  $('dpx_lab').onclick=()=>{
    const NM={mi:'Matricule interne',brut:'Brut',cot:'Cotisable',jours:'Jours',exc:'Exceptionnel',net:'Net'};
    const save=()=>Promise.resolve(ctx.wr('dipe_labels',T.custom)).catch(()=>{try{localStorage.setItem('terh_dipe_labels',JSON.stringify(T.custom));}catch(e){}});
    const w=ctx.openWin('<h3 style="margin:0 0 6px">🏷 Mes libellés</h3><p class="muted" style="font-size:12px;margin:0 0 8px">Ajoutez, modifiez ou supprimez les libellés que l\'application cherche sur les bulletins (ex. « Pension vieillesse CNPS » pour le cotisable). Ils passent <b>avant</b> les libellés standard. Un libellé ne doit contenir ni chiffre ni montant. Après un changement, relancez « Lire les bulletins ».</p><div id="dpx_lb"></div><div id="dpx_lbadd" style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(128,128,128,.35)"></div><div id="dpx_lbstd" style="margin-top:10px;font-size:11px" class="muted"></div>');
    const box=w.querySelector('#dpx_lb'),add=w.querySelector('#dpx_lbadd'),std=w.querySelector('#dpx_lbstd');
    const mk=(tag,props,css)=>{const e=document.createElement(tag);Object.assign(e,props||{});if(css)e.style.cssText=css;return e;};
    const check=(k,l)=>{l=String(l||'').trim();if(l.length<3){say('⛔ Libellé trop court (3 caractères minimum)');return null;}
      if(T.badLabel(k,l)){say('⛔ Libellé refusé : « '+l+' » contient un chiffre, des traits, ou est une rubrique incompatible avec « '+NM[k]+' ».');return null;}return l;};
    function draw(){
      box.innerHTML='';let n=0;
      Object.keys(NM).forEach(k=>{(T.custom[k]||[]).forEach((l,j)=>{n++;
        const row=mk('div',null,'display:flex;gap:6px;align-items:center;margin:3px 0');
        row.appendChild(mk('b',{textContent:NM[k]},'min-width:130px'));
        const inp=mk('input',{type:'text',value:l},'flex:1;min-width:0');
        const ok=mk('button',{textContent:'💾',title:'Enregistrer la modification'}),del=mk('button',{textContent:'🗑',title:'Supprimer'});
        ok.onclick=()=>{const v=check(k,inp.value);if(!v)return;
          if(v!==l&&(T.custom[k]||[]).some((x,i)=>i!==j&&x.toLowerCase()===v.toLowerCase())){say('Ce libellé existe déjà pour « '+NM[k]+' »');return;}
          T.custom[k][j]=v;save();say('✏ Libellé modifié : « '+v+' »');draw();};
        inp.onkeydown=e=>{if(e.key==='Enter')ok.click();};
        del.onclick=()=>{T.custom[k].splice(j,1);if(!T.custom[k].length)delete T.custom[k];save();say('🗑 Libellé supprimé');draw();};
        row.append(inp,ok,del);box.appendChild(row);});});
      if(!n)box.appendChild(mk('p',{className:'muted',textContent:'Aucun libellé personnalisé pour l\'instant.'}));
      /* formulaire d'ajout */
      add.innerHTML='';add.appendChild(mk('b',{textContent:'➕ Ajouter un libellé'},'display:block;margin-bottom:4px'));
      const r2=mk('div',null,'display:flex;gap:6px;align-items:center');
      const sel=mk('select',null,'min-width:130px');Object.keys(NM).forEach(k=>sel.appendChild(mk('option',{value:k,textContent:NM[k]})));
      const ni=mk('input',{type:'text',placeholder:'ex. Pension vieillesse CNPS'},'flex:1;min-width:0'),ab=mk('button',{textContent:'Ajouter',className:'p'});
      ab.onclick=()=>{const k=sel.value,v=check(k,ni.value);if(!v)return;
        T.custom[k]=T.custom[k]||[];if(T.custom[k].some(x=>x.toLowerCase()===v.toLowerCase())){say('Ce libellé existe déjà pour « '+NM[k]+' »');return;}
        T.custom[k].unshift(v);save();say('➕ Libellé ajouté pour « '+NM[k]+' » : '+v);draw();};
      ni.onkeydown=e=>{if(e.key==='Enter')ab.click();};
      r2.append(sel,ni,ab);add.appendChild(r2);
      std.innerHTML='<b>Libellés standard (toujours actifs, en second) :</b><br>'+Object.keys(NM).map(k=>'<u>'+NM[k]+'</u> : '+((T.LABELS[k]||[]).map(x=>esc(x.replace(/\(\?!.*$/,'').replace(/\\s\+/g,' ').replace(/\\b|\\/g,''))).join(' · ')||'—')).join('<br>');
    }
    draw();
  };

  /* --- N° CNPS du référentiel : appliqué automatiquement --- */
  T.refSync=silent=>{const n=T.refSyncRows(R,E,MAT);if(n&&!silent)say('📚 '+n+' N° CNPS remplacé(s) par ceux du référentiel CNPS');return n;};
  $('dpx_refsync').onclick=async()=>{try{if(window.TERH_CNPSREF)await TERH_CNPSREF.load();}catch(e){}
    if(!(window.TERH_CNPSREF&&TERH_CNPSREF.S.list.length)){say('Référentiel CNPS vide : importez-le d\'abord (bouton 📚 « Référentiel CNPS » du module)');return;}
    const n=T.refSync(true);render();say(n?'📚 '+n+' N° CNPS remplacé(s) par ceux du référentiel':'📚 Tous les N° CNPS sont déjà ceux du référentiel');};
  $('dpx_refback').onclick=()=>{let k=0;R.forEach(r=>{if(r.cnpsSrc==='absent'&&digits(r.cnpsWas).length===11&&!r.cnpsWasOwned){r.cnps=digits(r.cnpsWas);r.cnpsManual=true;r.cnpsSrc='hors';r.cnpsNoRef=false;k++;}});
    render();say(k?'↩ '+k+' N° repris (hors référentiel, marqués comme saisis par vous)':'Aucun N° à reprendre (ceux qui appartiennent à quelqu\'un d\'autre ne sont jamais repris)');};
  /* --- étape ① : Total brut = 0 ET Pension vieillesse CNPS = 0 → exclusion proposée, JAMAIS appliquée sans validation --- */
  T.zeroRows=()=>R.filter((r,i)=>incl(r,i)&&T.isZero(r)&&!r.zeroKeep);
  T.askZero=function(next){
    next=typeof next==='function'?next:function(){};
    const Z=T.zeroRows();if(!Z.length){next();return;}
    const w=ctx.openWin('<h3 style="margin:0 0 6px">① Exclusion à valider ('+Z.length+' salarié'+(Z.length>1?'s':'')+')</h3>'+
      '<p class="muted" style="font-size:12px;margin:0 0 8px">Pour ces salariés, le <b>Total brut</b> est à <b>0</b> ET la <b>Pension vieillesse CNPS</b> est à <b>0</b> : ils n\'ont rien à déclarer ce mois. <b>Rien n\'est exclu sans votre accord.</b> Les lignes cochées seront <b>exclues du DIPE</b> (elles restent dans le tableau : vous pourrez les réinclure). Décochez celles à garder.</p>'+
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px"><button class="p" id="zr_ok">✅ Valider : exclure les lignes cochées</button><button class="s" id="zr_all">☑ Tout cocher</button><button class="s" id="zr_none">☐ Tout décocher</button><button class="s" id="zr_keep">Garder toutes (je corrige moi-même)</button></div>'+
      '<div style="max-height:56vh;overflow:auto"><table id="zr_t" style="border-collapse:collapse;width:100%;font-size:12px"></table></div>');
    const t=w.querySelector('#zr_t');
    t.innerHTML='<tr><th></th><th style="text-align:left">Nom</th><th style="text-align:left">Matricule</th><th style="text-align:left">N° CNPS</th><th style="text-align:right">Total brut</th><th style="text-align:right">Pension vieillesse</th><th style="text-align:left">Origine</th></tr>'+
      Z.map((r,k)=>'<tr style="border-top:1px solid rgba(128,128,128,.25)"><td><input type="checkbox" data-z="'+k+'" checked></td><td>'+esc(r.nom||'(nom inconnu)')+'</td><td>'+esc(r.mi||r.mat||'')+'</td><td>'+esc(r.cnps||'')+'</td><td style="text-align:right">0</td><td style="text-align:right">0</td><td>'+(r._t?'bulletin lu : brut 0 et pension vieillesse 0':'aucun bulletin lu pour ce salarié')+'</td></tr>').join('');
    const cks=()=>[...t.querySelectorAll('[data-z]')];
    w.querySelector('#zr_all').onclick=()=>cks().forEach(c=>c.checked=true);
    w.querySelector('#zr_none').onclick=()=>cks().forEach(c=>c.checked=false);
    w.querySelector('#zr_keep').onclick=()=>{Z.forEach(r=>{r.zeroKeep=true;});w.remove();render();say('Lignes conservées : elles restent à corriger (cases rouges)');next();};
    w.querySelector('#zr_ok').onclick=()=>{let x=0,k=0;
      cks().forEach(c=>{const r=Z[+c.dataset.z];if(c.checked){r.excl=true;r.keep=false;r.exclWhy='brut = 0 et pension vieillesse = 0 (validé)';x++;}else{r.zeroKeep=true;k++;}});
      w.remove();render();try{ctx.showAbs();}catch(e){}say('🚫 '+x+' salarié(s) exclu(s) du DIPE après validation'+(k?' · '+k+' conservé(s)':''));next();};};
  $('dpx_zero').onclick=()=>{R.forEach(r=>{if(r.zeroKeep&&T.isZero(r))r.zeroKeep=false;});if(!T.zeroRows().length){say('Aucun salarié avec brut = 0 et pension vieillesse = 0');return;}T.askZero(()=>{});};
  $('dpx_s2').onclick=()=>T.ia(x=>{if(!x.step2){say('cnps-ia.js à mettre à jour : l\'étape ② est absente');return;}
    Promise.resolve(x.step2({ask:true})).catch(e=>{console.error(e);say('Étape ② : '+e.message);}).then(()=>T.banner());});
  /* le module appelle draw() après lecture : on le remplace par notre rendu */
  ctx.setDraw(render);
  try{const C0=window.TERH_CNPSREF;if(C0&&C0.load)Promise.resolve(C0.load()).then(()=>{const n=T.refSync(true);if(n){render();const ab=R.filter(r=>r.cnpsSrc==='absent'||r.cnpsSrc==='ambigu').length;say('📚 '+n+' N° CNPS corrigé(s) d\'après le référentiel CNPS'+(ab?' · ⚠ '+ab+' personne(s) introuvable(s)/homonymes : N° vide, à saisir':''));}}).catch(()=>{});}catch(e){}
  $('dpx_info').textContent='🧩 dipe-plus.js v'+T.version+' actif — brut lu sur « Total Brut », cotisable sur la colonne Base de « Pension vieillesse CNPS » (aucun calcul) · N° CNPS : référentiel CNPS en priorité.';
  g('d_flt').onchange=render;g('d_drop').onchange=render;
  const stat=el.querySelector('#d_s');
  if(stat&&!stat._dpx){stat._dpx=1;new MutationObserver(()=>{if(/bulletin\(s\) lu\(s\)/.test(stat.textContent)&&!stat.dataset.x){const rs=R.filter(r=>r._t);const c=rs.filter(r=>r.cot>0&&r.src&&r.src.cot&&!r.cotEst).length,mi=rs.filter(r=>r.mi&&!r.miAuto).length;
      $('dpx_info').innerHTML='📊 '+rs.length+' bulletin(s) : cotisable lu sur <b>'+c+'</b> · matricule interne lu sur <b>'+mi+'</b>'+(rs.length-c>0?' · <span style="color:#e69500">'+(rs.length-c)+' cotisable(s) non trouvé(s)</span> (filtre « À corriger », puis 🔎 pour apprendre le libellé)':'')+'.';}}).observe(stat,{childList:true,characterData:true,subtree:true});}
  render();
};

/* traductions anglaises de cette interface */
try{(window.TERH_I18N_add||function(o){window.TERH_I18N=Object.assign(window.TERH_I18N||{},o);})({
 'Nom, CNPS, matricule…':'Name, CNPS, employee no.…','Tout (filtre)':'All (filtered)','Aucun':'None','Supprimer la sélection':'Delete selection','Supprimer…':'Delete…',
 'les lignes vides (sans CNPS ni brut)':'empty rows (no CNPS nor gross)','les lignes sans bulletin (brut 0)':'rows without payslip (gross 0)','les anciens absents des bulletins':'old rows missing from payslips','les doublons (même CNPS ou matricule)':'duplicates (same CNPS or employee no.)','toutes les lignes à corriger':'all rows to fix',
 'Annuler':'Undo','Compléter les manquants':'Complete missing data','Générer les matricules manquants':'Generate missing employee numbers','Enregistrer dans les fiches':'Save to employee records','Relire avec les libellés appris':'Re-read with learned labels','Mes libellés':'My labels',
 'Exclure la sélection':'Exclude selection','Réinclure la sélection':'Re-include selection','Exclure les absents des bulletins':'Exclude those missing from payslips','Ajouter les salariés des fiches absents du tableau':'Add employees from records missing in the table','Fusionner 2 lignes cochées':'Merge 2 ticked rows','Complets':'Complete','Exclus':'Excluded','Incl.':'Incl.',
 'Tous':'All','À corriger':'To fix','Nouveaux':'New','Absents des bulletins':'Missing from payslips','Doublons':'Duplicates','Cotisable estimé':'Estimated contributory salary','Sans matricule interne':'No internal employee no.','Sans CNPS valide':'No valid CNPS',
 'Matricule interne':'Internal employee no.','Matr. DIPE':'DIPE no.','Cotisable':'Contributory salary','Période':'Period','État':'Status','Net':'Net',
 'Texte lu — ':'Text read — ','Mes libellés appris':'My learned labels','Aucune ligne. Chargez des bulletins puis « Lire les bulletins ».':'No rows. Load payslips then “Read payslips”.'
});}catch(e){}
})();
