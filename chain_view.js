/* Chain tab: a word, its family or a pattern along Golf's proposed order, as ribbons with the active rules' matched
 * mass between neighbouring groups, and an inspector for the selected spelling or step. All counting, scopes,
 * ledgers and geometry are in chain_flow.js; this file only renders them. Direction along the order is the user's
 * working assumption, said on screen; the step ledgers are capacity bounds, never a history of tokens.
 */
(function (root) {
  'use strict';
  const CF = root.EchoChainFlow;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const f1 = v => (Math.abs(v) < 0.05 ? '0' : v.toFixed(1));
  const num1 = v => Number(Math.abs(v) < 0.05 ? 0 : v).toLocaleString('en-US', {minimumFractionDigits: 1, maximumFractionDigits: 1});
  const pct = v => (v * 100).toFixed(v * 100 >= 10 ? 0 : 1) + '%';
  const num = v => Number(v).toLocaleString('en-US');
  const SCOPES = [['family', 'Rule family'], ['front', 'Same front (stem)'], ['tail', 'Same ending'], ['pattern', 'Pattern']];
  const AXES = [['groups', 'Golf 2.1 groups, evenly spaced'], ['groupsPos', 'Golf 2.1 groups at path positions'], ['pools', 'Bifolia by rank'], ['poolsPos', 'Bifolia at path positions']];
  const ORDERS = [['alternate', 'Stars-T → Stars-S → Bio (… 3c → 4c → 4a; the default)'], ['proposed', 'Golf’s proposed terminal: Stars-T → Bio → Stars-S (… 3c → 4a → 4c)']];
  const ORDER_NOTE = {proposed: 'Golf’s proposed order (its proposed curve: Stars-T, then Bio, then Stars-S)', alternate: 'Golf’s proposed order with the Stars-T, Stars-S and Bio bifolia placed as on Golf’s alternate curve (Stars-T, then Stars-S, then Bio; the alternate curve’s different Early-A start is not used)'};
  const MEASURES = [['per10k', 'Per 10k words'], ['share', 'Share of the set']];
  const RIBBONS = [6, 9, 12, 16, 24].map(n => [String(n), `${n} largest`]);
  const UNITS = [['spelling', 'Spellings'], ['tail', 'Endings'], ['front', 'Fronts'], ['bigram', 'Glyph bigrams'], ['rule', 'Rule labels (mass)']];
  const LINEAGES = [['off', 'Off'], ['kin', 'Ancestors and descendants'], ['full', 'Full: parallel chains too']];
  // Golf's candidate stretches for the lost folios (chain-gaps T3): drawn between the groups they fall between
  const LOST = [{after: '2a', afterMiddle: true, label: 'lost f59–f64 here?', title: 'Golf’s missing-folio study places the lost inner-H folios f59–f64 here, between f58 and Herbal B (path 0.641–0.749); the e → d switch falls in this stretch', strong: true},
    {after: '1.5a', label: 'lost f91–f92, f97–f98 here?', title: 'Golf’s missing-folio study places the lost pharma folios f91–f92, f97–f98 across the 1.5a → 2a step (path 0.462–0.524)', strong: false},
    {after: '2a', beforeMiddle: true, label: 'or f91–f92, f97–f98 here?', title: 'Whether the lost pharma folios f91–f92, f97–f98 fall before or after 2a is uncertain. Golf’s missing-folio study places them across 1.5a → 2a; when the middle text separates 2a from 3a, both sides of 2a are marked', strong: false}];
  const UNIT_NOUN = {spelling: 'spelling', tail: 'ending', front: 'front', bigram: 'bigram', rule: 'rule'};
  const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);
  // short group names for the column headers (one or two lines); Golf's full label stays in the column's tooltip
  const SHORT = {'1a': ['Early A'], '1b': ['Early A'], '1.5a': ['Transitional A'], '2a': ['Late A / Pharma'], '3a': ['Herbal B', 'gallows-to-a'], '3b': ['Herbal B', 'gallows-to-e'],
    '3c': ['Stars-T'], '4a': ['Bio'], '4c': ['Stars-S'], '5a': ['Celestial'], '6': ['f58'], mid: ['f69r, f70r2, f58', 'paragraphs']};
  const SCOPE_NOTE = {
    family: 'the word and every spelling the active rules connect to it, as in Network’s family search',
    front: 'every spelling sharing the word’s front, up to and including the first gallows, else the first bench, else the opening run: the endings on one stem',
    tail: 'every spelling sharing the word’s ending: the fronts that carry it',
    all: 'every spelling of the paragraph text, all nine groups at once (the Word box is empty)',
    pattern: 'the spellings matching the pattern, in the Words & contexts syntax; each spelling is matched on its own, so terms about neighbours or line position do not apply'};
  const NOTATION = 'In the Rules column, a comma lists separate rules and + joins rules that are needed together.';
  const state = {q: 'chol', scope: 'family', unit: 'spelling', axis: 'groupsPos', order: 'alternate', middle: 'off', schedule: true, measure: 'per10k', bands: 12, mergeQ: false, flows: true, skips: true, lineage: 'kin', ruleFocus: true, keptSince: false, sel: [], step: null};
  const isSel = label => state.sel.includes(label), anySel = () => state.sel.length > 0;
  // a plain click selects one ribbon (or releases the only selected one); a shift-click adds it to the selection or removes it
  const toggleSel = (label, add) => { if (add) state.sel = isSel(label) ? state.sel.filter(l => l !== label) : state.sel.concat([label]); else state.sel = state.sel.length === 1 && isSel(label) ? [] : [label]; };
  let host = null, ticket = 0;
  const cache = new Map();

  const app = () => root.EchoApp;
  const M = () => root.ECHO_MANUSCRIPT, W = () => root.ECHO_WORKBENCH_DATA, CD = () => root.ECHO_CHAIN_DATA;
  const SCH = () => root.ECHO_CHAIN_SCHEDULE || null;
  const DEG = {1: ['●', 'f', 'full forward'], 0.5: ['◐', 'f', 'partial forward'], 0: ['–', 'o', 'off'], '-0.5': ['◑', 'r', 'partial reverse'], '-1': ['○', 'r', 'full reverse']};
  const degMark = v => DEG[String(v)] || DEG[0];
  // the schedule's degrees and directions of a drawn flow, in the key's words: 'schedule: full forward', 'schedule: partial reverse, at most half',
  // 'schedule: full and partial forward; partial at most half', 'schedule: full, forward and reverse'
  const degreeWords = routes => { const ds = [...new Set(routes.map(r => (Math.abs(r.degree) >= 1 ? 'full' : 'partial')))].sort(), dirs = [...new Set(routes.map(r => (r.degree < 0 ? 'reverse' : 'forward')))].sort(); const mixed = ds.length > 1 || dirs.length > 1; return `schedule: ${ds.join(' and ')}${dirs.length > 1 ? ', ' : ' '}${dirs.join(' and ')}${ds.includes('partial') ? (mixed ? '; partial at most half' : ', at most half') : ''}`; };
  const colourOf = i => `var(--ser-${root.EchoPageChart.AUTO_COLOURS[i % root.EchoPageChart.AUTO_COLOURS.length]})`;

  function columns() {
    const key = state.axis + '|' + state.order + '|' + state.mergeQ + '|' + state.middle;
    if (!cache.has(key)) {
      const m = M(), lines = W().lines.concat(m.extra_lines || []);        // the same lines Words & contexts reads
      cache.set(key, CF.columns({manuscript: m, lines, axis: state.axis, order: state.order, mergeQ: state.mergeQ, pools: CD() && CD().pools, middle: state.middle === 'steps' && CF.isGroups(state.axis)}));
    }
    return cache.get(key);
  }
  // the middle text's place along 2a → 3a, for the trace's pull: the median path position of its pools between the
  // medians of 2a's and 3a's pools (0.56 on Golf's proposed path)
  function middleP0() {
    const P = CD() && CD().pools; if (!P) return 0.5;
    const med = groups => { const v = Object.values(P).filter(p => groups.includes(p.group)).map(p => p.position).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };
    const a = med(['2a']), b = med(['3a']), m = med(CF.MIDDLE_GROUPS);
    return a != null && b != null && m != null && b > a ? Math.min(0.95, Math.max(0.05, (m - a) / (b - a))) : 0.5;
  }
  // the rules in force: the step schedule's rules when the schedule is on (each at its own steps and degrees), else
  // the active rules of the Rules button; their pairs as Network, Sections and Stages read them; on exact spellings a
  // pair keeps its q state
  const scheduled = () => (state.schedule && SCH() && CF.isGroups(state.axis) ? SCH() : null);
  function pairs(words, sched) {
    const rules = sched ? new Set(Object.keys(sched.rules).flatMap(k => [k, k.split('.')[0]])) : app().rules();   // a scheduled half (C1.1) enables its rule's pairs
    const p = root.EchoStageFlow.graphPairs(app().data, rules);
    return state.mergeQ ? p : CF.exactPairs(p, words);
  }
  function model() {
    const cols = columns();
    const scope = state.q.trim() ? state.scope : 'all';               // an empty Word box charts the whole paragraph text
    const m = CF.members({scope, query: state.q, mergeQ: state.mergeQ, spellings: cols.spellings, data: app().data, rules: app().rules(), splits: CD() && CD().splits});
    if (m.error) return {cols, m, scope};
    const words = [...m.words], sched = scheduled(), splits = CD() && CD().splits, units = (CD() && CD().units) || {}, by = state.unit;
    const own = CF.isGroups(state.axis) ? pairs(words, sched).filter(([a, b]) => m.words.has(a) && m.words.has(b) && a !== b) : [];
    const p0 = middleP0();
    const L0 = CF.isGroups(state.axis) ? CF.ledgers(cols, words, own, {schedule: sched, p0}) : CF.ledgers(cols, words, []);
    // the ribbons: one per spelling, per ending or front class of the saved split, or per glyph bigram (the ledger read as bigrams)
    const Lb = by === 'bigram' ? CF.bigramLedgers(L0, words, {units}) : null;
    // a selected ribbon pulls its partners out of the pooled band: every key a route links to it gets a band of its own
    let pin = [];
    if (anySel()) {
      if (by === 'bigram') pin = [...new Set(Lb.flatMap(s => s.routes.filter(r => isSel(r.from) !== isSel(r.to)).map(r => (isSel(r.from) ? r.to : r.from))))];
      else { const keyOf = w => CF.classKey(w, by, splits), mem = w => isSel(keyOf(w)); pin = [...new Set(L0.flatMap(s => s.routes.filter(r => mem(r.from) !== mem(r.to)).map(r => keyOf(mem(r.from) ? r.to : r.from))))]; }
    }
    const S = by === 'bigram' ? CF.bigramSeries(cols, words, {units, cap: state.bands, pin}) : CF.series(cols, words, {cap: state.bands, by, splits, pin});
    const L = by === 'bigram' ? Lb : L0;
    const RS = by === 'rule' ? CF.ruleSeries(L, {cap: state.bands}) : null;
    const seedLabel = m.seed && by !== 'bigram' ? CF.classKey(m.seed, by, splits) : null;
    const touching = new Set(own.flatMap(pr => (pr[3] || []).flatMap(code => code.split('+').map(c => c.split('.')[0]).concat(code.includes(' (via ') ? [code.split(' (via ')[0]] : []))));
    return {cols, m, words, S, L, L0, RS, sched, touching, seedLabel, by, scope, p0};
  }
  const setName = x => x.scope === 'all' ? 'All paragraph text' : state.scope === 'pattern' ? `“${state.q.trim()}”` : state.scope === 'family' ? `Rule family of ${x.m.seed}` : state.scope === 'front' ? `Front “${x.m.key}” (${x.m.seed})` : `Ending “${x.m.key}” (${x.m.seed})`;

  // ---------------------------------------------------------------- controls
  const select = (id, opts, cur) => `<select id="${id}">${opts.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  const help = text => `<span class="ch-help" title="${esc(text)}" tabindex="0" role="img" aria-label="${esc(text)}">?</span>`;
  const field = (id, text, html, cls = '', note = '') => `<div class="wb-field ${cls}"><label for="${id}">${text}${note ? help(note) : ''}</label>${html}</div>`;
  function controls() {
    const n = app().rules().size, groups = CF.isGroups(state.axis) ? '' : 'disabled';
    const scopeHelp = `The set: ${SCOPE_NOTE[state.q.trim() ? state.scope : 'all']}. Paragraph text only.`;
    const orderHelp = `${ORDER_NOTE[state.order]}. Left to right is read as writing order, earliest first: a working assumption, not an established fact; the studies could not choose between the two terminal orders.`;
    const schedHelp = SCH() ? `When ticked, the Echo chain ruleset’s ${Object.keys(SCH().rules).length} rules replace the Rules button’s selection: each runs only at its scheduled steps, forward (as written) or reverse (output to input), at full or partial degree; the Rules button then only chooses the family. Off: the ${n} active rules of the Rules button run at every step.` : 'No step schedule is loaded.';
    const check = (id, text, on, note, extra = '') => `<label class="ch-check"><input type="checkbox" id="${id}" ${on ? 'checked' : ''} ${extra}> ${text}${help(note)}</label>`;
    return `<div class="wb-card"><div class="wb-fields">
      ${field('ch-q', state.scope === 'pattern' ? 'Pattern' : 'Word', `<input id="ch-q" value="${esc(state.q)}" autocomplete="off" spellcheck="false" placeholder="${state.scope === 'pattern' ? '*edy' : 'e.g. chol; empty = all paragraph text'}">`, 'wide', 'A word, or a pattern under the Pattern scope. Empty: every spelling of the paragraph text, all nine groups at once.')}
      ${field('ch-scope', 'Scope', select('ch-scope', SCOPES, state.scope), '', scopeHelp)}
      ${field('ch-unit', 'Ribbons as', select('ch-unit', UNITS, state.unit), '', 'Each ribbon is a spelling; an ending or a front of the saved split; a glyph bigram; or a rule label. Ending/front: a route within one class stays inside its ribbon, as kept mass. Bigram: a spelling counts once per bigram it contains. Rule label: the columns hold the set’s whole mass and each ribbon is one rule label’s flow.')}
      ${field('ch-axis', 'Columns', select('ch-axis', AXES, state.axis), 'ch-field-cols', 'Golf 2.1 groups: evenly spaced, or at the median path position of their bifolia (stretched so the first and last reach the edges, pushed apart only where they would touch). The bifolia themselves: by rank or at their path position. Rule flows are drawn for the groups only.')}
      ${field('ch-order', 'Order', select('ch-order', ORDERS, state.order), 'ch-field-order', orderHelp)}
      ${field('ch-measure', 'Height', select('ch-measure', MEASURES, state.measure), '', 'Per 10k words: each ribbon’s rate per 10,000 paragraph words of the group. Share: its share of the set’s tokens in the group.')}
      ${field('ch-bands', 'Shown', select('ch-bands', RIBBONS, state.bands), '', 'How many of the largest ribbons are drawn on their own; the rest are pooled into one ribbon.')}
      ${field('ch-kin', 'Selection lineage', select('ch-kin', LINEAGES, state.lineage), '', 'With a ribbon selected, keep bright ribbons that could feed it at earlier steps (ancestors) and ribbons its rule flows could feed at later steps (descendants), chained step after step, flows labelled. A capacity bound, not a history. Ancestors and descendants: only where the selected ribbon is absent. Full: everywhere.')}
      <div class="wb-field ch-checks"><label>Options</label><div>${check('ch-mergeq', 'Merge q', state.mergeQ, 'Count one leading q with its core (chol and qchol as one spelling). Off: exact spellings; rules link only spellings that agree on having a leading q.')}
        ${check('ch-flows', 'Rule flows', state.flows, 'Draw the rule flows between neighbouring groups: per step, one maximum allocation of the set’s losses to its gains along the rules in force; a capacity bound, not a history.', groups)}
        ${check('ch-skips', 'Parked bands', state.skips, 'Draw the dotted bands of parked spellings; hiding them does not change the amounts set aside.', groups)}
        ${check('ch-mid', 'Middle text (f69r, f70r2, f58)', state.middle === 'steps', 'Paragraph text between 2a and 3a on Golf’s path (f69r, f70r2, f58: 889 words), read as a point part-way along the step 2a → 3a; that step’s rule flows are unchanged, each split into what had reached its output by the middle text, what still waited in its input, and what was between input and output: in transit, or at a two-step rule’s middle form.', groups)}
        ${state.unit === 'rule' ? `${check('ch-focus', 'Rules to scale', state.ruleFocus, 'Draw the kept mass and the unmatched remainders as thin bands with their numbers, so the rule flows take the height.')}
        ${check('ch-since', 'Kept by origin', state.keptSince, 'Split each step’s kept band by origin: each part takes the colour of the group it has been continuously present since.')}` : ''}
        ${check('ch-sched', 'Step schedule', state.schedule, schedHelp, SCH() && CF.isGroups(state.axis) ? '' : 'disabled')}</div></div>
      <button class="wb-button primary" id="ch-go">Draw</button>
      </div></div>`;
  }

  // ---------------------------------------------------------------- the chart
  // the column headers (code, short name, a bar in the group's colour) and, under the plot, the group's words and the set's tokens
  // the colour of a Golf 2.1 group, as the page charts paint it (the middle text and unassigned pools are muted)
  function groupPaint() {
    const groups = root.EchoPageChart.grouping('golf21', M(), {regimeColours: (root.EchoColours || {}).regime});
    return code => { const g = groups.groups.find(g => g.key === code); return g ? (g.colour.startsWith('--') ? `var(${g.colour})` : g.colour) : 'var(--muted)'; };
  }
  function columnHeaders(parts, lay, K, top, H) {
    const paintOf = groupPaint();
    // columns: the header (code, short name), a thin bar in the group's colour, and under the plot the group's words and the set's tokens
    let lastTick = -Infinity;
    K.forEach((c, i) => {
      const code = c.group || c.key, gx = c.x, title = `${c.key}${c.title ? ': ' + c.title : ''} · ${num(c.N)} paragraph words on ${c.pages} pages${c.span ? ` · this slot of the proposed path: ${c.span[0].toFixed(3)}–${c.span[1].toFixed(3)} (its bifolia), column at the median ${c.position.toFixed(3)}` : ''}`;
      const wide = lay.columns.length <= 12;
      parts.push(`<g class="ch-col" data-col="${i}"><title>${esc(title)}</title>`);
      parts.push(`<rect x="${gx - (wide ? 18 : 4)}" y="0" width="${c.w + (wide ? 36 : 8)}" height="${H}" fill="transparent"></rect>`);
      parts.push(`<rect x="${gx}" y="${top - 8}" width="${c.w}" height="4" rx="1" fill="${paintOf(code)}"></rect>`);
      if (wide) {
        const name = SHORT[code] || [code], up = c.span ? 12 : 0;            // with a path range under the name, the header starts higher
        parts.push(`<text x="${gx + c.w / 2}" y="${top - 40 - up}" text-anchor="middle" class="ch-head">${esc(c.key === CF.MIDDLE_KEY ? 'middle text' : c.key)}</text>`);
        name.forEach((t, k) => parts.push(`<text x="${gx + c.w / 2}" y="${top - 28 - up + 12 * k}" text-anchor="middle" class="ch-sub">${esc(t)}</text>`));
        if (c.span) parts.push(`<text x="${gx + c.w / 2}" y="${top - 28 - up + 12 * name.length}" text-anchor="middle" class="ch-sub ch-span">${c.span[0].toFixed(2)}–${c.span[1].toFixed(2)}</text>`);
        parts.push(`<text x="${gx + c.w / 2}" y="${top + lay.height + 16}" text-anchor="middle" class="ch-sub">${num(c.N)} words</text>`);
        const set = c.sparse ? `${num(c.total.n)} tokens, under 20` : state.measure === 'share' ? `${num1(c.total.rate)} per 10k` : `${num(c.total.n)} tokens`;
        parts.push(`<text x="${gx + c.w / 2}" y="${top + lay.height + 30}" text-anchor="middle" class="ch-sub ${c.sparse ? 'ch-warn' : ''}">${set}</text>`);
      } else if ((i % 5 === 0 || i === K.length - 1) && gx - lastTick >= 34) { lastTick = gx; parts.push(`<text x="${gx + c.w / 2}" y="${top - 14}" text-anchor="middle" class="ch-sub">${esc(c.position != null && state.axis === 'poolsPos' ? c.position.toFixed(2) : String(c.rank))}</text>`); }
      parts.push('</g>');
    });
    if (lay.columns.length > 12) parts.push(`<text x="${K[0].x}" y="${top - 30}" class="ch-sub">${state.axis === 'poolsPos' ? 'Bifolia at their position, 0 to 1, on ' : 'Bifolia by rank on '}${state.order === 'alternate' ? 'Golf’s proposed path, the terminal bifolia in the alternate order (Stars-T, Stars-S, Bio)' : 'Golf’s proposed path'}</text>`);
  }
  function lostFrames(parts, lay, K, top) {
    const frames = [];
    for (const L of LOST) {
      const ia = K.findIndex(c => c.key === L.after); if (ia < 0 || ia + 1 >= K.length) continue;
      const midNext = K[ia + 1].key === CF.MIDDLE_KEY;
      if (L.beforeMiddle && !midNext) continue;                                      // only when the middle text separates 2a from 3a
      const ib = L.afterMiddle && midNext && ia + 2 < K.length ? ia + 1 : ia;      // the inner-H stretch follows the middle column
      const x1 = K[ib].x + K[ib].w + 5, x2 = K[ib + 1].x - 5, w = x2 - x1, y = top - 6, h = lay.height + 10, inset = Math.min(10, w / 4); if (w < 12) continue;
      frames.push(`<path class="ch-lost" fill-rule="evenodd" d="M${x1} ${y}h${w}v${h}h${-w}Z M${x1 + inset} ${y + inset}h${w - 2 * inset}v${h - 2 * inset}h${-(w - 2 * inset)}Z" opacity="${L.strong ? 0.95 : 0.7}"><title>${esc(L.title)}</title></path><text class="ch-lost-label" x="${(x1 + x2) / 2}" y="${top + lay.height + 42}" text-anchor="middle">${esc(L.label)}</text>`);
    }
    if (!frames.length) return;
    // the frames show only where nothing is drawn over them: every ribbon, flow, wedge, parked band and anchor pushed so
    // far masks them out, dimmed or not
    const cover = [];
    for (const p of parts) {
      let m = /^<path class="ch-(?:ribbon|flow|skip|stub)[^"]*"[^>]*? d="([^"]+)"/.exec(p); if (m) { cover.push(`<path d="${m[1]}" transform="translate(0,${top})"></path>`); continue; }
      m = /^<rect class="ch-anchor[^"]*" x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/.exec(p); if (m) cover.push(`<rect x="${m[1]}" y="${m[2]}" width="${m[3]}" height="${m[4]}"></rect>`);
    }
    const H = top + lay.height + 60;
    parts.push(`<mask id="ch-lostmask" maskUnits="userSpaceOnUse" x="0" y="0" width="${lay.width}" height="${H}"><rect x="0" y="0" width="${lay.width}" height="${H}" fill="#fff"></rect><g fill="#000">${cover.join('')}</g></mask><g class="ch-lostg" mask="url(#ch-lostmask)">${frames.join('')}</g>`);
  }
  const HATCH = '<pattern id="ch-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="var(--muted)" stroke-width="1"></line></pattern>';
  function svg(lay, x) {
    const groupsAxis = CF.isGroups(state.axis);
    const K = lay.columns, headH = state.axis === 'groupsPos' ? 70 : 58, footH = CF.isGroups(state.axis) ? 54 : 42, top = headH, H = top + lay.height + footH;
    const parts = [];
    // the selected step, as a pale band between its two columns
    if (state.step != null && K[state.step] && K[state.step - 1]) parts.push(`<rect class="ch-step-on" x="${K[state.step - 1].x + K[state.step - 1].w}" y="${top - 10}" width="${K[state.step].x - K[state.step - 1].x - K[state.step - 1].w}" height="${lay.height + 30}" rx="3"></rect>`);
    columnHeaders(parts, lay, K, top, H);
    // ribbons (kept), flows (routed by rule, coloured from their source band to their target band), stubs (unexplained),
    // then the segments on top; flows thinner than a pixel at both ends are left out
    const grads = new Map();
    const gradient = (from, to) => { const id = `ch-g-${from}-${to}`; if (!grads.has(id)) grads.set(id, `<linearGradient id="${id}" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${colourOf(from)}"></stop><stop offset="1" stop-color="${colourOf(to)}"></stop></linearGradient>`); return `url(#${id})`; };
    const visible = f => Math.max(f.mass * lay.scales[f.step], f.mass * lay.scales[f.step + 1]) >= 0.8;
    const between = s => `${K[s.step].key} → ${K[s.step + 1].key}`;
    const selSet = new Set(lay.bands.map((b, i) => (isSel(b.label) ? i : -1)).filter(i => i >= 0)), any = selSet.size > 0;
    // each selected ribbon's lineage: the ribbons that could feed it at any earlier step, and the ribbons its flows could feed
    // at any later step, followed step after step (a capacity reading, not descent); those stay bright with their flows,
    // in 'kin' mode only outside that selected ribbon's own columns
    const lineages = [], kinOut = [], kinIn = [];
    if (any && state.flows && state.lineage !== 'off') {
      const every = [...lay.flows, ...(lay.pass || [])], at = (f, s) => f.step === s || f.step2 === s;
      for (const si of selSet) {
        const segs = lay.bands[si].segments, first = Math.max(0, segs.findIndex(Boolean)); let last = segs.length - 1; while (last > 0 && !segs[last]) last--;
        const kin = new Set(), kinFlows = new Set();
        const fwd = new Set([si]); for (let s = 0; s < K.length - 1; s++) for (const f of every) if (at(f, s) && fwd.has(f.from)) { fwd.add(f.to); if (f.from !== si) { kinFlows.add(f); kinOut.push(f); } }
        const back = new Set([si]); for (let s = K.length - 2; s >= 0; s--) for (const f of every) if (at(f, s) && back.has(f.to)) { back.add(f.from); if (f.to !== si) { kinFlows.add(f); kinIn.push(f); } }
        for (const b of [...fwd, ...back]) if (b !== si) kin.add(b);
        lineages.push({kin, kinFlows, inCol: i => i >= first && i <= last, inStep: s => s >= first && s < last});
      }
    }
    // a kin element is bright in 'full' mode everywhere, in 'kin' mode only outside the columns of the selected ribbon it belongs to
    const kinAt = (bi, inside) => (lineages.some(l => l.kin.has(bi) && (state.lineage === 'full' || !inside(l))) ? 'ch-kin' : 'ch-dim');
    const dimOf = (bi, i) => (any && !selSet.has(bi) ? kinAt(bi, l => (i == null ? false : l.inCol(i))) : '');
    const dimStep = (bi, s) => (any && !selSet.has(bi) ? kinAt(bi, l => l.inStep(s)) : '');
    const dimFlow = f => (any && !selSet.has(f.from) && !selSet.has(f.to) ? (lineages.some(l => l.kinFlows.has(f) && (state.lineage === 'full' || !l.inStep(f.step))) ? 'ch-kin' : 'ch-dim') : '');
    const valueOf = s => (state.measure === 'share' ? pct(s.share) : s.rate >= 10 ? Math.round(s.rate).toLocaleString('en-US') : s.rate.toFixed(1));
    if (state.skips) for (const sk of lay.skips) parts.push(`<path class="ch-skip ${isSel(lay.bands[sk.band].label) ? 'on' : ''} ${dimStep(sk.band, sk.from)}" data-band="${sk.band}" d="${sk.path}" transform="translate(0,${top})"><title>${esc(`${lay.bands[sk.band].label}: in ${K[sk.from].key}, absent in ${K.slice(sk.from + 1, sk.to).map(c => c.key).join(' and ')}, returns in ${K[sk.to].key}; ${num1(sk.parked)} per 10k, the lower of its rates in ${K[sk.from].key} and ${K[sk.to].key}, is parked across ${K.slice(sk.from + 1, sk.to).map(c => c.key).join(' and ')}: not lost at ${K[sk.from].key} → ${K[sk.from + 1].key}, not gained at ${K[sk.to - 1].key} → ${K[sk.to].key}`)}</title></path>`);
    for (const r of lay.ribbons) parts.push(`<path class="ch-ribbon ${isSel(lay.bands[r.band].label) ? 'on' : ''} ${dimStep(r.band, r.step)}" data-band="${r.band}" data-step="${r.step}" d="${r.path}" transform="translate(0,${top})" fill="${colourOf(r.band)}"><title>${esc(`${lay.bands[r.band].label}: ${num1(r.kept)} per 10k kept from ${between(r)}`)}</title></path>`);
    if (state.flows) for (const f of lay.flows.filter(visible)) parts.push(`<path class="ch-flow ${dimFlow(f)}" data-step="${f.step}" data-from="${f.from}" data-to="${f.to}" d="${f.path}" transform="translate(0,${top})" fill="${gradient(f.from, f.to)}"><title>${esc(`${x.by === 'bigram' ? 'Bigram flow' : 'Rule flow'} ${lay.bands[f.from].label} → ${lay.bands[f.to].label}: ${num1(f.mass)} per 10k${f.massTo != null && Math.abs(f.massTo - f.mass) > 0.05 ? ` at its source end, ${num1(f.massTo)} at its target end` : ''}, matched at ${between(f)} along ${[...new Set(f.routes.flatMap(r => r.rules))].join(', ') || 'a rule'}${x.sched ? ` (${degreeWords(f.routes)})` : ''}${x.by === 'bigram' ? ` via ${[...new Set(f.routes.flatMap(r => r.vias || []))].slice(0, 3).join(', ')}` : ''}. A capacity bound, not a history.`)}</title></path>`);
    // transit flows: the part of a 2a → 3a rule flow that had left its input by the middle text without reaching its output, drawn through an estimated anchor
    const visiblePass = f => Math.max(f.mass * lay.scales[f.step], f.mass * lay.scales[f.step2 + 1]) >= 0.8;
    if (state.flows) for (const f of (lay.pass || []).filter(visiblePass)) parts.push(`<path class="ch-flow ch-pass ${dimFlow(f)}" data-step="${f.step}" data-from="${f.from}" data-to="${f.to}" d="${f.path}" transform="translate(0,${top})" fill="${gradient(f.from, f.to)}"><title>${esc(`${lay.bands[f.from].label} → ${lay.bands[f.to].label}: ${num1(f.mass)} per 10k words in transit at the middle text (gone from ${lay.bands[f.from].label}, not yet at ${lay.bands[f.to].label} or at a middle form). Part of the ${K[f.step].key} → ${K[f.step2 + 1].key} rule flow along ${[...new Set(f.routes.flatMap(r => r.rules))].join(', ') || 'a rule'}${x.sched ? ` (${degreeWords(f.routes)})` : ''}. A capacity bound, not a history.`)}</title></path>`);
    if (state.flows) for (const f of (lay.pass || []).filter(visiblePass)) if (f.anchor) parts.push(`<rect class="ch-anchor ${dimFlow(f)}" x="${f.anchor.x}" y="${top + f.anchor.y}" width="${f.anchor.w}" height="${Math.max(f.anchor.h, 0.75)}" fill="${gradient(f.from, f.to)}"><title>${esc(`estimated anchor: ${lay.bands[f.from].label} → ${lay.bands[f.to].label} in transit at the middle text, ${num1(f.mass)} per 10k words; not observed there`)}</title></rect>`);
    // the selected ribbons' branches: each flow out of one is named at its far end by what it becomes, each flow into one at its near end by what it comes from
    if (any && state.flows) {
      const place = (list, side) => { const cols = new Map(); for (const f of list) { const k = side === 'to' ? (f.step2 != null ? f.step2 + 1 : f.step + 1) : f.step; if (!cols.has(k)) cols.set(k, []); cols.get(k).push(f); }
        for (const fs of cols.values()) { fs.sort((p, q) => (side === 'to' ? p.y2 - q.y2 : p.y1 - q.y1)); let last = -Infinity;
          for (const f of fs) { const y = Math.max(side === 'to' ? f.y2 : f.y1, last + 11); last = y; const other = lay.bands[side === 'to' ? f.to : f.from];
            // a flow into the pooled band is named by its largest routes' own spellings, since the pooled label says nothing
            let text = `${esc(other.label)}<tspan class="ch-invalue"> ${esc(num1(side === 'to' ? f.massTo : f.mass))}</tspan>`;
            if (other.pooled) { const by = new Map(); for (const rt of f.routes) { const w = side === 'to' ? rt.to : rt.from; by.set(w, (by.get(w) || 0) + (side === 'to' && rt.massTo != null ? rt.massTo : rt.mass)); }
              const tops = [...by.entries()].sort((p, q) => q[1] - p[1]).slice(0, 2); text = tops.map(([w, m]) => `${esc(w)}<tspan class="ch-invalue"> ${esc(num1(m))}</tspan>`).join(', ') + (by.size > 2 ? ' …' : ''); }
            parts.push(`<text class="ch-branch" x="${side === 'to' ? f.x2 - 4 : f.x1 + 4}" y="${top + y + 3.5}" text-anchor="${side === 'to' ? 'end' : 'start'}">${text}</text>`); } } };
      const shown = [...lay.flows.filter(visible), ...(lay.pass || []).filter(visiblePass)];
      place(shown.filter(f => selSet.has(f.from) || kinOut.includes(f)), 'to'); place(shown.filter(f => !selSet.has(f.from) && (selSet.has(f.to) || kinIn.includes(f))), 'from');
    }
    for (const s of lay.stubs.filter(s => !K[s.step].sparse && !K[s.step + 1].sparse)) parts.push(`<path class="ch-stub ch-${s.kind} ${dimStep(s.band, s.step)}" d="${s.path}" transform="translate(0,${top})" fill="${colourOf(s.band)}"><title>${esc(`${lay.bands[s.band].label}: ${num1(s.mass)} per 10k ${groupsAxis ? (s.kind === 'unplaced' ? 'lost' : 'gained') + ' without a rule route' : s.kind === 'unplaced' ? 'fall' : 'rise'} at ${between(s)}`)}</title></path>`);
    lay.bands.forEach((b, bi) => b.segments.forEach((s, i) => {
      if (!s) return;
      const c = K[i], pairNote = x.by === 'bigram' && b.pair ? ` (units ${b.pair.join(' + ')})` : '', t = `${b.label}${pairNote} in ${c.key}: ${num(s.n)} ${x.by === 'bigram' ? 'bigram tokens among' : 'of'} ${num(c.N)} words, ${num1(s.rate)} per 10k, ${pct(s.share)} of the set${c.sparse ? ' (the set has fewer than 20 tokens here)' : ''}`;
      parts.push(`<rect class="ch-seg ${isSel(b.label) ? 'on' : ''} ${c.sparse ? 'ch-sparse' : ''} ${dimOf(bi, i)}" data-band="${bi}" data-col="${i}" x="${s.x}" y="${top + s.y}" width="${s.w}" height="${Math.max(s.h, 0.75)}" fill="${colourOf(bi)}"><title>${esc(t)}</title></rect>`);
    }));
    // the spelling's name, with its value, beside its segment in every column but the last (the margin labels are there)
    // with many close columns (the bifolia) names go only on columns at least 48 px apart, left to right
    const named = new Set(); let lastNamed = -Infinity;
    K.forEach((c, i) => { if (i < K.length - 1 && c.x - lastNamed >= 48) { named.add(i); lastNamed = c.x; } });
    lay.bands.forEach((b, bi) => b.segments.forEach((s, i) => {
      if (!s || !named.has(i) || s.h < 10) return;
      parts.push(`<text class="ch-inlabel ${isSel(b.label) ? 'on' : ''} ${dimOf(bi, i)}" data-band="${bi}" x="${s.x + s.w + 4}" y="${top + s.y + s.h / 2 + 3.5}">${esc(b.label)}${s.h >= 16 ? `<tspan class="ch-invalue"> ${esc(valueOf(s))}</tspan>` : ''}</text>`);
    }));
    for (const l of lay.labels) {
      if (l.x - l.x0 > 8 || Math.abs(l.y - l.y0) > 3) parts.push(`<line class="ch-leader" x1="${l.x0 + 1}" y1="${top + l.y0}" x2="${l.x - 2}" y2="${top + l.y}"></line>`);
      const lastSeg = lay.bands[l.band].segments[l.column];
      parts.push(`<text class="ch-label ${isSel(l.label) ? 'on' : ''} ${lay.bands[l.band].pooled ? 'ch-other' : ''} ${dimOf(l.band, l.column)}" data-band="${l.band}" x="${l.x}" y="${top + l.y + 4}">${esc(l.label)}${lastSeg && l.column === K.length - 1 ? `<tspan class="ch-invalue"> ${esc(valueOf(lastSeg))}</tspan>` : ''}${x.seedLabel && l.label === x.seedLabel ? '<tspan class="ch-seed-mark" dx="4">◀</tspan>' : ''}</text>`);
    }
    // Golf's candidate stretches for the lost folios: hatched frames between the groups they fall between, masked out under every band
    if (groupsAxis) lostFrames(parts, lay, K, top);
    return `<svg class="ch-svg" viewBox="0 0 ${lay.width} ${H}" width="${lay.width}" height="${H}" role="img" aria-label="Ribbons of the set's spellings along the chain"><defs>${HATCH}${[...grads.values()].join('')}</defs>${parts.join('')}</svg>`;
  }

  // ---------------------------------------------------------------- ribbons as rules
  // Each column is the set's whole mass in the group; between neighbouring groups the ribbons are the step's rule flows,
  // one per rule label, the unchanged mass as a grey band, the unmatched remainders as wedges; the transit at the middle
  // text crosses the middle column through an estimated anchor; the parked pairs are dotted bands.
  function ruleSvg(lay, x) {
    const RS = x.RS, K = lay.columns, top = state.axis === 'groupsPos' ? 70 : 58, H = top + lay.height + 54, parts = [], padTop = 6;
    columnHeaders(parts, lay, K, top, H);
    const unit = (i, v) => (state.measure === 'share' ? (x.S.totals[i].rate ? v / x.S.totals[i].rate : 0) : v) * lay.scales[i];
    const paintOf = groupPaint(), originOf = key => Number(key.slice(6));
    const colourRule = key => (key === 'kept' ? 'var(--ink2)' : key.startsWith('since:') ? paintOf(K[originOf(key)].group || K[originOf(key)].key) : colourOf(RS.rules.indexOf(key)));
    // kept by origin: the step's kept mass split by the earliest column since which each part has been present without a
    // break (scaled to the step's kept total where the two middle steps count route mass still in its input as kept)
    const since = state.keptSince ? CF.keptSince(x.cols, x.words) : null;
    const sinceParts = i => { if (!since) return null; const raw = since.steps[i], sum = since.total[i], f = sum > 1e-9 ? RS.steps[i].totals.kept / sum : 0; return raw.map(v => v * f); };
    const faces = K.map(() => ({right: [], left: []}));
    RS.steps.forEach((s, i) => {
      const parts = sinceParts(i);
      if (parts) parts.forEach((v, a) => { if (v > 1e-9) { faces[i].right.push({kind: 'kept', key: 'since:' + a, mass: v}); faces[i + 1].left.push({kind: 'kept', key: 'since:' + a, mass: v}); } });
      else { faces[i].right.push({kind: 'kept', key: 'kept', mass: s.totals.kept}); faces[i + 1].left.push({kind: 'kept', key: 'kept', mass: s.totals.kept}); }
      for (const r of RS.rules) { const v = s.by.get(r) || 0; if (v > 1e-9) { faces[i].right.push({kind: 'rule', key: r, mass: v}); faces[i + 1].left.push({kind: 'rule', key: r, mass: v}); } }
    });
    if (RS.pass) for (const r of RS.rules) { const v = RS.pass.by.get(r) || 0; if (v > 1e-9) { faces[RS.pass.step].right.push({kind: 'pass', key: r, mass: v}); faces[RS.pass.step2 + 1].left.push({kind: 'pass', key: r, mass: v}); } }
    for (const [k, v] of RS.skipPairs) { const [a, b] = k.split('>').map(Number); if (faces[a] && faces[b]) { faces[a].right.push({kind: 'parkedOut', key: k, mass: v}); faces[b].left.push({kind: 'parkedIn', key: k, mass: v}); } }
    RS.steps.forEach((s, i) => { if (s.totals.unplaced > 1e-9) faces[i].right.push({kind: 'unplaced', key: 'lost', mass: s.totals.unplaced}); if (s.totals.unfilled > 1e-9) faces[i + 1].left.push({kind: 'unfilled', key: 'gained', mass: s.totals.unfilled}); });
    // heights: to scale, or with the kept mass and the unmatched remainders as thin fixed bands so the rule flows take the height
    const FIXED = 16, scalable = it => it.kind === 'rule' || it.kind === 'pass' || it.kind === 'parkedOut' || it.kind === 'parkedIn' || (since && it.kind === 'kept');
    const toUnits = (i, v) => (state.measure === 'share' ? (x.S.totals[i].rate ? v / x.S.totals[i].rate : 0) : v);
    let hOf = (i, it) => unit(i, it.mass);
    if (state.ruleFocus) {
      const maxScal = Math.max(1e-9, ...faces.map((f, i) => Math.max(f.right.filter(scalable).reduce((v, it) => v + toUnits(i, it.mass), 0), f.left.filter(scalable).reduce((v, it) => v + toUnits(i, it.mass), 0))));
      const sc = (lay.height - padTop - 2 * FIXED - 2 * CF.GAP) / maxScal;
      hOf = (i, it) => (scalable(it) ? toUnits(i, it.mass) * sc : FIXED);
    }
    faces.forEach((f, i) => { let y = padTop; for (const it of f.right) { it.y = y; it.h = hOf(i, it); y += it.h; } y = padTop; for (const it of f.left) { it.y = y; it.h = hOf(i, it); y += it.h; } });
    const dim = key => (anySel() && !isSel(key) ? 'ch-dim' : ''), nameOf = k => (k === CF.MIDDLE_KEY ? 'middle text' : k), between = i => `${nameOf(K[i].key)} → ${nameOf(K[i + 1].key)}`, find = (list, kind, key) => list.find(it => it.kind === kind && it.key === key);
    const colH = i => Math.max(faces[i].right.reduce((v, it) => v + it.h, 0), faces[i].left.reduce((v, it) => v + it.h, 0));
    K.forEach((c, i) => parts.push(`<rect class="ch-seg ch-rulecol" x="${c.x}" y="${top + padTop}" width="${c.w}" height="${Math.max(colH(i), 0.75)}" fill="var(--ink2)" opacity=".3"><title>${esc(`${c.key === CF.MIDDLE_KEY ? 'middle text' : c.key}: ${num(x.S.totals[i].n)} words of the set, ${num1(x.S.totals[i].rate)} per 10k`)}</title></rect>`));
    const labels = [];
    RS.steps.forEach((s, i) => {
      const j = i + 1, x1 = K[i].x + K[i].w, x2 = K[j].x, stubLen = Math.min(30, (x2 - x1) * 0.28);
      for (const it of faces[i].right) {
        if (it.kind !== 'kept' && it.kind !== 'rule') continue;
        const other = find(faces[j].left, it.kind, it.key); if (!other) continue;
        const title = it.kind === 'kept' ? (it.key.startsWith('since:') ? `Kept since ${nameOf(K[originOf(it.key)].key)}: ${num1(it.mass)} per 10k of the same spellings present without a break from ${nameOf(K[originOf(it.key)].key)} to ${nameOf(K[j].key)}${since && Math.abs(since.total[i] - RS.steps[i].totals.kept) > 0.05 ? ' (scaled to this step’s kept mass)' : ''}` : `Kept: ${num1(it.mass)} per 10k as the same spelling at ${between(i)}`) : `${it.key}: ${num1(it.mass)} per 10k matched at ${between(i)}. A capacity bound, not a history.`;
        parts.push(`<path class="ch-flow ch-rule ${it.kind === 'kept' ? 'ch-kept' : ''} ${dim(it.key)}" data-rule="${esc(it.key)}" d="${CF.ribbonPath(x1, it.y, it.h, x2, other.y, other.h)}" transform="translate(0,${top})" fill="${colourRule(it.key)}"><title>${esc(title)}</title></path>`);
        if (Math.min(it.h, other.h) >= 11) labels.push({x: (x1 + x2) / 2, y: top + (it.y + it.h / 2 + other.y + other.h / 2) / 2 + 3.5, text: `${it.key.startsWith('since:') ? 'since ' + nameOf(K[originOf(it.key)].key) : it.key} ${num1(it.mass)}`, key: it.key});
      }
      const un = find(faces[i].right, 'unplaced', 'lost'), uf = find(faces[j].left, 'unfilled', 'gained');
      if (un) parts.push(`<path class="ch-stub ch-unplaced" d="M${x1} ${un.y}L${x1 + stubLen} ${un.y + un.h / 2}L${x1} ${un.y + un.h}Z" transform="translate(0,${top})" fill="var(--ink2)"><title>${esc(`${num1(un.mass)} per 10k lost without a rule route at ${between(i)}`)}</title></path>`);
      if (uf) parts.push(`<path class="ch-stub ch-unfilled" d="M${x2} ${uf.y}L${x2 - stubLen} ${uf.y + uf.h / 2}L${x2} ${uf.y + uf.h}Z" transform="translate(0,${top})" fill="var(--ink2)"><title>${esc(`${num1(uf.mass)} per 10k gained without a rule route at ${between(i)}`)}</title></path>`);
    });
    if (state.skips) for (const [k] of RS.skipPairs) { const [a, b] = k.split('>').map(Number); const o = faces[a] && find(faces[a].right, 'parkedOut', k), d = faces[b] && find(faces[b].left, 'parkedIn', k); if (!o || !d) continue; parts.push(`<path class="ch-skip" d="${CF.ribbonPath(K[a].x + K[a].w, o.y, o.h, K[b].x, d.y, d.h)}" transform="translate(0,${top})"><title>${esc(`${num1(o.mass)} per 10k parked from ${K[a].key} to ${K[b].key}: present in both, absent between`)}</title></path>`); }
    if (RS.pass) {
      const m = RS.pass.step2, a = RS.pass.step, b = RS.pass.step2 + 1;
      let ay = Math.max(padTop, ...faces[m].right.map(it => it.y + it.h), ...faces[m].left.map(it => it.y + it.h)) + CF.GAP;
      for (const r of RS.rules) {
        const o = find(faces[a].right, 'pass', r), d = find(faces[b].left, 'pass', r); if (!o || !d) continue;
        const hm = hOf(m, o);
        parts.push(`<path class="ch-flow ch-rule ch-pass ${dim(r)}" data-rule="${esc(r)}" d="${CF.ribbonPath(K[a].x + K[a].w, o.y, o.h, K[m].x, ay, hm)} ${CF.ribbonPath(K[m].x + K[m].w, ay, hm, K[b].x, d.y, d.h)}" transform="translate(0,${top})" fill="${colourRule(r)}"><title>${esc(`${r}: ${num1(o.mass)} per 10k words in transit at the middle text (gone from the rules’ inputs, not yet at their outputs or middle forms). Part of the ${K[a].key} → ${K[b].key} rule flows. A capacity bound, not a history.`)}</title></path>`);
        parts.push(`<rect class="ch-anchor ${dim(r)}" x="${K[m].x}" y="${top + ay}" width="${K[m].w}" height="${Math.max(hm, 0.75)}" fill="${colourRule(r)}"><title>${esc(`estimated anchor: ${r} in transit at the middle text, ${num1(o.mass)} per 10k words; not observed there`)}</title></rect>`);
        ay += hm + CF.GAP;
      }
    }
    for (const l of labels) parts.push(`<text class="ch-inlabel ${dim(l.key)}" x="${l.x}" y="${l.y}" text-anchor="middle">${esc(l.text)}</text>`);
    lostFrames(parts, lay, K, top);
    return `<svg class="ch-svg" viewBox="0 0 ${lay.width} ${H}" width="${lay.width}" height="${H}" role="img" aria-label="Rule flows between the groups"><defs>${HATCH}</defs>${parts.join('')}</svg>`;
  }
  function ruleChartCard(x) {
    const widthPx = Math.max(900, Math.min(1800, (host.clientWidth || 1300) - 112));
    const lay = CF.layout(x.S, [], {width: widthPx, height: 470, measure: state.measure, padRight: 40});
    x.lay = lay;
    const RS = x.RS;
    const paintOf = groupPaint(), K = lay.columns, nameOf = k => (k === CF.MIDDLE_KEY ? 'middle text' : k);
    const keys = [...(state.keptSince ? K.slice(0, -1).map((c, a) => `<span class="ch-key" data-rule="since:${a}"><i class="ch-k-ribbon" style="background: ${paintOf(c.group || c.key)}; opacity: .6"></i> kept since ${esc(nameOf(c.key))}</span>`) : [`<span class="ch-key"><i class="ch-k-ribbon" style="background: var(--ink2); opacity: .3"></i> grey: kept, the same spelling in both groups</span>`]),
      ...RS.rules.map((r, i) => `<span class="ch-key" data-rule="${esc(r)}"><i class="ch-k-colour" style="background: ${colourOf(i)}"></i> ${esc(r)}</span>`),
      `<span class="ch-key"><i class="ch-k-stub"></i> wedges: lost or gained without a rule route</span>`,
      ...(state.skips && RS.skipPairs.size ? [`<span class="ch-key"><i class="ch-k-skip"></i> dotted: parked across skipped groups (present before and after, absent between)</span>`] : []),
      ...(RS.pass ? [`<span class="ch-key"><i class="ch-k-flow ch-k-pass"></i> dashed: in transit at the middle text (gone from the rules’ inputs, not yet at their outputs or middle forms), through an estimated anchor</span>`] : []),
      `<span class="ch-key"><i class="ch-k-lost"></i> hatched frames: where Golf’s missing-folio study places lost folios</span>`,
      `<span class="ch-key"><b>${state.measure === 'share' ? 'Height: share of the set’s tokens in the group' : 'Height: rate per 10k paragraph words of the group'}</b></span>`];
    const pooled = RS.rules.includes('other rules') ? `, the ${Object.keys(RS.totals).length - RS.rules.length + 1} smallest pooled as “other rules”` : '';
    return `<section class="wb-card ch-chart"><div class="wb-row-title"><h3>${esc(setName(x))} · ${num(x.words.length)} spellings · ribbons are rule labels${esc(pooled)}</h3><button class="wb-button" data-share="chain" title="Copy a link that opens this chart">Share link</button></div>
      <div class="ch-legend">${keys.join('')}</div>
      <div class="ch-scroll">${ruleSvg(lay, x)}</div>
      <details class="ch-about"><summary class="wb-small">How to read this chart</summary><p class="wb-small">Each column is the set’s whole mass in the group. Between neighbouring groups the ribbons are the step’s rule flows, one per rule label (“,” lists separate rules credited with the same pair; “+” joins rules needed together). The grey band is the kept mass and the wedges are the unmatched remainders.${state.keptSince ? ' With “Kept by origin” on, the kept band is split by origin, each part in the colour of the group it has been continuously present since: the band since 1a runs through every step, and its width at the last step is the mass kept all the way through.' : ''} Click a ribbon, a rule swatch or a rule row to follow one rule label; shift-click follows several. ${x.sched ? 'Rules run at their scheduled steps and degrees (the step schedule card below).' : 'Every active rule runs at every step.'} One maximum allocation per step: the largest total the rules could match at once with no mass credited twice; when several splits tie, one is shown. A capacity bound on what the rules could explain, not a history. With the middle text on, the step 2a → 3a is unchanged and the middle column is read part-way along it: each rule flow splits into what had reached its output, what still waited in its input, what was in transit (dashed), and what sat at a two-step rule’s middle form.${state.ruleFocus ? ' Kept and unmatched are drawn as thin bands with their numbers; the rule flows are to scale.' : ''}</p></details></section>`;
  }
  function ruleTable(x) {
    const RS = x.RS, steps = RS.steps, extra = RS.pass ? 1 : 0;
    const cells = vals => vals.map(v => `<td>${v > 0.05 ? num1(v) : '–'}</td>`).join('');
    const row = (key, vals) => `<tr class="ch-row ${isSel(key) ? 'on' : ''}" ${key === 'kept' ? '' : `data-rule="${esc(key)}"`}><td>${key === 'kept' ? '' : `<i class="ch-dot" style="background:${colourOf(RS.rules.indexOf(key))}"></i>`}${esc(key)}</td>${cells(vals)}</tr>`;
    const head = `<thead><tr><th>rule</th>${steps.map(s => `<th>${esc(s.key)}</th>`).join('')}${RS.pass ? `<th>${esc(RS.pass.from)} → ${esc(RS.pass.to)} in transit</th>` : ''}</tr></thead>`;
    const since = state.keptSince ? CF.keptSince(x.cols, x.words) : null, K = x.S.columns, nameOf = k => (k === CF.MIDDLE_KEY ? 'middle text' : k);
    const sinceRows = since ? K.slice(0, -1).map((c, a) => { const vals = steps.map((s, i) => (a <= i && since.total[i] > 1e-9 ? since.steps[i][a] * s.totals.kept / since.total[i] : 0)); return `<tr class="ch-row ${isSel('since:' + a) ? 'on' : ''}" data-rule="since:${a}"><td><i class="ch-dot" style="background:${groupPaint()(c.group || c.key)}"></i>kept since ${esc(nameOf(c.key))}</td>${cells(vals.concat(extra ? [0] : []))}</tr>`; }) : [];
    const body = [...(since ? sinceRows : [row('kept', steps.map(s => s.totals.kept).concat(extra ? [0] : []))]),
      ...RS.rules.map(r => row(r, steps.map(s => s.by.get(r) || 0).concat(extra ? [RS.pass.by.get(r) || 0] : []))),
      `<tr><td>lost without a rule route</td>${cells(steps.map(s => s.totals.unplaced))}${extra ? '<td></td>' : ''}</tr>`,
      `<tr><td>gained without a rule route</td>${cells(steps.map(s => s.totals.unfilled))}${extra ? '<td></td>' : ''}</tr>`].join('');
    return `<section class="wb-card ch-side"><h3>Rules by step</h3><p class="wb-small">Per 10k paragraph words of each group: the mass each rule label could match at each step (one maximum allocation, the largest total the rules could match at once), the kept mass, and the unmatched remainders.${RS.pass ? ` “${esc(RS.pass.from + ' → ' + RS.pass.to)} in transit”: the part of that step’s rule flows gone from their inputs by the middle text, not yet at their outputs or middle forms.` : ''} Click a rule row to follow it in the chart.</p><div class="wb-scroll"><table class="wb-table ch-table ch-sched">${head}<tbody>${body}</tbody></table></div></section>`;
  }

  function chartCard(x) {
    if (x.by === 'rule') return ruleChartCard(x);
    const widthPx = Math.max(900, Math.min(1800, (host.clientWidth || 1300) - 112));
    const lay = CF.layout(x.S, state.flows ? x.L : [], {width: widthPx, height: CF.isGroups(state.axis) ? 470 : 400, measure: state.measure, padRight: 130});
    x.lay = lay;
    const groupsAxis = CF.isGroups(state.axis);
    const noun = UNIT_NOUN[x.by];
    const keptKey = !groupsAxis ? `the same ${noun}, bifolium to bifolium` : x.by === 'spelling' ? 'kept: the same spelling in both groups' : x.by === 'bigram' ? 'kept: the same spelling, or a route that keeps the bigram' : 'kept: the same spelling, or a route that stays inside one ribbon';
    const keys = [`<span class="ch-key"><i class="ch-k-colour"></i> colour = ${noun}</span>`,
      `<span class="ch-key"><i class="ch-k-ribbon"></i> ${keptKey}</span>`,
      ...(groupsAxis && state.flows ? [`<span class="ch-key"><i class="ch-k-flow"></i> rule flow: matched along ${x.sched ? 'a scheduled rule' : 'an active rule'}</span>`, `<span class="ch-key"><i class="ch-k-stub"></i> wedge left of a column: gained without a rule route; right of it: lost without one</span>`] : []),
      ...(lay.skips.length && state.skips ? [`<span class="ch-key"><i class="ch-k-skip"></i> dotted: parked across skipped groups (present before and after, absent between): neither lost nor gained</span>`] : []),
      ...(groupsAxis && state.flows && lay.pass && lay.pass.length ? [`<span class="ch-key"><i class="ch-k-flow ch-k-pass"></i> dashed rule flow: in transit at the middle text (gone from its input, not yet at its output or middle form), through an estimated anchor</span>`] : []),
      ...(groupsAxis ? [`<span class="ch-key"><i class="ch-k-lost"></i> hatched: where Golf’s missing-folio study places lost folios</span>`] : []),
      ...(groupsAxis && state.flows && state.lineage !== 'off' ? [`<span class="ch-key"><i class="ch-k-ribbon"></i> italic names (on selected ribbons): ribbons that could feed them or be fed by them, step after step${state.lineage === 'kin' ? ', shown only where the selected ribbon is absent' : ''}</span>`] : []),
      ...(groupsAxis ? [] : [`<span class="ch-key"><i class="ch-k-stub"></i> wedge left of a column: the rise from the bifolium to its left; right of it: the fall to the next. Rules are not applied between bifolia.</span>`]),
      ...(x.m.seed ? [`<span class="ch-key"><b>◀</b> the word typed</span>`] : []),
      ...(groupsAxis && state.flows ? [`<span class="ch-key"><b>flow labels</b> (on selected ribbons): the other ribbon, then the flow’s mass per 10k at the label’s end</span>`] : []),
      `<span class="ch-key"><b>${state.measure === 'share' ? `Height: share of the set’s tokens in the ${groupsAxis ? 'group' : 'bifolium'}` : `Height: rate per 10k paragraph words of the ${groupsAxis ? 'group' : 'bifolium'}`}</b></span>`];
    const O = x.S.other;
    const nb = x.S.bands.length, nw = x.words.length;
    const suffix = x.by === 'spelling' ? `${nw} spelling${nw === 1 ? '' : 's'}${O ? `: ${nb} ribbons, ${O.words.length} smaller pooled as “${O.label}”` : ''}`
      : x.by === 'bigram' ? `${nw} spellings · ${x.S.words.length} glyph bigrams: ${nb} ribbons${O ? `, ${O.classes} pooled as “${O.label}”` : ''}`
      : `${nw} spellings in ${x.S.classes} ${noun}s: ${nb} ribbons${O ? `, ${O.classes} ${noun}s (${O.words.length} spellings) pooled as “${O.label}”` : ''}`;
    const modeNote = x.by === 'bigram'
      ? 'Glyph bigram ribbons: a spelling counts once for each occurrence of a pair of adjacent glyph units it contains, word edges ^ and $ included, so the ribbons together exceed the set.<br>A rule flow runs from a bigram a spelling-to-spelling route removes to one it adds; at each end the route’s mass is split among the bigrams at the other end, so a flow tapers where the two counts differ. Click a ribbon to label its flows.'
      : x.by === 'spelling' ? 'Click a ribbon to label its flows: each flow out of it shows the spelling it becomes, each flow into it the spelling it comes from.'
      : `${cap1(noun)} ribbons pool spellings that share a saved-split ${noun}; a route between two of them stays inside that ribbon as kept mass; “other ${noun}s” pools the smallest ${noun}s. Click a ribbon to label its flows.`;
    const caption = groupsAxis
      ? `A click on a column opens the step into it below the chart. Between neighbouring groups each ribbon carries its kept mass, the smaller of its two rates. Where ${x.sched ? 'a scheduled' : 'an active'} rule links a shrinking spelling to a growing one, their matched mass is drawn between them. This is one maximum shared-capacity allocation, as in Network and Sections: a bound on what the rules could explain, not a history of tokens. A rule flow between two spellings inside “other members” is drawn as kept.`
      : `At bifolium resolution each ribbon shows its spelling’s rate bifolium by bifolium; rule flows are drawn for the groups only.`;
    return `<section class="wb-card ch-chart"><div class="wb-row-title"><h3>${esc(setName(x))} · ${esc(suffix)}</h3><button class="wb-button" data-share="chain" title="Copy a link that opens this chart with these settings">Share link</button></div>
      <div class="ch-legend">${keys.join('')}</div>
      <div class="ch-scroll">${svg(lay, x)}</div>
      <details class="ch-about"><summary class="wb-small">How to read this chart</summary><p class="wb-small">${modeNote}${groupsAxis ? ' Hatched strips: where Golf’s missing-folio study places lost folios (f91–f92, f97–f98 across 1.5a → 2a; f59–f64 across 2a → 3a, after the middle text when it is on).' : ''}</p>
      <p class="wb-small">${state.middle === 'steps' && groupsAxis ? `With the middle text on, the step 2a → 3a is unchanged: the same allocation of 2a’s losses to 3a’s gains along the rules as with the middle text off. The middle column is read as a point part-way along that step. Each rule flow is split into what had reached its output (drawn from 2a to the middle text), what still waited in its input (drawn from the middle text to 3a), what was in transit (gone from its input, not yet at its output or middle form; drawn dashed through an estimated anchor) and, for a two-step rule whose middle form is in the set, what sat at that form (drawn chol → cheol, then cheol → chedy). Kept mass that the middle text does not show is parked across it (dotted). Rule flows adding dy endings are read as not having reached their outputs by the middle text, since it lies on the A side of the e → d switch; its d-forms are left unexplained. The split is fitted to the middle text’s rates, with a weak pull toward the middle text’s place between 2a and 3a on Golf’s path (${x.p0.toFixed(2)} of the way); a spelling with under one expected token there (its larger 2a or 3a rate, as a count in the middle text’s 889 words) follows the pull, not its count. The middle text’s own is what this reading leaves unexplained; the ledgers count it as gained before the middle text and lost after it. ` : ''}${state.axis === 'groupsPos' ? 'Columns sit at the median path position of each group’s bifolia (the range under each header), stretched so that the first and last groups reach the edges and pushed apart only where they would touch, so the spacing shows how much of the path each group occupies. ' : ''}Beside each column, a spelling’s name and its ${state.measure === 'share' ? 'share of the set' : 'rate per 10k'} there (where the ribbon is tall enough). Click a spelling to bring it forward, shift-click to add another; click a selected one again to release it. ${caption}${groupsAxis ? ` Under each column: the group’s paragraph words, then the set’s tokens there${state.measure === 'share' ? ' as a rate per 10k' : ''}.` : ''} A column where the set has fewer than 20 tokens is dashed: read no share there.</p></details></section>`;
  }

  // ---------------------------------------------------------------- inspector
  function spellingCard(x) {
    if (x.by === 'rule') return ruleTable(x);
    const S = x.S, all = [...S.bands, ...(S.other ? [S.other] : [])], chosen = state.sel.map(l => all.find(b => b.label === l)).filter(Boolean);
    if (!chosen.length) return `<section class="wb-card ch-side"><h3>${cap1(UNIT_NOUN[x.by])}</h3><p class="wb-small">Click a ribbon or its name for its counts along the chain; shift-click adds another.</p>${familyTable(x)}</section>`;
    return chosen.map(b => spellingCardOf(x, b)).join('');
  }
  function spellingCardOf(x, b) {
    const S = x.S, K = x.S.columns, unit = CF.isGroups(state.axis) ? 'group' : 'bifolium';
    const rows = K.map((c, i) => { const v = b.values[i], prev = i ? b.values[i - 1] : null;
      const d = prev ? v.rate - prev.rate : null;
      return `<tr><td>${esc(c.key)}</td><td>${num(v.n)}</td><td>${num1(v.rate)}</td><td class="${S.sparse[i] ? 'ch-warn' : ''}">${S.sparse[i] ? '—' : pct(v.share)}</td><td>${d == null ? '' : (d > 0 ? '+' : '') + num1(d)}</td></tr>`; }).join('');
    const members = new Set(b.words);
    const links = CF.isGroups(state.axis) ? x.L.flatMap(L => L.routes.filter(r => (b.word ? r.from === b.word || r.to === b.word : members.has(r.from) !== members.has(r.to))).map(r => ({...r, step: L.step}))) : [];
    const linkRows = links.length ? `<h4>Rule routes touching it</h4><table class="wb-table ch-table"><thead><tr><th>Step</th><th>Route</th><th>Rules</th>${x.sched ? '<th>Schedule</th>' : ''}<th>Matched, per 10k</th></tr></thead><tbody>${links.map(r => `<tr><td>${esc(K[r.step].key)} → ${esc(K[r.step + 1].key)}</td><td class="mono">${esc(r.from)} → ${esc(r.to)}</td><td>${esc(r.rules.join(', '))}</td>${x.sched ? `<td>${degMark(r.degree)[0]} ${degMark(r.degree)[2]}</td>` : ''}<td>${num1(r.mass)}${r.massTo != null && Math.abs(r.massTo - r.mass) > 0.05 ? ` → ${num1(r.massTo)}` : ''}</td></tr>`).join('')}</tbody></table><p class="wb-small">${NOTATION}</p>` : (CF.isGroups(state.axis) && b.word ? `<p class="wb-small">No ${x.sched ? 'scheduled' : 'active'} rule route carries matched mass into or out of it at any step.</p>` : '');
    const split = CD() && b.word && CD().splits[b.word];
    const kindWord = b.kind === 'tail' ? 'Ending ' : b.kind === 'front' ? 'Front ' : b.kind === 'bigram' ? 'Bigram ' : '';
    return `<section class="wb-card ch-side"><div class="wb-row-title"><h3>${kindWord}${esc(b.label)}</h3><button class="wb-button" data-ch-close="${esc(b.label)}">Close</button></div>
      ${split ? `<p class="wb-small">Front <b>${esc(split[0] || '∅')}</b> (front family ${esc(split[1])}) · ending <b>${esc(b.word.slice(split[0].length) || '∅')}</b> (ending family ${esc(split[2])})</p>${b.word !== x.m.seed ? `<p><button class="wb-button ch-mini" data-ch-seed="${esc(b.word)}">Use as the word</button></p>` : ''}` : ''}
      ${b.word || b.kind === 'bigram' ? '' : `<p class="wb-small">${b.pooled ? '' : 'Spellings: '}${esc(b.words.slice(0, 40).join(', '))}${b.words.length > 40 ? ` … ${b.words.length} spellings` : ''}</p>`}
      <table class="wb-table ch-table"><thead><tr><th>${CF.isGroups(state.axis) ? 'Group' : 'Bifolium'}</th><th>Tokens</th><th>Per 10k</th><th>Share</th><th>Δ per 10k</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="wb-small">Per 10k: of the ${unit}’s paragraph words. Share: of the set’s tokens in the ${unit}; —: the set has fewer than 20 tokens there. Δ: the change from the ${unit} to the left.${split ? ' Front family: the front’s coarse class, prefix then gallows or bench. Ending family: the ending’s coarse class, optional bench and e-run, then the coda.' : ''}</p>
      ${linkRows}</section>`;
  }
  function familyTable(x) {
    const S = x.S, bands = [...S.bands, ...(S.other ? [S.other] : [])];
    return `<table class="wb-table ch-table"><thead><tr><th>${cap1(UNIT_NOUN[x.by])}</th><th>Tokens</th><th>Summed rate</th></tr></thead><tbody>${bands.map((b, i) => `<tr class="ch-row" data-band="${i}"><td><i class="ch-dot" style="background:${colourOf(i)}"></i>${esc(b.label)}</td><td>${num(b.values.reduce((v, r) => v + r.n, 0))}</td><td>${num1(b.mass)}</td></tr>`).join('')}</tbody></table><p class="wb-small">Tokens: in all columns. Summed rate: the spelling’s rates per 10k added over the columns. Ribbons are stacked in this order.</p>`;
  }
  function stepCard(x) {
    if (state.step == null || !CF.isGroups(state.axis)) return '';
    const L = x.L[state.step - 1]; if (!L) return '';
    const K = x.S.columns, t = L.totals, a = K[state.step - 1].key, b = K[state.step].key;
    const routes = L.routes.slice().sort((p, q) => q.mass - p.mass).slice(0, 12);
    return `<section class="wb-card ch-side"><div class="wb-row-title"><h3>Step ${esc(a)} → ${esc(b)}</h3><button class="wb-button" data-ch-close-step>Close</button></div>
      <table class="wb-table ch-table ch-ledger"><tbody>
      <tr><td>Set in ${esc(a)} → in ${esc(b)}</td><td>${num1(t.source)} → ${num1(t.target)}</td></tr>
      <tr><td>Same spelling kept</td><td>${num1(t.kept)}</td></tr>
      <tr><td>Parked here: absent in the next group, returns later (not counted as lost)</td><td>${num1(t.dormant_out)}</td></tr>
      <tr><td>Returned here: parked in an earlier group (not counted as gained)</td><td>${num1(t.dormant_in)}</td></tr>
      ${t.passed_out ? `<tr><td>In transit at the middle text: gone from the rule flows’ ${esc(x.L.pass.from)} inputs, not yet at their ${esc(x.L.pass.to)} outputs or at a middle form (drawn through the estimated anchor)</td><td>${num1(t.passed_out)}</td></tr>` : ''}${t.passed_in ? `<tr><td>In transit at the middle text, arriving here: gone from the rule flows’ ${esc(x.L.pass.from)} inputs before the middle text, at their ${esc(x.L.pass.to)} outputs</td><td>${num1(t.passed_in)}</td></tr>` : ''}
      <tr><td>Matched along ${x.sched ? 'scheduled' : 'active'} rules</td><td><b>${num1(t.routed)}</b></td></tr>
      <tr><td>Lost without a rule route</td><td>${num1(t.unplaced)}</td></tr>
      <tr><td>Gained without a rule route</td><td>${num1(t.unfilled)}</td></tr></tbody></table>
      ${routes.length ? `<h4>Largest routes</h4><table class="wb-table ch-table"><thead><tr><th>Route</th><th>Rules</th>${x.sched ? '<th>Schedule</th>' : ''}<th>Matched, per 10k</th></tr></thead><tbody>${routes.map(r => `<tr><td class="mono">${esc(r.from)} → ${esc(r.to)}</td><td>${esc(r.rules.join(', '))}</td>${x.sched ? `<td>${degMark(r.degree)[0]} ${degMark(r.degree)[2]}</td>` : ''}<td>${num1(r.mass)}${r.massTo != null && Math.abs(r.massTo - r.mass) > 0.05 ? ` → ${num1(r.massTo)}` : ''}</td></tr>`).join('')}</tbody></table>` : `<p class="wb-small">No ${x.sched ? 'scheduled' : 'active'} rule links a shrinking spelling of this set to a growing one at this step.</p>`}
      ${L.traced && x.L.trace ? traceTables(x) : ''}
      <p class="wb-small">${L.bigram ? 'Bigram mass: a spelling counts once per glyph bigram occurrence, so these totals exceed the set’s word mass. ' : ''}All values per 10k paragraph words. Left to right is Golf’s proposed order, a working assumption. The matched mass is one maximum allocation of the set’s loss to its gain along the ${x.sched ? 'scheduled' : 'active'} rules: a bound, not a history; tied allocations may route the same mass differently. ${NOTATION}</p></section>`;
  }

  // the middle text read along 2a → 3a: each direct route's split, and each spelling's reading
  function traceTables(x) {
    const T = x.L.trace, D = x.L.direct, from = x.L.pass.from, to = x.L.pass.to;
    const routes = T.routes.slice().sort((p, q) => q.mass - p.mass).slice(0, 10);
    const words = [...T.perWord.values()].filter(w => w.a > 0 || w.b > 0 || w.o > 0).sort((p, q) => Math.max(q.a, q.b, q.o) - Math.max(p.a, p.b, p.o)).slice(0, 10);
    const cell = v => `<td>${v > 0.05 ? num1(v) : '–'}</td>`;
    return `<h4>The middle text read along ${esc(from)} → ${esc(to)}</h4>
      <p class="wb-small">The step ${esc(from)} → ${esc(to)} is unchanged: its allocation (${num1(D.totals.routed)} per 10k words matched) is the same with the middle text off. Each route (a matched pair of spellings) is split by the middle text’s rates into what had reached its output, what still waited in its input, what was in transit and, for a two-step rule, what sat at its middle form. Fitted on ${num(T.fit.tokens)} words with a pull toward ${T.p0.toFixed(2)} of the way along the step; a spelling with under one expected token there (“thin”) follows the pull. The reading accounts for ${num1(T.fit.explained)} of the ${num1(T.fit.observed)} per 10k words that the set’s spellings make up in the middle text; the rest is the middle text’s own.</p>
      <table class="wb-table ch-table"><thead><tr><th>Route</th><th>Rules</th><th>${esc(from)} → ${esc(to)}</th><th>Reached its output</th><th>At its middle form</th><th>Still in its input</th><th>In transit</th></tr></thead><tbody>${routes.map(r => `<tr><td class="mono">${esc(r.from)} → ${esc(r.to)}</td><td>${esc((r.rules || []).join(', '))}</td><td>${num1(r.mass)}</td>${cell(r.arrived)}<td>${r.station > 0.05 ? `${num1(r.station)} <span class="mono">${esc(r.via)}</span>` : '–'}</td>${cell(r.notDeparted)}${cell(r.anchor)}</tr>`).join('')}</tbody></table>
      <table class="wb-table ch-table"><thead><tr><th>Spelling</th><th>${esc(from)}</th><th>Middle text</th><th>${esc(to)}</th><th>Kept, in the middle text</th><th>Kept, parked</th><th>Middle text’s own</th><th>Expected tokens</th></tr></thead><tbody>${words.map(w => `<tr><td class="mono">${esc(w.word)}</td><td>${num1(w.a)}</td><td>${num1(w.o)}${w.expected < 1 ? ' <span class="wb-small">thin</span>' : ''}</td><td>${num1(w.b)}</td>${cell(w.keptVisible)}${cell(w.parked)}${cell(w.surplus)}<td>${w.expected.toFixed(1)}</td></tr>`).join('')}</tbody></table>
      <p class="wb-small">Per 10k paragraph words of each group. “Middle text’s own”: mass of the spelling in the middle text that no part of the ${esc(from)} → ${esc(to)} reading accounts for (the ledgers count it as gained before the middle text and lost after it). Expected tokens: the spelling’s larger rate in ${esc(from)} and ${esc(to)}, as a count in the middle text’s ${num(T.fit.tokens)} words; “thin”: under one.</p>`;
  }

  function scheduleCard(x) {
    if (!x.sched) return '';
    const direct = x.L.direct, steps = x.L.flatMap(L => (L.traced ? (direct && L.step === direct.step ? [direct.key] : []) : [L.key])), rules = Object.keys(x.sched.rules);
    const rows = codes => codes.map(code => `<tr><td>${esc(code)}</td>${steps.map(k => { const v = (x.sched.rules[code] || {})[k] || 0, [mark, cls, name] = degMark(v); return `<td><span class="ch-deg ${cls}" title="${esc(code + ' at ' + k + ': ' + name)}">${mark}</span></td>`; }).join('')}</tr>`).join('');
    const head = `<thead><tr><th>rule</th>${steps.map(k => `<th>${esc(k)}</th>`).join('')}</tr></thead>`;
    const relevant = rules.filter(code => x.touching.has(code) || x.touching.has(code.split('.')[0]));
    return `<section class="wb-card"><div class="wb-row-title"><h3>Step schedule · ${esc(x.sched.version)}</h3><span class="wb-small">● full forward · ◐ partial forward · ○ full reverse · ◑ partial reverse · – off; partial = at most half the pair’s capacity</span></div>
      <p class="wb-small">Rules linking two spellings in this set, and the steps where each may carry a rule flow. A rule’s degree at a step is set by its forward (as written) and reverse (output to input) capacity over all spellings, after parking: full at 50 per 10k or more, at least twice the other direction, and 10 tokens or more; partial at 15 per 10k or more, at least the other direction, and 5 tokens or more; but a near-tie (under 1.1 to 1) is off. Tokens are the capacity as a word count in the step’s smaller group. Exceptions to these degrees, and the ${Object.keys(x.sched.excluded || {}).length} unscheduled rules, are in the Echo chain ruleset’s notes, not on this page.</p>
      ${relevant.length ? `<div class="wb-scroll"><table class="wb-table ch-sched">${head}<tbody>${rows(relevant)}</tbody></table></div>` : '<p class="wb-small">No scheduled rule has a pair inside this set.</p>'}
      <details><summary>All ${rules.length} scheduled rules</summary><div class="wb-scroll"><table class="wb-table ch-sched">${head}<tbody>${rows(rules)}</tbody></table></div></details></section>`;
  }

  function render() {
    if (!host) return;
    const my = ++ticket;
    try {
      const x = model();
      const body = x.m.error ? `<div class="wb-notice">${esc(x.m.error)}</div>` : `${chartCard(x)}<div class="ch-below">${stepCard(x)}${spellingCard(x)}</div>${scheduleCard(x)}`;
      host.innerHTML = `<div class="wb-wrap"><div class="wb-heading"><div><div class="wb-eyebrow">Along Golf’s proposed order</div><h2>Chain</h2><p>How the spellings of a word’s rule family, front or ending, or of a pattern, differ from group to group along Golf’s proposed order: each spelling as a ribbon, with the active rules’ matched mass between neighbouring groups.</p></div></div>
        ${controls()}${body}</div>`;
      if (my === ticket) bind(x);
    } catch (e) { host.innerHTML = `<div class="wb-wrap"><div class="wb-error">${esc(e.message)}</div></div>`; console.error(e); }
  }

  function bind(x) {
    const go = () => { state.q = host.querySelector('#ch-q').value.trim(); state.sel = []; state.step = null; render(); };
    host.querySelector('#ch-go').onclick = go;
    host.querySelector('#ch-q').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
    const on = (id, key, map = v => v, after) => { const el = host.querySelector('#' + id); if (el) el.onchange = () => { state[key] = map(el.type === 'checkbox' ? el.checked : el.value); if (after) after(); render(); }; };
    on('ch-scope', 'scope', v => v, () => { state.sel = []; state.step = null; });
    on('ch-unit', 'unit', v => v, () => { state.sel = []; });
    on('ch-axis', 'axis', v => v, () => { state.step = null; });
    on('ch-order', 'order', v => v, () => { state.step = null; });
    on('ch-measure', 'measure'); on('ch-bands', 'bands', Number); on('ch-mergeq', 'mergeQ', Boolean, () => { state.sel = []; }); on('ch-flows', 'flows', Boolean); on('ch-mid', 'middle', v => (v ? 'steps' : 'off'), () => { state.step = null; }); on('ch-skips', 'skips', Boolean); on('ch-kin', 'lineage', v => v); on('ch-since', 'keptSince', Boolean); on('ch-focus', 'ruleFocus', Boolean); on('ch-sched', 'schedule', Boolean, () => { state.step = null; });
    host.onmousedown = e => { if (e.shiftKey && e.target.closest('[data-band], [data-rule]')) e.preventDefault(); };   // no text selection on a shift-click
    host.onclick = e => {
      const band = e.target.closest('[data-band]'), col = e.target.closest('.ch-col'), seed = e.target.closest('[data-ch-seed]'), rule = e.target.closest('[data-rule]'), close = e.target.closest('[data-ch-close]');
      if (rule && state.unit === 'rule') { toggleSel(rule.dataset.rule, e.shiftKey); render(); return; }
      if (seed) { state.q = seed.dataset.chSeed; state.sel = []; state.step = null; render(); return; }
      if (close) { const l = close.dataset.chClose; state.sel = l ? state.sel.filter(s => s !== l) : []; render(); return; }
      if (e.target.closest('[data-ch-close-step]')) { state.step = null; render(); return; }
      if (band && x.lay) { const b = x.lay.bands[Number(band.dataset.band)]; if (b) toggleSel(b.label, e.shiftKey); render(); return; }
      if (col) { const i = Number(col.dataset.col); state.step = i > 0 && state.step !== i ? i : null; render(); }
    };
  }

  const R = () => root.EchoViewState.read;
  root.EchoChain = {
    show(el) { host = el; render(); },
    refresh() { if (host) render(); },
    leave() { host = null; ticket++; },
    view() { return {q: state.q, scope: state.scope, unit: state.unit, x: state.axis, order: state.order, mid: state.middle === 'steps' ? 1 : 0, parked: state.skips ? 1 : 0, kin: state.lineage === 'full' ? 2 : state.lineage === 'kin' ? 1 : 0, focus: state.ruleFocus ? 1 : 0, since: state.keptSince ? 1 : 0, sched: state.schedule ? 1 : 0, show: state.measure, bands: state.bands, mergeq: state.mergeQ ? 1 : 0, flows: state.flows ? 1 : 0, sel: state.sel.join('|'), step: state.step || ''}; },
    applyView(p) {
      const r = R(), q = r.text(p.q, 160); if (q !== undefined) state.q = q;
      const scope = r.oneOf(p.scope, SCOPES.map(s => s[0]).concat(['all'])); if (scope === 'all') state.q = ''; else if (scope) state.scope = scope;
      const unit = r.oneOf(p.unit, UNITS.map(u => u[0])); if (unit) state.unit = unit;
      const axis = r.oneOf(p.x, AXES.map(a => a[0])); if (axis) state.axis = axis;
      const ord = r.oneOf(p.order, ORDERS.map(o => o[0])); if (ord) state.order = ord;
      const mid = r.number(p.mid, 0, 2); if (mid != null && !Number.isNaN(mid)) state.middle = mid >= 1 ? 'steps' : 'off';
      const parked = r.flag(p.parked); if (parked !== undefined) state.skips = parked;
      const kinMode = r.number(p.kin, 0, 2); if (kinMode != null && !Number.isNaN(kinMode)) state.lineage = kinMode >= 2 ? 'full' : kinMode >= 1 ? 'kin' : 'off';
      const focus = r.flag(p.focus); if (focus !== undefined) state.ruleFocus = focus;
      const since = r.flag(p.since); if (since !== undefined) state.keptSince = since;
      const sched = r.flag(p.sched); if (sched !== undefined) state.schedule = sched;
      const show = r.oneOf(p.show, MEASURES.map(m => m[0])); if (show) state.measure = show;
      const bands = r.number(p.bands, 1, 40); if (bands) state.bands = Math.round(bands);
      const mergeq = r.flag(p.mergeq); if (mergeq !== undefined) state.mergeQ = mergeq;
      const flows = r.flag(p.flows); if (flows !== undefined) state.flows = flows;
      const sel = r.text(p.sel, 600); state.sel = sel ? sel.split('|').map(s => s.trim()).filter(Boolean) : [];
      const step = r.number(p.step, 1, 60); state.step = step ? Math.round(step) : null;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
