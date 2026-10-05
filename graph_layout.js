/* Bounded layout for large rule families, including reciprocal rules/cycles.
 * All words and edges survive; this changes positions only, never accounting.
 * Small families retain the detailed crossing-minimizing legacy layout. */
(function(root){
  'use strict';
  const dense=(nodes,edges)=>nodes>80||edges>120;
  function overview(nodes,edges,mass,G){
    const adj=new Map(nodes.map(n=>[n,new Set()]));
    for(const e of edges){adj.get(e.s).add(e.t);adj.get(e.t).add(e.s);}
    const sorted=[...nodes].sort((a,b)=>mass(b)-mass(a)||a.localeCompare(b));
    const layer=new Map(),queue=[];
    // BFS tolerates directed cycles and needs no repeated longest-path relaxation.
    for(const seed of sorted){
      if(layer.has(seed))continue;
      layer.set(seed,0);queue.push(seed);
      for(let i=0;i<queue.length;i++)for(const n of adj.get(queue[i]))if(!layer.has(n)){
        layer.set(n,Math.min(7,layer.get(queue[i])+1));queue.push(n);
      }
      queue.length=0;
    }
    const L=Math.max(0,...layer.values())+1,cols=Array.from({length:L},()=>[]);
    for(const n of sorted)cols[layer.get(n)].push(n);
    const height=Math.max(1,...cols.map(c=>c.length))*G.rowH,coords=new Map();
    cols.forEach((col,x)=>col.forEach((n,y)=>coords.set(n,{x:x*G.colW,y:y*G.rowH+(height-col.length*G.rowH)/2})));
    return {nodes,edges,coords,dummies:new Map(),crossings:null,w:(L-1)*G.colW+G.glyphW+70,h:height,title:sorted.slice(0,3).join(' · '),mass:sorted.reduce((s,n)=>s+mass(n),0)};
  }
  const api={dense,overview};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.EchoGraphLayout=api;
})(typeof window!=='undefined'?window:globalThis);
