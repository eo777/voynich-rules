/* A common frequency denominator keeps early and later K/T gaps comparable. */
(function(root){
  'use strict';
  const OUTCOMES=Object.freeze(['flat','converge','diverge','inversion','inversionPlus']);
  const COLORS=Object.freeze({flat:'#77838a',converge:'#287ca4',diverge:'#bb8025',inversion:'#9361ab',inversionPlus:'#248564'});
  const GAP_TOLERANCE=.10,EPSILON=1e-10;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const coord=value=>Math.round(value*1000)/1000;
  const numeric=value=>Number.isFinite(value)?Number(value.toPrecision(6)).toString():'—';
  const percent=value=>numeric(value*100)+'%';
  const intersects=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  function segmentIntersectsBox(line,box){
    let low=0,high=1;
    for(const [start,delta,min,max] of [[line.x1,line.x2-line.x1,box.left,box.right],[line.y1,line.y2-line.y1,box.top,box.bottom]]){
      if(Math.abs(delta)<1e-9){if(start<=min||start>=max)return false;continue;}
      const one=(min-start)/delta,two=(max-start)/delta;
      low=Math.max(low,Math.min(one,two));high=Math.min(high,Math.max(one,two));
      if(high<=low)return false;
    }
    return high>0&&low<1;
  }
  function leadersCross(a,b){
    const cross=(x,y,u,v)=>x*v-y*u,ax=a.x2-a.x1,ay=a.y2-a.y1,bx=b.x2-b.x1,by=b.y2-b.y1;
    const denominator=cross(ax,ay,bx,by);if(Math.abs(denominator)<1e-9)return false;
    const dx=b.x1-a.x1,dy=b.y1-a.y1,t=cross(dx,dy,bx,by)/denominator,u=cross(dx,dy,ax,ay)/denominator;
    return t>0&&t<1&&u>0&&u<1;
  }
  const textBox=(text,x,y,size,anchor='middle',angle=0)=>{
    const width=String(text).length*size*.62+6,height=size+6;
    const centerX=x+(anchor==='start'?width/2:anchor==='end'?-width/2:0);
    const radians=angle*Math.PI/180,halfWidth=(Math.abs(width*Math.cos(radians))+Math.abs(height*Math.sin(radians)))/2;
    const halfHeight=(Math.abs(width*Math.sin(radians))+Math.abs(height*Math.cos(radians)))/2;
    return {left:centerX-halfWidth,right:centerX+halfWidth,top:y-halfHeight,bottom:y+halfHeight};
  };
  function placePointLabels(points,stacks,regions,referenceLabels,plot,range,angle,options){
    const limit=options.labelLimit??0;
    if(!Number.isInteger(limit)||limit<0||limit>5)throw Error('Invalid point label limit');
    const obstacles=[
      ...points.map(point=>({left:point.px-8,right:point.px+8,top:point.py-8,bottom:point.py+8})),
      ...stacks.filter(stack=>stack.count>1).map(stack=>({left:stack.badgeX-14,right:stack.badgeX+14,top:stack.badgeY-12,bottom:stack.badgeY+12})),
      ...regions.map(region=>textBox(region.label,region.labelAt.px,region.labelAt.py,region.outcome==='flat'?12:14,'middle',region.outcome==='flat'?angle:0)),
      ...referenceLabels.map(label=>textBox(label.label,label.x,label.y,11.5,label.anchor))
    ],placed=[];
    const selected=point=>point.id===options.selectedId;
    const candidates=points.filter(point=>selected(point)||(Number.isFinite(point.sourceCount)&&Number.isFinite(point.targetCount)&&point.sourceCount>=10&&point.targetCount>=10)).sort((a,b)=>
      Number(selected(b))-Number(selected(a))||Math.min(b.sourceCount,b.targetCount)-Math.min(a.sourceCount,a.targetCount)||
      (b.sourceCount+b.targetCount)-(a.sourceCount+a.targetCount)||(a.id<b.id?-1:a.id>b.id?1:0));
    for(const point of candidates){
      if(placed.length>=limit)break;
      const fullLabel=String(point.label||point.shortLabel||point.id),shortLabel=String(point.shortLabel||point.label||point.id);
      const text=shortLabel.length>32?shortLabel.slice(0,31)+'…':shortLabel;
      const positionAt=(x,y,anchor)=>{
        const bounds=textBox(text,x,y,12.5,anchor);
        if(bounds.left<plot.left+2||bounds.right>plot.right-2||bounds.top<plot.top+2||bounds.bottom>plot.bottom-2)return null;
        // Text must remain close to its marker and in the same outcome region.
        // A label is optional. Moving it into another region is misleading.
        const centerX=(bounds.left+bounds.right)/2,centerY=(bounds.top+bounds.bottom)/2;
        const dataX=(centerX-plot.left)/(plot.right-plot.left)*range.xMax;
        const dataY=range.yMax-(centerY-plot.top)/(plot.bottom-plot.top)*(range.yMax-range.yMin);
        const region=dataY<0?'inversion':Math.abs(dataY-dataX)<=GAP_TOLERANCE?'flat':dataY>dataX?'diverge':'converge';
        if(region!==(point.outcome==='inversionPlus'?'inversion':point.outcome))return null;
        if(obstacles.some(box=>intersects(bounds,box))||placed.some(label=>intersects(bounds,label.bounds)||segmentIntersectsBox(label.leader,bounds)))return null;
        const endX=Math.max(bounds.left,Math.min(bounds.right,point.px)),endY=Math.max(bounds.top,Math.min(bounds.bottom,point.py));
        const dx=endX-point.px,dy=endY-point.py,length=Math.hypot(dx,dy);
        if(length>40)return null;
        const leader={x1:point.px,y1:point.py,x2:endX,y2:endY};
        if(placed.some(label=>segmentIntersectsBox(leader,label.bounds)))return null;
        return {id:point.id,text,fullLabel,selected:selected(point),outcome:point.outcome,x,y,anchor,bounds,leader};
      };
      let position=null;
      for(const distance of [12,28,48,72]){
        const locations=[
          [point.px+distance,point.py,'start'],[point.px-distance,point.py,'end'],
          [point.px,point.py-distance-9,'middle'],[point.px,point.py+distance+9,'middle'],
          [point.px+distance,point.py-distance,'start'],[point.px-distance,point.py-distance,'end'],
          [point.px+distance,point.py+distance,'start'],[point.px-distance,point.py+distance,'end']
        ];
        for(const [x,y,anchor] of locations){
          position=positionAt(x,y,anchor);if(position)break;
        }
        if(position)break;
      }
      // Dense clouds may block radial placements. Search for a nearby clear
      // box within the same region, never forcing a distant label to fill quota.
      if(!position){
        const template=textBox(text,0,0,12.5,'start'),width=template.right-template.left,height=template.bottom-template.top;
        let bestScore=Infinity;
        for(let y=plot.top+height/2+2;y<=plot.bottom-height/2-2;y+=8){
          for(let x=plot.left+2;x<=plot.right-width-2;x+=8){
            const candidate=positionAt(x,y,'start');if(!candidate)continue;
            const leader=candidate.leader,length=Math.hypot(leader.x2-leader.x1,leader.y2-leader.y1);
            const score=length+obstacles.filter(box=>segmentIntersectsBox(leader,box)).length*8+
              placed.filter(label=>leadersCross(leader,label.leader)).length*36;
            if(score<bestScore){bestScore=score;position=candidate;}
          }
        }
      }
      if(position)placed.push(position);
    }
    return {pointLabels:placed,labelObstacles:obstacles};
  }
  const fitExtent=value=>{
    const required=Math.max(.2,value),power=10**Math.floor(Math.log10(required));
    return Math.min(2,[1,2,5,10].find(step=>step*power>=required-EPSILON)*power);
  };
  function tickValues(max){
    const power=10**Math.floor(Math.log10(max/5)),step=[1,2,5,10].find(value=>value*power>=max/5-EPSILON)*power,values=[];
    for(let i=0;i*step<max-EPSILON;i++)values.push(Number((i*step).toPrecision(10)));
    values.push(max);return values;
  }
  function clipPolygon(vertices,xMax,yMax){
    let result=vertices;
    for(const [axis,bound,direction] of [[0,xMax,1],[1,yMax,1],[1,-yMax,-1]]){
      const clipped=[];
      for(let i=0;i<result.length;i++){
        const start=result[i],end=result[(i+1)%result.length],insideStart=direction*(start[axis]-bound)<=0,insideEnd=direction*(end[axis]-bound)<=0;
        if(insideStart)clipped.push(start);
        if(insideStart!==insideEnd){const t=(bound-start[axis])/(end[axis]-start[axis]);clipped.push([start[0]+t*(end[0]-start[0]),start[1]+t*(end[1]-start[1])]);}
      }
      result=clipped;
    }
    return result;
  }
  function centroid(vertices){
    let area=0,x=0,y=0;
    for(let i=0;i<vertices.length;i++){
      const a=vertices[i],b=vertices[(i+1)%vertices.length],cross=a[0]*b[1]-b[0]*a[1];
      area+=cross;x+=(a[0]+b[0])*cross;y+=(a[1]+b[1])*cross;
    }
    return Math.abs(area)>1e-15?[x/(3*area),y/(3*area)]:null;
  }

  /**
   * x = |early K - early T| / M; y is the signed later gap / M, oriented
   * toward the initial majority. M is the mean early/later family frequency.
   * Nonnegative frequencies imply x + |y| <= 2. The comparison core supplies
   * both coordinates and outcomes; this renderer never normalizes them again.
   * Repeated coordinates retain every point at the exact same data location.
   */
  function layout(input,options={}){
    const width=options.width??760,height=options.height??420;
    if(!Number.isFinite(width)||width<700||width>1100||!Number.isFinite(height)||height<320||height>600)throw Error('Invalid scatter dimensions');
    const xMax=options.xMax??fitExtent(Math.max(0,...input.filter(row=>Number.isFinite(row.x)).map(row=>row.x)));
    const yMax=options.yMax??fitExtent(Math.max(0,...input.filter(row=>Number.isFinite(row.y)).map(row=>Math.abs(row.y))));
    if(!Number.isFinite(xMax)||xMax<=0||xMax>2||!Number.isFinite(yMax)||yMax<=0||yMax>2)throw Error('Invalid scatter viewport');
    const plot={left:88,right:width-30,top:24,bottom:height-58},range={xMin:0,xMax,yMin:-yMax,yMax},physicalRange={xMin:0,xMax:2,yMin:-2,yMax:2};
    const px=value=>plot.left+value/xMax*(plot.right-plot.left),py=value=>plot.bottom-(value+yMax)/(2*yMax)*(plot.bottom-plot.top);
    const vertex=([x,y])=>({x,y,px:px(x),py:py(y)});
    const polygon=vertices=>vertices.map(vertex);
    const a=GAP_TOLERANCE,b=(2-GAP_TOLERANCE)/2,c=(2+GAP_TOLERANCE)/2;
    const regions=[
      {outcome:'diverge',label:'Diverge',vertices:[[0,a],[0,2],[b,c]]},
      {outcome:'converge',label:'Converge',vertices:[[a,0],[2,0],[c,b]]},
      {outcome:'flat',label:'Flat',vertices:[[0,0],[a,0],[c,b],[b,c],[0,a]]},
      {outcome:'inversion',label:'Inversion',vertices:[[0,0],[2,0],[0,-2]]}
    ].map(region=>({...region,physicalVertices:region.vertices,vertices:clipPolygon(region.vertices,xMax,yMax)}))
      .filter(region=>centroid(region.vertices)).map(region=>({...region,labelAt:vertex(centroid(region.vertices)),vertices:polygon(region.vertices)}));
    const domain=polygon(clipPolygon([[0,2],[2,0],[0,-2]],xMax,yMax)),diagonalEnd=Math.min(1,xMax,yMax);
    const references={zero:polygon([[0,0],[xMax,0]]),unchanged:polygon([[0,0],[diagonalEnd,diagonalEnd]]),equalReversed:polygon([[0,0],[diagonalEnd,-diagonalEnd]])};
    const points=[],excluded=[],ids=new Set(),stackMap=new Map();
    for(const row of input){
      if(typeof row.id!=='string'||ids.has(row.id))throw Error('Scatter point IDs must be unique strings');ids.add(row.id);
      if(!Number.isFinite(row.x)||!Number.isFinite(row.y)){excluded.push({...row});continue;}
      if(row.x<0||row.x>2||row.y< -2||row.y>2)throw Error('Scatter coordinate outside bounded range');
      if(row.x+Math.abs(row.y)>2+EPSILON)throw Error('Scatter coordinate outside feasible triangle');
      if(row.x>xMax+EPSILON||Math.abs(row.y)>yMax+EPSILON)throw Error('Scatter coordinate outside viewport');
      if(!OUTCOMES.includes(row.outcome))throw Error('Unknown scatter outcome');
      const point={...row,eligible:row.eligible===true,px:px(row.x),py:py(row.y),radius:3.6};
      points.push(point);
      const key=JSON.stringify([row.x,row.y]);
      if(!stackMap.has(key))stackMap.set(key,{key,x:row.x,y:row.y,px:point.px,py:point.py,ids:[],points:[]});
      stackMap.get(key).ids.push(row.id);stackMap.get(key).points.push(point);
    }
    const stacks=[...stackMap.values()].map(stack=>({...stack,count:stack.ids.length,
      badgeX:Math.min(plot.right-12,Math.max(plot.left+12,stack.px+13)),
      badgeY:Math.min(plot.bottom-11,Math.max(plot.top+11,stack.py-13))}));
    for(const stack of stacks)for(const point of stack.points){point.stackCount=stack.count;point.stackIds=[...stack.ids];}
    const angle=-Math.atan2((plot.bottom-plot.top)/(2*yMax),(plot.right-plot.left)/xMax)*180/Math.PI;
    const referenceLabels=[{name:'unchanged',label:'Unchanged gap',direction:-1},{name:'equalReversed',label:'Equal reversed gap',direction:1}].map(reference=>{
      const end=references[reference.name][1],left=end.px>plot.right-160,x=left?end.px-16:end.px+38;
      const y=Math.max(plot.top+10,Math.min(plot.bottom-10,end.py+reference.direction*18));
      return {...reference,x,y,anchor:left?'end':'start',leader:{x1:end.px+(left?-4:5),y1:end.py,x2:x+(left?8:-8),y2:y}};
    });
    const pointLabelLayout=placePointLabels(points,stacks,regions,referenceLabels,plot,range,angle,options);
    const xTicks=tickValues(xMax).map(value=>({value,label:percent(value),px:px(value),top:py(Math.min(yMax,2-value)),bottom:py(-Math.min(yMax,2-value))}));
    const positiveY=tickValues(yMax),yTicks=[...positiveY.slice(1).reverse().map(value=>-value),...positiveY].map(value=>({value,label:percent(value),py:py(value),right:px(Math.min(xMax,2-Math.abs(value)))}));
    return {width,height,plot,range,physicalRange,gapTolerance:GAP_TOLERANCE,domain,regions,references,referenceLabels,points,stacks,excluded,excludedCount:excluded.length,xTicks,yTicks,...pointLabelLayout};
  }
  function description(point,measure){
    const leader=String(point.initialLeader??'').toUpperCase();
    const initial=leader==='BALANCED'?'Early K and T are equal.':leader==='K'||leader==='T'?`Initial majority ${leader}.`:'';
    const direction=leader==='BALANCED'?'':point.y<0?'The later majority changes.':point.y===0?'The later frequencies are balanced.':'The initial majority is preserved.';
    return `${point.label||point.id}. Early K/T gap ${percent(point.x)}. Later K/T gap ${percent(point.y)}${measure==='share'?' in group shares':' of mean family frequency'}. ${initial}${initial&&direction?' ':''}${direction} Early count ${numeric(point.sourceCount)}. Later count ${numeric(point.targetCount)}. Excess frequency ${numeric(point.excessRate)} per 10,000 words. ${point.eligible?'Meets':'Below'} the count threshold.${point.stackCount>1?' '+point.stackCount+' groups share these coordinates.':''}`;
  }
  function svg(input,options={}){
    const chart=layout(input,options),p=chart.plot,axis='var(--ink2, #59676c)',grid='var(--line, #d6dddd)',ink='var(--ink, #243438)';
    const title=`${chart.points.length} word groups. ${options.measure==='share'?'Early and later K/T gaps are differences in group shares.':'Early and later K/T gaps use the same mean family frequency denominator.'} Positive later gaps preserve the initial majority. Negative gaps mark inversion. Initially balanced groups have no early majority. The flat band is within 10 percentage points of the early gap and excludes inversions.${chart.excludedCount?' '+chart.excludedCount+' groups have undefined coordinates.':''}`;
    const polygon=vertices=>vertices.map(v=>`${coord(v.px)},${coord(v.py)}`).join(' ');
    const line=(vertices,attributes)=>`<line x1="${coord(vertices[0].px)}" y1="${coord(vertices[0].py)}" x2="${coord(vertices[1].px)}" y2="${coord(vertices[1].py)}" ${attributes}/>`;
    const regions=chart.regions.map(region=>`<polygon class="eos-region eos-${region.outcome}-zone" points="${polygon(region.vertices)}" fill="var(--eo-${region.outcome}, ${COLORS[region.outcome]})" fill-opacity="${region.outcome==='flat'?'.16':'.10'}"/>`).join('');
    const ticks=chart.xTicks.map(tick=>`<g class="eos-x-tick"><line x1="${coord(tick.px)}" y1="${coord(tick.top)}" x2="${coord(tick.px)}" y2="${coord(tick.bottom)}" stroke="${grid}" stroke-width=".7"/><text x="${coord(tick.px)}" y="${p.bottom+24}" text-anchor="middle" fill="${axis}" font-size="12.5">${tick.label}</text></g>`).join('')+
      chart.yTicks.map(tick=>`<g class="eos-y-tick${tick.value===0?' eos-zero-tick':''}">${tick.value===0?'':`<line x1="${p.left}" y1="${coord(tick.py)}" x2="${coord(tick.right)}" y2="${coord(tick.py)}" stroke="${grid}" stroke-width=".7"/>`}<text x="${p.left-12}" y="${coord(tick.py)}" text-anchor="end" dominant-baseline="middle" fill="${axis}" font-size="12.5"${tick.value===0?' font-weight="700"':''}>${tick.label}</text></g>`).join('');
    const angle=-Math.atan2((p.bottom-p.top)/(2*chart.range.yMax),(p.right-p.left)/chart.range.xMax)*180/Math.PI;
    const labels=chart.regions.map(region=>`<text class="eos-region-label eos-${region.outcome}-label" x="${coord(region.labelAt.px)}" y="${coord(region.labelAt.py)}" text-anchor="middle" dominant-baseline="middle"${region.outcome==='flat'?` transform="rotate(${coord(angle)} ${coord(region.labelAt.px)} ${coord(region.labelAt.py)})"`:''} fill="var(--eo-${region.outcome}, ${COLORS[region.outcome]})" stroke="var(--panel, #fff)" stroke-width="3" paint-order="stroke" font-size="${region.outcome==='flat'?12:14}" font-weight="600">${region.label}</text>`).join('');
    const referenceLabels=chart.referenceLabels.map(reference=>`<g class="eos-reference-label"><path d="M${coord(reference.leader.x1)} ${coord(reference.leader.y1)} L${coord(reference.leader.x2)} ${coord(reference.leader.y2)}" fill="none" stroke="${axis}" stroke-width=".8"/><text x="${coord(reference.x)}" y="${coord(reference.y)}" text-anchor="${reference.anchor}" dominant-baseline="middle" fill="${axis}" stroke="var(--panel, #fff)" stroke-width="3" paint-order="stroke" font-size="11.5">${reference.label}</text></g>`).join('');
    const pointLabels=chart.pointLabels.map(label=>{
      const color=`var(--eo-${label.outcome}, ${COLORS[label.outcome]})`,path=`M${coord(label.leader.x1)} ${coord(label.leader.y1)} L${coord(label.leader.x2)} ${coord(label.leader.y2)}`;
      return `<g class="eos-point-label${label.selected?' selected':''}" data-outcome-point="${esc(label.id)}" role="button" tabindex="0" aria-label="${esc('Inspect '+label.fullLabel)}"><title>${esc(label.fullLabel)}</title><path class="eos-label-leader-halo" d="${path}" fill="none" stroke="var(--panel, #fff)" stroke-width="3.5" vector-effect="non-scaling-stroke" pointer-events="none"/><path class="eos-label-leader" data-leader-for="${esc(label.id)}" d="${path}" fill="none" stroke="${color}" stroke-width="1.3" stroke-linecap="round" vector-effect="non-scaling-stroke" pointer-events="none"/><text x="${coord(label.x)}" y="${coord(label.y)}" text-anchor="${label.anchor}" dominant-baseline="middle" fill="${color}" stroke="var(--panel, #fff)" stroke-width="4" paint-order="stroke" font-size="12.5" font-weight="${label.selected?'700':'600'}">${esc(label.text)}</text></g>`;
    }).join('');
    const marks=chart.points.map(point=>{
      const color=`var(--eo-${point.outcome}, ${COLORS[point.outcome]})`,label=description(point,options.measure),selected=options.selectedId===point.id;
      return `<g class="eos-point eos-${point.outcome}${point.eligible?'':' eos-sparse'}${selected?' selected':''}" data-outcome-point="${esc(point.id)}" role="button" tabindex="0" aria-label="${esc(label)}"><title>${esc(label)}</title>${selected?`<circle class="eos-selection" cx="${coord(point.px)}" cy="${coord(point.py)}" r="7" fill="none" stroke="${ink}" stroke-width="1.5"/>`:''}<circle class="eos-mark" cx="${coord(point.px)}" cy="${coord(point.py)}" r="${point.radius}" fill="${point.eligible?color:'var(--panel, #fff)'}" stroke="${color}" stroke-width="1.4"/><circle class="eos-hit" cx="${coord(point.px)}" cy="${coord(point.py)}" r="7" fill="transparent"/></g>`;
    }).join('');
    const stacks=chart.stacks.filter(stack=>stack.count>1).map(stack=>{
      const label=stack.count+' groups at the same coordinates',labels=stack.points.map(point=>point.label||point.id).join(', ');
      return `<g class="eos-stack" data-outcome-point="${esc(stack.ids[0])}" data-outcome-stack="${esc(JSON.stringify(stack.ids))}" role="button" tabindex="0" aria-label="${esc(label+'. '+labels)}"><title>${esc(label+'. '+labels)}</title><line x1="${coord(stack.px)}" y1="${coord(stack.py)}" x2="${coord(stack.badgeX)}" y2="${coord(stack.badgeY)}" stroke="${axis}" stroke-width=".8"/><rect x="${coord(stack.badgeX-12)}" y="${coord(stack.badgeY-10)}" width="24" height="20" rx="7" fill="var(--panel, #fff)" stroke="${grid}"/><text x="${coord(stack.badgeX)}" y="${coord(stack.badgeY)}" text-anchor="middle" dominant-baseline="middle" fill="${axis}" font-size="12.5" font-weight="600">${stack.count}</text></g>`;
    }).join('');
    return `<svg class="eos-scatter" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${chart.width} ${chart.height}" role="group" aria-label="${esc(title)}"><title>${esc(title)}</title><g font-family="inherit">${regions}${ticks}<polygon class="eos-domain" points="${polygon(chart.domain)}" fill="none" stroke="${grid}" stroke-width="1"/>${line(chart.references.zero,`class="eos-zero" stroke="${axis}" stroke-width="1.5"`)}${line(chart.references.unchanged,`class="eos-unchanged" stroke="${axis}" stroke-width="1.1"`)}${line(chart.references.equalReversed,`class="eos-equal-reversed" stroke="${axis}" stroke-width="1" stroke-dasharray="4 4"`)}${labels}${referenceLabels}${pointLabels}${marks}${stacks}<text class="eos-axis-label" x="${coord((p.left+p.right)/2)}" y="${chart.height-7}" text-anchor="middle" fill="${ink}" font-size="14">Early K/T gap</text><text class="eos-axis-label" x="20" y="${coord((p.top+p.bottom)/2)}" transform="rotate(-90 20 ${coord((p.top+p.bottom)/2)})" text-anchor="middle" fill="${ink}" font-size="14">Later K/T gap</text></g></svg>`;
  }
  const api={OUTCOMES,GAP_TOLERANCE,layout,svg};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.EchoEvidenceOutcomeScatter=api;
})(typeof window!=='undefined'?window:globalThis);
