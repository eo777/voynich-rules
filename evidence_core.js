/* Evidence views use the app's shared allocator; never sum isolated edge gains. */
(function(root){
  'use strict';
  const G=typeof module!=='undefined'&&module.exports?require('./graph_metrics.js'):root.EchoGraphMetrics;
  const sum=xs=>xs.reduce((a,b)=>a+b,0);
  function validate(bundle){
    if(bundle?.schema!==1||!Array.isArray(bundle.studies))throw Error('Unsupported evidence schema');
    for(const s of bundle.studies){
      if(s.type!=='gallows-families')throw Error('Unsupported evidence study type');
      const ns=new Map(s.sections.map(p=>[p.key,p.N]));
      if(!ns.has(s.source)||[...ns.values()].some(n=>!Number.isFinite(n)||n<=0))throw Error('Invalid denominators');
      const owner=new Set();
      for(const f of s.families){
        for(const w of f.words){
          if(owner.has(w)||!s.words[w])throw Error('Duplicated or missing family word');owner.add(w);
          for(const p of s.sections)if(!Number.isFinite(s.words[w].count[p.key])||s.words[w].count[p.key]<0)throw Error('Invalid counts');
        }
        for(const r of f.routes){
          if(!f.words.includes(r.source)||!f.words.includes(r.target))throw Error('Route outside complete pool');
          let v=r.source;for(const step of r.steps){if(step.source!==v)throw Error('Broken trace');v=step.target;}
          if(v!==r.target)throw Error('Incorrect trace endpoint');
          if(r.exchange&&(s.words[r.source].g!=='t'||s.words[r.target].g!=='k'))throw Error('Invalid exchange direction');
        }
      }
    }
    return true;
  }
  function rates(s,f,p){const N=s.sections.find(x=>x.key===p)?.N;if(!N)throw Error('Unknown population');return new Map(f.words.map(w=>[w,s.words[w].count[p]*10000/N]));}
  function admissible(s,r,target,policy,common){
    if(!r.exchange)return true;
    return policy!=='none'&&(policy==='all'||r.after_o)&&(!common||Math.min(s.words[r.source].count[s.source],s.words[r.target].count[target])>=3);
  }
  function solve(s,f,target,{policy='all',common=true,basis='stock'}={}){
    const a=rates(s,f,s.source),b=rates(s,f,target),identity=sum(f.words.map(w=>Math.min(a.get(w),b.get(w))));
    const budgetA=basis==='signed'?new Map(f.words.map(w=>[w,Math.max(0,a.get(w)-b.get(w))])):a;
    const budgetB=basis==='signed'?new Map(f.words.map(w=>[w,Math.max(0,b.get(w)-a.get(w))])):b;
    const edges=f.routes.filter(r=>admissible(s,r,target,policy,common));
    const flow=G.maximumFlow(budgetA,budgetB,edges.map(r=>[r.source,r.target,true]),true);
    const credit=flow.total+(basis==='signed'?identity:0);
    return {credit,identity,source:sum([...a.values()]),target:sum([...b.values()]),routes:flow.routes,
      unplaced:Math.max(0,sum([...a.values()])-credit),unfilled:Math.max(0,sum([...b.values()])-credit),edges};
  }
  function compare(s,f,target,options={}){
    const base=solve(s,f,target,{...options,policy:'none'}),withRule=solve(s,f,target,options);
    const used=new Map(withRule.routes.map(r=>[r.from+'>'+r.to,r.mass]));
    const baseUsed=new Map(base.routes.map(r=>[r.from+'>'+r.to,r.mass]));
    const destinations=f.words.map(w=>({word:w,before:sum(base.routes.filter(r=>r.to===w).map(r=>r.mass)),
      after:sum(withRule.routes.filter(r=>r.to===w).map(r=>r.mass))}));
    const grossGain=sum(destinations.map(x=>Math.max(0,x.after-x.before))),loss=sum(destinations.map(x=>Math.max(0,x.before-x.after)));
    return {base,withRule,gain:withRule.credit-base.credit,grossGain,loss,used,baseUsed,destinations};
  }
  function totals(s,target,options={}){
    const families=s.families.map(f=>({id:f.id,...compare(s,f,target,options)}));
    const gains=families.map(f=>f.gain).sort((a,b)=>b-a);
    return {families,gain:sum(gains),positive:gains.filter(g=>g>1e-7).length,
      withoutLargest:sum(gains.slice(1)),withoutFive:sum(gains.slice(5)),
      before:sum(families.map(f=>f.base.credit)),after:sum(families.map(f=>f.withRule.credit))};
  }
  function ratio(s,f,p){const rows=f.words.map(w=>s.words[w]),k=sum(rows.filter(x=>x.g==='k').map(x=>x.count[p])),t=sum(rows.filter(x=>x.g==='t').map(x=>x.count[p]));
    const N=s.sections.find(x=>x.key===p).N;return {k,t,N,kRate:k*10000/N,tRate:t*10000/N,totalRate:(k+t)*10000/N,share:k+t?k/(k+t):null,ratio:t?k/t:null};}
  const api={validate,rates,admissible,solve,compare,totals,ratio};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.EchoEvidenceCore=api;
})(typeof window!=='undefined'?window:globalThis);
