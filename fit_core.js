/* Held-out fit of the active rules: LC1's pooled model P, in the browser. Pure and DOM-free; node tests import it.
 *
 * One fraction theta per (rule, coarse front) cell, the same in both line classes, fitted on one sheet half by an exact
 * two-stage LP (1: maximise the line-class-weighted word overlap with Herbal B; 2: holding that optimum, the smallest
 * hash-weighted sum of fractions, so ties resolve the same way every time) and then applied unchanged to the other
 * half. Ported from solve/botanical_enrichment/team_echo/redesign/line_class_20260925/model_lc.py; the parity test
 * reproduces its four saved evaluations. Rule hits of the ten original rules come from fit_data.js (the research
 * gates); catalog families carry no rewritten span, so each gets one fraction ('all' fronts), shared equally by its
 * outputs. The LP solver is passed in (HiGHS: solve(lpText) -> {Status, Columns}).
 */
(function (root) {
  'use strict';
  const CLASSES = ['first', 'body'];
  const stripQ = w => (w.length > 1 && w[0] === 'q' ? w.slice(1) : w);   // LC1 / JA1 rules.strip_q

  // ---- SHA-256 (synchronous), for LC1's tie weights: 1 + 1e-3 * (first 6 hex digits / 16^6) of the cell identity.
  const K256 = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb,
    0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f,
    0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  function sha256hex(text) {
    const bytes = Array.from(new TextEncoder().encode(text)), bits = bytes.length * 8;
    bytes.push(0x80); while (bytes.length % 64 !== 56) bytes.push(0);
    for (let i = 7; i >= 0; i--) bytes.push(Math.floor(bits / 2 ** (8 * i)) & 0xff);
    const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    const w = new Uint32Array(64), rot = (x, n) => (x >>> n) | (x << (32 - n));
    for (let o = 0; o < bytes.length; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = (bytes[o + 4 * i] << 24) | (bytes[o + 4 * i + 1] << 16) | (bytes[o + 4 * i + 2] << 8) | bytes[o + 4 * i + 3];
      for (let i = 16; i < 64; i++) {
        const s0 = rot(w[i - 15], 7) ^ rot(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rot(w[i - 2], 17) ^ rot(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, k] = h;
      for (let i = 0; i < 64; i++) {
        const t1 = (k + (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) + ((e & f) ^ (~e & g)) + K256[i] + w[i]) >>> 0;
        const t2 = ((rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        k = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      [a, b, c, d, e, f, g, k].forEach((x, i) => { h[i] = (h[i] + x) >>> 0; });
    }
    return Array.from(h, x => x.toString(16).padStart(8, '0')).join('');
  }
  const tieWeight = cell => 1 + 1e-3 * parseInt(sha256hex(cell).slice(0, 6), 16) / 16 ** 6;

  // ---- data
  // Token counts of one population on a set of sheets, keyed word \t line class (q-merged, paragraph-initial = first).
  // With collapse, a word repeated immediately on the same line counts once (a line break or unreadable gap ends a run).
  function blockCounts(lines, section, sheets, collapse = false) {
    const out = new Map();
    for (const l of lines) {
      if (!l.sections.includes(section) || (sheets && !sheets.has(l.sheet))) continue;
      const c = l.first ? 'first' : 'body';
      let prev = null;
      for (const raw of l.words) {
        if (!raw) { prev = null; continue; }
        const w = stripQ(raw);
        if (collapse && w === prev) continue;
        prev = w; const k = w + '\t' + c; out.set(k, (out.get(k) || 0) + 1);
      }
    }
    return out;
  }
  // Hits of the active rules on one word: original rules from fit_data (output, front), catalog families from the
  // catalog menus (all their outputs, front 'all'). A composed output (catalogRoutes, e.g. ed+GEDY_AR) counts only
  // when every rule of one of its routes is active.
  function hitMaker(active, fitData, catalogKnown, catalogRoutes) {
    const R = typeof module !== 'undefined' && module.exports ? require('./rule_manager.js') : root.EchoRuleManager;
    const original = new Set(fitData.rules), cache = new Map();
    return word => {
      if (!cache.has(word)) {
        const out = [];
        for (const [rule, o, front] of fitData.hits[word] || []) if (active.has(rule)) out.push({rule, outs: [o], front});
        for (const code of active) {
          if (original.has(code)) continue;
          const outs = catalogKnown ? R.outputs({known: catalogKnown, routes: catalogRoutes}, code, word, active).filter(o => o !== word) : [];
          if (outs.length) out.push({rule: code, outs, front: 'all'});
        }
        cache.set(word, out);
      }
      return cache.get(word);
    };
  }
  function classRates(counts) {
    const N = {first: 0, body: 0}, r = {first: new Map(), body: new Map()};
    for (const [k, n] of counts) N[k.split('\t')[1]] += n;
    for (const [k, n] of counts) { const [w, c] = k.split('\t'); r[c].set(w, (r[c].get(w) || 0) + 1e4 * n / N[c]); }
    return {r, N};
  }
  const cellKey = h => h.rule + '|' + h.front + '|all';
  const tupleCompare = (x, y) => { const a = x.split('|'), b = y.split('|'); for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1; return 0; };

  // Cells with enough fitting-block support; sparse or 'other' fronts merge into (rule, other); below that, fixed at 0.
  function environments(counts, hitsOf, minSupport) {
    const support = new Map(), raw = new Map();
    for (const [wc, n] of counts) for (const h of hitsOf(wc.split('\t')[0])) {
      const key = cellKey(h); support.set(key, (support.get(key) || 0) + n); raw.set(wc + '\t' + h.rule, key);
    }
    const small = new Map();
    for (const [key, n] of support) { const [r, f] = key.split('|'); if (n < minSupport || f === 'other') small.set(r, (small.get(r) || 0) + n); }
    const cellOf = new Map(), cells = new Map(), fixedZero = [];
    for (const [k, key] of raw) {
      const [w, c, r] = k.split('\t'), n = counts.get(w + '\t' + c);
      let cell = null;
      if (support.get(key) >= minSupport && key.split('|')[1] !== 'other') cell = key;
      else if ((small.get(r) || 0) >= minSupport) cell = r + '|other|all';
      else if (!fixedZero.includes(r)) fixedZero.push(r);
      cellOf.set(k, cell);
      if (cell) cells.set(cell, (cells.get(cell) || 0) + n);
    }
    return {cellOf, cells, fixedZero};
  }
  const num = x => (Object.is(x, -0) ? 0 : x).toPrecision(17);
  const term = (c, v) => (c < 0 ? ' - ' + num(-c) : ' + ' + num(c)) + ' ' + v;

  // ---- the two-stage LP on the fitting block
  function fit({countsA, countsB, hitsOf, weights, minSupport, tieEps, solve}) {
    const {cellOf, cells, fixedZero} = environments(countsA, hitsOf, minSupport);
    const {r: a, N: NA} = classRates(countsA), {r: b} = classRates(countsB);
    let base = 0;
    for (const c of CLASSES) for (const [w, bw] of b[c]) base += weights[c] * Math.min(a[c].get(w) || 0, bw);
    const keys = [...cells.keys()].sort(tupleCompare);
    if (!keys.length) return {theta: new Map(), diag: {cells, fixedZero, nParams: 0, objective: base, base}};
    const kidx = new Map(keys.map((k, j) => [k, j])), coef = new Map(), perWord = new Map();
    const add = (k, j, v) => { if (!coef.has(k)) coef.set(k, new Map()); const m = coef.get(k); m.set(j, (m.get(j) || 0) + v); };
    for (const [wc, n] of countsA) {
      const [w, c] = wc.split('\t'), m = 1e4 * n / NA[c];
      for (const h of hitsOf(w)) {
        const cell = cellOf.get(wc + '\t' + h.rule); if (!cell) continue;
        const j = kidx.get(cell);
        add(wc, j, -m);
        for (const o of h.outs) add(o + '\t' + c, j, m / h.outs.length);
        if (!perWord.has(wc)) perWord.set(wc, new Set()); perWord.get(wc).add(j);
      }
    }
    const zs = [];
    for (const c of CLASSES) for (const w of b[c].keys()) if (coef.has(w + '\t' + c) || (a[c].get(w) || 0) > 0) zs.push([w, c]);
    zs.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0));
    const rows = [];
    zs.forEach(([w, c], i) => {
      let s = ` r${rows.length}: z${i}`;
      for (const [j, cf] of coef.get(w + '\t' + c) || []) s += '\n' + term(-cf, 't' + j);
      rows.push(s + '\n <= ' + num(a[c].get(w) || 0));
    });
    for (const js of perWord.values()) if (js.size >= 2) rows.push(` r${rows.length}: ` + [...js].map(j => 't' + j).join(' + ') + ' <= 1');
    const bounds = keys.map((_, j) => ` 0 <= t${j} <= 1`).concat(zs.map(([w, c], i) => ` -inf <= z${i} <= ${num(b[c].get(w))}`));
    const zw = zs.map(([, c]) => weights[c]);
    const objective = zs.map((_, i) => term(zw[i], 'z' + i)).join('\n');
    const lp1 = `Maximize\n obj:${objective}\nSubject To\n${rows.join('\n')}\nBounds\n${bounds.join('\n')}\nEnd\n`;
    const r1 = solve(lp1);
    if (r1.Status !== 'Optimal') throw new Error('LP stage 1: ' + r1.Status);
    const opt = r1.ObjectiveValue;
    const tie = ` tie:${objective}\n >= ${num(opt - tieEps)}`;
    const lp2 = `Minimize\n obj:${keys.map((k, j) => term(tieWeight(k), 't' + j)).join('\n')}\nSubject To\n${rows.join('\n')}\n${tie}\nBounds\n${bounds.join('\n')}\nEnd\n`;
    const r2 = solve(lp2);
    if (r2.Status !== 'Optimal') throw new Error('LP stage 2: ' + r2.Status);
    const theta = new Map(keys.map((k, j) => [k, Math.min(1, Math.max(0, r2.Columns['t' + j].Primal))]));
    const objective2 = zs.reduce((s, _, i) => s + zw[i] * r2.Columns['z' + i].Primal, 0);
    return {theta, diag: {cells, fixedZero, nParams: keys.length, objective: objective2, stage1: opt, base, nZ: zs.length, nRows: rows.length}};
  }

  // ---- apply frozen fractions to a block and score it (contextual, class-weighted; pooled by token counts)
  const thetaFor = (theta, h) => { const k = cellKey(h); return theta.has(k) ? theta.get(k) : theta.get(h.rule + '|other|all') || 0; };
  function apply(counts, hitsOf, theta) {
    const {r: a, N} = classRates(counts), a2 = {first: new Map(a.first), body: new Map(a.body)};
    let rescaled = 0;
    for (const [wc, n] of counts) {
      const [w, c] = wc.split('\t'), th = hitsOf(w).map(h => [h, thetaFor(theta, h)]), tot = th.reduce((s, [, v]) => s + v, 0);
      const scale = tot > 1 + 1e-9 ? 1 / tot : 1; if (tot > 1 + 1e-9) rescaled++;
      for (const [h, v] of th) {
        if (v <= 0) continue;
        const m = 1e4 * n / N[c] * v * scale;
        a2[c].set(w, (a2[c].get(w) || 0) - m);
        for (const o of h.outs) a2[c].set(o, (a2[c].get(o) || 0) + m / h.outs.length);
      }
    }
    return {a, a2, N, rescaled};
  }
  function evaluate({countsA, countsB, hitsOf, theta, weights}) {
    const {a, a2, N: NA, rescaled} = apply(countsA, hitsOf, theta), {r: b, N: NB} = classRates(countsB);
    const out = {N_A: NA, N_B: NB, class: {}, rescaled};
    let ctxBefore = 0, ctxAfter = 0;
    for (const c of CLASSES) {
      const words = new Set([...a[c].keys(), ...a2[c].keys(), ...b[c].keys()]);
      let before = 0, after = 0;
      for (const w of words) { before += Math.min(a[c].get(w) || 0, b[c].get(w) || 0); after += Math.min(a2[c].get(w) || 0, b[c].get(w) || 0); }
      out.class[c] = {before, after, net: after - before};
      ctxBefore += weights[c] * before; ctxAfter += weights[c] * after;
    }
    Object.assign(out, {ctx_before: ctxBefore, ctx_after: ctxAfter, ctx_net: ctxAfter - ctxBefore});
    // pooled: classes combined by token counts (the scale of the saved residual tables)
    const NAt = NA.first + NA.body, NBt = NB.first + NB.body, pa = new Map(), pa2 = new Map(), pb = new Map();
    const pool = (into, src, Nc, Nt) => { for (const [w, v] of src) into.set(w, (into.get(w) || 0) + v * Nc / Nt); };
    for (const c of CLASSES) { pool(pa, a[c], NA[c], NAt); pool(pa2, a2[c], NA[c], NAt); pool(pb, b[c], NB[c], NBt); }
    const words = new Set([...pa.keys(), ...pa2.keys(), ...pb.keys()]);
    let pBefore = 0, pAfter = 0;
    const perWord = [];
    for (const w of words) {
      const x = pa.get(w) || 0, y = pa2.get(w) || 0, t = pb.get(w) || 0;
      pBefore += Math.min(x, t); pAfter += Math.min(y, t);
      perWord.push({word: w, before: x, after: y, target: t, surplus: Math.max(0, y - t), shortfall: Math.max(0, t - y)});
    }
    Object.assign(out, {pooled_before: pBefore, pooled_after: pAfter, pooled_net: pAfter - pBefore, perWord});
    return out;
  }

  // One evaluation: fit on one sheet half, score in-sample and on the held-out half.
  function heldOut({lines, sheets, active, fitData, catalogKnown, catalogRoutes, solve, from = 'HA_early', to = 'HB_all', collapse = false}) {
    const hitsOf = hitMaker(active, fitData, catalogKnown, catalogRoutes), cfg = {weights: fitData.weights, minSupport: fitData.min_support, tieEps: fitData.tie_eps};
    const block = s => ({countsA: blockCounts(lines, from, new Set(s.sheets_A), collapse), countsB: blockCounts(lines, to, new Set(s.sheets_B), collapse)});
    const fitBlock = block(sheets.fit), evalBlock = block(sheets.eval);
    const {theta, diag} = fit({...fitBlock, hitsOf, solve, ...cfg});
    return {theta, diag, inSample: evaluate({...fitBlock, hitsOf, theta, weights: cfg.weights}),
      outOfFit: evaluate({...evalBlock, hitsOf, theta, weights: cfg.weights})};
  }

  const api = {CLASSES, stripQ, sha256hex, tieWeight, blockCounts, hitMaker, classRates, environments, fit, apply, evaluate, heldOut};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EchoFit = api;
})(typeof window !== 'undefined' ? window : globalThis);
