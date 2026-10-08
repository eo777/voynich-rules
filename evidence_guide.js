/* A compact reading path through the same frozen family counts as the explorer. */
(function(root){
  'use strict';
  const nodeModule=typeof module!=='undefined'&&module.exports;
  const O=nodeModule?require('./evidence_outcomes.js'):root.EchoEvidenceOutcomes;
  const T=nodeModule?require('./evidence_family_tree.js'):root.EchoEvidenceFamilyTree;
  const S=nodeModule?require('./evidence_slope_chart.js'):root.EchoEvidenceSlopeChart;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=value=>Number.isFinite(value)?value.toLocaleString('en-US',{maximumFractionDigits:1}):'—';
  const integer=value=>value.toLocaleString('en-US',{maximumFractionDigits:0});
  const signed=value=>(value>0?'+':'')+n(value);
  const names={HA_early:'Early A',HA_late:'Late A',PharmaA:'Pharma',Hand1_late:'Late A + Pharma',HB_all:'Herbal B'};
  const outcomes=['inversionPlus','inversion','converge','diverge','flat'];
  const tags={inversionPlus:'Inversion+',inversion:'Inversion',converge:'Converge',diverge:'Diverge',flat:'Flat'};
  const grains={pools:{level:'pool',name:'Rule pools',noun:'pools'},prefixes:{level:'prefix',name:'Prefixes',noun:'prefix groups'},endings:{level:'ending',name:'Ending groups',noun:'ending groups'},pairs:{level:'pair',name:'Exact K/T pairs',noun:'pairs'}};
  const help=(key)=>`data-evidence-help="${esc(O.explain(key))}"`;
  const badge=key=>`<span class="eo-tag eo-${key} ev-help" tabindex="0" ${help(key)}>${tags[key]}</span>`;
  const coverageHelp='K/T covered is the percentage of this later section’s ordinary K/T occurrences in groups with at least 10 occurrences in both early A and this section. It measures included observations, not rule accuracy. Changing the grain changes which groups meet that minimum.';
  const cache=new WeakMap();

  function model(study,mode='pools'){
    mode=grains[mode]?mode:'pools';
    if(!cache.has(study))cache.set(study,{tree:T.build(study),stock:O.inventory(study),models:new Map()});
    const context=cache.get(study);
    if(context.models.has(mode))return context.models.get(mode);
    const {tree,stock}=context,minimum=10,tolerance=O.DEFAULTS.tolerance;
    const options=target=>({target,minimum,measure:'rate',tolerance});
    const metric=(node,target)=>O.analyze(study,node,options(target),stock);
    const comparisons=study.sections.filter(section=>section.key!==study.source).map(section=>{
      const all=Object.values(tree.nodes).filter(node=>node.level===grains[mode].level).map(node=>metric(node,section.key)),eligible=all.filter(row=>row.eligible);
      return {key:section.key,all,eligible,
        counts:Object.fromEntries(outcomes.map(outcome=>[outcome,eligible.filter(row=>row.outcome===outcome).length])),
        includedCount:eligible.reduce((sum,row)=>sum+row.target.total,0),
        coverage:eligible.reduce((sum,row)=>sum+row.target.total,0)/stock.bySection[section.key].total};
    });
    const pool=id=>tree.roots.find(node=>node.poolId===id);
    const matrix=['okal','kal'].map(id=>({node:pool(id),targets:['HA_late','PharmaA','HB_all']})).filter(row=>row.node);
    const pair=Object.values(tree.nodes).find(node=>node.level==='pair'&&node.words.includes('ykaiin')&&node.words.includes('ytaiin'));
    const examples=[pair,pool('qokal')].filter(Boolean).map(node=>({node,target:'HB_all'}));
    const result={tree,stock,minimum,tolerance,metric,comparisons,matrix,examples,mode,grain:grains[mode]};
    context.models.set(mode,result);return result;
  }

  function patchFor(m,target,node){
    return {panel:'patterns',patternMode:node?(node.level==='pair'?'pairs':'pools'):m.mode,patternTarget:target,
      patternMin:m.minimum,patternTolerance:m.tolerance,patternSwapTolerance:O.DEFAULTS.swapTolerance,patternSparseMin:5,patternMeasure:'rate',patternScale:'family',
      patternChart:'map',patternOutcome:'all',patternGrowth:'all',patternSparse:false,patternSort:'inversion-volume',
      patternPage:0,patternBranches:[],patternExpanded:'',patternSelected:node?.id||'',patternStack:[]};
  }
  function attributes(patch){return `data-guide-explore="${esc(JSON.stringify(patch))}"`;}
  function title(node){
    if(node.poolId==='okal')return 'ok* / ot*';
    if(node.poolId==='kal')return 'bare k* / t*';
    if(node.poolId==='qokal')return 'qok* / qot*';
    return node.label;
  }
  function metadata(node){return node.level==='pair'?'Exact pair':`Pool ${node.poolId} · ${node.words.length} spellings`;}
  function card(study,m,node,target,withFamily){
    const row=m.metric(node,target),patch=patchFor(m,target,node),label=title(node);
    return `<article class="eg-chart">
      <div class="eg-chart-head"><strong>${esc(label)}</strong>${badge(row.outcome)}</div>
      <span class="eg-chart-meta">${esc(metadata(node))}</span>
      <button class="eg-plot" ${attributes(patch)} aria-label="Explore ${esc(label)} from Early A to ${esc(names[target])}">
      ${S.svg(row.display.source,row.display.target,{sourceLabel:'Early A',targetLabel:names[target],unitLabel:'per 10,000 words',seriesLabels:{k:node.kLabel,t:node.tLabel}})}
      <span class="eg-chart-foot"><span>${integer(row.source.total)} → ${integer(row.target.total)} observations</span><span>Swap error ${n(row.quality.swapError*100)}%</span><span>Explore ↗</span></span>
      </button></article>`;
  }
  function inventory(study,m){
    const source=m.stock.bySection[study.source];
    return `<section class="eg-block" aria-labelledby="eg-inventory"><div class="eg-section-head"><h3 id="eg-inventory">Section comparison</h3><label>Outcome grain<select data-guide-grain>${Object.entries(grains).map(([key,g])=>`<option value="${key}" ${key===m.mode?'selected':''}>${g.name}</option>`).join('')}</select></label></div>
      <p class="eg-caption">Section totals stay fixed. Outcome counts use ${m.grain.noun} with ${m.minimum} observations in each section.</p>
      <div class="eg-table-scroll"><table class="eg-census"><thead><tr><th rowspan="2">Section</th><th rowspan="2">K count</th><th rowspan="2">T count</th><th rowspan="2">K + T<br>per 10k</th><th rowspan="2">Change</th><th colspan="5">Eligible ${m.grain.noun}</th><th rowspan="2"><span class="ev-help" tabindex="0" data-evidence-help="${esc(coverageHelp)}">K/T covered ⓘ</span></th></tr><tr>${outcomes.map(key=>`<th class="eo-${key}"><span class="ev-help" tabindex="0" ${help(key)}>${tags[key]}</span></th>`).join('')}</tr></thead><tbody>
      ${study.sections.map(section=>{
        const row=m.stock.bySection[section.key],comparison=m.comparisons.find(item=>item.key===section.key),sourceRow=section.key===study.source;
        return `<tr class="${sourceRow?'eg-source':section.key==='Hand1_late'?'eg-pooled':''}"><th>${sourceRow?names[section.key]:`<button ${attributes(patchFor(m,section.key))}>${names[section.key]}${section.key==='Hand1_late'?'<small>Pooled</small>':''}</button>`}</th><td>${integer(row.k)}</td><td>${integer(row.t)}</td><td>${n(row.totalRate)}</td><td>${sourceRow?'—':signed((m.stock.factors[section.key]-1)*100)+'%'}</td>${outcomes.map(key=>`<td>${comparison?`<button class="eg-count eo-${key}" ${help(key)} ${attributes({...patchFor(m,section.key),patternOutcome:key})} aria-label="Explore ${comparison.counts[key]} ${tags[key]} ${m.grain.noun} in ${names[section.key]}">${comparison.counts[key]}</button>`:'—'}</td>`).join('')}<td>${comparison?`<span class="ev-help" tabindex="0" data-evidence-help="${comparison.includedCount} of ${row.total} ordinary K/T occurrences in ${names[section.key]} belong to eligible ${m.grain.noun}.">${n(comparison.coverage*100)}%</span>`:'—'}</td></tr>`;
      }).join('')}</tbody></table></div>
      <p class="eg-caption eg-coverage">K/T covered is the share of later K/T occurrences in eligible groups.</p>
      <div class="eg-scope"><span>The inventory includes one ordinary K/T per word.</span><span>${integer(source.total)} early observations</span><span>${integer(m.comparisons[0].all.length)} disjoint ${m.grain.noun}</span></div>
    </section>`;
  }
  function methods(study,m){return `<details class="eg-method" data-guide-disclosure="scope"><summary>Scope and selection</summary>
    <p>Every rate uses the full readable paragraph-word count of its section. Only words with exactly one ordinary k or t enter this inventory. P/F, bench gallows, multiple gallows and unresolved glyphs are excluded. Herbal B contains herbal pages only. Late A + Pharma repeats the two component samples and is not an independent comparison.</p>
    <table class="eg-denominators"><thead><tr><th>Section</th><th>Section words</th><th>Ordinary K/T words</th></tr></thead><tbody>${study.sections.map(section=>`<tr><th>${names[section.key]}</th><td>${integer(section.N)}</td><td>${integer(m.stock.bySection[section.key].total)}</td></tr>`).join('')}</tbody></table>
    <p>The six main charts compare the large o-prefixed pool with the large bare pool in three distinct later sections. The final examples add the exact ykaiin/ytaiin pair and the qo-prefixed pool. They are selected contrasts, not an exhaustive or random sample. The table counts every eligible group at the selected grain, including contrary outcomes. Prefixes, ending groups and exact pairs subdivide each rule pool. Finer cuts can split overlapping donors and fall below the count minimum. They are descriptive checks, not independent confirmations or a replacement for pooled rule accounting.</p><p>The asterisk represents zero or more characters. Pool labels abbreviate their listed members, not every matching manuscript word. Candidate rules define membership, and the explorer lists the actual spellings and rules.</p>
    <p>Charts show observed rates on their own zero-based axes. The guide uses the default 15% maximum pooled swap error, at least ten observations per section, a clear early imbalance and a better fit than retention. Inversion+ is descriptive, not statistical confidence. Select a chart to inspect its counts, subgroups and connecting rules. These observations do not establish word identity, chronology or individual transformations.</p>
  </details>`;}
  function html(study,state){
    const m=model(study,state?.guideGrain),hb=m.comparisons.find(row=>row.key==='HB_all');
    return `<section class="eg-guide ef-story eo-explorer"><div class="eg-result" aria-label="Early A to Herbal B summary"><strong>Early A → Herbal B</strong><span><b>${signed((m.stock.factors.HB_all-1)*100)}%</b> K/T frequency</span><span><b>${hb.counts.inversion+hb.counts.inversionPlus} / ${hb.eligible.length}</b> Reversed ${m.grain.noun}</span><span class="eo-inversionPlus ev-help" tabindex="0" ${help('inversionPlus')}><b>${hb.counts.inversionPlus} / ${hb.eligible.length}</b> Inversion+</span></div>${inventory(study,m)}
      <section class="eg-block" aria-labelledby="eg-comparisons"><h3 id="eg-comparisons">Section contrasts</h3>
        <div class="eg-outcome-key"><span><code>*</code> matches zero or more characters.</span><span>Pool labels abbreviate the listed members.</span></div>
        ${m.matrix.map(({node,targets})=>`<div class="eg-family-row"><div class="eg-chart-grid">${targets.map(target=>card(study,m,node,target,false)).join('')}</div></div>`).join('')}
      </section>
      <section class="eg-block" aria-labelledby="eg-more"><h3 id="eg-more">Further reversals</h3><div class="eg-chart-grid eg-two">${m.examples.map(({node,target})=>card(study,m,node,target,true)).join('')}</div></section>
      ${methods(study,m)}</section>`;
  }
  function bind(host,study,state,onExplore,onChange=()=>{}){
    host.querySelectorAll('[data-guide-explore]').forEach(element=>element.addEventListener('click',()=>onExplore(JSON.parse(element.dataset.guideExplore))));
    host.querySelector('[data-guide-grain]')?.addEventListener('change',event=>{state.guideGrain=event.target.value;onChange();});
  }
  const api={html,bind,model};
  if(nodeModule)module.exports=api;else root.EchoEvidenceGuide=api;
})(typeof window!=='undefined'?window:globalThis);
