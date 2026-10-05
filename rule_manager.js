/* Additive research inventory and one shared active selection. Frozen JA1/LC1
 * bundles are never rewritten. New mappings are directed candidate menus;
 * their graph capacity is an upper bound, not a fitted occurrence policy. */
(function(root) {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // Evidence for a context selector does not establish its unconditional word
  // rewrite. Baseline membership alone also does not mean a rule is confirmed.
  const TIERS={published:'Published',supported:'Supported · partial',experimental:'Experimental / hypothesis',reference:'Evidence only'};
  const ORIGINAL_GROUPS={d:'Coda edits',ed:'Coda edits',B1:'Liquids',C1:'Liquids',C4:'Liquids',C3:'Compositions',S1:'Stage variants',S2:'Stage variants',S3:'Stage variants',S4:'Vowel shifts'};
  function tier(r){
    if(!r.executable)return 'reference';
    if(['d','ed'].includes(r.code))return 'published';
    if(['B1','C1','C3','C4','S1','S4','S4_COMPOSE','BG_PROJECT'].includes(r.code))return 'supported';
    return 'experimental';
  }
  function bulk(active,rows,enable){
    const next=new Set(active);
    for(const r of rows)if(r.executable){if(enable)next.add(r.code);else next.delete(r.code);}
    return next;
  }
  function merge(data, catalog) {
    const d={...data,rules:data.rules.map(r=>({...r,original:true,executable:true,group:ORIGINAL_GROUPS[r.code]||'Original inventory',evidence:r.sets.includes('E1')?'E1 baseline':'Stage inventory',summary:r.name,sources:['solve/botanical_enrichment/team_echo/redesign/RULE_INVENTORY.md'],default:r.code!=='S3'})),nodes:[...data.nodes],edges:[...data.edges],partners:{...data.partners}};
    const s3=d.rules.find(r=>r.code==='S3');
    if(s3)Object.assign(s3,{
      evidence:'Experimental comparator; excluded from the active baseline',
      summary:'Optional bench-loss comparison. Excluded from default, E1 and Published + supported selections because it joins otherwise separate families. C3 retains the bench and remains supported; the two rules have different outputs. Historical body-line evidence is retained below.',
      sources:[...s3.sources,'solve/botanical_enrichment/ECHO_RULES.md']
    });
    d.lex={...data.lex};
    const nodes=new Map(d.nodes.map(n=>[n.id,n]));
    function node(w) {
      if(nodes.has(w))return true;
      const counts=d.lex[w];if(!counts)return false;
      const count=Object.fromEntries(d.sections.map((s,i)=>[s.key,counts[i]]));
      const n={id:w,count,rate:Object.fromEntries(d.sections.map(s=>[s.key,count[s.key]*10000/s.N])),total:['HA_early','Hand1_late','HB_all'].reduce((v,k)=>v+count[k],0)};
      nodes.set(w,n);d.nodes.push(n);delete d.lex[w];return true;
    }
    for(const r of catalog.rules)if(r.executable) {
      d.rules.push(r);
      for(const [from,outputs] of Object.entries(catalog.known[r.code]||{})) for(const to of outputs) {
        if(node(from)&&node(to))d.edges.push({s:from,t:to,rules:[r.code],stage:['x'],label:from+' → '+to,forwardOnly:true});
        else {
          // Unattested outputs remain available to Translate's form scorer.
          d.partners[from]=[...(d.partners[from]||[]),{w:to,rules:[r.code],label:from+' → '+to,two:false,via:null}];
        }
      }
    }
    return d;
  }
  function selection(rules,saved) {
    const available=new Set(rules.filter(r=>r.executable).map(r=>r.code));
    return new Set((Array.isArray(saved)?saved:rules.filter(r=>r.default).map(r=>r.code)).filter(k=>available.has(k)));
  }
  function create({data,catalog,getActive,setActive,addToLab}) {
    const rules=[...data.rules,...catalog.rules.filter(r=>!r.executable)], key='echoActiveRules.v1';
    // Search the entire exported vocabulary, not just six illustrative pairs.
    const searchable=new Map(rules.map(r=>[r.code,(JSON.stringify(r)+' '+JSON.stringify(catalog.known[r.code]||{})).toLowerCase()]));
    function save(next) {setActive(next);try{localStorage.setItem(key,JSON.stringify([...next]));}catch(_){} }
    function mount(host,{close}={}) {
      let draft=new Set(getActive()), query='', filter='all', group='all', evidence='all', shown=[];
      const groups=[...new Set(rules.map(r=>r.group))];
      host.innerHTML=`<div class="rm-head"><div><h2>Rule manager</h2><span class="wb-small">Echo1–5 · reviewed ${catalog.reviewed}</span></div>${close?'<button class="wb-button" data-rm="cancel" aria-label="Close rule manager">Close</button>':''}</div>
        <div class="rm-toolbar"><input type="search" aria-label="Search rule inventory" placeholder="Search rule, word or finding"><select aria-label="Rule status"><option value="all">All entries</option><option value="active">Active</option><option value="executable">Word mappings</option><option value="research">Context & constructions</option></select><select aria-label="Rule family"><option value="all">All families</option>${groups.map(g=>`<option>${esc(g)}</option>`).join('')}</select></div>
        <div class="rm-presets"><label class="wb-small">Evidence <select aria-label="Evidence level"><option value="all">All levels</option>${Object.entries(TIERS).map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select></label><button class="wb-button" data-rm="enable">Enable shown</button><button class="wb-button" data-rm="disable">Disable shown</button><button class="wb-button" data-rm="remove-experimental">Remove all experimental</button></div>
        <details class="rm-preset-options"><summary>Replace active set / reset</summary><div class="rm-presets"><button class="wb-button" data-rm="original">Original view</button><button class="wb-button" data-rm="e1">E1</button><button class="wb-button" data-rm="supported">Published + supported</button><button class="wb-button" data-rm="all">All word mappings</button><button class="wb-button" data-rm="none">None</button><button class="wb-button" data-rm="reset">Undo pending changes</button></div></details>
        <div class="rm-list"></div><div class="rm-footer"><span class="wb-small" data-rm="count"></span><button class="wb-button primary" data-rm="apply">Apply selection</button></div>`;
      const list=host.querySelector('.rm-list');
      function render() {
        const rows=shown=rules.filter(r=>(group==='all'||r.group===group)&&(evidence==='all'||tier(r)===evidence)&&(filter==='all'||filter==='active'&&draft.has(r.code)||filter==='executable'&&r.executable||filter==='research'&&!r.executable)&&searchable.get(r.code).includes(query.toLowerCase()));
        list.innerHTML=rows.map(r=>{const docs=(r.sources||[]).map(s=>window.EchoDocs.link(s,esc(s.split('/').slice(-2).join('/'))+' ↗','wb-link')).filter(Boolean);return `<article class="rm-card rm-${tier(r)}"><div class="rm-title">${r.executable?`<input type="checkbox" aria-label="Enable ${esc(r.code)}" data-code="${r.code}" ${draft.has(r.code)?'checked':''}>`:'<span class="rm-dot" title="Evidence entry; requires a different execution model">◇</span>'}<div><b>${esc(r.code)}</b> ${esc(r.name)}<div class="rm-pattern">${esc(r.pattern)}</div></div><span class="rm-evidence rm-evidence-${tier(r)}" title="${esc(r.evidence)}. Published/supported describe correspondence evidence, not certainty of each translation.">${TIERS[tier(r)]}</span></div><details><summary>Scope & evidence${r.source_forms!=null?' · '+r.source_forms+' source forms':''}</summary><p><b>${esc(r.evidence)}</b> · ${esc(r.summary)}</p>${r.original?'<ul>'+[...(r.conditions||[]),...(r.status||[])].map(s=>'<li>'+esc(s)+'</li>').join('')+'</ul>':''}${r.executable?'<p class="wb-small">Active in Network, Sections and Translate. New candidates run forward only. Rule lab uses its own occurrence fractions; saved LC1 results stay fixed.</p>':`<p class="wb-small">Evidence entry only. Not executed by browser word mappings${docs.length?'; use the linked research implementation':''}.</p>`}${(r.examples||[]).map(([w,outs])=>`<div class="rm-example">${esc(w)} → ${esc(outs.join(' / '))}</div>`).join('')}${docs.join('<br>')}${r.executable?`<div class="wb-actions"><button class="wb-button" data-lab="${r.code}">Add to Rule lab</button></div>`:''}</details></article>`;}).join('')||'<p class="wb-empty">No matching rules.</p>';
        const experiments=rules.filter(r=>draft.has(r.code)&&tier(r)==='experimental').length;
        host.querySelector('[data-rm="count"]').textContent=`${draft.size} active · ${experiments} experimental · ${rows.length} shown. Applies to graph and Translate.`;
        for(const [action,on] of [['enable',false],['disable',true]]){
          const count=rows.filter(r=>r.executable&&draft.has(r.code)===on).length,b=host.querySelector(`[data-rm="${action}"]`);
          b.disabled=!count;b.textContent=`${action==='enable'?'Enable':'Disable'} shown (${count})`;
        }
        list.querySelectorAll('input[data-code]').forEach(el=>el.onchange=()=>{el.checked?draft.add(el.dataset.code):draft.delete(el.dataset.code);render();});
        list.querySelectorAll('[data-lab]').forEach(el=>el.onclick=()=>{addToLab(el.dataset.lab);close?.();});
      }
      host.querySelector('input[type="search"]').oninput=e=>{query=e.target.value;render();};
      host.querySelector('[aria-label="Rule status"]').onchange=e=>{filter=e.target.value;render();};
      host.querySelector('[aria-label="Rule family"]').onchange=e=>{group=e.target.value;render();};
      host.querySelector('[aria-label="Evidence level"]').onchange=e=>{evidence=e.target.value;render();};
      host.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{
        const action=b.dataset.rm;
        if(action==='cancel'){close?.();return;}
        if(action==='apply'){save(new Set(draft));if(close)close();else {render();host.querySelector('[data-rm="count"]').textContent=`Applied ${draft.size} active rules.`;}return;}
        if(action==='original')draft=selection(rules);
        else if(action==='e1')draft=new Set(data.rule_sets.E1);
        else if(action==='supported')draft=bulk(new Set(),rules.filter(r=>['published','supported'].includes(tier(r))),true);
        else if(action==='all')draft=bulk(new Set(),rules,true);
        else if(action==='enable'||action==='disable')draft=bulk(draft,shown,action==='enable');
        else if(action==='remove-experimental')draft=bulk(draft,rules.filter(r=>tier(r)==='experimental'),false);
        else if(action==='reset')draft=new Set(getActive());
        else if(action==='none')draft.clear();
        render();
      });
      render();
    }
    function open(afterClose) {
      const dialog=document.createElement('dialog');dialog.className='rm-dialog';
      document.body.append(dialog);const close=()=>{dialog.close();dialog.remove();afterClose?.();};
      dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
      mount(dialog,{close});dialog.showModal();
    }
    return {mount,open,apply:save,restore(){try{return selection(rules,JSON.parse(localStorage.getItem(key)));}catch(_){return selection(rules);}}};
  }
  const api={merge,selection,create,tier,bulk,TIERS};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.EchoRuleManager=api;
})(typeof window!=='undefined'?window:globalThis);
