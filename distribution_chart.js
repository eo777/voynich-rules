/* Paired frequency plots for both frozen evaluations and live rule experiments.
 * X is source (original / rewritten); Y is target. A word occupies the same Y
 * coordinate in both panels. Zero has a separate rail, never a fake pseudocount.
 * Pure summaries are exported for node tests; the DOM adapter owns only its host.
 */
(function(root) {
  'use strict';
  const EPS=1e-8, NS='http://www.w3.org/2000/svg';
  const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=x=>x>EPS&&x<.01?Number(x).toExponential(3):Number(x).toLocaleString(undefined,{maximumFractionDigits:2});
  function summary(rows) {
    let before=0,after=0,gained=0,lost=0,improved=0,worsened=0;
    for(const r of rows){const a=Math.min(r.before,r.target),b=Math.min(r.after,r.target);before+=a;after+=b;gained+=Math.max(b-a,0);lost+=Math.max(a-b,0);const delta=Math.abs(r.before-r.target)-Math.abs(r.after-r.target);if(delta>EPS)improved++;else if(delta<-EPS)worsened++;}
    return {before,after,gained,lost,net:gained-lost,repaired:10000-before>EPS?(after-before)/(10000-before):0,improved,worsened};
  }
  function domain(rows) {
    const values=rows.flatMap(r=>[r.before,r.after,r.target]).filter(n=>n>EPS);
    // Fit the common window to observed one-token resolution, not tiny LP
    // residue. Both panels retain identical axes; small modeled values get an
    // explicit underflow marker. This removes empty decades without hiding mass.
    const observed=rows.flatMap(r=>[r.before,r.target]).filter(n=>n>EPS);
    const floor=observed.length?Math.min(...observed):values.length?Math.min(...values):1;
    const low=Math.log10(floor*.8);
    const high=Math.max(low+.5,Math.log10((values.length?Math.max(...values):10)*1.15));
    return {low,high};
  }
  function coordinate(value, d, start, end, zero) {
    return value<=EPS?zero:start+(Math.log10(Math.max(value,10**d.low))-d.low)/(d.high-d.low)*(end-start);
  }
  function frequencyFilter(rows, minimum=0, basis='either') {
    return rows.filter(r=>(basis==='both'?Math.min(r.before,r.target):basis==='source'?r.before:basis==='target'?r.target:Math.max(r.before,r.target))>=minimum);
  }
  function mount(host, allRows, config={}) {
    const rows=allRows.filter(r=>Math.max(r.before,r.after,r.target)>EPS), totals=summary(allRows);let d=domain(rows);
    const source=config.source||'Herbal A',target=config.target||'Herbal B';
    let selected='', showChanged=false, labelCount=12, minimum=0, basis='either';
    // The chart describes the complete evaluation, independent of ledger filters.
    host.innerHTML=`<div class="wb-card distribution-card"><div class="wb-row-title"><div><div class="wb-eyebrow">Distribution repair</div><h3>How close do the word frequencies become?</h3></div><span class="wb-badge neutral">${esc(config.policy||'Applied rules')}</span></div>
      <p class="wb-caption">Each point is one q-merged word form. Points on the diagonal have equal source and target rates. Compare the same words before and after applying the policy.</p>
      <div class="overlap-summary"><div><strong>${fmt(totals.before/100)}% → ${fmt(totals.after/100)}%</strong><span>word-frequency overlap</span></div><div><strong>${fmt(totals.repaired*100)}%</strong><span>of the original mismatch repaired, net</span></div><div><strong>+${fmt(totals.gained)} / −${fmt(totals.lost)}</strong><span>overlap gained / lost per 10k</span></div></div>
      <div class="overlap-bars" aria-label="Before and after overlap"><div><span>Before</span><div class="overlap-track"><i style="width:${Math.min(100,totals.before/100)}%"></i></div><b>${fmt(totals.before/100)}%</b></div><div><span>After</span><div class="overlap-track"><i style="width:${Math.min(100,totals.after/100)}%"></i></div><b>${fmt(totals.after/100)}%</b></div></div>
      <div class="distribution-controls"><label>Locate a form <input type="search" class="chart-find" placeholder="e.g. chol" aria-label="Locate a plotted form"></label><label><input type="checkbox" class="chart-changed"> Show changed forms only</label><label>Labels <select class="chart-labels" aria-label="Number of chart labels"><option value="12">12 largest changes</option><option value="0">Selected form only</option><option value="30">30 largest changes</option></select></label></div>
      <div class="distribution-controls"><label>Minimum rate /10k <input class="chart-min" type="number" min="0" step="1" value="0" aria-label="Minimum observed rate per 10k"></label><label>In <select class="chart-basis" aria-label="Frequency filter population"><option value="either">Either population</option><option value="both">Both populations</option><option value="source">Original source</option><option value="target">Target</option></select></label></div>
      <div class="distribution-plots"></div><div class="distribution-legend"><span><i class="dot before"></i>Original</span><span><i class="dot improved"></i>Closer to target</span><span><i class="dot worsened"></i>Further from target</span><span><i class="dot unchanged"></i>Equal distance / unchanged</span><span class="chart-count"></span></div>
      <div class="chart-inspector" aria-live="polite">Hover or click a point to inspect a word. Use “Locate a form” when points overlap.</div>
      <details class="chart-method"><summary>Chart notes</summary><p class="wb-small">Overlap sums the smaller source/target rate for every form; 100% means identical distributions. Display filters do not change it. Both plots use shared logarithmic axes in rates per 10,000 original tokens. Zero rates sit on separate rails. Hollow markers indicate modeled rates below the window. Colors measure absolute distance to target. ${esc(config.note||'')}</p></details></div>`;
    const plots=host.querySelector('.distribution-plots'), inspector=host.querySelector('.chart-inspector');
    const sorted=rows.slice().sort((a,b)=>Math.abs(b.after-b.before)-Math.abs(a.after-a.before)||Math.abs(b.before-b.target)-Math.abs(a.before-a.target));
    const byWord=new Map(rows.map(r=>[r.word,r])), points=new Map(), labelsByWord=new Map();
    let highlighted=[], hiddenLabels=[], selectedLabels=[];
    function element(tag,attrs,parent,text){const e=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text!=null)e.textContent=text;parent.appendChild(e);return e;}
    function inspect(word,pin=false) {
      const r=byWord.get(word);
      if(pin){selected=word;host.querySelector('.chart-find').value=word;}
      // Touch only the old/new selection, not every vocabulary node on hover.
      highlighted.forEach(e=>e.classList.remove('selected'));
      hiddenLabels.forEach(e=>e.style.display='');selectedLabels.forEach(e=>e.remove());selectedLabels=[];
      highlighted=points.get(word)||[];highlighted.forEach(e=>e.classList.add('selected'));
      hiddenLabels=labelsByWord.get(word)||[];hiddenLabels.forEach(e=>e.style.display='none');
      if(!r){inspector.textContent=word?'No plotted form has this exact spelling.':'Hover or click a point to inspect a word.';return;}
      inspector.innerHTML=`<b class="mono">${esc(word)}</b><span>Original ${fmt(r.before)} → after ${fmt(r.after)} · target ${fmt(r.target)} /10k</span><span>Distance to target ${fmt(Math.abs(r.before-r.target))} → ${fmt(Math.abs(r.after-r.target))} /10k</span><span>Δ overlap ${Math.min(r.after,r.target)-Math.min(r.before,r.target)>=0?'+':''}${fmt(Math.min(r.after,r.target)-Math.min(r.before,r.target))} /10k</span>${config.onWord?'<button class="wb-button chart-explore">Explore contexts</button>':''}`;
      inspector.querySelector('button')?.addEventListener('click',()=>config.onWord(word));
      highlighted.forEach(p=>{
        const svg=p.closest('svg'),x=+p.getAttribute('cx'),y=+p.getAttribute('cy');
        selectedLabels.push(element('text',{x:Math.min(418,x+8),y:Math.max(24,y-8),class:'selected-label','text-anchor':x>410?'end':'start'},svg,word));
      });
    }
    function render() {
      plots.innerHTML='';
      points.clear();labelsByWord.clear();highlighted=[];hiddenLabels=[];selectedLabels=[];
      const filtered=frequencyFilter(rows,minimum,basis),visible=showChanged?filtered.filter(r=>Math.abs(r.after-r.before)>EPS):filtered;
      d=domain(visible);
      const visibleWords=new Set(visible.map(r=>r.word));
      const labels=new Set(sorted.filter(r=>visibleWords.has(r.word)).slice(0,labelCount).map(r=>r.word));
      for(const [field,title] of [['before','Before rules'],['after','After rules']]) {
        const wrap=document.createElement('figure');wrap.className='distribution-plot';plots.appendChild(wrap);
        const caption=document.createElement('figcaption');caption.textContent=title;wrap.appendChild(caption);
        const svg=element('svg',{viewBox:'0 0 510 470',role:'img','aria-label':`${title}: ${source} versus ${target} word frequencies`},wrap);
        const x=v=>coordinate(v,d,96,476,67),y=v=>coordinate(v,d,384,40,414);
        element('rect',{x:96,y:40,width:380,height:344,class:'plot-area'},svg);
        for(let exponent=Math.floor(d.low);exponent<=Math.ceil(d.high);exponent++) for(const step of [1,2,5]) {
          const value=step*10**exponent;if(Math.log10(value)<d.low||Math.log10(value)>d.high)continue;
          element('line',{x1:x(value),x2:x(value),y1:40,y2:384,class:'plot-grid'},svg);
          element('line',{x1:96,x2:476,y1:y(value),y2:y(value),class:'plot-grid'},svg);
          const tick=fmt(value);
          element('text',{x:x(value),y:437,'text-anchor':'middle',class:'plot-tick'},svg,tick);
          element('text',{x:54,y:y(value)+4,'text-anchor':'end',class:'plot-tick'},svg,tick);
        }
        element('line',{x1:67,x2:67,y1:40,y2:414,class:'zero-rail'},svg);
        element('line',{x1:67,x2:476,y1:414,y2:414,class:'zero-rail'},svg);
        element('text',{x:67,y:437,'text-anchor':'middle',class:'plot-tick'},svg,'0');
        element('text',{x:54,y:418,'text-anchor':'end',class:'plot-tick'},svg,'0');
        element('line',{x1:96,x2:476,y1:384,y2:40,class:'equality-line'},svg);
        element('text',{x:105,y:31,class:'plot-tick'},svg,'diagonal = equal rates');
        element('text',{x:280,y:463,'text-anchor':'middle',class:'plot-axis'},svg,`${source}${field==='after'?' after rules':''} /10k`);
        element('text',{transform:'translate(15,227) rotate(-90)','text-anchor':'middle',class:'plot-axis'},svg,`${target} /10k`);
        for(const r of visible) {
          const change=Math.abs(r.before-r.target)-Math.abs(r.after-r.target);
          const cls=field==='before'?'before':change>EPS?'improved':change<-EPS?'worsened':'unchanged';
          const underflow=(r[field]>EPS&&r[field]<10**d.low)||(r.target>EPS&&r.target<10**d.low);
          const circle=element('circle',{cx:x(r[field]),cy:y(r.target),r:3.2,class:'frequency-point '+cls+(underflow?' underflow':'')},svg);
          circle.dataset.word=r.word;
          if(!points.has(r.word))points.set(r.word,[]);points.get(r.word).push(circle);
          element('title',{},circle,`${r.word}: ${fmt(r[field])} → target ${fmt(r.target)} /10k`);
          circle.addEventListener('mouseenter',()=>inspect(r.word));circle.addEventListener('mouseleave',()=>inspect(selected));circle.addEventListener('click',()=>inspect(r.word,true));
        }
        // Greedy label placement avoids the dense, unreadable label pileups in a
        // full-vocabulary chart. Every remaining form is reachable by exact search.
        const placed=[];
        for(const r of sorted.filter(r=>labels.has(r.word))) {
          const px=x(r[field]),py=y(r.target),width=r.word.length*6+4;
          for(const [dx,dy] of [[7,-7],[7,13],[-width-6,-7],[-width-6,13],[7,-20]]) {
            const tx=px+dx,ty=py+dy;
            if(tx<60||tx+width>498||ty<18||ty>424||placed.some(b=>tx<b.x+b.w&&tx+width>b.x&&ty-11<b.y+3&&ty>b.y-11))continue;
            const label=element('text',{x:tx,y:ty,class:'plot-label','data-word':r.word},svg,r.word);
            if(!labelsByWord.has(r.word))labelsByWord.set(r.word,[]);labelsByWord.get(r.word).push(label);
            placed.push({x:tx,y:ty,w:width});break;
          }
        }
      }
      const visibleSummary=summary(visible);
      host.querySelector('.chart-count').textContent=`${visible.length} / ${rows.length} forms plotted · ${visibleSummary.improved} closer · ${visibleSummary.worsened} further among visible forms`;
      if(selected)inspect(selected);else inspector.textContent=visible.length?'Hover or click a point to inspect a word.':'No forms meet these filters. Lower the minimum frequency.';
    }
    host.querySelector('.chart-find').addEventListener('input',e=>inspect(e.target.value.trim().replace(/^q/,''),true));
    host.querySelector('.chart-changed').addEventListener('change',e=>{showChanged=e.target.checked;render();});
    host.querySelector('.chart-labels').addEventListener('change',e=>{labelCount=+e.target.value;render();});
    host.querySelector('.chart-min').addEventListener('change',e=>{minimum=Math.max(0,Number(e.target.value)||0);e.target.value=minimum;render();});
    host.querySelector('.chart-basis').addEventListener('change',e=>{basis=e.target.value;render();});
    render();
  }
  const api={summary,domain,coordinate,frequencyFilter,mount};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.EchoDistributionChart=api;
})(typeof window!=='undefined'?window:globalThis);
