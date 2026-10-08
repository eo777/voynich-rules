/* Connection diagnostics use the FULL inventory, independent of chart cutoff.
 * A component/path explains graph connectivity; it never licenses transitive
 * translation. Preserve declared direction and explicit composite provenance.
 * Preview rule removals locally; commit only through the shared rule manager.
 */
(function(root){
  'use strict';
  const G=typeof module!=='undefined'&&module.exports?require('./graph_metrics.js'):root.EchoGraphMetrics;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function links(data,active){
    const out=[];
    // rules: every rule the code needs (a composed route needs all of them; removing any one removes the link)
    for(const e of data.edges)for(const code of e.rules)if(G.ruleLive(code,active))out.push({s:e.s,t:e.t,code,rules:G.ruleParts(code),forwardOnly:!!e.forwardOnly,via:null});
    for(const c of data.chains)if(active.has(c.rule))out.push({s:c.path[0],t:c.path[2],code:c.rule,rules:[c.rule],forwardOnly:false,via:c.path[1]});
    return out;
  }
  function adjacency(edges){
    const adj=new Map();
    for(const e of edges)for(const [a,b] of [[e.s,e.t],[e.t,e.s]]){if(!adj.has(a))adj.set(a,new Set());adj.get(a).add(b);}
    return adj;
  }
  function path(edges,start,end){
    if(start===end)return [];
    const adj=new Map();
    for(const e of edges)for(const [a,b] of [[e.s,e.t],[e.t,e.s]]){if(!adj.has(a))adj.set(a,[]);adj.get(a).push({word:b,edge:e});}
    const parents=new Map([[start,null]]),queue=[start];
    for(let i=0;i<queue.length;i++)for(const hop of adj.get(queue[i])||[])if(!parents.has(hop.word)){
      parents.set(hop.word,{from:queue[i],edge:hop.edge});queue.push(hop.word);
      if(hop.word===end){const result=[];for(let w=end;w!==start;){const p=parents.get(w);result.push({from:p.from,to:w,...p.edge});w=p.from;}return result.reverse();}
    }
    return null;
  }
  function analyze(data,active,word){
    const edges=links(data,active),members=G.closure([word],adjacency(edges));
    const incident=edges.filter(e=>e.s===word||e.t===word);
    const outgoing=new Set(incident.filter(e=>e.s===word).map(e=>e.t));
    const incoming=new Set(incident.filter(e=>e.t===word).map(e=>e.s));
    const scoped=edges.filter(e=>members.has(e.s));
    function impact(codes){
      const excluded=new Set(codes),gone=e=>e.rules.some(r=>excluded.has(r)),kept=scoped.filter(e=>!gone(e));
      const remaining=G.closure([word],adjacency(kept));
      const removed=scoped.filter(gone);
      const hubs=new Map();
      for(const e of removed){if(!hubs.has(e.t))hubs.set(e.t,new Set());hubs.get(e.t).add(e.s);}
      return {remaining:remaining.size,detached:members.size-remaining.size,links:removed.length,
        hubs:[...hubs].map(([w,s])=>({word:w,sources:s.size})).sort((a,b)=>b.sources-a.sources||a.word.localeCompare(b.word)).slice(0,2)};
    }
    const rules=data.rules.filter(r=>active.has(r.code)).map(r=>({...r,...impact([r.code])}));
    const groups=[...new Set(rules.map(r=>r.group))].map(group=>({group,codes:rules.filter(r=>r.group===group).map(r=>r.code)})).map(r=>({...r,...impact(r.codes)}));
    return {edges,members,incident,outgoing,incoming,rules,groups};
  }
  function open({data,word,active,apply,focus}){
    const initial=new Set(active),draft=new Set(active),info=new Map(data.rules.map(r=>[r.code,r]));
    const dialog=document.createElement('dialog');dialog.className='ci-dialog';
    dialog.innerHTML=`<header><h2>Connection inspector</h2><button class="wb-button" data-ci="close">Close</button></header>
      <div class="ci-controls"><label>Word <input aria-label="Inspect connections for word" value="${esc(word)}" size="12"></label><button class="wb-button" data-ci="inspect">Inspect</button><button class="wb-button" data-ci="focus">Show direct connections</button></div>
      <div class="ci-body"></div><footer><span class="wb-small" data-ci="pending"></span><button class="wb-button" data-ci="reset">Reset preview</button><button class="wb-button primary" data-ci="apply">Apply rule changes</button></footer>`;
    document.body.append(dialog);const close=()=>{dialog.close();dialog.remove();};
    dialog.querySelector('[data-ci="close"]').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
    const input=dialog.querySelector('input'),body=dialog.querySelector('.ci-body');let target='',model;
    // a composed route carries the weakest confidence of the rules it needs
    const badge=code=>{const tier=root.EchoRuleManager.weakest(G.ruleParts(code).map(c=>info.get(c)));return `<span class="rm-evidence rm-evidence-${tier}">${esc(code)} · ${root.EchoRuleManager.TIERS[tier]}</span>`;};
    const route=e=>`<b class="mono">${esc(e.s)} → ${esc(e.t)}</b> ${badge(e.code)}${e.via?` <small>via ${esc(e.via)} · declared composition</small>`:e.code.includes('+')?' <small>composed: needs every rule named</small>':e.code.includes('.')?' <small>declared step</small>':''}`;
    function renderPath(){
      const host=body.querySelector('.ci-path');if(!target){host.innerHTML='';return;}
      const p=path(model.edges,word,target);
      const direct=model.incident.some(e=>(e.s===word&&e.t===target)||(e.t===word&&e.s===target&&!e.forwardOnly));
      host.innerHTML=p===null?'<p>No connection under the preview rules.</p>':!p.length?'<p>Same spelling.</p>':`<p><b>${direct?'Direct declared pairing.':'Indirect connection only — no direct mapping.'}</b></p>${p.map(e=>`<div class="ci-route">${route(e)}</div>`).join('')}<p class="wb-small">Arrows show the recorded rule direction. This is one shortest connection path, not a sequence of permitted rewrites. Legacy pairings also allow reverse capacity; new candidates are forward only.</p>`;
    }
    function render(){
      model=analyze(data,draft,word);
      const known=G.vocabulary(data).has(word);
      const tier=root.EchoRuleManager.tier;
      const directList=out=>{
        const list=model.incident.filter(e=>out?e.s===word:e.t===word),groups=new Map();
        for(const e of list){const key=out?e.t:e.s;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e);}
        return [...groups].sort((a,b)=>a[0].localeCompare(b[0])).map(([w,es])=>`<div class="ci-route"><b class="mono">${esc(out?word:w)} → ${esc(out?w:word)}</b><div>${es.map(e=>badge(e.code)+(e.via?` <small>via ${esc(e.via)}</small>`:'')).join(' ')}</div></div>`).join('')||'<p class="wb-small">None.</p>';
      };
      const sorted=model.rules.sort((a,b)=>b.detached-a.detached||b.links-a.links);
      body.innerHTML=!known?'<p>Word not in the q-merged graph inventory.</p>':`<p class="ci-summary"><b>${model.outgoing.size}</b> forward destinations · <b>${model.incoming.size}</b> incoming forms · <b>${model.members.size}</b> connected forms</p>
        <p class="wb-small">Connected forms share rule paths; they are not equivalent words. Counts include forms below the chart cutoff.</p>
        <div class="ci-direct"><section><h3>Forward destinations · ${model.outgoing.size}</h3>${directList(true)}</section><section><h3>Incoming forms · ${model.incoming.size}</h3>${directList(false)}</section></div>
        <section><h3>Why are two words connected?</h3><input aria-label="Compare connected word" placeholder="e.g. shol" value="${esc(target)}" list="ciWords"><datalist id="ciWords">${[...model.members].sort().map(w=>`<option value="${esc(w)}">`).join('')}</datalist><div class="ci-path"></div></section>
        <section><h3>Which rules enlarge this component?</h3><p class="wb-small">“Disconnects” counts forms lost from ${esc(word)}’s component if that rule or family is removed alone. Overlapping rules can hide each other’s effect; uncheck several to compare together.</p>
        <div class="ci-family">${model.groups.map(g=>`<button class="wb-button" data-group="${esc(g.group)}" title="Preview disabling this family">− ${esc(g.group)} <b>${g.detached}</b></button>`).join('')}</div>
        <table class="ci-impact"><thead><tr><th>Active rule</th><th>Disconnects</th><th>Many-to-one outputs</th></tr></thead><tbody>${sorted.map(r=>`<tr><td><label><input type="checkbox" data-rule="${esc(r.code)}" checked aria-label="Preview ${esc(r.code)}">${badge(r.code)}</label></td><td><b>${r.detached}</b></td><td>${r.hubs.map(h=>`${esc(h.word)} ← ${h.sources}`).join(' · ')||'—'}</td></tr>`).join('')}</tbody></table>
        ${[...initial].filter(c=>!draft.has(c)).map(c=>`<button class="wb-button" data-restore="${esc(c)}">Restore ${esc(c)}</button>`).join(' ')}</section>`;
      dialog.querySelector('[data-ci="pending"]').textContent=`Preview: ${draft.size} active · ${initial.size-draft.size} disabled`;
      dialog.querySelector('[data-ci="apply"]').disabled=initial.size===draft.size;
      dialog.querySelector('[data-ci="focus"]').disabled=!known||initial.size!==draft.size;
      dialog.querySelector('[data-ci="focus"]').title=initial.size!==draft.size?'Apply or reset the preview before opening the active graph.':'';
      if(!known)return;
      body.querySelector('[aria-label="Compare connected word"]').oninput=e=>{target=e.target.value.trim().replace(/^q/,'');renderPath();};renderPath();
      body.querySelectorAll('[data-rule]').forEach(el=>el.onchange=()=>{draft.delete(el.dataset.rule);render();});
      body.querySelectorAll('[data-group]').forEach(el=>el.onclick=()=>{data.rules.filter(r=>r.group===el.dataset.group).forEach(r=>draft.delete(r.code));render();});
      body.querySelectorAll('[data-restore]').forEach(el=>el.onclick=()=>{draft.add(el.dataset.restore);render();});
    }
    function inspect(){word=input.value.trim().replace(/^q/,'');render();}
    dialog.querySelector('[data-ci="inspect"]').onclick=inspect;input.onkeydown=e=>{if(e.key==='Enter')inspect();};
    dialog.querySelector('[data-ci="focus"]').onclick=()=>{focus(word);close();};
    dialog.querySelector('[data-ci="reset"]').onclick=()=>{draft.clear();initial.forEach(c=>draft.add(c));render();};
    dialog.querySelector('[data-ci="apply"]').onclick=()=>{apply(new Set(draft));close();};
    render();dialog.showModal();
  }
  const api={links,path,analyze,open};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.EchoConnectionInspector=api;
})(typeof window!=='undefined'?window:globalThis);
