/* Context review calculations. The UI uses testMethod:'review' exclusively:
 * descriptive gaps/lifts, no p-values, corrections or sample-size gates.
 * Legacy statistical helpers remain for reproducibility of prior calculations;
 * do not use them to decide which exploratory search results deserve review.
 * Tokens stay in their original positions. See ANALYSIS_UI_NOTES.md.
 */
(function(root) {
  'use strict';
  const C = typeof module !== 'undefined' && module.exports ? require('./workbench_core.js') : root.EchoWorkbenchCore;
  function logGamma(z) {
    const c=[676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-.13857109526572012,9.984369578019572e-6,1.5056327351493116e-7];
    z--; let x=.99999999999980993;
    c.forEach((v,i)=>x+=v/(z+i+1));
    const t=z+7.5; return .9189385332046727+(z+.5)*Math.log(t)-t+Math.log(x);
  }
  function betaFraction(a,b,x) {
    const tiny=1e-300, guard=v=>Math.abs(v)<tiny?tiny:v;
    let c=1,d=1/guard(1-(a+b)*x/(a+1)),h=d;
    for(let m=1;m<=200;m++) {
      let v=m*(b-m)*x/((a+2*m-1)*(a+2*m));
      d=1/guard(1+v*d);c=guard(1+v/c);h*=d*c;
      v=-(a+m)*(a+b+m)*x/((a+2*m)*(a+2*m+1));
      d=1/guard(1+v*d);c=guard(1+v/c);const delta=d*c;h*=delta;
      if(Math.abs(delta-1)<3e-14)break;
    }
    return h;
  }
  function studentP(t,df) {
    if(!Number.isFinite(df)||df<=0)return NaN;
    const x=df/(df+t*t),a=df/2,b=.5;
    if(x===1)return 1;if(x===0)return 0;
    const bt=Math.exp(logGamma(a+b)-logGamma(a)-logGamma(b)+a*Math.log(x)+b*Math.log1p(-x));
    return Math.max(0,Math.min(1,x<(a+1)/(a+b+2)?bt*betaFraction(a,b,x)/a:1-bt*betaFraction(b,a,1-x)/b));
  }
  function holm(results) {
    const order=results.map((r,i)=>({p:r.p??1,i})).sort((a,b)=>a.p-b.p);
    let previous=0;
    order.forEach(({p,i},rank)=>{previous=Math.max(previous,Math.min(1,p*(order.length-rank)));results[i].adjusted=results[i].p==null?null:previous;});
    return results;
  }
  function aggregate(items, classify) {
    const counts=new Map(),clusters=new Map();
    for(const o of items) {
      const key=classify(o),sheet=o.line.sheet;
      counts.set(key,(counts.get(key)||0)+1);
      if(!clusters.has(sheet))clusters.set(sheet,{n:0,counts:new Map()});
      const g=clusters.get(sheet);g.n++;g.counts.set(key,(g.counts.get(key)||0)+1);
    }
    return {n:items.length,counts,clusters};
  }
  const logFactorials=[0];
  function logChoose(n,k) {
    for(let i=logFactorials.length;i<=n;i++)logFactorials.push(logFactorials[i-1]+Math.log(i));
    return logFactorials[n]-logFactorials[k]-logFactorials[n-k];
  }
  // Fixed-margin 2x2 distribution; zeros are valid, including singleton support.
  function margin(table) {
    const [a,b,c,d]=table,n=a+b+c+d,hits=a+c,row=a+b;
    return {observed:a,lo:Math.max(0,row-(n-hits)),hi:Math.min(row,hits),
      logWeight:x=>logChoose(hits,x)+logChoose(n-hits,row-x)};
  }
  function exactDistribution(lo,hi,observed,logWeight) {
    const logs=Array.from({length:hi-lo+1},(_,i)=>logWeight(lo+i));
    const peak=Math.max(...logs),observedLog=logs[observed-lo];
    let total=0,two=0,less=0,greater=0;
    logs.forEach((log,i)=>{const w=Math.exp(log-peak),x=lo+i;total+=w;
      if(log<=observedLog+1e-9)two+=w;if(x<=observed)less+=w;if(x>=observed)greater+=w;});
    return {p:Math.min(1,two/total),less:Math.min(1,less/total),greater:Math.min(1,greater/total),tables:logs.length};
  }
  function fisherExact(table) {
    const m=margin(table);return exactDistribution(m.lo,m.hi,m.observed,m.logWeight);
  }
  // Two-stratum Zelen test: condition on both sets of margins AND total
  // selected hits. The nuisance common odds ratio then cancels. Probability
  // ordering gives the two-sided test; this tests multiplicative interaction,
  // unlike the additive percentage-point interaction in sheet mode.
  function equalOddsExact(tables) {
    const [a,b]=tables.map(margin),total=a.observed+b.observed;
    return exactDistribution(Math.max(a.lo,total-b.hi),Math.min(a.hi,total-b.lo),a.observed,
      x=>a.logWeight(x)+b.logWeight(total-x));
  }
  const supportFor=(cells,key)=>cells.map(c=>({n:c.n,hits:c.counts.get(key)||0,sheets:c.clusters.size}));
  function exactContrast(cells,key,disabled='',interaction=false) {
    const support=supportFor(cells,key),reason=disabled||(!cells.every(c=>c.n)?'No selected or remaining tokens':'');
    const table=(a,b)=>[a.hits,a.n-a.hits,b.hits,b.n-b.hits];
    const tables=interaction?[table(...support.slice(0,2)),table(...support.slice(2))]:[table(...support)];
    let effect=support[0].hits/support[0].n-support[1].hits/support[1].n;
    if(interaction) {
      const [a,b]=tables,up=b[0]*b[3]*a[1]*a[2],down=b[1]*b[2]*a[0]*a[3];
      effect=up===0&&down===0?null:up===down?0:Math.log(up/down);
    }
    const result={effect:cells.every(c=>c.n)?effect:null,p:null,adjusted:null,reason,support,
      method:interaction?'Token exact · equal odds':'Token exact · Fisher',effectKind:interaction?'logOdds':'rate'};
    if(reason)return result;
    Object.assign(result,interaction?equalOddsExact(tables):fisherExact(tables[0]));
    if(result.tables===1)result.note='Fixed margins leave one possible table; p = 1 (no discriminatory information)';
    return result;
  }
  function contrast(cells,weights,key,disabled='') {
    const means=cells.map(c=>(c.counts.get(key)||0)/c.n);
    const effect=cells.every(c=>c.n)?means.reduce((sum,p,i)=>sum+p*weights[i],0):null;
    const support=supportFor(cells,key);
    const reason=disabled||(!cells.every(c=>c.n)?'No selected or remaining tokens':
      support.some(s=>s.sheets<6)?'Fewer than 6 sheets in a comparison cell':
      support.some(s=>s.hits<5||s.n-s.hits<5)?'Fewer than 5 occurrences or non-occurrences in a comparison cell':'');
    const result={effect,p:null,adjusted:null,reason,support,method:'By sheet · t approximation'};
    if(reason)return result;
    const sheets=new Set(cells.flatMap(c=>[...c.clusters.keys()]));
    let variance=0;
    for(const sheet of sheets) {
      const score=cells.reduce((sum,c,i)=>{const g=c.clusters.get(sheet);return sum+(g?weights[i]*((g.counts.get(key)||0)-means[i]*g.n)/c.n:0);},0);
      variance+=score*score;
    }
    const n=cells.reduce((sum,c)=>sum+c.n,0),k=cells.length,G=sheets.size;
    variance*=G/(G-1)*(n-1)/(n-k);
    result.se=Math.sqrt(variance);
    // Conservative df uses the least represented cell, not pooled sheet count.
    result.df=Math.min(...support.map(s=>s.sheets))-1;
    if(variance<1e-24){if(Math.abs(effect)<1e-12)result.p=1;else result.reason='No estimable between-sheet variance';}
    else result.p=studentP(effect/result.se,result.df);
    return result;
  }
  function sharedEnrichment(focus,other,key,disabled='',exact=false) {
    const within=focus.map((f,i)=>exact?exactContrast([f,other[i]],key,disabled):contrast([f,other[i]],[1,-1],key,disabled));
    // Intersection-union test: BOTH sections must be enriched. max(pA,pB)
    // is valid without independence between the two component tests. A pooled
    // test (or Fisher's p-combination) would instead allow one section to drive it.
    within.forEach(r=>{r.oneSided=r.p==null?null:exact?r.greater:r.effect>=0?r.p/2:1-r.p/2;});
    return {effect:within.every(r=>r.effect!=null)?Math.min(...within.map(r=>r.effect)):null,
      p:within.some(r=>r.p==null)?null:Math.max(...within.map(r=>r.oneSided)),adjusted:null,
      reason:within.map((r,i)=>r.reason?`${i===0?'Search':'Comparison'}: ${r.reason}`:'').filter(Boolean).join('; '),
      support:within.flatMap(r=>r.support),within,method:exact?'Token exact · shared enrichment':'By sheet · shared enrichment'};
  }
  const identity=o=>JSON.stringify([o.line.folio,o.line.locus,o.index]);
  // Descriptive review flags deliberately have no sampling/significance gates.
  // Match the visible bars: selection is compared with its FULL section rate,
  // not the disjoint complement used for statistical inference below.
  function reviewContrasts(full,focus,key,config={},omitted='') {
    const minGap=(config.reviewMinGap??1)/100,minLift=config.reviewMinLift??2,largeGap=(config.reviewLargeGap??5)/100;
    const ratio=(a,b)=>a===b?1:b===0?Infinity:a/b;
    const notable=(gap,lift)=>Math.abs(gap)>1e-12&&
      (Math.abs(gap)+1e-12>=largeGap||(Math.abs(gap)+1e-12>=minGap&&Math.max(lift,1/lift)>=minLift));
    const base=full.map(c=>c.n?(c.counts.get(key)||0)/c.n:null);
    const selected=focus.map(c=>c.n?(c.counts.get(key)||0)/c.n:null);
    const within=selected.map((p,i)=>({effect:p==null||base[i]==null?null:p-base[i],lift:p==null||base[i]==null?null:ratio(p,base[i])}));
    const make=(effect,lift,support,reason='')=>({effect,lift,support,reason:omitted||reason,method:'Review',
      flagged:!omitted&&!reason&&effect!=null&&notable(effect,lift)});
    const section=make(base.every(p=>p!=null)?base[1]-base[0]:null,ratio(base[1],base[0]),supportFor(full,key),'');
    if(base.some(p=>p==null))section.reason='No section tokens';
    const ready=within.every(w=>w.effect!=null),support=supportFor([focus[0],full[0],focus[1],full[1]],key);
    const selection=make(ready?within[1].effect-within[0].effect:null,ready?ratio(within[1].lift,within[0].lift):null,support,ready?'':'No matching tokens in one population');
    const shared=make(ready?Math.min(...within.map(w=>w.effect)):null,ready?Math.min(...within.map(w=>w.lift)):null,support,ready?'':'No matching tokens in one population');
    shared.flagged=!shared.reason&&ready&&within.every(w=>w.effect>0&&notable(w.effect,w.lift));
    selection.within=shared.within=within;
    return {section,selection,shared};
  }
  function analyze(populations,selected,config={},drill=null) {
    const reviewing=config.testMethod==='review';
    const allIds=reviewing?null:populations.map(items=>new Set(items.map(identity)));
    const overlap=!reviewing&&[...allIds[0]].some(id=>allIds[1].has(id));
    const chosen=reviewing?null:selected.map(items=>new Set(items.map(identity)));
    const rest=reviewing?[]:populations.map((items,i)=>items.filter(o=>!chosen[i].has(identity(o))));
    const result={},families={section:[],selection:[],shared:[]},exact=config.testMethod==='exact';
    for(const side of (drill?[drill.side]:['prev','next'])) {
      const classify=drill?o=>C.neighborWord(o,side,config.mergeQ===true):o=>C.neighborClass(o[side],side,config.neighborMode);
      // Neighbor exclusions condition both section and selected populations on
      // the same retained neighbor vocabulary. They are specific to a direction.
      const excluded=config.neighborExcluded?.[side]||[];
      const eligible=items=>C.filterNeighbors(items,side,excluded,config.mergeQ===true);
      const full=populations.map(items=>aggregate(eligible(items),classify));
      const focus=selected.map(items=>aggregate(eligible(items),classify)),other=rest.map(items=>aggregate(eligible(items),classify));
      // Preserve the original correction family even when rows are excluded.
      const keys=new Set(populations.flatMap(items=>items.filter(o=>!drill||C.neighborClass(o[side],side,config.neighborMode)===drill.key).map(classify)));result[side]=new Map();
      const disabled=overlap?'Populations share token positions':'';
      // Selecting on this same neighbor mechanically creates the contrast.
      const conditioned=Boolean(config[side]||config.neighborOnly?.[side]?.length||(config.groupFilters||[]).some(g=>g.side===side)||(side==='next'&&config.nextQ&&config.nextQ!=='any')||(config.position&&config.position!=='any'));
      for(const key of keys) {
        const omitted=drill&&excluded.includes(key)?'Neighbor excluded from this direction':'';
        if(config.testMethod==='review') {
          result[side].set(key,reviewContrasts(full,focus,key,config,omitted));
          continue;
        }
        const block=omitted||disabled||(conditioned?'Selection filters constrain this neighbor':'');
        const section=exact?exactContrast([full[1],full[0]],key,omitted||disabled):contrast(full,[-1,1],key,omitted||disabled);
        const cells=[focus[0],other[0],focus[1],other[1]];
        const selection=exact?exactContrast(cells,key,block,true):contrast(cells,[-1,1,1,-1],key,block);
        // Shared is still valid when populations overlap: each within-section
        // test has a disjoint complement and max(pA,pB) needs no independence
        // between sections. Cross-population contrasts remain disabled.
        const shared=sharedEnrichment(focus,other,key,omitted||(conditioned?'Selection filters constrain this neighbor':''),exact);
        const tests={section,selection,shared};result[side].set(key,tests);
        Object.keys(families).forEach(kind=>families[kind].push(tests[kind]));
      }
    }
    Object.values(families).forEach(holm);
    return result;
  }
  const api={studentP,holm,aggregate,contrast,fisherExact,equalOddsExact,sharedEnrichment,reviewContrasts,analyze};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.EchoContextStatistics=api;
})(typeof window!=='undefined'?window:globalThis);
