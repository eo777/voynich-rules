/* Read-only diagnostics for the interlinear reader. These do not change a
 * token's candidate shares or turn an aggregate residual into token ancestry.
 * Keep these pure helpers separate so denominator/scope rules can be tested.
 */
(function(root) {
  'use strict';
  const clamp=x=>Math.max(0,Math.min(1,x));
  function intensity(rate,max) { return max>0?clamp(Math.log1p(Math.max(0,rate))/Math.log1p(max)):0; }
  function balance(source,target) {
    if(source<=0&&target<=0)return null;
    if(source<=0)return Infinity;
    if(target<=0)return -Infinity;
    return Math.log2(target/source);
  }
  // Retain the legacy colour gate, but name its actual reason. Entropy over
  // all regimes is different from the top-two margin: a decisive runner-up
  // lead can still have a diffuse tail. Neither is calibrated confidence.
  function regimeEvidence(sc) {
    if(!sc)return {ambiguous:true,reason:'unrecognized units',top:null,label:'No form evidence',detail:'The spelling cannot be split into recognized units.'};
    const reason=sc.u.length<3?'short form':sc.conc<.1?'diffuse likeness':sc.margin<.02?'near tie':'';
    const label=reason==='short form'?'Short form':reason==='diffuse likeness'?'Diffuse profile':reason==='near tie'?'Near tie':'Leading profile';
    const detail=`${sc.u.length} units (minimum 3); top-two gap ${sc.margin.toFixed(3)} (minimum 0.020); concentration across all regimes ${sc.conc.toFixed(3)} (minimum 0.100). Concentration = 1 − normalized entropy; it measures the whole profile, not the top-two ratio. These are display heuristics, not confidence probabilities.`;
    return {ambiguous:!!reason,reason,top:sc.order[0],label,detail};
  }
  function glyphMean(transitions) {
    const values=transitions.map(t=>t.g2).filter(v=>typeof v==='number'&&Number.isFinite(v));
    return values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
  }
  // The frozen LC1 ledger is directional and evaluates held-out split corpora.
  // It must never be silently reused for another section pair or current rules.
  function savedResidual(evaluation,from,to,word) {
    if(from!=='HA_early'||to!=='HB_all')return {available:false,reason:'Saved LC1 applies only to early Herbal A → Herbal B.'};
    if(!evaluation)return {available:false,reason:'No saved evaluation loaded.'};
    const row=evaluation.words.find(r=>r.word===word);
    if(!row)return {available:false,reason:'Form absent from this saved evaluation.'};
    return {available:true,rate:row.source_surplus_after_rate||0,before:row.A_before_rate||0,
      after:row.A_after_rate||0,target:row.B_rate||0};
  }
  const api={intensity,balance,regimeEvidence,glyphMean,savedResidual};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.EchoTranslationInsights=api;
})(typeof window!=='undefined'?window:globalThis);
