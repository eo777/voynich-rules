/* Variants tab: the rules on the page. For one variable (variants_flow.js) and one Golf 2.1 group, the paragraph text
 * of one bifolium laid flat (its inner face: a verso and b recto; its outer face: b verso and a recto; the conjugate
 * leaves marked) or of a few consecutive pages, every eligible token coloured by its variant and marked by its count
 * class in the group, a strip per line (the innovative share among the line's eligible tokens: the pockets), a link
 * from each section hapax to its nearest one-unit relative on the page, the innovative share of the frequent words
 * against the hapaxes along the chain or along the bifolia of Golf's path, the comparison of conjugate pages with the
 * pages that face each other in the bound book, and the group's figures. Rendering only; the counting is in
 * variants_flow.js. Reading left to right as writing order is the user's working assumption, said on screen.
 */
(function (root) {
  'use strict';
  function createView() {
  const VF = root.EchoVariantsFlow, CF = root.EchoChainFlow;
  const M = () => root.ECHO_MANUSCRIPT, W = () => root.ECHO_WORKBENCH_DATA, CD = () => root.ECHO_CHAIN_DATA;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const pct = (k, n) => (n ? `${Math.round(100 * k / n)}%` : '–');
  const num = v => Number(v).toLocaleString('en-US');
  const f3 = v => (v == null ? '–' : v.toFixed(3));
  const SHORT = {'1a': 'Early A', '1b': 'Early A', '1.5a': 'Transitional A', '2a': 'Late A / Pharma', '3a': 'Herbal B, gallows-to-a', '3b': 'Herbal B, gallows-to-e',
    '3c': 'Stars-T', '4a': 'Bio', '4c': 'Stars-S', '5a': 'Celestial', '6': 'f58', mid: 'middle text'};
  // the column headers of the chart, one or two short lines
  const SHORT2 = {'1a': ['Early A'], '1b': ['Early A'], '1.5a': ['Trans. A'], '2a': ['Late A', 'Pharma'], '3a': ['Herbal B', 'to a'], '3b': ['Herbal B', 'to e'],
    '3c': ['Stars-T'], '4a': ['Bio'], '4c': ['Stars-S'], mid: ['f69, f70', 'f58']};
  const CLASS_NAME = {'1': 'section hapax', '2-4': '2–4 tokens', '5-9': '5–9 tokens', '10+': '10 or more tokens', all: 'all eligible'};
  const KIND_NAME = {sameLeaf: 'same leaf: recto and verso of one folio', sameFace: 'same face of one sheet: a verso with b recto, b verso with a recto', conjugateOther: 'conjugate leaves, other face: a recto with b recto, a verso with b verso',
    facing: 'facing in the bound book, different sheets: f n verso with f n+1 recto', nextLeafSame: 'next leaf, same side, different sheets: f n recto with f n+1 recto'};
  const ORDERS = [['alternate', '… 3c → 4c → 4a (Stars-T, Stars-S, Bio; the default)'], ['proposed', '… 3c → 4a → 4c (Golf’s proposed terminal order)']];
  const SIZES = [['xs', 'Very small'], ['s', 'Small'], ['m', 'Normal']];
  const STRIPS = [['groups', 'The chain groups'], ['bifolia', 'The bifolia along Golf’s path']];
  const LAYOUTS = [['bifolium', 'One bifolium, both faces'], ['sequence', 'Consecutive pages']];
  const NS = [1, 2, 3, 4, 6].map(n => [String(n), n === 1 ? '1 page' : `${n} pages`]);
  const state = {variable: 'DY', group: '3a', sheet: '', page: '', n: 3, layout: 'bifolium', mark: true, links: true, size: 's', order: 'alternate', strip: 'groups', trace: false,
    copying: false, copyRule: 'CHOL_SHOL', copyScope: 'page', copyEvent: '', copyAll: false, generatorPages: false};
  let host = null, ticket = 0, cache = {order: null}, embedded = false, onEmbeddedSelect = null;

  const lines = () => W().lines.concat(M().extra_lines || []);
  function data() {
    if (!cache.data || cache.order !== state.order) cache = {order: state.order, data: VF.tokensOf({manuscript: M(), lines: lines(), pools: CD().pools, units: CD().units, order: state.order}), bif: null, cmp: {}};
    return cache.data;
  }
  function bifolia() {
    if (!cache.bif) {
      const c = CF.columns({manuscript: M(), lines: lines(), axis: 'pools', order: state.order, pools: CD().pools});
      cache.bif = c.columns.map(x => ({key: x.key, group: x.group, pages: [...x.pages], N: x.N, rank: x.rank}));
    }
    return cache.bif;
  }
  function comparison(v) {
    if (!cache.cmp[v.key]) cache.cmp[v.key] = VF.sheetComparison(data(), v);
    return cache.cmp[v.key];
  }
  // the colour of a Golf 2.1 group, as the page charts paint it
  function groupPaint() {
    try {
      const groups = root.EchoPageChart.grouping('golf21', M(), {regimeColours: (root.EchoColours || {}).regime});
      return code => { const g = groups.groups.find(g => g.key === code); return g ? (g.colour.startsWith('--') ? `var(${g.colour})` : g.colour) : 'var(--muted)'; };
    } catch (e) { return () => 'var(--muted)'; }
  }
  const sheetPages = key => (M().pages || []).filter(p => p.sheet === key).map(p => p.folio);
  const classOf = folio => ((M().golf21 || {}).units || {})[folio + '|para'] || null;

  function model() {
    const D = data(), v = VF.VAR[state.variable] || VF.VAR.DY;
    const stats = VF.columnStats(D, v);
    const col = D.columns.find(c => c.key === state.group) || D.columns.find(c => c.key === '3a') || D.columns[0];
    const pages = col.pages;
    const x = {D, v, stats, col, pages};
    if (state.layout === 'bifolium') {
      const inCol = new Set(pages.map(f => D.pages.get(f).sheet));
      const ordered = bifolia().map(b => b.key).filter(k => inCol.has(k));
      for (const k of inCol) if (!ordered.includes(k)) ordered.push(k);
      x.sheets = ordered;
      x.si = Math.max(0, ordered.indexOf(state.sheet));
      x.sheet = ordered[x.si] || null;
      x.faces = x.sheet ? VF.sheetFaces(x.sheet, sheetPages(x.sheet)) : null;
      const folios = x.faces ? x.faces.inner.concat(x.faces.outer) : [];
      x.shown = folios.map(f => D.pages.get(f)).filter(Boolean);
    } else {
      let i = pages.indexOf(state.page); if (i < 0) i = 0;
      x.i = i;
      x.shown = pages.slice(i, i + state.n).map(f => D.pages.get(f));
    }
    x.rel = new Map(x.shown.map(p => [p.folio, VF.pageRelatives(p, v)]));
    x.copy = new Map();
    if (state.copying && root.EchoPageCopyFlow && root.ECHO_COPYING_TRACE_DATA?.manuscript) {
      for (const p of x.shown) {
        const cp=root.EchoPageCopyFlow.analyze(p, root.ECHO_COPYING_TRACE_DATA.manuscript,
          {rule: state.copyRule, scope: state.copyScope, eventId: state.copyEvent});
        if(embedded && p.folio!==state.page){cp.chosen=null;cp.selected=null;cp.links=[];cp.sources=[];cp.later=[];cp.roles=new Map([...cp.eventByToken].map(([index,e])=>[index,{role:'eligible',eventId:e.id}]));}
        x.copy.set(p.folio,cp);
      }
    }
    return x;
  }

  // ---------------------------------------------------------------- controls
  const select = (id, opts, cur) => `<select id="${id}">${opts.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  const help = text => `<span class="ch-help" title="${esc(text)}" tabindex="0" role="img" aria-label="${esc(text)}">?</span>`;
  const field = (id, text, html, cls = '', note = '') => `<div class="wb-field ${cls}"><label for="${id}">${text}${note ? help(note) : ''}</label>${html}</div>`;
  const check = (id, text, on, note) => `<label class="ch-check"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}> ${text}${help(note)}</label>`;
  function controls(x) {
    const vars = VF.VARIABLES.map(v => [v.key, `${v.key} · ${v.name}`]);
    const groups = x.D.columns.map(c => [c.key, `${c.key === x.D.middleKey ? 'middle text' : c.key} · ${SHORT[c.key] || c.title || ''} (${c.pages.length} pages)`]);
    const where = state.layout === 'bifolium'
      ? field('va-sheet', 'Bifolium', select('va-sheet', x.sheets.map(k => { const L = VF.sheetLeaves(k); return [k, `${k}${L ? ` · leaves ${L[0]} and ${L[1]}` : ''}`]; }), x.sheet), 'ch-field-cols', 'The sheets with paragraph text in the group, in the order of Golf’s path. Q:a-b names the quire and the two conjugate leaves.')
      : field('va-page', 'From page', select('va-page', x.pages.map(f => [f, `${f} · hand ${x.D.pages.get(f).hand}`]), x.pages[x.i]), '', 'The first page shown; the pages of the group follow in manuscript order.') +
        field('va-n', 'Shown', select('va-n', NS, state.n), '', 'How many pages of the group are drawn, from the chosen page on.');
    return `<div class="wb-card"><div class="wb-fields">
      ${field('va-var', 'Variable', select('va-var', vars, x.v.key), 'wide', `${x.v.what} Operations: ${x.v.ops}.`)}
      ${field('va-group', 'Group', select('va-group', groups, x.col.key), 'ch-field-cols', 'A Golf 2.1 chain group (paragraph text, a page under its working class) or the middle text; a word’s count class is its tokens in this group.')}
      ${field('va-layout', 'Layout', select('va-layout', LAYOUTS, state.layout), '', 'One bifolium laid flat: the inner face (a verso, b recto) above the outer face (b verso, a recto), the conjugate leaves marked; or consecutive pages in manuscript order.')}
      ${where}
      ${field('va-size', 'Text', select('va-size', SIZES, state.size), '', 'The size of the page text.')}
      ${field('va-strip', 'Chart', select('va-strip', STRIPS, state.strip), '', 'The chart above the pages: the innovative share along the nine chain groups and the middle text, or along Golf’s 50 pooled bifolia and the two middle pools in path order (every page keeps the count classes of its group).')}
      ${field('va-order', 'Order', select('va-order', ORDERS, state.order), 'ch-field-order', 'Golf’s proposed order with the terminal bifolia as on its alternate curve, or Golf’s proposed terminal order. Left to right is read as writing order: a working assumption.')}
      <div class="wb-field ch-checks"><label>Options</label><div>${check('va-mark', 'Mark count classes', state.mark, 'Dashed outline: a section hapax (one token in the group). Thin outline: 2–9 tokens. Strong fill: 10 or more tokens. Off: every eligible token takes the same tint.')}
        ${check('va-links', 'Hapax relatives', state.links, 'A curve from each section hapax to the nearest word on the page within one unit edit (grey: the edit is somewhere else, so they share the variant; red, dashed: the edit is the variable’s site, so they differ exactly there). This is a descriptive three-line neighborhood; the published generator can also use other lines and older sources.')}</div></div>
      </div></div>`;
  }

  // ---------------------------------------------------------------- the chart along the chain or the path
  function stripGroups(x) {
    const paint = groupPaint(), K = x.D.columns, Wd = 760, H = 210, L = 40, R = 16, T = 22, B = 64, w = (Wd - L - R) / K.length, ph = H - T - B;
    const y = s => T + ph * (1 - s);
    const pts = cls => K.map((c, i) => { const [k, n] = x.stats[c.key].classes[cls]; return {x: L + w * (i + 0.5), k, n, s: n ? k / n : null}; });
    const line = (P, cls, min) => { const ok = P.filter(p => p.n >= min); return ok.length > 1 ? `<polyline class="va-l ${cls}" points="${ok.map(p => `${p.x.toFixed(1)},${y(p.s).toFixed(1)}`).join(' ')}"></polyline>` : ''; };
    const dots = (P, cls, name, min) => P.filter(p => p.n >= min).map(p => `<circle class="va-d ${cls}" cx="${p.x.toFixed(1)}" cy="${y(p.s).toFixed(1)}" r="3.2"><title>${esc(name)}: ${pct(p.k, p.n)} of ${num(p.n)} eligible tokens show ${esc(x.v.newVariants.join('/'))}</title></circle>`).join('');
    const P10 = pts('10+'), P1 = pts('1'), Pa = pts('all');
    const parts = [`<svg class="va-svg" viewBox="0 0 ${Wd} ${H}" width="${Wd}" height="${H}" role="img" aria-label="Innovative share along the chain">`];
    const si = K.findIndex(c => c.key === x.col.key);
    if (si >= 0) parts.push(`<rect x="${L + w * si}" y="${T - 10}" width="${w}" height="${ph + 20}" class="va-sel"></rect>`);
    for (const t of [0, 0.5, 1]) parts.push(`<line x1="${L}" x2="${Wd - R}" y1="${y(t)}" y2="${y(t)}" class="va-grid"></line><text x="${L - 6}" y="${y(t) + 3.5}" text-anchor="end" class="ch-sub">${Math.round(t * 100)}%</text>`);
    K.forEach((c, i) => {
      const cx = L + w * (i + 0.5);
      parts.push(`<rect x="${L + w * i + 3}" y="${T + ph + 8}" width="${w - 6}" height="4" rx="1" fill="${paint(c.key === x.D.middleKey ? 'mid' : c.key)}"></rect>`);
      parts.push(`<text x="${cx}" y="${T + ph + 24}" text-anchor="middle" class="ch-head">${esc(c.key === x.D.middleKey ? 'middle' : c.key)}</text>`);
      (SHORT2[c.key] || [c.key]).forEach((s, k) => parts.push(`<text x="${cx}" y="${T + ph + 35 + 10 * k}" text-anchor="middle" class="ch-sub">${esc(s)}</text>`));
      parts.push(`<text x="${cx}" y="${T + ph + 57}" text-anchor="middle" class="ch-sub">${num(x.stats[c.key].classes.all[1])} elig.</text>`);
    });
    parts.push(line(Pa, 'all', 20), line(P10, 'f', 8), line(P1, 'h', 8), dots(Pa, 'all', 'all eligible tokens', 20), dots(P10, 'f', '10+ words (tokens)', 8), dots(P1, 'h', 'section hapaxes (types)', 8));
    parts.push(`<text x="${L}" y="${T - 8}" class="ch-sub">Share of ${esc(x.v.newVariants.join('/'))} among the eligible tokens of each group</text></svg>`);
    return parts.join('');
  }
  function stripBifolia(x) {
    const paint = groupPaint(), Bf = bifolia(), Wd = 760, H = 200, L = 40, R = 16, T = 22, B = 54, w = (Wd - L - R) / Bf.length, ph = H - T - B;
    const y = s => T + ph * (1 - s);
    const agg = Bf.map((b, i) => {
      const a = {x: L + w * (i + 0.5), k10: 0, n10: 0, k1: 0, n1: 0, k: 0, n: 0, b};
      for (const f of b.pages) { const pg = (x.stats[(x.D.pages.get(f) || {}).col] || {pages: {}}).pages[f]; if (pg) { a.k10 += pg.k10; a.n10 += pg.n10; a.k1 += pg.k1; a.n1 += pg.n1; a.k += pg.k; a.n += pg.n; } }
      return a;
    });
    const pick = (P, kk, nn, min) => P.filter(p => p[nn] >= min).map(p => ({x: p.x, k: p[kk], n: p[nn], s: p[kk] / p[nn], b: p.b}));
    const line = (P, cls) => (P.length > 1 ? `<polyline class="va-l ${cls}" points="${P.map(p => `${p.x.toFixed(1)},${y(p.s).toFixed(1)}`).join(' ')}"></polyline>` : '');
    const dots = (P, cls, name) => P.map(p => `<circle class="va-d ${cls}" cx="${p.x.toFixed(1)}" cy="${y(p.s).toFixed(1)}" r="2.6"><title>${esc(p.b.key)} (${esc(p.b.group || '?')}) · ${esc(name)}: ${pct(p.k, p.n)} of ${num(p.n)}</title></circle>`).join('');
    const P10 = pick(agg, 'k10', 'n10', 6), P1 = pick(agg, 'k1', 'n1', 6), Pa = pick(agg, 'k', 'n', 12);
    const parts = [`<svg class="va-svg" viewBox="0 0 ${Wd} ${H}" width="${Wd}" height="${H}" role="img" aria-label="Innovative share along the bifolia of the path">`];
    Bf.forEach((b, i) => {
      const inGroup = b.group === x.col.key || (x.col.key === x.D.middleKey && (b.group === '5a' || b.group === '6'));
      if (inGroup) parts.push(`<rect x="${L + w * i}" y="${T - 10}" width="${w}" height="${ph + 20}" class="va-sel ${x.sheet === b.key ? 'on' : ''}"></rect>`);
    });
    for (const t of [0, 0.5, 1]) parts.push(`<line x1="${L}" x2="${Wd - R}" y1="${y(t)}" y2="${y(t)}" class="va-grid"></line><text x="${L - 6}" y="${y(t) + 3.5}" text-anchor="end" class="ch-sub">${Math.round(t * 100)}%</text>`);
    let runStart = 0;
    Bf.forEach((b, i) => {
      parts.push(`<rect x="${L + w * i + 0.5}" y="${T + ph + 8}" width="${w - 1}" height="4" fill="${paint(b.group === '5a' || b.group === '6' ? 'mid' : b.group)}"><title>${esc(b.key)}: ${esc(SHORT[b.group] || b.group || 'unassigned')}, ${num(b.N)} words</title></rect>`);
      if (i === Bf.length - 1 || Bf[i + 1].group !== b.group) { const cx = L + w * (runStart + i + 1) / 2; parts.push(`<text x="${cx}" y="${T + ph + 24}" text-anchor="middle" class="ch-sub">${esc(b.group || '?')}</text>`); runStart = i + 1; }
    });
    parts.push(`<text x="${(L + Wd - R) / 2}" y="${T + ph + 42}" text-anchor="middle" class="ch-sub">Golf’s pooled bifolia in path order; a bifolium is drawn when it has at least 6 eligible 10+ or hapax tokens (12 for all)</text>`);
    parts.push(line(Pa, 'all'), line(P10, 'f'), line(P1, 'h'), dots(Pa, 'all', 'all eligible'), dots(P10, 'f', '10+ words of the group'), dots(P1, 'h', 'section hapaxes'));
    parts.push(`<text x="${L}" y="${T - 8}" class="ch-sub">Share of ${esc(x.v.newVariants.join('/'))} per pooled bifolium along Golf’s path</text></svg>`);
    return parts.join('');
  }
  function stripCard(x) {
    const caption = state.strip === 'bifolia'
      ? 'Solid: words with 10 or more tokens in their group. Dashed: section hapaxes. Dotted: all eligible tokens. A convention that switches gives flat runs inside a group and a step at the boundary; a drifting process gives slopes inside the groups. The darker band is the bifolium shown below.'
      : 'Solid: words with 10 or more tokens in the group (tokens). Dashed: section hapaxes (types). Dotted: all eligible tokens. Left to right is the working writing order of the chain, not an established chronology.';
    return `<section class="wb-card va-strip-card"><h3>${esc(x.v.key)}: ${esc(x.v.name)} <span class="wb-small">${esc(x.v.what)} Operations: ${esc(x.v.ops)}.</span></h3>
      <div class="ch-scroll">${state.strip === 'bifolia' ? stripBifolia(x) : stripGroups(x)}</div><p class="wb-small">${caption}</p></section>`;
  }

  function copyControls(x) {
    if (!state.copying) return '';
    const events = [...x.copy.values()].flatMap(c => c.events);
    const selected = events.find(e => e.id === state.copyEvent) || [...x.copy.values()].find(c => c.chosen)?.chosen;
    return `<section class="wb-card vp-controls"><h3>Copying evidence on the page</h3><p class="wb-small">Read the whole page in its written line order. Click any highlighted eligible word. Blue outlines mark earlier spelling candidates, orange marks the selected word, and green marks later occurrences of that exact spelling <b>on this same page</b>. Dashed arrows are spelling relations, not recovered copying acts.</p><div class="wb-fields">
      ${field('vp-rule', 'Forms', select('vp-rule', [['CHOL_SHOL','chol / shol / chor / shor frames'],['CHEO','All bench-before-o frames (includes rare words)']], state.copyRule))}
      ${field('vp-scope', 'Earlier donor window', select('vp-scope', [['page','Anywhere earlier on this page'],['local3','Previous 3 lines'],['local10','Previous 10 lines'],['normalPage','Usual generator page pool']], state.copyScope))}
      ${field('vp-event', 'Selected occurrence', select('vp-event', events.map(e=>[e.id, `${e.page}:${e.target.locus} · ${e.word} · word ${e.target.tokenIndex+1}${e.sectionCount===1?' · hapax':''}`]), selected?.id || ''), 'wide')}
      ${check('vp-all', 'Draw all earlier candidates', state.copyAll, 'The nearest earlier candidate is linked by default. Other eligible earlier words remain outlined; this control draws every candidate arrow.')}
      </div><div class="wb-actions vp-examples"><button class="wb-button" data-vp-example="f5v">1b · f5v</button><button class="wb-button" data-vp-example="f24r">1.5a · f24r</button><button class="wb-button" data-vp-example="f88r">2a · f88r</button><button class="wb-button" data-vp-example="f100v">Rare example · f100v</button><button class="wb-button" id="vp-generator">Actual generator · complete pages</button><button class="wb-button" id="vp-jump">Show page ↓</button></div></section>`;
  }
  function copyPageNote(cp) {
    if (!state.copying) return '';
    if(embedded && cp?.events.length && !cp.chosen)return '<p class="vp-note wb-small">Companion page on this bifolium. Its full text, variants and count classes remain visible. Select a highlighted word to inspect its local copying candidates.</p>';
    if (!cp?.chosen) return '<p class="vp-note">No eligible trace target on this page in the 1b → 1.5a → 2a study. Other page text remains visible.</p>';
    const e = cp.chosen, src = e.source, later = e.later || [], all = cp.events;
    const where = r => `${r.word} (${r.locus}, word ${r.tokenIndex+1})`;
    const earlier = e.earlierExact || [];
    const previous = earlier.length ? `<p class="vp-prior"><b>This spelling already occurs earlier on this page:</b> ${earlier.map(where).map(esc).join('; ')}. The selected token is a recurrence.</p>` : `<p class="vp-prior">This is the first occurrence of this exact spelling on this page${e.firstVariantOnPage ? '.' : '; its e/no-e variant already occurs in this frame.'} That does not identify how it was produced.</p>`;
    return `<div class="vp-note"><div class="vp-page-stats">${all.filter(e=>e.new).length}/${all.length} e-bearing · ${all.filter(e=>e.sectionCount===1).length} section hapaxes · ${all.filter(e=>e.source).length}/${all.length} targets have an earlier opposite-variant candidate in the chosen window.</div>${previous}<div class="vp-key"><span class="vp-source-label">${src ? esc(where(src)) : 'No earlier same-page candidate'}</span><span> ⇢ </span><strong class="vp-target-label">${esc(where(e.target))}</strong><span> ⇢ </span><span class="vp-later-label">${later.length ? later.map(where).map(esc).join('; ') : 'No later exact repetition on this page'}</span></div><p class="wb-small">${e.candidates.length} earlier candidate${e.candidates.length===1?'':'s'}; ${later.length} later exact occurrence${later.length===1?'':'s'}. ${e.sectionCount===1?'The selected spelling occurs once in this section.':'The selected spelling occurs '+e.sectionCount+' times in this section.'} Words elsewhere on the page are retained so the local alternatives remain visible.</p></div>`;
  }

  // ---------------------------------------------------------------- the pages
  function tokenHtml(t, x, p) {
    const r = t.vars[x.v.key], cls = ['va-tok', t.cls === '1' ? 'va-c1' : t.cls === '10+' ? 'va-c10' : 'va-cmid'];
    const colKey = p.col;
    let text = esc(t.w), title;
    if (r) {
      cls.push(VF.isNew(x.v, r) ? 'va-new' : 'va-old');
      const pre = t.units.slice(0, r.site[0]).join(''), mid = t.units.slice(r.site[0], r.site[1]).join(''), post = t.units.slice(r.site[1]).join('');
      text = `${esc(pre)}<b>${esc(mid)}</b>${esc(post)}`;
      title = `${t.w} · ${num(t.count)} token${t.count === 1 ? '' : 's'} in ${colKey} (${CLASS_NAME[t.cls]}) · ${x.v.key}: ${x.v.labels[r.variant] || r.variant}${VF.isNew(x.v, r) ? ' (innovative)' : ''} · family “${r.family}” · sub-environment ${r.sub}`;
    } else { cls.push('va-na'); title = `${t.w} · ${num(t.count)} token${t.count === 1 ? '' : 's'} in ${colKey} · not eligible for ${x.v.key}`; }
    const rel = x.rel.get(p.folio).rel.get(t.index);
    if (rel) title += ` · nearest one-unit relative on the page: ${rel.token.w} (${rel.lineDist === 0 ? 'same line' : `${rel.lineDist} line${rel.lineDist === 1 ? '' : 's'} ${rel.token.line < t.line ? 'above' : 'below'}`}${rel.siteEdit ? ', the edit is the variable’s site' : ''})`;
    const cp = x.copy.get(p.folio), event = cp?.eventByToken.get(t.index), role = cp?.roles.get(t.index);
    if (state.copying && !embedded && !event) { for (const c of ['va-new','va-old']) { const i=cls.indexOf(c); if(i>=0)cls.splice(i,1); } cls.push('va-na'); }
    if (cp?.chosen?.earlierExact?.some(r=>r.index===t.index)) { cls.push('vp-existing'); title += ' · this exact spelling already precedes the selected token on this page'; }
    if (role?.role && role.role !== 'eligible') { cls.push('vp-' + role.role); title += ' · ' + ({source:'earlier same-page spelling candidate',target:'selected occurrence',later:'later exact spelling on this page'}[role.role] || role.role); }
    if (event) cls.push('vp-selectable');
    return `<span class="${cls.join(' ')}" data-i="${t.index}" ${event ? `data-copy-event="${esc(event.id)}" role="button" tabindex="0" aria-label="Inspect ${esc(t.w)} on ${esc(p.folio)} line ${esc(event.target.locus)} word ${event.target.tokenIndex + 1}"` : ''} title="${esc(title)}">${text}</span>`;
  }
  function pageCard(p, x, note = '') {
    const pg = x.stats[p.col].pages[p.folio], S = x.rel.get(p.folio).stats, shares = VF.lineShares(p, x.v);
    const linesHtml = p.lines.map((l, i) => {
      const [k, n] = shares[i];
      const strip = n ? `<span class="va-strip" title="${k} of ${n} eligible tokens on this line show ${esc(x.v.newVariants.join('/'))}"><i style="width:${(100 * k / n).toFixed(0)}%"></i></span>` : `<span class="va-strip empty" title="no eligible token on this line"></span>`;
      return `<div class="va-line"><span class="va-ln" title="line ${esc(l.locus)}${l.first ? ', paragraph start' : ''}">${esc(l.locus)}${l.first ? '¶' : ''}</span>${strip}<span class="va-words">${l.tokens.map(t => tokenHtml(t, x, p)).join('')}</span></div>`;
    }).join('');
    const head = `<h3>${esc(p.folio)} <span class="wb-small">${note ? esc(note) + ' · ' : ''}hand ${esc(p.hand)} · ${esc(p.col)} ${esc(SHORT[p.col] || '')} · ${num(pg.n)} ${state.copying?'all-CHEO eligible':'eligible'} of ${num(p.tokens.length)} · 10+ words ${pct(pg.k10, pg.n10)} (${num(pg.n10)}) · hapaxes ${pct(pg.k1, pg.n1)} (${num(pg.n1)})</span></h3>`;
    const relLine = `<p class="wb-small">Section hapaxes ${num(S.hapaxes)}: ${num(S.withRelative)} with a word within one unit edit somewhere on the page, ${num(S.within)} within ${VF.WINDOW} lines (${S.above} above, ${S.same} same line, ${S.below} below), ${num(S.siteEdits)} with the edit at the ${esc(x.v.key)} site.</p>`;
    return `<section class="wb-card va-page ${state.copying ? 'vp-copy-page' : ''}" data-folio="${esc(p.folio)}">${head}${copyPageNote(x.copy.get(p.folio))}<div class="va-text va-${esc(state.size)} ${state.mark ? '' : 'va-nomark'}">${linesHtml}<svg class="va-links" aria-hidden="true"></svg></div>${state.copying ? '' : relLine}</section>`;
  }
  function missingCard(folio, note) {
    const cls = classOf(folio);
    return `<section class="wb-card va-page va-missing"><h3>${esc(folio)} <span class="wb-small">${esc(note)} · no paragraph text in the chain’s columns${cls ? ` (class ${esc(cls)})` : ''}</span></h3></section>`;
  }
  function facesHtml(x) {
    if (!x.faces) return '<div class="wb-notice">This sheet key names no pair of leaves.</div>';
    const {a, b, inner, outer} = x.faces;
    const card = f => { const p = x.D.pages.get(f), q = VF.parseFolio(f), conj = q ? (q.n === a ? b : a) : null; const note = q ? `leaf ${q.n}${q.side === 'r' ? ' recto' : ' verso'}${q.panel ? ' panel ' + q.panel : ''}, conjugate of leaf ${conj}` : ''; return p ? pageCard(p, x, note) : missingCard(f, note); };
    const face = (name, folios, what) => `<div class="va-face"><div class="va-face-head"><b>${name}</b> <span class="wb-small">${what}: ${folios.length ? folios.map(esc).join(' · ') : 'no page'}</span></div><div class="va-pages va-two">${folios.map(card).join('')}</div></div>`;
    return face(`Inner face of ${esc(x.sheet)}`, inner, `leaf ${a} verso, then leaf ${b} recto, as the sheet lies open`) + face(`Outer face of ${esc(x.sheet)}`, outer, `leaf ${b} verso, then leaf ${a} recto, the sheet turned over`);
  }
  function drawLinks(x) {
    if (!host) return;
    for (const card of host.querySelectorAll('.va-page')) {
      const text = card.querySelector('.va-text'), svg = card.querySelector('.va-links'); if (!text || !svg) continue;
      const box = text.getBoundingClientRect(), parts = [];
      svg.setAttribute('viewBox', `0 0 ${Math.max(1, box.width)} ${Math.max(1, box.height)}`);
      if (state.links && !state.copying) {
        const R = x.rel.get(card.dataset.folio); if (!R) continue;
        for (const [i, rel] of R.rel) {
          const a = text.querySelector(`[data-i="${i}"]`), b = text.querySelector(`[data-i="${rel.j}"]`); if (!a || !b) continue;
          const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
          const x1 = ra.left + ra.width / 2 - box.left, y1 = ra.top - box.top + (rb.top < ra.top ? 0 : ra.height), x2 = rb.left + rb.width / 2 - box.left, y2 = rb.top - box.top + (rb.top < ra.top ? rb.height : 0);
          const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 + (rb.top < ra.top ? -14 : 14) * Math.min(1, Math.abs(y2 - y1) / 40 + 0.4);
          parts.push(`<path class="va-link ${rel.siteEdit ? 'site' : ''} ${rel.within ? '' : 'far'}" d="M${x1.toFixed(1)} ${y1.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}"></path>`);
        }
      }
      const cp = x.copy.get(card.dataset.folio);
      if (state.copying && cp) {
        let candidateSeen = false;
        for (const link of cp.links) {
          if (link.kind === 'candidate' && candidateSeen && !state.copyAll) continue;
          if (link.kind === 'candidate') candidateSeen = true;
          const a = text.querySelector(`[data-i="${link.from}"]`), b = text.querySelector(`[data-i="${link.to}"]`); if (!a || !b) continue;
          const ra=a.getBoundingClientRect(), rb=b.getBoundingClientRect();
          const x1=ra.left+ra.width/2-box.left,y1=ra.bottom-box.top,x2=rb.left+rb.width/2-box.left,y2=rb.top-box.top;
          const bend=Math.max(14,Math.min(50,Math.abs(y2-y1)*.3));
          parts.push(`<path class="vp-arrow ${link.kind}" d="M${x1} ${y1} C${x1+bend} ${y1+bend},${x2+bend} ${y2-bend},${x2} ${y2}"></path><circle class="vp-end ${link.kind}" cx="${x2}" cy="${y2}" r="2.5"></circle>`);
        }
      }
      svg.innerHTML = parts.join('');
    }
  }

  // ---------------------------------------------------------------- the comparison, the group's figures, the legend
  function sheetsCard(x) {
    const c = comparison(x.v);
    const rows = Object.entries(c.kinds).map(([k, r]) => `<tr class="${k === 'sameFace' || k === 'facing' ? 'va-key-row' : ''}"><td class="wrap">${esc(KIND_NAME[k])}</td><td>${num(r.n)}</td><td>${f3(r.mean)}</td></tr>`).join('');
    return `<section class="wb-card"><h3>Conjugate pages against facing pages <span class="wb-small">${esc(x.v.key)}, the whole chain: mean absolute difference of the page share (all eligible tokens; ${num(c.pages)} pages with 15 or more)</span></h3>
      <table class="wb-table ch-table"><thead><tr><th>pair</th><th>pairs</th><th>mean |Δ share|</th></tr></thead><tbody>${rows}<tr><td class="wrap">the same pairs with the pages’ shares shuffled within their chain group</td><td></td><td>${f3(c.shuffled)}</td></tr></tbody></table>
      <p class="wb-small">Among the ${num(c.decided)} pages with both a same-face partner and a facing partner in the bound book, the same-face partner is the closer one for ${c.closer == null ? '–' : Math.round(100 * c.closer) + '%'}. If the text was written sheet by sheet, the pages of one sheet agree beyond their group’s convention (below the shuffled line) and the pages that only face each other in the bound book do not. Golf’s groups were cut on pooled sheets, so the facing pairs often cross groups by construction; the shuffled line, which keeps every page in its group, is the fair baseline for the same-sheet pairs.</p></section>`;
  }
  function figuresCard(x) {
    const C = x.stats[x.col.key];
    const rows = VF.CLASSES.map(k => { const [a, n] = C.classes[k]; return `<tr><td>${esc(CLASS_NAME[k])}</td><td>${num(n)}</td><td>${pct(a, n)}</td></tr>`; }).join('');
    const pageRows = x.pages.map(f => { const pg = C.pages[f], p = x.D.pages.get(f), on = x.shown.some(s => s.folio === f); return `<tr class="ch-row ${on ? 'on' : ''}" data-va-page="${esc(f)}"><td>${esc(f)}${on ? ' ◂' : ''}</td><td>${esc(p.sheet)}</td><td>${esc(p.hand)}</td><td>${num(pg.n)}</td><td>${pct(pg.k10, pg.n10)} <span class="wb-small">(${num(pg.n10)})</span></td><td>${pct(pg.k1, pg.n1)} <span class="wb-small">(${num(pg.n1)})</span></td></tr>`; }).join('');
    return `<section class="wb-card ch-side"><h3>${esc(x.col.key)} ${esc(SHORT[x.col.key] || '')}: share of ${esc(x.v.newVariants.join('/'))} by count class</h3>
      <table class="wb-table ch-table"><thead><tr><th>class</th><th>eligible</th><th>innovative</th></tr></thead><tbody>${rows}</tbody></table>
      <h4>Pages of the group (click to show)</h4><div class="wb-scroll"><table class="wb-table ch-table"><thead><tr><th>page</th><th>sheet</th><th>hand</th><th>eligible</th><th>10+ words</th><th>hapaxes</th></tr></thead><tbody>${pageRows}</tbody></table></div></section>`;
  }
  function legendCard(x) {
    const docs = root.EchoDocs ? [root.EchoDocs.link('solve/botanical_enrichment/echo_section_connections/RESULTS.md', 'RESULTS §11'), root.EchoDocs.link('solve/botanical_enrichment/echo_section_connections/RESEARCH.md', 'RESEARCH.md')].filter(Boolean).join(' · ') : '';
    return `<section class="wb-card"><div class="ch-legend">
      <span class="ch-key"><i class="va-k new"></i> ${esc(x.v.newVariants.map(n => x.v.labels[n] || n).join(' / '))} (innovative)</span>
      <span class="ch-key"><i class="va-k old"></i> ${esc(Object.keys(x.v.labels).filter(k => !x.v.newVariants.includes(k)).map(k => x.v.labels[k]).join(' / '))}</span>
      <span class="ch-key"><i class="va-k na"></i> not eligible</span>
      <span class="ch-key"><i class="va-k c10"></i> 10+ tokens in the group</span>
      <span class="ch-key"><i class="va-k cmid"></i> 2–9</span>
      <span class="ch-key"><i class="va-k c1"></i> section hapax</span>
      <span class="ch-key"><i class="va-k strip"></i> the line’s innovative share</span>
      <span class="ch-key"><i class="va-k link"></i> hapax → nearest one-unit relative</span>
      <span class="ch-key"><i class="va-k link site"></i> the edit is the site</span></div>
      <details class="ch-about"><summary>What to look for</summary><p class="wb-small">The frequent words of a group take the group’s variant almost without exception (the strong fills are one colour); the hapaxes are mixed in every group (the dashed outlines come in both colours). Along the chain the frequent words swing between 0% and 100% while the hapaxes stay near the middle. Inside a page the variants come in pockets: the line strips show runs of one colour. A hapax with the “wrong” variant stands among words of its own variant, and its nearest one-unit relative on the page almost always shares the variant (grey curves); a relative that differs exactly at the site (red, dashed) is rare, and relatives sit above and below alike. A bifolium laid flat shows whether the two leaves of one sheet agree with each other better than with the pages they face in the bound book. Counts and classes are those of the regularity study (${docs || 'solve/botanical_enrichment/echo_section_connections'}); every number here is reproduced by variants_flow.js from the app’s own data. The order is Golf 2.1’s working order, not an established chronology.</p></details></section>`;
  }

  function embeddedMarkup(x,nav,body) {
    const overview=(name,pages)=>`<div class="ev-face-map"><b>${name}</b><div style="grid-template-columns:repeat(${pages.length},minmax(0,1fr))">${pages.map(f=>{const p=x.D.pages.get(f),s=p&&x.stats[p.col]?.pages[f];return `<button class="${f===state.page?'on':''}" data-va-page="${esc(f)}"><strong>${esc(f)}</strong><span>${p?`${p.col} · hand ${p.hand}`:'no paragraph text'}</span><span>${s?`${s.n} CHEO · ${pct(s.k1,s.n1)} hapax e-share`:''}</span></button>`;}).join('')}</div></div>`;
    const panels=Math.max(x.faces?.inner.length||1,x.faces?.outer.length||1);
    return `<section class="ev-bifolium"><div class="ct-card-title"><h3>Manuscript bifolium · ${esc(x.sheet||'')}</h3><p>Both faces · conjugate leaves · ${x.shown.length} text panels</p></div><p class="ct-small">The original Variants bifolium view, embedded in this study. Each face keeps its folio panels together. Colour and frequency classes remain visible on every leaf; copying arrows belong only to the selected occurrence and stay on its page. Physical adjacency is not assumed to establish copying order.</p><div class="wb-fields">
      ${field('ev-group','Section',select('ev-group',[['1b','1b · Early A'],['1.5a','1.5a · Transitional A'],['2a','2a · Late A / Pharma']],x.col.key))}
      ${field('ev-sheet','Bifolium',select('ev-sheet',x.sheets.map(s=>[s,s]),x.sheet))}
      ${field('ev-size','Text',select('ev-size',SIZES,state.size))}
      ${check('ev-all','All earlier candidate links',state.copyAll,'Show every earlier same-page opposite-variant candidate; manuscript arrows remain tentative.')}
      </div><p class="ct-small">Colours and line strips show all CHEO forms: orange includes e; blue has no e. Strong fills mark 10+ occurrences, thin outlines 2–9, dashed outlines section hapaxes. Clickable words belong to the selected rule family. Blue, orange and green outer outlines identify the earlier candidates, selected occurrence and later exact repeats.</p>${x.faces?overview('Inner face',x.faces.inner)+overview('Outer face',x.faces.outer):''}<div class="wb-actions"><button class="wb-button" id="ev-selected-page">Selected page · ${esc(state.page)} ↓</button><span class="ct-small">Both faces remain below; wide foldouts scroll horizontally.</span></div>${nav}<div class="ev-spread"><div class="ev-spread-inner" style="--ev-panels:${panels}">${body}</div></div></section>`;
  }
  function setEmbedded(options={}) {
    embedded=true;state.trace=false;state.generatorPages=false;state.copying=true;state.variable='CHEO';state.layout='bifolium';
    const page=options.page||state.page||'f88r',p=data().pages.get(page);
    state.page=page;state.group=p?.col||options.group||state.group;state.sheet=p?.sheet||state.sheet;
    if(options.rule)state.copyRule=options.rule;
    if(options.scope)state.copyScope=['page','local3','local10','normalPage'].includes(options.scope)?options.scope:'page';
    if(options.eventId!==undefined)state.copyEvent=options.eventId;
    if(options.size)state.size=options.size;
    if(options.onSelect)onEmbeddedSelect=options.onSelect;
    return api;
  }

  function render() {
    if (!host) return;
    if (state.generatorPages && root.EchoGeneratorPages) {
      root.EchoGeneratorPages.show(host, () => { state.generatorPages = false; root.EchoGeneratorPages.leave(); render(); });
      return;
    }
    if (state.trace && root.EchoCopyingTrace) {
      root.EchoCopyingTrace.show(host, () => {
        state.trace=false;
        root.EchoCopyingTrace.leave(); render();
      });
      return;
    }
    const my = ++ticket;
    try {
      const x = model();
      let body, nav;
      if (state.layout === 'bifolium') {
        const L = x.sheet ? VF.sheetLeaves(x.sheet) : null;
        nav = `<div class="wb-actions va-nav"><button class="wb-button" id="va-prev" ${x.si === 0 ? 'disabled' : ''}>◂ previous bifolium on the path</button><span class="wb-small">bifolium ${x.si + 1} of ${x.sheets.length} in ${esc(x.col.key)}${x.sheet ? ` · ${esc(x.sheet)}${L ? ` · leaves ${L[0]} and ${L[1]} are conjugate` : ''}` : ''}</span><button class="wb-button" id="va-next" ${x.si + 1 >= x.sheets.length ? 'disabled' : ''}>next bifolium ▸</button></div>`;
        body = x.sheet ? facesHtml(x) : '<div class="wb-notice">This group has no paragraph pages.</div>';
      } else {
        nav = `<div class="wb-actions va-nav"><button class="wb-button" id="va-prev" ${x.i === 0 ? 'disabled' : ''}>◂ earlier pages</button><span class="wb-small">pages ${x.i + 1}–${Math.min(x.pages.length, x.i + state.n)} of ${x.pages.length} in ${esc(x.col.key)}</span><button class="wb-button" id="va-next" ${x.i + state.n >= x.pages.length ? 'disabled' : ''}>later pages ▸</button></div>`;
        body = x.shown.length ? `<div class="va-pages">${x.shown.map(p => pageCard(p, x)).join('')}</div>` : '<div class="wb-notice">This group has no paragraph pages.</div>';
      }
      if(embedded){host.innerHTML=embeddedMarkup(x,nav,body);bind(x);drawLinks(x);setTimeout(()=>{if(my===ticket)drawLinks(x);},0);return;}
      const intro=state.copying ? 'Inspect the same-page copying claim in the complete paragraph text. Earlier forms, the selected occurrence and later repetitions stay in their page context; previous appearances of the selected spelling remain visible. Compare 1b, 1.5a and 2a, or open the actual generator’s complete pages.' : 'One site where a scheduled operation acts, read as a variable: every eligible token of a bifolium or of a few pages coloured by the variant it shows and marked by how often the word occurs in its group, with the innovative share of the frequent words against the section hapaxes along the chain. No mass is conserved and nothing is paired: a hapax counts because it is eligible and shows one variant or the other.';
      host.innerHTML = `<div class="wb-wrap"><div class="wb-heading"><div><div class="wb-eyebrow">The rules on the page</div><h2>Variants</h2><p>${intro}</p></div></div>
        <div class="ct-mode"><button class="on" aria-pressed="true">Variant pages</button><button id="va-open-copy" class="${state.copying?'on':''}" aria-pressed="${state.copying}">Copying evidence on page</button><button id="va-open-trace" aria-pressed="false">Copying study <span>1b → 1.5a → 2a</span></button></div>
        ${state.copying ? `<details class="wb-card vp-settings"><summary>Page settings · ${esc(x.col.key)} · ${esc(state.layout)}</summary>${controls(x)}</details>${copyControls(x)}${nav}${body}<details class="wb-card"><summary>Section overview, count classes and page comparisons</summary>${stripCard(x)}${legendCard(x)}<div class="ch-below">${sheetsCard(x)}${figuresCard(x)}</div></details>` : `${controls(x)}${stripCard(x)}${legendCard(x)}${nav}${body}<div class="ch-below">${sheetsCard(x)}${figuresCard(x)}</div>`}</div>`;
      if (my === ticket) { bind(x); drawLinks(x); setTimeout(() => { if (my === ticket) drawLinks(x); }, 0); }
    } catch (e) { host.innerHTML = `<div class="wb-wrap"><div class="wb-error">${esc(e.message)}</div></div>`; console.error(e); }
  }
  function bind(x) {
    if(embedded){
      const choose=(page)=>{const p=x.D.pages.get(page);if(!p)return;const events=root.ECHO_COPYING_TRACE_DATA.manuscript.events.filter(e=>e.page===page&&e.ruleIds.includes(state.copyRule));const e=events.find(e=>e.new)||events[0];if(e&&onEmbeddedSelect){onEmbeddedSelect(e.id);return;}state.page=page;state.sheet=p.sheet;state.copyEvent=e?.id||'';render();};
      const navigate=(update)=>{update();state.page='';state.copyEvent='';const m=model();const p=m.shown.find(p=>m.copy.get(p.folio)?.events.length)||m.shown[0];if(p)choose(p.folio);else render();};
      const listen=(id,fn)=>{const el=host.querySelector('#'+id);if(el)el.onchange=fn;};
      listen('ev-group',e=>navigate(()=>{state.group=e.target.value;state.sheet='';}));
      listen('ev-sheet',e=>navigate(()=>{state.sheet=e.target.value;}));
      listen('ev-size',e=>{state.size=e.target.value;render();});
      listen('ev-all',e=>{state.copyAll=e.target.checked;render();});
      const selectedPage=host.querySelector('#ev-selected-page');
      if(selectedPage)selectedPage.onclick=()=>host.querySelector(`[data-folio="${state.page}"]`)?.scrollIntoView({block:'start',inline:'nearest',behavior:'instant'});
      const prev=host.querySelector('#va-prev'),next=host.querySelector('#va-next');
      if(prev)prev.onclick=()=>navigate(()=>{state.sheet=x.sheets[Math.max(0,x.si-1)];});
      if(next)next.onclick=()=>navigate(()=>{state.sheet=x.sheets[Math.min(x.sheets.length-1,x.si+1)];});
      host.onclick=e=>{const t=e.target.closest('[data-copy-event]'),p=e.target.closest('[data-va-page]');if(t){if(onEmbeddedSelect)onEmbeddedSelect(t.dataset.copyEvent);else{state.copyEvent=t.dataset.copyEvent;const event=root.ECHO_COPYING_TRACE_DATA.manuscript.events.find(x=>x.id===state.copyEvent);if(event)state.page=event.page;render();}}else if(p)choose(p.dataset.vaPage);};
      host.onkeydown=e=>{const t=e.target.closest('[data-copy-event]');if(t&&(e.key==='Enter'||e.key===' ')){e.preventDefault();t.click();}};
      bind.resize=bind.resize||(()=>{if(host&&bind.last)drawLinks(bind.last);});bind.last=x;root.removeEventListener('resize',bind.resize);root.addEventListener('resize',bind.resize);
      return;
    }
    const trace = host.querySelector('#va-open-trace');
    if (trace) trace.onclick = () => { state.trace = true; render(); };
    const copy = host.querySelector('#va-open-copy');
    if (copy) copy.onclick = () => { state.copying = !state.copying; if (state.copying) state.variable='CHEO'; render(); };
    const on = (id, key, map = v => v, after) => { const el = host.querySelector('#' + id); if (el) el.onchange = () => { state[key] = map(el.type === 'checkbox' ? el.checked : el.value); if (after) after(); render(); }; };
    on('va-var', 'variable', v=>v, ()=>{if(state.variable!=='CHEO')state.copying=false;}); on('va-group', 'group', v => v, () => { state.page = ''; state.sheet = ''; }); on('va-layout', 'layout'); on('va-sheet', 'sheet'); on('va-page', 'page'); on('va-n', 'n', Number);
    on('va-size', 'size'); on('va-strip', 'strip'); on('va-order', 'order', v => v, () => { state.page = ''; state.sheet = ''; }); on('va-mark', 'mark', Boolean); on('va-links', 'links', Boolean);
    on('vp-rule','copyRule',v=>v,()=>{state.copyEvent='';}); on('vp-scope','copyScope'); on('vp-event','copyEvent'); on('vp-all','copyAll',Boolean);
    const prev = host.querySelector('#va-prev'), next = host.querySelector('#va-next');
    if (state.layout === 'bifolium') {
      if (prev) prev.onclick = () => { state.sheet = x.sheets[Math.max(0, x.si - 1)]; render(); };
      if (next) next.onclick = () => { state.sheet = x.sheets[Math.min(x.sheets.length - 1, x.si + 1)]; render(); };
    } else {
      if (prev) prev.onclick = () => { state.page = x.pages[Math.max(0, x.i - state.n)]; render(); };
      if (next) next.onclick = () => { state.page = x.pages[Math.min(x.pages.length - 1, x.i + state.n)]; render(); };
    }
    host.onclick = e => {
      const token=e.target.closest('[data-copy-event]'), example=e.target.closest('[data-vp-example]');
      if(token){state.copyEvent=token.dataset.copyEvent;render();return;}
      if(example){const f=example.dataset.vpExample;const examples={f5v:['1b','CHEO','f5v:1:3'],f24r:['1.5a','CHOL_SHOL','f24r:7:4'],f88r:['2a','CHOL_SHOL','f88r:13:2'],f100v:['2a','CHEO','f100v:8:9']};[state.group,state.copyRule,state.copyEvent]=examples[f];state.page=f;state.sheet=x.D.pages.get(f)?.sheet||'';state.copying=true;state.variable='CHEO';render();return;}
      if(e.target.closest('#vp-generator')){state.generatorPages=true;render();return;}
      if(e.target.closest('#vp-jump')){host.querySelector('.va-page')?.scrollIntoView({block:'start',behavior:'instant'});return;}
      const row = e.target.closest('[data-va-page]'); if (row) { const f = row.dataset.vaPage; state.page = f; const p = x.D.pages.get(f); if (p && p.sheet) state.sheet = p.sheet; render(); }
    };
    host.onkeydown=e=>{const t=e.target.closest('[data-copy-event]');if(t&&(e.key==='Enter'||e.key===' ')){e.preventDefault();state.copyEvent=t.dataset.copyEvent;render();}};
    bind.resize = bind.resize || (() => { if (host && bind.last) drawLinks(bind.last); });
    bind.last = x;
    root.removeEventListener('resize', bind.resize); root.addEventListener('resize', bind.resize);
  }

  const R = () => root.EchoViewState.read;
  const api = {
    setEmbedded,
    showEmbedded(el,options){setEmbedded(options);host=el;render();},
    inspect:{model},
    show(el) { host = el; render(); },
    refresh() { if (host) render(); },
    leave() { if(bind.resize)root.removeEventListener('resize',bind.resize);host = null; ticket++; if(!embedded){root.EchoCopyingTrace?.leave(); root.EchoGeneratorPages?.leave();} },
    view() { return {var: state.variable, group: state.group, layout: state.layout, sheet: state.sheet, page: state.page, n: state.n, mark: state.mark ? 1 : 0, links: state.links ? 1 : 0, size: state.size, order: state.order, strip: state.strip, trace: state.trace ? 1 : 0, copying: state.copying?1:0, copyRule:state.copyRule,copyScope:state.copyScope,copyEvent:state.copyEvent,copyAll:state.copyAll?1:0,generatorPages:state.generatorPages?1:0, ...(state.trace ? root.EchoCopyingTrace?.view() : {})}; },
    applyView(p) {
      const r = R();
      const trace = r.flag(p.trace); if (trace !== undefined) state.trace = trace;
      if(!embedded)root.EchoCopyingTrace?.applyView(p);
      const v = r.oneOf(p.var, VF.VARIABLES.map(v => v.key)); if (v) state.variable = v;
      const g = r.text(p.group, 8); if (g) state.group = g;
      const layout = r.oneOf(p.layout, LAYOUTS.map(l => l[0])); if (layout) state.layout = layout;
      const sheet = r.text(p.sheet, 12); if (sheet !== undefined) state.sheet = sheet;
      const page = r.text(p.page, 12); if (page !== undefined) state.page = page;
      const n = r.number(p.n, 1, 6); if (n) state.n = Math.round(n);
      const mark = r.flag(p.mark); if (mark !== undefined) state.mark = mark;
      const links = r.flag(p.links); if (links !== undefined) state.links = links;
      const size = r.oneOf(p.size, SIZES.map(s => s[0])); if (size) state.size = size;
      const order = r.oneOf(p.order, ORDERS.map(o => o[0])); if (order) state.order = order;
      const strip = r.oneOf(p.strip, STRIPS.map(s => s[0])); if (strip) state.strip = strip;
      const copying=r.flag(p.copying);if(copying!==undefined)state.copying=copying;
      const cr=r.oneOf(p.copyRule,['CHOL_SHOL','CHEO']);if(cr)state.copyRule=cr;
      const cs=r.oneOf(p.copyScope,['page','local3','local10','normalPage']);if(cs)state.copyScope=cs;
      const ce=r.text(p.copyEvent,100);if(ce!==undefined)state.copyEvent=ce;
      const ca=r.flag(p.copyAll);if(ca!==undefined)state.copyAll=ca;
      const gp=r.flag(p.generatorPages);if(gp!==undefined)state.generatorPages=gp;
      if(state.copying)state.variable='CHEO';
    },
  };
  return api;
  }
  root.EchoVariants=createView();
  root.EchoVariants.createEmbedded=createView;
})(typeof window !== 'undefined' ? window : globalThis);
