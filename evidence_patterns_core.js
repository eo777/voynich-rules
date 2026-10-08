/* Observed k/t patterns only: this module never fits or allocates token mass. */
(function(root){
  'use strict';
  const E=typeof module!=='undefined'&&module.exports?require('./evidence_core.js'):root.EchoEvidenceCore;
  const CLASSES=Object.freeze(['stable','inverted','reversal','shift','balanced','insufficient']);
  const DEFAULTS=Object.freeze({mode:'pools',minimum:10,target:'HB_all',closeness:0.10,advantage:0.10,balance:0.10});
  const alphabetical=(a,b)=>a<b?-1:a>b?1:0;
  const epsilon=1e-12;

  function thresholds(options={}){
    const result={...DEFAULTS,...options};
    for(const key of ['minimum','closeness','advantage','balance']){
      if(!Number.isFinite(result[key])||result[key]<0)throw Error('Invalid pattern threshold: '+key);
    }
    return result;
  }

  /**
   * Classify two observed {k,t,total,share} metrics. The minimum applies to each
   * population separately; absent observations have share=null, never zero.
   * A reciprocal match requires mirror error <= closeness AND an advantage of
   * at least advantage over identity. Stable uses the converse. Balanced means
   * the early identity and reciprocal predictions are < balance apart; it is
   * not evidence of stability. A reversal only records crossing 50%.
   */
  function classify(early,later,options={}){
    const o=thresholds(options),a=early.share,b=later.share;
    const observed=Number.isFinite(a)&&Number.isFinite(b);
    const earlyTotal=early.total??early.k+early.t,laterTotal=later.total??later.k+later.t;
    const eligible=observed&&earlyTotal>=o.minimum&&laterTotal>=o.minimum;
    const identityError=observed?Math.abs(b-a):null;
    const mirrorError=observed?Math.abs(b-(1-a)):null;
    const predictionSeparation=Number.isFinite(a)?Math.abs(a-(1-a)):null;
    const crossMajority=observed&&((a<0.5&&b>0.5)||(a>0.5&&b<0.5));
    let classification='insufficient';
    if(eligible){
      if(predictionSeparation<o.balance-epsilon)classification='balanced';
      else if(mirrorError<=o.closeness+epsilon&&identityError-mirrorError>=o.advantage-epsilon)classification='inverted';
      else if(identityError<=o.closeness+epsilon&&mirrorError-identityError>=o.advantage-epsilon)classification='stable';
      else classification=crossMajority?'reversal':'shift';
    }
    return {classification,eligible,earlyShare:a,targetShare:b,identityError,mirrorError,predictionSeparation,crossMajority};
  }

  /**
   * Return an alphabetical disjoint partition of all study words. Pools use the
   * saved complete family membership. Pairs use exactly [prefix,tail], changing
   * only g=k/t, and do not merge q prefixes or choose favorable observed pairs.
   * words contains only observed spellings; expectedWords and absentWords allow
   * a pair display to name an unobserved counterpart without inventing a record.
   */
  function buildGroups(s,mode='pools'){
    if(!['pools','pairs'].includes(mode))throw Error('Unknown pattern grouping');
    const owners=new Map();
    for(const f of s.families)for(const word of f.words){
      if(owners.has(word)||!s.words[word])throw Error('Incomplete or overlapping evidence pools');
      owners.set(word,f.id);
    }
    const sourceWords=Object.keys(s.words);
    if(sourceWords.some(word=>!owners.has(word)))throw Error('Evidence word missing from complete pools');
    for(const word of sourceWords){
      const row=s.words[word];
      if(!['k','t'].includes(row.g)||typeof row.prefix!=='string'||typeof row.tail!=='string')throw Error('Invalid ordinary k/t word');
    }
    let groups;
    if(mode==='pools')groups=s.families.map(f=>({id:f.id,label:f.id,mode,words:[...f.words],poolIds:[f.id],poolId:f.id}));
    else{
      const pairs=new Map();
      for(const word of sourceWords){
        const row=s.words[word],key=JSON.stringify([row.prefix,row.tail]);
        if(!pairs.has(key)){
          const k=row.prefix+'k'+row.tail,t=row.prefix+'t'+row.tail;
          pairs.set(key,{id:'pair:'+key,label:k+' / '+t,mode,prefix:row.prefix,tail:row.tail,words:[],expectedWords:{k,t}});
        }
        pairs.get(key).words.push(word);
      }
      groups=[...pairs.values()].map(group=>{
        const poolIds=[...new Set(group.words.map(word=>owners.get(word)))].sort(alphabetical);
        return {...group,poolIds,poolId:poolIds.length===1?poolIds[0]:null,
          absentWords:Object.values(group.expectedWords).filter(word=>!group.words.includes(word))};
      });
    }
    return groups.map(group=>{
      const words=[...group.words].sort(alphabetical);
      return {...group,words,kWords:words.filter(word=>s.words[word].g==='k'),tWords:words.filter(word=>s.words[word].g==='t')};
    }).sort((a,b)=>alphabetical(a.label,b.label)||alphabetical(a.id,b.id));
  }

  /** Count groups equally; never sum capacities or rates into a pattern vote. */
  function summarize(groups,targets){
    const byTarget={};
    for(const target of targets){
      const counts=Object.fromEntries(CLASSES.map(key=>[key,0]));
      for(const group of groups)counts[group.comparisons[target].classification]++;
      byTarget[target]={total:groups.length,eligible:groups.length-counts.insufficient,counts,
        fractions:Object.fromEntries(CLASSES.map(key=>[key,groups.length?counts[key]/groups.length:null]))};
    }
    return {total:groups.length,byTarget};
  }

  /**
   * build(study, options) returns {allGroups,groups,sections,targets,summary,
   * options,source}. Every group's bySection holds the existing E.ratio fields
   * plus total, and comparisons holds one classification per later population.
   * allGroups is the full observed partition. groups retains early total >=
   * minimum and selected target total >= minimum, regardless of outcome. The
   * target='any' option accepts any later population meeting that minimum.
   * A zero-total population remains insufficient even when minimum is zero.
   * Rates use each section's full-corpus N per 10,000, not a family denominator.
   * None of the study or option objects is mutated.
   */
  function build(s,options={}){
    const o=thresholds(options),sections=s.sections.map(section=>({...section}));
    const targets=sections.filter(section=>section.key!==s.source).map(section=>section.key);
    if(!sections.some(section=>section.key===s.source))throw Error('Unknown early population');
    if(sections.some(section=>!Number.isFinite(section.N)||section.N<=0))throw Error('Invalid population denominator');
    if(o.target!=='any'&&!targets.includes(o.target))throw Error('Unknown target population');
    const allGroups=buildGroups(s,o.mode).map(group=>{
      const bySection={};
      for(const section of sections){
        const metric=E.ratio(s,group,section.key);
        bySection[section.key]={...metric,total:metric.k+metric.t};
      }
      const comparisons=Object.fromEntries(targets.map(target=>[target,classify(bySection[s.source],bySection[target],o)]));
      return {...group,bySection,comparisons};
    });
    const groups=allGroups.filter(group=>o.target==='any'?targets.some(target=>group.comparisons[target].eligible):group.comparisons[o.target].eligible);
    return {allGroups,groups,sections,targets,summary:summarize(groups,targets),options:o,source:s.source};
  }

  const api={CLASSES,DEFAULTS,buildGroups,classify,summarize,build};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.EchoEvidencePatternsCore=api;
})(typeof window!=='undefined'?window:globalThis);
