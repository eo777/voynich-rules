/* Variants: a site in a word where a scheduled operation acts, the environment that makes a word eligible, the variant
 * the word shows at the site, and the family (the word with the site neutralised). The share of the innovative variant
 * among eligible tokens follows a change along the chain for any frequency class without conserving any mass: a hapax
 * counts because it is eligible and shows one variant or the other. Port of the regularity study's variables.py
 * (solve/botanical_enrichment/echo_section_connections, 13 October 2026); test/variants_flow.test.js reproduces its
 * counts. Pure: no DOM. Columns come from chain_flow.columns (Golf 2.1 groups with the middle text).
 */
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const CF = node ? require('./chain_flow.js') : root.EchoChainFlow;
  const ORD = new Set(['k', 't']), PF = new Set(['p', 'f']), ATOM = new Set(['ckh', 'cth', 'cph', 'cfh']), BENCH = new Set(['ch', 'sh']);
  const ERUN = new Set(['e', 'ee', 'eee', 'eeee']);
  const GALL = new Set([...ORD, ...PF, ...ATOM]);
  const DY_PRE = new Set(['e', 'ee', 'eee', 'ch', 'sh', 'o', 'a']);
  const gclass = u => (ORD.has(u) ? 'ordinary' : PF.has(u) ? 'pf' : ATOM.has(u) ? 'atomic' : null);
  const join = U => U.join(' ');
  const WINDOW = 3;

  // Every function takes the unit list of a spelling (q kept) and returns {sub, variant, family, site} or null; site is
  // the unit range [from, to) that carries the variant, for display.
  function dy(U) {
    const n = U.length; if (n < 2 || U[n - 1] !== 'y') return null;
    if (U[n - 2] === 'd') {
      if (n < 3 || !DY_PRE.has(U[n - 3])) return null;
      return {sub: U[n - 3], variant: 'dy', family: join(U.slice(0, n - 2)), site: [n - 2, n]};
    }
    if (!DY_PRE.has(U[n - 2])) return null;
    return {sub: U[n - 2], variant: 'y', family: join(U.slice(0, n - 1)), site: [n - 1, n]};
  }
  function gey(U) {
    const n = U.length; if (n < 2 || U[n - 1] !== 'y') return null;
    let i = n - 2, erun = null; if (ERUN.has(U[i])) { erun = U[i]; i--; }
    if (i < 0 || !GALL.has(U[i])) return null;
    const variant = erun === null ? 'y' : erun === 'e' ? 'ey' : 'eey';
    return {sub: gclass(U[i]), variant, family: join(U.slice(0, i + 1)), site: erun === null ? [n - 1, n] : [i + 1, i + 2]};
  }
  const afterO = (set, kind) => U => {
    for (let i = 0; i < U.length; i++) if (set.has(U[i])) {
      let j = i + 1, erun = null; if (j < U.length && ERUN.has(U[j])) { erun = U[j]; j++; }
      if (j < U.length && U[j] === 'o') {
        const variant = erun === null ? 'o' : erun === 'e' ? 'eo' : 'eeo', nxt = j + 1 < U.length ? U[j + 1] : '$';
        return {sub: kind === 'gallows' ? gclass(U[i]) + '|' + nxt : nxt, variant, family: join(U.slice(0, i + 1)) + ' _ ' + join(U.slice(j + 1)), site: erun === null ? [j, j + 1] : [i + 1, j]};
      }
      return null;
    }
    return null;
  };
  const geo = afterO(GALL, 'gallows'), cheo = afterO(BENCH, 'bench');
  function kt(U) {
    const g = []; for (let i = 0; i < U.length; i++) if (ORD.has(U[i])) g.push(i);
    if (g.length !== 1 || U.some(u => PF.has(u) || ATOM.has(u))) return null;
    const i = g[0], nxt = i + 1 < U.length ? U[i + 1] : '$';
    return {sub: nxt, variant: U[i], family: join(U.slice(0, i)) + ' G ' + join(U.slice(i + 1)), site: [i, i + 1]};
  }
  function oa(U) {
    const n = U.length; if (n < 2 || !(U[n - 1] === 'l' || U[n - 1] === 'r') || !(U[n - 2] === 'o' || U[n - 2] === 'a')) return null;
    const pre = n >= 3 ? U[n - 3] : '^';
    return {sub: pre + '|' + U[n - 1], variant: U[n - 2], family: join(U.slice(0, n - 2)) + ' V ' + U[n - 1], site: [n - 2, n - 1]};
  }
  function benchliq(U) {
    const n = U.length; if (n < 2 || !(U[n - 1] === 'l' || U[n - 1] === 'r') || U[n - 2] !== 'o') return null;
    let rest = U.slice(0, n - 2), erun = null;
    if (rest.length && ERUN.has(rest[rest.length - 1])) { erun = rest[rest.length - 1]; rest = rest.slice(0, -1); }
    if (rest.length > 1 || (rest.length && !BENCH.has(rest[0]))) return null;
    return {sub: (erun ? 'e' : 'plain') + '|' + U[n - 1], variant: rest.length ? 'bench' : 'none', family: (erun ? 'e ' : '') + 'o ' + U[n - 1], site: [0, 1]};
  }
  function d0(U) {
    if (!U.length) return null;
    if (U[0] === 'd' && U.length > 1 && U[1] === 'a') return {sub: U.length > 2 ? U[2] : '$', variant: 'd', family: join(U.slice(1)), site: [0, 1]};
    if (U[0] === 'a') return {sub: U.length > 1 ? U[1] : '$', variant: 'none', family: join(U), site: [0, 1]};
    return null;
  }
  function s3ch(U) {
    const n = U.length; if (n < 3 || U[n - 1] !== 'y') return null;
    let i = n - 2; const mid = [];
    while (i >= 0 && !GALL.has(U[i])) { mid.unshift(U[i]); i--; }
    if (i < 0 || !ORD.has(U[i])) return null;
    const m = mid.join(' ');
    const variant = m === 'ch' || m === 'ch e' ? 'bench' : m === 'e' || m === 'ee' ? 'e' : null;
    if (!variant) return null;
    const sub = m === 'ch' || m === 'e' ? 'short' : 'long';
    return {sub, variant, family: join(U.slice(0, i + 1)) + '|' + sub, site: [i + 1, n - 1]};
  }
  function gedya(U) {
    const n = U.length;
    if (n >= 4 && U[n - 1] === 'y' && U[n - 2] === 'd' && U[n - 3] === 'e' && GALL.has(U[n - 4])) return {sub: gclass(U[n - 4]), variant: 'edy', family: join(U.slice(0, n - 3)), site: [n - 3, n]};
    if (n >= 3 && (U[n - 1] === 'l' || U[n - 1] === 'r') && U[n - 2] === 'a' && GALL.has(U[n - 3])) return {sub: gclass(U[n - 3]), variant: 'a' + U[n - 1], family: join(U.slice(0, n - 2)), site: [n - 2, n]};
    return null;
  }
  function aiin(U) {
    const n = U.length; if (n < 3 || U[n - 1] !== 'n' || U[n - 3] !== 'a' || !(U[n - 2] === 'i' || U[n - 2] === 'ii' || U[n - 2] === 'iii')) return null;
    return {sub: n >= 4 ? U[n - 4] : '^', variant: U[n - 2], family: join(U.slice(0, n - 2)) + ' I n', site: [n - 2, n - 1]};
  }

  const VARIABLES = [
    {key: 'DY', name: 'd before the final y', ops: 'd, ed, B1, LIQUID_DROP', newVariants: ['dy'], labels: {dy: 'with d', y: 'without d'}, fn: dy,
      what: 'A final y after e, ee, ch, sh, o or a, with or without d before it: chey against chedy, chy against chdy, qokeey against qokeedy, choy against chody. The sub-environment is the unit before the (d)y.'},
    {key: 'GEY', name: 'e-run between a gallows and the final y', ops: 'EE_Y, C3.1, BG_Y_E', newVariants: ['ey', 'eey'], labels: {y: 'no e', ey: 'one e', eey: 'two or more e'}, fn: gey,
      what: 'oky against okey against okeey, with no d; the sub-environment is the gallows class (ordinary k/t, p/f, atomic bench gallows).'},
    {key: 'GEO', name: 'e-run between a gallows and o', ops: 'EE_O, S1, S2', newVariants: ['eo', 'eeo'], labels: {o: 'no e', eo: 'one e', eeo: 'two or more e'}, fn: geo,
      what: 'okol against okeol against okeeol, qokody against qokeody; the sub-environment is the gallows class and the unit after the o.'},
    {key: 'CHEO', name: 'e-run between a bench and o', ops: 'S1, S2, L_EIN', newVariants: ['eo', 'eeo'], labels: {o: 'no e', eo: 'one e', eeo: 'two or more e'}, fn: cheo,
      what: 'chol against cheol, chody against cheody; the sub-environment is the unit after the o.'},
    {key: 'KT', name: 'k or t at the one ordinary gallows', ops: 'KT_CORR, KT_CORR_O', newVariants: ['k'], labels: {k: 'k', t: 't'}, fn: kt,
      what: 'okal against otal: words with exactly one ordinary gallows and no p, f or bench gallows; the sub-environment is the unit after the gallows.'},
    {key: 'OA', name: 'o or a before the final liquid', ops: 'L_VOW, OA_l, OA_r, L_NOM_aL', newVariants: ['a'], labels: {o: 'o', a: 'a'}, fn: oa,
      what: 'okol against okal, chor against char; the sub-environment is the unit before the vowel and the liquid.'},
    {key: 'BENCHLIQ', name: 'bench before o + liquid, whole words', ops: 'L_NOM_L, BENCH_DROP', newVariants: ['none'], labels: {bench: 'with the bench', none: 'bare'}, fn: benchliq,
      what: 'chol and cheol against ol, chor and cheor against or: whole-word forms only.'},
    {key: 'D0', name: 'initial da- against a-', ops: 'D0', newVariants: ['none'], labels: {d: 'da-', none: 'a-'}, fn: d0,
      what: 'daiin against aiin, dal against al; the sub-environment is the unit after the a.'},
    {key: 'S3CH', name: 'bench or e after an ordinary gallows, before y', ops: 'S3_CH', newVariants: ['e'], labels: {bench: 'ch', e: 'e'}, fn: s3ch,
      what: 'okchy against okey (short), okchey against okeey (long).'},
    {key: 'GEDYA', name: 'Gedy against Gal and Gar', ops: 'GEDY_AL, GEDY_AR', newVariants: ['edy'], labels: {edy: 'edy', al: 'al', ar: 'ar'}, fn: gedya,
      what: 'okedy against okal and okar; the sub-environment is the gallows class.'},
    {key: 'AIIN', name: 'i-run before the final n', ops: 'the residual lead at 3c > 4c', newVariants: ['i'], labels: {i: 'one i', ii: 'two i', iii: 'three i'}, fn: aiin,
      what: 'dain against daiin against daiiin; the sub-environment is the unit before the a.'},
  ];
  const VAR = Object.fromEntries(VARIABLES.map(v => [v.key, v]));
  const countClass = n => (n === 1 ? '1' : n <= 4 ? '2-4' : n <= 9 ? '5-9' : '10+');
  const CLASSES = ['1', '2-4', '5-9', '10+', 'all'];
  const isNew = (v, r) => v.newVariants.includes(r.variant);

  // one unit inserted, deleted or substituted
  function oneEdit(a, b) {
    const la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1) return false;
    if (la === lb) { let d = 0; for (let i = 0; i < la; i++) if (a[i] !== b[i] && ++d > 1) return false; return d === 1; }
    if (la > lb) [a, b] = [b, a];
    let i = 0; while (i < a.length && a[i] === b[i]) i++;
    for (let k = i; k < a.length; k++) if (a[k] !== b[k + 1]) return false;
    return true;
  }

  // The pages of the chain's columns (Golf 2.1 groups, the middle text as one more column), each page's paragraph
  // lines in manuscript order with every token's count in its column, its count class and its units.
  function tokensOf({manuscript, lines, pools, units, order = 'alternate'}) {
    const cols = CF.columns({manuscript, lines, axis: 'groups', order, pools, middle: true});
    const K = cols.columns, colOf = new Map(), byKey = new Map(K.map(c => [c.key, c]));
    for (const c of K) for (const f of c.pages) colOf.set(f, c.key);
    const info = Object.fromEntries((manuscript.pages || []).map(p => [p.folio, p]));
    const pages = new Map();
    for (const l of lines) {
      if ((l.category || 'para') !== 'para') continue;
      const key = colOf.get(l.folio); if (!key) continue;
      const words = l.words.filter(Boolean); if (!words.length) continue;
      const col = byKey.get(key);
      let page = pages.get(l.folio);
      if (!page) {
        const p = info[l.folio] || {};
        page = {folio: l.folio, col: key, hand: (p.hands && p.hands.length ? p.hands.join('+') : '?'), lang: p.lang || '', sheet: p.sheet || l.sheet || '', lines: [], tokens: []};
        pages.set(l.folio, page);
      }
      const line = {locus: l.locus, first: !!l.first, index: page.lines.length, tokens: []};
      words.forEach((w, i) => {
        const n = col.counts.get(w) || 0, u = units[w];
        const t = {w, units: u ? u.split(' ') : null, count: n, cls: countClass(n), line: line.index, pos: i + 1, n: words.length, first: line.first, index: page.tokens.length, vars: {}};
        line.tokens.push(t); page.tokens.push(t);
      });
      page.lines.push(line);
    }
    const byCol = {};
    for (const p of pages.values()) (byCol[p.col] = byCol[p.col] || []).push(p.folio);
    return {columns: K.map(c => ({key: c.key, N: c.N, group: c.group, title: c.title, pages: byCol[c.key] || []})), pages, order: cols.order, middleKey: CF.MIDDLE_KEY};
  }

  // attach the variable's reading to every token (cached per variable)
  function annotate(data, v) {
    for (const p of data.pages.values()) for (const t of p.tokens) if (!(v.key in t.vars)) t.vars[v.key] = t.units ? v.fn(t.units) : null;
    return data;
  }

  // innovative share by column and count class (tokens; the hapax class is also the type share), and per page
  function columnStats(data, v) {
    annotate(data, v);
    const cols = {};
    for (const c of data.columns) cols[c.key] = {classes: Object.fromEntries(CLASSES.map(k => [k, [0, 0]])), pages: {}};
    for (const p of data.pages.values()) {
      const col = cols[p.col], pg = {k10: 0, n10: 0, k1: 0, n1: 0, k: 0, n: 0};
      col.pages[p.folio] = pg;
      for (const t of p.tokens) {
        const r = t.vars[v.key]; if (!r) continue;
        const nw = isNew(v, r) ? 1 : 0;
        for (const k of [t.cls, 'all']) { col.classes[k][1]++; col.classes[k][0] += nw; }
        pg.n++; pg.k += nw;
        if (t.count === 1) { pg.n1++; pg.k1 += nw; } else if (t.count >= 10) { pg.n10++; pg.k10 += nw; }
      }
    }
    return cols;
  }

  // per line: innovative tokens and eligible tokens
  function lineShares(page, v) {
    return page.lines.map(l => { let k = 0, n = 0; for (const t of l.tokens) { const r = t.vars[v.key]; if (r) { n++; k += isNew(v, r) ? 1 : 0; } } return [k, n]; });
  }

  // for every section hapax of the page: the nearest word within one unit edit on the same page (by line distance,
  // then by position), whether it lies within the window, where it stands, and whether the one edit is the variable's
  // site (same family under the variable: the hapax and its relative then differ exactly there)
  function pageRelatives(page, v) {
    const rel = new Map(), stats = {hapaxes: 0, withRelative: 0, within: 0, siteEdits: 0, above: 0, same: 0, below: 0};
    const T = page.tokens;
    for (const t of T) {
      if (t.count !== 1 || !t.units) continue;
      stats.hapaxes++;
      let best = null;
      for (const u of T) {
        if (u === t || !u.units || u.w === t.w || !oneEdit(t.units, u.units)) continue;
        const d = Math.abs(u.line - t.line), e = Math.abs(u.index - t.index);
        if (!best || d < best.d || (d === best.d && e < best.e)) best = {j: u.index, d, e, token: u};
      }
      if (!best) continue;
      stats.withRelative++;
      const a = t.vars[v.key], b = best.token.vars[v.key];
      const siteEdit = !!(a && b && a.family === b.family);
      const within = best.d <= WINDOW;
      if (within) { stats.within++; if (best.token.line < t.line) stats.above++; else if (best.token.line > t.line) stats.below++; else stats.same++; if (siteEdit) stats.siteEdits++; }
      rel.set(t.index, {j: best.j, lineDist: best.d, within, siteEdit, token: best.token});
    }
    return {rel, stats};
  }

  // ---------------------------------------------------------------- bifolia
  // A sheet key Q:a-b names the quire and the two conjugate leaves; a folio is f<leaf><side><panel>.
  const parseFolio = f => { const m = /^f(\d+)([rv])(\d*)$/.exec(f); return m ? {n: Number(m[1]), side: m[2], panel: m[3]} : null; };
  const sheetLeaves = key => { const m = /^[A-Z]+:(\d+)-(\d+)$/.exec(key || ''); return m ? [Number(m[1]), Number(m[2])] : null; };
  // The two faces of a sheet laid flat: inner = a verso then b recto, outer = b verso then a recto (panels in the
  // manuscript's order). `folios` are every page of the sheet, in manuscript order.
  function sheetFaces(key, folios) {
    const L = sheetLeaves(key); if (!L) return null;
    const [a, b] = L;
    const of = (leaf, side) => folios.filter(f => { const p = parseFolio(f); return p && p.n === leaf && p.side === side; });
    return {a, b, inner: of(a, 'v').concat(of(b, 'r')), outer: of(b, 'v').concat(of(a, 'r'))};
  }
  // Pairs of chain pages by physical relation: the recto and verso of one leaf; the two pages of one face (a verso
  // with b recto, b verso with a recto); conjugate leaves across the faces (a recto with b recto, a verso with b verso);
  // pages facing each other in the bound book on different sheets (f_n verso with f_n+1 recto); the next leaf's same
  // side on another sheet (f_n recto with f_n+1 recto).
  function pagePairs(folios, sheetOf) {
    const byLeaf = new Map();
    for (const f of folios) { const p = parseFolio(f); if (p) { if (!byLeaf.has(p.n)) byLeaf.set(p.n, []); byLeaf.get(p.n).push(f); } }
    const pairs = {sameLeaf: [], sameFace: [], conjugateOther: [], facing: [], nextLeafSame: []};
    for (const f of folios) {
      const p = parseFolio(f); if (!p) continue;
      const s = sheetOf(f);
      for (const g of byLeaf.get(p.n) || []) if (g > f && parseFolio(g).side !== p.side) pairs.sameLeaf.push([f, g]);
      const L = sheetLeaves(s);
      if (L) {
        const other = p.n === L[0] ? L[1] : p.n === L[1] ? L[0] : null;
        if (other !== null && p.n < other) for (const g of byLeaf.get(other) || []) {
          if (sheetOf(g) !== s) continue;
          (parseFolio(g).side !== p.side ? pairs.sameFace : pairs.conjugateOther).push([f, g]);
        }
      }
      for (const g of byLeaf.get(p.n + 1) || []) {
        if (parseFolio(g).side !== 'r' || sheetOf(g) === s) continue;
        if (p.side === 'v') pairs.facing.push([f, g]); else pairs.nextLeafSame.push([f, g]);
      }
    }
    return pairs;
  }
  // The comparison over the chain for one variable: the innovative share per page over all eligible tokens (pages
  // with at least `min`), the mean absolute difference per pair kind, a baseline from shares shuffled within the
  // page's column, and among pages with both a same-face and a facing partner the share whose same-face partner is
  // closer.
  function sheetComparison(data, v, min = 15, shuffles = 100, random = Math.random) {
    const stats = columnStats(data, v), share = new Map(), colOf = new Map(), sheetOf = new Map();
    for (const p of data.pages.values()) {
      const pg = stats[p.col].pages[p.folio];
      if (pg && pg.n >= min && parseFolio(p.folio)) { share.set(p.folio, pg.k / pg.n); colOf.set(p.folio, p.col); sheetOf.set(p.folio, p.sheet); }
    }
    const folios = [...share.keys()].sort((x, y) => { const a = parseFolio(x), b = parseFolio(y); return a.n - b.n || a.side.localeCompare(b.side) || a.panel.localeCompare(b.panel); });
    const pairs = pagePairs(folios, f => sheetOf.get(f));
    const mean = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
    const kinds = {};
    for (const [k, ps] of Object.entries(pairs)) kinds[k] = {n: ps.length, mean: mean(ps.map(([f, g]) => Math.abs(share.get(f) - share.get(g))))};
    const all = Object.values(pairs).flat(), byCol = new Map();
    for (const f of folios) { if (!byCol.has(colOf.get(f))) byCol.set(colOf.get(f), []); byCol.get(colOf.get(f)).push(f); }
    const base = [];
    for (let s = 0; s < shuffles && all.length; s++) {
      const sh = new Map();
      for (const fs of byCol.values()) {
        const vals = fs.map(f => share.get(f));
        for (let i = vals.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [vals[i], vals[j]] = [vals[j], vals[i]]; }
        fs.forEach((f, i) => sh.set(f, vals[i]));
      }
      base.push(mean(all.map(([f, g]) => Math.abs(sh.get(f) - sh.get(g)))));
    }
    const partner = (ps) => { const m = new Map(); for (const [f, g] of ps) { (m.get(f) || m.set(f, []).get(f)).push(g); (m.get(g) || m.set(g, []).get(g)).push(f); } return m; };
    const face = partner(pairs.sameFace), facing = partner(pairs.facing);
    let closer = 0, decided = 0;
    for (const f of folios) {
      if (!face.has(f) || !facing.has(f)) continue;
      const d1 = Math.min(...face.get(f).map(g => Math.abs(share.get(f) - share.get(g)))), d2 = Math.min(...facing.get(f).map(g => Math.abs(share.get(f) - share.get(g))));
      if (d1 !== d2) { decided++; if (d1 < d2) closer++; }
    }
    return {pages: folios.length, kinds, shuffled: mean(base), closer: decided ? closer / decided : null, decided};
  }

  const api = {VARIABLES, VAR, CLASSES, WINDOW, countClass, isNew, oneEdit, tokensOf, annotate, columnStats, lineShares, pageRelatives, parseFolio, sheetLeaves, sheetFaces, pagePairs, sheetComparison};
  if (node) module.exports = api; else root.EchoVariantsFlow = api;
})(typeof window !== 'undefined' ? window : globalThis);
