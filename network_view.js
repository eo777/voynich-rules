/* Rule network drawing, shared by the Network tab (network.html) and the viewer (viewer.html).
 * Each word is a glyph: one rate bar per section and, for one pair of sections, how much of its source rate is left
 * without a destination and how much of its target rate is still missing. Rule edges join the words. Each family (a
 * connected component) is laid out in columns by rule steps, ordered to reduce crossings, and the families are packed
 * in shelves. The caller owns the data and every panel around the drawing; hover and selection come back through
 * callbacks. Drag to pan, wheel to zoom. Styles are in network_view.css; colours arrive resolved.
 *
 *   const view = EchoNetworkView.create(svg, {onHover, onSelect});
 *   view.draw({graph, word, sections, colour, textColour, sectionLabel, scale, ...});   // see draw() below
 */
(function (root) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  // 32px bar pitch leaves room for four-digit integer labels at 11px monospace.
  const GEOMETRY = {colW: 190, rowH: 158, glyphW: 78, barW: 14, gap: 18, maxBar: 72, famPad: 26};
  // a glyph is as wide as its bars: three sections give the standard 78px
  const geometry = n => ({...GEOMETRY, glyphW: n * GEOMETRY.barW + Math.max(0, n - 1) * GEOMETRY.gap});
  const MAP_TXT = {
    m11: { short: 'one-to-one', long: '<b>one-to-one</b>' },
    m1n: { short: 'one word, several forms', long: '<b>one → several</b> <span class="muted">left word has several partners</span>' },
    mn1: { short: 'several forms, one word', long: '<b>several → one</b> <span class="muted">right word has several partners</span>' },
    mnn: { short: 'many-to-many', long: '<b>many-to-many</b>' }
  };
  const graphLayout = () => root.EchoGraphLayout || (typeof require === 'function' ? require('./graph_layout.js') : null);
  const el = (t, a = {}, p) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const fmt = x => x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(1);
  // Dense graph labels use whole rates; a visible nonzero cue instead of rounding small mass to zero.
  const graphRate = x => x > 1e-8 && x < 1 ? '<1' : Math.round(x).toString();

  // Pairing multiplicity among the words shown: left = the form without the inserted material, right = with it.
  function degrees(g) {
    const left = new Map(), right = new Map();
    g.edges.forEach(e => { right.set(e.s, (right.get(e.s) || 0) + 1); left.set(e.t, (left.get(e.t) || 0) + 1); });
    return {left, right};
  }
  const mapClass = (e, deg) => { const a = deg.right.get(e.s) || 0, b = deg.left.get(e.t) || 0; return a > 1 ? (b > 1 ? 'mnn' : 'm1n') : (b > 1 ? 'mn1' : 'm11'); };

  // Layout: components, longest-path layers, barycentre ordering, shelf packing to `width`. `mass(id)` orders words
  // and families (heaviest first).
  function layout(g, mass, width, G = GEOMETRY) {
    const adj = new Map(g.nodes.map(n => [n, []]));
    g.edges.forEach(e => { adj.get(e.s).push(e.t); adj.get(e.t).push(e.s); });
    const comp = new Map(); const comps = [];
    for (const n of g.nodes) {
      if (comp.has(n)) continue;
      const c = []; const st = [n]; comp.set(n, comps.length);
      while (st.length) { const x = st.pop(); c.push(x); for (const y of adj.get(x)) if (!comp.has(y)) { comp.set(y, comps.length); st.push(y); } }
      comps.push(c);
    }
    const boxes = comps.map(c => {
      const set = new Set(c);
      const es = g.edges.filter(e => set.has(e.s));
      if (graphLayout().dense(c.length, es.length)) return graphLayout().overview(c, es, mass, G);
      // longest-path layering: column = number of rule steps from a word no rule produces (graph is acyclic)
      const layer = new Map(c.map(n => [n, 0]));
      for (let it = 0; it < c.length + 2; it++) { let ch = false; es.forEach(e => { if (layer.get(e.t) < layer.get(e.s) + 1 && layer.get(e.s) + 1 < 12) { layer.set(e.t, layer.get(e.s) + 1); ch = true; } }); if (!ch) break; }
      const L = Math.max(...layer.values()) + 1;
      // an edge that skips columns gets one placeholder per skipped column, so ordering and routing see it
      const lay = new Map(layer), isDummy = new Set(), segs = [], chains = new Map();
      es.forEach(e => {
        const a = layer.get(e.s), b = layer.get(e.t);
        if (b - a <= 1) { segs.push([e.s, e.t]); return; }
        let prev = e.s; const ds = [];
        for (let k = a + 1; k < b; k++) { const d = `\u0000${e.s}>${e.t}#${k}`; lay.set(d, k); isDummy.add(d); ds.push(d); segs.push([prev, d]); prev = d; }
        segs.push([prev, e.t]); chains.set(e.s + '>' + e.t, ds);
      });
      const cols = Array.from({ length: L }, () => []);
      lay.forEach((k, n) => cols[k].push(n));
      const up = new Map(), dn = new Map();
      segs.forEach(([u, v]) => { (dn.get(u) || dn.set(u, []).get(u)).push(v); (up.get(v) || up.set(v, []).get(v)).push(u); });
      const w8 = n => isDummy.has(n) ? 0 : mass(n);
      cols.forEach(col => col.sort((a, b) => w8(b) - w8(a)));
      const pos = new Map(); const setPos = () => cols.forEach(col => col.forEach((n, j) => pos.set(n, j)));
      setPos();
      const between = i => segs.filter(([u, v]) => lay.get(u) === i && lay.get(v) === i + 1);
      const crossPair = i => { const E = between(i); let x = 0;
        for (let a = 0; a < E.length; a++) for (let b = a + 1; b < E.length; b++) {
          const d1 = pos.get(E[a][0]) - pos.get(E[b][0]), d2 = pos.get(E[a][1]) - pos.get(E[b][1]); if (d1 * d2 < 0) x++; }
        return x; };
      const crossings = () => { let x = 0; for (let i = 0; i + 1 < L; i++) x += crossPair(i); return x; };
      const snapshot = () => cols.map(col => col.slice());
      let best = snapshot(), bestX = crossings();
      // barycentre sweeps, alternating direction; keep the ordering with the fewest crossings
      for (let it = 0; it < 28 && bestX > 0; it++) {
        const down = it % 2 === 0;
        const order = down ? cols.map((_, i) => i) : cols.map((_, i) => L - 1 - i);
        order.forEach(i => {
          const col = cols[i];
          const bc = n => { const nb = (down ? up : dn).get(n) || []; return nb.length ? nb.reduce((a, m) => a + pos.get(m), 0) / nb.length : pos.get(n); };
          const key = new Map(col.map(n => [n, bc(n)]));
          col.sort((a, b) => key.get(a) - key.get(b) || pos.get(a) - pos.get(b)); col.forEach((n, j) => pos.set(n, j));
        });
        const x = crossings(); if (x < bestX) { bestX = x; best = snapshot(); }
      }
      best.forEach((col, i) => { cols[i] = col; }); setPos();
      // local improvement: swap neighbours whenever that removes crossings
      for (let pass = 0; pass < 12 && bestX > 0; pass++) {
        let improved = false;
        cols.forEach((col, i) => {
          for (let j = 0; j + 1 < col.length; j++) {
            const local = () => (i > 0 ? crossPair(i - 1) : 0) + (i + 1 < L ? crossPair(i) : 0);
            const before = local();
            [col[j], col[j + 1]] = [col[j + 1], col[j]]; pos.set(col[j], j); pos.set(col[j + 1], j + 1);
            if (local() < before) improved = true;
            else { [col[j], col[j + 1]] = [col[j + 1], col[j]]; pos.set(col[j], j); pos.set(col[j + 1], j + 1); }
          }
        });
        if (!improved) break;
      }
      // vertical positions: pull each item level with its neighbours, keep the order and the spacing
      const size = n => isDummy.has(n) ? 30 : G.rowH;
      const yv = new Map();
      cols.forEach(col => { let y = 0; col.forEach((n, j) => { if (j) y += (size(col[j - 1]) + size(n)) / 2; yv.set(n, y); }); });
      const place = (col, want) => {
        const n = col.length; if (!n) return;
        const f = new Array(n), b = new Array(n);
        for (let j = 0; j < n; j++) f[j] = j ? Math.max(want[j], f[j - 1] + (size(col[j - 1]) + size(col[j])) / 2) : want[j];
        for (let j = n - 1; j >= 0; j--) b[j] = j < n - 1 ? Math.min(want[j], b[j + 1] - (size(col[j]) + size(col[j + 1])) / 2) : want[j];
        const m = f.map((v, j) => (v + b[j]) / 2);
        for (let j = 0; j < n; j++) { const v = j ? Math.max(m[j], yv.get(col[j - 1]) + (size(col[j - 1]) + size(col[j])) / 2) : m[j]; yv.set(col[j], v); }
      };
      for (let it = 0; it < 10; it++) {
        const order = it % 2 === 0 ? cols.map((_, i) => i) : cols.map((_, i) => L - 1 - i);
        order.forEach(i => { const col = cols[i];
          const want = col.map(n => { const nb = [...(up.get(n) || []), ...(dn.get(n) || [])]; return nb.length ? nb.reduce((a, m) => a + yv.get(m), 0) / nb.length : yv.get(n); });
          place(col, want); });
      }
      const y0 = Math.min(...yv.values());
      const coords = new Map(), dummies = new Map();
      c.forEach(n => coords.set(n, { x: lay.get(n) * G.colW, y: yv.get(n) - y0 }));
      chains.forEach((ds, k) => dummies.set(k, ds.map(d => ({ x: lay.get(d) * G.colW, y: yv.get(d) - y0 }))));
      const H = Math.max(...[...yv.values()].map(v => v - y0)) + G.rowH;
      const title = c.slice().sort((a, b) => mass(b) - mass(a)).slice(0, 3).join(' · ');
      return { nodes: c, edges: es, coords, dummies, crossings: bestX, w: (L - 1) * G.colW + G.glyphW + 70, h: H, title, mass: c.reduce((a, n) => a + mass(n), 0) };
    });
    boxes.sort((a, b) => b.mass - a.mass);
    // shelf packing to a target width
    const W = Math.max(700, (width - 40) / 0.9);
    let x = 0, y = 0, shelfH = 0;
    boxes.forEach(b => {
      if (x > 0 && x + b.w > W) { x = 0; y += shelfH + G.famPad * 2; shelfH = 0; }
      b.x = x; b.y = y; x += b.w + G.famPad * 2; shelfH = Math.max(shelfH, b.h - 20);
    });
    return boxes;
  }

  // A drawing in `svg` (its first <g>, or opts.vp, holds the pan/zoom transform). opts.onHover(id) on entering a
  // word and onHover(null) on leaving it; opts.onSelect(id, cleared) when a word is pinned or unpinned (cleared: a
  // redraw dropped the pinned word).
  function create(svg, opts = {}) {
    const vp = opts.vp || svg.querySelector('g') || el('g', {}, svg);
    const view = { k: 1, x: 20, y: 20 };
    let m = null, G = GEOMETRY, graph = null, deg = {left: new Map(), right: new Map()}, sel = null;
    let nodesPos = new Map(), dummyPos = new Map(), lastBox = null, scaleMax = 1;
    const applyView = () => vp.setAttribute('transform', `translate(${view.x},${view.y}) scale(${view.k})`);
    const barH = r => { if (r <= 0) return 0; return m.scale === 'lin' ? G.maxBar * r / scaleMax : G.maxBar * Math.sqrt(r / scaleMax); };

    function glyph(parent, n, x, y) {
      const g = el('g', { class: 'node', transform: `translate(${x},${y})` }, parent);
      g.dataset.id = n.id;
      const S = m.sections; const hollow = S.every(k => n.count[k] === 0);
      const [cmpFrom, cmpTo] = m.pair || [], mass = m.pair ? m.mass(n.id) : null;
      el('rect', { class: 'hit', x: -8, y: -G.maxBar - 22, width: G.glyphW + 16, height: G.maxBar + 42, rx: 6 }, g);
      S.forEach((k, i) => {
        const h = barH(n.rate[k]); const bx = i * (G.barW + G.gap);
        if (h > 0) el('rect', { x: bx, y: -h, width: G.barW, height: h, rx: 1.5, fill: m.colour(k) }, g);
        else el('rect', { x: bx, y: -1.5, width: G.barW, height: 1.5, fill: m.lineColour }, g);
        const missing = !mass ? 0 : k === cmpFrom ? mass.unplaced : k === cmpTo ? mass.unfilled : 0;
        if (missing > 1e-8) { const retainedH = barH(Math.max(0, n.rate[k] - missing)); el('rect', { x: bx, y: -h, width: G.barW, height: Math.max(1, h - retainedH), fill: k === cmpFrom ? '#d99836' : '#d96b77', class: 'mass-segment' }, g); }
        const bn = el('text', { class: 'bnum', x: bx + G.barW / 2, y: -Math.max(h, 1.5) - 3, 'text-anchor': 'middle', fill: n.count[k] ? m.textColour(k) : m.mutedColour }, g); bn.textContent = graphRate(n.rate[k]);
        el('title', {}, bn).textContent = `${m.sectionLabel(k)}: ${fmt(n.rate[k])} /10k (${n.count[k]} tokens)`;
      });
      el('line', { class: 'base', x1: -3, x2: G.glyphW + 3, y1: 0.5, y2: 0.5 }, g);
      const t = el('text', { class: 'nlabel', x: G.glyphW / 2, y: 14, 'text-anchor': 'middle' }, g); t.textContent = n.id;
      if (mass) {
        el('text', { class: 'word-mass mass-left', x: G.glyphW / 2, y: 28, 'text-anchor': 'middle' }, g).textContent = `${m.tag(cmpFrom)} left ${graphRate(mass.unplaced)}`;
        el('text', { class: 'word-mass mass-missing', x: G.glyphW / 2, y: 40, 'text-anchor': 'middle' }, g).textContent = `${m.tag(cmpTo)} missing ${graphRate(mass.unfilled)}`;
        el('title', {}, g).textContent = `${n.id}: source ${fmt(mass.source)} = kept ${fmt(mass.retained)} + sent ${fmt(mass.sent)} + left ${fmt(mass.unplaced)}; target ${fmt(mass.target)} = kept ${fmt(mass.retained)} + received ${fmt(mass.received)} + missing ${fmt(mass.unfilled)} /10k`;
      }
      if (hollow) { el('rect', { x: -2, y: -18, width: G.glyphW + 4, height: 18, rx: 3, fill: 'none', stroke: m.lineColour, 'stroke-dasharray': '2 2' }, g); }
      return g;
    }

    function edgePath(a, b, via) {
      const x1 = a.x + G.glyphW + 6, y1 = a.y - 22, x2 = b.x - 8, y2 = b.y - 22;
      if (x2 <= x1) { // same column or backwards (rare): arc above
        const my = Math.min(y1, y2) - 40;
        return `M${a.x + G.glyphW / 2},${a.y - G.maxBar - 4} C${a.x + G.glyphW / 2},${my} ${b.x + G.glyphW / 2},${my} ${b.x + G.glyphW / 2},${b.y - G.maxBar - 4}`;
      }
      // points: start, each placeholder (a column skipped), end; horizontal tangents at every point
      const pts = [[x1, y1], ...(via || []).map(d => [d.x + G.glyphW / 2, d.y - 22]), [x2, y2]];
      let dstr = `M${pts[0][0]},${pts[0][1]}`;
      for (let k = 1; k < pts.length; k++) { const [px, py] = pts[k - 1], [qx, qy] = pts[k], dx = Math.max(24, (qx - px) * 0.5);
        dstr += ` C${px + dx},${py} ${qx - dx},${qy} ${qx},${qy}`; }
      return dstr;
    }

    function badges(g, id) {
      const put = (n, x, v) => { if (n < 2) return; const bg = el('g', { class: 'badge', transform: `translate(${x},${-G.maxBar / 2})` }, g);
        const t = '×' + n; const w = t.length * 7.6 + 10; el('rect', { x: -w / 2, y: -9.5, width: w, height: 19, rx: 9.5, fill: v }, bg);
        const tx = el('text', { x: 0, y: 4.2, 'text-anchor': 'middle' }, bg); tx.textContent = t; };
      put(deg.left.get(id) || 0, -22, m.badgeColours.left);
      put(deg.right.get(id) || 0, G.glyphW + 22, m.badgeColours.right);
    }

    // The model:
    //   graph          {nodes: [id], edges: [{s, t, rules, label}], out, inn} (EchoGraphMetrics.visible)
    //   word(id)       {id, rate: {section: per 10k}, count: {section: tokens}}
    //   sections       section keys, one bar each, in order
    //   colour(k), textColour(k), sectionLabel(k); lineColour, mutedColour; badgeColours {left, right}
    //   scale          'lin' or 'sqrt'
    //   pair, mass(id), tag(k)   optional: [from, to], the word's ledger row for that pair, a short name per section
    //   familyText(ids), ruleLines(edge), edgeLabel(edge), emptyText
    //   fit            fit the drawing to the view (else keep the current pan and zoom); focus: the word to centre on
    //   selected       the word to keep pinned, if it is still drawn; width: the shelf width (default the svg's)
    function draw(model) {
      m = model; graph = m.graph; G = geometry(m.sections.length);
      const detailedLabels = !graphLayout().dense(graph.nodes.length, graph.edges.length);
      scaleMax = Math.max(1, ...graph.nodes.flatMap(n => m.sections.map(k => m.word(n).rate[k])));
      const weight = n => m.sections.reduce((a, k) => a + m.word(n).rate[k], 0);
      const boxes = layout(graph, weight, m.width ?? svg.clientWidth, G);
      vp.innerHTML = '';
      deg = degrees(graph);
      nodesPos = new Map(); dummyPos = new Map();
      const eL = el('g', {}, vp), nL = el('g', {}, vp); el('g', {}, vp);
      boxes.forEach(b => {
        const fg = el('g', { class: 'fam', transform: `translate(${b.x},${b.y})` }, eL);
        const ft = el('text', { class: 'flabel', x: 0, y: -26 }, fg); ft.textContent = b.title + (b.nodes.length > 3 ? ' …' : '') + `   (${b.nodes.length} words)`;
        if (m.familyText) el('text', {class:'family-audit', x:0, y:-9}, fg).textContent = m.familyText(b.nodes);
        b.coords.forEach((p, n) => nodesPos.set(n, { x: b.x + p.x, y: b.y + p.y + G.maxBar + 20 }));
        b.dummies.forEach((pts, k) => dummyPos.set(k, pts.map(q => ({ x: b.x + q.x, y: b.y + q.y + G.maxBar + 20 }))));
      });
      const drawn = [];
      graph.edges.forEach(e => {
        const a = nodesPos.get(e.s), b = nodesPos.get(e.t);
        const eg = el('g', { class: 'edgeg' }, eL); eg.dataset.s = e.s; eg.dataset.t = e.t; eg.dataset.r = e.rules.join(' ');
        const cls = mapClass(e, deg);
        eg.dataset.m = cls;
        const p = el('path', { class: 'edge ' + cls, d: edgePath(a, b, dummyPos.get(e.s + '>' + e.t)) }, eg);
        el('title', {}, eg).textContent = `${e.s} — ${e.t}: ${e.label ?? e.rules.join(' / ')}   (${MAP_TXT[cls].short})` + (m.ruleLines ? '\n' + m.ruleLines(e) : '');
        // Geometry sampling and all-edge label collision checks dominated render
        // time on expanded inventories. Dense views use native hover titles only.
        if(detailedLabels){
          const len = p.getTotalLength ? p.getTotalLength() : 0;
          const samples = []; for (let d = 0; d <= len; d += Math.max(8,len/80)) { const q = p.getPointAtLength(d); samples.push([q.x, q.y]); }
          drawn.push({ e, eg, p, len, samples, a, b });
        }
      });
      // each label goes where it covers the fewest other lines and no earlier label
      const pills = [];
      drawn.forEach(D0 => {
        const label = m.edgeLabel ? m.edgeLabel(D0.e) : D0.e.label ?? D0.e.rules.join(' / '), tw = [...label].length * 6.9 + 14;
        let bestM = null, bestScore = Infinity;
        for (const f of [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74, 0.18, 0.82]) {
          const q = D0.len ? D0.p.getPointAtLength(D0.len * f) : { x: (D0.a.x + D0.b.x) / 2, y: (D0.a.y + D0.b.y) / 2 };
          let score = Math.abs(f - 0.5);
          drawn.forEach(o => { if (o === D0) return; for (const [sx, sy] of o.samples) if (Math.abs(sx - q.x) < tw / 2 + 3 && Math.abs(sy - q.y) < 10) { score += 2; break; } });
          if (pills.some(r => Math.abs(r.x - q.x) < (r.w + tw) / 2 + 4 && Math.abs(r.y - q.y) < 20)) score += 10;
          if (score < bestScore) { bestScore = score; bestM = q; }
        }
        pills.push({ x: bestM.x, y: bestM.y, w: tw });
        const pg = el('g', { class: 'pill', transform: `translate(${bestM.x},${bestM.y})` }, D0.eg);
        el('rect', { x: -tw / 2, y: -9, width: tw, height: 18, rx: 9 }, pg);
        const tt = el('text', { x: 0, y: 4, 'text-anchor': 'middle' }, pg); tt.textContent = label;
      });
      graph.nodes.forEach(id => { const p = nodesPos.get(id); const gg = glyph(nL, m.word(id), p.x, p.y); badges(gg, id); bindNode(gg, id); });
      if (!graph.nodes.length) el('text', {x:20,y:40,class:'flabel'}, vp).textContent = m.emptyText || 'Nothing to show.';
      lastBox = boxes.length ? { w: Math.max(...boxes.map(b => b.x + b.w)), h: Math.max(...boxes.map(b => b.y + b.h)) + G.maxBar + 20 } : null;
      if (m.fit) fit(); else applyView();
      if (m.selected && nodesPos.has(m.selected)) select(m.selected, true); else { sel = null; opts.onSelect?.(null, true); }
    }

    // ---------- interaction
    function trace(id) {
      const on = new Set([id]); const eon = new Set();
      const walk = (x, dir) => { (dir ? graph.out : graph.inn).get(x)?.forEach(e => { if (!graph.edges.includes(e)) return; eon.add(e.s + '>' + e.t); const y = dir ? e.t : e.s; if (!on.has(y)) { on.add(y); walk(y, dir); } }); };
      walk(id, true); walk(id, false);
      return { on, eon };
    }
    function paint(on, eon) {
      vp.classList.add('dim');
      vp.querySelectorAll('.node').forEach(n => n.classList.toggle('on', on.has(n.dataset.id)));
      vp.querySelectorAll('.edgeg').forEach(e => { const k = eon.has(e.dataset.s + '>' + e.dataset.t); e.classList.toggle('on', k); });
    }
    function clearHi() {
      if (sel) { const t = trace(sel); paint(t.on, t.eon); return; }
      vp.classList.remove('dim'); vp.querySelectorAll('.on').forEach(x => x.classList.remove('on'));
    }
    const highlightEdges = keep => {
      const on = new Set(), eon = new Set();
      graph.edges.forEach(e => { if (keep(e)) { on.add(e.s); on.add(e.t); eon.add(e.s + '>' + e.t); } });
      paint(on, eon);
    };
    // a composed route (ed+GEDY_AR) lights up under each rule it needs
    const highlightRule = r => highlightEdges(e => e.rules.some(x => x.split('+').some(p => p.split('.')[0] === r)));
    const highlightClass = c => highlightEdges(e => mapClass(e, deg) === c);
    function bindNode(g, id) {
      g.addEventListener('mouseenter', () => { if (!sel) { const t = trace(id); paint(t.on, t.eon); } opts.onHover?.(id); });
      g.addEventListener('mouseleave', () => { clearHi(); opts.onHover?.(null); });
      g.addEventListener('click', ev => { ev.stopPropagation(); select(sel === id ? null : id); });
    }
    function select(id, keep) {
      sel = id;
      if (id && !keep && nodesPos.has(id)) { const p = nodesPos.get(id), sx = view.x + p.x * view.k, sy = view.y + p.y * view.k;
        if (sx < 40 || sx > svg.clientWidth - 80 || sy < 60 || sy > svg.clientHeight - 60) centerOn(p); }
      vp.querySelectorAll('.node').forEach(n => n.classList.toggle('sel', n.dataset.id === id));
      if (id) { const t = trace(id); paint(t.on, t.eon); } else clearHi();
      opts.onSelect?.(id, false);
    }

    // ---------- pan / zoom
    let drag = null, moved = false;
    svg.addEventListener('click', () => { if (!moved) select(null); });
    svg.addEventListener('mousedown', e => { drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; moved = false; svg.classList.add('drag'); });
    window.addEventListener('mousemove', e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) moved = true; view.x = drag.vx + dx; view.y = drag.vy + dy; applyView(); });
    window.addEventListener('mouseup', () => { drag = null; svg.classList.remove('drag'); setTimeout(() => moved = false, 0); });
    svg.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
    function zoomAt(px, py, f) { const k = Math.min(4, Math.max(0.15, view.k * f)); view.x = px - (px - view.x) * k / view.k; view.y = py - (py - view.y) * k / view.k; view.k = k; applyView(); }
    function fit() {
      if (!lastBox) return; const W = svg.clientWidth, H = svg.clientHeight;
      // An incident-only search opens on its requested word, not an incoming peripheral form at the top of a tall
      // component. Pan/zoom remains available.
      const focus = m && m.focus;
      if(focus&&nodesPos.has(focus)){view.k=.8;const p=nodesPos.get(focus);view.x=W/2-(p.x+G.glyphW/2)*view.k;view.y=H/2-(p.y-20)*view.k;applyView();return;}
      view.k = Math.max(0.5, Math.min(1.1, (W - 40) / (lastBox.w + 20)));
      view.x = 20; view.y = 16 + 34 * view.k; applyView();
    }
    function centerOn(p) { view.k = Math.max(view.k, 1); view.x = svg.clientWidth / 2 - (p.x + G.glyphW / 2) * view.k; view.y = svg.clientHeight / 2 - (p.y - 30) * view.k; applyView(); }

    return {draw, select, fit, zoom: f => zoomAt(svg.clientWidth / 2, svg.clientHeight / 2, f), clear: clearHi, highlightRule, highlightClass,
      get selected() { return sel; }, get graph() { return graph; }};
  }

  const api = {GEOMETRY, MAP_TXT, geometry, degrees, mapClass, layout, create};
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.EchoNetworkView = api;
})(typeof window !== 'undefined' ? window : globalThis);
