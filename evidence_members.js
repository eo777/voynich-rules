/* Read-only spelling membership and candidate routes. This module never allocates mass. */
(function(root){
  'use strict';
  const E=typeof module!=='undefined'&&module.exports?require('./evidence_core.js'):root.EchoEvidenceCore;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=v=>Number(v).toLocaleString('en-US',{maximumFractionDigits:2});
  const section=s=>({HA_early:'early Herbal A',HA_late:'late Herbal A',PharmaA:'Pharma',Hand1_late:'late A + Pharma',HB_all:'Herbal B'}[s]||s);
  function ending(t){
    // Bench identity is deliberately retained. The tree never joins ch and sh.
    const ch=t.includes('ch'),sh=t.includes('sh');
    if(ch&&sh)return 'ch and sh';if(ch)return 'ch endings';if(sh)return 'sh endings';
    if(t.startsWith('ee'))return 'ee endings';
    if(/^(eol|eor)$/.test(t))return 'eol / eor';
    if(/^(ol|or)$/.test(t))return 'ol / or';
    if(/^(ar|al)$/.test(t))return 'ar / al';
    if(/^(y|dy)$/.test(t))return 'y / dy';
    if(t==='edy')return 'edy';
    return 'Other endings';
  }
  function describe(s,f){
    const parent=new Map(f.words.map(w=>[w,w]));
    function find(w){while(parent.get(w)!==w){parent.set(w,parent.get(parent.get(w)));w=parent.get(w);}return w;}
    for(const r of f.routes){if(r.source===r.target)continue;if(!parent.has(r.source)||!parent.has(r.target))continue;parent.set(find(r.source),find(r.target));}
    const sets=new Map();for(const w of f.words){const key=find(w);if(!sets.has(key))sets.set(key,[]);sets.get(key).push(w);}
    const components=[...sets.values()].map(ws=>ws.sort()).sort((a,b)=>b.length-a.length||a[0].localeCompare(b[0]));
    const isolated=components.filter(ws=>ws.length===1).map(ws=>ws[0]),isolateSet=new Set(isolated),componentOf={};
    components.forEach((ws,i)=>ws.forEach(w=>componentOf[w]=i));
    const branches=new Map();
    for(const w of f.words){const x=s.words[w],stem=x.prefix+x.g,key=stem;
      if(!branches.has(key))branches.set(key,{id:key,g:x.g,prefix:x.prefix,stem,words:[],endings:new Map()});
      const b=branches.get(key),end=ending(x.tail);b.words.push(w);
      if(!b.endings.has(end))b.endings.set(end,[]);b.endings.get(end).push(w);
    }
    const groups=[...branches.values()].sort((a,b)=>a.prefix.localeCompare(b.prefix)||a.g.localeCompare(b.g)).map(b=>({...b,
      label:b.words.length===1?b.words[0]:b.stem+'*',
      endings:[...b.endings].map(([label,words])=>({label,words:words.sort()})).sort((a,b)=>a.label.localeCompare(b.label))}));
    function label(g){const ws=f.words.filter(w=>s.words[w].g===g);if(!ws.length)return 'No '+g+' spellings';if(ws.length===1)return ws[0];
      const stems=[...new Set(ws.map(w=>s.words[w].prefix+g))].sort();return stems.length<=4?stems.map(x=>x+'*').join(' / '):g.toUpperCase()+' in '+stems.length+' prefixes';}
    return {id:f.id,words:[...f.words],kLabel:label('k'),tLabel:label('t'),groups,components,componentOf,isolated,isolateSet};
  }
  function connections(s,f,member,{comparison=null,target='',allocation='after',policy='all',common=true,basis='stock'}={}){
    const z=comparison?(allocation==='before'?comparison.base:comparison.withRule):null;
    const used=new Map((z?.routes||[]).map(r=>[r.from+'>'+r.to,r.mass]));
    const allowed=z?new Set(z.edges.map(r=>r.source+'>'+r.target)):null;
    return f.routes.filter(r=>r.source===member||r.target===member).map(r=>{
      const key=r.source+'>'+r.target;
      let mass=used.get(key)||0;
      if(z&&basis==='signed'&&r.source===r.target&&target){
        const a=s.sections.find(p=>p.key===s.source).N,b=s.sections.find(p=>p.key===target).N;
        mass+=Math.min(s.words[r.source].count[s.source]*10000/a,s.words[r.target].count[target]*10000/b);
      }
      const eligible=allowed?allowed.has(key):target?E.admissible(s,r,target,allocation==='before'?'none':policy,common):true;
      let status=mass>1e-7?'allocated':target&&s.words[r.target].count[target]===0?'absent':!eligible?'excluded':'candidate';
      return {...r,mass,eligible,status};
    }).sort((a,b)=>Number(b.mass>1e-7)-Number(a.mass>1e-7)||b.mass-a.mass||a.source.localeCompare(b.source)||a.target.localeCompare(b.target));
  }
  const button=(w,member,extra='')=>`<button type="button" data-member="${esc(w)}" class="ev-member-word ${w===member?'selected':''}" aria-pressed="${w===member}"><code>${esc(w)}</code>${extra}</button>`;
  function html(s,f,{member='',...options}={}){
    const d=describe(s,f),selected=f.words.includes(member)?member:'',routes=selected?connections(s,f,selected,options):[];
    const membership=`Expand a prefix and an ending to see its spellings. Select a spelling to inspect its permitted routes.`;
    const disconnected=d.components.length>1?`The current rules leave ${d.components.length} separate groups${d.isolated.length?`, including ${d.isolated.length} ${d.isolated.length===1?'spelling with':'spellings with'} no rule linking them to a different member`:''}. The saved family keeps those members, but this view does not claim a route between every pair.`:'The current rules connect these spellings into one group when direction is ignored. That connection does not establish that they mean the same word.';
    const tree=d.groups.map((b,i)=>`<details class="ev-member-branch" data-member-detail="${esc(b.id)}" ${b.words.includes(selected)||i<2?'open':''}><summary><code>${esc(b.label)}</code><span class="ev-member-count">${b.words.length} ${b.words.length===1?'spelling':'spellings'}</span></summary><ul class="ev-member-endings">${b.endings.map((e,j)=>`<li><details data-member-detail="${esc(b.id+'|'+e.label)}" ${e.words.includes(selected)||!selected&&j===0?'open':''}><summary class="ev-member-ending"><span>${esc(e.label)}</span><span class="ev-member-count">${e.words.length} ${e.words.length===1?'spelling':'spellings'}</span></summary><div class="ev-member-words">${e.words.map(w=>button(w,selected,d.isolateSet.has(w)?'<span class="ev-member-isolated" title="No current rule links this spelling to a different member.">Unconnected</span>':'')).join('')}</div></details></li>`).join('')}</ul></details>`).join('');
    function route(r){
      const status=r.status==='allocated'?`Allocated ${number(r.mass)} per 10,000 words`:r.status==='excluded'?'Excluded by the selected settings':r.status==='absent'?`${r.target} is absent from ${section(options.target)}${!r.eligible?' and excluded by the settings':''}`:'Candidate only';
      const trace=r.steps.length?r.steps.map(step=>`<li><code>${esc(step.rule)}</code><span>${[step.source,...(step.middles||[]),step.target].map(w=>`<code>${esc(w)}</code>`).join(' → ')}</span></li>`).join(''):'<li>The spelling stays the same.</li>';
      return `<details class="ev-member-route" data-member-detail="${esc(r.source+'>'+r.target)}" ${r.status==='allocated'&&routes.filter(x=>x.status==='allocated').length<4?'open':''}><summary><span><code>${esc(r.source)}</code> → <code>${esc(r.target)}</code></span><span class="ev-member-status ${r.status}">${esc(status)}</span></summary><ol class="ev-member-steps">${trace}</ol><div class="ev-member-endpoints">${button(r.source,selected)}${r.target!==r.source?button(r.target,selected):''}</div></details>`;
    }
    const connected=selected?`<section class="ev-member-selected" aria-label="Routes involving ${esc(selected)}"><h4><code>${esc(selected)}</code></h4><p>${routes.some(r=>r.source!==r.target)?'The routes below show permitted spelling changes involving this member. Each route can combine several rules.':'The current rules do not link this spelling to any different member.'}${options.comparison?' Allocated means the calculation assigns possible matches to that route. Candidate routes receive none under the selected settings.':''}</p>${routes.map(route).join('')}${routes.some(r=>r.steps.some(step=>step.middles?.length))?'<p>The middle spellings show how a composite rule operates. They are not required observations in an intermediate section.</p>':''}</section>`:'';
    return `<section class="ev-members"><p>${membership} The asterisk marks a shared beginning, and counts refer to distinct spellings.</p><div class="ev-member-layout"><div class="ev-member-tree">${tree}</div>${connected}</div><details class="ev-member-limits" data-member-detail="limits"><summary>Membership limits</summary><p>This saved family contains ${f.words.length} spellings linked under a broader set of candidate rules. The current test keeps every member but permits fewer transformations. Only the listed spellings belong to this family.</p><p>${disconnected}</p><p>These are groups for accounting. Neither the tree nor a rule connection proves shared meaning or historical ancestry.</p></details></section>`;
  }
  const api={describe,connections,html};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.EchoEvidenceMembers=api;
})(typeof window!=='undefined'?window:globalThis);
