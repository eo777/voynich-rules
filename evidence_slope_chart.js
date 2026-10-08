/* Two observed rates per population. Layout never changes the data coordinates. */
(function(root){
  'use strict';
  const WIDTH=440,HEIGHT=210,TOP=54,BOTTOM=168,LEFT=120,RIGHT=290,LABEL_GAP=22;
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rate=value=>value.toFixed(1);
  const coordinate=value=>Math.round(value*1000)/1000;

  function niceCeiling(maximum){
    if(maximum<=1)return 1;
    const decade=10**Math.floor(Math.log10(maximum));
    for(const factor of [1,1.25,1.5,2,2.5,3,4,5,6,8,10]){
      const candidate=factor*decade;
      if(Number.isFinite(candidate)&&candidate>=maximum)return candidate;
    }
    // The finite-number boundary can leave no representable rounded ceiling.
    return maximum;
  }

  function separateLabels(points){
    points.sort((a,b)=>a.y-b.y);
    // Least-squares spacing keeps the text as close as possible to its mark.
    // Pool adjacent violations after subtracting the required inter-label gap.
    const blocks=[];
    points.forEach((point,index)=>{
      blocks.push({sum:point.y-index*LABEL_GAP,count:1});
      while(blocks.length>1){
        const last=blocks[blocks.length-1],previous=blocks[blocks.length-2];
        if(previous.sum/previous.count<=last.sum/last.count)break;
        blocks.splice(-2,2,{sum:previous.sum+last.sum,count:previous.count+last.count});
      }
    });
    let index=0;
    for(const block of blocks){
      const position=Math.max(TOP,Math.min(BOTTOM-(points.length-1)*LABEL_GAP,block.sum/block.count));
      for(let item=0;item<block.count;item++,index++)points[index].labelY=position+index*LABEL_GAP;
    }
    for(const point of points)point.leader=Math.abs(point.labelY-point.y)>1e-9;
  }

  /** Input metrics are {kRate,tRate}, in observations per 10,000 section words. */
  function layout(early,later,options={}){
    const width=options.seriesLabels?480:WIDTH,left=LEFT+(options.seriesLabels?30:0),right=RIGHT+(options.seriesLabels?30:0);
    const values=[early?.kRate,early?.tRate,later?.kRate,later?.tRate];
    if(values.some(value=>!Number.isFinite(value)||value<0))throw Error('Slope rates must be finite and nonnegative');
    const maximum=Math.max(...values),ceiling=options.ceiling===undefined?niceCeiling(maximum):options.ceiling;
    if(!Number.isFinite(ceiling)||ceiling<1||ceiling<maximum)throw Error('Slope ceiling must be finite, at least 1, and at least every rate');
    if(options.inversionReference!==undefined&&(!Number.isFinite(options.inversionReference)||options.inversionReference<0||options.inversionReference>ceiling))throw Error('Inversion reference must be finite and between zero and the ceiling');
    const y=value=>BOTTOM-(value/ceiling)*(BOTTOM-TOP);
    const series=['k','t'].map(key=>({key,label:options.seriesLabels?.[key]||key.toUpperCase(),points:[early,later].map((metric,index)=>({
      side:index?'later':'early',value:metric[key+'Rate'],x:index?right:left,y:y(metric[key+'Rate']),
      labelX:index?right+20:left-18,labelY:y(metric[key+'Rate']),anchor:index?'start':'end',leader:false
    }))}));
    const reference=options.inversionReference===undefined?null:{side:'later',value:options.inversionReference,
      x:right+10,y:y(options.inversionReference),labelX:right+20,labelY:y(options.inversionReference),anchor:'start',leader:false};
    // Separate text only. Equal points stay equal, including at zero and the ceiling.
    for(let side=0;side<2;side++){
      const points=series.map(item=>item.points[side]);
      if(side===1&&reference)points.push(reference);
      separateLabels(points);
    }
    return {width,height:HEIGHT,ceiling,plot:{left,right,top:TOP,bottom:BOTTOM},
      ticks:[0,ceiling/2,ceiling].map(value=>({value,y:y(value)})),series,reference};
  }

  function svg(early,later,options={}){
    const chart=layout(early,later,options),source=options.sourceLabel??'Early Herbal A',target=options.targetLabel??'Later section';
    const LEFT=chart.plot.left,RIGHT=chart.plot.right,WIDTH=chart.width;
    const suffix=options.valueSuffix??'',unit=options.unitLabel??'per 10,000 words',formatted=value=>rate(value)+suffix;
    const description=`Observed values (${unit}). ${source}: K ${formatted(early.kRate)}, T ${formatted(early.tRate)}. ${target}: K ${formatted(later.kRate)}, T ${formatted(later.tRate)}. Scale 0 to ${formatted(chart.ceiling)}.${chart.reference?` The diamond marks expected later K under an inverted early ratio: ${formatted(chart.reference.value)}.`:''}`;
    const ticks=chart.ticks.map(tick=>`<g class="ep-slope-tick"><line x1="${LEFT}" y1="${coordinate(tick.y)}" x2="${RIGHT}" y2="${coordinate(tick.y)}" stroke="var(--line, #d6dddd)"/><text x="36" y="${coordinate(tick.y)}" text-anchor="end" dominant-baseline="middle" fill="var(--ink2, #59676c)" font-size="12.5">${esc(Number(tick.value.toFixed(1))+suffix)}</text></g>`).join('');
    const lines=chart.series.map(item=>{
      const [a,b]=item.points;
      return `<line class="ep-slope-line ep-slope-${item.key}" x1="${a.x}" y1="${coordinate(a.y)}" x2="${b.x}" y2="${coordinate(b.y)}" stroke="currentColor" stroke-width="2.5"${item.key==='t'?' stroke-dasharray="7 5"':''}/>`;
    }).join('');
    const points=chart.series.map(item=>item.points.map(point=>{
      const toward=point.side==='early'?-1:1;
      const leader=point.leader?`<polyline class="ep-slope-leader" points="${point.x+toward*6},${coordinate(point.y)} ${point.labelX-toward*3},${coordinate(point.labelY)}" fill="none" stroke="currentColor" stroke-width="1" opacity=".6"/>`:'';
      return `<g class="ep-slope-${item.key}">${leader}<circle class="ep-slope-point" cx="${point.x}" cy="${coordinate(point.y)}" r="${item.key==='k'?3.5:5}" fill="${item.key==='k'?'currentColor':'none'}" stroke="currentColor" stroke-width="2"/><text class="ep-slope-value" x="${point.labelX}" y="${coordinate(point.labelY)}" text-anchor="${point.anchor}" dominant-baseline="middle" fill="currentColor" font-size="14" font-weight="600">${esc(item.label)} ${esc(formatted(point.value))}</text></g>`;
    }).join('')).join('');
    const reference=chart.reference?(()=>{
      const point=chart.reference,x=point.x,y=coordinate(point.y);
      const leader=point.leader?`<polyline class="ep-slope-reference-leader" points="${x+5},${y} ${point.labelX-3},${coordinate(point.labelY)}" fill="none" stroke="currentColor" stroke-width="1" opacity=".7"/>`:'';
      return `<g class="ep-slope-reference" style="color:var(--ink2, #59676c)">${leader}<path class="ep-slope-reference-mark" d="M ${x} ${coordinate(point.y-4)} L ${x+4} ${y} L ${x} ${coordinate(point.y+4)} L ${x-4} ${y} Z" fill="none" stroke="currentColor" stroke-width="1.5"/><text class="ep-slope-reference-value" x="${point.labelX}" y="${coordinate(point.labelY)}" text-anchor="start" dominant-baseline="middle" fill="currentColor" font-size="14">Expected K ${esc(formatted(point.value))}</text></g>`;
    })():'';
    return `<svg class="ep-slope-chart" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${esc(description)}" focusable="false"><title>${esc(description)}</title><g font-family="inherit"><text class="ep-slope-heading" x="${LEFT}" y="21" text-anchor="middle" fill="var(--ink, #243438)" font-size="14" font-weight="600">${esc(source)}</text><text class="ep-slope-heading" x="${RIGHT}" y="21" text-anchor="middle" fill="var(--ink, #243438)" font-size="14" font-weight="600">${esc(target)}</text>${ticks}${lines}${points}${reference}<text x="${WIDTH/2}" y="201" text-anchor="middle" fill="var(--ink2, #59676c)" font-size="12.5">${esc(unit)} · scale 0–${esc(formatted(chart.ceiling))}</text></g></svg>`;
  }

  const api={layout,svg};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.EchoEvidenceSlopeChart=api;
})(typeof window!=='undefined'?window:globalThis);
