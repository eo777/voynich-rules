/* Descriptive outcome geometry over observed frequencies; no fitted allocations. */
(function(root){
  'use strict';
  const nodeModule=typeof module!=='undefined'&&module.exports;
  const E=nodeModule?require('./evidence_core.js'):root.EchoEvidenceCore;
  const P=nodeModule?require('./evidence_patterns_core.js'):root.EchoEvidencePatternsCore;
  const DEFAULTS=Object.freeze({target:'HB_all',minimum:10,measure:'rate',tolerance:1.25,swapTolerance:0.15,flat:0.10});
  const OUTCOMES=Object.freeze(['inversionPlus','inversion','flat','converge','diverge']);
  const EPS=1e-12;

  function options(value={}){
    const o={...DEFAULTS,...value};
    if(!['rate','adjusted','share'].includes(o.measure))throw Error('Unknown outcome measurement');
    if(!Number.isFinite(o.minimum)||o.minimum<0)throw Error('Invalid observation minimum');
    if(!Number.isFinite(o.tolerance)||o.tolerance<1)throw Error('Invalid inversion tolerance');
    if(!Number.isFinite(o.swapTolerance)||o.swapTolerance<0||o.swapTolerance>1)throw Error('Invalid swap error tolerance');
    if(!Number.isFinite(o.flat)||o.flat<0)throw Error('Invalid flat-gap tolerance');
    return o;
  }

  /** Full, fixed ordinary K/T inventory. No display filter enters this total. */
  function inventory(study){
    const bySection={},words={words:Object.keys(study.words)};
    if(!study.sections.some(s=>s.key===study.source))throw Error('Unknown source section');
    for(const section of study.sections){
      if(!Number.isFinite(section.N)||section.N<=0)throw Error('Invalid section denominator');
      const m=E.ratio(study,words,section.key);
      bySection[section.key]={...m,total:m.k+m.t};
    }
    const early=bySection[study.source].totalRate;
    const factors=Object.fromEntries(study.sections.map(section=>[section.key,early>0?bySection[section.key].totalRate/early:null]));
    return {source:study.source,bySection,factors};
  }

  /** Null means absent evidence, not a perfect match. One-sided zero is ±1. */
  function boundedResidual(actual,expected){
    if(!Number.isFinite(actual)||!Number.isFinite(expected)||actual<0||expected<0)return null;
    return actual+expected>0?(actual-expected)/(actual+expected):null;
  }

  function analyzeWithInventory(study,node,o,stock){
    if(!stock.bySection[o.target])throw Error('Unknown target section');
    if(o.target===study.source)throw Error('Target must differ from source');
    if(!Array.isArray(node.words)||new Set(node.words).size!==node.words.length||node.words.some(w=>!study.words[w]))throw Error('Invalid outcome word group');
    const bySection={};
    for(const section of study.sections){
      const m=E.ratio(study,node,section.key);
      bySection[section.key]={...m,total:m.k+m.t};
    }
    const a=bySection[study.source],b=bySection[o.target],g=stock.factors[o.target];
    const correctionAvailable=Number.isFinite(g)&&g>0;
    const c=correctionAvailable?b.kRate/g:null,d=correctionAvailable?b.tRate/g:null;
    const reciprocalX=boundedResidual(c,a.tRate),reciprocalY=boundedResidual(d,a.kRate);
    const bound=(o.tolerance-1)/(o.tolerance+1);
    const crossing=(a.k-a.t)*(b.k-b.t)<0;
    const observed=a.total>0&&b.total>0;
    const eligible=o.minimum===0?a.total+b.total>0:observed&&a.total>=o.minimum&&b.total>=o.minimum;
    const qualityMinimum=Math.max(10,o.minimum);
    const qualityEligible=observed&&a.total>=qualityMinimum&&b.total>=qualityMinimum;
    const unbalanced=a.share!==null&&Math.abs(a.share-0.5)>=0.05-EPS;
    // Compare two fixed K/T vectors. Each absolute difference contributes in
    // proportion to its frequency, so a rare minority does not get half the vote.
    // The legacy endpoint ratios remain diagnostics, not the Inversion+ gate.
    const comparisonTotal=correctionAvailable?a.totalRate+c+d:null;
    const swapError=comparisonTotal>0?(Math.abs(c-a.tRate)+Math.abs(d-a.kRate))/comparisonTotal:null;
    const retentionError=comparisonTotal>0?(Math.abs(c-a.kRate)+Math.abs(d-a.tRate))/comparisonTotal:null;
    const withinSwapTolerance=swapError!==null&&swapError<=o.swapTolerance+EPS;
    const improvesRetention=swapError!==null&&retentionError!==null&&swapError<retentionError-EPS;
    const withinTolerance=reciprocalX!==null&&reciprocalY!==null&&Math.abs(reciprocalX)<=bound+EPS&&Math.abs(reciprocalY)<=bound+EPS;
    const sourceDisplay=o.measure==='share'
      ? {kRate:a.share===null?null:a.share*100,tRate:a.share===null?null:(1-a.share)*100,totalRate:a.total?100:null}
      : {kRate:a.kRate,tRate:a.tRate,totalRate:a.totalRate};
    const targetDisplay=o.measure==='share'
      ? {kRate:b.share===null?null:b.share*100,tRate:b.share===null?null:(1-b.share)*100,totalRate:b.total?100:null}
      : o.measure==='adjusted'
        ? {kRate:c,tRate:d,totalRate:correctionAvailable?b.totalRate/g:null}
        : {kRate:b.kRate,tRate:b.tRate,totalRate:b.totalRate};
    const displayAvailable=[sourceDisplay.kRate,sourceDisplay.tRate,targetDisplay.kRate,targetDisplay.tRate].every(Number.isFinite);
    const meanTotal=displayAvailable?(sourceDisplay.totalRate+targetDisplay.totalRate)/2:null;
    const sourceGap=displayAvailable?sourceDisplay.kRate-sourceDisplay.tRate:null;
    const targetGap=displayAvailable?targetDisplay.kRate-targetDisplay.tRate:null;
    const initialLeader=a.k===a.t?'balanced':a.k>a.t?'k':'t';
    const startBalanced=initialLeader==='balanced';
    const earlyGap=displayAvailable?Math.abs(sourceGap):null;
    // An initial tie has no direction to reverse: retain the later gap as positive.
    const laterGap=displayAvailable?(targetGap===0?0:startBalanced?Math.abs(targetGap):Math.sign(sourceGap)*targetGap):null;
    const plot=meanTotal>0;
    const x=plot?earlyGap/meanTotal:null,y=plot?laterGap/meanTotal:null;
    const totalChange=displayAvailable?targetDisplay.totalRate-sourceDisplay.totalRate:null;
    const normalizedGrowth=plot?totalChange/(2*meanTotal):null;
    const gapChange=plot?Math.abs(y)-x:null;
    let outcome=crossing?'inversion':gapChange===null||Math.abs(gapChange)<=o.flat+EPS?'flat':gapChange>0?'diverge':'converge';
    if(crossing&&qualityEligible&&unbalanced&&withinSwapTolerance&&improvesRetention)outcome='inversionPlus';
    const deltaRate=b.totalRate-a.totalRate;
    const excessRate=correctionAvailable?b.totalRate-g*a.totalRate:null;
    const growthRatio=correctionAvailable&&a.totalRate>0?b.totalRate/(g*a.totalRate):null;
    const missing=[];
    if(reciprocalX===null)missing.push('K versus early T');
    if(reciprocalY===null)missing.push('T versus early K');
    const reason=plot?null:o.measure==='adjusted'&&!correctionAvailable?'The section correction is undefined.':
      o.measure==='share'&&!displayAvailable?'The K/T share is undefined at an unobserved endpoint.':'No observations at either endpoint.';
    return {...node,bySection,source:a,target:b,sourceKey:study.source,targetKey:o.target,
      display:{source:sourceDisplay,target:targetDisplay,measure:o.measure},outcome,eligible,qualityEligible,
      quality:{crossing,unbalanced,withinTolerance,minimum:qualityMinimum,
        swapError,retentionError,swapAbsoluteError:swapError===null?null:swapError*comparisonTotal,
        retentionAbsoluteError:retentionError===null?null:retentionError*comparisonTotal,
        comparisonVolume:correctionAvailable?Math.min(a.totalRate,b.totalRate/g):null,
        withinSwapTolerance,swapTolerance:o.swapTolerance,improvesRetention,
        definition:'pooled-corrected-l1-v1'},
      correction:g,growthMultiplier:g,excessRate,deltaRate,growthRatio,gapChange,
      scatter:{x,y,plot,reason,meanTotal,earlyGap,laterGap,initialLeader,startBalanced,
        newFamily:a.total===0&&b.total>0,vanished:a.total>0&&b.total===0,totalChange,normalizedGrowth,
        bounded:true,xBounds:[0,2],yBounds:[-2,2]},
      reciprocal:{x:reciprocalX,y:reciprocalY,plot:reciprocalX!==null&&reciprocalY!==null,
        reason:!correctionAvailable?'The section correction is undefined.':missing.length?'No observations for '+missing.join(' and ')+'.':null,toleranceBound:bound},
      oldComparison:P.classify(a,b,{minimum:o.minimum})};
  }

  /** Pass a precomputed inventory as the fourth argument to reuse fixed totals. */
  function analyze(study,node,value={},stock){
    return analyzeWithInventory(study,node,options(value),stock||inventory(study));
  }

  /** All groups retain sparse/new-family mass; groups applies only the count gate. */
  function build(study,nodes,value={}){
    const o=options(value),stock=inventory(study);
    const allGroups=nodes.map(node=>analyzeWithInventory(study,node,o,stock));
    return {inventory:stock,allGroups,groups:allGroups.filter(group=>group.eligible),options:o};
  }

  function explain(outcome,value={}){
    const o=options(value),percent=Math.round(o.swapTolerance*100);
    return ({
      inversion:'K and T reverse their order of frequency between the two sections. This category includes crossings that do not meet the stronger Inversion+ conditions.',
      inversionPlus:`K and T reverse order. After correcting for the section-wide K/T frequency change, the swapped frequencies have at most ${percent}% pooled error and fit better than unchanged K/T. Each section has at least ${Math.max(10,o.minimum)} observations, and early K share is at most 45% or at least 55%. This is a descriptive threshold, not statistical confidence.`,
      flat:'K and T do not cross. Their frequency gap changes by at most 10% of the mean group total, using the selected chart measure. Flat does not mean both frequencies stay constant.',
      converge:'K and T do not cross. Their frequency gap shrinks by more than 10% of the mean group total, using the selected chart measure.',
      diverge:'K and T do not cross. Their frequency gap grows by more than 10% of the mean group total, using the selected chart measure.'
    })[outcome]||'';
  }
  const api={DEFAULTS,OUTCOMES,inventory,boundedResidual,analyze,build,explain};
  if(nodeModule)module.exports=api;else root.EchoEvidenceOutcomes=api;
})(typeof window!=='undefined'?window:globalThis);
