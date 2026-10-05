#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
apply_patch.py — Applique TOUTES les modifications au fichier index.html
Génère index_fixed.html prêt à déployer (renommer en index.html).
Testé sur la version fournie par l'utilisateur.
"""
import pathlib, sys

SRC = pathlib.Path("index.html")
DST = pathlib.Path("index_fixed.html")

if not SRC.exists():
    print("❌ index.html introuvable dans", SRC.resolve())
    sys.exit(1)

src = SRC.read_text(encoding="utf-8")
orig = src
ok = []
miss = []

def rep(old, new, label, req=True):
    global src
    if old not in src:
        if req: miss.append(label)
        return False
    src = src.replace(old, new, 1)
    ok.append(label)
    return True

# ============================================================
# A1 — CSS .paper position:relative + .pcover
# ============================================================
rep(
    ".paper{width:210mm;min-height:297mm;margin:0 auto;",
    ".paper{position:relative;width:210mm;min-height:297mm;margin:0 auto;",
    "A1a .paper position:relative"
)
MARK = ".paper{position:relative;width:210mm;min-height:297mm;margin:0 auto;background:#fff;color:#000;padding:150px 22mm 110mm 22mm;font:13pt/1.42 'Times New Roman',Times,serif;box-sizing:border-box;box-shadow:0 6px 20px rgba(0,0,0,.15)}"
if MARK in src and ".pcover{" not in src:
    src = src.replace(
        MARK,
        MARK + "\n.pcover{position:absolute;top:8mm;left:0;right:0;text-align:center;pointer-events:none}\n.pcover img{max-width:80%;max-height:32mm;object-fit:contain}",
        1)
    ok.append("A1b .pcover CSS")
else:
    miss.append("A1b .pcover CSS")

# ============================================================
# A2 — printHTML : exclusion élargie du cover
# ============================================================
rep(
    "try{const _c=curCo();if(_c&&_c.cover_url&&!/^Rapport|^Alertes/.test(title))body=",
    "try{const _c=curCo();const _excl=/^(Rapport|Alertes|Demande d.explication|Notification de sanction|Certificats?|Lettres? de fin)/i;if(_c&&_c.cover_url&&!_excl.test(title))body=",
    "A2 printHTML exclusion"
)

# ============================================================
# A3 — draw() + coverTag()
# ============================================================
rep(
    "function draw(){if(!LR)return;const r=LR;const tpl=DOC_TYPE==='lettre'?cutAfterDir(PARAMS.tpl_let||TPL_LET):(PARAMS.tpl_cert||TPL_CERT);$('pp').className='paper'+(DOC_TYPE==='certificat'?' cert':'');$('pp').innerHTML=renderTemplate(tpl,r,{demob:$('lm').value,deb:$('ldb').value});fitPaper();}",
    "function coverTag(){try{const c=curCo();if(c&&c.cover_url)return '<div class=\"pcover\"><img src=\"'+esc(c.cover_url)+'\" alt=\"\"></div>';}catch(e){}return '';}\n"
    "function draw(){if(!LR)return;const r=LR;const tpl=DOC_TYPE==='lettre'?cutAfterDir(PARAMS.tpl_let||TPL_LET):(PARAMS.tpl_cert||TPL_CERT);$('pp').className='paper'+(DOC_TYPE==='certificat'?' cert':'');$('pp').innerHTML=coverTag()+renderTemplate(tpl,r,{demob:$('lm').value,deb:$('ldb').value});fitPaper();}",
    "A3 draw + coverTag"
)

# ============================================================
# A4 — batchPrint : cover sur chaque page + CSS
# ============================================================
rep(
    "    pg=a.map(r=>'<div class=\"pg'+(cert?' cert':'')+'\">'+renderTemplate(tpl,r,{demob:'',deb:''})+'</div>').join('');",
    "    pg=a.map(r=>'<div class=\"pg'+(cert?' cert':'')+'\">'+coverTag()+renderTemplate(tpl,r,{demob:'',deb:''})+'</div>').join('');",
    "A4a batchPrint pg"
)
rep(
    "+'.pg.cert p.sgn2{margin:3.4em 0 0 50%;font-size:12pt;letter-spacing:.5pt;text-align:left}';",
    "+'.pg.cert p.sgn2{margin:3.4em 0 0 50%;font-size:12pt;letter-spacing:.5pt;text-align:left}'\n"
    "   +'.pg{position:relative}.pcover{position:absolute;top:8mm;left:0;right:0;text-align:center;pointer-events:none}.pcover img{max-width:80%;max-height:32mm;object-fit:contain}';",
    "A4b batchPrint CSS cover"
)

# ============================================================
# A5 — Onglet Sanction dans #ptabs
# ============================================================
rep(
    '<button data-t="de">⚖️ Modèle DE</button><button data-t="doc">📎 Documents</button>',
    '<button data-t="de">⚖️ Modèle DE</button><button data-t="san">🚫 Modèle Sanction</button><button data-t="doc">📎 Documents</button>',
    "A5 onglet Sanction"
)

# ============================================================
# A6 — Héritage modèles groupe (loadAll)
# ============================================================
rep(
    "  (par.data||[]).forEach(r=>{if(r.cle in PARAMS&&r.valeur!=null)PARAMS[r.cle]=r.valeur;});",
    "  (par.data||[]).forEach(r=>{if(r.cle in PARAMS&&r.valeur!=null)PARAMS[r.cle]=r.valeur;});\n"
    "  try{const _co=curCo();if(_co&&_co.groupe_id&&_co.type_entreprise!=='groupe'){const own=new Set((par.data||[]).filter(r=>r.valeur!=null&&String(r.valeur).trim()!=='').map(r=>r.cle));const miss=['tpl_let','tpl_cert','tpl_de','tpl_sanction'].filter(k=>k in PARAMS&&!own.has(k));if(miss.length){const pr=await db.from('parametres').select('cle,valeur').eq('entreprise_id',_co.groupe_id).in('cle',miss);(pr.data||[]).forEach(r=>{if(r.valeur!=null&&String(r.valeur).trim()!=='')PARAMS[r.cle]=r.valeur;});}}}catch(e){}",
    "A6 héritage groupe"
)

# ============================================================
# A7 — __MY_PERMS (loadMyRole)
# ============================================================
rep(
    "  CO=data?.entreprise_id||null;",
    "  CO=data?.entreprise_id||null;try{window.__MY_PERMS=Array.isArray(data&&data.permissions)?data.permissions:[];}catch(e){window.__MY_PERMS=[];}",
    "A7 __MY_PERMS"
)

# ============================================================
# A8 — toJpeg : fond blanc
# ============================================================
rep(
    "c.getContext('2d').drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(u);",
    "const _g=c.getContext('2d');_g.fillStyle='#fff';_g.fillRect(0,0,c.width,c.height);_g.drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(u);",
    "A8 toJpeg fond blanc"
)

# ============================================================
# A9 — Import modèles : formats étendus
# ============================================================
rep(
    '<input type="file" accept=".txt,.html,.htm" hidden>',
    '<input type="file" accept=".txt,.md,.html,.htm,.rtf,.docx,.pdf,.jpg,.jpeg,.png,.webp" hidden>',
    "A9a input accept"
)
OLD_HANDLER = "w.querySelector('input').onchange=async e=>{const f=e.target.files[0];if(!f)return;if(f.size>200000){toast('Fichier trop volumineux (max 200 Ko)');return;}t.value=await f.text();t.dispatchEvent(new Event('input',{bubbles:true}));toast('Modèle chargé : vérifiez l'aperçu puis enregistrez');e.target.value='';};"
NEW_HANDLER = "w.querySelector('input').onchange=async e=>{const f=e.target.files[0];if(!f)return;if(f.size>3000000){toast('Fichier trop volumineux (max 3 Mo)');return;}try{t.value=await window.TERH_tplFromFile(f);t.dispatchEvent(new Event('input',{bubbles:true}));toast('Modèle chargé : vérifiez l'aperçu puis enregistrez');}catch(er){toast('Erreur : '+er.message);}e.target.value='';};"
if OLD_HANDLER in src:
    src = src.replace(OLD_HANDLER, NEW_HANDLER, 1); ok.append("A9b handler")
else:
    # tolérance apostrophe droite / typographique
    if OLD_HANDLER.replace("'", "\\'") in src:
        src = src.replace(OLD_HANDLER.replace("'", "\\'"), NEW_HANDLER, 1); ok.append("A9b handler (échappé)")
    else:
        miss.append("A9b handler")

# ============================================================
# A10 — helpList filtrée par modules
# ============================================================
OLD_HELP = "const helpList=()=>isAdm()?HELP:HELP.filter(h=>!HELP_OWN.includes(h[0])).map(h=>h[0]==='Rôles et permissions'?[h[0],h[1],'👑 Administrateur : tout sur son entreprise. ✏️ Éditeur : ajout/modification/import/congés. 👁️ Lecteur : consultation seulement.']:h);"
NEW_HELP = ("const HELP_NEED={'Suivi disciplinaire':'dsp','Congés':'c','Alertes de contrats':'a','CNPS en retard':'a','DIPE depuis les bulletins':'paie'};\n"
"const helpList=()=>{\n"
"  const base=isAdm()?HELP:HELP.filter(h=>!HELP_OWN.includes(h[0])).map(h=>h[0]==='Rôles et permissions'?[h[0],h[1],'👑 Administrateur : tout sur son entreprise. ✏️ Éditeur : ajout/modification/import/congés. 👁️ Lecteur : consultation seulement.']:h);\n"
"  try{if(typeof modOn!=='function')return base;return base.filter(h=>{const k=HELP_NEED[h[0]];return !k||modOn(k);});}catch(e){return base;}\n"
"};")
rep(OLD_HELP, NEW_HELP, "A10 helpList filtrée")

# ============================================================
# A11 — Onglets ent/bib/mt du Centre de contrôle
# ============================================================
rep(
    "    ['rol','🔐 Rôles & permissions'],['mg','🧩 Modules'],['mn','📋 Menus'],",
    "    ['rol','🔐 Rôles & permissions'],['mg','🧩 Modules'],['mn','📋 Menus'],\n    ['ent','🖼️ Papier à en-tête'],['bib','📚 Bibliothèque'],['mt','🛠 Maintenance'],",
    "A11a tabs ent/bib/mt"
)
rep(
    "  if(OTAB==='tx')body=await OWX.tx();",
    "  if(OTAB==='tx')body=await OWX.tx();\n  if(OTAB==='ent')body=await OWX.ent();\n  if(OTAB==='bib')body=await OWX.bib();\n  if(OTAB==='mt')body=await OWX.mt();",
    "A11b handlers ent/bib/mt"
)

# ============================================================
# B — Bloc principal (import, bibliothèque, onglets, chat, photo)
# ============================================================
BIG = r'''<script id="terh-ALL-PATCH">
(function(){
'use strict';
const $=id=>document.getElementById(id),H=x=>String(x??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const T=m=>{try{toast(m)}catch(e){console.log(m)}};

/* ============ 1. IMPORT DE MODÈLES DOCX / PDF / RTF / IMAGE ============ */
window.TERH_tplFromFile=async function(f,mode){
  if(!f)return '';
  const ex=f.name.toLowerCase().split('.').pop();
  if(ex==='txt'||ex==='md')return await f.text();
  if(ex==='html'||ex==='htm'){const h=await f.text();return h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();}
  if(ex==='rtf'){let t=await f.text();return t.replace(/\\par[d]?\b/g,'\n').replace(/\\[a-z]+-?\d* ?/gi,'').replace(/[{}]/g,'').replace(/\\'/g,"'").replace(/\n{3,}/g,'\n\n').trim();}
  if(ex==='docx'){if(!window.mammoth)await loadJS('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');const r=await mammoth.extractRawText({arrayBuffer:await f.arrayBuffer()});return r.value||'';}
  if(ex==='pdf')return await readPdf(f);
  if(['jpg','jpeg','png','webp','bmp'].includes(ex))return await readImg(f);
  throw new Error('Format non supporté : .'+ex);
};

/* ============ 2. BIBLIOTHÈQUE LOCALE (IndexedDB) — hors ligne ============ */
(function(){
  const open=()=>new Promise((ok,ko)=>{const r=indexedDB.open('terh_bib',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('docs'))r.result.createObjectStore('docs',{keyPath:'id'});};r.onsuccess=()=>ok(r.result);r.onerror=()=>ko(r.error);});
  const chunk=txt=>{txt=String(txt||'').replace(/\r/g,'').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();const out=[];const SZ=1200;for(let i=0;i<txt.length;i+=SZ)out.push(txt.slice(i,i+SZ));return out;};
  window.TERH_bibAdd=async function(t,txt){const d=await open();const doc={id:'b'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),t:t.slice(0,120),k:'bib',at:new Date().toISOString(),chunks:chunk(txt)};await new Promise((ok,ko)=>{const r=d.transaction('docs','readwrite').objectStore('docs').put(doc);r.onsuccess=ok;r.onerror=()=>ko(r.error);});return doc;};
  window.TERH_bibList=async()=>{try{const d=await open();return await new Promise(ok=>{const r=d.transaction('docs').objectStore('docs').getAll();r.onsuccess=()=>ok(r.result||[]);r.onerror=()=>ok([]);});}catch(e){return [];}};
  window.TERH_bibDel=async id=>{try{const d=await open();return await new Promise(ok=>{const r=d.transaction('docs','readwrite').objectStore('docs').delete(id);r.onsuccess=ok;r.onerror=ok;});}catch(e){}};
  const refresh=async()=>{try{if(!window.TERH_bibList)return;const list=await window.TERH_bibList();if(!list.length)return;
    const base=(window.TERH_CORPUS||[]).filter(c=>c.k!=='bib');
    list.forEach(d=>d.chunks.forEach((c,i)=>base.push({t:d.t+(d.chunks.length>1?' ('+(i+1)+'/'+d.chunks.length+')':''),x:c,k:'bib'})));
    window.TERH_CORPUS=base;}catch(e){}};
  setInterval(refresh,4000);setTimeout(refresh,800);
})();

/* ============ 3. ONGLETS CENTRE DE CONTRÔLE : ent / bib / mt ============ */
const OWX=window.OWX||(window.OWX={}),OWP=window.OWP||(window.OWP={});

OWX.ent=async()=>{const c=(typeof curCo==='function'&&curCo())||{};return `<div class="c"><h2>🖼️ Papier à en-tête — ${H(c.nom||'')}</h2><p class="muted">Image affichée en haut des documents imprimés (lettres de fin, certificats, DE, sanctions). Les rapports, alertes et notifications excluent volontairement le papier à en-tête.</p>
<div style="text-align:center;margin:14px 0;min-height:60px"><img src="${H(c.cover_url||'')}" style="max-width:100%;max-height:100px;object-fit:contain;${c.cover_url?'':'display:none'}" id="ent_img"></div>
<div class="f"><label class="s" style="cursor:pointer;padding:8px 12px">📁 Choisir l'image<input type="file" accept="image/*" id="ent_file" hidden></label><button class="p" id="ent_save">💾 Enregistrer</button><button class="s" id="ent_del">🗑 Retirer</button></div>
<p class="muted" style="font-size:12px;margin-top:8px">Photo du propriétaire : bouton 📷 en haut de l'écran (avatar). Logo d'entreprise : même bouton 📷, section dédiée.</p></div>`;};
OWP.ent=()=>{
  let blob=null;const img=$('ent_img');
  const f=$('ent_file');if(f)f.onchange=async e=>{const x=e.target.files[0];if(!x)return;
    try{blob=await toJpeg(x,1600);img.src=URL.createObjectURL(blob);img.style.display='';T('Aperçu chargé — cliquez sur Enregistrer');}
    catch(er){T('Erreur : '+er.message);}};
  if($('ent_save'))$('ent_save').onclick=async()=>{if(!blob){T('Choisissez d\'abord une image');return;}
    try{const c=curCo();let url;
      try{const path='logos/'+c.id+'-entete-'+Date.now()+'.jpg';const {error}=await db.storage.from('branding').upload(path,blob,{contentType:'image/jpeg',upsert:true});if(error)throw error;url=db.storage.from('branding').getPublicUrl(path).data.publicUrl+'?v='+Date.now();}
      catch(e){url=await new Promise(ok=>{const fr=new FileReader();fr.onload=()=>ok(fr.result);fr.readAsDataURL(blob)});}
      const {error}=await db.from('entreprises').update({cover_url:url}).eq('id',c.id);if(error)throw error;c.cover_url=url;T('✅ Papier à en-tête enregistré');}
    catch(e){T('Erreur : '+e.message);}};
  if($('ent_del'))$('ent_del').onclick=async()=>{if(!confirm('Retirer le papier à en-tête ?'))return;
    try{const c=curCo();await db.from('entreprises').update({cover_url:null}).eq('id',c.id);c.cover_url=null;img.style.display='none';T('Retiré');}
    catch(e){T('Erreur : '+e.message);}};
};

OWX.bib=async()=>{const co=curCo()||{};return `<div class="c"><h2>📚 Bibliothèque — ${H(co.nom||'')}</h2>
<p class="muted">Livres, conventions collectives, codes, procédures. Les textes sont enregistrés dans <b>IndexedDB</b> : ils restent lisibles par l'IA et l'assistant <b>même sans internet</b>.</p>
<div class="f"><label class="s" style="cursor:pointer;padding:8px 12px">📎 Ajouter des fichiers (PDF, DOCX, TXT, HTML, RTF)<input type="file" id="bib_f" accept=".txt,.md,.html,.htm,.rtf,.docx,.pdf" hidden multiple></label><span id="bib_s" class="muted"></span></div>
<div id="bib_list" style="margin-top:10px"></div></div>`;};
OWP.bib=()=>{
  const draw=async()=>{const box=$('bib_list');if(!box)return;
    const list=await window.TERH_bibList();
    box.innerHTML=list.length?list.map(x=>`<div style="display:flex;gap:10px;align-items:center;padding:8px;border:1px solid var(--bd);border-radius:8px;margin:4px 0"><span>📄</span><b style="flex:1">${H(x.t)}</b><small class="muted">${(x.chunks||[]).reduce((a,c)=>a+c.length,0)} car.</small><button class="s" data-bibdel="${H(x.id)}">🗑</button></div>`).join(''):'<p class="muted">Aucun document.</p>';
    box.querySelectorAll('[data-bibdel]').forEach(b=>b.onclick=async()=>{if(!confirm('Supprimer ce document ?'))return;await window.TERH_bibDel(b.dataset.bibdel);T('Supprimé');draw();});};
  const f=$('bib_f');
  if(f)f.onchange=async e=>{const fs=[...e.target.files];if(!fs.length)return;const s=$('bib_s');
    for(const file of fs){try{s.textContent='⏳ Lecture de '+file.name+'…';const txt=await window.TERH_tplFromFile(file);await window.TERH_bibAdd(file.name,txt);}
      catch(er){T('Erreur '+file.name+' : '+er.message);}}
    s.textContent='✅ '+fs.length+' fichier(s) ajouté(s)';draw();};
  draw();
};

OWX.mt=async()=>{
  let nbDoc=0;try{const l=await window.TERH_bibList();nbDoc=l.length;}catch(e){}
  const ERRLOG_N=Array.isArray(window.ERRLOG)?window.ERRLOG.length:0;
  return `<div class="c"><h2>🛠 Maintenance</h2>
  <div class="kp">
   <div class="k g-blue"><b>${(window.E||[]).length}</b><span>Employés</span></div>
   <div class="k g-green"><b>${(window.CG||[]).length}</b><span>Congés</span></div>
   <div class="k g-orange"><b>${nbDoc}</b><span>Documents IA</span></div>
   <div class="k g-red"><b>${ERRLOG_N}</b><span>Erreurs locales</span></div>
  </div>
  <div class="f" style="margin-top:10px">
   <button class="s" data-mt="reload">🔄 Recharger les données</button>
   <button class="s" data-mt="cache">🧹 Vider le cache local</button>
   <button class="s" data-mt="diag">📋 Rapport de diagnostic</button>
   <button class="s" data-mt="backup">💾 Sauvegarde JSON</button>
  </div>
  <h3 style="margin-top:14px">Journal d'erreurs local</h3>
  <pre style="white-space:pre-wrap;font-size:11px;max-height:240px;overflow:auto;background:var(--bg);padding:8px;border-radius:8px">${H((Array.isArray(window.ERRLOG)?window.ERRLOG.join('\n'):'')||'Aucune erreur.')}</pre></div>`;};
OWP.mt=()=>{
  document.querySelectorAll('#v-own [data-mt]').forEach(b=>b.onclick=async()=>{
    const a=b.dataset.mt;
    try{
      if(a==='reload'){await loadAll();T('Données rechargées');}
      if(a==='cache'){if(!confirm('Vider le cache local (les données en ligne restent) ?'))return;
        try{if(typeof TCACHE!=='undefined'&&TCACHE._o)TCACHE._o.then(d=>{try{d&&d.close();}catch(e){}});indexedDB.deleteDatabase('terh_cache');}catch(e){}
        T('Cache vidé');setTimeout(()=>location.reload(),600);}
      if(a==='diag'){const t='TERH diagnostic '+new Date().toLocaleString('fr-FR')+'\nRôle : '+(window.MY_ROLE||'')+'\nEmployés : '+(window.E||[]).length+'\nIA locale : '+(typeof aiReady!=='undefined'&&aiReady)+'\nNavigateur : '+navigator.userAgent+'\n\nErreurs :\n'+(Array.isArray(window.ERRLOG)?window.ERRLOG.join('\n'):'');
        try{await navigator.clipboard.writeText(t);T('Rapport copié');}catch(e){$('rph')&&($('rph').textContent='Diagnostic');$('rpt')&&($('rpt').textContent=t);$('rpb')&&$('rpb').classList.add('on');}}
      if(a==='backup'){const sb=$('sg-bak');sb&&sb.click();}
    }catch(e){T('Erreur : '+e.message);}
  });
};

/* ============ 4. CHAT IA : suppression persistante (tombstone) ============ */
(function(){
  const K='terh_ai_deleted';
  const get=()=>{try{return new Set(JSON.parse(localStorage.getItem(K)||'[]'));}catch(e){return new Set();}};
  const put=s=>{try{localStorage.setItem(K,JSON.stringify([...s].slice(-500)));}catch(e){}};
  window.TERH_aiMarkDeleted=async(ids)=>{
    const s=get();ids.forEach(i=>s.add(String(i)));put(s);
    try{if(window.MY_USER){for(const id of ids){await db.from('ai_conversations').delete().eq('user_id',window.MY_USER.id).eq('id',id);}}}
    catch(e){console.warn('[IA] tombstone local seulement :',e.message);}
  };
})();

/* ============ 5. ACTUALISATION DU GUIDE IA (contexte enrichi) ============ */
(function(){
  const hook=()=>{try{
    if(typeof ctxAgg==='function'&&!ctxAgg._patch){
      const o=ctxAgg;const n=function(){let s=o.apply(this,arguments);
        try{if(Array.isArray(window.TERH_CORPUS)&&window.TERH_CORPUS.length>0){
          const byK={};window.TERH_CORPUS.forEach(c=>{byK[c.k]=(byK[c.k]||0)+1;});
          s+=' Base de connaissances locale disponible : '+Object.entries(byK).map(([k,n])=>n+' extrait(s) '+k).join(', ')+'.';
        }}catch(e){}
        return s;};n._patch=1;window.ctxAgg=n;
    }
  }catch(e){}};
  hook();setInterval(hook,1500);
})();

/* ============ 6. PHOTO PROPRIÉTAIRE : affichage dans le chat ============ */
(function(){
  const paint=async()=>{try{
    const url=window._avUrl||localStorage.getItem('terh_av_'+((window.MY_USER&&MY_USER.id)||''))||'';
    if(!url)return;
    const head=document.querySelector('#am > div:first-child');
    if(head&&!head.querySelector('img.avprop')){
      const img=document.createElement('img');img.className='avprop';img.src=url;img.alt='';
      img.style.cssText='width:32px;height:32px;border-radius:50%;object-fit:cover;margin-right:8px;border:2px solid rgba(255,255,255,.6);vertical-align:middle';
      head.firstElementChild.insertBefore(img,head.firstElementChild.firstChild);
    }
  }catch(e){}};
  setInterval(paint,2500);setTimeout(paint,1500);
})();

/* ============ 7. PERMISSIONS ============ */
setTimeout(()=>{try{if(typeof ensurePerms==='function')ensurePerms();}catch(e){}},5000);

console.log('%c✅ Patch TERH global chargé (cover, import, bibliothèque, onglets, IA)','background:#1e8e4e;color:#fff;padding:4px 10px;border-radius:6px;font-weight:bold');
})();
</script>
'''
if "</body></html>" in src:
    src = src.replace("</body></html>", BIG + "\n</body></html>", 1)
    ok.append("B bloc principal")
else:
    miss.append("B bloc principal")

# ============================================================
# ÉCRITURE DU FICHIER FINAL
# ============================================================
if src == orig:
    print("\n❌ AUCUNE modification appliquée.")
    print("Le fichier index.html ne correspond pas à celui attendu.")
    sys.exit(2)

DST.write_text(src, encoding="utf-8")
print("\n" + "="*60)
print("✅ FICHIER GÉNÉRÉ :", DST.resolve())
print("="*60)
print(f"\n{len(ok)} modification(s) appliquée(s) :")
for x in ok: print("  ✓", x)
if miss:
    print(f"\n⚠ {len(miss)} ancre(s) introuvable(s) :")
    for x in miss: print("  ✗", x)
    print("\n→ Vérifie que tu appliques le script sur la BONNE version de index.html.")
print("\nÉTAPES SUIVANTES :")
print("  1. Ouvre index_fixed.html dans un navigateur, connecte-toi, teste.")
print("  2. Si tout marche : renomme index_fixed.html en index.html")
print("     (garde l'ancien index.html en .bak).")
print("  3. Déploie sur Netlify / Vercel / GitHub Pages.")