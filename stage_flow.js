/* Stage accounting: independent pairwise ledgers and a linked source -> middle -> target allocation.
 * Pure and DOM-free (node tests import it). Rates are per 10k words of each population, as everywhere in the app.
 *
 * Each comparison first credits mass that keeps its spelling ("same spelling"), word by word, as the existing
 * pairwise accounting does; with a leg exchange (k<->t, one-to-one) "same spelling" means the exchanged spelling.
 * The rest moves along enabled pairings. A pairwise ledger is one optimum of its own; ledgers of different legs are
 * not one path and cannot be added. The linked view shares one source budget across direct and staged routes, caps
 * the mass passing through each middle form at its observed middle stock, and credits each target word once:
 *   1. same-spelling credit (closed form: the exchange is one-to-one, so nothing competes for it)
 *   2. maximum routed target credit
 *   3. then the most source mass that reaches middle stock but stops there ("arrivals that stop")
 * Many allocations reach the same optimum; ranges() reports the least and most each route or split can carry
 * across all of them. Nothing here is a fitted policy or recovered history.
 */
(function (root) {
  'use strict';
  const EPS = 1e-9, STOP = 1e-3, PREFER = 1e-6;
  const GM = typeof module !== 'undefined' && module.exports ? require('./graph_metrics.js') : root.EchoGraphMetrics;

  // ---- min-cost flow by successive shortest paths (queue-based Bellman-Ford, so negative costs are fine).
  // With forceMax false the flow grows only while the cheapest path still has negative cost: rewards are negative costs.
  function Flow() { this.g = []; }
  Flow.prototype.node = function () { this.g.push([]); return this.g.length - 1; };
  Flow.prototype.edge = function (u, v, cap, cost) {
    const a = {to: v, cap, cost, rev: this.g[v].length, init: cap}, b = {to: u, cap: 0, cost: -cost, rev: this.g[u].length, init: 0};
    a.back = b; this.g[u].push(a); this.g[v].push(b); return a;
  };
  Flow.prototype.run = function (s, t, forceMax = false) {
    const n = this.g.length; let total = 0, cost = 0;
    for (let guard = 0; guard < 1e6; guard++) {
      const dist = new Float64Array(n).fill(Infinity), inq = new Uint8Array(n), prev = new Array(n), q = [s];
      dist[s] = 0; inq[s] = 1;
      for (let h = 0; h < q.length; h++) {
        const u = q[h]; inq[u] = 0;
        for (const e of this.g[u]) if (e.cap > EPS && dist[u] + e.cost < dist[e.to] - 1e-12) {
          dist[e.to] = dist[u] + e.cost; prev[e.to] = e; if (!inq[e.to]) { inq[e.to] = 1; q.push(e.to); }
        }
      }
      if (dist[t] === Infinity || (!forceMax && dist[t] >= -1e-12)) break;
      let f = Infinity;
      for (let v = t; v !== s; v = this.g[v][prev[v].rev].to) f = Math.min(f, prev[v].cap);
      for (let v = t; v !== s; v = this.g[v][prev[v].rev].to) { const e = prev[v]; e.cap -= f; this.g[v][e.rev].cap += f; }
      total += f; cost += f * dist[t];
    }
    return {total, cost};
  };
  // Flow on an edge is its reverse edge's residual capacity (init - cap fails for uncapacitated edges: inf - inf).
  const flowOf = e => e.back.cap;

  // Enabled pairings with their rule codes, exactly as graph_metrics.enabledGraph forms them: catalog mappings are
  // forward-only; historical edges and declared two-step endpoints (C1, C3, C4 ...) work both ways.
  function graphPairs(data, enabled) {
    const out = [];
    for (const e of data.edges) { const rules = e.rules.filter(r => GM.ruleLive(r, enabled)); if (rules.length) out.push([e.s, e.t, !!e.forwardOnly, rules]); }
    for (const c of data.chains) if (enabled.has(c.rule)) out.push([c.path[0], c.path[2], false, [`${c.rule} (via ${c.path[1]})`]]);
    return out;
  }
  // destinations per word from enabled pairs [a, b, forwardOnly, rules]; composite chain endpoints included.
  function destinations(pairs) {
    const out = new Map();
    const add = (a, b, rules) => { if (!out.has(a)) out.set(a, new Map()); const m = out.get(a); m.set(b, new Set([...(m.get(b) || []), ...rules])); };
    for (const [a, b, forwardOnly, rules = []] of pairs) { if (a === b) continue; add(a, b, rules); if (!forwardOnly) add(b, a, rules); }
    return out;
  }

  // Leg operations. 'kt' swaps every plain k/t atom (exported by build_stages.py from the toolkit parser).
  function legOp(kind, stageWords) {
    if (!kind || kind === 'none') return w => w;
    if (kind === 'kt') {
      // The exchange is an involution: an unattested exchanged spelling maps back through the reverse lookup.
      const back = new Map(Object.entries(stageWords).filter(([, v]) => v[1]).map(([w, v]) => [v[1], w]));
      return w => (stageWords[w] && stageWords[w][1]) || back.get(w) || w;
    }
    throw new Error('Unknown leg operation: ' + kind);
  }
  // Exchange timing -> operations of the first leg, second leg and the direct (composite) route.
  function timing(when, stageWords) {
    const k = legOp('kt', stageWords), id = legOp('none');
    const first = when === 'first' || when === 'both', second = when === 'second' || when === 'both';
    const op1 = first ? k : id, op2 = second ? k : id;
    return {op1, op2, opD: w => op2(op1(w)), first, second, direct: first !== second};
  }

  // Connected groups of words that can exchange mass in this comparison (rules, exchange and same-spelling links).
  function components(members, dest, ops) {
    const parent = new Map([...members].map(w => [w, w]));
    const find = w => { while (parent.get(w) !== w) { parent.set(w, parent.get(parent.get(w))); w = parent.get(w); } return w; };
    const join = (a, b) => { if (!parent.has(a) || !parent.has(b)) return; const x = find(a), y = find(b); if (x !== y) parent.set(x, y); };
    for (const w of members) for (const op of ops) {
      const x = op(w); join(w, x);
      for (const v of (dest.get(x) || new Map()).keys()) join(w, v);
      for (const v of (dest.get(w) || new Map()).keys()) join(w, v);
    }
    const groups = new Map();
    for (const w of members) { const r = find(w); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(w); }
    return [...groups.values()];
  }

  /* One comparison on one group of words.
   * spec: {words (array), rate(word, pop), P, Q, R, mode: 'direct'|'staged'|'both', dest, op1, op2, stops, prefer}
   * Q is ignored in direct mode. prefer: Map of edge key -> +1 (more) / -1 (less), used by ranges(); 's:w' / 'r:w' prefer
   * more or less of everything word w sends / receives. */
  function solveGroup(spec) {
    const {words, rate, P, Q, R, mode = 'direct', dest, op1 = w => w, op2 = w => w, stops = false, prefer} = spec;
    const inScope = new Set(words), opD = w => op2(op1(w));
    const direct = mode !== 'staged', staged = mode !== 'direct';
    const a = new Map(), m = new Map(), b = new Map();
    for (const w of words) { a.set(w, rate(w, P)); b.set(w, rate(w, R)); m.set(w, staged ? rate(w, Q) : 0); }
    // 1. same-spelling credit, closed form (op1, op2 one-to-one: no two sources share an identity middle or target)
    const id = new Map(), aR = new Map(a), bR = new Map(b), mR = new Map(m), idVia = new Map();
    for (const w of words) {
      const u = op1(w), t = opD(w); if (!inScope.has(t)) continue;
      let x = Math.min(a.get(w), b.get(t));
      if (mode === 'staged') x = inScope.has(u) ? Math.min(x, m.get(u)) : 0;
      if (x <= EPS) continue;
      id.set(w, x); aR.set(w, aR.get(w) - x); bR.set(t, bR.get(t) - x);
      if (mode === 'staged') { mR.set(u, mR.get(u) - x); idVia.set(w, u); }
    }
    // 2-3. routed credit and arrivals that stop, as one min-cost flow with tiered rewards
    const F = new Flow(), S = F.node(), T = F.node(), E = new Map(), MI = new Map(), MO = new Map(), H = new Map(), edges = [];
    const weight = key => prefer && prefer.has(key) ? -PREFER * prefer.get(key) : 0;
    for (const w of words) {
      if (aR.get(w) > EPS) { E.set(w, F.node()); F.edge(S, E.get(w), aR.get(w), weight('s:' + w)); }
      if (bR.get(w) > EPS) { H.set(w, F.node()); edges.push({type: 'final', to: w, e: F.edge(H.get(w), T, bR.get(w), -1 + weight('r:' + w))}); }
      if (staged && mR.get(w) > EPS) {
        MI.set(w, F.node()); MO.set(w, F.node());
        edges.push({type: 'through', at: w, e: F.edge(MI.get(w), MO.get(w), mR.get(w), weight('t:' + w))});
        if (stops) edges.push({type: 'stop', at: w, e: F.edge(MO.get(w), T, Infinity, -STOP)});
      }
    }
    const routes = (x, op) => { const y = op(x), out = new Map(); if (inScope.has(y)) out.set(y, {same: true, rules: new Set()});
      for (const [v, rules] of dest.get(y) || []) if (inScope.has(v) && v !== y) out.set(v, {same: false, rules}); return out; };
    for (const [w, ew] of E) {
      if (direct) for (const [v, r] of routes(w, opD)) if (!r.same && H.has(v)) edges.push({type: 'direct', from: w, to: v, rules: r.rules, e: F.edge(ew, H.get(v), Infinity, weight(`d:${w}>${v}`))});
      if (staged) for (const [u, r] of routes(w, op1)) if (MI.has(u)) edges.push({type: 'leg1', from: w, to: u, same: r.same, rules: r.rules, e: F.edge(ew, MI.get(u), Infinity, weight(`1:${w}>${u}`))});
    }
    if (staged) for (const [u, mo] of MO) for (const [v, r] of routes(u, op2)) if (H.has(v)) edges.push({type: 'leg2', from: u, to: v, same: r.same, rules: r.rules, e: F.edge(mo, H.get(v), Infinity, weight(`2:${u}>${v}`) + (prefer && prefer.has('staged') ? -PREFER * prefer.get('staged') : 0))});
    F.run(S, T);
    // ---- read the allocation
    const all = edges.map(x => ({...x, flow: flowOf(x.e), e: undefined})), flows = all.filter(x => x.flow > EPS || x.type === 'final');
    const sum = type => flows.filter(x => x.type === type).reduce((s, x) => s + x.flow, 0);
    const per = new Map(words.map(w => [w, {word: w, source: a.get(w), middle: m.get(w), target: b.get(w), same: id.get(w) || 0, sameIn: 0,
      direct: 0, toMiddle: 0, inflow: 0, passed: 0, stops: 0, received: 0}]));
    for (const [w, x] of id) { per.get(opD(w)).sameIn += x; if (idVia.has(w)) { per.get(idVia.get(w)).inflow += x; per.get(idVia.get(w)).passed += x; } }
    for (const x of flows) {
      if (x.type === 'direct') { per.get(x.from).direct += x.flow; per.get(x.to).received += x.flow; }
      else if (x.type === 'leg1') per.get(x.from).toMiddle += x.flow;
      else if (x.type === 'through') per.get(x.at).inflow += x.flow;
      else if (x.type === 'leg2') { per.get(x.from).passed += x.flow; per.get(x.to).received += x.flow; }
      else if (x.type === 'stop') per.get(x.at).stops += x.flow;
    }
    for (const r of per.values()) {
      r.credited = r.sameIn + r.received;                         // target credit of this word, counted once
      r.left = Math.max(0, r.source - r.same - r.direct - r.toMiddle);
      r.missing = Math.max(0, r.target - r.credited);
      r.unreached = Math.max(0, r.middle - r.inflow);             // middle stock no credited path or stop explains
      r.baseline = Math.min(r.source, r.target);                  // unchanged-word overlap for this target word
    }
    const t = {source: 0, middle: 0, target: 0, same: 0, direct: sum('direct'), staged: sum('leg2'), stops: sum('stop'), baseline: 0, gained: 0, lost: 0};
    for (const r of per.values()) {
      t.source += r.source; t.middle += r.middle; t.target += r.target; t.same += r.same; t.baseline += r.baseline;
      t.gained += Math.max(0, r.credited - r.baseline); t.lost += Math.max(0, r.baseline - r.credited);
    }
    t.routed = t.direct + t.staged; t.credited = t.same + t.routed;
    t.sameThrough = mode === 'staged' ? t.same : 0;
    t.through = t.sameThrough + t.staged;                          // credited mass that passed through middle stock
    t.left = Math.max(0, t.source - t.same - t.direct - [...per.values()].reduce((s, r) => s + r.toMiddle, 0));
    t.missing = Math.max(0, t.target - t.credited);
    t.unreached = Math.max(0, t.middle - t.through - t.stops);
    t.net = t.credited - t.baseline;
    return {mode, totals: t, perWord: per, flows, edges: all};
  }

  // A whole comparison: split the scope into independent groups and add them up.
  function solve(spec) {
    const ops = [spec.op1 || (w => w), spec.op2 || (w => w)];
    const groups = components(new Set(spec.words), spec.dest, ops);
    // start every total at zero, so an empty scope still reports a complete ledger
    const zero = solveGroup({...spec, words: []}).totals;
    const out = {mode: spec.mode || 'direct', totals: Object.fromEntries(Object.keys(zero).map(k => [k, 0])), perWord: new Map(), flows: [], edges: [], groups: groups.length};
    for (const g of groups) {
      const r = solveGroup({...spec, words: g});
      for (const [k, v] of Object.entries(r.totals)) out.totals[k] = (out.totals[k] || 0) + v;
      for (const [w, v] of r.perWord) out.perWord.set(w, v);
      for (const x of r.flows) out.flows.push(x);
      for (const x of r.edges) out.edges.push(x);
    }
    return out;
  }

  // Least and most of each queried quantity across every allocation with the same optimal credit.
  // Queries are edge keys ('d:w>v', '1:w>u', '2:u>v', 't:u'), 'staged' (all routed credit through the middle),
  // 's:w' (all that word w sends, directly or to the middle) or 'r:w' (all that w receives).
  function ranges(spec, keys) {
    const read = (r, key) => {
      if (key === 'staged') return r.totals.staged;
      const [type, rest] = [key[0], key.slice(2)];
      if (type === 's') { const x = r.perWord.get(rest); return x ? x.direct + x.toMiddle : 0; }
      if (type === 'r') { const x = r.perWord.get(rest); return x ? x.received : 0; }
      if (type === 't') return r.flows.filter(x => x.type === 'through' && x.at === rest).reduce((s, x) => s + x.flow, 0);
      const [from, to] = rest.split('>'), kind = {d: 'direct', 1: 'leg1', 2: 'leg2'}[type];
      return r.flows.filter(x => x.type === kind && x.from === from && x.to === to).reduce((s, x) => s + x.flow, 0);
    };
    const base = solveGroup({...spec, stops: false}).totals.credited, out = new Map();
    for (const key of keys) {
      const hi = solveGroup({...spec, stops: false, prefer: new Map([[key, 1]])}), lo = solveGroup({...spec, stops: false, prefer: new Map([[key, -1]])});
      // the preference must never cost credit; guard against numerical drift
      if (Math.abs(hi.totals.credited - base) > 1e-6 || Math.abs(lo.totals.credited - base) > 1e-6) throw new Error('Range query changed the optimum');
      out.set(key, {min: read(lo, key), max: read(hi, key)});
    }
    return out;
  }

  // Least and most credit routed through the middle (the rest is routed directly) across every optimal 'both'
  // allocation. Groups are independent, so their ranges add.
  function splitRange(spec) {
    const id = w => w, groups = components(new Set(spec.words), spec.dest, [spec.op1 || id, spec.op2 || id]);
    let min = 0, max = 0;
    for (const g of groups) {
      const s = {...spec, words: g, mode: 'both', stops: false};
      if (solveGroup(s).totals.routed <= EPS) continue;
      const v = ranges(s, ['staged']).get('staged'); min += v.min; max += v.max;
    }
    return {min, max};
  }

  // Least and most one word sends ('sent') or receives ('received') across every optimal allocation of a comparison,
  // solved on the word's own group only (groups are independent). Null when the word is outside the scope.
  function wordRanges(spec, word, kinds = ['sent', 'received']) {
    const ops = [spec.op1 || (w => w), spec.op2 || (w => w)];
    const group = components(new Set(spec.words), spec.dest, ops).find(g => g.includes(word));
    if (!group) return null;
    const keys = kinds.map(k => (k === 'sent' ? 's:' : 'r:') + word), r = ranges({...spec, words: group}, keys), out = {};
    kinds.forEach((k, i) => { out[k] = r.get(keys[i]); });
    return out;
  }

  const api = {Flow, graphPairs, destinations, legOp, timing, components, solveGroup, solve, ranges, splitRange, wordRanges, EPS};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EchoStageFlow = api;
})(typeof window !== 'undefined' ? window : globalThis);
