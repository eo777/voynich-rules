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
  // the alternate curve's ranks and positions from `pools` (alt_rank, alt_position) where they are saved.
  function columns({manuscript, lines, axis = 'groups', mergeQ = false, pools = null, order: ord = 'proposed', middle = false}) {
    const G = manuscript.golf21 || {units: {}, classes: []}, sheets = (manuscript.golf_path || {}).sheets || {};
    const spelling = mergeQ ? core : w => w, alternate = ord === 'alternate';
    const para = lines.filter(l => (l.category || 'para') === 'para');
    let cols;
    if (isGroups(axis)) {
      const labels = Object.fromEntries((G.classes || []).map(c => [c.code, c.label]));
      // the slots of the proposed order, and the codes that fill them (the alternate order swaps 4a and 4c); with
      // `middle`, one more slot after 2a pools the paragraph text of the two off-chain pools between 2a and 3a on the
      // path (J:69-70, class 5a: f69r and f70r2; H:58-65, class 6: f58): a page counts there only when its class is
      // 5a or 6 and its sheet is one of those pools, so 5a pages on 2a or 3c sheets and f65v (class 3b) stay out
      const withMiddle = list => { const out = list.slice(); if (middle) out.splice(out.indexOf('2a') + 1, 0, MIDDLE_KEY); return out; };
      const slots = withMiddle(CHAIN), codes = withMiddle(alternate ? ALT_CHAIN : CHAIN);
      const midPools = pools ? new Set(Object.keys(pools).filter(k => MIDDLE_GROUPS.includes(pools[k].group))) : null;
      cols = codes.map((code, i) => column(code, code === MIDDLE_KEY
        ? {group: MIDDLE_KEY, title: 'Celestial paragraphs of f69r and f70r2 (5a) and f58 (6): the paragraph text of the two pools between 2a and 3a on the path', rank: i + 1}
        : {group: code, title: labels[code] || '', rank: i + 1}));
      if (axis === 'groupsPos' && pools) {
        // each slot sits at the median proposed-path position of its group's pools (its span kept for the header); the
        // alternate order fills the same slots in its own order, so the geometry stays the proposed path's
        const of = groups_ => Object.values(pools).filter(p => groups_.includes(p.group)).map(p => p.position).sort((a, b) => a - b);
        slots.forEach((code, i) => { const ps = of(code === MIDDLE_KEY ? MIDDLE_GROUPS : [code]); cols[i].position = ps.length ? ps[Math.floor(ps.length / 2)] : null; cols[i].span = ps.length ? [ps[0], ps[ps.length - 1]] : null; });
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
    return {axis, mergeQ, order: alternate ? 'alternate' : 'proposed', columns: cols, spellings, steps: cols.slice(1).map((c, i) => [i, i + 1])};
  }

  // The spellings a scope names: 'family' = the word's connected component under the active rules (the network is
  // q-merged; in exact mode each member's q spelling present in the text joins it), 'front' / 'tail' = every spelling
  // sharing the word's saved FRONT or TAIL, 'pattern' = the spellings matching the pattern (app syntax).
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
    if (scope === 'family') {
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
  const OTHER_LABEL = {spelling: 'other members', tail: 'other endings', front: 'other fronts', bigram: 'other bigrams'};
  const columnsMeta = K => K.map(c => ({key: c.key, label: c.label, title: c.title, group: c.group, rank: c.rank, position: c.position, span: c.span || null, N: c.N, pages: c.pages ? c.pages.size : 0}));

  // Each band's count, rate per 10k of the column and share of the family per column. `by` 'spelling' (one band per
  // spelling), 'tail' or 'front' (one band per class of the saved split, holding every member spelling); the bands are
  // the `cap` largest by summed rate (ties alphabetical), the rest pooled as one band so the family total is conserved.
  function series(cols, words, {cap = 12, by = 'spelling', splits = null, pin = []} = {}) {
    const K = cols.columns, list = [...words];
    const rate = (n, c) => (c.N ? n / c.N * PER : 0);
    const totals = K.map(c => { let n = 0; for (const w of list) n += c.counts.get(w) || 0; return {N: c.N, n, rate: rate(n, c)}; });
    const mass = new Map(list.map(w => [w, K.reduce((v, c) => v + rate(c.counts.get(w) || 0, c), 0)]));
    const sorted = list.slice().sort((a, b) => mass.get(b) - mass.get(a) || order(a, b));
    const classes = new Map();
    for (const w of sorted) { const k = classKey(w, by, splits); if (!classes.has(k)) classes.set(k, []); classes.get(k).push(w); }
    const entries = [...classes.entries()].map(([key, ws]) => ({key, words: ws, mass: ws.reduce((v, w) => v + mass.get(w), 0)})).sort((a, b) => b.mass - a.mass || order(a.key, b.key));
    // the cap largest classes, plus any pinned class (a selection's partners pulled out of the pooled band)
    const pinSet = new Set(pin || []), top = entries.length > cap ? entries.slice(0, cap) : entries;
    const kept = top.concat(entries.slice(top.length).filter(e => pinSet.has(e.key))), keptKeys = new Set(kept.map(e => e.key)), rest = entries.filter(e => !keptKeys.has(e.key));
    const values = ws => K.map((c, i) => { let n = 0; for (const w of ws) n += c.counts.get(w) || 0; return {n, rate: rate(n, c), share: totals[i].n ? n / totals[i].n : 0}; });
    const bands = kept.map(e => ({word: by === 'spelling' ? e.key : null, label: e.key, kind: by, words: e.words, values: values(e.words), mass: e.mass}));
    const restWords = rest.flatMap(e => e.words);
    const other = rest.length ? {word: null, label: OTHER_LABEL[by] || 'other', kind: by, pooled: true, classes: rest.length, words: restWords, values: values(restWords), mass: rest.reduce((v, e) => v + e.mass, 0)} : null;
    return {axis: cols.axis, mergeQ: cols.mergeQ, order: cols.order, by, columns: columnsMeta(K), bands, other, totals, sparse: totals.map(t => t.n < SPARSE), words: sorted, classes: entries.length, cap};
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
  function bigramSeries(cols, words, {units = {}, cap = 12, pin = []} = {}) {
    const K = cols.columns, list = [...words];
    const rate = (n, c) => (c.N ? n / c.N * PER : 0);
    const per = K.map(c => { const m = new Map(); for (const w of list) { const n = c.counts.get(w) || 0; if (!n) continue; for (const [b, k] of bigramCounts(w, units)) m.set(b, (m.get(b) || 0) + n * k); } return m; });
    const wordTokens = K.map(c => list.reduce((v, w) => v + (c.counts.get(w) || 0), 0));
    const totals = K.map((c, i) => { let n = 0; for (const v of per[i].values()) n += v; return {N: c.N, n, rate: rate(n, c)}; });
    const all = [...new Set(per.flatMap(m => [...m.keys()]))];
    const mass = new Map(all.map(b => [b, K.reduce((v, c, i) => v + rate(per[i].get(b) || 0, c), 0)]));
    const sorted = all.sort((a, b) => mass.get(b) - mass.get(a) || order(a, b));
    const pinSet = new Set(pin || []), top = sorted.length > cap ? sorted.slice(0, cap) : sorted;
    const kept = top.concat(sorted.slice(top.length).filter(b => pinSet.has(b))), keptSet = new Set(kept), rest = sorted.filter(b => !keptSet.has(b));
    const values = bs => K.map((c, i) => { let n = 0; for (const b of bs) n += per[i].get(b) || 0; return {n, rate: rate(n, c), share: totals[i].n ? n / totals[i].n : 0}; });
    const pairs = bigramUnits(list, units);
    const bands = kept.map(b => ({word: null, label: b, kind: 'bigram', pair: pairs.get(b) || null, words: [b], values: values([b]), mass: mass.get(b)}));
    const other = rest.length ? {word: null, label: OTHER_LABEL.bigram, kind: 'bigram', pooled: true, classes: rest.length, words: rest, values: values(rest), mass: rest.reduce((v, b) => v + mass.get(b), 0)} : null;
    return {axis: cols.axis, mergeQ: cols.mergeQ, order: cols.order, by: 'bigram', columns: columnsMeta(K), bands, other, totals, sparse: wordTokens.map(n => n < SPARSE), words: sorted, cap};
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
      return {step: step.step, key: step.key, from: step.from, to: step.to, routes, perWord: per, totals, bigram: true};
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
    const steps = (L || []).map(step => { const by = new Map(); for (const rt of step.routes) add(by, rt); return {step: step.step, key: step.key, from: step.from, to: step.to, by, totals: step.totals}; });
    let pass = null;
    if (L && L.pass) { const by = new Map(); for (const rt of L.pass.routes) add(by, rt); pass = {step: L.pass.step, step2: L.pass.step2, key: L.pass.key, from: L.pass.from, to: L.pass.to, by, total: L.pass.total}; }
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
  function keptSince(cols, words) {
    const K = cols.columns, n = K.length, rate = (w, c) => (c.N ? (c.counts.get(w) || 0) / c.N * PER : 0);
    const steps = K.slice(1).map((c, i) => new Array(i + 1).fill(0));
    for (const w of words) {
      const r = K.map(c => rate(w, c));
      for (let i = 0; i + 1 < n; i++) {
        const since = []; let cur = r[i + 1];
        for (let a = i; a >= 0; a--) { cur = Math.min(cur, r[a]); since[a] = cur; }
        for (let a = 0; a <= i; a++) steps[i][a] += since[a] - (a > 0 ? since[a - 1] : 0);
      }
    }
    return {steps, total: steps.map(s => s.reduce((v, x) => v + x, 0))};
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
  // parks min(rate_i, rate_j) across the gap: that mass leaves the loss of step i and the gain of step j − 1.
  function skipsOf(K, list, rate) {
    const out = [], dormOut = K.map(() => new Map()), dormIn = K.map(() => new Map());
    for (const w of list) {
      const r = K.map(c => rate(w, c));
      let i = 0;
      while (i < r.length) {
        if (!(r[i] > 0)) { i++; continue; }
        let j = i + 1;
        while (j < r.length && !(r[j] > 0)) j++;
        if (j < r.length && j > i + 1) { const parked = Math.min(r[i], r[j]); out.push({word: w, from: i, to: j, parked}); dormOut[i].set(w, parked); dormIn[j].set(w, parked); }
        i = j;
      }
    }
    return {skips: out, dormOut, dormIn};
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
  function ledgers(cols, words, pairs, {schedule = null, dormancy = true, ...trace} = {}) {
    const K = cols.columns, list = [...words], set = new Set(list);
    // with a middle column, the direct chain (without it) is the model; the middle is read part-way along its 2a → 3a step
    const mIdx = K.findIndex(c => c.key === MIDDLE_KEY);
    if (mIdx > 0 && mIdx + 1 < K.length) return middleLedgers(cols, words, ledgers({...cols, columns: K.filter(c => c.key !== MIDDLE_KEY)}, words, pairs, {schedule, dormancy}), {noNewD: !!(schedule && schedule.no_new_d), ...trace});
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
    const {skips, dormOut, dormIn} = dormancy ? skipsOf(K, list, rate) : {skips: [], dormOut: K.map(() => new Map()), dormIn: K.map(() => new Map())};
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
    const result = K.slice(1).map((to, i) => {
      const from = K[i], key = from.key + '>' + to.key, loss = new Map(), gain = new Map(), perWord = new Map();
      for (const w of list) {
        const a = rate(w, from), b = rate(w, to), kept = Math.min(a, b), dout = dormOut[i].get(w) || 0, din = dormIn[i + 1].get(w) || 0;
        loss.set(w, Math.max(a - b - dout, 0)); gain.set(w, Math.max(b - a - din, 0));
        perWord.set(w, {word: w, a, b, kept, sent: 0, received: 0, unplaced: 0, unfilled: 0, dormant_out: dout, dormant_in: din, passed_out: 0, passed_in: 0});
      }
      const flow = capFlow(loss, gain, edgesFor(key)), routes = flow.routes;
      for (const r of routes) { perWord.get(r.from).sent += r.mass; perWord.get(r.to).received += r.mass; }
      return {step: i, key, from: from.key, to: to.key, routes, perWord, totals: totalsOf(perWord, flow.total)};
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
    const direct = base[m - 1], mid = K[m], T = traceMiddle(direct, mid, list, opts);
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
    const step1 = {step: m - 1, key: K[m - 1].key + '>' + mid.key, from: K[m - 1].key, to: mid.key, routes: r1, perWord: P1, totals: totals(P1, r1), traced: true};
    const step2 = {step: m, key: mid.key + '>' + K[m + 1].key, from: mid.key, to: K[m + 1].key, routes: r2, perWord: P2, totals: totals(P2, r2), traced: true};
    const out = base.slice(0, m - 1).concat([step1, step2], base.slice(m).map(s => ({...s, step: s.step + 1})));
    // the skips re-indexed around the inserted column; a skip out of 2a or into 3a splits at the middle by the word's
    // shares, and kept mass the middle text does not show parks across it
    const shift = i => (i >= m ? i + 1 : i), skips = [];
    const push = (word, from, to, parked) => { if (parked > 1e-9) skips.push({word, from, to, parked}); };
    for (const sk of base.skips || []) {
      const t = T.perWord.get(sk.word);
      if (t && sk.from === m - 1) { push(sk.word, m - 1, shift(sk.to), t.departed * sk.parked); push(sk.word, m, shift(sk.to), (1 - t.departed) * sk.parked); }
      else if (t && sk.to === m) { push(sk.word, sk.from, m, t.arrived * sk.parked); push(sk.word, sk.from, m + 1, (1 - t.arrived) * sk.parked); }
      else push(sk.word, shift(sk.from), shift(sk.to), sk.parked);
    }
    for (const t of T.perWord.values()) push(t.word, m - 1, m + 1, t.parked);
    out.skips = skips;
    out.pass = {step: m - 1, step2: m, key: direct.key, from: K[m - 1].key, to: K[m + 1].key, routes: pass, total: pass.reduce((v, r) => v + r.mass, 0)};
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
  function layout(S, L, {width = 960, height = 320, measure = 'per10k', padLeft = 20, padRight = 120, padTop = 6} = {}) {
    const bands = S.other ? [...S.bands, S.other] : S.bands, K = S.columns, n = K.length;
    const nw = isGroups(S.axis) ? 14 : 7, span = Math.max(1, width - padLeft - padRight - nw);
    const atPositions = (S.axis === 'poolsPos' || S.axis === 'groupsPos') && K.every(c => c.position != null);
    // the groups' medians are stretched so that the first group sits at the left edge and the last at the right,
    // keeping their relative distances; the bifolia keep the path's own 0 to 1
    const lo = S.axis === 'groupsPos' && atPositions ? Math.min(...K.map(c => c.position)) : 0, hi = S.axis === 'groupsPos' && atPositions ? Math.max(...K.map(c => c.position)) : 1;
    const place = pos => (hi > lo ? (pos - lo) / (hi - lo) : 0.5) * span;
    const xs = K.map((c, i) => padLeft + (atPositions ? place(c.position) : n > 1 ? i * span / (n - 1) : span / 2));
    if (S.axis === 'groupsPos' && atPositions) {
      // keep the group columns at least MIN_GROUP_GAP apart (a forward pass, then back inside the plot)
      for (let i = 1; i < n; i++) xs[i] = Math.max(xs[i], xs[i - 1] + MIN_GROUP_GAP);
      const over = xs[n - 1] - (padLeft + span);
      if (over > 0) { for (let i = 0; i < n; i++) xs[i] -= over; for (let i = n - 2; i >= 0; i--) xs[i] = Math.min(xs[i], xs[i + 1] - MIN_GROUP_GAP); if (xs[0] < padLeft) { const d = padLeft - xs[0]; for (let i = 0; i < n; i++) xs[i] += d; } }
    }
    const value = (b, i) => (measure === 'share' ? b.values[i].share : b.values[i].rate);
    const count = i => bands.filter(b => value(b, i) > 0).length;
    // the middle column also holds the estimated anchors of the passthrough, so its total makes room for them
    const midIdx = K.findIndex(c => c.key === MIDDLE_KEY), passTotal = L && L.pass ? L.pass.total : 0;
    const total = i => bands.reduce((v, b) => v + value(b, i), 0) + (i === midIdx && passTotal ? (measure === 'share' ? (S.totals[i].rate ? passTotal / S.totals[i].rate : 0) : passTotal) : 0);
    let scales;
    if (measure === 'share') scales = K.map((c, i) => (total(i) > 0 ? (height - GAP * (count(i) - 1)) / total(i) : 0));
    else { let s = Infinity; K.forEach((c, i) => { if (total(i) > 0) s = Math.min(s, (height - GAP * (count(i) - 1)) / total(i)); }); scales = K.map(() => (Number.isFinite(s) ? s : 0)); }
    const out = bands.map((b, index) => ({index, label: b.label, word: b.word, words: b.words, kind: b.kind || 'spelling', pooled: !!b.pooled, pair: b.pair || null, segments: K.map(() => null)}));
    K.forEach((c, i) => {
      let y = padTop;
      bands.forEach((b, bi) => {
        const v = value(b, i); if (!(v > 0)) return;
        const h = v * scales[i];
        out[bi].segments[i] = {x: xs[i], y, h, w: nw, n: b.values[i].n, rate: b.values[i].rate, share: b.values[i].share};
        y += h + GAP;
      });
    });
    // slots per step and band: [kept][flows out / in][stub], widths from the ledger in rate units × the side's scale
    const bandOf = new Map(); bands.forEach((b, bi) => b.words.forEach(w => bandOf.set(w, bi)));
    const unit = (i, v) => (measure === 'share' ? (S.totals[i].rate ? v / S.totals[i].rate : 0) : v) * scales[i];
    const ribbons = [], flows = [], stubs = [], skips = [];
    // the skipped groups' slots: per band, parked mass leaving at column i towards column j, and arriving at j from i
    const skipOut = bands.map(() => new Map()), skipIn = bands.map(() => new Map());
    for (const sk of (L && L.skips) || []) {
      const bi = bandOf.get(sk.word); if (bi == null) continue;
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
        const k = f + '>' + tt;
        if (!byKey.has(k)) { const x = {step: L.pass.step, step2: L.pass.step2, from: f, to: tt, mass: 0, routes: []}; byKey.set(k, x); passAgg.push(x); }
        const x = byKey.get(k); x.mass += rt.mass; x.routes.push(rt);
      }
      passAgg.sort((p, q) => p.from - q.from || p.to - q.to);
    }
    (L || []).forEach(step => {
      const i = step.step, j = i + 1;
      // a route's mass at its target (massTo) differs from its source mass only for bigram flows, which taper
      const massTo = rt => (rt.massTo != null ? rt.massTo : rt.mass);
      const agg = bands.map(() => ({kept: 0, keptTo: 0, sent: 0, received: 0, unplaced: 0, unfilled: 0, out: new Map(), in: new Map()}));
      for (const p of step.perWord.values()) { const a = agg[bandOf.get(p.word)]; if (!a) continue; a.kept += p.kept; a.keptTo += p.kept; a.unplaced += p.unplaced; a.unfilled += p.unfilled; }
      for (const rt of step.routes) {
        const f = bandOf.get(rt.from), t = bandOf.get(rt.to); if (f == null || t == null) continue;
        if (f === t) { agg[f].kept += rt.mass; agg[f].keptTo += massTo(rt); continue; }      // a route inside the band reads as kept
        const key = f + '>' + t;
        if (!agg[f].out.has(key)) { const x = {from: f, to: t, mass: 0, massTo: 0, routes: []}; agg[f].out.set(key, x); agg[t].in.set(key, x); }
        const x = agg[f].out.get(key); x.mass += rt.mass; x.massTo += massTo(rt); x.routes.push(rt);
      }
      const offL = bands.map((b, bi) => out[bi].segments[i] ? out[bi].segments[i].y : 0), offR = bands.map((b, bi) => out[bi].segments[j] ? out[bi].segments[j].y : 0);
      const x1 = xs[i] + nw, x2 = xs[j], stubLen = Math.min(30, (x2 - x1) * 0.28);
      bands.forEach((b, bi) => {
        const a = agg[bi];
        if (a.kept > 1e-9 && out[bi].segments[i] && out[bi].segments[j]) {
          const w1 = unit(i, a.kept), w2 = unit(j, a.keptTo);
          ribbons.push({band: bi, step: i, kept: a.kept, keptTo: a.keptTo, path: ribbon(x1, offL[bi], w1, x2, offR[bi], w2)});
          offL[bi] += w1; offR[bi] += w2;
        }
      });
      // flows in band order of their source, then target, so slots stay in reading order on both sides; each flow keeps
      // its end points (the middle of its slot on each side) for labels
      const all = [...new Set(agg.flatMap(a => [...a.out.values()]))].sort((p, q) => p.from - q.from || p.to - q.to);
      for (const f of all) {
        const w1 = unit(i, f.mass), w2 = unit(j, f.massTo);
        flows.push({step: i, from: f.from, to: f.to, mass: f.mass, massTo: f.massTo, routes: f.routes, w1, w2, x1, y1: offL[f.from] + w1 / 2, x2, y2: offR[f.to] + w2 / 2, path: ribbon(x1, offL[f.from], w1, x2, offR[f.to], w2)});
        offL[f.from] += w1; offR[f.to] += w2;
      }
      // the parked mass: slots leaving column i (ordered by destination) and arriving at column j (ordered by origin)
      bands.forEach((b, bi) => {
        const leaving = [...skipOut[bi].entries()].filter(([k]) => Number(k.split('>')[0]) === i).sort((p, q) => Number(p[0].split('>')[1]) - Number(q[0].split('>')[1]));
        for (const [k, parked] of leaving) { if (!out[bi].segments[i]) continue; const w = unit(i, parked); const e = skipY.get(bi + '|' + k) || {}; e.y1 = offL[bi]; e.w1 = w; skipY.set(bi + '|' + k, e); offL[bi] += w; }
        const arriving = [...skipIn[bi].entries()].filter(([k]) => Number(k.split('>')[1]) === j).sort((p, q) => Number(p[0].split('>')[0]) - Number(q[0].split('>')[0]));
        for (const [k, parked] of arriving) { if (!out[bi].segments[j]) continue; const w = unit(j, parked); const e = skipY.get(bi + '|' + k) || {}; e.y2 = offR[bi]; e.w2 = w; skipY.set(bi + '|' + k, e); offR[bi] += w; }
      });
      if (L && L.pass) {
        if (i === L.pass.step) for (const f of passAgg) { if (!out[f.from].segments[i]) continue; f.w1 = unit(i, f.mass); f.yt1 = offL[f.from]; f.x1 = x1; offL[f.from] += f.w1; }
        if (i === L.pass.step2) for (const f of passAgg) { if (!out[f.to].segments[j]) continue; f.w2 = unit(j, f.mass); f.yt2 = offR[f.to]; f.x2 = x2; offR[f.to] += f.w2; }
      }
      bands.forEach((b, bi) => {
        const a = agg[bi];
        if (a.unplaced > 1e-9 && out[bi].segments[i]) { const w = unit(i, a.unplaced), y = offL[bi]; stubs.push({step: i, band: bi, kind: 'unplaced', mass: a.unplaced, path: `M${r(x1)} ${r(y)} L${r(x1 + stubLen)} ${r(y + w / 2)} L${r(x1)} ${r(y + w)}Z`}); offL[bi] += w; }
        if (a.unfilled > 1e-9 && out[bi].segments[j]) { const w = unit(j, a.unfilled), y = offR[bi]; stubs.push({step: i, band: bi, kind: 'unfilled', mass: a.unfilled, path: `M${r(x2)} ${r(y)} L${r(x2 - stubLen)} ${r(y + w / 2)} L${r(x2)} ${r(y + w)}Z`}); offR[bi] += w; }
      });
    });
    // each passthrough flow runs into an estimated anchor inside the middle column (stacked under its observed segments)
    // and out of it again, so the band can be followed through the column it was not observed in
    let anchorY = padTop;
    if (midIdx >= 0) for (const b of out) if (b.segments[midIdx]) anchorY = Math.max(anchorY, b.segments[midIdx].y + b.segments[midIdx].h + GAP);
    const pass = passAgg.filter(f => f.w1 != null && f.w2 != null).map(f => {
      const wm = unit(midIdx, f.mass), anchor = {x: xs[midIdx], y: anchorY, w: nw, h: wm};
      anchorY += wm + GAP;
      return {step: f.step, step2: f.step2, from: f.from, to: f.to, mass: f.mass, massTo: f.mass, routes: f.routes, w1: f.w1, w2: f.w2, x1: f.x1, x2: f.x2, y1: f.yt1 + f.w1 / 2, y2: f.yt2 + f.w2 / 2, pass: true, anchor,
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
    // labels in the right margin, one per band, anchored (x0, y0) at the right edge of the band's last segment and
    // spread apart by at least 14 px, kept inside the plot where they fit
    const xLabel = xs[n - 1] + nw + 8;
    const labels = out.map(b => { let last = -1; b.segments.forEach((s, i) => { if (s) last = i; }); if (last < 0) return null; const y0 = b.segments[last].y + b.segments[last].h / 2; return {band: b.index, label: b.label, x: xLabel, y: y0, x0: xs[last] + nw, y0, column: last}; }).filter(Boolean);
    labels.sort((a, b) => a.y0 - b.y0);
    for (let k = 1; k < labels.length; k++) labels[k].y = Math.max(labels[k].y, labels[k - 1].y + 14);
    const overflow = labels.length ? labels[labels.length - 1].y + 6 - (padTop + height) : 0;
    if (overflow > 0) { for (const l of labels) l.y -= overflow; for (let k = 1; k < labels.length; k++) labels[k].y = Math.max(labels[k].y, labels[k - 1].y + 14); }
    const cols = K.map((c, i) => ({...c, x: xs[i], w: nw, total: S.totals[i], sparse: S.sparse[i], stack: total(i) * scales[i] + GAP * Math.max(0, count(i) - 1)}));
    return {width, height: padTop + height + 6, plotTop: padTop, plotHeight: height, measure, columns: cols, bands: out, ribbons, flows, pass, stubs, skips, labels, scales};
  }

  const api = {CHAIN, ALT_CHAIN, OFF_CHAIN, TERMINAL, MIDDLE_KEY, MIDDLE_GROUPS, SPARSE, GAP, PER, core, isGroups, columns, members, series, classKey, bigrams, bigramSeries, bigramLedgers, exactPairs, ledgers, capFlow, skipsOf, partsOf, labelDegree, pairDegree, newDForm, layout, ribbonPath: ribbon, GAP, bigramUnits, ruleSeries, traceMiddle, middleLedgers, keptSince};
  if (node) module.exports = api; else root.EchoChainFlow = api;
})(typeof window !== 'undefined' ? window : globalThis);
