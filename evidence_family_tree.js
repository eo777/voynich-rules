/* Read-only cuts of the saved ordinary-gallows pools. No fitting or allocation. */
(function(root){
  'use strict';
  const M=typeof module!=='undefined'&&module.exports?require('./evidence_members.js'):root.EchoEvidenceMembers;
  const order=(a,b)=>a<b?-1:a>b?1:0;
  const unique=items=>[...new Set(items)].sort(order);
  const idFor=(...parts)=>'tree:'+JSON.stringify(parts);

  function get(tree,id){
    const node=tree.nodes[typeof id==='string'?id:id?.id];
    if(!node)throw Error('Unknown family tree node');
    return node;
  }
  function children(tree,id){return get(tree,id).children.map(key=>tree.nodes[key]);}
  function lineage(tree,id){
    const result=[];let node=get(tree,id);
    while(node){result.unshift(node);node=node.parentId===null?null:get(tree,node.parentId);}
    return result;
  }
  function components(words,routes){
    const parents=new Map(words.map(word=>[word,word]));
    function find(word){while(parents.get(word)!==word){parents.set(word,parents.get(parents.get(word)));word=parents.get(word);}return word;}
    for(const route of routes){
      if(route.source===route.target||!parents.has(route.source)||!parents.has(route.target))continue;
      parents.set(find(route.source),find(route.target));
    }
    const groups=new Map();
    for(const word of words){const key=find(word);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(word);}
    return [...groups.values()].map(group=>group.sort(order)).sort((a,b)=>b.length-a.length||order(a[0],b[0]));
  }
  function copyRoute(route,direction){
    const steps=route.steps.map(step=>({...step,middles:[...(step.middles||[])],chain:[step.source,...(step.middles||[]),step.target]}));
    return {...route,direction,steps,rules:steps.map(step=>step.rule),
      chain:[route.source,...steps.flatMap(step=>[...step.middles,step.target])]};
  }

  /**
   * Only routes saved in this pool are returned. Internal and boundary refer to
   * endpoint membership in the selected cut, not to intermediate spellings.
   * Components ignore route direction and identity edges. They describe the
   * current saved route menu, before target-specific frequency gates, and are
   * not a claim of semantic equivalence or historical ancestry.
   */
  function provenance(study,tree,id){
    const node=get(tree,id),pool=study.families.find(f=>f.id===node.poolId);
    if(!pool)throw Error('Family tree pool missing from study');
    const members=new Set(node.words),internal=[],boundary=[];
    for(const route of pool.routes){
      const from=members.has(route.source),to=members.has(route.target);
      if(from&&to)internal.push(copyRoute(route,'internal'));
      else if(from||to)boundary.push(copyRoute(route,from?'outgoing':'incoming'));
    }
    const sortRoutes=(a,b)=>order(a.source,b.source)||order(a.target,b.target)||order(JSON.stringify(a.rules),JSON.stringify(b.rules));
    internal.sort(sortRoutes);boundary.sort(sortRoutes);
    const currentComponents=components(node.words,internal),poolComponents=components(pool.words,pool.routes);
    return {nodeId:node.id,poolId:node.poolId,internal,boundary,
      rules:unique([...internal,...boundary].flatMap(route=>route.rules)),
      internalRules:unique(internal.flatMap(route=>route.rules)),boundaryRules:unique(boundary.flatMap(route=>route.rules)),
      components:currentComponents,poolComponents,
      componentOf:Object.fromEntries(currentComponents.flatMap((words,i)=>words.map(word=>[word,i]))),
      isolated:currentComponents.filter(words=>words.length===1).map(words=>words[0]),
      connected:currentComponents.length===1,poolConnected:poolComponents.length===1,
      scope:'current saved routes before target-specific frequency gates'};
  }

  /**
   * Every level partitions its parent. Prefixes combine k and t only after the
   * existing member tree has classified each spelling. Ending labels are copied
   * from that tree, preserving ch versus sh. Pairs share exactly [prefix, tail].
   * Expected pair counterparts may be absent; only observed spellings enter words.
   */
  function build(study){
    const nodes=Object.create(null),roots=[],owners=new Map();
    function add(level,poolId,parentId,words,extra={}){
      const parts=[poolId];
      if(level!=='pool')parts.push(extra.prefix);
      if(level==='ending'||level==='pair')parts.push(extra.ending);
      if(level==='pair')parts.push(extra.tail);
      const id=idFor(level,...parts),sorted=[...words].sort(order);
      if(nodes[id])throw Error('Duplicate family tree node');
      const node={id,parentId,level,poolId,poolIds:[poolId],words:sorted,
        kWords:sorted.filter(word=>study.words[word].g==='k'),tWords:sorted.filter(word=>study.words[word].g==='t'),
        prefix:null,ending:null,tail:null,label:poolId,children:[],...extra};
      nodes[id]=node;if(parentId!==null)nodes[parentId].children.push(id);
      return node;
    }
    for(const pool of [...study.families].sort((a,b)=>order(a.id,b.id))){
      for(const word of pool.words){
        const row=study.words[word];
        if(!row||!['k','t'].includes(row.g)||typeof row.prefix!=='string'||typeof row.tail!=='string')throw Error('Invalid family tree spelling');
        if(owners.has(word))throw Error('Overlapping saved family pools');
        owners.set(word,pool.id);
      }
      const memberTree=M.describe(study,pool),prefixes=new Map();
      const parent=add('pool',pool.id,null,pool.words,{label:memberTree.kLabel+' / '+memberTree.tLabel,
        kLabel:memberTree.kLabel,tLabel:memberTree.tLabel});roots.push(parent);
      for(const branch of memberTree.groups){
        if(!prefixes.has(branch.prefix))prefixes.set(branch.prefix,new Map());
        const endings=prefixes.get(branch.prefix);
        for(const end of branch.endings){
          if(!endings.has(end.label))endings.set(end.label,[]);
          endings.get(end.label).push(...end.words);
        }
      }
      for(const [prefix,endings] of [...prefixes].sort((a,b)=>order(a[0],b[0]))){
        const kLabel=prefix+'k*',tLabel=prefix+'t*',prefixLabel=kLabel+' / '+tLabel;
        const prefixNode=add('prefix',pool.id,parent.id,[...endings.values()].flat(),{prefix,label:prefixLabel,kLabel,tLabel});
        for(const [ending,words] of [...endings].sort((a,b)=>order(a[0],b[0]))){
          const endNode=add('ending',pool.id,prefixNode.id,words,{prefix,ending,label:ending,kLabel,tLabel});
          const tails=new Map();
          for(const word of words){const tail=study.words[word].tail;if(!tails.has(tail))tails.set(tail,[]);tails.get(tail).push(word);}
          for(const [tail,pairWords] of [...tails].sort((a,b)=>order(a[0],b[0]))){
            const expectedWords={k:prefix+'k'+tail,t:prefix+'t'+tail};
            add('pair',pool.id,endNode.id,pairWords,{prefix,ending,tail,expectedWords,
              absentWords:Object.values(expectedWords).filter(word=>!pairWords.includes(word)),
              kLabel:expectedWords.k,tLabel:expectedWords.t,label:expectedWords.k+' / '+expectedWords.t});
          }
        }
      }
    }
    if(Object.keys(study.words).some(word=>!owners.has(word)))throw Error('Spelling missing from saved family pools');
    const tree={roots,nodes};
    tree.children=id=>children(tree,id);tree.lineage=id=>lineage(tree,id);tree.provenance=id=>provenance(study,tree,id);
    return tree;
  }
  const api={build,children,lineage,provenance};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.EchoEvidenceFamilyTree=api;
})(typeof window!=='undefined'?window:globalThis);
