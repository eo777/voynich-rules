/* Display-only drilldown over one complete-family allocation. */
(function(root){
  'use strict';
  const E=typeof module!=='undefined'&&module.exports?require('./evidence_core.js'):root.EchoEvidenceCore;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=v=>Number(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const kinds={swap:'t → k',edited:'Other transformations',kept:'Unchanged spellings'};
  const total=rows=>rows.reduce((a,r)=>a+r.mass,0);
  const sectionLabel=(s,key)=>({HA_late:'Late A',PharmaA:'Pharma',Hand1_late:'Late A + Pharma',HB_all:'Herbal B'}[key]||s.sections.find(p=>p.key===key).label);
  function name(s,w,level){
    if(level==='words')return w;
    const x=s.words[w],stem=x.prefix+x.g,t=x.tail;
    if(level==='gallows')return stem+'*';
    const tail=/^(ol|or)$/.test(t)?'ol / or':/^(eol|eor)$/.test(t)?'eol / eor':t.startsWith('ch')?'ch…':t.startsWith('sh')?'sh…':t.startsWith('ee')?'ee…':t==='y'?'y':t==='edy'?'edy':t==='aiin'?'aiin':t==='ain'?'ain':'other endings';
    return stem+' + '+tail;
  }
  function witness(s,f,c,state){
    const z=state.allocation==='before'?c.base:c.withRule,edges=new Map(f.routes.map(r=>[r.source+'>'+r.target,r]));
    const rows=z.routes.map(r=>{const trace=edges.get(r.from+'>'+r.to);return {...r,kind:r.from===r.to?'kept':trace?.exchange?'swap':'edited',steps:trace?.steps||[]};});
    if(state.basis==='signed'){
      const a=E.rates(s,f,s.source),b=E.rates(s,f,state.target);
      for(const w of f.words){const mass=Math.min(a.get(w),b.get(w));if(mass>1e-8)rows.push({from:w,to:w,mass,kind:'kept',steps:[]});}
    }
    return rows;
  }
  function scope(s,rows,state){
    let out=state.flowKind&&state.flowKind!=='all'?rows.filter(r=>r.kind===state.flowKind):rows;
    for(const p of state.trail||[])out=out.filter(r=>r.kind===p.kind&&name(s,r.from,p.level)===p.from&&name(s,r.to,p.level)===p.to);
    if(state.focus)out=out.filter(r=>r.from===state.focus||r.to===state.focus);
    return out;
  }
  function aggregate(s,rows,level){
    const m=new Map();for(const r of rows){const from=name(s,r.from,level),to=name(s,r.to,level),key=[r.kind,from,to].join('|');
      if(!m.has(key))m.set(key,{from,to,kind:r.kind,mass:0,rows:[]});const x=m.get(key);x.mass+=r.mass;x.rows.push(r);}
    return [...m.values()].sort((a,b)=>b.mass-a.mass||a.from.localeCompare(b.from)||a.to.localeCompare(b.to));
  }
  function overviewLayout(s,f,c,state){
    const a=E.rates(s,f,s.source),b=E.rates(s,f,state.target),rows=witness(s,f,c,state),z=state.allocation==='before'?c.base:c.withRule;
    const groups=new Map();
    for(const w of f.words){const id=name(s,w,'gallows');if(!groups.has(id))groups.set(id,{id,g:s.words[w].g,words:[],a:0,b:0});const q=groups.get(id);q.words.push(w);q.a+=a.get(w);q.b+=b.get(w);}
    const ordered=[...groups.values()].filter(q=>q.a>1e-8||q.b>1e-8).sort((x,y)=>x.g.localeCompare(y.g)||x.id.localeCompare(y.id));
    const scale=210/Math.max(1,ordered.reduce((v,q)=>v+Math.max(q.a,q.b),0));
    let y=52;for(const q of ordered){q.y=y;y+=Math.max(q.a,q.b)*scale+34;}
    const nodes=key=>ordered.filter(q=>q[key]>1e-8).map(q=>({id:q.id,g:q.g,words:q.words,mass:q[key],used:0,rest:0,y:q.y,h:q[key]*scale,offset:0}));
    const left=nodes('a'),right=nodes('b'),lm=new Map(left.map(q=>[q.id,q])),rm=new Map(right.map(q=>[q.id,q]));
    const rank=new Map(ordered.map((q,i)=>[q.id,i])),kindRank={kept:0,edited:1,swap:2};
    const links=aggregate(s,rows,'gallows').sort((x,y)=>rank.get(x.from)-rank.get(y.from)||rank.get(x.to)-rank.get(y.to)||kindRank[x.kind]-kindRank[y.kind]);
    for(const l of links){const x=lm.get(l.from),q=rm.get(l.to);l.width=l.mass*scale;l.y1=x.y+x.offset;l.y2=q.y+q.offset;x.offset+=l.width;q.offset+=l.width;x.used+=l.mass;q.used+=l.mass;
      l.path='M160 '+l.y1+' C300 '+l.y1+',400 '+l.y2+',535 '+l.y2+' L535 '+(l.y2+l.width)+' C400 '+(l.y2+l.width)+',300 '+(l.y1+l.width)+',160 '+(l.y1+l.width)+'Z';}
    for(const q of [...left,...right])q.rest=Math.max(0,q.mass-q.used);
    return {left,right,links,scale,height:Math.max(180,y+10),credit:z.credit,unplaced:z.unplaced,unfilled:z.unfilled};
  }
  const connectionKey=x=>[x.kind,x.from,x.to].join('|');
  function ribbonPath(x1,y1,x2,y2,width){
    const bend=(x2-x1)*.43;
    return `M${x1} ${y1} C${x1+bend} ${y1},${x2-bend} ${y2},${x2} ${y2} L${x2} ${y2+width} C${x2-bend} ${y2+width},${x1+bend} ${y1+width},${x1} ${y1+width}Z`;
  }
  function bypassPath(segment,lane){
    const {x1,x2,y1,y2,width:h}=segment,{left,right,y}=lane,a=(left-x1)*.45,b=(x2-right)*.45;
    return `M${x1} ${y1} C${x1+a} ${y1},${left-a*.45} ${y},${left} ${y} L${right} ${y} C${right+b*.45} ${y},${x2-b} ${y2},${x2} ${y2} L${x2} ${y2+h} C${x2-b} ${y2+h},${right+b*.45} ${y+h},${right} ${y+h} L${left} ${y+h} C${left-a*.45} ${y+h},${x1+a} ${y1+h},${x1} ${y1+h}Z`;
  }
  function hierarchyLayout(s,f,c,state){
    const overview=overviewLayout(s,f,c,state),trail=state.trail||[],parent=overview.links.find(l=>trail[0]&&connectionKey(l)===connectionKey(trail[0]));
    const endings=parent?aggregate(s,parent.rows,'endings'):[],ending=endings.find(l=>trail[1]&&connectionKey(l)===connectionKey(trail[1]));
    const depth=ending?2:parent?1:0,canvasWidth=Number(state.canvasWidth),fit=Number.isFinite(canvasWidth)&&canvasWidth>0;
    const width=depth===2?Math.max(1320,fit?canvasWidth:1580):depth===1?Math.max(920,fit?canvasWidth:1160):700;
    const chartScale=depth===2&&state.chartScale!=='actual'?'fit':'actual',displayWidth=chartScale==='fit'?Math.min(width,Math.max(600,fit?canvasWidth:width)):width,fitFactor=width/displayWidth;
    const targetX=depth?width-165:535,endingSource=fit?330:350,endingTarget=fit?targetX-200:depth===2?1215:795;
    const x={source:148,target:targetX,endingSource,endingTarget,wordSource:fit?endingSource+210:620,wordTarget:fit?endingTarget-210:945};
    const left=overview.left.map(q=>({...q,x:x.source})),right=overview.right.map(q=>({...q,x:x.target}));
    const columns=[],segments=[],scale=overview.scale,bypassLinks=ending?endings.filter(l=>l!==ending):[],bypassGap=8*fitFactor;
    const bypassHeight=total(bypassLinks)*scale+Math.max(0,bypassLinks.length-1)*bypassGap;
    const branchTop=overview.height+12+(bypassLinks.length?bypassHeight+24*fitFactor:0);
    let bypassY=overview.height+12;
    const pack=(rows,side,level,pos)=>{
      const groups=new Map();
      for(const r of rows){const id=name(s,r[side],level);if(!groups.has(id))groups.set(id,{id,mass:0,rows:[],words:[]});const q=groups.get(id);q.mass+=r.mass;q.rows.push(r);if(!q.words.includes(r[side]))q.words.push(r[side]);}
      let y=branchTop+52*fitFactor;
      return [...groups.values()].sort((a,b)=>a.id.localeCompare(b.id)).map(q=>{const node={...q,x:pos,y,h:q.mass*scale,offset:0};y+=node.h+32*fitFactor;return node;});
    };
    const add=(link,level,stage,x1,y1,x2,y2)=>{
      const segment={...link,level,stage,x1,x2,y1,y2,width:link.mass*scale};segment.path=ribbonPath(x1,y1,x2,y2,segment.width);segments.push(segment);return segment;
    };
    for(const l of overview.links)if(l!==parent)add(l,'gallows','overview',x.source+12,l.y1,x.target,l.y2);
    if(parent){
      const endingLeft=pack(parent.rows,'from','endings',x.endingSource),endingRight=pack(parent.rows,'to','endings',x.endingTarget);
      columns.push({id:'endingSource',title:'Source endings',side:'from',level:'endings',nodes:endingLeft},{id:'endingTarget',title:'Target endings',side:'to',level:'endings',nodes:endingRight});
      const lm=new Map(endingLeft.map(q=>[q.id,q])),rm=new Map(endingRight.map(q=>[q.id,q]));
      let leftOffset=0,rightOffset=0;
      for(const q of endingLeft){add({...parent,mass:q.mass,rows:q.rows},'gallows','enter-endings',x.source+12,parent.y1+leftOffset,q.x,q.y);leftOffset+=q.h;}
      for(const q of endingRight){add({...parent,mass:q.mass,rows:q.rows},'gallows','leave-endings',q.x+12,q.y,x.target,parent.y2+rightOffset);rightOffset+=q.h;}
      for(const l of endings){
        const a=lm.get(l.from),b=rm.get(l.to),y1=a.y+a.offset,y2=b.y+b.offset,w=l.mass*scale;a.offset+=w;b.offset+=w;
        if(l!==ending){
          const segment=add(l,'endings','endings',a.x+12,y1,b.x,y2);
          if(ending){segment.bypass={left:x.wordSource-28,right:x.wordTarget+40,y:bypassY,h:segment.width};segment.path=bypassPath(segment,segment.bypass);bypassY+=segment.width+bypassGap;}
          continue;
        }
        const wordLeft=pack(l.rows,'from','words',x.wordSource),wordRight=pack(l.rows,'to','words',x.wordTarget),wl=new Map(wordLeft.map(q=>[q.id,q])),wr=new Map(wordRight.map(q=>[q.id,q]));
        columns.push({id:'wordSource',title:'Source words',side:'from',level:'words',nodes:wordLeft},{id:'wordTarget',title:'Target words',side:'to',level:'words',nodes:wordRight});
        let sourceOffset=0,targetOffset=0;
        for(const q of wordLeft){add({...l,mass:q.mass,rows:q.rows},'endings','enter-words',a.x+12,y1+sourceOffset,q.x,q.y);sourceOffset+=q.h;}
        for(const q of wordRight){add({...l,mass:q.mass,rows:q.rows},'endings','leave-words',q.x+12,q.y,b.x,y2+targetOffset);targetOffset+=q.h;}
        for(const r of l.rows){const u=wl.get(r.from),v=wr.get(r.to),h=r.mass*scale;add({...r,rows:[r]},'words','words',u.x+12,u.y+u.offset,v.x,v.y+v.offset);u.offset+=h;v.offset+=h;}
      }
    }
    const height=Math.max(overview.height,...columns.flatMap(col=>col.nodes.map(q=>q.y+q.h+34*fitFactor)));
    return {overview,left,right,columns,segments,scale,height,width,displayWidth,fitFactor,chartScale,depth,parent,ending,branchTop,credit:overview.credit,unplaced:overview.unplaced,unfilled:overview.unfilled};
  }
  function render(s,f,c,state,detail){
    const rows=witness(s,f,c,state),m=hierarchyLayout(s,f,c,state),actions=[],chosen=m.parent;
    const selected=l=>chosen?l.stage!=='overview':state.focus?l.rows.some(r=>r.from===state.focus||r.to===state.focus):state.flowKind&&state.flowKind!=='all'?l.kind===state.flowKind:true;
    const hasSelection=!!(chosen||state.focus||state.flowKind&&state.flowKind!=='all');
    const mainText=m.depth===2?' style="font-size:'+(14*m.fitFactor)+'px"':'',smallText=m.depth===2?' style="font-size:'+(11.5*m.fitFactor)+'px"':'';
    const labelAbove=m.depth===2?6*m.fitFactor:3,labelBelow=m.depth===2?10*m.fitFactor:14;
    function nodes(ns,isLeft,full){return ns.map(q=>'<g class="ev-hierarchy-node"><title>'+esc(q.id)+' · '+n(q.mass)+(full?' observed per 10,000 words. '+n(q.used)+' matched and '+n(q.rest)+' unmatched.':' matched per 10,000 words within the selected connection.')+'</title><rect x="'+q.x+'" y="'+q.y+'" width="12" height="'+q.h+'" class="ev-node-neutral"/>'+(full&&q.rest>1e-8?'<rect x="'+q.x+'" y="'+(q.y+q.used*m.scale)+'" width="12" height="'+q.rest*m.scale+'" fill="url(#ev-unified-gap)"/>':'')+'<text class="ev-hierarchy-label"'+mainText+' x="'+(isLeft?q.x-10:q.x+22)+'" y="'+(q.y+q.h/2-labelAbove)+'" text-anchor="'+(isLeft?'end':'start')+'">'+esc(q.id)+'</text><text class="ev-svg-small ev-hierarchy-label"'+smallText+' x="'+(isLeft?q.x-10:q.x+22)+'" y="'+(q.y+q.h/2+labelBelow)+'" text-anchor="'+(isLeft?'end':'start')+'">'+n(q.mass)+'</text></g>').join('');}
    const branch=m.parent?'<rect class="ev-hierarchy-band" x="260" y="'+m.branchTop+'" width="'+(m.width-485)+'" height="'+(m.height-m.branchTop-8)+'" rx="8"/><text class="ev-svg-small ev-hierarchy-heading"'+smallText+' x="'+(m.width/2)+'" y="'+(m.branchTop-8*m.fitFactor)+'" text-anchor="middle">'+esc(m.parent.from+' → '+m.parent.to)+' · '+esc(kinds[m.parent.kind])+' · '+n(m.parent.mass)+' matched / 10k</text>':'';
    const ribbons=m.segments.map(l=>{
      const i=actions.push({...l})-1,wordSelected=l.level==='words'&&state.pair===l.from+'>'+l.to;
      const label=l.level==='words'?'Show this word pair.':l.level==='endings'?'Expand this ending connection.':m.parent&&l.stage!=='overview'?'This parent connection remains expanded.':'Expand this connection.';
      return '<path d="'+l.path+'" class="ev-ribbon ev-'+l.kind+' '+(l.stage==='overview'?'ev-hierarchy-parent':'ev-hierarchy-branch')+' '+(hasSelection&&!selected(l)?'ev-dim':'')+' '+(wordSelected?'ev-ribbon-selected':'')+'" data-drill="'+i+'" tabindex="0" role="button" aria-label="'+esc(kinds[l.kind]+', '+l.from+' to '+l.to+', '+n(l.mass)+'. '+label)+'"><title>'+esc(kinds[l.kind]+' · '+l.from+' → '+l.to)+' · '+n(l.mass)+' per 10,000 words</title></path>';
    }).join('');
    const targetX=m.right[0]?.x||(m.depth?m.width-165:535),chart='<svg class="ev-unified-svg ev-hierarchy-svg" style="width:'+m.displayWidth+'px;max-width:none" viewBox="0 0 '+m.width+' '+m.height+'" role="group" aria-label="'+(m.depth===2?'Word flows expanded within ending flows and full-family observations':m.depth===1?'Ending flows expanded within full-family observations':'All family routes share observed source and target totals')+'"><defs><pattern id="ev-unified-gap" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" class="ev-gap-bg"/><path d="M-1 1L1-1 M0 6L6 0 M5 7L7 5" class="ev-gap-line"/></pattern></defs><text x="148" y="17" text-anchor="end" class="ev-svg-small"'+smallText+'>Early Herbal A</text><text x="'+(targetX+12)+'" y="17" class="ev-svg-small"'+smallText+'>'+esc(sectionLabel(s,state.target))+'</text><text x="148" y="34" text-anchor="end" class="ev-svg-small"'+smallText+'>'+n(total(m.left))+' / 10k</text><text x="'+(targetX+12)+'" y="34" class="ev-svg-small"'+smallText+'>'+n(total(m.right))+' / 10k</text>'+branch+ribbons+nodes(m.left,true,true)+nodes(m.right,false,true)+m.columns.map(col=>'<text class="ev-svg-small ev-hierarchy-heading"'+smallText+' x="'+(col.nodes[0]?.x||0)+'" y="'+(m.branchTop+16*m.fitFactor)+'" text-anchor="middle">'+esc(col.title)+'</text>'+nodes(col.nodes,col.side==='from',false)).join('')+(!m.overview.links.length?'<text x="350" y="80" text-anchor="middle" class="ev-svg-small"'+smallText+'>No matches are allocated.</text>':'')+'</svg>';
    const legend='<div class="ev-route-key" role="group" aria-label="Matched route types">'+['kept','edited','swap'].map(kind=>{const mass=total(rows.filter(r=>r.kind===kind));return '<button data-flow-kind="'+kind+'" aria-pressed="'+(state.flowKind===kind)+'"><i class="ev-'+kind+'"></i><span>'+kinds[kind]+'</span><b>'+n(mass)+'</b><small>'+(m.credit>0?(100*mass/m.credit).toFixed(1):'0.0')+'% of matched</small></button>';}).join('')+'<span class="ev-hatch-key"><i class="ev-gap-swatch"></i>Unmatched</span></div>';
    const pair=m.ending?.rows.find(r=>state.pair===r.from+'>'+r.to),inspector=pair?'<aside class="ev-hierarchy-inspector"><button class="wb-button" data-flow-close-pair>Close counts</button><h4>'+esc(pair.from)+' → '+esc(pair.to)+'</h4><p>This word pair carries '+n(pair.mass)+' matched occurrences per 10,000 words.</p>'+detail(s,{source:pair.from,target:pair.to,steps:pair.steps})+'</aside>':'';
    const scaleButtons=m.depth===2?'<span class="ev-chart-scale" role="group" aria-label="Chart size"><button class="wb-button" data-flow-scale="fit" aria-pressed="'+(m.chartScale==='fit')+'">Fit chart</button><button class="wb-button" data-flow-scale="actual" aria-pressed="'+(m.chartScale==='actual')+'">Actual size</button></span>':'';
    const nav='<div class="ev-drill-nav"><button class="wb-button" data-flow-reset>Show all connections</button>'+(m.depth?'<button class="wb-button" data-flow-collapse-to="overview">Collapse endings</button>':'')+(m.depth===2?'<button class="wb-button" data-flow-collapse-to="endings">Collapse words</button>':'')+'<span>'+(m.depth===2?'Family → Endings → Words':m.depth===1?'Family → Endings':'Whole family')+'</span>'+scaleButtons+(state.focus?'<span>Highlighted word <code>'+esc(state.focus)+'</code></span><button class="wb-button" data-flow-unfocus>Clear word</button>':'')+'</div>';
    const instruction=m.depth===2?'Word ribbons divide the selected ending flow. Select one for its counts and rules.':m.depth===1?'Ending ribbons divide the selected family flow. Select one to insert its words.':'Select a ribbon to insert its ending groups.';
    return {actions,rows,layout:m.overview,hierarchy:m,html:legend+nav+'<p class="ev-flow-instruction">'+instruction+(m.depth===2?(m.chartScale==='fit'?' The complete flow fits the chart.':' Scroll horizontally to follow every column.'):'')+'</p><div class="ev-hierarchy-figure"><div class="ev-hierarchy-scroll" data-flow-scroll>'+chart+'</div>'+inspector+'</div><p class="ev-chart-foot">Outer nodes show full observed frequency. Inner nodes divide the selected flow on the same scale. Hatching shows unmatched frequency.</p><details class="ev-flow-reconciliation"><summary>Flow totals</summary><p>'+n(m.credit)+' matched · '+n(m.unplaced)+' source unmatched · '+n(m.unfilled)+' target unmatched, all per 10,000 words.</p></details>'};
  }
  const api={witness,scope,aggregate,name,overviewLayout,hierarchyLayout,render};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.EchoEvidenceFlow=api;
})(typeof window!=='undefined'?window:globalThis);
