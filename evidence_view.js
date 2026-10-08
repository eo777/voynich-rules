/* Fixed evidence layouts. Counts, rules and finite routes come from a versioned snapshot. */
(function(root){
  'use strict';
  const V=root.EchoEvidenceVisuals,M=root.EchoEvidenceMembers,F=root.EchoEvidenceFlow,E=root.EchoEvidenceCore,D=root.ECHO_EVIDENCE_DATA;
  E.validate(D);
  const state={study:D.studies[0].id,family:'ykaiin',target:'HB_all',policy:'all',common:true,basis:'stock',routes:'used',word:'',grouping:'gallows',allocation:'after',measure:'rate',focus:'',member:'',flowKind:'all',trail:[],flowPage:0,pair:'',chartScale:'fit',panel:'guide',patternMode:'pools',patternMin:10,patternTarget:'HB_all',patternMeasure:'rate',patternPooled:false,patternScale:'family',patternExpanded:'',patternPage:0,origin:''};
  let host;
  const panelScroll={guide:0,patterns:0,accounting:0};
  let guideVisited=false,pendingPanelScroll=null,guideDisclosures=new Set(),helpTarget=null,helpPopup=null;
  state.guideGrain='pools';
  Object.assign(state,{patternTolerance:1.25,patternSwapTolerance:.15,patternSparseMin:5,patternSort:'inversion-volume',patternOutcome:'all',patternGrowth:'all',patternChart:'charts',patternSparse:false,patternBranches:[],patternSelected:'',patternStack:[]});
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=v=>Number(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const delta=v=>(v>1e-7?'+':'')+n(Math.abs(v)<1e-7?0:v);
  const opt=(v,label,current)=>`<option value="${esc(v)}" ${v===current?'selected':''}>${esc(label)}</option>`;
  const study=()=>D.studies.find(s=>s.id===state.study)||D.studies[0];
  const options=()=>({policy:state.policy,common:state.common,basis:state.basis});
  const family=s=>s.families.find(f=>f.id===state.family)||s.families.find(f=>f.words.includes(state.family))||s.families[0];
  const cache=new Map();
  function totals(s,p){const key=[s.id,p,state.policy,state.common,state.basis].join('|');if(!cache.has(key))cache.set(key,E.totals(s,p,options()));return cache.get(key);}
  function view(){return {...state,trail:JSON.stringify(state.trail),patternBranches:JSON.stringify(state.patternBranches),patternStack:JSON.stringify(state.patternStack)};}
  function rememberPanel(){if(!host)return;panelScroll[state.panel]=host.scrollTop||0;if(state.panel==='guide')guideDisclosures=new Set([...host.querySelectorAll('[data-guide-disclosure][open]')].map(el=>el.dataset.guideDisclosure));}
  function navigate(patch){
    rememberPanel();
    if(root.history)root.history.replaceState(root.history.state,'','#'+root.EchoViewState.encode({tab:'evidence',...view()}));
    Object.assign(state,patch);render();host.scrollTop=panelScroll[state.panel]||0;
    if(root.history)root.history.pushState(null,'','#'+root.EchoViewState.encode({tab:'evidence',...view()}));
  }
  function hideHelp(){helpPopup?.remove();helpTarget?.removeAttribute('aria-describedby');helpPopup=null;helpTarget=null;}
  function bindHelp(){
    host.querySelectorAll('.eo-tag, [data-explorer-outcome]').forEach(el=>{
      const key=el.dataset.explorerOutcome||['inversionPlus','inversion','flat','converge','diverge'].find(k=>el.classList.contains('eo-'+k));
      if(!key||key==='all'||!root.EchoEvidenceOutcomes)return;
      el.dataset.evidenceHelp=root.EchoEvidenceOutcomes.explain(key,{minimum:state.panel==='guide'?10:state.patternMin,swapTolerance:state.panel==='guide'?.15:state.patternSwapTolerance});
      if(el.tagName==='SPAN')el.tabIndex=0;
      el.classList.add('ev-help');
    });
    const show=el=>{
      if(!el||helpTarget===el)return;hideHelp();helpTarget=el;
      const popup=document.createElement('div');popup.id='ev-tooltip';popup.className='ev-tooltip';popup.setAttribute('role','tooltip');popup.textContent=el.dataset.evidenceHelp;document.body.appendChild(popup);helpPopup=popup;el.setAttribute('aria-describedby',popup.id);
      const r=el.getBoundingClientRect(),p=popup.getBoundingClientRect();
      popup.style.left=Math.max(10,Math.min(root.innerWidth-p.width-10,r.left+r.width/2-p.width/2))+'px';
      popup.style.top=(r.bottom+p.height+12<root.innerHeight?r.bottom+8:Math.max(8,r.top-p.height-8))+'px';
    };
    host.querySelectorAll('[data-evidence-help]').forEach(el=>{
      el.addEventListener('pointerenter',()=>show(el));
      el.addEventListener('pointerleave',()=>{if(document.activeElement!==el)hideHelp();});
      el.addEventListener('focus',()=>show(el));
      el.addEventListener('blur',hideHelp);
      el.addEventListener('keydown',e=>{if(e.key==='Escape')hideHelp();else if(e.key==='Enter'&&el.tagName==='SPAN')show(el);});
    });
    host.onscroll=()=>hideHelp();
    host.onkeydown=e=>{if(e.key==='Escape')hideHelp();};
  }
  function resetFlow(){state.flowKind='all';state.trail=[];state.flowPage=0;state.pair='';state.grouping='gallows';state.focus='';}
  function applyView(p){
    const R=root.EchoViewState.read;
    if(host&&['guide','patterns','accounting'].includes(p.panel)&&p.panel!==state.panel){rememberPanel();pendingPanelScroll=panelScroll[p.panel]||0;}
    state.guideGrain=R.oneOf(p.guideGrain,['pools','prefixes','endings','pairs'])||state.guideGrain;
    for(const [key,values] of Object.entries({panel:['guide','patterns','accounting'],patternMode:['pools','prefixes','endings','pairs'],patternMeasure:['both','rate','adjusted','share'],patternScale:['family','global'],patternOutcome:['all','flat','converge','diverge','inversion','inversionPlus'],patternGrowth:['all','above','below'],patternChart:['charts','map'],origin:['patterns','example','manual']}))state[key]=R.oneOf(p[key],values)||state[key];
    state.patternMin=R.oneOf(Number(p.patternMin),[0,1,5,10,20])??state.patternMin;
    state.patternTolerance=R.oneOf(Number(p.patternTolerance),[1.1,1.2,1.25,1.3,1.5])??state.patternTolerance;
    state.patternSparse=R.flag(p.patternSparse)??state.patternSparse;
    state.patternSort=R.oneOf(p.patternSort,['inversion-volume','swap-error','absolute-error','observations','volume','name'])||state.patternSort;
    state.patternSparseMin=R.number(p.patternSparseMin,1,10000)??state.patternSparseMin;
    state.patternSwapTolerance=R.oneOf(Number(p.patternSwapTolerance),[.05,.1,.15,.2,.25])??state.patternSwapTolerance;
    state.patternSelected=R.text(p.patternSelected,220)||'';
    for(const k of ['patternBranches','patternStack']){try{const v=JSON.parse(p[k]||'[]');state[k]=Array.isArray(v)?v.filter(x=>typeof x==='string'&&x.startsWith('tree:')).slice(0,30):[];}catch{state[k]=[];}}
    state.patternTarget=R.oneOf(p.patternTarget,['HA_late','PharmaA','Hand1_late','HB_all'])||state.patternTarget;
    state.patternPooled=R.flag(p.patternPooled)??state.patternPooled;
    state.patternExpanded=R.text(p.patternExpanded,150)||'';
    state.patternPage=R.number(p.patternPage,0,100)||0;
    state.study=R.oneOf(p.study,D.studies.map(s=>s.id))||state.study;
    const s=study(),f=s.families.find(f=>f.id===p.family||f.words.includes(p.family));if(f)state.family=f.id;
    state.target=R.oneOf(p.target,s.sections.filter(x=>x.key!==s.source).map(x=>x.key))||state.target;
    state.policy=R.oneOf(p.policy,['all','o','none'])||state.policy;
    state.basis=R.oneOf(p.basis,['stock','signed'])||state.basis;
    state.routes=R.oneOf(p.routes,['used','all'])||state.routes;
    state.common=R.flag(p.common)??state.common;
    state.word=R.text(p.word,60)??'';
    state.focus=family(s).words.includes(p.focus)?p.focus:'';
    state.member=family(s).words.includes(p.member)?p.member:state.focus;
    state.flowKind=R.oneOf(p.flowKind,['all','swap','edited','kept'])||'all';
    state.flowPage=R.number(p.flowPage,0,1000)||0;
    state.pair=R.text(p.pair,140)||'';
    state.chartScale=R.oneOf(p.chartScale,['fit','actual'])||'fit';
    try{const ps=JSON.parse(p.trail||'[]');state.trail=Array.isArray(ps)?ps.slice(0,2).filter(x=>['gallows','endings'].includes(x.level)&&['swap','edited','kept'].includes(x.kind)&&typeof x.from==='string'&&typeof x.to==='string'):[];}catch{state.trail=[];}
    // Older links stored a tree disclosure separately from the selected ribbon.
    try{const ps=JSON.parse(p.expanded||'[]'),key=Array.isArray(ps)&&ps.find(x=>typeof x==='string'&&x.startsWith('ending|'));if(key&&state.trail.length===1){const [,kind,from,to]=key.split('|');if(['swap','edited','kept'].includes(kind)&&from&&to)state.trail.push({level:'endings',kind,from,to});}}catch{}
    for(const [key,values] of Object.entries({grouping:['gallows','endings','words'],allocation:['before','after'],measure:['rate','share']}))state[key]=R.oneOf(p[key],values)||state[key];
  }
  function jump(word,inspect=false){const f=study().families.find(f=>f.words.includes(word));if(f){state.family=f.id;state.word=inspect?word:'';state.member=word;state.routes=inspect?'all':'used';resetFlow();render(inspect?'ev-members-anchor':'');}}
  function countCell(s,w,p){const c=s.words[w]?.count[p]||0,N=s.sections.find(x=>x.key===p).N;return `${c}<small>${n(c*10000/N)} / 10k</small>`;}
  function bars(s,f){
    return `<div class="ev-scroll"><table class="ev-table ev-ratios"><caption>Family <code>${esc(f.id)}</code></caption><thead><tr><th>Population / all tokens</th><th>K / T share</th><th>K counts<br><small>rate / 10k</small></th><th>T counts<br><small>rate / 10k</small></th><th>K/T</th><th>Total K+T<br><small>rate / 10k</small></th><th>Added coverage<br><small>vs early A / 10k</small></th></tr></thead><tbody>${s.sections.map(p=>{
      const r=E.ratio(s,f,p.key),q=p.key===s.source?null:E.compare(s,f,p.key,options());
      const label=r.share===null?'No observations':`${n(r.share*100)}% K / ${n((1-r.share)*100)}% T`;
      return `<tr class="${p.key===state.target?'ev-selected':''}"><th>${esc(p.label)}<small>N = ${p.N.toLocaleString()}</small></th><td><div class="ev-bar" role="img" aria-label="${label}">${r.share===null?'':`<span class="ev-k" style="width:${100*r.share}%"></span><span class="ev-t" style="width:${100*(1-r.share)}%"></span>`}</div><small>${label}</small></td><td>${r.k}<small>${n(r.kRate)}</small></td><td>${r.t}<small>${n(r.tRate)}</small></td><td>${r.t?n(r.ratio):r.k?'∞':'—'}</td><td>${n(r.totalRate)}</td><td>${q?delta(q.gain):'Source'}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  }
  function detail(s,r,compact=false){
    if(!r.steps.length)return '<p>The spelling stays the same.</p>';
    const rows=[];for(const step of r.steps){
      const chain=[step.source,...step.middles,step.target];
      rows.push(`<div class="ev-step"><b title="${esc(step.rule)}">${step.rule==='KT_CORR'?'Exchange':esc(step.rule)}</b><span>${chain.map(w=>`<code>${esc(w)}</code>`).join(' → ')}</span></div>`);
    }
    const ws=[...new Set(r.steps.flatMap(step=>[step.source,...step.middles,step.target]))];
    if(compact){
      const sections=[s.sections.find(p=>p.key===s.source),s.sections.find(p=>p.key===state.target),...s.sections.filter(p=>p.key!==s.source&&p.key!==state.target)];
      return `${rows.join('')}<p>These are rule steps, not an established historical path. The source and selected target appear first below.</p><div class="ev-scroll"><table class="ev-table"><thead><tr><th>Section</th>${ws.map(w=>`<th><code>${esc(w)}</code></th>`).join('')}</tr></thead><tbody>${sections.map(p=>`<tr class="${p.key===state.target?'ev-selected':''}"><th>${esc(V.label(p.key))}</th>${ws.map(w=>`<td>${countCell(s,w,p.key)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }
    return `${rows.join('')}<p>These steps describe the rule. They do not establish a historical path through late A or Pharma.</p><div class="ev-scroll"><table class="ev-table"><thead><tr><th>Spelling</th>${s.sections.map(p=>`<th>${esc(p.label)}</th>`).join('')}</tr></thead><tbody>${ws.map(w=>`<tr><th><code>${esc(w)}</code></th>${s.sections.map(p=>`<td>${countCell(s,w,p.key)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function routeTable(s,f,c){
    const candidates=f.routes.filter(r=>E.admissible(s,r,state.target,state.policy,state.routes==='all'?false:state.common));
    const rows=candidates.filter(r=>(!state.word||r.source===state.word||r.target===state.word)&&(state.routes==='all'||(c.used.get(r.source+'>'+r.target)||0)>1e-8||(c.baseUsed.get(r.source+'>'+r.target)||0)>1e-8))
      .sort((a,b)=>Number(b.exchange)-Number(a.exchange)||(c.used.get(b.source+'>'+b.target)||0)-(c.used.get(a.source+'>'+a.target)||0)||a.source.localeCompare(b.source)||a.target.localeCompare(b.target));
    return `<p class="ev-note">The view displays ${rows.length} of ${candidates.length} candidate pairs. Filters change only the display.</p><details class="ev-route-help"><summary>Definitions</summary><p>Swap marks an added t → k route. Kept preserves the spelling. Other rule uses the baseline edits.</p><p>Unattested means the target has no observations. Below minimum means the source or target has fewer than three observations, so the added exchange cannot receive mass while the minimum is enabled.</p><p>All candidates includes blocked exchanges. All ${f.words.length} spellings share the same limits. The amounts show one optimal allocation. They are not separate rule benefits.</p></details><div class="ev-route-list">${rows.map(r=>{
      const key=r.source+'>'+r.target,b=c.baseUsed.get(key)||0,a=c.used.get(key)||0,empty=!s.words[r.target].count[state.target];
      const blocked=!E.admissible(s,r,state.target,state.policy,state.common);
      return `<details class="ev-route ${r.exchange?'ev-exchange':''}"><summary><span class="ev-pair"><code>${esc(r.source)}</code> → <code>${esc(r.target)}</code><small>${r.exchange?'Swap':r.source===r.target?'Kept':'Other rule'}${empty?' · Unattested':''}${blocked?' · Below minimum':''}</small></span><span class="ev-trace-label">${r.steps.map(x=>esc(x.rule)).join(' + ')||'Identity'}</span><span class="ev-route-flow">${n(b)} → <b>${n(a)}</b><small>allocated / 10k</small></span></summary><div class="ev-route-body">${detail(s,r)}</div></details>`;
    }).join('')||'<p>No routes match this display filter. Try all candidates or clear the word filter.</p>'}</div>`;
  }
  function ledger(s,f,c){
    const a=E.rates(s,f,s.source),b=E.rates(s,f,state.target),ds=new Map(c.destinations.map(d=>[d.word,d]));
    return `<div class="ev-scroll"><table class="ev-table"><thead><tr><th>Spelling</th>${s.sections.map(p=>`<th>${esc(p.label)}<br><small>count / rate per 10k</small></th>`).join('')}<th>Target covered<br><small>before → after / 10k</small></th><th>Target unfilled<br><small>after / 10k</small></th></tr></thead><tbody>${f.words.map(w=>{
      const d=ds.get(w),id=state.basis==='signed'?Math.min(a.get(w),b.get(w)):0;
      return `<tr><th><code>${esc(w)}</code></th>${s.sections.map(p=>`<td>${countCell(s,w,p.key)}</td>`).join('')}<td>${n(d.before+id)} → ${n(d.after+id)}</td><td>${n(Math.max(0,b.get(w)-d.after-id))}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  }
  function download(s,f,c){
    const clean=z=>({credit:z.credit,source:z.source,target:z.target,unfilled:z.unfilled,unplaced:z.unplaced,routes:z.routes,legalRoutes:z.edges});
    const out={schema:1,study:s.id,selection:view(),scope:s.scope,menu:s.menu,accounting:s.accounting,sections:s.sections,family:f.id,
      words:Object.fromEntries(f.words.map(w=>[w,s.words[w]])),gain:c.gain,baseline:clean(c.base),withExchange:clean(c.withRule)};
    const url=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`echo-evidence-${f.id}-${state.target}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function destinationChanges(s,f,c){
    const rates=E.rates(s,f,state.target),rows=c.destinations.map(d=>({...d,change:d.after-d.before})).filter(d=>Math.abs(d.change)>1e-7).sort((a,b)=>Math.abs(b.change)-Math.abs(a.change)||a.word.localeCompare(b.word));
    const max=Math.max(1,...rows.map(d=>Math.abs(d.change)));
    const list=rs=>rs.map(d=>`<div class="ev-destination-row"><code>${esc(d.word)}</code><span class="ev-destination-bar"><i class="${d.change<0?'loss':'gain'}" style="width:${100*Math.abs(d.change)/max}%"></i></span><b>${delta(d.change)}</b><small>${n(rates.get(d.word))} observed</small></div>`).join('');
    return `<div class="ev-destination-changes"><h4>Gains and losses</h4><p>Adding exchange changes the coverage of these ${V.label(state.target)} spellings, per 10,000 words. This comparison remains visible when the flow shows existing rules.</p>${rows.length?list(rows.slice(0,6)):'<p>No destination gains or loses coverage.</p>'}${rows.length>6?`<details><summary>All ${rows.length} changed destinations</summary>${list(rows.slice(6))}</details>`:''}<p class="ev-destination-total">${n(c.grossGain)} gained − ${n(c.loss)} lost = ${n(c.gain)} net repair</p></div>`;
  }
  function accountingControls(s,f,c){
    const alternate=E.compare(s,f,state.target,{...options(),basis:state.basis==='stock'?'signed':'stock'});
    const same=Math.abs(alternate.gain-c.gain)<1e-7&&Math.abs(alternate.withRule.credit-c.withRule.credit)<1e-7;
    const routes=f.routes.filter(r=>r.exchange&&E.admissible(s,r,state.target,'all',state.common));
    return `<details class="ev-settings" data-detail="controls"><summary>Rule settings</summary><div class="ev-settings-body"><label>Exchange rule<select id="ev-policy">${opt('all','t → k',state.policy)}${opt('o','t → k after o',state.policy)}${opt('none','None',state.policy)}</select></label><label class="ev-check"><input type="checkbox" id="ev-common" ${state.common?'checked':''}> Require 3 observations at both ends of an exchange</label><p>${routes.length&&!routes.some(r=>!r.after_o)?'Every eligible exchange in this family already follows o. The two exchange rules therefore permit the same routes.':'The o restriction tests the original early-A source. It can exclude exchanges in other prefixes.'}</p><label>Allocation method<select id="ev-basis">${opt('stock','Use full frequencies',state.basis)}${opt('signed','Reserve shared spellings first',state.basis)}</select></label><p>${same?'Both allocation methods give the same result for this family and these settings.':`The other method gives ${n(alternate.gain)} net repair per 10,000 words.`} The second method reserves identical spellings before allocating the remaining frequency.</p></div></details>`;
  }
  function render(anchor=''){
    if(!host)return;
    hideHelp();
    const scrollTop=host.scrollTop,flowScroll=host.querySelector('[data-flow-scroll]')?.scrollTop||0,flowLeft=host.querySelector('[data-flow-scroll]')?.scrollLeft||0;
    const memberOpens=new Set([...host.querySelectorAll('[data-member-detail][open]')].map(el=>el.dataset.memberDetail));
    const patternOpens=new Set([...host.querySelectorAll('[data-pattern-disclosure][open]')].map(el=>el.dataset.patternDisclosure));
    const opened=new Set([...host.querySelectorAll('[data-detail][open]')].map(el=>el.dataset.detail)),open=id=>opened.has(id)?'open':'';
    const s=study(),f=family(s);state.family=f.id;
    const nav=`<nav class="ep-view-tabs ev-kt-views" aria-label="K/T views"><button data-evidence-panel="guide" aria-pressed="${state.panel==='guide'}">Guide</button><button data-evidence-panel="patterns" aria-pressed="${state.panel==='patterns'}">Compare families</button>${state.panel!=='guide'&&guideVisited?'<button class="ev-guide-back" data-evidence-panel="guide">← Back to guide</button>':''}</nav>`;
    const heading=`<header class="ev-heading ef-heading"><h2>Evidence</h2><nav class="ep-view-tabs" aria-label="Evidence topics"><button aria-pressed="true">K/T</button></nav><div class="ev-actions"><button class="wb-button" data-share="tab">Copy view link</button></div></header>`;
    const bindPanels=()=>{bindHelp();host.querySelectorAll('[data-evidence-panel]').forEach(b=>b.onclick=()=>navigate({panel:b.dataset.evidencePanel}));};
    if(state.panel==='guide'&&root.EchoEvidenceGuide){
      guideVisited=true;
      host.innerHTML=`<div class="ev-wrap">${heading}${nav}${root.EchoEvidenceGuide.html(s,state)}</div>`;
      bindPanels();
      root.EchoEvidenceGuide.bind(host,s,state,patch=>navigate({...patch,panel:'patterns'}),()=>render());
      host.querySelectorAll('[data-guide-disclosure]').forEach(el=>{el.open=guideDisclosures.has(el.dataset.guideDisclosure);});
      host.querySelectorAll('[data-pattern-disclosure]').forEach(el=>{el.open=patternOpens.has(el.dataset.patternDisclosure);});
      host.scrollTop=scrollTop;
      return;
    }
    if(state.panel==='patterns'){
      const patterns=root.EchoEvidenceExplorer||root.EchoEvidencePatterns;
      host.innerHTML=`<div class="ev-wrap">${heading}${nav}${patterns.html(s,state)}</div>`;
      bindPanels();
      host.querySelectorAll('[data-pattern-disclosure]').forEach(el=>{el.open=patternOpens.has(el.dataset.patternDisclosure);});
      patterns.bind(host,s,state,()=>render(),fid=>{state.family=fid;state.target=state.patternTarget;state.panel='accounting';state.origin='patterns';state.member='';resetFlow();render();host.scrollTop=0;});
      host.scrollTop=scrollTop;
      return;
    }
    const t=totals(s,state.target),c=t.families.find(x=>x.id===f.id),ranked=[...t.families].sort((a,b)=>a.id.localeCompare(b.id));
    const canvasWidth=host.querySelector('.ev-hierarchy-scroll')?.clientWidth||Math.max(600,Math.min(1380,(host.clientWidth||1200)-56)-48);
    const d=M.describe(s,f),flow=F.render(s,f,c,{...state,canvasWidth},(s,r)=>detail(s,r,true)),finding=V.finding(s,f,c,state,t);
    const examples={
      clear:['ykaiin / ytaiin','T is more frequent in early Herbal A. K is more frequent in Herbal B. The ratio does not closely mirror early A.'],
      pooled:['otol / otchy','Overlapping transformations let these source words reach some of the same targets.'],
      qo:['qok* / qot*','This group supplies nearly half the net Herbal B frequency repair under the example settings.'],
      contrary:['tchol / kchol','Herbal B has no kchol, so this particular t → k candidate cannot add a match.']
    };
    const example=state.origin==='example'?s.examples.find(x=>f.words.includes(x.word)):null,exampleText=example?examples[example.id]?.[1]:'';
    const presetMatches=x=>state.origin==='example'&&f.words.includes(x.word)&&state.target===(x.id==='pooled'?'PharmaA':'HB_all')&&state.policy==='all'&&state.common&&state.basis==='stock';
    const customized=example&&!presetMatches(example);
    const notes={
      clear:'This example contains only ykaiin and ytaiin. Their counts are small, so the ratio reversal needs that context.',
      pooled:'This example selects Pharma and the complete pool named okal: 51 spellings, including otol and otchy. These sources stay together because their permitted transformations reach some of the same targets.',
      qo:'This example tests whether a large family dominates the result. Compare its gain with the whole-study totals shown below the section chart.',
      contrary:'This example separates a permitted spelling edit from an attested match. The family remains available, but the specific tchol → kchol route has no Herbal B endpoint.'
    };
    const gainText=state.policy==='none'?'No exchange is selected, so the two calculations use the same rules.':`The ${state.policy==='o'?'t → k after o':'t → k'} option repairs ${n(c.gain)} more of the ${V.label(state.target)} frequency gap than the existing rules.`;
    const swapMass=F.witness(s,f,c,{...state,allocation:'after'}).filter(r=>r.kind==='swap').reduce((n,r)=>n+r.mass,0);
    host.innerHTML=`<div class="ev-wrap"><div class="ev-introduction"><header class="ev-heading"><h2>Family accounting</h2><div class="ev-actions"><button class="wb-button" data-share="tab">Copy view link</button><button class="wb-button" id="ev-export">Export accounting</button></div></header>${nav}
      <div class="ev-purpose"><p>These examples test whether adding <code>t → k</code> routes helps the existing rules account for later word frequencies. Each selects a complete pool and a later section. Increased coverage does not establish reciprocal inversion. Compare families in the other view to assess that separate claim.</p></div>
      <nav class="ev-cases" aria-label="Family examples">${s.examples.map((x,i)=>`<button data-example="${i}" aria-pressed="${presetMatches(x)}"><span>${esc(examples[x.id]?.[0]||x.word)}</span><small>${esc(examples[x.id]?.[1]||x.text)}</small></button>`).join('')}</nav>
      </div>
      <div class="ev-selection-bar" aria-label="Selected pool and comparison"><strong>${root.EchoEvidencePatterns?.label(s,f)||esc(f.id)}</strong><span>Pool ID <code>${esc(f.id)}</code></span><span>${f.words.length} spellings</span><span>Early A → ${esc(V.label(state.target))}</span></div>
      <section class="ev-chapter" id="ev-members-anchor" tabindex="-1"><div class="ev-section-title"><h3>1 · Family members</h3><span>${f.words.length} spellings</span></div>
      <div class="ev-family-bar"><label>Family<select id="ev-family">${ranked.map(r=>opt(r.id,r.id,f.id)).join('')}</select></label><div class="ev-search"><label for="ev-find">Find a word</label><input id="ev-find" type="search" placeholder="e.g. otchy" list="ev-words" autocomplete="off"><datalist id="ev-words">${Object.keys(s.words).sort().map(w=>`<option value="${esc(w)}"></option>`).join('')}</datalist><button class="wb-button" id="ev-go">Find</button></div><span id="ev-find-status" role="status"></span></div>
      ${example? `<p class="ev-chapter-note">${customized?`You have changed the ${esc(examples[example.id]?.[0]||example.word)} example settings. The charts now compare early Herbal A with ${esc(V.label(state.target))}. Select its example button to restore the original comparison.`:esc(notes[example.id]||exampleText)}</p>`:''}
      ${M.html(s,f,{member:state.member,comparison:c,target:state.target,allocation:state.allocation,policy:state.policy,common:state.common,basis:state.basis})}</section>
      <section class="ev-chapter"><div class="ev-section-title"><h3>2 · Observed frequencies</h3></div><p class="ev-chapter-note">Compare <code>${esc(d.kLabel)}</code> with <code>${esc(d.tLabel)}</code> across sections. Select a later section below to use it in the rule comparison.</p>
      ${V.sections(s,f,state,d)}<p class="ev-observation">${esc(finding.observation)}</p>${example?.id==='qo'?studyBars(s,t):''}</section>
      <section class="ev-chapter" id="ev-comparison-anchor" tabindex="-1"><div class="ev-section-title"><h3>3 · Rule comparison</h3><span>Early A → ${V.label(state.target)}</span></div>
      <div class="ev-result" role="status"><p>${gainText}</p><div class="ev-result-numbers"><div class="ev-result-gain"><span>Net frequency repair</span><b>${delta(c.gain)}</b><small>per 10,000 words</small></div><div><span>${V.label(state.target)} gap</span><b>${n(c.base.unfilled)} → ${n(c.withRule.unfilled)}</b><small>existing rules → with exchange</small></div><div><span>Early-A frequency left</span><b>${n(c.base.unplaced)} → ${n(c.withRule.unplaced)}</b><small>existing rules → with exchange</small></div></div><p class="ev-limit">More permissive rules can always increase coverage. The gain is a capacity check, not proof of a swap. The observed ratios and the destinations that gain or lose must also support the proposed change.</p></div>
      ${destinationChanges(s,f,c)}
      ${accountingControls(s,f,c)}
      <figure id="ev-flow-anchor" class="ev-flow-anchor" tabindex="-1"><figcaption><h4>Family flow</h4><p>The flow compares early A with ${V.label(state.target)}. Every route shares the same source and target limits. Expand a ribbon to see its endings, then its words.</p>${swapMass>c.gain+1e-7?`<p>The exchange routes carry ${n(swapMass)}, but replace ${n(swapMass-c.gain)} already covered by existing rules. Their net repair is ${n(c.gain)} per 10,000.</p>`:''}</figcaption><div class="ev-flow-toolbar">${V.seg('allocation',[['before','Existing rules'],['after','With exchange']],state.allocation)}<details class="ev-word-tools"><summary>Highlight a word</summary><label>Spelling<select id="ev-focus">${opt('','All members',state.focus)}${f.words.map(w=>opt(w,w,state.focus)).join('')}</select></label></details></div>${flow.html}</figure></section>
      <div class="ev-evidence-details"><details class="ev-details" data-detail="counts" ${open('counts')}><summary>Full counts and ratios</summary>${bars(s,f)}</details>
      <details class="ev-details" data-detail="routes" ${open('routes')}><summary>Candidate routes</summary><div class="ev-controls"><label>Show<select id="ev-routes">${opt('used','Allocated',state.routes)}${opt('all','All candidates',state.routes)}</select></label><label>Word<select id="ev-word">${opt('','All',state.word)}${f.words.map(w=>opt(w,w,state.word)).join('')}</select></label></div><p>Values show the baseline followed by the exchange, in units per 10,000 words.</p>${routeTable(s,f,c)}</details>
      <details class="ev-details" data-detail="ledger" ${open('ledger')}><summary>Full spelling ledger</summary>${ledger(s,f,c)}<p>The source contains ${n(c.base.source)} units and the target contains ${n(c.base.target)} units. The exchange leaves ${n(c.withRule.unplaced)} source units and ${n(c.withRule.unfilled)} target units unmatched.</p></details>
      <details class="ev-details" data-detail="study" ${open('study')}><summary>Whole-study comparison</summary>${studyBars(s,t)}</details>
      <details class="ev-details" data-detail="method" ${open('method')}><summary>Method and rules</summary><p>The existing rules account for ${n(c.base.credit)} of the target frequency. With the selected exchange they account for ${n(c.withRule.credit)}. The difference is ${n(c.gain)}, all per 10,000 words.</p><label>Study<select id="ev-study">${D.studies.map(x=>opt(x.id,'Ordinary k/t words',state.study)).join('')}</select></label>${V.method(s,f,c)}${V.ruleKey()}</details></div></div>`;
    host.querySelectorAll('[data-member-detail]').forEach(el=>{if(memberOpens.has(el.dataset.memberDetail))el.open=true;});
    bindPanels();
    host.querySelectorAll('[data-detail]').forEach(el=>{if(opened.has(el.dataset.detail))el.open=true;});
    const bind=(id,key,where='')=>{host.querySelector('#'+id).onchange=e=>{state[key]=e.target.type==='checkbox'?e.target.checked:e.target.value;if(['target','policy','common','basis'].includes(key)){state.pair='';state.flowPage=0;}render(where);};};
    for(const [id,key] of [['ev-policy','policy'],['ev-basis','basis'],['ev-common','common']])bind(id,key,'ev-comparison-anchor');
    for(const [id,key] of [['ev-routes','routes'],['ev-word','word']])bind(id,key);
    host.querySelector('#ev-focus').onchange=e=>{state.focus=e.target.value;state.pair='';state.flowKind='all';render();};
    host.querySelector('#ev-study').onchange=e=>{state.study=e.target.value;state.family=study().families[0].id;state.word='';state.member='';resetFlow();render('ev-members-anchor');};
    host.querySelector('#ev-family').onchange=e=>{state.family=e.target.value;state.origin='manual';state.word='';state.member='';resetFlow();render('ev-members-anchor');};
    host.querySelectorAll('[data-member]').forEach(b=>b.onclick=()=>{state.member=b.dataset.member;render('ev-members-anchor');});
    host.querySelectorAll('[data-example]').forEach(b=>b.onclick=()=>{const x=s.examples[Number(b.dataset.example)];state.origin='example';state.target=x.id==='pooled'?'PharmaA':'HB_all';state.policy='all';state.common=true;state.basis='stock';state.allocation='after';state.measure='rate';jump(x.id==='pooled'?'otol':x.word,false);});
    host.querySelectorAll('[data-target]').forEach(b=>b.onclick=()=>{state.target=b.dataset.target;state.pair='';render('ev-comparison-anchor');});
    host.querySelectorAll('[data-setting]').forEach(b=>b.onclick=()=>{state[b.dataset.setting]=b.dataset.value;state.pair='';render(b.dataset.setting==='allocation'?'ev-flow-anchor':'');});
    host.querySelectorAll('[data-drill]').forEach(b=>{b.onclick=()=>{const x=flow.actions[Number(b.dataset.drill)],p={level:x.level,kind:x.kind,from:x.from,to:x.to};if(x.level==='words')state.pair=x.from+'>'+x.to;else{state.pair='';state.trail=x.level==='gallows'?[p]:[state.trail[0],p];}render();};b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();b.onclick();}};});
    host.querySelectorAll('[data-flow-collapse-to]').forEach(b=>b.onclick=()=>{state.trail=b.dataset.flowCollapseTo==='endings'?state.trail.slice(0,1):[];state.pair='';render();});
    host.querySelectorAll('[data-flow-close-pair]').forEach(b=>b.onclick=()=>{state.pair='';render();});
    host.querySelectorAll('[data-flow-scale]').forEach(b=>b.onclick=()=>{state.chartScale=b.dataset.flowScale;render();});
    host.querySelectorAll('[data-flow-reset]').forEach(b=>b.onclick=()=>{state.flowKind='all';state.focus='';state.trail=[];state.pair='';render();});
    host.querySelectorAll('[data-flow-kind]').forEach(b=>b.onclick=()=>{state.flowKind=state.flowKind===b.dataset.flowKind?'all':b.dataset.flowKind;state.trail=[];state.pair='';render();});
    host.querySelectorAll('[data-flow-unfocus]').forEach(b=>b.onclick=()=>{state.focus='';state.pair='';state.flowPage=0;render('ev-flow-anchor');});
    const find=()=>{const w=host.querySelector('#ev-find').value.trim();if(s.families.some(f=>f.words.includes(w)))jump(w,true);else host.querySelector('#ev-find-status').textContent='This spelling is not in the study.';};
    host.querySelector('#ev-go').onclick=find;host.querySelector('#ev-find').onkeydown=e=>{if(e.key==='Enter')find();};host.querySelector('#ev-export').onclick=()=>download(s,f,c);
    host.scrollTop=scrollTop;
    const pane=host.querySelector('[data-flow-scroll]');if(pane){pane.scrollTop=flowScroll;pane.scrollLeft=flowLeft;}
  }
  function studyBars(s,t){return `<div class="ev-study-summary"><p>The selected section gains ${n(t.gain)} matches per 10,000 words across ${t.positive} of ${s.families.length} families. Removing the largest contributors tests how broadly that gain is distributed.</p><div class="ev-study-bars">${[['All families',t.gain],['Without the largest',t.withoutLargest],['Without the five largest',t.withoutFive]].map(([name,value])=>`<div><span>${name}</span><i style="width:${t.gain>0?value/t.gain*50:0}%"></i><b>${delta(value)}</b></div>`).join('')}</div></div>`;}
  root.EchoEvidence={show(el){host=el;render();if(pendingPanelScroll!==null){host.scrollTop=pendingPanelScroll;pendingPanelScroll=null;}},view,applyView};
})(window);
