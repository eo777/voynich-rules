/* Occurrences of the current Words & contexts search across the manuscript, by page or by paragraph.
 * Pure model functions (grouping, units and their counts, order, facet layout, group statistics, histograms, axis
 * ticks) are exported for node tests; mount() draws the bars or histograms and the statistics table into a container.
 * Order and layout only move columns: the statistics depend on the grouping, the unit, the measure and the counts.
 * Colours are CSS variable names so the chart follows the light/dark theme without redrawing.
 */
(function (root) {
  'use strict';
  // Illustration sections. Bio, Pharmaceutical and Stars keep their population colours; the rest were chosen to
  // separate sections that sit next to each other in the manuscript (normal and colour-blind vision, both themes).
  const SECTION_COLOURS = {H: '--secB', A: '--secAt', C: '--secL', Z: '--secBt', B: '--secN', P: '--secM', S: '--m1n', T: '--ink2'};
  // RZ classes and Currier languages reuse the regime colours of their counterparts (A ~ early Herbal A, Ae ~ late A +
  // pharma, B ~ Herbal B, Bb ~ Bio, Bs ~ Stars, C ~ Celestial), so switching groupings shows where they disagree.
  const RZ_COLOURS = {A: '--secA', Ae: '--secM', B: '--secB', Bb: '--secN', Bs: '--m1n', C: '--secH', Ce: '--secL', Cb: '--secBt'};
  const RZ_LABELS = {A: 'A', Ae: 'Ae · pharma', B: 'B', Bb: 'Bb · bio', Bs: 'Bs · stars', C: 'C · cosmological', Ce: 'Ce · zodiac', Cb: 'Cb · bio'};
  const CURRIER_COLOURS = {A: '--secA', B: '--secB'};
  // Hands have no colour elsewhere in the app; chosen to separate hands whose pages sit next to each other.
  const HAND_COLOURS = {1: '--secA', 2: '--secBt', 3: '--secMt', 4: '--secL', 5: '--secN'};
  const OTHER = '--pc-other';           // recessive grey, distinct from Bio's slate in both themes
  // Late Herbal A when the late A + pharma regime is split (pharma keeps the joint regime's colour). Checked against
  // every other regime colour and the grey for colour-blind separation (OKLab dE >= 14 in both themes).
  const LATE_A_COLOUR = '--rgLA';
  const quireNumber = q => q.charCodeAt(0) - 64;                       // transliteration quire letters: A = quire 1
  const rzClass = code => code ? code.replace(/[+\-]+$/, '') : null;   // RZ q-frequency modifiers (+ / -) are dropped

  const readable = line => line.words.reduce((n, w) => n + (w ? 1 : 0), 0);
  const category = line => line.category || 'para';                    // workbench lines are paragraph text
  const sum = (keys, obj) => keys.reduce((n, k) => n + (obj[k] || 0), 0);

  // A grouping assigns every token to one group key. Section, regime, RZ and Currier language are page attributes;
  // LFD hand and comparison membership are read per line, because f115r changes hand (and population) mid-page.
  function grouping(mode, manuscript, opts = {}) {
    const pages = manuscript.pages;
    const byPage = (keyOfPage, keys, label, colour, noneLabel) => {
      const present = new Set(pages.map(p => keyOfPage(p) ?? 'none'));
      const groups = keys.filter(k => present.has(k)).map(k => ({key: k, label: label(k), colour: colour(k) || OTHER, members: [k]}));
      if (present.has('none')) groups.push({key: 'none', label: noneLabel, colour: OTHER, members: ['none']});
      return {mode, groups, keyOf: (line, page) => keyOfPage(page) ?? 'none'};
    };
    if (mode === 'section') return byPage(p => p.section, Object.keys(manuscript.section_names), k => manuscript.section_names[k], k => SECTION_COLOURS[k], 'No section');
    if (mode === 'regime' || mode === 'regimeSplit') {
      const keys = manuscript.regimes.map(r => r.key), colours = opts.regimeColours || [];
      const label = k => manuscript.regimes[keys.indexOf(k)].label, colour = k => colours[keys.indexOf(k)];
      if (mode === 'regime') return byPage(p => p.regime, keys, label, colour, 'No regime');
      // late A + pharma split by illustration: pharmaceutical pages are Pharma, the rest late Herbal A
      const JOINT = 'lateAP', names = {lateA: 'late Herbal A', pharma: 'Pharma'}, own = {lateA: LATE_A_COLOUR, pharma: colour(JOINT)};
      return byPage(p => p.regime === JOINT ? (p.section === 'P' ? 'pharma' : 'lateA') : p.regime,
        keys.flatMap(k => k === JOINT ? ['lateA', 'pharma'] : [k]), k => names[k] || label(k), k => own[k] || colour(k), 'No regime');
    }
    if (mode === 'rz') return byPage(p => rzClass(p.rz), Object.keys(RZ_COLOURS), k => RZ_LABELS[k], k => RZ_COLOURS[k], 'No RZ code');
    if (mode === 'currier') return byPage(p => p.lang || null, ['A', 'B'], k => 'Currier ' + k, k => CURRIER_COLOURS[k], 'Not classified');
    if (mode === 'hand') {
      const lineHand = manuscript.line_hands || {}, hands = [...new Set(pages.flatMap(p => p.hands))].sort();
      const keyOf = (line, page) => page.hands.length === 1 ? page.hands[0] : lineHand[line.folio + '|' + line.locus];
      return {mode, groups: hands.map(h => ({key: h, label: 'Hand ' + h, colour: HAND_COLOURS[h] || OTHER, members: [h]})), keyOf};
    }
    if (mode !== 'comparison') throw new Error('Unknown page grouping: ' + mode);
    const A = opts.search, B = opts.compare, label = opts.label || (k => k), colour = opts.populationColours || {};
    const same = A === B;
    const keyOf = line => { const a = line.sections.includes(A), b = !same && line.sections.includes(B); return a && b ? 'both' : a ? 'A' : b ? 'B' : 'other'; };
    // Rows are whole populations (the overlap counts in both), so they match the counts above the chart.
    const groups = [{key: 'A', label: label(A), colour: colour[A] || '--secA', members: same ? ['A'] : ['A', 'both'], role: 'search'}];
    if (!same) groups.push({key: 'B', label: label(B), colour: colour[B] || '--secB', members: ['B', 'both'], role: 'comparison'});
    groups.push({key: 'other', label: 'Rest of manuscript', colour: OTHER, members: ['other']});
    const both = !same ? {key: 'both', label: `${label(A)} and ${label(B)}`, colours: [colour[A] || '--secA', colour[B] || '--secB']} : null;
    return {mode, groups, both, keyOf};
  }

  // Units and their readable words, text lines and matches per group. 'page': one unit per page. 'paragraph': the
  // paragraph lines of each page in locus order, a new unit at every paragraph-initial line, and one more unit per
  // page for all its other loci in scope (labels, circles, radii). 'quire': one unit per quire, in the order of its
  // first page; its `page` lists the quire's pages. A line's group always comes from its own page, so a quire whose
  // pages fall in different groups is split between them. `matches` are occurrences from the search engine.
  function unitModel(pages, lines, matches, group, unit = 'page') {
    if (!['page', 'paragraph', 'quire'].includes(unit)) throw new Error('Unknown unit: ' + unit);
    const pageAt = new Map(pages.map((p, i) => [p.folio, i])), byPage = new Map(), rows = [], rowOf = new Map(), quires = new Map();
    const id = l => l.folio + '|' + l.locus;
    const make = (page, index, kind, n) => ({page, index, kind, n, tokens: {}, lines: {}, matches: {}, totalTokens: 0, totalLines: 0, totalMatches: 0});
    for (const l of lines) {
      if (!pageAt.has(l.folio)) throw new Error('Line on unknown page ' + l.folio);
      if (!byPage.has(l.folio)) byPage.set(l.folio, []); byPage.get(l.folio).push(l);
    }
    const locus = l => { const n = parseFloat(l.locus); return Number.isFinite(n) ? n : Infinity; };
    pages.forEach((p, i) => {
      const own = byPage.get(p.folio) || [];
      if (unit === 'page') { const r = make(p, i, 'page', 0); rows.push(r); own.forEach(l => rowOf.set(id(l), r)); return; }
      if (unit === 'quire') {
        let r = quires.get(p.quire);
        if (!r) { r = make({folio: p.folio, quire: p.quire, pages: []}, i, 'quire', quireNumber(p.quire)); quires.set(p.quire, r); rows.push(r); }
        r.page.pages.push(p); r.page.last = p.folio; own.forEach(l => rowOf.set(id(l), r)); return;
      }
      const ordered = own.map((l, k) => [l, k]).sort((a, b) => locus(a[0]) - locus(b[0]) || a[1] - b[1]).map(x => x[0]);
      let para = null, n = 0, other = null;
      for (const l of ordered) {
        if (category(l) === 'para') { if (!para || l.first) { para = make(p, i, 'para', ++n); rows.push(para); } rowOf.set(id(l), para); }
        else { if (!other) other = make(p, i, 'other', 0); rowOf.set(id(l), other); }
      }
      if (other) rows.push(other);
    });
    const add = (obj, k, v) => { obj[k] = (obj[k] || 0) + v; };
    const key = line => { const k = group.keyOf(line, pages[pageAt.get(line.folio)]); if (k == null) throw new Error(`No ${group.mode} group for ${line.folio}.${line.locus}`); return k; };
    for (const l of lines) {
      const row = rowOf.get(id(l)), n = readable(l); if (!n) continue;
      const k = key(l); add(row.tokens, k, n); add(row.lines, k, 1); row.totalTokens += n; row.totalLines++;
    }
    for (const o of matches) {
      const row = rowOf.get(id(o.line)); if (!row) throw new Error('Match on unknown page ' + o.line.folio);
      add(row.matches, key(o.line), 1); row.totalMatches++;
    }
    return rows;
  }
  const pageModel = (pages, lines, matches, group) => unitModel(pages, lines, matches, group, 'page');
  const unitName = (r, short = false) => r.kind === 'quire' ? 'Q' + r.n : r.kind === 'para' ?`${r.page.folio} ¶${r.n}` : r.kind === 'other' ? `${r.page.folio}${short ? ' other' : ' · other loci'}` : r.page.folio;

  // Display order of units: manuscript (pages in order, paragraphs within them) or bifolia together, sheets in order
  // of their first page.
  function rowOrder(rows, ordering = 'manuscript') {
    const idx = rows.map((r, i) => i);
    if (ordering === 'manuscript') return idx;
    if (ordering !== 'bifolium') throw new Error('Unknown page order: ' + ordering);
    const first = new Map(); rows.forEach(r => { if (!first.has(r.page.sheet) || r.index < first.get(r.page.sheet)) first.set(r.page.sheet, r.index); });
    return idx.sort((a, b) => first.get(rows[a].page.sheet) - first.get(rows[b].page.sheet) || rows[a].index - rows[b].index || a - b);
  }
  const pageOrder = (pages, ordering = 'manuscript') => rowOrder(pages.map((page, index) => ({page, index})), ordering);

  // Keys in stacking / legend order: groups, then the comparison overlap, then the rest.
  const drawKeys = group => [...group.groups.map(g => g.key).filter(k => k !== 'other'), ...(group.both ? ['both'] : []), ...(group.groups.some(g => g.key === 'other') ? ['other'] : [])];

  // Columns in one row. Combined: one column per unit with text in scope. Split: one facet per group, in legend
  // order; a unit appears in every group it has text in, showing only that group's part (f115r in two hands).
  function layoutColumns(rows, group, ordering = 'manuscript', layout = 'combined') {
    const order = rowOrder(rows, ordering).filter(i => rows[i].totalTokens > 0), keys = drawKeys(group);
    if (layout === 'combined') return {facets: [{key: null, label: '', start: 0, end: order.length}], columns: order.map(i => ({row: rows[i], keys, facet: 0}))};
    if (layout !== 'split') throw new Error('Unknown layout: ' + layout);
    const facets = [], columns = [];
    for (const g of group.groups) {
      const own = keys.filter(k => g.members.includes(k));
      const cols = order.filter(i => own.some(k => rows[i].tokens[k])).map(i => ({row: rows[i], keys: own, facet: facets.length}));
      if (!cols.length) continue;
      facets.push({key: g.key, label: g.label, colour: g.colour, start: columns.length, end: columns.length + cols.length});
      columns.push(...cols);
    }
    return {facets, columns};
  }
  const colTokens = c => sum(c.keys, c.row.tokens), colMatches = c => sum(c.keys, c.row.matches), colLines = c => sum(c.keys, c.row.lines);

  const median = xs => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  // A unit's value under the chosen measure: matches, matches per readable word (shown as a percentage), matches per
  // 10,000 readable words, or matches per text line.
  const measureOf = (measure, m, t, l) => measure === 'percent' ? (t ? m / t : 0) : measure === 'per10k' ? (t ? 1e4 * m / t : 0)
    : measure === 'perline' ? (l ? m / l : 0) : m;

  // One statistics row per group plus the whole manuscript. Rates are pooled (matches / words, matches / lines);
  // the median follows the measure (word rates for counts, per 10,000 words for that measure); the top unit follows
  // the measure.
  function statistics(rows, group, measure = 'count') {
    const totalMatches = rows.reduce((n, r) => n + r.totalMatches, 0);
    const summarize = (key, label, members) => {
      let units = 0, unitsWith = 0, matches = 0, tokens = 0, lines = 0, best = null; const rates = [], perLines = [];
      for (const r of rows) {
        const t = sum(members, r.tokens); if (!t) continue;
        const m = sum(members, r.matches), l = sum(members, r.lines);
        units++; tokens += t; matches += m; lines += l; if (m) unitsWith++; rates.push(m / t); perLines.push(l ? m / l : 0);
        const v = measureOf(measure, m, t, l);
        if (m && (!best || v > best.value)) best = {folio: r.page.folio, unit: unitName(r), value: v, matches: m, tokens: t, lines: l};
      }
      const med = median(measure === 'perline' ? perLines : rates);
      return {key, label, pages: units, pagesWith: unitsWith, matches, tokens, lines, rate: tokens ? matches / tokens : null,
        per10k: tokens ? 1e4 * matches / tokens : null, perLine: lines ? matches / lines : null,
        share: totalMatches ? matches / totalMatches : null, median: med != null && measure === 'per10k' ? 1e4 * med : med, best};
    };
    const out = group.groups.map(g => ({...summarize(g.key, g.label, g.members), colour: g.colour, members: g.members, role: g.role}));
    const all = [...new Set(group.groups.flatMap(g => g.members).concat(group.both ? ['both'] : []))];
    return {rows: out, total: summarize('total', 'Whole manuscript', all), totalMatches};
  }

  // Pearson's r of two equal-length samples; null below three pairs or when either sample is constant.
  function pearson(xs, ys) {
    const n = xs.length; if (n < 3) return null;
    const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
    return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
  }
  // Spearman's rho: Pearson's r of the ranks, ties sharing their average rank.
  const ranks = xs => {
    const order = xs.map((x, i) => i).sort((a, b) => xs[a] - xs[b]), out = new Array(xs.length);
    for (let i = 0; i < order.length;) { let j = i; while (j + 1 < order.length && xs[order[j + 1]] === xs[order[i]]) j++; for (let k = i; k <= j; k++) out[order[k]] = (i + j) / 2 + 1; i = j + 1; }
    return out;
  };
  const spearman = (xs, ys) => pearson(ranks(xs), ranks(ys));

  // For two patterns counted over the same units (rows and rowsC, in the same order): per group and over the whole
  // manuscript, the correlation of their unit values under the measure, across the units with text in the group
  // (each unit's own part there, as in the histograms).
  function correlations(rows, rowsC, group, measure = 'count') {
    const of = members => {
      const xs = [], ys = [];
      rows.forEach((r, i) => {
        const t = sum(members, r.tokens), l = sum(members, r.lines); if (!t) return;
        xs.push(measureOf(measure, sum(members, r.matches), t, l)); ys.push(measureOf(measure, sum(members, rowsC[i].matches), t, l));
      });
      return {n: xs.length, r: pearson(xs, ys), rho: spearman(xs, ys)};
    };
    const all = [...new Set(group.groups.flatMap(g => g.members).concat(group.both ? ['both'] : []))];
    return {groups: Object.fromEntries(group.groups.map(g => [g.key, of(g.members)])), total: of(all)};
  }

  // About `count` evenly spaced round ticks from 0, the last at or above max.
  function niceTicks(max, count = 4, integer = false) {
    if (!(max > 0)) return [0, 1];
    const raw = max / count, mag = 10 ** Math.floor(Math.log10(raw));
    let step = [1, 2, 2.5, 5, 10].map(f => f * mag).find(s => s >= raw);
    if (integer) step = Math.max(1, Math.ceil(step));
    const ticks = []; for (let v = 0; v < max + step * 1e-9; v += step) ticks.push(+v.toFixed(10));
    if (ticks[ticks.length - 1] < max) ticks.push(+(ticks[ticks.length - 1] + step).toFixed(10));
    return ticks;
  }

  // A round bin width at or above `raw` (1, 2, 2.5 or 5 times a power of ten); whole numbers for counts.
  const niceWidth = (raw, integer) => {
    if (!(raw > 0)) return 1;
    const mag = 10 ** Math.floor(Math.log10(raw)), w = [1, 2, 2.5, 5, 10].map(f => f * mag).find(x => x >= raw - 1e-12);
    return integer ? Math.max(1, Math.ceil(w)) : w;
  };
  const quantile = (sorted, q) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))] : 0;

  // Histograms of each group's unit values on bins shared by every group, so the panels compare. The bins follow the
  // units that have matches, not the largest value: their width comes from the Freedman–Diaconis rule (2 × IQR ×
  // n^-1/3; Sturges when the spread is zero) or from a requested number of bins; with `clip`, outliers share one
  // last bin (see below), so a few cannot squeeze the rest into one bar; units without a match
  // get their own bin unless `zeros` is false (their number is reported either way). Counts use whole-number bins.
  // With `compare` (the same units counted for a second pattern), each series also gets the comparison's counts,
  // and the bins follow both patterns' values.
  function histograms(rows, group, measure = 'count', opts = {}) {
    const {bins: want = 'auto', zeros = true, clip = true, compare = null} = opts;
    const integer = measure === 'count';
    const valuesOf = (units, g) => {
      const values = [];
      for (const r of units) { const t = sum(g.members, r.tokens); if (t) values.push(measureOf(measure, sum(g.members, r.matches), t, sum(g.members, r.lines))); }
      return values;
    };
    const series = group.groups.map(g => ({key: g.key, label: g.label, colour: g.colour, values: valuesOf(rows, g), valuesC: compare ? valuesOf(compare, g) : null}))
      .filter(s => s.values.length);
    const nz = series.flatMap(s => s.values.concat(s.valuesC || [])).filter(v => v > 0).sort((a, b) => a - b), max = nz.length ? nz[nz.length - 1] : 0;
    // Outliers: above the 95th percentile with 20 or more units with matches; with 5-19, beyond 3 IQR above the
    // upper quartile (Tukey's far-out fence); fewer than 5 are never split.
    let upper = max;
    if (clip && nz.length >= 20) { const q = quantile(nz, 0.95); if (q > 0 && q < max) upper = q; }
    else if (clip && nz.length >= 5) { const q3 = quantile(nz, 0.75), fence = q3 + 3 * (q3 - quantile(nz, 0.25)); if (fence > 0 && fence < max) upper = fence; }
    let width = 1;
    if (upper > 0) {
      const inRange = nz.filter(v => v <= upper), iqr = quantile(inRange, 0.75) - quantile(inRange, 0.25);
      const fd = 2 * iqr / Math.cbrt(Math.max(1, inRange.length));
      const k = want === 'auto' ? Math.min(48, Math.max(6, Math.round(fd > 0 ? upper / fd : Math.log2(Math.max(1, inRange.length)) + 1))) : Math.max(1, +want);
      width = niceWidth(upper / k, integer);
    }
    const bins = zeros ? [{lo: 0, hi: 0, exact: true}] : [];
    if (upper > 0) {
      if (integer && width === 1) for (let v = 1; v <= Math.round(upper); v++) bins.push({lo: v, hi: v, exact: true});
      else for (let lo = 0; lo < upper - 1e-12; lo = +(lo + width).toFixed(12)) bins.push({lo, hi: +(lo + width).toFixed(12)});
    }
    const regular = bins.filter(b => !(b.exact && b.lo === 0)), top = regular.length ? regular[regular.length - 1].hi : 0;
    if (max > top + 1e-12) bins.push({lo: top, hi: max, overflow: true});
    const binOf = v => {
      if (v === 0) return zeros ? 0 : -1;
      return bins.findIndex(b => b.overflow ? v > b.lo + 1e-12 : b.exact ? v === b.lo : v > b.lo + 1e-12 && v <= b.hi + 1e-12);
    };
    const tally = values => {
      const out = {counts: bins.map(() => 0), zeros: 0, median: median(values), n: values.length, matchedMedian: median(values.filter(v => v > 0))};
      for (const v of values) {
        if (v === 0) out.zeros++;
        const i = binOf(v); if (i === -1) continue;
        if (i < 0) throw new Error('Value outside the bins: ' + v);
        out.counts[i]++;
      }
      return out;
    };
    for (const s of series) {
      Object.assign(s, tally(s.values));
      if (s.valuesC) { const c = tally(s.valuesC); Object.assign(s, {countsC: c.counts, zerosC: c.zeros, medianC: c.median, matchedMedianC: c.matchedMedian}); }
    }
    return {bins, series, max, upper, width, top, zeros};
  }

  // x-axis labels: folio numbers (f1, f10, f20 ... restarting in each facet) or, in bifolium order, sheet names at
  // the first page of each sheet. Labels closer than their own width to the previous one are skipped.
  function axisLabels(columns, facets, ordering, xOf) {
    const out = [];
    for (const f of facets) {
      let next = null;
      for (let c = f.start; c < f.end; c++) {
        const p = columns[c].row.page;
        if (columns[c].row.kind === 'quire') { out.push({c, label: unitName(columns[c].row)}); continue; }
        if (ordering === 'bifolium') { if (c === f.start || p.sheet !== columns[c - 1].row.page.sheet) out.push({c, label: p.sheet}); continue; }
        const n = parseInt((p.folio.match(/^f(\d+)/) || [])[1], 10);
        if (c === f.start || n >= next) { out.push({c, label: 'f' + n}); next = n < 10 ? 10 : Math.floor(n / 10) * 10 + 10; }
      }
    }
    let last = -1e9;
    return out.filter(t => { const x = xOf(t.c), w = t.label.length * 5.6 + 8; if (x - last < w) return false; last = x; return true; });
  }

  // ------------------------------------------------------------------ drawing
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const num = n => Number(n).toLocaleString();
  const pctText = (x, digits) => x == null ? '—' : (100 * x).toFixed(digits ?? (100 * x >= 10 ? 1 : 2)) + '%';
  const lineText = x => x == null ? '—' : x.toFixed(x >= 1 ? 2 : 3);
  const per10kText = x => x == null ? '—' : !x ? '0' : x >= 100 ? num(Math.round(x)) : x.toFixed(x >= 10 ? 1 : 2);
  const plain = v => num(+v.toFixed(4));       // axis ticks and bin edges: round numbers, no trailing zeros
  const fill = c => `fill:var(${c})`;
  const MODE_NAMES = {section: 'section', regime: 'Golf regime', regimeSplit: 'Golf regime', rz: 'RZ language', currier: 'Currier language', hand: 'LFD hand', comparison: 'comparison'};
  const UNITS = {page: {one: 'page', many: 'pages'}, paragraph: {one: 'paragraph', many: 'paragraphs'}, quire: {one: 'quire', many: 'quires'}};
  const abbrev = (text, n = 28) => text.length > n ? text.slice(0, n - 1) + '…' : text;
  let observer = null;

  // `compare` ({matches, query}) draws a second pattern on the same chart: its bars hang below the axis, its
  // histograms below each panel's axis, and the table adds its value next to the measure shown.
  function mount(el, opts) {
    if (observer) { observer.disconnect(); observer = null; }
    const {pages, lines, matches, group, measure = 'count', ordering = 'manuscript', layout = 'combined', unit = 'page', highlight = {}, names = {}, binning = {},
      compare = null, query = ''} = opts;
    const rows = unitModel(pages, lines, matches, group, unit), stats = statistics(rows, group, measure);
    const rowsC = compare ? unitModel(pages, lines, compare.matches, group, unit) : null, statsC = compare ? statistics(rowsC, group, measure) : null;
    if (rowsC) rows.forEach((r, i) => { r.cmp = rowsC[i]; });          // same units in the same order, counted for the comparison
    const corr = rowsC ? correlations(rows, rowsC, group, measure) : null;
    const histogram = layout === 'histogram';
    const {facets, columns} = histogram ? {facets: [], columns: []} : layoutColumns(rows, group, ordering, layout);
    const hist = histogram ? histograms(rows, group, measure, {...binning, compare: rowsC}) : null, keys = drawKeys(group);
    const U = UNITS[unit];
    const above = abbrev(query || '(all)'), below = compare ? abbrev(compare.query || '(all)') : '';
    const colourOf = k => (group.groups.find(g => g.key === k) || {}).colour || OTHER;
    const keyFill = k => k === 'both' ? 'fill:url(#pc-both)' : fill(colourOf(k));
    const groupName = k => k === 'both' ? group.both.label : (group.groups.find(g => g.key === k) || {}).label;
    const per = c => measure === 'percent' ? colTokens(c) || 1 : measure === 'per10k' ? (colTokens(c) || 1) / 1e4
      : measure === 'perline' ? colLines(c) || 1 : 1;
    const value = (c, k) => (c.row.matches[k] || 0) / per(c), total = c => colMatches(c) / per(c);
    const valueC = (c, k) => (c.row.cmp.matches[k] || 0) / per(c), totalC = c => sum(c.keys, c.row.cmp.matches) / per(c);
    const fmtValue = v => measure === 'percent' ? pctText(v) : measure === 'per10k' ? per10kText(v) : measure === 'perline' ? lineText(v) : num(v);
    const measureName = measure === 'percent' ? `matches as a share of each ${U.one}'s words`
      : measure === 'per10k' ? `matches per 10,000 words of each ${U.one}`
      : measure === 'perline' ? `matches per text line of each ${U.one}` : `matches in each ${U.one}`;
    const litPage = p => (highlight.folio && p.folio === highlight.folio) || (highlight.sheet && p.sheet === highlight.sheet);
    const lit = p => p.pages ? p.pages.some(litPage) : litPage(p);       // a quire is marked when any of its pages is
    const dominant = c => c.keys.reduce((best, k) => (c.row.tokens[k] || 0) > (c.row.tokens[best] || 0) ? k : best, c.keys[0]);
    let pinned = null, xOf = () => 0, pitch = 1, histLayout = null;

    el.innerHTML = `<div class="pc-readout" aria-live="polite"></div><div class="pc-plot"></div>${table()}`;
    const plot = el.querySelector('.pc-plot'), readout = el.querySelector('.pc-readout');
    const render = () => (histogram ? drawHistograms() : draw());
    render();
    if (typeof ResizeObserver !== 'undefined') {
      let width = plot.clientWidth;
      observer = new ResizeObserver(() => { if (Math.abs(plot.clientWidth - width) > 4) { width = plot.clientWidth; render(); } });
      observer.observe(plot);
    }
    bindTable();
    say(null);
    return {rows, stats, statsC, columns, facets, hist};

    function draw() {
      // With a comparison, its bars hang below the axis on the same scale; each side is as tall as its own largest
      // column needs. Without one, the chart is unchanged: one side, 180 px.
      const W = Math.max(560, plot.clientWidth || 900), left = 46, right = 10, top = 18, plotH = compare ? 240 : 180, gap = facets.length > 1 ? 14 : 0;
      const x0 = left;
      pitch = (W - left - right - gap * (facets.length - 1)) / Math.max(1, columns.length);
      xOf = c => x0 + c * pitch + columns[c].facet * gap;
      const barW = Math.max(1, pitch - (pitch >= 3 ? 1 : 0));
      const maxS = Math.max(0, ...columns.map(total)), maxC = compare ? Math.max(0, ...columns.map(totalC)) : 0;
      const ticks = niceTicks(Math.max(maxS, maxC), 4, measure === 'count'), step = ticks[1] - ticks[0];
      const upS = compare ? Math.max(step, Math.ceil(maxS / step - 1e-9) * step) : ticks[ticks.length - 1] || 1;
      const upC = compare ? Math.max(step, Math.ceil(maxC / step - 1e-9) * step) : 0;
      const sc = plotH / (upS + upC), base = top + sc * upS, bottom = base + sc * upC, H = bottom + 74;
      const y = v => base - sc * v, yC = v => base + sc * v;
      const order = ordering === 'bifolium' ? 'bifolia together' : unit === 'quire' ? 'in quire order' : 'in page order';
      let svg = `<svg class="pc-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`Bars: ${measureName}${compare ? `, ${above} above the axis and ${below} below it` : ''}, ${order}${layout === 'split' ? ', split by ' : ', colored by '}${MODE_NAMES[group.mode] || group.mode}. The table below gives the totals by group.`)}">`;
      if (group.both) svg += `<defs><pattern id="pc-both" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="4" style="${fill(group.both.colours[0])}"/><rect x="2" width="2" height="4" style="${fill(group.both.colours[1])}"/></pattern></defs>`;
      // location filters are shown, not applied: marked above the plot and under the band (a column would read as a bar)
      columns.forEach((c, i) => { if (lit(c.row.page)) svg += `<rect class="pc-lit" x="${xOf(i)}" y="${top - 9}" width="${Math.max(pitch, 2)}" height="5"/><rect class="pc-lit" x="${xOf(i)}" y="${bottom + 12}" width="${Math.max(pitch, 2)}" height="3"/>`; });
      svg += `<line class="pc-hover" x1="-10" x2="-10" y1="${top}" y2="${bottom + 10}"/>`;
      const decimals = (String(+(100 * step).toFixed(10)).split('.')[1] || '').length;
      const tick = t => measure === 'percent' ? (100 * t).toFixed(decimals) + '%' : measure === 'perline' ? String(+t.toFixed(4)) : measure === 'per10k' ? plain(t) : num(t);
      const steps = up => Array.from({length: Math.round(up / step) + 1}, (_, i) => +(i * step).toFixed(10));
      const grid = (t, yy) => `<line class="pc-grid" x1="${x0}" x2="${W - right}" y1="${yy}" y2="${yy}"/><text class="pc-ytick" x="${x0 - 6}" y="${yy + 3.5}" text-anchor="end">${tick(t)}</text>`;
      steps(upS).forEach(t => { svg += grid(t, y(t)); });
      if (compare) steps(upC).slice(1).forEach(t => { svg += grid(t, yC(t)); });
      for (let f = 1; f < facets.length; f++) { const x = xOf(facets[f].start) - gap / 2; svg += `<line class="pc-sep" x1="${x}" x2="${x}" y1="${top}" y2="${bottom + 30}"/>`; }
      // bars: one stack per column, groups in legend order; the comparison's stack hangs from the axis
      columns.forEach((c, i) => {
        const x = xOf(i) + (pitch - barW) / 2;
        let acc = 0;
        for (const k of c.keys) {
          const v = value(c, k); if (!v) continue;
          const y1 = y(acc + v), h = y(acc) - y1; acc += v;
          svg += `<rect class="pc-bar" data-k="${k}" x="${x.toFixed(2)}" y="${y1.toFixed(2)}" width="${barW.toFixed(2)}" height="${Math.max(h, 0.8).toFixed(2)}" style="${keyFill(k)}"/>`;
        }
        if (!compare) return;
        acc = 0;
        for (const k of c.keys) {
          const v = valueC(c, k); if (!v) continue;
          const y1 = yC(acc), h = yC(acc + v) - y1; acc += v;
          svg += `<rect class="pc-bar pc-cmp" data-k="${k}" x="${x.toFixed(2)}" y="${y1.toFixed(2)}" width="${barW.toFixed(2)}" height="${Math.max(h, 0.8).toFixed(2)}" style="${keyFill(k)}"/>`;
        }
      });
      facets.forEach(f => { svg += `<line class="pc-axis" x1="${xOf(f.start)}" x2="${xOf(f.end - 1) + pitch}" y1="${base}" y2="${base}"/>`; });
      if (compare) svg += `<text class="pc-tag" x="${x0 + 4}" y="${top + 9}">▲ ${esc(above)}</text><text class="pc-tag" x="${x0 + 4}" y="${bottom - 4}">▼ ${esc(below)}</text>`;
      // group band: every column's group, so units without matches still show where they belong; in bifolium
      // order a hairline gap separates sheets
      columns.forEach((c, i) => {
        const tot = colTokens(c), cut = ordering === 'bifolium' && i + 1 < columns.length && columns[i + 1].facet === c.facet && columns[i + 1].row.page.sheet !== c.row.page.sheet ? 1.2 : 0;
        let off = 0; const parts = c.keys.filter(k => c.row.tokens[k]);
        parts.forEach((k, j) => { const w = (pitch - cut) * c.row.tokens[k] / tot;
          svg += `<rect class="pc-band" data-k="${k}" x="${(xOf(i) + off).toFixed(2)}" y="${bottom + 3}" width="${(w + (j === parts.length - 1 && !cut ? 0.4 : 0)).toFixed(2)}" height="7" style="${keyFill(k)}"/>`; off += w; });
      });
      // names under the band: facet names when split, runs of one group when combined
      const label = (x1, x2, text) => {
        const width = x2 - x1, room = Math.floor((width - 6) / 5.6);
        if (!text || room < 3) return '';
        const t = text.length <= room ? text : text.slice(0, room - 1) + '…';
        return `<text class="pc-run" x="${(x1 + x2) / 2}" y="${bottom + 22}" text-anchor="middle">${esc(t)}</text>`;
      };
      if (layout === 'split') facets.forEach(f => { svg += label(xOf(f.start), xOf(f.end - 1) + pitch, f.label); });
      else {
        let start = 0;
        for (let i = 1; i <= columns.length; i++) {
          if (i < columns.length && dominant(columns[i]) === dominant(columns[start])) continue;
          const text = groupName(dominant(columns[start])) || '';
          if (text && (i - start) * pitch >= Math.max(40, text.length * 5.6 + 8)) svg += label(xOf(start), xOf(i - 1) + pitch, text);
          start = i;
        }
      }
      axisLabels(columns, facets, ordering, xOf).forEach(t => { const x = xOf(t.c); svg += `<line class="pc-tick" x1="${x}" x2="${x}" y1="${bottom + 26}" y2="${bottom + 31}"/><text class="pc-xtick" x="${x}" y="${bottom + 41}" text-anchor="start">${esc(t.label)}</text>`; });
      svg += `<text class="pc-ytick" x="${x0}" y="${H - 4}">Bar height: ${measureName}${compare ? `; ${esc(above)} above the axis, ${esc(below)} below` : ''} · ${ordering === 'bifolium' ? 'bifolia together, in order of their first page' : unit === 'quire' ? 'quire order' : 'page order'} →</text>`;
      columns.forEach((c, i) => { svg += `<rect class="pc-hit" data-i="${i}" x="${xOf(i)}" y="${top}" width="${pitch}" height="${bottom - top + 12}"/>`; });
      plot.innerHTML = svg + '</svg>';
      const hover = plot.querySelector('.pc-hover');
      const show = i => { const x = i == null ? -10 : xOf(i) + pitch / 2; hover.setAttribute('x1', x); hover.setAttribute('x2', x); say(i); };
      plot.querySelectorAll('.pc-hit').forEach(h => {
        h.onmouseenter = () => show(+h.dataset.i);
        h.onmouseleave = () => show(pinned);
        h.onclick = () => { pinned = pinned === +h.dataset.i ? null : +h.dataset.i; show(pinned); };
      });
      if (pinned != null) show(pinned);
    }

    // Small multiples, one per group, on shared bins; each panel has its own vertical scale and marks its median.
    function drawHistograms() {
      // Panels per row follow the width, but a change under 40 px (a scrollbar) keeps the last choice, so the panel
      // height cannot feed back into the width and make the layout oscillate.
      const W = Math.max(320, plot.clientWidth || 900), n = hist.series.length;
      if (!histLayout || Math.abs(W - histLayout.W) >= 40) histLayout = {W, cols: Math.max(1, Math.min(n, W >= 980 ? 3 : W >= 620 ? 2 : 1))};
      // with a comparison, each panel mirrors it below the axis on the same bins and the same vertical scale
      // (its medians and no-match counts take a second title line)
      const cols = histLayout.cols, gapX = 22, panelW = (W - gapX * (cols - 1)) / cols, plotH = compare ? 64 : 92, head = compare ? 34 : 22;
      const panelH = 36 + head + (compare ? 2 : 1) * plotH, left = 30;
      const rowsN = Math.max(1, Math.ceil(n / cols)), H = rowsN * (panelH + 14), nb = hist.bins.length;
      const edge = v => measure === 'percent' ? pctText(v) : measure === 'perline' ? lineText(v) : measure === 'per10k' ? plain(v) : num(v);
      const tickOf = b => b.overflow ? '>' + edge(b.lo) : b.exact ? (b.lo === 0 && measure !== 'count' ? '0' : edge(b.lo)) : edge(b.hi);
      const rangeOf = b => b.overflow ? `above ${edge(b.lo)} (the top values)` : b.exact ? (b.lo === 0 ? 'without a match' : `with ${num(b.lo)} ${b.lo === 1 ? 'match' : 'matches'}`)
        : measure === 'count' ? `with ${num(b.lo + 1)}–${num(b.hi)} matches` : `at ${edge(b.lo)}–${edge(b.hi)}`;
      let svg = `<svg class="pc-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`Histograms, one per ${MODE_NAMES[group.mode] || group.mode} group: how many ${U.many} have each value of ${measureName}${compare ? `, ${above} above each axis and ${below} below it` : ''}. The table below gives the totals by group.`)}">`;
      const binOf = v => v == null ? -1 : hist.bins.findIndex(b => b.overflow ? v > b.lo + 1e-12 : b.exact ? v === b.lo : v > b.lo + 1e-12 && v <= b.hi + 1e-12);
      hist.series.forEach((s, si) => {
        const px = (si % cols) * (panelW + gapX), py = Math.floor(si / cols) * (panelH + 14), x0 = px + left, w = panelW - left - 6, base = py + head + plotH;
        const lowest = base + (compare ? plotH : 0);
        // with no-match units hidden, the median shown (and marked) is that of the units drawn
        const med = hist.zeros ? s.median : s.matchedMedian, medC = compare ? (hist.zeros ? s.medianC : s.matchedMedianC) : null;
        const show = v => v == null ? '—' : esc(fmtValue(v)), drawn = hist.zeros ? '' : ' with a match';
        const title = `<tspan style="${fill(s.colour)}">■</tspan> ${esc(s.label)} · ${num(s.n)} ${s.n === 1 ? U.one : U.many}`;
        if (compare) svg += `<text class="pc-run" x="${px}" y="${py + 12}">${title}</text><text class="pc-ytick" x="${px}" y="${py + 25}">median ${show(med)} ▲ · ${show(medC)} ▼${drawn}${s.zeros || s.zerosC ? ` · without a match ${num(s.zeros)} ▲ · ${num(s.zerosC)} ▼` : ''}</text>`;
        else svg += `<text class="pc-run" x="${px}" y="${py + 12}" text-anchor="start">${title}${s.zeros ? ` · ${num(s.zeros)} without a match` : ''}${med == null ? '' : ` · median ${show(med)}${drawn}`}</text>`;
        if (!nb || !s.counts.some(Boolean) && !(compare && s.countsC.some(Boolean))) { svg += `<text class="pc-ytick" x="${x0}" y="${py + head + plotH / 2}">No ${U.many} with a match</text>`; return; }
        // the overflow bin sits apart from the regular bins
        const gap = hist.bins[nb - 1].overflow ? Math.min(10, w / (nb + 2)) : 0, bw = (w - gap) / nb, xb = b => x0 + b * bw + (hist.bins[b].overflow ? gap : 0);
        const ymax = Math.max(1, ...s.counts, ...(compare ? s.countsC : [])), yt = niceTicks(ymax, 2, true), topv = yt[yt.length - 1];
        const y = v => base - plotH * v / topv, yC = v => base + plotH * v / topv;
        const grid = (t, yy) => `<line class="pc-grid" x1="${x0}" x2="${x0 + w}" y1="${yy}" y2="${yy}"/><text class="pc-ytick" x="${x0 - 4}" y="${yy + 3.5}" text-anchor="end">${num(t)}</text>`;
        yt.forEach(t => { svg += grid(t, y(t)); });
        if (compare) yt.slice(1).forEach(t => { svg += grid(t, yC(t)); });
        const barAt = (b, c, cmp) => `<rect class="pc-bar${hist.bins[b].overflow ? ' pc-over' : ''}${cmp ? ' pc-cmp' : ''}" data-k="${esc(s.key)}" x="${(xb(b) + 0.5).toFixed(2)}" y="${(cmp ? base : y(c)).toFixed(2)}" width="${Math.max(1, bw - 1).toFixed(2)}" height="${(cmp ? yC(c) - base : base - y(c)).toFixed(2)}" style="${fill(s.colour)}"/>`;
        s.counts.forEach((c, b) => {
          if (c) svg += barAt(b, c, false);
          if (compare && s.countsC[b]) svg += barAt(b, s.countsC[b], true);
          svg += `<rect class="pc-hit" data-s="${si}" data-b="${b}" x="${xb(b).toFixed(2)}" y="${py + head}" width="${bw.toFixed(2)}" height="${lowest - py - head}"/>`;
        });
        const mb = binOf(med), mbC = binOf(medC);
        if (mb >= 0) svg += `<line class="pc-median" x1="${xb(mb) + bw / 2}" x2="${xb(mb) + bw / 2}" y1="${py + head - 4}" y2="${base}"/>`;
        if (mbC >= 0) svg += `<line class="pc-median" x1="${xb(mbC) + bw / 2}" x2="${xb(mbC) + bw / 2}" y1="${base}" y2="${lowest + 4}"/>`;
        svg += `<line class="pc-axis" x1="${x0}" x2="${x0 + w}" y1="${base}" y2="${base}"/>`;
        const step = Math.max(1, Math.ceil(nb / Math.max(2, Math.floor(w / 56))));
        hist.bins.forEach((b, i) => { if (i % step === 0 || i === nb - 1 || b.overflow) svg += `<text class="pc-xtick" x="${xb(i) + bw / 2}" y="${lowest + 13}" text-anchor="middle">${esc(tickOf(b))}</text>`; });
      });
      plot.innerHTML = svg + '</svg>';
      plot.querySelectorAll('.pc-hit').forEach(h => {
        const s = hist.series[+h.dataset.s], b = hist.bins[+h.dataset.b], c = s.counts[+h.dataset.b];
        const counted = compare ? `▲ ${num(c)} · ▼ ${num(s.countsC[+h.dataset.b])} ${U.many}` : `${num(c)} ${c === 1 ? U.one : U.many}`;
        h.onmouseenter = () => { readout.innerHTML = `<b>${esc(s.label)}</b>: ${counted} ${esc(rangeOf(b))} <span class="muted">of ${num(s.n)}</span>`; };
        h.onmouseleave = () => say(null);
      });
    }

    function say(i) {
      el.querySelectorAll('.pc-table tr.on').forEach(tr => tr.classList.remove('on'));
      if (i == null) { readout.innerHTML = `<span class="muted">${histogram ? 'Hover a bar to show how many ' + U.many + ' fall in it.' : `Hover a ${U.one} to show its counts; click to pin them.`}</span>`; return; }
      const c = columns[i], r = c.row, p = r.page, hands = (p.hands || []).filter(Boolean), m = colMatches(c), t = colTokens(c), l = colLines(c);
      const parts = c.keys.filter(k => r.tokens[k]).map(k => ({k, m: r.matches[k] || 0, t: r.tokens[k]}));
      const split = parts.length > 1 ? ` · ${parts.map(x => `${esc(groupName(x.k))} ${num(x.m)} of ${num(x.t)}`).join(' · ')}` : '';
      const part = t !== r.totalTokens ? `${esc(facets[c.facet].label || '')} part: ` : '', whole = t !== r.totalTokens ? `; whole ${U.one}: ${num(r.totalMatches)} in ${num(r.totalTokens)}` : '';
      const meta = r.kind === 'quire' ? [`quire ${p.quire}`, `${p.pages[0].folio}–${p.last}`, `${p.pages.length} pages`]
        : [(names.section || {})[p.section] || p.section, p.regime ? ((names.regime || {})[p.regime] || p.regime) + ' regime' : 'no regime',
          p.rz ? 'RZ ' + p.rz : '', p.lang ? 'Currier ' + p.lang : 'no Currier language', hands.length ? 'hand ' + hands.join(', ') : '', 'sheet ' + p.sheet].filter(Boolean);
      const rate = x => measure === 'per10k' ? per10kText(t ? 1e4 * x / t : 0) + ' per 10k words' : pctText(t ? x / t : 0);
      const where = `in ${num(t)} words and ${num(l)} ${l === 1 ? 'line' : 'lines'}`;
      const mC = compare ? sum(c.keys, r.cmp.matches) : 0;
      const counts = compare ? `▲ <b>${num(m)}</b> · ▼ <b>${num(mC)}</b> matches ${where} · ▲ <b>${rate(m)}</b> · ▼ <b>${rate(mC)}</b> · ${lineText(l ? m / l : 0)} / ${lineText(l ? mC / l : 0)} per line`
        : `<b>${num(m)}</b> ${m === 1 ? 'match' : 'matches'} ${where} · <b>${rate(m)}</b> · ${lineText(l ? m / l : 0)} per line`;
      readout.innerHTML = `<b class="mono">${esc(unitName(r))}</b> <span class="muted">${meta.map(esc).join(' · ')}</span>
        <span class="pc-val">${part}${counts}${whole}${split}</span>${pinned === i ? ' <span class="pc-pin">pinned</span>' : ''}`;
      for (const k of c.keys.filter(k => r.tokens[k])) group.groups.forEach(g => { if (g.members.includes(k)) el.querySelector(`.pc-table tr[data-g="${CSS.escape(g.key)}"]`)?.classList.add('on'); });
    }

    function table() {
      const main = s => measure === 'percent' ? s.rate || 0 : measure === 'per10k' ? s.per10k || 0 : measure === 'perline' ? s.perLine || 0 : s.matches;
      const max = Math.max(1e-12, ...stats.rows.map(main), ...(statsC ? statsC.rows.map(main) : []));
      const swatch = s => `<i class="pc-sw" style="background:var(${s.colour})"></i>`;
      const best = s => !s.best ? '—' : `${esc(s.best.unit)} <span class="muted">${fmtValue(s.best.value)}</span>`;
      const bar = (s, cmp) => `<span class="pc-ib${cmp ? ' pc-cmp' : ''}"><i style="width:${(100 * main(s) / max).toFixed(1)}%;background:var(${s.colour})"></i></span>`;
      const shown = {count: s => num(s.matches), percent: s => pctText(s.rate), per10k: s => per10kText(s.per10k), perline: s => lineText(s.perLine)};
      // Every number in a measure column sits in a box as wide as the column's longest value, so the bars before them
      // start at one margin however many digits a row has.
      const everyRow = [...stats.rows, stats.total, ...(statsC ? [...statsC.rows, statsC.total] : [])];
      const width = Object.fromEntries(Object.keys(shown).map(m => [m, 1 + Math.max(...everyRow.map(s => shown[m](s).length))]));
      const value = (m, s) => `<span class="pc-num" style="min-width:${width[m]}ch">${shown[m](s)}</span>`;
      // the two patterns' correlation over the group's units (Spearman's rho and n in the tooltip)
      const fixed = (x, d) => (x < 0 ? '−' : '') + Math.abs(x).toFixed(d);
      const corrCell = s => {
        const c = s.key === 'total' ? corr.total : corr.groups[s.key];
        const tip = c.r == null ? `Needs at least three ${U.many} and variation in both patterns` : `Pearson r ${fixed(c.r, 3)} · Spearman ρ ${c.rho == null ? '—' : fixed(c.rho, 3)} · ${num(c.n)} ${c.n === 1 ? U.one : U.many}`;
        return `<td class="pc-r" title="${tip}">${c.r == null ? '—' : fixed(c.r, 2)}</td>`;
      };
      // each measure's column; with a comparison, the measure shown gets a second column for it, on the same bar
      // scale, and then the correlation column
      const cell = (m, s, sC) => `<td class="pc-m">${measure === m && s.colour ? bar(s) : ''}${value(m, s)}</td>`
        + (sC && measure === m ? `<td class="pc-m">${sC.colour ? bar(sC, true) : ''}${value(m, sC)}</td>${corrCell(s)}` : '');
      const row = (s, sC, cls = '') => `<tr class="${cls}" data-g="${esc(s.key)}"><td class="pc-name">${s.colour ? swatch(s) : ''}${esc(s.label)}</td>
        <td>${num(s.pagesWith)} <span class="muted">of ${num(s.pages)}</span></td>
        ${cell('count', s, sC)}<td>${s.share == null ? '—' : pctText(s.share, 1)}</td><td>${num(s.tokens)}</td><td>${num(s.lines)}</td>
        ${cell('percent', s, sC)}${cell('per10k', s, sC)}${cell('perline', s, sC)}
        <td>${s.median == null ? '—' : measure === 'perline' ? lineText(s.median) : measure === 'per10k' ? per10kText(s.median) : pctText(s.median)}</td><td>${best(s)}</td></tr>`;
      const head = (m, label, title) => statsC && measure === m
        ? `<th title="${esc(title + ': ' + (query || '(all)'))}">▲ ${label}</th><th title="${esc(title + ': ' + (compare.query || '(all)'))}">▼ ${label}</th>`
          + `<th title="Pearson's r of ▲ and ▼, ${U.one} by ${U.one}, in the measure shown; hover a value for Spearman's ρ">Correlation</th>`
        : `<th title="${title}">${label}</th>`;
      const overlap = group.both && rows.some(r => r.tokens.both);
      const Unit = U.one[0].toUpperCase() + U.one.slice(1);
      // a quire whose pages fall in different groups counts in each of them, with only its own pages there
      const split = unit === 'quire' ? rows.filter(r => group.groups.filter(g => g.members.some(k => r.tokens[k])).length > 1).map(r => unitName(r)) : [];
      return `<div class="wb-scroll pc-tablewrap"><table class="wb-table pc-table"><thead><tr><th>Group</th><th title="${Unit}s with at least one match, of the group's ${U.many}">${Unit}s with matches</th>${head('count', 'Matches', 'Matches')}<th title="This group's share of all matches in the manuscript">Share</th><th title="Readable words in the selected loci (unreadable tokens excluded)">Words</th><th title="Text lines with at least one readable word">Lines</th>${head('percent', 'Per word', 'Matches ÷ words, pooled over the group')}${head('per10k', 'Per 10k words', 'Matches per 10,000 words, pooled over the group')}${head('perline', 'Per line', 'Matches ÷ lines, pooled over the group')}<th title="Median of the group's ${U.one} rates${measure === 'perline' ? ' per line' : measure === 'per10k' ? ' per 10,000 words' : ' per word'}">Median ${U.one}</th><th title="${Unit} with the highest value of the chosen measure">Top ${U.one}</th></tr></thead>
        <tbody>${stats.rows.map((s, i) => row(s, statsC && statsC.rows[i])).join('')}${row({...stats.total, colour: null}, statsC && {...statsC.total, colour: null}, 'pc-total')}</tbody></table></div>
        ${compare ? `<p class="wb-small">▲ ${esc(above)} · ▼ ${esc(below)}. Correlation pairs the two ${U.one} by ${U.one} within each group; the other columns count ▲ only.</p>` : ''}
        ${split.length ? `<p class="wb-small">Split between groups: ${esc(split.join(', '))}. Each group counts only its own pages of these quires.</p>` : ''}
        ${overlap ? `<p class="wb-small">Striped ${U.many} belong to both populations and count in both rows.</p>` : ''}`;
    }

    function bindTable() {
      el.querySelectorAll('.pc-table tbody tr[data-g]').forEach(tr => {
        const g = group.groups.find(x => x.key === tr.dataset.g); if (!g) return;
        tr.onmouseenter = () => { plot.classList.add('pc-focus'); plot.querySelectorAll('.pc-bar, .pc-band').forEach(b => b.classList.toggle('on', g.members.includes(b.dataset.k))); };
        tr.onmouseleave = () => { plot.classList.remove('pc-focus'); };
      });
    }
  }

  const api = {SECTION_COLOURS, RZ_COLOURS, RZ_LABELS, CURRIER_COLOURS, HAND_COLOURS, OTHER, rzClass, category, grouping, unitModel, pageModel, unitName,
    rowOrder, pageOrder, layoutColumns, axisLabels, statistics, histograms, niceWidth, measureOf, niceTicks, pearson, spearman, correlations, mount};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EchoPageChart = api;
})(typeof window !== 'undefined' ? window : globalThis);
