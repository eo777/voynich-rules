/* Chain: a family of spellings along Golf's proposed order. Pure counting, scopes, step ledgers and the ribbon layout;
 * chain_view.js renders. Columns are Golf 2.1's chain groups (1a … 4c, paragraph text) or the 50 pooled bifolia in
 * Golf's order. A step's ledger is the app's shared-capacity accounting (graph_metrics.maximumFlow) between two
 * neighbouring columns: kept = the same spelling on both sides, routed = matched loss and gain along an active rule,
 * the rest unplaced or unfilled. It is a capacity bound on what the rules could explain, never a history of tokens.
 */
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const C = node ? require('./workbench_core.js') : root.EchoWorkbenchCore;
  const GM = node ? require('./graph_metrics.js') : root.EchoGraphMetrics;
  const CI = node ? require('./connection_inspector.js') : root.EchoConnectionInspector;

  const CHAIN = ['1a', '1b', '1.5a', '2a', '3a', '3b', '3c', '4a', '4c'];            // Golf's proposed order: Stars-T, Bio, Stars-S
  const ALT_CHAIN = ['1a', '1b', '1.5a', '2a', '3a', '3b', '3c', '4c', '4a'];        // Golf's alternate curve: Stars-T, Stars-S, Bio
  const OFF_CHAIN = ['5a', '6'];
  const TERMINAL = new Set(['3c', '4a', '4c']);                                         // Golf's terminal cohort: Stars-T, Bio, Stars-S
  // Golf's fork at 3a (team_golf/fork_at_3a_20261011): one trunk 1a → 1b → 1.5a → 2a → 3a, then two arms, 3a → 3b → 4a
  // (Herbal B to Bio) and 3a → 3c → 4c (Herbal B to Stars-T to Stars-S); on the group axes only (the bifolia keep a line)
  const FORK = {at: '3a', trunk: ['1a', '1b', '1.5a', '2a', '3a'], arms: [{key: 'bio', label: 'Bio arm', groups: ['3b', '4a']}, {key: 'stars', label: 'Stars arm', groups: ['3c', '4c']}]};
  const FORK_CHAIN = FORK.trunk.concat(...FORK.arms.map(a => a.groups));              // the fork's columns: the trunk, then each arm
  const ORDERS = ['proposed', 'alternate', 'fork'];
  const MIDDLE_KEY = 'mid', MIDDLE_GROUPS = ['5a', '6'];                               // the off-chain classes between 2a and 3a on the path
  const isGroups = axis => axis === 'groups' || axis === 'groupsPos';
  const MIN_GROUP_GAP = 78;                                                             // px between group columns placed at path positions
  const SPARSE = 20;          // no share is read on fewer tokens (KNOWN 7.1)
  const GAP = 2;              // surface gap between stacked bands, in px
  const PER = 10000;
  const core = w => w && w.replace(/^q/, '');
  const order = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

  function addLine(col, line, spelling) {
    let any = false;
    for (const raw of line.words) {
      if (!raw) continue;
      any = true; col.N++;
      const w = spelling(raw);
      col.counts.set(w, (col.counts.get(w) || 0) + 1);
      if (!col.pagesOf.has(w)) col.pagesOf.set(w, new Set());
      col.pagesOf.get(w).add(line.folio);
    }
    if (any) col.pages.add(line.folio);
  }
  const column = (key, meta) => ({key, label: key, title: '', group: null, rank: null, position: null, ...meta, N: 0, pages: new Set(), counts: new Map(), pagesOf: new Map()});

  // The columns of one axis with every paragraph word counted once: 'groups' = the chain classes in order (a page's
  // paragraph text counts under its working class; labels, circles and radii never do); 'pools' / 'poolsPos' = Golf's
  // pooled bifolia by rank, every paragraph page of the sheet, with the pool's working group from `pools` (chain_data)
  // or, without it, the one class of its pages. `order` 'proposed' follows Golf's proposed curve (Stars-T, Bio,
  // Stars-S); 'alternate' its alternate curve (Stars-T, Stars-S, Bio): the groups 4c and 4a swap, and the pools take
  // the alternate curve's ranks and positions from `pools` (alt_rank, alt_position) where they are saved; 'fork' is
  // Golf's fork at 3a on the group axes (the trunk to 3a, then the Bio arm 3b, 4a and the Stars arm 3c, 4c, each column
  // with its slot on x and its row; the bifolia fall back to the alternate order). The result carries the steps as
  // column-index pairs and the paths (each a chain of column indices) that the ledgers, the parking and the layout follow.
  function columns({manuscript, lines, axis = 'groups', mergeQ = false, pools = null, order: ord = 'proposed', middle = false}) {
    const G = manuscript.golf21 || {units: {}, classes: []}, sheets = (manuscript.golf_path || {}).sheets || {};
    const fork = ord === 'fork' && isGroups(axis);
    const spelling = mergeQ ? core : w => w, alternate = ord === 'alternate' || (ord === 'fork' && !fork);
    const para = lines.filter(l => (l.category || 'para') === 'para');
    let cols, forkMeta = null;
    if (isGroups(axis)) {
      const labels = Object.fromEntries((G.classes || []).map(c => [c.code, c.label]));
      // the slots of the proposed order, and the codes that fill them (the alternate order swaps 4a and 4c; the fork
      // lists the trunk, then each arm); with `middle`, one more slot after 2a pools the paragraph text of the two
      // off-chain pools between 2a and 3a on the path (J:69-70, class 5a: f69r and f70r2; H:58-65, class 6: f58): a page
      // counts there only when its class is 5a or 6 and its sheet is one of those pools, so 5a pages on 2a or 3c sheets
      // and f65v (class 3b) stay out
      const withMiddle = list => { const out = list.slice(); if (middle) out.splice(out.indexOf('2a') + 1, 0, MIDDLE_KEY); return out; };
      const slots = withMiddle(CHAIN), codes = withMiddle(fork ? FORK_CHAIN : alternate ? ALT_CHAIN : CHAIN);
      const midPools = pools ? new Set(Object.keys(pools).filter(k => MIDDLE_GROUPS.includes(pools[k].group))) : null;
      cols = codes.map((code, i) => column(code, code === MIDDLE_KEY
        ? {group: MIDDLE_KEY, title: 'Celestial paragraphs of f69r and f70r2 (5a) and f58 (6): the paragraph text of the two pools between 2a and 3a on the path', rank: i + 1}
        : {group: code, title: labels[code] || '', rank: i + 1}));
      if (axis === 'groupsPos' && pools) {
        // each slot sits at the median proposed-path position of its group's pools (its span kept for the header); the
        // alternate order fills the same slots in its own order, so the geometry stays the proposed path's; under the
        // fork each arm column sits at its own group's median
        const of = groups_ => Object.values(pools).filter(p => groups_.includes(p.group)).map(p => p.position).sort((a, b) => a - b);
        slots.forEach((code, i) => { const own = fork ? cols[i].key : code, ps = of(own === MIDDLE_KEY ? MIDDLE_GROUPS : [own]); cols[i].position = ps.length ? ps[Math.floor(ps.length / 2)] : null; cols[i].span = ps.length ? [ps[0], ps[ps.length - 1]] : null; });
      }
      cols.forEach((c, i) => { c.slot = i; c.row = 0; });
      if (fork) {
        // the trunk keeps its slots; each arm's columns take the slots after the fork column, the second arm in a row of its own
        const at = cols.findIndex(c => c.key === FORK.at);
        const arms = FORK.arms.map((arm, r) => ({key: arm.key, label: arm.label, row: r, cols: arm.groups.map(g => cols.findIndex(c => c.key === g))}));
        for (const arm of arms) arm.cols.forEach((i, k) => { cols[i].slot = at + 1 + k; cols[i].row = arm.row; });
        forkMeta = {at, arms};
      }
      const at = new Map(cols.map(c => [c.key, c]));
      if (middle) for (const g of MIDDLE_GROUPS) at.set(g, at.get(MIDDLE_KEY));
      for (const l of para) {
        const c = at.get(G.units[l.folio + '|para']);
        if (c && !(c.key === MIDDLE_KEY && midPools && !midPools.has(l.sheet))) addLine(c, l, spelling);
      }
    } else {
      // the proposed order's slots; under the alternate order the terminal cohort (Golf's Stars-T, Bio and Stars-S
      // bifolia, groups 3c, 4a, 4c) is permuted within its own slots by the alternate curve's positions, and every
      // other bifolium keeps its proposed place: the alternate curve's different Early-A start is not used
      const keys = Object.keys(sheets).sort((a, b) => sheets[a].rank - sheets[b].rank || order(a, b));
      let placed = keys;
      if (alternate && pools) {
        const slots = keys.map((k, i) => i).filter(i => pools[keys[i]] && TERMINAL.has(pools[keys[i]].group) && pools[keys[i]].alt_position != null);
        const cohort = slots.map(i => keys[i]).sort((a, b) => pools[a].alt_position - pools[b].alt_position || sheets[a].rank - sheets[b].rank);
        placed = keys.slice();
        slots.forEach((i, j) => { placed[i] = cohort[j]; });
      }
      cols = placed.map((k, i) => column(k, {group: pools && pools[k] ? pools[k].group : null, rank: sheets[keys[i]].rank, position: sheets[keys[i]].position}));
      const at = new Map(cols.map(c => [c.key, c]));
      for (const l of para) { const c = at.get(l.sheet); if (c) addLine(c, l, spelling); }
      for (const c of cols) if (!c.group) { const g = new Set([...c.pages].map(f => G.units[f + '|para'] || 'unassigned')); c.group = g.size === 1 ? [...g][0] : 'mixed'; }
    }
    const spellings = new Set();
    for (const c of cols) for (const w of c.counts.keys()) spellings.add(w);
    // the steps as column-index pairs and the paths each step lies on: one line, or under the fork the trunk followed by each arm
    let steps = cols.slice(1).map((c, i) => [i, i + 1]), paths = [cols.map((c, i) => i)];
    if (forkMeta) {
      const trunk = cols.map((c, i) => i).filter(i => i <= forkMeta.at);
      steps = trunk.slice(1).map(i => [i - 1, i]);
      for (const arm of forkMeta.arms) { let prev = forkMeta.at; for (const i of arm.cols) { steps.push([prev, i]); prev = i; } }
      paths = forkMeta.arms.map(arm => trunk.concat(arm.cols));
    }
    return {axis, mergeQ, order: fork ? 'fork' : alternate ? 'alternate' : 'proposed', columns: cols, spellings, steps, paths, fork: forkMeta};
  }
  // The steps of a column set as index pairs: its own list, else every neighbouring pair (a bare {columns} as the tests
  // and the studies build it).
  const stepsOf = cols => (Array.isArray(cols.steps) && cols.steps.length && Array.isArray(cols.steps[0]) ? cols.steps : cols.columns.slice(1).map((c, i) => [i, i + 1]));
  const pathsOf = cols => (Array.isArray(cols.paths) && cols.paths.length ? cols.paths : [cols.columns.map((c, i) => i)]);
  // The same column set without the columns named (by key): on each path the surviving neighbours of a removed column
  // form one direct step, the paths and the fork lose the column, every index moves down, the slots close up, and each
  // new step remembers the original step keys it spans (`spans`: 'a>c' → ['a>b', 'b>c']) so a schedule can be read
  // across the gap (spanSchedule). The spellings are recounted over the surviving columns.
  function dropColumns(cols, keys) {
    const K = cols.columns, gone = new Set(keys || []);
    if (!K.some(c => gone.has(c.key))) return cols;
    const keep = K.map((c, i) => i).filter(i => !gone.has(K[i].key)), map = new Map(keep.map((i, k) => [i, k]));
    const columns = keep.map(i => ({...K[i]}));
    const seen = new Set(), steps = [], spans = {}, paths = [];
    for (const p of pathsOf(cols)) {
      const survivors = p.filter(i => !gone.has(K[i].key));
      paths.push(survivors.map(i => map.get(i)));
      survivors.forEach((i, k) => { columns[map.get(i)].slot = k; });      // the slots close up along each path
      for (let k = 0; k + 1 < survivors.length; k++) {
        const a = survivors[k], b = survivors[k + 1], key = map.get(a) + '>' + map.get(b);
        if (seen.has(key)) continue;
        seen.add(key); steps.push([map.get(a), map.get(b)]);
        const ia = p.indexOf(a), ib = p.indexOf(b), prev = cols.spans || null;
        // the original steps between a and b on this path; a column set that was itself reduced resolves them further
        spans[K[a].key + '>' + K[b].key] = p.slice(ia, ib).map((x, q) => K[x].key + '>' + K[p[ia + q + 1]].key).flatMap(k => (prev && prev[k] ? prev[k] : [k]));
      }
    }
    let fork = null;
    if (cols.fork) {
      const trunk = (pathsOf(cols)[0] || []).slice(0, (pathsOf(cols)[0] || []).indexOf(cols.fork.at) + 1).filter(i => !gone.has(K[i].key));
      const arms = cols.fork.arms.map(a => ({...a, cols: a.cols.filter(i => !gone.has(K[i].key)).map(i => map.get(i))})).filter(a => a.cols.length);
      if (trunk.length && arms.length > 1) fork = {at: map.get(trunk[trunk.length - 1]), arms};
    }
    const spellings = new Set();
    for (const c of columns) for (const w of c.counts.keys()) spellings.add(w);
    // a path left as a prefix of another (an arm hidden entirely) is the same line and is dropped
    const kept = paths.filter(p => p.length).filter((p, k, all) => !all.some((q, l) => l !== k && q.length > p.length && p.every((v, idx) => q[idx] === v)));
    return {...cols, columns, spellings, steps, paths: kept, fork, spans, hidden: K.filter(c => gone.has(c.key)).map(c => c.key)};
  }
  // The same column set without its middle column: the two steps around it become the one direct step.
  const dropMiddle = cols => dropColumns(cols, [MIDDLE_KEY]);
  // A schedule read across hidden columns: a step with no cells of its own that spans several original steps runs each
  // rule at the clamped sum of its degrees over the steps it replaces (full forward then partial reverse = partial
  // forward; opposite full degrees cancel); the A-side guard covers a spanned step when it covers every step inside it.
  // The two half-steps around the middle column read as the one chain step they refine ('2a>mid', 'mid>3a' → '2a>3a'),
  // so a gap that contains the middle column is not counted twice.
  const collapseMiddle = list => { const out = []; for (const k of list) { const last = out[out.length - 1]; if (last && last.endsWith('>' + MIDDLE_KEY) && k.startsWith(MIDDLE_KEY + '>')) out[out.length - 1] = last.split('>')[0] + '>' + k.split('>')[1]; else out.push(k); } return out; };
  function spanSchedule(schedule, spans) {
    if (!schedule || !spans) return schedule;
    const span = Object.fromEntries(Object.keys(spans).map(k => [k, collapseMiddle(spans[k])]));
    const keys = Object.keys(span).filter(k => span[k].length > 1 || (span[k].length === 1 && span[k][0] !== k));
    if (!keys.length) return schedule;
    const rules = {}, spanned = {};
    for (const [code, row] of Object.entries(schedule.rules || {})) {
      const r = {...row};
      for (const k of keys) if (r[k] == null) { r[k] = Math.max(-1, Math.min(1, span[k].reduce((v, s) => v + (row[s] || 0), 0))); spanned[k] = span[k]; }
      rules[code] = r;
    }
    const guarded = schedule.no_new_d && Array.isArray(schedule.no_new_d.steps) ? schedule.no_new_d.steps : null;
    const no_new_d = guarded ? {...schedule.no_new_d, steps: guarded.concat(Object.keys(spanned).filter(k => span[k].every(s => guarded.includes(s))))} : schedule.no_new_d;
    return {...schedule, rules, no_new_d, spanned};
  }
  // The flows between a set's kept words and its removed words, per column: what the removed words receive at the step
  // into the column and send at the step out of it (the two faces of the "removed words" band); routes among the
  // removed words themselves, and their own kept and unexplained mass, are not drawn.
  function removedFlows(L, n, removed) {
    const inflow = new Array(n).fill(0), outflow = new Array(n).fill(0);
    const add = (routes, i, j) => { for (const r of routes || []) { const a = removed.has(r.from), b = removed.has(r.to); if (a === b) continue; if (b) inflow[j] += r.mass; else outflow[i] += r.mass; } };
    for (const s of L || []) add(s.routes, s.i != null ? s.i : s.step, s.j != null ? s.j : (s.i != null ? s.i : s.step) + 1);
    if (L && L.pass) add(L.pass.routes, L.pass.i != null ? L.pass.i : L.pass.step, L.pass.j != null ? L.pass.j : L.pass.step2 + 1);
    return {inflow, outflow};
  }
  const REMOVED_LABEL = 'removed words';
  const REST_LABEL = 'rest of the family';

  // The lineage of `seeds` along the steps, as the selection lineage reads it: forward, every key a flow out of a key
  // already reached could feed, step after step (descendants); backward, every key that could feed one already reached,
  // step before step (ancestors). Each path is followed on its own, so under the fork a key reached on one arm is not
  // followed on the other. `flows` are {from, to, i, j}, i and j the column indices of their ends; a flow spanning two
  // steps (the middle text's transit) is read at each. A capacity reading, not descent. Returns the keys reached each
  // way, all of them (`keys`), and the flows followed forward (`out`) and backward (`into`).
  function lineageOf(flows, paths, seeds) {
    const fwd = new Set(seeds), back = new Set(seeds), out = new Set(), into = new Set();
    for (const p of paths || []) {
      const pos = new Map(p.map((c, k) => [c, k]));
      const steps = p.slice(1).map((c, k) => flows.filter(f => pos.has(f.i) && pos.has(f.j) && pos.get(f.i) <= k && pos.get(f.j) > k));
      const F = new Set(seeds), B = new Set(seeds);
      for (const fs of steps) for (const f of fs) if (F.has(f.from)) { F.add(f.to); out.add(f); }
      for (const fs of steps.slice().reverse()) for (const f of fs) if (B.has(f.to)) { B.add(f.from); into.add(f); }
      for (const k of F) fwd.add(k); for (const k of B) back.add(k);
    }
    return {fwd, back, keys: new Set([...fwd, ...back]), out, into};
  }
  // a ledger's routes as flows between spellings at their columns, with the middle text's transit routes
  const ledgerFlows = L => (L || []).flatMap(s => s.routes.map(r => ({from: r.from, to: r.to, i: s.i, j: s.j, mass: r.mass})))
    .concat(L && L.pass ? L.pass.routes.map(r => ({from: r.from, to: r.to, i: L.pass.i, j: L.pass.j, mass: r.mass})) : []);

  // The spellings a scope names: 'family' = the word's connected component under the active rules (the network is
  // q-merged; in exact mode each member's q spelling present in the text joins it), 'front' / 'tail' = every spelling
  // sharing the word's saved FRONT or TAIL, 'pattern' = the spellings matching the pattern (app syntax). 'lineage'
  // starts from the family: the view keeps the spellings the family's rule flows link to the word (lineageOf).
  function members({scope, query, mergeQ = false, spellings, data, rules, splits}) {
    const q = String(query || '').trim(), none = (error, seed = null) => ({words: new Set(), seed, error});
    if (scope === 'all') return {words: new Set(spellings), seed: null, error: spellings.size ? null : 'No paragraph text.'};
    if (!q) return none('Type a word or a pattern.');
    if (scope === 'pattern') {
      let test;
      try { test = C.pattern(q); } catch (e) { return none(e.message); }
      const words = new Set([...spellings].filter(w => test(w)));
      return {words, seed: null, error: words.size ? null : `No spelling in the paragraph text matches “${q}”.`};
    }
    const seed = mergeQ ? core(q) : q;
    if (!spellings.has(seed)) return none(`“${seed}” is not in the paragraph text${seed !== q ? ' (q merged)' : ''}.`, seed);
    if (scope === 'family' || scope === 'lineage') {
      const id = core(q), adj = new Map();
      for (const e of CI.links(data, rules)) for (const [a, b] of [[e.s, e.t], [e.t, e.s]]) { if (!adj.has(a)) adj.set(a, new Set()); adj.get(a).add(b); }
      const component = GM.closure([id], adj), words = new Set();
      for (const w of component) for (const v of (mergeQ ? [w] : [w, 'q' + w])) if (spellings.has(v)) words.add(v);
      return {words, seed, component, error: null};
    }
    if (scope === 'front' || scope === 'tail') {
      if (!splits || !splits[seed]) return none(`No saved split for “${seed}”.`, seed);
      const front = w => (splits[w] ? splits[w][0] : undefined), tail = w => (splits[w] ? w.slice(splits[w][0].length) : undefined);
      const pick = scope === 'front' ? front : tail, want = pick(seed);
      const words = new Set([...spellings].filter(w => pick(w) === want));
      return {words, seed, key: want, error: null};
    }
    return none('Unknown scope: ' + scope);
  }

  // The class a spelling belongs to when the ribbons are endings or fronts: its saved split's front, or the rest of the
  // spelling after the front; a spelling without a saved split is its own class.
  function classKey(w, by, splits) {
    if (by !== 'tail' && by !== 'front') return w;
    const s = splits && splits[w];
    if (!s) return '(no split: ' + w + ')';
    return by === 'front' ? (s[0] || '∅') : (w.slice(s[0].length) || '∅');
  }
  // The bands drawn: the cap largest entries, then the pinned ones in the order given (the word typed), then the extra
  // ones in mass order (a selection's partners pulled out of the pooled band, marked `extra` for stackOrder, which
  // stacks and colours the chart without them).
  function pick(entries, cap, pin = [], extra = []) {
    const top = entries.length > cap ? entries.slice(0, cap) : entries, seen = new Set(top.map(e => e.key)), byKey = new Map(entries.map(e => [e.key, e]));
    const out = top.map(e => ({e, extra: false})), extraSet = new Set(extra || []);
    for (const k of pin || []) if (byKey.has(k) && !seen.has(k)) { seen.add(k); out.push({e: byKey.get(k), extra: false}); }
    for (const e of entries) if (extraSet.has(e.key) && !seen.has(e.key)) { seen.add(e.key); out.push({e, extra: true}); }
    return {kept: out, rest: entries.filter(e => !seen.has(e.key))};
  }
  const OTHER_LABEL = {spelling: 'other members', tail: 'other endings', front: 'other fronts', bigram: 'other bigrams'};
  const columnsMeta = K => K.map((c, i) => ({key: c.key, label: c.label, title: c.title, group: c.group, rank: c.rank, position: c.position, span: c.span || null, N: c.N, pages: c.pages ? c.pages.size : 0, slot: c.slot != null ? c.slot : i, row: c.row || 0}));
  // what a series carries of its column set's shape: the steps, the paths and the fork, for the layout
  const shapeOf = cols => ({steps: stepsOf(cols), paths: pathsOf(cols), fork: cols.fork || null});

  // Each band's count, rate per 10k of the column and share of the family per column. `by` 'spelling' (one band per
  // spelling), 'tail' or 'front' (one band per class of the saved split, holding every member spelling); the bands are
  // the `cap` largest by summed rate (ties alphabetical), the rest pooled as one band so the family total is conserved.
  // `removed` ({words, inflow, outflow} from removedFlows, and an optional label) adds the "removed words" band after the
  // pooled one: its value in a column is the larger of what it receives there and what it sends from there, so both faces fit inside it.
  function series(cols, words, {cap = 12, by = 'spelling', splits = null, pin = [], extra = [], removed = null} = {}) {
    const K = cols.columns, list = [...words];
    const rate = (n, c) => (c.N ? n / c.N * PER : 0);
    const totals = K.map(c => { let n = 0; for (const w of list) n += c.counts.get(w) || 0; return {N: c.N, n, rate: rate(n, c)}; });
    const mass = new Map(list.map(w => [w, K.reduce((v, c) => v + rate(c.counts.get(w) || 0, c), 0)]));
    const sorted = list.slice().sort((a, b) => mass.get(b) - mass.get(a) || order(a, b));
    const classes = new Map();
    for (const w of sorted) { const k = classKey(w, by, splits); if (!classes.has(k)) classes.set(k, []); classes.get(k).push(w); }
    const entries = [...classes.entries()].map(([key, ws]) => ({key, words: ws, mass: ws.reduce((v, w) => v + mass.get(w), 0)})).sort((a, b) => b.mass - a.mass || order(a.key, b.key));
    // the cap largest classes, plus the pinned class (the word typed) and the extra ones (a selection's partners)
    const {kept, rest} = pick(entries, cap, pin, extra);
    const values = ws => K.map((c, i) => { let n = 0; for (const w of ws) n += c.counts.get(w) || 0; return {n, rate: rate(n, c), share: totals[i].n ? n / totals[i].n : 0}; });
    const bands = kept.map(({e, extra: x}) => ({word: by === 'spelling' ? e.key : null, label: e.key, kind: by, words: e.words, values: values(e.words), mass: e.mass, ...(x ? {extra: true} : {})}));
    const restWords = rest.flatMap(e => e.words);
    const other = rest.length ? {word: null, label: OTHER_LABEL[by] || 'other', kind: by, pooled: true, classes: rest.length, words: restWords, values: values(restWords), mass: rest.reduce((v, e) => v + e.mass, 0)} : null;
    let removedBand = null;
    if (removed && removed.words && removed.words.length) {
      const vals = K.map((c, i) => { const inflow = removed.inflow[i] || 0, outflow = removed.outflow[i] || 0, v = Math.max(inflow, outflow); return {n: Math.round(v * c.N / PER), rate: v, share: totals[i].rate ? v / totals[i].rate : 0, inflow, outflow}; });
      removedBand = {word: null, label: removed.label || REMOVED_LABEL, kind: by, pooled: true, removed: true, classes: removed.words.length, words: removed.words.slice(), values: vals, mass: vals.reduce((v, x) => v + x.rate, 0)};
    }
    return {axis: cols.axis, mergeQ: cols.mergeQ, order: cols.order, by, columns: columnsMeta(K), ...shapeOf(cols), bands, other, removed: removedBand, totals, sparse: totals.map(t => t.n < SPARSE), words: sorted, classes: entries.length, cap};
  }

  // The stacking order of the ribbons: 'mass' keeps the series' order (largest first); 'cross' swaps bands while the
  // crossings they would be drawn with fall. The count follows the layout: a flow crosses the kept ribbon of every band
  // stacked between its two ends, and two flows cross when their ends are in opposite order; each crossing weighs the
  // thinner of the two ribbons, so hairlines count little. The pooled band and the removed words stay last; the
  // bands' values and pooling are unchanged, only their order. Bigram series are ordered the same way. The `extra`
  // bands (a selection's partners) do not move the others: the rest are stacked as they are without them, and each
  // extra band is then inserted at the place where the crossings are fewest, so a click never reorders the chart.
  // Each band's colour (`hue`) is its place in the stack without the extra bands and the pooled band the next one, so a
  // click that pulls partners out repaints nothing already drawn; each extra band takes the next unused colour whose
  // `family` (the view's palette: blue, blue-deep and blue-light are one family) differs from those of its neighbours in
  // the stack and of the bands it exchanges flows with (the ribbon clicked among them), or else the next unused colour.
  function stackOrder(S, L, mode = 'cross', {family = h => h} = {}) {
    const T = stackBands(S, L, mode), base = T.bands.filter(b => !b.extra), hue = new Map(base.map((b, i) => [b, i]));
    const used = new Set([...hue.values(), base.length]), last = T.bands.length - 1, bandOf = new Map(), partners = new Map();
    T.bands.forEach(b => b.words.forEach(w => bandOf.set(w, b)));
    for (const step of L || []) for (const rt of step.routes || []) {
      const f = bandOf.get(rt.from), t = bandOf.get(rt.to); if (!f || !t || f === t) continue;
      for (const [x, y] of [[f, t], [t, f]]) if (x.extra) { if (!partners.has(x)) partners.set(x, new Set()); partners.get(x).add(y); }
    }
    T.bands.forEach((b, i) => {
      if (!b.extra) return;
      const others = [i > 0 ? T.bands[i - 1] : null, i < last ? T.bands[i + 1] : null, ...(partners.get(b) || [])];
      const near = new Set(others.map(x => (x ? hue.get(x) : null)).concat(i === last && T.other ? [base.length] : []).filter(h => h != null).map(family));
      const free = h => !used.has(h);
      let h = base.length + 1, tries = 0; while ((!free(h) || near.has(family(h))) && tries++ < 64) h++;
      if (!free(h) || near.has(family(h))) { h = base.length + 1; while (!free(h)) h++; }
      hue.set(b, h); used.add(h);
    });
    return {...T, bands: T.bands.map(b => ({...b, hue: hue.get(b)})), other: T.other ? {...T.other, hue: base.length} : T.other};
  }
  function stackBands(S, L, mode) {
    const bands = S.bands, n = bands.length;
    if (mode !== 'cross' || n < 3 || !L || !L.length) return {...S, stack: 'mass'};
    const bandOf = new Map(); bands.forEach((b, bi) => b.words.forEach(w => bandOf.set(w, bi)));
    const steps = L.map(step => {
      const kept = new Array(n).fill(0), flows = new Map();
      for (const p of step.perWord.values()) { const bi = bandOf.get(p.word); if (bi != null) kept[bi] += p.kept; }
      for (const rt of step.routes) {
        const f = bandOf.get(rt.from), t = bandOf.get(rt.to); if (f == null || t == null) continue;
        if (f === t) { kept[f] += rt.mass; continue; }
        const k = f + '>' + t; flows.set(k, (flows.get(k) || 0) + rt.mass);
      }
      return {kept, flows: [...flows.entries()].map(([k, m]) => { const [f, t] = k.split('>').map(Number); return {f, t, m}; })};
    }).filter(s => s.flows.length);
    if (!steps.length) return {...S, stack: 'cross'};
    const cost = pos => {
      let c = 0;
      for (const s of steps) {
        for (const a of s.flows) { const lo = Math.min(pos[a.f], pos[a.t]), hi = Math.max(pos[a.f], pos[a.t]); for (let b = 0; b < n; b++) if (pos[b] > lo && pos[b] < hi && s.kept[b] > 0) c += Math.min(a.m, s.kept[b]); }
        for (let x = 0; x < s.flows.length; x++) for (let y = x + 1; y < s.flows.length; y++) { const a = s.flows[x], b = s.flows[y]; if ((pos[a.f] - pos[b.f]) * (pos[a.t] - pos[b.t]) < 0) c += Math.min(a.m, b.m); }
      }
      return c;
    };
    let order = bands.map((b, i) => i);
    const posOf = ord => { const p = new Array(n); ord.forEach((bi, rank) => { p[bi] = rank; }); return p; };
    if (bands.some(b => b.extra)) {
      const base = stackBands({...S, bands: bands.filter(b => !b.extra)}, L, mode).bands;
      order = base.map(b => bands.indexOf(b));
      for (const e of bands.map((b, i) => i).filter(i => bands[i].extra)) {
        let at = order.length, least = Infinity;
        for (let k = 0; k <= order.length; k++) { const c = cost(posOf([...order.slice(0, k), e, ...order.slice(k)])); if (c < least - 1e-9) { least = c; at = k; } }
        order.splice(at, 0, e);
      }
      return {...S, bands: order.map(bi => bands[bi]), stack: 'cross', crossingCost: cost(posOf(order))};
    }
    let best = cost(posOf(order)), improved = true, passes = 0;
    // pairwise swaps, then moving one band to another place, until neither helps
    while (improved && passes++ < 12) {
      improved = false;
      for (let x = 0; x < n; x++) for (let y = x + 1; y < n; y++) {
        [order[x], order[y]] = [order[y], order[x]];
        const c = cost(posOf(order));
        if (c < best - 1e-9) { best = c; improved = true; } else [order[x], order[y]] = [order[y], order[x]];
      }
      for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) {
        if (y === x) continue;
        const moved = order.slice(); const [bi] = moved.splice(x, 1); moved.splice(y, 0, bi);
        const c = cost(posOf(moved));
        if (c < best - 1e-9) { best = c; order = moved; improved = true; }
      }
    }
    return {...S, bands: order.map(bi => bands[bi]), stack: 'cross', crossingCost: best};
  }

  // Glyph bigrams of a spelling from its saved unit string ('ch o l'), with the word edges ^ and $: ^ch, cho, ol, l$.
  function bigrams(unitString) {
    const us = ['^', ...String(unitString || '').split(' ').filter(Boolean), '$'], out = [];
    for (let i = 0; i + 1 < us.length; i++) out.push(us[i] + us[i + 1]);
    return out;
  }
  const bigramCounts = (w, units) => { const m = new Map(); for (const b of bigrams(units[w] != null ? units[w] : w)) m.set(b, (m.get(b) || 0) + 1); return m; };
  // the two units of each bigram label (the label joins them without a separator), for tooltips
  function bigramUnits(words, units) {
    const out = new Map();
    for (const w of words) { const us = ['^', ...String(units[w] != null ? units[w] : w).split(' ').filter(Boolean), '$']; for (let i = 0; i + 1 < us.length; i++) if (!out.has(us[i] + us[i + 1])) out.set(us[i] + us[i + 1], [us[i], us[i + 1]]); }
    return out;
  }

  // Ribbons as glyph bigrams: a spelling counts once for each bigram it contains (twice when it contains it twice),
  // weighted by its count; rate per 10k words of the column, share of the set's bigram tokens there. Sparse columns
  // are read from the set's spelling tokens as elsewhere.
  function bigramSeries(cols, words, {units = {}, cap = 12, pin = [], extra = []} = {}) {
    const K = cols.columns, list = [...words];
    const rate = (n, c) => (c.N ? n / c.N * PER : 0);
    const per = K.map(c => { const m = new Map(); for (const w of list) { const n = c.counts.get(w) || 0; if (!n) continue; for (const [b, k] of bigramCounts(w, units)) m.set(b, (m.get(b) || 0) + n * k); } return m; });
    const wordTokens = K.map(c => list.reduce((v, w) => v + (c.counts.get(w) || 0), 0));
    const totals = K.map((c, i) => { let n = 0; for (const v of per[i].values()) n += v; return {N: c.N, n, rate: rate(n, c)}; });
    const all = [...new Set(per.flatMap(m => [...m.keys()]))];
    const mass = new Map(all.map(b => [b, K.reduce((v, c, i) => v + rate(per[i].get(b) || 0, c), 0)]));
    const sorted = all.sort((a, b) => mass.get(b) - mass.get(a) || order(a, b));
    const picked = pick(sorted.map(b => ({key: b})), cap, pin, extra), kept = picked.kept, rest = picked.rest.map(e => e.key);
    const values = bs => K.map((c, i) => { let n = 0; for (const b of bs) n += per[i].get(b) || 0; return {n, rate: rate(n, c), share: totals[i].n ? n / totals[i].n : 0}; });
    const pairs = bigramUnits(list, units);
    const bands = kept.map(({e: {key: b}, extra: x}) => ({word: null, label: b, kind: 'bigram', pair: pairs.get(b) || null, words: [b], values: values([b]), mass: mass.get(b), ...(x ? {extra: true} : {})}));
    const other = rest.length ? {word: null, label: OTHER_LABEL.bigram, kind: 'bigram', pooled: true, classes: rest.length, words: rest, values: values(rest), mass: rest.reduce((v, b) => v + mass.get(b), 0)} : null;
    return {axis: cols.axis, mergeQ: cols.mergeQ, order: cols.order, by: 'bigram', columns: columnsMeta(K), ...shapeOf(cols), bands, other, totals, sparse: wordTokens.map(n => n < SPARSE), words: sorted, cap};
  }

  // The spelling ledger of each step read as a bigram ledger: a bigram's mass on either side is the sum of its
  // spellings' masses times how often they contain it; it is kept through a kept spelling and through every route that
  // keeps it; a route sends the bigrams it removes and receives the ones it adds, so a = kept + sent + unplaced + parked
  // out and b = kept + received + unfilled + parked in hold per bigram. A route's flows run from each removed bigram to
  // each added one, carrying the route's mass split among the added bigrams at the source (mass) and among the removed
  // ones at the target (massTo), so that each bigram's flows sum to what it sends and receives; bands taper where the
  // two counts differ. Flows of one step between the same two bigrams are merged. Parked spellings park their bigrams.
  function bigramLedgers(L, words, {units = {}} = {}) {
    const counts = new Map(); const nOf = w => { if (!counts.has(w)) counts.set(w, bigramCounts(w, units)); return counts.get(w); };
    // spelling routes as bigram routes (removed → added, tapered); with `get`, the step's kept / sent / received per bigram accumulate too
    const convert = (list, get) => {
      const merged = new Map();
      for (const rt of list) {
        const from = nOf(rt.from), to = nOf(rt.to), removed = [], added = [];
        for (const b of new Set([...from.keys(), ...to.keys()])) {
          const f = from.get(b) || 0, tt = to.get(b) || 0;
          if (get) { const e = get(b); e.kept += rt.mass * Math.min(f, tt); if (f > tt) e.sent += rt.mass * (f - tt); else if (tt > f) e.received += rt.mass * (tt - f); }
          if (f > tt) removed.push([b, f - tt]); else if (tt > f) added.push([b, tt - f]);
        }
        const R = removed.reduce((v, [, c]) => v + c, 0), A = added.reduce((v, [, c]) => v + c, 0);
        if (!R || !A) continue;
        for (const [rb, cr] of removed) for (const [ab, ca] of added) {
          const k = rb + '>' + ab, mm = merged.get(k) || {from: rb, to: ab, mass: 0, massTo: 0, rules: [], degree: rt.degree, vias: []};
          mm.mass += rt.mass * cr * ca / A; mm.massTo += rt.mass * ca * cr / R;
          for (const r of rt.rules || []) if (!mm.rules.includes(r)) mm.rules.push(r);
          if (mm.vias.length < 4 && !mm.vias.includes(rt.from + ' → ' + rt.to)) mm.vias.push(rt.from + ' → ' + rt.to);
          if (Math.abs(rt.degree || 0) > Math.abs(mm.degree || 0)) mm.degree = rt.degree;
          merged.set(k, mm);
        }
      }
      return [...merged.values()];
    };
    const out = (L || []).map(step => {
      const per = new Map();
      const get = b => { if (!per.has(b)) per.set(b, {word: b, a: 0, b: 0, kept: 0, keptTo: 0, sent: 0, received: 0, unplaced: 0, unfilled: 0, dormant_out: 0, dormant_in: 0, passed_out: 0, passed_in: 0}); return per.get(b); };
      for (const p of step.perWord.values()) for (const [b, k] of nOf(p.word)) { const e = get(b); e.a += p.a * k; e.b += p.b * k; e.kept += p.kept * k; e.unplaced += p.unplaced * k; e.unfilled += p.unfilled * k; e.dormant_out += p.dormant_out * k; e.dormant_in += p.dormant_in * k; e.passed_out += (p.passed_out || 0) * k; e.passed_in += (p.passed_in || 0) * k; }
      const routes = convert(step.routes, get);
      const totals = {source: 0, target: 0, kept: 0, routed: 0, unplaced: 0, unfilled: 0, dormant_out: 0, dormant_in: 0, passed_out: 0, passed_in: 0};
      for (const e of per.values()) { totals.source += e.a; totals.target += e.b; totals.kept += e.kept; totals.routed += e.sent; totals.unplaced += e.unplaced; totals.unfilled += e.unfilled; totals.dormant_out += e.dormant_out; totals.dormant_in += e.dormant_in; totals.passed_out += e.passed_out; totals.passed_in += e.passed_in; }
      return {step: step.step, i: step.i, j: step.j, key: step.key, from: step.from, to: step.to, routes, perWord: per, totals, bigram: true, traced: step.traced};
    });
    const skips = new Map();
    for (const sk of (L && L.skips) || []) for (const [b, k] of nOf(sk.word)) { const key = b + '|' + sk.from + '|' + sk.to; const e = skips.get(key) || {word: b, from: sk.from, to: sk.to, parked: 0}; e.parked += sk.parked * k; skips.set(key, e); }
    out.skips = [...skips.values()];
    if (L && L.pass) out.pass = {...L.pass, routes: convert(L.pass.routes, null)};
    return out;
  }

  // Ribbons as rules: each step's routed mass by rule label (the labels of a route, sorted and joined), the `cap`
  // largest labels over the chain kept and the rest pooled as 'other rules'; the unchanged mass (kept) and the
  // unmatched remainders stay in the step totals; the passthrough and the parked pairs are aggregated the same way.
  function ruleSeries(L, {cap = 12} = {}) {
    const keyOf = rt => (rt.rules && rt.rules.length ? [...rt.rules].sort(order).join(', ') : 'a rule');
    const totals = new Map(), add = (by, rt) => { const k = keyOf(rt); by.set(k, (by.get(k) || 0) + rt.mass); totals.set(k, (totals.get(k) || 0) + rt.mass); };
    const steps = (L || []).map(step => { const by = new Map(); for (const rt of step.routes) add(by, rt); return {step: step.step, i: step.i, j: step.j, key: step.key, from: step.from, to: step.to, by, totals: step.totals}; });
    let pass = null;
    if (L && L.pass) { const by = new Map(); for (const rt of L.pass.routes) add(by, rt); pass = {step: L.pass.step, step2: L.pass.step2, i: L.pass.i, mid: L.pass.mid, j: L.pass.j, key: L.pass.key, from: L.pass.from, to: L.pass.to, by, total: L.pass.total}; }
    const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1] || order(a[0], b[0]));
    const kept = ranked.slice(0, cap).map(e => e[0]), rest = new Set(ranked.slice(cap).map(e => e[0]));
    const fold = by => { const m = new Map(); for (const [k, v] of by) { const kk = rest.has(k) ? 'other rules' : k; m.set(kk, (m.get(kk) || 0) + v); } return m; };
    const skipPairs = new Map();
    for (const sk of (L && L.skips) || []) { const k = sk.from + '>' + sk.to; skipPairs.set(k, (skipPairs.get(k) || 0) + sk.parked); }
    return {rules: rest.size ? kept.concat(['other rules']) : kept, steps: steps.map(s => ({...s, by: fold(s.by)})), pass: pass ? {...pass, by: fold(pass.by)} : null, totals: Object.fromEntries(ranked), skipPairs};
  }

  // Merged pairs applied to exact spellings: a rule links two spellings of the same q state (okal → okar and
  // qokal → qokar), never across states, so the q move stays visible as unexplained mass.
  // The kept mass of each step split by origin: at step i (columns i → i+1) the part present without a break since
  // column a ≤ i is min(rate_a … rate_{i+1}) − min(rate_{a−1} … rate_{i+1}), summed over the spellings (per 10k); the parts
  // sum to the step's kept mass Σ min(rate_i, rate_{i+1}), and the part since column 0 is the mass present in every column
  // so far. A spelling absent in a column starts a new run after it.
  // Each step's parts are indexed by the origin column; along a path (under the fork, the path the step lies on) only
  // the columns before the step's source can be origins, the rest stay zero.
  function keptSince(cols, words) {
    const K = cols.columns, n = K.length, rate = (w, c) => (c.N ? (c.counts.get(w) || 0) / c.N * PER : 0);
    const steps = stepsOf(cols), paths = pathsOf(cols);
    const prefixOf = (i, j) => { for (const p of paths) { const k = p.indexOf(j); if (k > 0 && p[k - 1] === i) return p.slice(0, k + 1); } return [i, j]; };
    const prefixes = steps.map(([i, j]) => prefixOf(i, j)), out = steps.map(([i]) => new Array(i + 1).fill(0));
    for (const w of words) {
      const r = K.map(c => rate(w, c));
      steps.forEach((ij, s) => {
        const p = prefixes[s], since = new Array(p.length).fill(0); let cur = r[p[p.length - 1]];
        for (let a = p.length - 2; a >= 0; a--) { cur = Math.min(cur, r[p[a]]); since[a] = cur; }
        for (let a = 0; a + 1 < p.length; a++) out[s][p[a]] += since[a] - (a > 0 ? since[a - 1] : 0);
      });
    }
    return {steps: out, total: out.map(s => s.reduce((v, x) => v + x, 0))};
  }

  function exactPairs(pairs, words) {
    const have = new Set(words), out = [];
    for (const [a, b, fwd, rules] of pairs) for (const q of ['', 'q']) if (have.has(q + a) && have.has(q + b)) out.push([q + a, q + b, fwd, rules]);
    return out;
  }

  // A maximum flow from the losses to the gains along edges with their own caps (cap = factor × min(loss, gain)), the
  // same Edmonds–Karp as graph_metrics.maximumFlow; returns the routes with their mass.
  function capFlow(loss, gain, edges) {
    const graph = new Map(), S = 'SOURCE', T = 'SINK', routes = [];
    const edge = (a, b, cap) => { if (!graph.has(a)) graph.set(a, []); if (!graph.has(b)) graph.set(b, []); const f = {to: b, cap, initial: cap, reverse: graph.get(b).length}, r = {to: a, cap: 0, reverse: graph.get(a).length}; graph.get(a).push(f); graph.get(b).push(r); return f; };
    loss.forEach((v, w) => { if (v > 1e-10) edge(S, 'L:' + w, v); });
    gain.forEach((v, w) => { if (v > 1e-10) edge('R:' + w, T, v); });
    const used = new Set();
    for (const e of edges) {
      const key = e.from + '|' + e.to, cap = e.factor * Math.min(loss.get(e.from) || 0, gain.get(e.to) || 0);
      if (cap > 1e-10 && !used.has(key)) { routes.push({...e, edge: edge('L:' + e.from, 'R:' + e.to, cap)}); used.add(key); }
    }
    let total = 0;
    for (;;) {
      const parents = new Map([[S, null]]), queue = [S];
      for (let i = 0; i < queue.length && !parents.has(T); i++) for (const e of graph.get(queue[i]) || []) if (e.cap > 1e-10 && !parents.has(e.to)) { parents.set(e.to, {from: queue[i], edge: e}); queue.push(e.to); }
      if (!parents.has(T)) break;
      let amount = Infinity;
      for (let v = T; v !== S; v = parents.get(v).from) amount = Math.min(amount, parents.get(v).edge.cap);
      for (let v = T; v !== S; v = parents.get(v).from) { const q = parents.get(v); q.edge.cap -= amount; graph.get(v)[q.edge.reverse].cap += amount; }
      total += amount;
    }
    return {total, routes: routes.map(r => ({from: r.from, to: r.to, rules: r.rules, degree: r.degree, mass: r.edge.initial - r.edge.cap})).filter(r => r.mass > 1e-8)};
  }

  // Skipped groups: a spelling with tokens in column i, none in the columns between, and tokens again in column j
  // parks min(rate_i, rate_j) across the gap: that mass leaves the loss of the step out of i and the gain of the step
  // into j. Along one path the columns are read in order; with several paths (the fork: the trunk followed by each
  // arm) each path is read on its own, a gap on the trunk is listed once, and a column parks the larger of what the
  // paths through it park: a spelling absent from a trunk group is carried across it when it returns on either arm.
  // The parked masses are kept per path; `forStep(i, j)` gives the step's own: the larger over the paths that run i → j
  // (a trunk step lies on every path, an arm step on its own), so a skip on one arm never parks the other arm's step.
  // `dormOut` and `dormIn` are the per-column maximum over the paths, for callers that read one line.
  function skipsOf(K, list, rate, paths = null) {
    const routes = paths && paths.length ? paths : [K.map((c, i) => i)], out = [], seen = new Map();
    const perPath = routes.map(() => ({dormOut: K.map(() => new Map()), dormIn: K.map(() => new Map())}));
    for (const w of list) {
      const r = K.map(c => rate(w, c));
      routes.forEach((path, p) => {
        let a = 0;
        while (a < path.length) {
          if (!(r[path[a]] > 0)) { a++; continue; }
          let b = a + 1;
          while (b < path.length && !(r[path[b]] > 0)) b++;
          if (b < path.length && b > a + 1) {
            const i = path[a], j = path[b], parked = Math.min(r[i], r[j]), key = w + '|' + i + '>' + j;
            if (!seen.has(key)) { const sk = {word: w, from: i, to: j, parked, paths: [p]}; seen.set(key, sk); out.push(sk); } else seen.get(key).paths.push(p);
            perPath[p].dormOut[i].set(w, parked); perPath[p].dormIn[j].set(w, parked);
          }
          a = b;
        }
      });
    }
    const maxOf = maps => { const m = new Map(); for (const src of maps) for (const [w, v] of src) if (v > (m.get(w) || 0)) m.set(w, v); return m; };
    const dormOut = K.map((c, i) => maxOf(perPath.map(pp => pp.dormOut[i]))), dormIn = K.map((c, j) => maxOf(perPath.map(pp => pp.dormIn[j])));
    const forStep = (i, j) => {
      const on = routes.map((path, p) => p).filter(p => { const a = routes[p].indexOf(i); return a >= 0 && routes[p][a + 1] === j; });
      const ps = on.length ? on : routes.map((path, p) => p);
      return {dout: maxOf(ps.map(p => perPath[p].dormOut[i])), din: maxOf(ps.map(p => perPath[p].dormIn[j]))};
    };
    return {skips: out, dormOut, dormIn, forStep};
  }

  // One ledger per step between neighbouring columns, in rates per 10k: for every member a (before), b (after),
  // kept = min(a, b), the parked mass of a skipped group (dormant_out at the step into the gap, dormant_in at the step
  // out of it), the routes of one maximum capacity allocation along the family's pairs, and the unexplained
  // remainders: a = kept + sent + unplaced + dormant_out and b = kept + received + unfilled + dormant_in.
  // With a schedule ({rules: {code: {'A>B': degree}}}), a pair runs at a step only where one of its rules has a
  // degree there: forward at a positive degree, reversed at a negative one, with cap = |degree| × min(loss, gain);
  // a rule without an entry is off. A pair's label names one rule, a sub-step of one (C1.1, C3.2: its own row when the
  // schedule has one, else its rule's row), a two-step route (C1 (via cheol): the rule's `.via` row when the schedule
  // has one, else the composition of the rule's two halves when they have rows, else the rule's row) or a composition
  // (A+B: every part needs a degree of the same sign, and the composition runs at the smallest of them). A pair with
  // several labels runs at the largest degree among them; labels of equal degree and opposite sign cancel, and the pair
  // is off. Without a schedule every pair runs both ways (forward only where marked).
  // A parent code without a row of its own (C1 inside "C1+KT_CORR") means its two-step route: its `.via` row when
  // scheduled, else the composition of its halves.
  function partsOf(code, rules) {
    const base = String(code).split(' (via ')[0];
    const expand = p => (rules[p] ? [p] : rules[p + '.via'] ? [p + '.via'] : rules[p + '.1'] || rules[p + '.2'] ? [p + '.1', p + '.2'] : rules[p.split('.')[0]] ? [p.split('.')[0]] : [p]);
    return (String(code).includes(' (via ') ? [base] : base.split('+')).flatMap(expand);
  }
  // KNOWN 1.2 guard: a pair whose output adds a dy ending the input lacks (the e → d permission) is closed at the steps a
  // schedule names in `no_new_d.steps`, whatever rule carries it.
  const newDForm = (a, b) => /dy/.test(b) && !/dy/.test(a);
  function labelDegree(code, schedule, key) {
    const rules = (schedule && schedule.rules) || {};
    const ds = partsOf(code, rules).map(p => (rules[p] || {})[key] || 0);
    if (!ds.length || ds.some(v => !v)) return 0;
    const sign = Math.sign(ds[0]);
    return ds.every(v => Math.sign(v) === sign) ? sign * Math.min(...ds.map(Math.abs)) : 0;
  }
  function pairDegree(labels, schedule, key) {
    let best = 0, conflict = false;
    for (const code of labels || []) {
      const v = labelDegree(code, schedule, key);
      if (Math.abs(v) > Math.abs(best)) { best = v; conflict = false; }
      else if (v && Math.abs(v) === Math.abs(best) && Math.sign(v) !== Math.sign(best)) conflict = true;
    }
    return conflict ? 0 : best;
  }
  // Each ledger carries its step's column indices i (source) and j (target) and its ordinal `step` in the list; on one
  // line j = i + 1, under the fork the two arm steps out of the fork column share their source.
  function ledgers(cols, words, pairs, {schedule = null, dormancy = true, ...trace} = {}) {
    const K = cols.columns, list = [...words], set = new Set(list);
    // with a middle column, the direct chain (without it) is the model; the middle is read part-way along its 2a → 3a step
    const mIdx = K.findIndex(c => c.key === MIDDLE_KEY);
    if (mIdx > 0 && mIdx + 1 < K.length) {
      // the direct step around the middle column takes the schedule's own cells, or, when hidden columns leave it
      // without any, the cells read across the gap
      const inner = dropMiddle(cols);
      return middleLedgers(cols, words, ledgers(inner, words, pairs, {schedule: spanSchedule(schedule, inner.spans), dormancy}), {noNewD: !!(schedule && schedule.no_new_d), ...trace});
    }
    const rate = (w, c) => (c.N ? (c.counts.get(w) || 0) / c.N * PER : 0);
    // one entry per ordered pair: several entries for the same pair (from different rules) merge their labels, so the
    // degree read for the pair is the largest across all of them; a pair is two-way when any entry is
    const merged = new Map();
    for (const [a, b, fwd, rules] of (pairs || []).filter(([a, b]) => set.has(a) && set.has(b) && a !== b)) {
      const k = a + '\u0000' + b, m = merged.get(k);
      if (m) { m[2] = m[2] && !!fwd; for (const r of rules || []) if (!m[3].includes(r)) m[3].push(r); }
      else merged.set(k, [a, b, !!fwd, [...(rules || [])]]);
    }
    const own = [...merged.values()];
    const closed = schedule && schedule.no_new_d && Array.isArray(schedule.no_new_d.steps) ? new Set(schedule.no_new_d.steps) : null;
    const parking = dormancy ? skipsOf(K, list, rate, pathsOf(cols)) : {skips: [], forStep: () => ({dout: new Map(), din: new Map()})};
    const skips = parking.skips;
    const edgesFor = key => {
      const edges = [];
      for (const [a, b, fwd, rules] of own) {
        if (schedule) {
          const deg = pairDegree(rules, schedule, key), guard = closed && closed.has(key);
          if (deg > 0 && !(guard && newDForm(a, b))) edges.push({from: a, to: b, factor: deg, degree: deg, rules: [...rules]});
          else if (deg < 0 && !(guard && newDForm(b, a))) edges.push({from: b, to: a, factor: -deg, degree: deg, rules: [...rules]});
        } else {
          edges.push({from: a, to: b, factor: 1, degree: 1, rules: [...(rules || [])]});
          if (!fwd) edges.push({from: b, to: a, factor: 1, degree: 1, rules: [...(rules || [])]});
        }
      }
      return edges;
    };
    const totalsOf = (perWord, routed) => {
      const totals = {source: 0, target: 0, kept: 0, routed, unplaced: 0, unfilled: 0, dormant_out: 0, dormant_in: 0, passed_out: 0, passed_in: 0};
      for (const p of perWord.values()) {
        p.unplaced = Math.max(0, p.a - p.kept - p.sent - p.dormant_out - p.passed_out); p.unfilled = Math.max(0, p.b - p.kept - p.received - p.dormant_in - p.passed_in);
        totals.source += p.a; totals.target += p.b; totals.kept += p.kept; totals.unplaced += p.unplaced; totals.unfilled += p.unfilled; totals.dormant_out += p.dormant_out; totals.dormant_in += p.dormant_in; totals.passed_out += p.passed_out; totals.passed_in += p.passed_in;
      }
      return totals;
    };
    const result = stepsOf(cols).map(([i, j], s) => {
      const from = K[i], to = K[j], key = from.key + '>' + to.key, loss = new Map(), gain = new Map(), perWord = new Map();
      const park = parking.forStep(i, j);
      for (const w of list) {
        const a = rate(w, from), b = rate(w, to), kept = Math.min(a, b), dout = park.dout.get(w) || 0, din = park.din.get(w) || 0;
        loss.set(w, Math.max(a - b - dout, 0)); gain.set(w, Math.max(b - a - din, 0));
        perWord.set(w, {word: w, a, b, kept, sent: 0, received: 0, unplaced: 0, unfilled: 0, dormant_out: dout, dormant_in: din, passed_out: 0, passed_in: 0});
      }
      const flow = capFlow(loss, gain, edgesFor(key)), routes = flow.routes;
      for (const r of routes) { perWord.get(r.from).sent += r.mass; perWord.get(r.to).received += r.mass; }
      return {step: s, i, j, key, from: from.key, to: to.key, routes, perWord, totals: totalsOf(perWord, flow.total)};
    });
    result.skips = skips;
    return result;
  }

  // ---------------------------------------------------------------- the middle text as a reading part-way along 2a → 3a
  // With a middle column the step 2a → 3a is still the model: one direct allocation of 2a's losses to 3a's gains along
  // the rules. The middle text is read as a point part-way along that step. For each word, how much of its outgoing
  // mass (its routes out, its loss without a route, its mass parked across later groups) had already gone, how much of
  // its incoming mass (routes in, gain without a route, mass parked from earlier groups) had already arrived, and how
  // much of its kept mass is visible there; for each route, its own departed share g and arrived share h (0 ≤ h ≤ g ≤ 1).
  // The shares are fitted to the middle text's observed rates by weighted least squares in tokens (Poisson weights),
  // with a weak pull toward the middle's path position p0 (strength kappa, in token units) for the word-level shares,
  // a stronger pull toward 1 for the kept-visible share (kappaK: parking kept mass is the last reading), and a
  // mass-weighted pull of each route's shares toward its words' shares (lambda), so routes out of one word depart
  // together unless their targets say otherwise. What has left a route's input but not reached its output sits at
  // the rule's middle form when the route is a two-step rule whose middle form is in the set (its station), else in
  // transit, drawn through an estimated anchor; the fitted prediction is then reconciled exactly with the observed
  // rates (over-prediction moves mass to transit or parks kept mass; a surplus is the middle's own). With noNewD (the
  // schedule's A-side guard, KNOWN 1.2: the middle pages lie before the e → d switch), a route whose output adds a dy
  // ending is read as not yet arrived, and a station that adds one is not used: the middle text's d-forms are its own.
  const viaOf = (route, set) => {
    for (const code of route.rules || []) {
      const m = /\(via ([^)]+)\)/.exec(String(code)); if (!m) continue;
      let v = m[1].trim(); if (!set.has(v) && /^q/.test(route.from) && /^q/.test(route.to) && set.has('q' + v)) v = 'q' + v;
      if (set.has(v) && v !== route.from && v !== route.to) return {via: v, code: String(code).split(' (via ')[0]};
    }
    return null;
  };
  function traceMiddle(direct, mid, words, {p0 = 0.5, kappa = 1, kappaK = 100, lambda = 1, passes = 40, noNewD = false} = {}) {
    const list = [...words], set = new Set(list), c = mid.N ? mid.N / PER : 0;
    const obs = w => (mid.N ? (mid.counts.get(w) || 0) / mid.N * PER : 0);
    // the words: kept K, out-mass without a route (unplaced U + parked onward D), in-mass without a route (unfilled V +
    // parked from before E); shares fm (departed), fp (arrived), k (kept visible)
    const W = new Map();
    for (const w of list) {
      const p = direct.perWord.get(w) || {a: 0, b: 0, kept: 0, unplaced: 0, unfilled: 0, dormant_out: 0, dormant_in: 0};
      W.set(w, {word: w, a: p.a, b: p.b, o: obs(w), K: p.kept, U: p.unplaced, D: p.dormant_out, V: p.unfilled, E: p.dormant_in, fm: p0, fp: p0, k: 1, out: [], in: [], via: [], pred: 0, cur: 0, surplus: 0});
    }
    const R = direct.routes.map((r, i) => { const v = viaOf(r, set), guarded = noNewD && newDForm(r.from, r.to), via = v && !(noNewD && newDForm(r.from, v.via)) ? v : null; return {index: i, from: r.from, to: r.to, rules: r.rules, degree: r.degree, mass: r.mass, via: via ? via.via : null, code: via ? via.code : null, guarded, g: p0, h: guarded ? 0 : p0}; });
    for (const r of R) { W.get(r.from).out.push(r); W.get(r.to).in.push(r); if (r.via) W.get(r.via).via.push(r); }
    const predOf = x => x.k * x.K + (1 - x.fm) * (x.U + x.D) + x.fp * (x.V + x.E)
      + x.out.reduce((v, r) => v + (1 - r.g) * r.mass, 0) + x.in.reduce((v, r) => v + r.h * r.mass, 0) + x.via.reduce((v, r) => v + (r.g - r.h) * r.mass, 0);
    const active = [...W.values()].filter(x => x.o > 0 || x.K > 0 || x.out.length || x.in.length || x.via.length || x.U + x.D + x.V + x.E > 0);
    let weight = new Map();
    const setWeights = () => { weight = new Map(); for (const x of active) { x.pred = predOf(x); weight.set(x.word, c > 0 ? c * c / Math.max(c * x.pred, 1) : 0); } };
    // one coordinate z: pred_w = A_w + B_w z for the touched words (x.cur holds z); minimise Σ weight (o − A − Bz)² + strength (z − prior)²
    const solve = (touch, prior, strength, lo, hi) => {
      let num = prior * strength, den = strength;
      for (const [x, B] of touch) { const wt = weight.get(x.word) || 0, A = x.pred - B * x.cur; num += wt * B * (x.o - A); den += wt * B * B; }
      return den > 0 ? Math.min(hi, Math.max(lo, num / den)) : prior;
    };
    const apply = (touch, delta) => { for (const [x, B] of touch) x.pred += B * delta; };
    const update = (touch, z, prior, strength, lo, hi) => { for (const [x] of touch) x.cur = z; const nz = solve(touch, prior, strength, lo, hi); apply(touch, nz - z); return nz; };
    let iterations = 0;
    for (let outer = 0; outer < 3; outer++) {
      setWeights();
      for (let pass = 0; pass < passes; pass++) {
        let moved = 0;
        for (const x of active) {
          if (x.K > 0) { const nz = update([[x, x.K]], x.k, 1, kappaK, 0, 1); moved += Math.abs(nz - x.k); x.k = nz; }
          if (x.out.length || x.U + x.D > 0) {
            // the word-level departed share moves its routeless masses and pulls its routes (penalty lambda × tokens)
            let num = kappa * p0, den = kappa;
            for (const r of x.out) { num += lambda * c * r.mass * r.g; den += lambda * c * r.mass; }
            const B = -(x.U + x.D);
            if (B !== 0) { const wt = weight.get(x.word) || 0, A = x.pred - B * x.fm; num += wt * B * (x.o - A); den += wt * B * B; }
            const nz = Math.min(1, Math.max(0, num / den)); apply([[x, B]], nz - x.fm); moved += Math.abs(nz - x.fm); x.fm = nz;
          }
          if (x.in.length || x.V + x.E > 0) {
            let num = kappa * p0, den = kappa;
            for (const r of x.in) if (!r.guarded) { num += lambda * c * r.mass * r.h; den += lambda * c * r.mass; }
            const B = x.V + x.E;
            if (B !== 0) { const wt = weight.get(x.word) || 0, A = x.pred - B * x.fp; num += wt * B * (x.o - A); den += wt * B * B; }
            const nz = Math.min(1, Math.max(0, num / den)); apply([[x, B]], nz - x.fp); moved += Math.abs(nz - x.fp); x.fp = nz;
          }
        }
        for (const r of R) {
          const F = W.get(r.from), T = W.get(r.to), S = r.via ? W.get(r.via) : null, st = lambda * c * r.mass;
          // g: the input's prediction falls by the mass, the station's rises; h: the output's rises, the station's falls
          const tg = [[F, -r.mass]].concat(S ? [[S, r.mass]] : []), th = [[T, r.mass]].concat(S ? [[S, -r.mass]] : []);
          const g = update(tg, r.g, F.fm, st, r.h, 1); moved += Math.abs(g - r.g); r.g = g;
          const h = r.guarded ? 0 : update(th, r.h, T.fp, st, 0, r.g); moved += Math.abs(h - r.h); r.h = h;
          // when the pair meets (g = h), a joint move along g = h lets both shift the same way without crossing
          if (!r.guarded && r.g - r.h < 1e-9) {
            const both = [[F, -r.mass], [T, r.mass]];
            for (const [x] of both) x.cur = r.g;
            let num = (F.fm + T.fp) * st, den = 2 * st;
            for (const [x, B] of both) { const wt = weight.get(x.word) || 0, A = x.pred - B * r.g; num += wt * B * (x.o - A); den += wt * B * B; }
            const nz = den > 0 ? Math.min(1, Math.max(0, num / den)) : r.g; apply(both, nz - r.g); moved += Math.abs(nz - r.g); r.g = r.h = nz;
          }
        }
        iterations++;
        if (moved < 1e-7) break;
      }
    }
    // reconciliation with the observed rates, so that the ledgers account for the middle text exactly: an
    // over-predicted word shrinks its moving components in proportion (its routes' shares move to transit) and parks
    // kept mass only for the rest; an under-predicted word grows them within their bounds (kept up to all of it, a route's
    // not-departed or arrived share up to what that route holds in transit through the anchor), in proportion to the
    // room each has, and what no component can take is the middle's own surplus. Each component belongs to one word
    // and the anchor to none, so every reconciled prediction meets its observation as far as the bounds allow.
    const fitted = new Map(R.map(r => [r.index, {g: r.g, h: r.h}]));
    const share = new Map(R.map(r => [r.index, {nd: 1 - r.g, ar: r.h, st: r.via ? r.g - r.h : 0, tr: r.via ? 0 : r.g - r.h}]));
    for (const x of active) x.fit = {k: x.k, fm: x.fm, fp: x.fp, pred: predOf(x)};
    const over = active.filter(x => x.fit.pred > x.o + 1e-12), under = active.filter(x => x.fit.pred < x.o - 1e-12);
    for (const x of over) {
      // the moving parts shrink first, in proportion; kept mass parks only for what they cannot absorb
      const moving = (1 - x.fm) * (x.U + x.D) + x.fp * (x.V + x.E) + x.out.reduce((v, r) => v + share.get(r.index).nd * r.mass, 0) + x.in.reduce((v, r) => v + share.get(r.index).ar * r.mass, 0) + x.via.reduce((v, r) => v + share.get(r.index).st * r.mass, 0);
      const excess = x.fit.pred - x.o, fromMoving = Math.min(excess, moving), phi = moving > 0 ? 1 - fromMoving / moving : 1;
      x.fm = 1 - (1 - x.fm) * phi; x.fp *= phi;
      for (const r of x.out) { const s = share.get(r.index), d = s.nd * (1 - phi); s.nd -= d; s.tr += d; }
      for (const r of x.in) { const s = share.get(r.index), d = s.ar * (1 - phi); s.ar -= d; s.tr += d; }
      for (const r of x.via) { const s = share.get(r.index), d = s.st * (1 - phi); s.st -= d; s.tr += d; }
      const rest = excess - fromMoving; if (rest > 0 && x.K > 0) x.k = Math.max(0, x.k - rest / x.K);
      x.surplus = 0;
    }
    for (const x of under) {
      const need = x.o - x.fit.pred;
      const room = [{kind: 'k', cap: (1 - x.k) * x.K}, {kind: 'fm', cap: x.fm * (x.U + x.D)}, {kind: 'fp', cap: (1 - x.fp) * (x.V + x.E)}]
        .concat(x.out.map(r => ({kind: 'nd', r, cap: share.get(r.index).tr * r.mass})), x.in.filter(r => !r.guarded).map(r => ({kind: 'ar', r, cap: share.get(r.index).tr * r.mass})));
      const total = room.reduce((v, e) => v + e.cap, 0), take = Math.min(need, total), f = total > 0 ? take / total : 0;
      for (const e of room) {
        const d = e.cap * f; if (!(d > 0)) continue;
        if (e.kind === 'k') x.k += d / x.K;
        else if (e.kind === 'fm') x.fm -= d / (x.U + x.D);
        else if (e.kind === 'fp') x.fp += d / (x.V + x.E);
        else { const s = share.get(e.r.index), ds = d / e.r.mass; s.tr -= ds; if (e.kind === 'nd') s.nd += ds; else s.ar += ds; }
      }
      x.surplus = need - take;
    }
    let sq = 0, n = 0, explained = 0, observed = 0;
    const routes = R.map(r => { const s = share.get(r.index); return {from: r.from, to: r.to, rules: r.rules, degree: r.degree, mass: r.mass, via: r.via, code: r.code, guarded: r.guarded, g: 1 - s.nd, h: s.ar, fitted: fitted.get(r.index), notDeparted: s.nd * r.mass, arrived: s.ar * r.mass, station: s.st * r.mass, transit: (s.st + s.tr) * r.mass, anchor: s.tr * r.mass}; });
    const perWord = new Map();
    for (const x of W.values()) {
      const pred = x.o - x.surplus; sq += (c * (x.o - pred)) ** 2; n++; explained += pred; observed += x.o;
      perWord.set(x.word, {word: x.word, a: x.a, o: x.o, b: x.b, kept: x.K, keptVisible: x.k * x.K, parked: (1 - x.k) * x.K, departed: x.fm, arrived: x.fp, unplaced: x.U, unfilled: x.V, dormantOut: x.D, dormantIn: x.E, surplus: x.surplus,
        fitted: x.fit ? {departed: x.fit.fm, arrived: x.fit.fp, keptVisible: x.fit.k * x.K, pred: x.fit.pred} : null, expected: c * Math.max(x.a, x.b), observed: c * x.o});
    }
    return {p0, kappa, kappaK, lambda, guarded: !!noNewD, routes, perWord, fit: {iterations, rms: n ? Math.sqrt(sq / n) : 0, explained, observed, tokens: mid.N}};
  }

  // The two steps around the middle column, synthesised from the direct step and the trace: at 2a → middle a route
  // carries what had arrived (under its own label) and what sits at its station (the rule's first half), at
  // middle → 3a what had not yet departed (its label) and what leaves the station (the second half); the transit
  // crosses both as the passthrough through an estimated anchor. Every ledger identity holds, and a route's parts sum
  // to its direct mass.
  function middleLedgers(cols, words, base, opts = {}) {
    const K = cols.columns, m = K.findIndex(c => c.key === MIDDLE_KEY), list = [...words];
    if (m <= 0 || m + 1 >= K.length) return base;
    // the direct step: from the column before the middle to the one after it (indices without the middle column)
    const direct = base.find(s => s.i === m - 1 && s.j === m) || base[m - 1], mid = K[m], T = traceMiddle(direct, mid, list, opts);
    const blank = w => ({word: w, a: 0, b: 0, kept: 0, sent: 0, received: 0, unplaced: 0, unfilled: 0, dormant_out: 0, dormant_in: 0, passed_out: 0, passed_in: 0});
    const P1 = new Map(list.map(w => [w, blank(w)])), P2 = new Map(list.map(w => [w, blank(w)]));
    const r1 = [], r2 = [], pass = [];
    const add = (acc, from, to, rules, degree, mass) => { if (mass > 1e-9) acc.push({from, to, rules, degree, mass}); };
    for (const w of list) {
      const t = T.perWord.get(w), p1 = P1.get(w), p2 = P2.get(w);
      p1.a = t.a; p1.b = t.o; p2.a = t.o; p2.b = t.b;
      // routeless masses: the share not yet departed stays kept into the middle, the share arrived is kept out of it
      p1.kept += t.keptVisible + (1 - t.departed) * (t.unplaced + t.dormantOut);
      p1.unplaced += t.departed * t.unplaced; p1.dormant_out += t.departed * t.dormantOut + t.parked;
      p1.unfilled += t.arrived * t.unfilled + t.surplus; p1.dormant_in += t.arrived * t.dormantIn;
      p2.kept += t.keptVisible + t.arrived * (t.unfilled + t.dormantIn);
      p2.unplaced += (1 - t.departed) * t.unplaced + t.surplus; p2.dormant_out += (1 - t.departed) * t.dormantOut;
      p2.unfilled += (1 - t.arrived) * t.unfilled; p2.dormant_in += (1 - t.arrived) * t.dormantIn + t.parked;
    }
    for (const r of T.routes) {
      const f1 = P1.get(r.from), t1 = P1.get(r.to), f2 = P2.get(r.from), t2 = P2.get(r.to);
      // arrived by the middle: a flow at the first step, kept at the second; not yet departed: kept at the first, a flow at the second
      f1.sent += r.arrived; t1.received += r.arrived; add(r1, r.from, r.to, r.rules, r.degree, r.arrived); t2.kept += r.arrived;
      f1.kept += r.notDeparted; f2.sent += r.notDeparted; t2.received += r.notDeparted; add(r2, r.from, r.to, r.rules, r.degree, r.notDeparted);
      if (r.via && r.station > 1e-9) {
        const s1 = P1.get(r.via), s2 = P2.get(r.via);
        f1.sent += r.station; s1.received += r.station; add(r1, r.from, r.via, [r.code + '.1'], r.degree, r.station);
        s2.sent += r.station; t2.received += r.station; add(r2, r.via, r.to, [r.code + '.2'], r.degree, r.station);
      }
      if (r.anchor > 1e-9) { f1.passed_out += r.anchor; t2.passed_in += r.anchor; pass.push({from: r.from, to: r.to, rules: r.rules, degree: r.degree, mass: r.anchor}); }
    }
    const totals = (per, routes) => {
      const t = {source: 0, target: 0, kept: 0, routed: routes.reduce((v, r) => v + r.mass, 0), unplaced: 0, unfilled: 0, dormant_out: 0, dormant_in: 0, passed_out: 0, passed_in: 0};
      for (const p of per.values()) { t.source += p.a; t.target += p.b; t.kept += p.kept; t.unplaced += p.unplaced; t.unfilled += p.unfilled; t.dormant_out += p.dormant_out; t.dormant_in += p.dormant_in; t.passed_out += p.passed_out; t.passed_in += p.passed_in; }
      return t;
    };
    const step1 = {step: m - 1, i: m - 1, j: m, key: K[m - 1].key + '>' + mid.key, from: K[m - 1].key, to: mid.key, routes: r1, perWord: P1, totals: totals(P1, r1), traced: true};
    const step2 = {step: m, i: m, j: m + 1, key: mid.key + '>' + K[m + 1].key, from: mid.key, to: K[m + 1].key, routes: r2, perWord: P2, totals: totals(P2, r2), traced: true};
    // the other steps keep their place, their column indices moved around the inserted column
    const shift = i => (i >= m ? i + 1 : i), pos = base.indexOf(direct), remap = s => ({...s, i: shift(s.i), j: shift(s.j)});
    const out = base.slice(0, pos).map(remap).concat([step1, step2], base.slice(pos + 1).map(remap)).map((s, k) => ({...s, step: k}));
    // the skips re-indexed around the inserted column; a skip out of 2a or into 3a splits at the middle by the word's
    // shares, and kept mass the middle text does not show parks across it
    const skips = [];
    const push = (word, from, to, parked) => { if (parked > 1e-9) skips.push({word, from, to, parked}); };
    for (const sk of base.skips || []) {
      const t = T.perWord.get(sk.word);
      if (t && sk.from === m - 1) { push(sk.word, m - 1, shift(sk.to), t.departed * sk.parked); push(sk.word, m, shift(sk.to), (1 - t.departed) * sk.parked); }
      else if (t && sk.to === m) { push(sk.word, sk.from, m, t.arrived * sk.parked); push(sk.word, sk.from, m + 1, (1 - t.arrived) * sk.parked); }
      else push(sk.word, shift(sk.from), shift(sk.to), sk.parked);
    }
    for (const t of T.perWord.values()) push(t.word, m - 1, m + 1, t.parked);
    out.skips = skips;
    out.pass = {step: pos, step2: pos + 1, i: m - 1, mid: m, j: m + 1, key: direct.key, from: K[m - 1].key, to: K[m + 1].key, routes: pass, total: pass.reduce((v, r) => v + r.mass, 0)};
    out.direct = direct; out.trace = T;
    return out;
  }

  const ribbon = (x1, y1, w1, x2, y2, w2) => {
    const xm = (x1 + x2) / 2;
    return `M${r(x1)} ${r(y1)} C${r(xm)} ${r(y1)},${r(xm)} ${r(y2)},${r(x2)} ${r(y2)} L${r(x2)} ${r(y2 + w2)} C${r(xm)} ${r(y2 + w2)},${r(xm)} ${r(y1 + w1)},${r(x1)} ${r(y1 + w1)}Z`;
  };
  const r = v => Math.round(v * 100) / 100;

  // Geometry of the ribbon chart: columns on x (evenly, or at path positions for 'poolsPos'), the bands stacked
  // top-down in band order with a 2 px gap, heights = rate × one scale for the whole chart ('per10k': the fullest
  // column fills the plot) or share × the column's own scale ('share': every column fills it). Between neighbours,
  // each band's kept mass continues as a ribbon, each routed mass runs as a flow from the source band to the target
  // band, and the unexplained parts end or begin as stubs. Widths follow the ledger, so a band's slots add up to its
  // segment on both sides.
  // Under the fork the columns carry a slot (x) and a row: the trunk and the first arm in row 0, the second arm in row 1
  // under the first, and the fork column is drawn again at the head of row 1 (a mirror of the same segments) so that
  // each row reads as one chain and the second arm's first step leaves from the mirror. Steps are read from their
  // column indices (i → j); a ledger without them is one line (j = i + 1).
  // `fill` stretches every column's stack to the full plot height (its own scale, as 'share' does) while the values
  // stay what `measure` says, so the bands can be read in every column with per-10k numbers beside them.
  function layout(S, L, {width = 960, height = 320, measure = 'per10k', padLeft = 20, padRight = 120, padTop = 6, rowGap = 84, fill = false} = {}) {
    const bands = [...S.bands, ...(S.other ? [S.other] : []), ...(S.removed ? [S.removed] : [])], K = S.columns, n = K.length;
    const nw = isGroups(S.axis) ? 14 : 7, span = Math.max(1, width - padLeft - padRight - nw);
    const atPositions = (S.axis === 'poolsPos' || S.axis === 'groupsPos') && K.every(c => c.position != null);
    const slotOf = K.map((c, i) => (c.slot != null ? c.slot : i)), rowOf = K.map(c => c.row || 0);
    const rows = n ? Math.max(...rowOf) + 1 : 1, nSlots = n ? Math.max(...slotOf) + 1 : 1, rowY = row => row * (height + rowGap);
    const fork = S.fork && S.fork.at != null && K[S.fork.at] ? S.fork : null, forkAt = fork ? fork.at : -1;
    const mirrorRows = fork ? [...new Set(fork.arms.map(a => a.row).filter(row => row > 0))] : [];
    // the groups' medians are stretched so that the first group sits at the left edge and the last at the right,
    // keeping their relative distances; the bifolia keep the path's own 0 to 1
    const lo = S.axis === 'groupsPos' && atPositions ? Math.min(...K.map(c => c.position)) : 0, hi = S.axis === 'groupsPos' && atPositions ? Math.max(...K.map(c => c.position)) : 1;
    const place = pos => (hi > lo ? (pos - lo) / (hi - lo) : 0.5) * span;
    const xs = K.map((c, i) => padLeft + (atPositions ? place(c.position) : nSlots > 1 ? slotOf[i] * span / (nSlots - 1) : span / 2));
    if (S.axis === 'groupsPos' && atPositions) {
      // keep the group columns of each row at least MIN_GROUP_GAP apart (a forward pass, then back inside the plot); a
      // lower row starts at the fork column, whose x the first row has fixed
      for (let row = 0; row < rows; row++) {
        const own = K.map((c, i) => i).filter(i => rowOf[i] === row).sort((a, b) => slotOf[a] - slotOf[b]);
        const fixed = row > 0 && forkAt >= 0 ? 1 : 0, seq = fixed ? [forkAt, ...own] : own;
        for (let k = 1; k < seq.length; k++) xs[seq[k]] = Math.max(xs[seq[k]], xs[seq[k - 1]] + MIN_GROUP_GAP);
        const over = seq.length ? xs[seq[seq.length - 1]] - (padLeft + span) : 0;
        if (over > 0) { for (let k = fixed; k < seq.length; k++) xs[seq[k]] -= over; for (let k = seq.length - 2; k >= fixed; k--) xs[seq[k]] = Math.min(xs[seq[k]], xs[seq[k + 1]] - MIN_GROUP_GAP); if (xs[seq[fixed]] < padLeft) { const d = padLeft - xs[seq[fixed]]; for (let k = fixed; k < seq.length; k++) xs[seq[k]] += d; } }
      }
    }
    const value = (b, i) => (measure === 'share' ? b.values[i].share : b.values[i].rate);
    const count = i => bands.filter(b => value(b, i) > 0).length;
    // the middle column also holds the estimated anchors of the passthrough, so its total makes room for them
    const midIdx = K.findIndex(c => c.key === MIDDLE_KEY), passTotal = L && L.pass ? L.pass.total : 0;
    const total = i => bands.reduce((v, b) => v + value(b, i), 0) + (i === midIdx && passTotal ? (measure === 'share' ? (S.totals[i].rate ? passTotal / S.totals[i].rate : 0) : passTotal) : 0);
    let scales;
    if (measure === 'share' || fill) scales = K.map((c, i) => (total(i) > 0 ? (height - GAP * (count(i) - 1)) / total(i) : 0));
    else { let s = Infinity; K.forEach((c, i) => { if (total(i) > 0) s = Math.min(s, (height - GAP * (count(i) - 1)) / total(i)); }); scales = K.map(() => (Number.isFinite(s) ? s : 0)); }
    const out = bands.map((b, index) => ({index, hue: b.hue != null ? b.hue : index, label: b.label, word: b.word, words: b.words, kind: b.kind || 'spelling', pooled: !!b.pooled, removed: !!b.removed, pair: b.pair || null, segments: K.map(() => null), mirrors: {}}));
    K.forEach((c, i) => {
      let y = padTop + rowY(rowOf[i]);
      bands.forEach((b, bi) => {
        const v = value(b, i); if (!(v > 0)) return;
        const h = v * scales[i];
        out[bi].segments[i] = {x: xs[i], y, h, w: nw, n: b.values[i].n, rate: b.values[i].rate, share: b.values[i].share, row: rowOf[i]};
        y += h + GAP;
      });
    });
    // the fork column's mirror in each lower row: the same segments, moved down to that row
    for (const row of mirrorRows) for (const b of out) if (b.segments[forkAt]) b.mirrors[row] = {...b.segments[forkAt], y: b.segments[forkAt].y + rowY(row) - rowY(rowOf[forkAt]), row, mirror: true};
    // the source cell of a step into column j: the mirror of the fork column when j lies in another row, else the column itself
    const cellOf = (bi, i, j) => (rowOf[j] !== rowOf[i] ? out[bi].mirrors[rowOf[j]] || null : out[bi].segments[i]);
    // slots per step and band: [kept][flows out / in][stub], widths from the ledger in rate units × the side's scale
    const bandOf = new Map(); bands.forEach((b, bi) => b.words.forEach(w => bandOf.set(w, bi)));
    const unit = (i, v) => (measure === 'share' ? (S.totals[i].rate ? v / S.totals[i].rate : 0) : v) * scales[i];
    const ribbons = [], flows = [], stubs = [], skips = [];
    // the skipped groups' slots: per band, parked mass leaving at column i towards column j, and arriving at j from i
    const skipOut = bands.map(() => new Map()), skipIn = bands.map(() => new Map());
    for (const sk of (L && L.skips) || []) {
      const bi = bandOf.get(sk.word); if (bi == null || bands[bi].removed) continue;      // the removed words' own parking is not drawn
      const ko = sk.from + '>' + sk.to;
      skipOut[bi].set(ko, (skipOut[bi].get(ko) || 0) + sk.parked); skipIn[bi].set(ko, (skipIn[bi].get(ko) || 0) + sk.parked);
    }
    const skipY = new Map();            // 'bi|from>to' -> {y1, w1, y2, w2}
    // the passthrough flows, aggregated by band pair, take a slot on the column before the middle and one after it
    const passAgg = [];
    if (L && L.pass) {
      const byKey = new Map();
      for (const rt of L.pass.routes) {
        const f = bandOf.get(rt.from), tt = bandOf.get(rt.to); if (f == null || tt == null || f === tt) continue;
        if (bands[f].removed && bands[tt].removed) continue;
        const k = f + '>' + tt;
        if (!byKey.has(k)) { const x = {step: L.pass.step, step2: L.pass.step2, i: L.pass.i != null ? L.pass.i : L.pass.step, j: L.pass.j != null ? L.pass.j : L.pass.step2 + 1, from: f, to: tt, mass: 0, routes: []}; byKey.set(k, x); passAgg.push(x); }
        const x = byKey.get(k); x.mass += rt.mass; x.routes.push(rt);
      }
      passAgg.sort((p, q) => p.from - q.from || p.to - q.to);
    }
    const stepList = (L || []).map(step => ({step: step.step, i: step.i != null ? step.i : step.step, j: step.j != null ? step.j : (step.i != null ? step.i : step.step) + 1, key: step.key}));
    (L || []).forEach((step, si) => {
      const {i, j} = stepList[si], ord = step.step;
      // a route's mass at its target (massTo) differs from its source mass only for bigram flows, which taper
      const massTo = rt => (rt.massTo != null ? rt.massTo : rt.mass);
      const agg = bands.map(() => ({kept: 0, keptTo: 0, sent: 0, received: 0, unplaced: 0, unfilled: 0, out: new Map(), in: new Map()}));
      // the removed words' own kept and unexplained mass, and routes among them, stay out of the chart
      for (const p of step.perWord.values()) { const bi = bandOf.get(p.word), a = agg[bi]; if (!a || bands[bi].removed) continue; a.kept += p.kept; a.keptTo += p.kept; a.unplaced += p.unplaced; a.unfilled += p.unfilled; }
      for (const rt of step.routes) {
        const f = bandOf.get(rt.from), t = bandOf.get(rt.to); if (f == null || t == null) continue;
        if (bands[f].removed && bands[t].removed) continue;
        if (f === t) { agg[f].kept += rt.mass; agg[f].keptTo += massTo(rt); continue; }      // a route inside the band reads as kept
        const key = f + '>' + t;
        if (!agg[f].out.has(key)) { const x = {from: f, to: t, mass: 0, massTo: 0, routes: []}; agg[f].out.set(key, x); agg[t].in.set(key, x); }
        const x = agg[f].out.get(key); x.mass += rt.mass; x.massTo += massTo(rt); x.routes.push(rt);
      }
      const src = bands.map((b, bi) => cellOf(bi, i, j));
      const x1 = xs[i] + nw, x2 = xs[j], stubLen = Math.min(30, (x2 - x1) * 0.28);
      // The slots of each face are ordered by where their other end lies: flows to or from the bands above first, then
      // the band's own kept ribbon and its parked bands (whose other end is the band itself), then flows to or from the
      // bands below, and the unmatched wedge last. Bands keep one vertical order in every column, so a face ordered by
      // the partner band's index sends every ribbon off in the direction it has to go, and ribbons of one band do not
      // cross one another; two flows that run opposite ways between the same two bands still must.
      const right = bands.map(() => []), left = bands.map(() => []), RANK = {kept: 0, parked: 1, flow: 2, pass: 3, stub: 9};
      bands.forEach((b, bi) => {
        const a = agg[bi];
        if (a.kept > 1e-9 && src[bi] && out[bi].segments[j]) { const it = {kind: 'kept', kept: a.kept, keptTo: a.keptTo, w1: unit(i, a.kept), w2: unit(j, a.keptTo)}; right[bi].push({it, partner: bi, rank: RANK.kept}); left[bi].push({it, partner: bi, rank: RANK.kept}); }
      });
      const all = [...new Set(agg.flatMap(a => [...a.out.values()]))].sort((p, q) => p.from - q.from || p.to - q.to);
      for (const f of all) { const it = {kind: 'flow', f, w1: unit(i, f.mass), w2: unit(j, f.massTo)}; right[f.from].push({it, partner: f.to, rank: RANK.flow}); left[f.to].push({it, partner: f.from, rank: RANK.flow}); }
      // the parked mass: slots leaving column i (at the fork column only those bound for this step's row) and arriving at column j
      bands.forEach((b, bi) => {
        const leaving = [...skipOut[bi].entries()].filter(([k]) => Number(k.split('>')[0]) === i && (i !== forkAt || rowOf[Number(k.split('>')[1])] === rowOf[j])).sort((p, q) => Number(p[0].split('>')[1]) - Number(q[0].split('>')[1]));
        for (const [k, parked] of leaving) if (src[bi]) right[bi].push({it: {kind: 'parked', key: bi + '|' + k, w1: unit(i, parked)}, partner: bi, rank: RANK.parked});
        const arriving = [...skipIn[bi].entries()].filter(([k]) => Number(k.split('>')[1]) === j).sort((p, q) => Number(p[0].split('>')[0]) - Number(q[0].split('>')[0]));
        for (const [k, parked] of arriving) if (out[bi].segments[j]) left[bi].push({it: {kind: 'parked', key: bi + '|' + k, w2: unit(j, parked)}, partner: bi, rank: RANK.parked});
      });
      if (L && L.pass) {
        if (ord === L.pass.step) for (const f of passAgg) if (src[f.from]) { f.w1 = unit(i, f.mass); f.x1 = x1; right[f.from].push({it: {kind: 'pass', f, w1: f.w1}, partner: f.to, rank: RANK.pass}); }
        if (ord === L.pass.step2) for (const f of passAgg) if (out[f.to].segments[j]) { f.w2 = unit(j, f.mass); f.x2 = x2; left[f.to].push({it: {kind: 'pass', f, w2: f.w2}, partner: f.from, rank: RANK.pass}); }
      }
      bands.forEach((b, bi) => {
        const a = agg[bi];
        if (a.unplaced > 1e-9 && src[bi]) right[bi].push({it: {kind: 'stub', mass: a.unplaced, w1: unit(i, a.unplaced)}, partner: Infinity, rank: RANK.stub});
        if (a.unfilled > 1e-9 && out[bi].segments[j]) left[bi].push({it: {kind: 'stub', mass: a.unfilled, w2: unit(j, a.unfilled)}, partner: Infinity, rank: RANK.stub});
      });
      // the slots take their places down each face in that order; a flow's one item is on both faces, so it gets both ends
      const order = (p, q) => (p.partner === q.partner ? p.rank - q.rank : p.partner < q.partner ? -1 : 1);
      bands.forEach((b, bi) => {
        let y = src[bi] ? src[bi].y : 0;
        for (const e of right[bi].sort(order)) { e.it.y1 = y; y += e.it.w1; }
        y = out[bi].segments[j] ? out[bi].segments[j].y : 0;
        for (const e of left[bi].sort(order)) { e.it.y2 = y; y += e.it.w2; }
      });
      // then every ribbon, flow, parked slot, passthrough slot and wedge is drawn from its slots
      bands.forEach((b, bi) => {
        for (const {it} of right[bi]) {
          if (it.kind === 'kept') ribbons.push({band: bi, step: ord, i, j, kept: it.kept, keptTo: it.keptTo, path: ribbon(x1, it.y1, it.w1, x2, it.y2, it.w2)});
          else if (it.kind === 'flow') { const f = it.f; flows.push({step: ord, i, j, from: f.from, to: f.to, mass: f.mass, massTo: f.massTo, routes: f.routes, w1: it.w1, w2: it.w2, x1, y1: it.y1 + it.w1 / 2, x2, y2: it.y2 + it.w2 / 2, path: ribbon(x1, it.y1, it.w1, x2, it.y2, it.w2)}); }
          else if (it.kind === 'parked') { const s = skipY.get(it.key) || {}; s.y1 = it.y1; s.w1 = it.w1; skipY.set(it.key, s); }
          else if (it.kind === 'pass') it.f.yt1 = it.y1;
          else if (it.kind === 'stub') stubs.push({step: ord, i, j, band: bi, kind: 'unplaced', mass: it.mass, path: `M${r(x1)} ${r(it.y1)} L${r(x1 + stubLen)} ${r(it.y1 + it.w1 / 2)} L${r(x1)} ${r(it.y1 + it.w1)}Z`});
        }
        for (const {it} of left[bi]) {
          if (it.kind === 'parked') { const s = skipY.get(it.key) || {}; s.y2 = it.y2; s.w2 = it.w2; skipY.set(it.key, s); }
          else if (it.kind === 'pass') it.f.yt2 = it.y2;
          else if (it.kind === 'stub') stubs.push({step: ord, i, j, band: bi, kind: 'unfilled', mass: it.mass, path: `M${r(x2)} ${r(it.y2)} L${r(x2 - stubLen)} ${r(it.y2 + it.w2 / 2)} L${r(x2)} ${r(it.y2 + it.w2)}Z`});
        }
      });
    });
    // each passthrough flow runs into an estimated anchor inside the middle column (stacked under its observed segments)
    // and out of it again, so the band can be followed through the column it was not observed in
    let anchorY = padTop + (midIdx >= 0 ? rowY(rowOf[midIdx]) : 0);
    if (midIdx >= 0) for (const b of out) if (b.segments[midIdx]) anchorY = Math.max(anchorY, b.segments[midIdx].y + b.segments[midIdx].h + GAP);
    const pass = passAgg.filter(f => f.w1 != null && f.w2 != null).map(f => {
      const wm = unit(midIdx, f.mass), anchor = {x: xs[midIdx], y: anchorY, w: nw, h: wm};
      anchorY += wm + GAP;
      return {step: f.step, step2: f.step2, i: f.i, j: f.j, from: f.from, to: f.to, mass: f.mass, massTo: f.mass, routes: f.routes, w1: f.w1, w2: f.w2, x1: f.x1, x2: f.x2, y1: f.yt1 + f.w1 / 2, y2: f.yt2 + f.w2 / 2, pass: true, anchor,
        path: ribbon(f.x1, f.yt1, f.w1, anchor.x, anchor.y, wm) + ' ' + ribbon(anchor.x + nw, anchor.y, wm, f.x2, f.yt2, f.w2)};
    });
    // the dotted bands of the skipped groups, from the slot leaving column i to the slot arriving at column j
    bands.forEach((b, bi) => {
      for (const [k, parked] of skipOut[bi]) {
        const [i, j] = k.split('>').map(Number), e = skipY.get(bi + '|' + k);
        if (!e || e.y1 == null || e.y2 == null) continue;
        const x1 = xs[i] + nw, x2 = xs[j];
        skips.push({band: bi, from: i, to: j, parked, x1, x2, path: ribbon(x1, e.y1, e.w1, x2, e.y2, e.w2)});
      }
    });
    // labels in the right margin of each row, one per band and row, anchored (x0, y0) at the right edge of the band's
    // last segment in that row and spread apart by at least 14 px, kept inside the row's plot where they fit
    const xLabel = (n ? Math.max(...xs) : padLeft) + nw + 8, labels = [];
    for (let row = 0; row < rows; row++) {
      const lastSlot = Math.max(-1, ...K.map((c, i) => (rowOf[i] === row ? slotOf[i] : -1)));
      const own = out.map(b => { let last = -1; b.segments.forEach((s, i) => { if (s && rowOf[i] === row) last = i; }); if (last < 0) return null; const y0 = b.segments[last].y + b.segments[last].h / 2; return {band: b.index, label: b.label, x: xLabel, y: y0, x0: xs[last] + nw, y0, column: last, row, last: slotOf[last] === lastSlot}; }).filter(Boolean);
      own.sort((a, b) => a.y0 - b.y0);
      for (let k = 1; k < own.length; k++) own[k].y = Math.max(own[k].y, own[k - 1].y + 14);
      const overflow = own.length ? own[own.length - 1].y + 6 - (padTop + rowY(row) + height) : 0;
      if (overflow > 0) { for (const l of own) l.y -= overflow; for (let k = 1; k < own.length; k++) own[k].y = Math.max(own[k].y, own[k - 1].y + 14); }
      labels.push(...own);
    }
    const cols = K.map((c, i) => ({...c, x: xs[i], w: nw, row: rowOf[i], slot: slotOf[i], y: padTop + rowY(rowOf[i]), total: S.totals[i], sparse: S.sparse[i], stack: total(i) * scales[i] + GAP * Math.max(0, count(i) - 1)}));
    const mirrors = mirrorRows.map(row => ({col: forkAt, key: K[forkAt].key, row, x: xs[forkAt], w: nw, y: padTop + rowY(row), stack: cols[forkAt].stack}));
    return {width, height: padTop + rows * height + (rows - 1) * rowGap + 6, plotTop: padTop, plotHeight: height, rows, rowGap, rowY: [...Array(rows)].map((_, row) => rowY(row)), fork, mirrors, steps: stepList, measure, fill: !!fill, columns: cols, bands: out, ribbons, flows, pass, stubs, skips, labels, scales};
  }

  const api = {CHAIN, ALT_CHAIN, FORK, FORK_CHAIN, ORDERS, OFF_CHAIN, TERMINAL, MIDDLE_KEY, MIDDLE_GROUPS, REMOVED_LABEL, REST_LABEL, SPARSE, GAP, PER, core, isGroups, columns, stepsOf, pathsOf, dropMiddle, dropColumns, spanSchedule, removedFlows, lineageOf, ledgerFlows, members, series, stackOrder, classKey, bigrams, bigramSeries, bigramLedgers, exactPairs, ledgers, capFlow, skipsOf, partsOf, labelDegree, pairDegree, newDForm, layout, ribbonPath: ribbon, GAP, bigramUnits, ruleSeries, traceMiddle, middleLedgers, keptSince};
  if (node) module.exports = api; else root.EchoChainFlow = api;
})(typeof window !== 'undefined' ? window : globalThis);
