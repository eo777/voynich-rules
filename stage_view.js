/* Stages view: early -> middle -> late comparisons with the active rules (P17 app requirements).
 * Independent pairwise ledgers for every leg, one linked allocation that credits the late text once, gallows classes
 * kept apart, an optional ordinary k<->t exchange per leg, named direct and staged paths with least-most ranges, and
 * a descriptive p/f expansion table. All accounting is in stage_flow.js; this file only renders it.
 */
(function (root) {
  'use strict';
  const SF = root.EchoStageFlow;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const f1 = v => (Math.abs(v) < 0.05 ? 0 : v).toFixed(1);
  const range = (lo, hi) => hi - lo < 0.05 ? f1(lo) : `${f1(lo)}–${f1(hi)}`;
  const SHORT = {HA_early: 'early A', HA_late: 'late A', PharmaA: 'pharma', Hand1_late: 'late A + pharma', HB_all: 'Herbal B', Bio: 'Bio', Stars_h3: 'Stars'};
  const MIDS = [['Hand1_late', 'late A + pharma (pooled)'], ['HA_late', 'late Herbal A'], ['PharmaA', 'pharma']];
  const CLASSES = [['all', 'All words'], ['O', 'Ordinary gallows'], ['B', 'Bench-gallows'], ['M', 'Mixed'], ['N', 'No gallows']];
  const CLASS = {O: 'ordinary gallows', B: 'bench-gallows', M: 'mixed', N: 'no gallows'};
  const state = {src: 'HA_early', mid: 'Hand1_late', tgt: 'HB_all', scope: 'all', word: 'okol', cls: 'all', exchange: 'none', mode: 'both', sel: null};
  let host = null, cache = {key: '', value: null}, ticket = 0;
  const pops = new Map();

  const app = () => root.EchoApp;
  const label = key => SHORT[key] || app().data.sections.find(s => s.key === key)?.label || key;
  const stageWords = () => root.ECHO_STAGE_DATA.words;
  const cls = w => (stageWords()[w] && stageWords()[w][0]) || 'N';
  const rate = (w, p) => app().words.get(w)?.rate[p] || 0;

  // Words, pages and physical sheets per population, from the same lines every other tab reads (q merged).
  function population(key) {
    if (!pops.has(key)) {
      const occ = root.EchoWorkbenchCore.occurrences(root.ECHO_WORKBENCH_DATA.lines, key, true), words = new Map(), pages = new Set(), sheets = new Set();
      for (const o of occ) {
        pages.add(o.line.folio); sheets.add(o.line.sheet);
        const r = words.get(o.word) || {count: 0, sheets: new Set()}; r.count++; r.sheets.add(o.line.sheet); words.set(o.word, r);
      }
      pops.set(key, {N: occ.length, pages: pages.size, sheets: sheets.size, words});
    }
    return pops.get(key);
  }

  // ---------------------------------------------------------------- the model for the current controls
  function model() {
    const rules = app().rules(), dest = SF.destinations(SF.graphPairs(app().data, rules));
    const ex = state.exchange === 'none' ? null : SF.timing(state.exchange, stageWords()), id = w => w;
    const op1 = ex ? ex.op1 : id, op2 = ex ? ex.op2 : id;
    const inClass = w => state.cls === 'all' || cls(w) === state.cls;
    let members = [...app().words.keys()].filter(inClass), family = null;
    if (state.scope === 'family') {
      const q = state.word.trim().replace(/^q/, '');
      if (!app().words.has(q) || !inClass(q)) { members = []; family = {word: q, missing: true}; }
      else { members = SF.components(new Set(members), dest, [op1, op2]).find(g => g.includes(q)); family = {word: q}; }
    }
    return {rules, dest, ex, op1, op2, members, family};
  }
  const spec = (m, extra) => ({words: m.members, rate, dest: m.dest, ...extra});

  function heavy(m) {
    const key = JSON.stringify([[...m.rules].sort(), state.src, state.mid, state.tgt, state.scope, state.word, state.cls, state.exchange, state.mode, app().repeats?.()]);
    if (cache.key === key) return cache.value;
    const id = w => w, {src, mid, tgt} = state;
    // Pairwise ledgers. Each leg carries its own exchange; the direct comparison carries their composition.
    const leg = (P, R, op1, op2, kind) => ({P, R, kind, t: SF.solve(spec(m, {P, R, mode: 'direct', op1, op2})).totals});
    const ledgers = [
      ...['HA_late', 'PharmaA', 'Hand1_late'].map(k => leg(src, k, m.op1, id, 'first')),
      ...['HA_late', 'PharmaA', 'Hand1_late'].map(k => leg(k, tgt, m.op2, id, 'second')),
      leg(src, tgt, m.op1, m.op2, 'direct'),
      leg('HA_late', 'PharmaA', id, id, 'diagnostic')];
    // Linked allocation, all three route modes side by side, plus the direct/staged split range for 'both'.
    const linked = Object.fromEntries(['direct', 'staged', 'both'].map(mode => [mode, SF.solve(spec(m, {P: src, Q: mid, R: tgt, mode, op1: m.op1, op2: m.op2, stops: true}))]));
    const split = SF.splitRange(spec(m, {P: src, Q: mid, R: tgt, op1: m.op1, op2: m.op2}));
    // Exchange effect, one gallows class at a time (never pooled across classes).
    let classes = null;
    if (m.ex) {
      classes = ['O', 'M', 'B', 'N'].map(c => {
        const words = m.members.filter(w => cls(w) === c), s = extra => SF.solve({words, rate, dest: m.dest, ...extra});
        const link = (op1, op2) => s({P: src, Q: mid, R: tgt, mode: state.mode, op1, op2, stops: true});
        const without = link(id, id), withX = link(m.op1, m.op2);
        // which way the credit moved: change in credit into words with plain k only, t only, or both
        const dir = {k: 0, t: 0, kt: 0};
        for (const [w, r] of withX.perWord) { const l = stageWords()[w]?.[4]; if (l) dir[l] += r.credited - without.perWord.get(w).credited; }
        return {c, n: words.length, without: without.totals, with: withX.totals, dir,
          leg1: [s({P: src, R: mid, mode: 'direct'}).totals.credited, s({P: src, R: mid, mode: 'direct', op1: m.op1}).totals.credited],
          leg2: [s({P: mid, R: tgt, mode: 'direct'}).totals.credited, s({P: mid, R: tgt, mode: 'direct', op1: m.op2}).totals.credited]};
      });
    }
    // Largest unexplained families, to navigate from the whole vocabulary.
    let families = null;
    if (state.scope === 'all') {
      families = SF.components(new Set(m.members), m.dest, [m.op1, m.op2]).filter(g => g.length > 1).map(g => {
        const t = SF.solveGroup({words: g, rate, dest: m.dest, P: src, Q: mid, R: tgt, mode: state.mode, op1: m.op1, op2: m.op2, stops: true}).totals;
        const lead = g.reduce((a, b) => rate(b, src) + rate(b, tgt) > rate(a, src) + rate(a, tgt) ? b : a);
        return {lead, size: g.length, t};
      }).sort((a, b) => b.t.missing + b.t.left - a.t.missing - a.t.left).slice(0, 12);
    }
    cache = {key, value: {ledgers, linked, split, classes, families}};
    return cache.value;
  }

  // ---------------------------------------------------------------- rendering
  const select = (id, opts, cur) => `<select id="${id}">${opts.map(([v, t]) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  const field = (id, text, html) => `<div class="wb-field"><label for="${id}">${text}</label>${html}</div>`;
  const wordBtn = w => `<button class="wb-word" data-st-word="${esc(w)}">${esc(w)}</button>`;
  const badge = w => cls(w) === 'N' ? '' : ` <span class="st-cls st-${cls(w)}" title="${CLASS[cls(w)]}">${cls(w)}</span>`;

  function controls(m) {
    const populations = app().data.sections.map(s => [s.key, label(s.key)]);
    return `<div class="wb-card"><div class="wb-fields">
      ${field('st-src', 'Source', select('st-src', populations, state.src))}
      ${field('st-mid', 'Middle', select('st-mid', MIDS, state.mid))}
      ${field('st-tgt', 'Target', select('st-tgt', populations, state.tgt))}
      ${field('st-scope', 'Scope', select('st-scope', [['all', 'Whole vocabulary'], ['family', 'Family of a word']], state.scope))}
      ${state.scope === 'family' ? field('st-word', 'Word', `<input id="st-word" list="graphWords" value="${esc(state.word)}" autocomplete="off">`) : ''}
      ${field('st-cls', 'Gallows', select('st-cls', CLASSES, state.cls))}
      ${field('st-ex', 'Ordinary k↔t exchange', select('st-ex', [['none', 'None'], ['first', 'First leg'], ['second', 'Second leg'], ['both', 'Both legs (cancels at the end)']], state.exchange))}
      ${field('st-mode', 'Routes for word details', select('st-mode', [['both', 'Direct and staged'], ['staged', 'Staged only'], ['direct', 'Direct only']], state.mode))}
      </div><p class="wb-small">Uses the ${m.rules.size} active rules (Manage rules). Rates per 10k words of each population. Each target word is credited once.</p></div>`;
  }

  function populationsCard() {
    const keys = [...new Set([state.src, 'HA_late', 'PharmaA', 'Hand1_late', state.tgt])];
    return `<section class="wb-card"><h3>Populations</h3><table class="wb-table st-table"><thead><tr><th>Population</th><th>Words</th><th>Pages</th><th>Physical sheets</th></tr></thead><tbody>
      ${keys.map(k => { const p = population(k); return `<tr class="${k === state.mid ? 'st-on' : ''}"><td>${esc(label(k))}${k === state.src ? ' <span class="wb-badge neutral">source</span>' : k === state.tgt ? ' <span class="wb-badge neutral">target</span>' : k === state.mid ? ' <span class="wb-badge">middle</span>' : ''}</td><td>${p.N.toLocaleString()}</td><td>${p.pages}</td><td>${p.sheets}</td></tr>`; }).join('')}
      </tbody></table><p class="wb-small">The pooled middle combines late Herbal A and pharma (no page is in both): counts and denominators are summed, not averaged.</p></section>`;
  }

  function ledgerCard(h) {
    const exOn = kind => state.exchange !== 'none' && (kind === 'first' ? ['first', 'both'].includes(state.exchange) : kind === 'second' ? ['second', 'both'].includes(state.exchange) : kind === 'direct' ? ['first', 'second'].includes(state.exchange) : false);
    const role = {first: 'first leg', second: 'second leg', direct: 'direct benchmark', diagnostic: 'heterogeneity check'};
    const touches = r => r.P === state.mid || r.R === state.mid || r.kind === 'direct';
    return `<section class="wb-card"><div class="wb-row-title"><h3>Pairwise ledgers</h3><span class="wb-small">Each row is optimized on its own. Rows are not one path, and their credits cannot be added.</span></div>
      <div class="wb-scroll"><table class="wb-table st-table"><thead><tr><th>Comparison</th><th title="Mass already matched by unchanged words">Unchanged overlap</th><th title="Target credit after same-spelling and rule routes">Credited</th><th>Gained</th><th>Lost</th><th>Net</th><th title="Source mass with no credited route">Source left</th><th title="Target mass nothing fills">Target missing</th></tr></thead><tbody>
      ${h.ledgers.map(r => `<tr class="${touches(r) ? 'st-on' : 'st-off'}"><td>${esc(label(r.P))} → ${esc(label(r.R))} <span class="wb-small">${role[r.kind]}</span>${exOn(r.kind) ? ' <span class="wb-badge">k↔t</span>' : ''}</td>
        <td>${f1(r.t.baseline)}</td><td><b>${f1(r.t.credited)}</b></td><td>${f1(r.t.gained)}</td><td>${f1(r.t.lost)}</td><td>${f1(r.t.net)}</td><td>${f1(r.t.left)}</td><td>${f1(r.t.missing)}</td></tr>`).join('')}
      </tbody></table></div><p class="wb-small">Per 10k. Same-spelling mass is credited first; the rest moves along enabled rules (and the exchange, where marked). Only the exchange can cause a loss.</p></section>`;
  }

  function linkedCard(h) {
    const L = h.linked, cols = ['direct', 'staged', 'both'], name = {direct: 'Direct only', staged: 'Staged only', both: 'Direct and staged'};
    const routedStaged = c => c === 'both' ? range(h.split.min, h.split.max) : f1(L[c].totals.staged);
    const routedDirect = c => c === 'both' ? range(L.both.totals.routed - h.split.max, L.both.totals.routed - h.split.min) : f1(L[c].totals.direct);
    const through = c => c === 'both' ? range(h.split.min, h.split.max) : f1(L[c].totals.through);
    const row = (text, get, cls = '') => `<tr class="${cls}"><td>${text}</td>${cols.map(c => `<td class="${c === state.mode ? 'st-sel' : ''}">${get(c)}</td>`).join('')}</tr>`;
    return `<section class="wb-card"><div class="wb-row-title"><h3>Linked path · ${esc(label(state.src))} → ${esc(label(state.mid))} → ${esc(label(state.tgt))}</h3><span class="wb-small">One allocation shares source mass, middle stock and target room.</span></div>
      <div class="wb-scroll"><table class="wb-table st-table st-linked"><thead><tr><th></th>${cols.map(c => `<th class="${c === state.mode ? 'st-sel' : ''}">${name[c]}</th>`).join('')}</tr></thead><tbody>
      ${row('<b>Target credit</b> (each word once)', c => `<b>${f1(L[c].totals.credited)}</b>`)}
      ${row('· same spelling', c => f1(L[c].totals.same), 'st-sub')}
      ${row('· routed directly', routedDirect, 'st-sub')}
      ${row('· routed through the middle', routedStaged, 'st-sub')}
      ${row('Gained / lost vs unchanged overlap', c => `${f1(L[c].totals.gained)} / ${f1(L[c].totals.lost)}`)}
      ${row('<b>Source</b>', c => f1(L[c].totals.source))}
      ${row('· credited at the target', c => f1(L[c].totals.credited), 'st-sub')}
      ${row('· reaches middle stock and stops', c => c === 'direct' ? '—' : f1(L[c].totals.stops), 'st-sub')}
      ${row('· left (no route)', c => f1(L[c].totals.left), 'st-sub')}
      ${row('<b>Middle stock</b>', c => c === 'direct' ? '—' : f1(L[c].totals.middle))}
      ${row('· passed on to the target', c => c === 'direct' ? '—' : through(c), 'st-sub')}
      ${row('· arrivals that stop there', c => c === 'direct' ? '—' : f1(L[c].totals.stops), 'st-sub')}
      ${row('· not reached from the source', c => c === 'direct' ? '—' : (c === 'both' ? range(Math.max(0, L.both.totals.middle - L.both.totals.stops - h.split.max), Math.max(0, L.both.totals.middle - L.both.totals.stops - h.split.min)) : f1(L[c].totals.unreached)), 'st-sub')}
      ${row('<b>Target missing</b>', c => f1(L[c].totals.missing))}
      </tbody></table></div>
      <p class="wb-small">Order: same spelling first, then the most routed credit, then the most source mass stopped at middle stock. Ranges (least–most) cover every allocation tied at that credit. “Direct and staged” credits same-spelling mass directly, without the middle; “Staged only” requires every credited word to pass through middle stock.</p></section>`;
  }

  function classCard(h) {
    if (!h.classes) return '';
    const exName = {first: 'first leg', second: 'second leg', both: 'both legs'}[state.exchange];
    return `<section class="wb-card"><div class="wb-row-title"><h3>Exchange effect by gallows class · ${esc(exName)}</h3><span class="wb-small">Each class is a separate run; their effects are never pooled.</span></div>
      <div class="wb-scroll"><table class="wb-table st-table"><thead><tr><th>Class</th><th>Words</th><th>Linked credit without → with</th><th>Change</th><th>First leg change</th><th>Second leg change</th><th title="Change in credit into words whose plain gallows are k only / t only / both (one optimal allocation)">Into k / t / both words</th></tr></thead><tbody>
      ${h.classes.map(r => `<tr><td>${esc(CLASS[r.c])}</td><td>${r.n.toLocaleString()}</td><td>${f1(r.without.credited)} → ${f1(r.with.credited)}</td><td><b>${(r.with.credited - r.without.credited >= 0 ? '+' : '') + f1(r.with.credited - r.without.credited)}</b></td>
        <td>${f1(r.leg1[1] - r.leg1[0])}</td><td>${f1(r.leg2[1] - r.leg2[0])}</td><td>${['k', 't', 'kt'].map(l => f1(r.dir[l])).join(' / ')}</td></tr>`).join('')}
      </tbody></table></div><p class="wb-small">Linked credit uses the route setting above. The exchange swaps plain k and t in every word; bench-gallows, p and f stay unchanged. It also breaks matches that were already right, which appear as losses.</p></section>`;
  }

  function familiesCard(h) {
    if (!h.families) return '';
    return `<section class="wb-card"><h3>Families with the most unexplained mass</h3><div class="wb-scroll"><table class="wb-table st-table"><thead><tr><th>Family (largest member)</th><th>Words</th><th>Credited</th><th>Source left</th><th>Target missing</th><th></th></tr></thead><tbody>
      ${h.families.map(f => `<tr><td>${wordBtn(f.lead)}</td><td>${f.size}</td><td>${f1(f.t.credited)}</td><td>${f1(f.t.left)}</td><td>${f1(f.t.missing)}</td><td><button class="wb-button" data-st-family="${esc(f.lead)}">Open family</button></td></tr>`).join('')}
      </tbody></table></div><p class="wb-small">Route setting: ${esc(state.mode === 'both' ? 'direct and staged' : state.mode + ' only')}. Click a word for its paths.</p></section>`;
  }

  function membersCard(m, h) {
    if (state.scope !== 'family') return '';
    if (m.family.missing) return `<div class="wb-notice">No ${state.cls === 'all' ? '' : CLASS[state.cls] + ' '}word “${esc(m.family.word)}” in the vocabulary.</div>`;
    const r = h.linked[state.mode].perWord, keys = [state.src, ...MIDS.map(x => x[0]), state.tgt].filter((k, i, a) => a.indexOf(k) === i);
    const cell = (w, k) => { const p = population(k).words.get(w); return p ? `${f1(rate(w, k))} <span class="wb-small">(${p.count} · ${p.sheets.size} sh)</span>` : '<span class="wb-small">0</span>'; };
    const rows = [...m.members].sort((a, b) => keys.reduce((s, k) => s + rate(b, k) - rate(a, k), 0)).slice(0, 60);
    return `<section class="wb-card"><div class="wb-row-title"><h3>Family of ${esc(m.family.word)} · ${m.members.length} words</h3><span class="wb-small">Rate per 10k (count · physical sheets). Allocation columns: ${esc(state.mode === 'both' ? 'direct and staged' : state.mode + ' only')}, one optimal allocation.</span></div>
      <div class="wb-scroll"><table class="wb-table st-table"><thead><tr><th>Word</th>${keys.map(k => `<th class="${k === state.mid ? 'st-sel' : ''}">${esc(label(k))}</th>`).join('')}<th>Source left</th><th>Middle passed / not reached</th><th>Target credited / missing</th></tr></thead><tbody>
      ${rows.map(w => { const x = r.get(w); return `<tr class="${w === state.sel ? 'st-on' : ''}"><td>${wordBtn(w)}${badge(w)}</td>${keys.map(k => `<td>${cell(w, k)}</td>`).join('')}
        <td>${f1(x.left)}</td><td>${state.mode === 'direct' ? '—' : `${f1(x.passed)} / ${f1(x.unreached)}`}</td><td>${f1(x.credited)} / ${f1(x.missing)}</td></tr>`; }).join('')}
      </tbody></table></div>${m.members.length > rows.length ? `<p class="wb-small">Largest ${rows.length} of ${m.members.length} shown.</p>` : ''}</section>`;
  }

  // Named routes for one word, with least-most mass across every optimal allocation.
  function pathsCard(m) {
    const w = state.sel; if (!w || !m.members.includes(w)) return '';
    const g = SF.components(new Set(m.members), m.dest, [m.op1, m.op2]).find(x => x.includes(w));
    const s = {words: g, rate, dest: m.dest, P: state.src, Q: state.mid, R: state.tgt, mode: state.mode, op1: m.op1, op2: m.op2};
    const sol = SF.solveGroup(s), E = sol.edges;
    const leg1 = E.filter(x => x.type === 'leg1' && x.from === w), mids = new Set(leg1.map(x => x.to));
    const want = [...E.filter(x => x.type === 'direct' && (x.from === w || x.to === w)), ...leg1, ...E.filter(x => x.type === 'leg2' && (mids.has(x.from) || x.to === w))];
    const key = x => `${{direct: 'd', leg1: '1', leg2: '2'}[x.type]}:${x.from}>${x.to}`;
    const keys = want.slice(0, 80).map(key), rg = SF.ranges(s, keys);
    const ex = {first: ['first', 'both'].includes(state.exchange), second: ['second', 'both'].includes(state.exchange)}, exD = ex.first !== ex.second;
    const how = x => { const op = x.type === 'leg1' ? ex.first : x.type === 'leg2' ? ex.second : exD; const r = [...(x.rules || [])].join(' / ');
      return x.same ? (op ? 'k↔t' : 'same spelling') : (op ? 'k↔t + ' : '') + (r || '—'); };
    const line = x => { const v = rg.get(key(x)); return `<tr><td class="mono">${esc(x.from)} → ${esc(x.to)}</td><td>${esc(how(x))}</td><td><b>${v ? range(v.min, v.max) : f1(x.flow)}</b></td></tr>`; };
    const me = sol.perWord.get(w);
    const block = (title, rows, empty) => `<h4>${title}</h4>${rows.length ? `<table class="wb-table st-table st-paths"><thead><tr><th>Route</th><th>How</th><th>Least–most</th></tr></thead><tbody>${rows.map(line).join('')}</tbody></table>` : `<p class="wb-small">${empty}</p>`}`;
    return `<section class="wb-card st-pathcard"><div class="wb-row-title"><h3>Paths for ${esc(w)}${badge(w)}</h3><button class="wb-button" data-st-close>Close</button></div>
      <p class="wb-small">Source ${f1(me.source)} · middle ${f1(me.middle)} · target ${f1(me.target)} per 10k. Same-spelling mass credited${exD ? ' after the exchange' : ''}: ${f1(me.same)}${state.mode === 'staged' && me.same ? ' (through the middle)' : ''}. A composite route (e.g. C1 via cheol) is a declared endpoint pairing; it does not show that mass passed through the middle form.</p>
      ${state.mode !== 'staged' ? block('Direct', want.filter(x => x.type === 'direct' && x.from === w), 'No direct rule route from this word.') : ''}
      ${state.mode !== 'direct' ? block(`Into the middle (${esc(label(state.mid))})`, leg1, 'No route into middle stock.') + block('Onward from those middle forms', want.filter(x => x.type === 'leg2' && mids.has(x.from)), 'No onward route.') : ''}
      ${block('Into this word', want.filter(x => x.to === w && (x.type === 'direct' || (x.type === 'leg2' && !mids.has(x.from)))), 'No route ends here.')}
      ${want.length > 80 ? '<p class="wb-small">Ranges for the first 80 routes only.</p>' : ''}</section>`;
  }

  function pfCard(m) {
    const sw = stageWords(), rows = m.members.filter(w => sw[w] && sw[w][2]).sort((a, b) => rate(b, state.src) + rate(b, state.tgt) - rate(a, state.src) - rate(a, state.tgt)).slice(0, 30);
    if (!rows.length) return '';
    const r3 = w => [state.src, state.mid, state.tgt].map(k => f1(rate(w, k))).join(' / ');
    return `<details class="wb-card"><summary>p/f expansions · ${rows.length} word${rows.length === 1 ? '' : 's'} with plain p or f</summary>
      <p class="wb-small">Descriptive comparison only; raw forms are kept and nothing enters the ledgers above. Rates per 10k: ${esc(label(state.src))} / ${esc(label(state.mid))} / ${esc(label(state.tgt))}.</p>
      <div class="wb-scroll"><table class="wb-table st-table"><thead><tr><th>Raw form</th><th>Rates</th><th>Davis pairing (p→ke, f→te)</th><th>Rates</th><th>Loop-matched (p→te, f→ke)</th><th>Rates</th></tr></thead><tbody>
      ${rows.map(w => `<tr><td>${wordBtn(w)}</td><td>${r3(w)}</td><td class="mono">${esc(sw[w][2])}</td><td>${r3(sw[w][2])}</td><td class="mono">${esc(sw[w][3])}</td><td>${r3(sw[w][3])}</td></tr>`).join('')}
      </tbody></table></div><p class="wb-small">For a stage-dependent pairing, read one column for the earlier stage and the other for the later stage.</p></details>`;
  }

  function render() {
    if (!host) return;
    const my = ++ticket;
    host.innerHTML = `<div class="wb-wrap"><p class="wb-caption" role="status">Computing stage ledgers…</p></div>`;
    setTimeout(() => {
      if (my !== ticket || !host) return;
      try {
        const m = model(), h = m.members.length ? heavy(m) : null;
        host.innerHTML = `<div class="wb-wrap"><div class="wb-heading"><div><div class="wb-eyebrow">Intermediate sections</div><h2>Stages</h2><p>Compare each leg on its own, then one linked allocation from source through the middle to the target.</p></div></div>
          ${controls(m)}
          ${h ? populationsCard() + ledgerCard(h) + linkedCard(h) + classCard(h) + pathsCard(m) + membersCard(m, h) + familiesCard(h) + pfCard(m) : membersCard(m, {linked: {}})}</div>`;
        bind();
      } catch (e) { host.innerHTML = `<div class="wb-wrap"><div class="wb-error">${esc(e.message)}</div></div>`; console.error(e); }
    }, 0);
  }

  function bind() {
    const on = (id, key, after) => { const el = host.querySelector('#' + id); if (el) el.onchange = () => { state[key] = el.value; if (after) after(); render(); }; };
    on('st-src', 'src'); on('st-mid', 'mid'); on('st-tgt', 'tgt'); on('st-cls', 'cls'); on('st-ex', 'exchange'); on('st-mode', 'mode');
    on('st-scope', 'scope', () => { state.sel = null; });
    const word = host.querySelector('#st-word'); if (word) word.onchange = () => { state.word = word.value.trim(); state.sel = state.word.replace(/^q/, ''); render(); };
    host.onclick = e => {
      const w = e.target.closest('[data-st-word]'), fam = e.target.closest('[data-st-family]');
      if (fam) { state.scope = 'family'; state.word = fam.dataset.stFamily; state.sel = state.word; render(); }
      else if (w) { state.sel = w.dataset.stWord; render(); }
      else if (e.target.closest('[data-st-close]')) { state.sel = null; render(); }
    };
  }

  root.EchoStages = {
    show(el) { host = el; render(); },
    leave() { host = null; ticket++; },
    refresh() { if (host) render(); },
    focus(word) { state.scope = 'family'; state.word = word; state.sel = word; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
