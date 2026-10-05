/* Descriptive graph accounting, independent of a fitted application policy.
 * Family totals count each spelling once, including low-frequency hidden members.
 * Flow uses shared source/target capacities; summing individual edge widths is wrong.
 * A chain is one declared pairing, not permission for arbitrary recursive rewrites.
 */
(function(root) {
  'use strict';
  function vocabulary(data) {
    const words = new Map(data.nodes.map(n => [n.id, {...n,rate:Object.fromEntries(data.sections.map(s=>[s.key,(n.count[s.key]||0)*10000/s.N]))}]));
    for (const [id, counts] of Object.entries(data.lex)) words.set(id, {
      id, count: Object.fromEntries(data.sections.map((s,i) => [s.key,counts[i]])),
      rate: Object.fromEntries(data.sections.map((s,i) => [s.key,counts[i]*10000/s.N]))
    });
    return words;
  }
  function enabledGraph(data, enabled) {
    const edges = data.edges.map(e => ({...e, rules:e.rules.filter(r=>enabled.has(r.split('.')[0]))})).filter(e=>e.rules.length);
    const pairs = edges.map(e=>e.forwardOnly?[e.s,e.t,true]:[e.s,e.t]);
    for (const c of data.chains) if(enabled.has(c.rule)) pairs.push([c.path[0],c.path[2]]);
    const adj = new Map();
    for (const [a,b] of pairs) { if(!adj.has(a))adj.set(a,new Set()); if(!adj.has(b))adj.set(b,new Set()); adj.get(a).add(b);adj.get(b).add(a); }
    return {edges,pairs,adj};
  }
  function closure(seeds, adj) {
    const found=new Set(seeds), queue=[...found];
    for(let i=0;i<queue.length;i++) for(const next of adj.get(queue[i])||[]) if(!found.has(next)){found.add(next);queue.push(next);}
    return found;
  }
  // Connectivity is undirected for grouping, but candidate destinations are not.
  // Never turn an incoming-only research edge into an output in the inspector.
  function destinations(word, pairs) {
    const out=new Set();
    for(const [a,b,forwardOnly] of pairs){if(a===word)out.add(b);if(b===word&&!forwardOnly)out.add(a);}
    return out;
  }
  function visible(data, words, enabled, sections, minimum, query='', mode='word') {
    const full=enabledGraph(data,enabled), searching=!!query.trim(), q=query.trim().replace(/^q/,'');
    let keep;
    if(searching) keep=words.has(q)?(mode==='family'?closure([q],full.adj):mode==='direct'?new Set([q,...(full.adj.get(q)||[])]):new Set([q])):new Set();
    else {
      keep=new Set(data.nodes.filter(n=>sections.reduce((sum,s)=>sum+n.count[s],0)>=minimum).map(n=>n.id));
      for(const c of data.chains) if(enabled.has(c.rule)&&keep.has(c.path[0])&&keep.has(c.path[2]))keep.add(c.path[1]);
    }
    // A direct view is a star, not an induced subgraph whose neighbors connect
    // to one another and recreate the same visual tangle.
    const edges=full.edges.filter(e=>keep.has(e.s)&&keep.has(e.t)&&(!searching||mode!=='direct'||e.s===q||e.t===q)), out=new Map(), inn=new Map();
    if(searching&&mode==='direct')for(const c of data.chains)if(enabled.has(c.rule)&&(c.path[0]===q||c.path[2]===q))edges.push({s:c.path[0],t:c.path[2],rules:[c.rule],stage:['x'],label:c.rule+' via '+c.path[1],composite:true});
    edges.forEach(e=>{if(!out.has(e.s))out.set(e.s,[]);if(!inn.has(e.t))inn.set(e.t,[]);out.get(e.s).push(e);inn.get(e.t).push(e);});
    const nodes=searching?[...keep]:[...new Set(edges.flatMap(e=>[e.s,e.t]))];
    return {nodes,edges,out,inn};
  }
  // Edmonds-Karp on the bipartite surplus -> shortfall network. Reverse residual
  // edges matter: greedy edge allocation can understate the attainable joint flow.
  function maximumFlow(loss, gain, pairs, detailed=false) {
    const graph=new Map(), source='SOURCE', sink='SINK';
    const routes=[];
    function edge(a,b,cap){if(!graph.has(a))graph.set(a,[]);if(!graph.has(b))graph.set(b,[]);const f={to:b,cap,initial:cap,reverse:graph.get(b).length},r={to:a,cap:0,reverse:graph.get(a).length};graph.get(a).push(f);graph.get(b).push(r);return f;}
    loss.forEach((v,w)=>{if(v>1e-10)edge(source,'L:'+w,v);});
    gain.forEach((v,w)=>{if(v>1e-10)edge('R:'+w,sink,v);});
    const used=new Set();
    for(const [x,y,forwardOnly] of pairs) for(const [a,b] of (forwardOnly?[[x,y]]:[[x,y],[y,x]])) {
      const key=a+'|'+b;
      if((loss.get(a)||0)>1e-10&&(gain.get(b)||0)>1e-10&&!used.has(key)){const e=edge('L:'+a,'R:'+b,Math.min(loss.get(a),gain.get(b)));routes.push({from:a,to:b,edge:e});used.add(key);}
    }
    let total=0;
    while(true) {
      const parents=new Map([[source,null]]), queue=[source];
      for(let i=0;i<queue.length&&!parents.has(sink);i++) for(const e of graph.get(queue[i])||[]) if(e.cap>1e-10&&!parents.has(e.to)){parents.set(e.to,{from:queue[i],edge:e});queue.push(e.to);}
      if(!parents.has(sink))break;
      let amount=Infinity;
      for(let v=sink;v!==source;v=parents.get(v).from)amount=Math.min(amount,parents.get(v).edge.cap);
      for(let v=sink;v!==source;v=parents.get(v).from){const p=parents.get(v);p.edge.cap-=amount;graph.get(v)[p.edge.reverse].cap+=amount;}
      total+=amount;
    }
    return detailed?{total,routes:routes.map(r=>({from:r.from,to:r.to,mass:r.edge.initial-r.edge.cap})).filter(r=>r.mass>1e-8)}:total;
  }
  function accounting(members, words, sections, from, to, pairs) {
    const N=Object.fromEntries(sections.map(s=>[s.key,s.N]));
    const loss=new Map(), gain=new Map(), perWord=new Map();let source=0,target=0,retained=0;
    for(const w of members) {
      const n=words.get(w);if(!n)continue;
      const a=(n.count[from]||0)*10000/N[from],b=(n.count[to]||0)*10000/N[to];
      source+=a;target+=b;retained+=Math.min(a,b);loss.set(w,Math.max(a-b,0));gain.set(w,Math.max(b-a,0));
      perWord.set(w,{word:w,source:a,target:b,retained:Math.min(a,b),sent:0,received:0});
    }
    const flow=maximumFlow(loss,gain,pairs,true), matched=flow.total;
    // Expose one feasible joint allocation. It is not unique or a fitted policy;
    // its per-word remainder must stay visible even when family totals balance.
    for(const r of flow.routes){perWord.get(r.from).sent+=r.mass;perWord.get(r.to).received+=r.mass;}
    for(const r of perWord.values()){r.unplaced=Math.max(0,r.source-r.retained-r.sent);r.unfilled=Math.max(0,r.target-r.retained-r.received);}
    const excess=source-retained,demand=target-retained;
    return {source,target,retained,excess,demand,matched,unplaced:Math.max(0,excess-matched),unfilled:Math.max(0,demand-matched),
      perWord,routes:flow.routes,ratio:source>0?target/source:null,relativeGap:Math.max(source,target)>0?Math.abs(source-target)/Math.max(source,target):0};
  }
  const api={vocabulary,enabledGraph,closure,destinations,visible,maximumFlow,accounting};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.EchoGraphMetrics=api;
})(typeof window!=='undefined'?window:globalThis);
