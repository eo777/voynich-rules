/* UI adapter for the occurrence engine and frozen LC1 ledger.
 * Keep saved evaluations immutable. The sandbox starts from the observed corpus;
 * it cannot be layered onto LC1 aggregate residuals without occurrence policies.
 */
(() => {
  'use strict';
  const C = window.EchoWorkbenchCore, W = window.ECHO_WORKBENCH_DATA, D = window.ECHO_DATA;
  // Add research menus without changing the frozen ledger or its provenance.
  Object.assign(W.known, window.ECHO_RULE_CATALOG?.known || {});
  const host = document.getElementById('workbenchPage');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const fmt = n => Number(n).toLocaleString(undefined, {maximumFractionDigits: 2});
  const pct = n => fmt(n / 100) + '%';
  const option = (value, text, selected) => `<option value="${esc(value)}" ${value === selected ? 'selected' : ''}>${esc(text)}</option>`;
  const options = (values, selected) => values.map(v => option(...(Array.isArray(v) ? v : [v, v]), selected)).join('');
  const field = (id, label, html, wide = false) => `<div class="wb-field ${wide ? 'wide' : ''}"><label for="${id}">${label}</label>${html}</div>`;
  const select = (id, values, value) => `<select id="${id}">${options(values, value)}</select>`;
  const input = (id, value, placeholder = '') => `<input id="${id}" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off">`;
  // A pattern box with a line under it: a pattern with operators, with its grouping written out, or what stops
  // the pattern from being read. It updates as you type (listener below). A word-pattern box matches occurrences
  // and may test neighbors (-1:…); a box with scope 'word' (the neighbor boxes, the Residuals filter) matches one
  // word, so it refuses them.
  const reading = (value, scope = '') => {
    try {
      if (scope === 'word') C.pattern(value); else C.occurrencePattern(value);
      const text = C.describePattern(value); return text && C.parsePattern(value).t !== 'term' ? `Reads as <code>${esc(text)}</code>` : '';
    } catch (error) { return `<span class="wb-reading-error">${esc(error.message)}</span>`; }
  };
  const patternInput = (id, value, placeholder = '', scope = '') => `${input(id, value, placeholder).replace('<input ', `<input class="wb-pattern"${scope ? ` data-scope="${scope}"` : ''} `)}<div class="wb-reading" id="${id}-reading" aria-live="polite">${reading(value, scope)}</div>`;
  // The first pattern box that cannot be read, named as on the page, with what is wrong ('' when all can be read).
  // boxes: [name, pattern, scope].
  function patternProblem(boxes) {
    for (const [name, query, scope] of boxes) { try { if (scope === 'word') C.pattern(query); else C.occurrencePattern(query); } catch (error) { return `${name}: ${error.message}`; } }
    return '';
  }
  // The pattern syntax, under every form with word patterns
  const patternHelp = mergeQ => `Patterns match whole ${mergeQ ? 'q-merged' : 'original'} spellings: * = any letters, ? = one character. Combine patterns with AND, OR, NOT (or &amp;, |, !) and parentheses; -1:*k* tests the word before a match and 1:*k* the word after.`;
  const neighborBoxes = s => [['Two words before', s.prev2, 'word'], ['Previous word', s.prev, 'word'], ['Next word', s.next, 'word']];
  // With Merge q on, every word and neighbor loses one initial q before matching, so a q-initial term finds nothing.
  const qMaskedIn = (mergeQ, queries) => mergeQ && queries.some(p => { try { return C.patternTerms(p).some(t => t.startsWith('q')); } catch { return false; } });
  const button = (text, action, cls = '') => `<button class="wb-button ${cls}" data-action="${action}">${text}</button>`;
  // Export menu: download a CSV, or copy the same rows tab-separated for pasting into a spreadsheet
  const exportMenu = (csvAction, copyAction) => `<details class="wb-menu"><summary class="wb-button"><span class="wb-menu-label">Export</span><svg class="wb-chevron" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5l3 3 3-3"/></svg></summary><div class="wb-menu-list"><button class="wb-menu-item" data-action="${csvAction}">Download CSV</button><button class="wb-menu-item" data-action="${copyAction}" title="Tab-separated, for pasting into Google Sheets or Excel">Copy as TSV</button></div></details>`;
  const metric = (label, value, note = '') => `<div class="wb-metric"><span>${label}</span><strong>${value}</strong><span>${note}</span></div>`;
  const wordButton = (word, action = 'word') => `<button class="wb-word" data-action="${action}" data-word="${esc(word)}">${esc(word)}</button>`;
  const populations = D.sections.map(s => [s.key, s.label]);
  const label = key => D.sections.find(s => s.key === key)?.label || key;
  const cache = new Map();
  const M = window.ECHO_MANUSCRIPT, manuscriptLines = M ? W.lines.concat(M.extra_lines) : W.lines;
  // Loci of the Words & contexts search and its chart: running text (paragraphs, circles, radii: the default, which
  // keeps every earlier count), all loci with labels, or one category. Workbench lines are paragraph text; circle and
  // radial text belongs to no population, labels to the population of their page.
  const LOCI = C.LOCI;
  const LOCUS_OPTIONS = [['running', 'Running text (prose, circles, radii)'], ['all', 'All loci, labels included'], ['para', 'Prose paragraphs'], ['label', 'Labels'], ['circle', 'Circular text'], ['radial', 'Radial text']];
  const locusText = locus => (LOCUS_OPTIONS.find(o => o[0] === locus) || LOCUS_OPTIONS[0])[1].replace(/^\w/, c => c.toLowerCase());
  function linesFor(locus='running') { const key='lines|'+locus;if (!cache.has(key)) { const keep=new Set(LOCI[locus]||LOCI.running); cache.set(key, manuscriptLines.filter(l=>keep.has(l.category||'para'))); } return cache.get(key); }
  function manuscript(mergeQ=true, locus='running') { const key='manuscript|'+mergeQ+'|'+locus;if (!cache.has(key)) cache.set(key, C.occurrences(linesFor(locus), 'all', mergeQ)); return cache.get(key); }
  function searchCorpus(section,mergeQ=true,locus='running') { const key='search|'+section+'|'+mergeQ+'|'+locus;if (!cache.has(key)) cache.set(key, C.occurrences(linesFor(locus), section, mergeQ)); return cache.get(key); }
  function corpus(section,mergeQ=true) { const key=section+'|'+mergeQ;if (!cache.has(key)) cache.set(key, C.occurrences(W.lines, section,mergeQ)); return cache.get(key); }
  const defaults = () => ({name: 'daiin → aiin (candidate)', enabled: true, kind: 'exact', code: 'd', from: 'daiin', to: 'aiin', fraction: .45,
    prev2: '', prev: '', next: '', q: 'any', nextQ: 'any', position: 'any', lineClass: 'any'});
  const state = {tab: 'residuals', evaluation: Object.keys(W.residuals)[0], side: 'target', query: '', route: 'all', bin: '', residualPage: 0,
    search: {mergeQ:false,section: 'HA_early', compare: 'HB_all', query: '*aiin', compareQuery: '', mode: 'glob', prev2: '', prev: '', next: '', q: 'any', nextQ: 'any', position: 'any', lineClass: 'any', folio: '', sheet: '', groupFilters: [], locus: 'running'}, contextPage: 0, qExclusions:{},
    lab: {from: 'HA_early', to: 'HB_all', rules: [defaults()]}, result: null, preview: '', storage: '', chartSource: 'saved', neighborDrill: null, percentMode:'baseline', signalFilter:'all',neighborMode:'edges',neighborPages:{prev:0,next:0},reviewMinGap:1,reviewMinLift:2,reviewLargeGap:5,
    pageChart:{group:'section',measure:'count',pattern:'search',ordering:'manuscript',layout:'combined',unit:'page',bins:'auto',zeros:'show',range:'clip',open:true,hidden:{}},
    resMode:'saved',resFrom:'HA_early',resTo:'HB_all',resCls:'all',fitCompare:'e1',fitEval:0,fit:null,fitStatus:'',fitRunning:false,
    distView:{word:'',changed:false,labels:12,min:0,basis:'either'},autoFit:false,
    patterns:{list:['*aiin','*ain'],mergeQ:false,locus:'running',prev2:'',prev:'',next:'',q:'any',nextQ:'any',position:'any',lineClass:'any',group:'section',measure:'per10k',barScale:'table',pinned:[],unit:'page',layout:'combined',ordering:'manuscript',bins:'auto',zeros:'show',range:'clip',hidden:{}}};
  try { const saved = localStorage.getItem('echo-workbench-v1'); if (saved) state.lab = validate(JSON.parse(saved)); } catch { state.storage = 'The saved draft could not be loaded. A fresh candidate is shown.'; }
  function validate(obj) {
    if (obj.schema !== 1 || !populations.some(s => s[0] === obj.from) || !populations.some(s => s[0] === obj.to) || !Array.isArray(obj.rules) || obj.rules.length > 30) throw new Error('Use a version 1 Echo experiment with valid populations and at most 30 rules.');
    const rules = obj.rules.map(r => {
      if (!r || typeof r !== 'object') throw new Error('Each rule must be an object.');
      const clean = Object.fromEntries(Object.keys(defaults()).map(k => [k, r[k] ?? defaults()[k]]));
      for (const [k, v] of Object.entries(clean)) {
        if (k === 'fraction') { if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1) throw new Error('Invalid application fraction.'); }
        else if (k === 'enabled') { if (typeof v !== 'boolean') throw new Error('Invalid enabled flag.'); }
        else if (typeof v !== 'string' || v.length > 160) throw new Error('Rule fields must be short strings.');
      }
      if (!['known','exact','prefix','suffix','contains'].includes(clean.kind)) throw new Error('Unsupported edit type.');
      for (const k of ['q', 'nextQ']) if (!['any','yes','no'].includes(clean[k])) throw new Error('Invalid q filter.');
      if (!['any','start','end','interior'].includes(clean.position) || !['any','first','body'].includes(clean.lineClass)) throw new Error('Invalid position filter.');
      return clean;
    });
    return {from: obj.from, to: obj.to, rules};
  }
  function save() {
    try { localStorage.setItem('echo-workbench-v1', JSON.stringify({schema: 1, ...state.lab})); state.storage = 'Draft saved in this browser.'; }
    catch { state.storage = 'Browser storage is unavailable. Export JSON to keep your draft.'; }
  }
  function download(name, data, type = 'application/json') {
    const url = URL.createObjectURL(new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], {type}));
    const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function go(tab) { document.querySelector(`.tab[data-tab="${tab}"]`).click(); }
  function heading(kicker, title, subtitle) { return `<div class="wb-heading"><div><div class="wb-eyebrow">${kicker}</div><h2>${title}</h2><p>${subtitle}</p></div><span class="wb-badge neutral">Research snapshot · 26 Sep 2026</span></div>`; }
  function pager(page, total, size, prefix) {
    return `<div class="wb-pager"><span>${total ? `${page * size + 1}–${Math.min(total, (page + 1) * size)} of ${fmt(total)}` : '0 results'}</span><button class="wb-button" data-action="${prefix}-back" ${page === 0 ? 'disabled' : ''}>Previous</button><button class="wb-button" data-action="${prefix}-next" ${(page + 1) * size >= total ? 'disabled' : ''}>Next</button></div>`;
  }
  // The Residuals word filter. A pattern that cannot be read matches no word, and the line under its box says why.
  const residualMatch = () => { try { return C.pattern(state.query); } catch { return () => false; } };
  function residualRows() {
    const key = state.side === 'target' ? 'target_shortfall_after_rate' : 'source_surplus_after_rate';
    const reach = state.side === 'target' ? 'target_has_incoming_edge_from_attested_A' : 'source_has_admissible_rule';
    const match = residualMatch();
    return W.residuals[state.evaluation].words.filter(w => w[key] > 1e-8 && match(w.word) && (!state.bin || w.spelling_bin === state.bin) &&
      (state.route === 'all' || Boolean(w[reach]) === (state.route === 'yes'))).sort((a, b) => b[key] - a[key]);
  }
  // What a saved evaluation was fitted and tested on. Sheet lists come from the LC1 split file via the bundle.
  function evalNote(key, what = 'Figures') {
    const e = W.residuals[key], s = e?.sheets, p = C.evalParts(key);
    if (!s || !p) return '';
    // Sheets are listed by their two folios ('A:2-7' -> f2+f7) so quire letters cannot be read as Herbal A/B.
    const folios = id => { const m = /^[A-Z]+:(\d+)-(\d+)$/.exec(id); return m ? `f${m[1]}+f${m[2]}` : id; };
    const first = id => +(/:(\d+)/.exec(id)?.[1] ?? Infinity);
    const cell = xs => `${[...xs].sort((a, b) => first(a) - first(b)).map(x => `<span title="sheet ${esc(x)}">${esc(folios(x))}</span>`).join(', ')} <span class="wb-split-n">(${xs.length})</span>`;
    return `<p class="wb-caption">How often each rule applies was fitted on ${s.fit.sheets_A.length} early Herbal A + ${s.fit.sheets_B.length} Herbal B sheets, then tested on the other ${s.eval.sheets_A.length} + ${s.eval.sheets_B.length} sheets: ${fmt(e.N_A)} early A and ${fmt(e.N_B)} Herbal B words. ${what} below use the tested half.</p>
      <details class="wb-split"><summary title="ID in the LC1 result files: ${esc(key)}">Sheets in each half of split ${p.split}</summary><p>Splits 1 and 2 are two random halvings of the same sheets; early Herbal A (${s.fit.sheets_A.length + s.eval.sheets_A.length}) and Herbal B (${s.fit.sheets_B.length + s.eval.sheets_B.length}) are halved separately. Each sheet is one bifolium, listed by its two folios.</p><table><thead><tr><th></th><th>Early Herbal A</th><th>Herbal B</th></tr></thead><tbody>
      <tr><th>Fitted · half ${p.fit}</th><td>${cell(s.fit.sheets_A)}</td><td>${cell(s.fit.sheets_B)}</td></tr>
      <tr><th>Tested · half ${p.test}</th><td>${cell(s.eval.sheets_A)}</td><td>${cell(s.eval.sheets_B)}</td></tr></tbody></table>
      </details>`;
  }
  // Residuals come from the saved LC1 policy (early A -> Herbal B only) or from the active rules for any two
  // populations. The second is a shared-capacity bound, the same accounting as Network and Stages.
  function residualModeField() {
    return `<div class="wb-fields">${field('wb-res-mode','Residuals from',select('wb-res-mode',[['saved','Saved LC1 policy · early A → Herbal B'],['rules','Active rules · any two populations'],['fit','Fitted active rules · held-out, early A → Herbal B']],state.resMode),true)}</div>`;
  }
  const RES_POPS = () => D.sections.map(s => [s.key, s.key === 'Hand1_late' ? 'late A + pharma (pooled)' : s.label]);
  const sheetCache = new Map();
  function sheetsOf(pop) {
    if (!sheetCache.has(pop)) { const m = new Map(); for (const o of corpus(pop, true)) { if (!m.has(o.word)) m.set(o.word, new Set()); m.get(o.word).add(o.line.sheet); } sheetCache.set(pop, m); }
    return sheetCache.get(pop);
  }
  function ruleResidualRows() {
    const A = window.EchoApp, SF = window.EchoStageFlow, stage = window.ECHO_STAGE_DATA.words, P = state.resFrom, R = state.resTo;
    const cls = w => stage[w]?.[0] || 'N', rate = (w, k) => A.words.get(w)?.rate[k] || 0;
    const words = [...A.words.keys()].filter(w => state.resCls === 'all' || cls(w) === state.resCls);
    const sol = SF.solve({words, rate, P, R, mode: 'direct', dest: SF.destinations(SF.graphPairs(A.data, A.rules()))});
    const out = new Set(sol.edges.filter(x => x.type === 'direct').map(x => x.from)), inn = new Set(sol.edges.filter(x => x.type === 'direct').map(x => x.to));
    const target = state.side === 'target', match = residualMatch(), sa = sheetsOf(P), sb = sheetsOf(R);
    const rows = [...sol.perWord.values()].map(r => ({...r, cls: cls(r.word), countA: A.words.get(r.word).count[P] || 0, countB: A.words.get(r.word).count[R] || 0,
      sheetsA: sa.get(r.word)?.size || 0, sheetsB: sb.get(r.word)?.size || 0, route: target ? inn.has(r.word) : out.has(r.word)}))
      .filter(r => (target ? r.missing : r.left) > 1e-8 && match(r.word) && (state.route === 'all' || r.route === (state.route === 'yes')))
      .sort((a, b) => target ? b.missing - a.missing : b.left - a.left);
    return {rows, totals: sol.totals, target};
  }
  function ruleResiduals() {
    const {rows, totals, target} = ruleResidualRows(), lab = k => RES_POPS().find(x => x[0] === k)[1];
    const mass = rows.reduce((s, r) => s + (target ? r.missing : r.left), 0), noRoute = rows.filter(r => !r.route).reduce((s, r) => s + (target ? r.missing : r.left), 0);
    host.innerHTML = `<div class="wb-wrap">${heading('01 / Inspect the unexplained', 'Where the current rules fall short', `Per-word residuals for any two populations under the ${window.EchoApp.rules().size} active rules. A shared-capacity upper bound, not a fitted model.`)}
      ${residualModeField()}
      <div class="wb-card"><div class="wb-fields">${field('wb-res-from','Source',select('wb-res-from',RES_POPS(),state.resFrom))}${field('wb-res-to','Target',select('wb-res-to',RES_POPS(),state.resTo))}
      ${field('wb-side','Residual side',select('wb-side',[['target','Target missing'],['source','Source left']],state.side))}
      ${field('wb-res-query','Word pattern',patternInput('wb-res-query',state.query,'e.g. chol | chor','word'))}
      ${field('wb-route','Rule route',select('wb-route',[['all','All forms'],['no','No route'],['yes','Has a route']],state.route))}
      ${field('wb-res-cls','Gallows',select('wb-res-cls',[['all','All words'],['O','Ordinary gallows'],['B','Bench-gallows'],['M','Mixed'],['N','No gallows']],state.resCls))}
      ${button('Apply filters','res-filter','primary')}</div></div>
      <div class="wb-metrics">${metric('Unchanged overlap', pct(totals.baseline), lab(state.resFrom)+' → '+lab(state.resTo))}${metric('After active rules', pct(totals.credited), 'same spelling first, then shared capacity')}${metric('Remaining mismatch', pct(target ? totals.missing : totals.left), target ? 'target missing' : 'source left')}${metric(target ? 'Missing with no incoming route' : 'Left with no outgoing route', pct(mass ? noRoute / mass * 10000 : 0), 'share of the filtered residual')}</div>
      <div class="wb-card"><div class="wb-row-title"><p class="wb-caption">${rows.length} forms · ${fmt(mass)} /10k ${target ? 'missing' : 'left'}${window.EchoApp.repeats?.()==='collapse'?' · repeats collapsed (X X → X), tokens counted after collapsing':''}. Click a word to explore its occurrences.</p>${button('Export rows CSV','res-export')}</div>
      <div class="wb-scroll"><table class="wb-table"><thead><tr><th>Form</th><th>Source tokens</th><th>Target tokens</th><th>Source /10k</th><th>Target /10k</th><th>Kept</th><th>${target ? 'Received' : 'Sent'}</th><th>${target ? 'Missing' : 'Left'}</th><th>Sheets (source / target)</th><th>Rule route</th></tr></thead><tbody>
      ${rows.slice(state.residualPage * 40, (state.residualPage + 1) * 40).map(r => `<tr><td>${wordButton(r.word)}</td><td>${r.countA}</td><td>${r.countB}</td><td>${fmt(r.source)}</td><td>${fmt(r.target)}</td><td>${fmt(r.same)}</td><td>${fmt(target ? r.received : r.direct)}</td><td><b>${fmt(target ? r.missing : r.left)}</b></td><td>${r.sheetsA} / ${r.sheetsB}</td><td><span class="wb-badge ${r.route ? 'neutral' : ''}">${r.route ? 'yes' : 'no'}</span></td></tr>`).join('')}
      </tbody></table></div>${pager(state.residualPage, rows.length, 40, 'res')}</div>
      <p class="wb-small">Same as Network and Stages: each word keeps its own spelling first, then the rest moves along active rules with shared capacity. One of several tied allocations; Stages shows the ranges.</p></div>`;
    bind();
  }
  // ---------------------------------------------------------------- held-out fit of the active rules (LC1 model P)
  // For each of the four LC1 sheet splits: fit one fraction per rule and word front on one half (catalog families: one
  // per family), apply it unchanged to the other half and score the overlap with Herbal B there. fit_core.js reproduces
  // the saved LC1 evaluations exactly (test/fit.test.js). The HiGHS solver (vendor/highs) loads on first use.
  let solverLoad = null;
  function loadSolver() {
    if (!solverLoad) {
      solverLoad = (async () => {
        const add = src => new Promise((resolve, reject) => { const s = document.createElement('script'); s.src = src; s.onload = resolve;
          s.onerror = () => { s.remove(); reject(new Error('The LP solver could not load (' + src + ').')); }; document.head.appendChild(s); });
        if (!window.EchoHighs) { await add('vendor/highs/highs.js?v=0bd23843c9'); window.EchoHighs = window.Module; }
        if (!window.ECHO_HIGHS_WASM) await add('vendor/highs/highs_wasm.js?v=a540083944');
        const bytes = Uint8Array.from(atob(window.ECHO_HIGHS_WASM), c => c.charCodeAt(0));
        // Emscripten's instantiateWasm hook: compile the bundled bytes, so nothing is fetched (works from file:// too).
        const highs = await window.EchoHighs({instantiateWasm: (info, receive) => { WebAssembly.instantiate(bytes, info).then(r => receive(r.instance, r.module)); return {}; }});
        return lp => highs.solve(lp, {output_flag: false});
      })();
      solverLoad.catch(() => { solverLoad = null; });
    }
    return solverLoad;
  }
  const compareOptions = () => [['e1', 'E1 rules (the saved LC1 set)'], ['defaults', 'Default rules'],
    ...[...window.EchoApp.rules()].sort().map(c => ['minus:' + c, 'Active rules without ' + c])];
  const compareLabel = () => (compareOptions().find(o => o[0] === state.fitCompare) || ['', state.fitCompare])[1];
  function fitSets() {
    const active = new Set(window.EchoApp.rules()), c = state.fitCompare;
    const compare = c === 'e1' ? new Set(window.ECHO_FIT_DATA.e1) : c === 'defaults' ? new Set(D.rules.filter(r => r.default).map(r => r.code))
      : new Set([...active].filter(x => x !== c.slice(6)));
    return {active, compare};
  }
  const fitSignature = () => { const {active, compare} = fitSets(); return JSON.stringify([[...active].sort(), [...compare].sort(), window.EchoApp.repeats?.() || 'keep']); };
  async function runFit() {
    const status = text => { state.fitStatus = text; const el = document.getElementById('wb-fit-status'); if (el) el.textContent = text; };
    status('Loading the solver…');
    const solve = await loadSolver(), sets = fitSets(), keys = Object.keys(W.residuals), collapse = window.EchoApp.repeats?.() === 'collapse', out = {active: [], compare: []};
    let n = 0;
    for (const key of keys) for (const name of ['active', 'compare']) {
      status(`Fitting split ${Math.floor(n++ / 2) + 1} of ${keys.length}: ${name === 'active' ? 'active rules' : 'comparison'}…`); await new Promise(r => setTimeout(r));
      out[name].push({key, ...window.EchoFit.heldOut({lines: W.lines, sheets: W.residuals[key].sheets, active: sets[name], fitData: window.ECHO_FIT_DATA,
        catalogKnown: window.ECHO_RULE_CATALOG.known, catalogRoutes: window.ECHO_RULE_CATALOG.routes, solve, collapse})});
    }
    state.fit = {signature: fitSignature(), active: out.active, compare: out.compare, compareLabel: compareLabel(), collapse, rules: sets.active.size};
    state.fitStatus = '';
  }
  const pp = x => (x < 0 ? '−' : '+') + fmt(Math.abs(x) / 100) + ' points';
  const shortEval = key => { const p = C.evalParts(key); return p ? `Split ${p.split}, ${p.fit}→${p.test}` : key; };
  function thetaTable(F) {
    const cells = [...new Set(F.active.flatMap(a => [...a.theta.keys()]))].sort(), zero = [...new Set(F.active.flatMap(a => a.diag.fixedZero))].sort();
    return `<div class="wb-scroll"><table class="wb-table"><thead><tr><th>Rule · front (letter before the rewrite)</th>${F.active.map(a => `<th title="${esc(C.evalLabel(a.key))}">${esc(shortEval(a.key))}</th>`).join('')}</tr></thead><tbody>
      ${cells.map(c => { const [r, f] = c.split('|'); return `<tr><td>${esc(r)} · ${esc(f === 'all' ? 'all fronts' : f)}</td>${F.active.map(a => `<td>${a.theta.has(c) ? fmt(100 * a.theta.get(c)) + '%' : '—'}</td>`).join('')}</tr>`; }).join('')}
      </tbody></table></div><p class="wb-small">Share of each matching early Herbal A word that the rule rewrites, fitted for each split and each front. Rules without a recorded front, such as L_NOM_L, have one share for all fronts.${zero.length ? ' Some fronts too rare to fit, held at 0: ' + zero.map(esc).join(', ') + '.' : ''}</p>`;
  }
  function fitSummary(F) {
    const rows = F.active.map((a, i) => ({key: a.key, before: a.outOfFit.pooled_before, act: a.outOfFit.pooled_after, cmp: F.compare[i].outOfFit.pooled_after}));
    const mean = k => rows.reduce((s, r) => s + r[k], 0) / rows.length, higher = rows.filter(r => r.act - r.cmp > 0.005).length, lower = rows.filter(r => r.cmp - r.act > 0.005).length;
    return `<div class="wb-metrics">${metric('Unchanged overlap', pct(mean('before')), 'no rules · mean of the four held-out halves')}${metric(esc(F.compareLabel), pct(mean('cmp')), 'fitted, scored on held-out halves')}${metric(`Active rules (${F.rules})`, pct(mean('act')), 'fitted, scored on held-out halves')}${metric('Active minus comparison', pp(mean('act') - mean('cmp')), `higher in ${higher} of 4 splits, lower in ${lower}`)}</div>
      <div class="wb-card"><h3>Held-out overlap by split</h3><div class="wb-scroll"><table class="wb-table"><thead><tr><th>Evaluation</th><th>Unchanged</th><th>Comparison</th><th>Active rules</th><th>Active − comparison</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td>${esc(C.evalLabel(r.key))}</td><td>${pct(r.before)}</td><td>${pct(r.cmp)}</td><td>${pct(r.act)}</td><td><b>${pp(r.act - r.cmp)}</b></td></tr>`).join('')}
      </tbody></table></div><p class="wb-small">Overlap: the share of word frequency early Herbal A and Herbal B have in common on the held-out half${F.collapse ? ', repeats collapsed (X X → X)' : ''}.</p>
      <details><summary>Fitted fractions</summary>${thetaTable(F)}</details></div>`;
  }
  function fitResidualRows(F) {
    const i = Math.min(state.fitEval, F.active.length - 1), cmp = new Map(F.compare[i].outOfFit.perWord.map(r => [r.word, r]));
    const key = state.side === 'target' ? 'shortfall' : 'surplus', match = residualMatch();
    return F.active[i].outOfFit.perWord.filter(r => r[key] > 1e-8 && match(r.word)).map(r => ({...r, cmpAfter: cmp.has(r.word) ? cmp.get(r.word).after : r.before})).sort((a, b) => b[key] - a[key]);
  }
  function fitResidualTable(F) {
    const rows = fitResidualRows(F), target = state.side === 'target', key = target ? 'shortfall' : 'surplus', mass = rows.reduce((s, r) => s + r[key], 0);
    return `<div class="wb-card"><h3>Residuals on one held-out half</h3><div class="wb-fields">${field('wb-fit-eval', 'Split', select('wb-fit-eval', F.active.map((a, i) => [String(i), C.evalLabel(a.key)]), String(state.fitEval)), true)}
      ${field('wb-side', 'Residual side', select('wb-side', [['target', 'Herbal B shortfall'], ['source', 'Early Herbal A surplus']], state.side))}
      ${field('wb-res-query', 'Word pattern', patternInput('wb-res-query', state.query, 'e.g. chol | chor', 'word'))}${button('Apply filters', 'res-filter', 'primary')}</div>
      <div class="wb-row-title"><p class="wb-caption">${rows.length} forms · ${fmt(mass)} /10k ${target ? 'shortfall' : 'surplus'} after the active rules. Click a word to explore its occurrences.</p>${button('Export rows CSV', 'res-export')}</div>
      <div class="wb-scroll"><table class="wb-table"><thead><tr><th>Form</th><th>Early A /10k</th><th>After comparison</th><th>After active rules</th><th>Herbal B /10k</th><th>${target ? 'Shortfall' : 'Surplus'}</th></tr></thead><tbody>
      ${rows.slice(state.residualPage * 40, (state.residualPage + 1) * 40).map(r => `<tr><td>${wordButton(r.word)}</td><td>${fmt(r.before)}</td><td>${fmt(r.cmpAfter)}</td><td>${fmt(r.after)}</td><td>${fmt(r.target)}</td><td><b>${fmt(r[key])}</b></td></tr>`).join('')}
      </tbody></table>${!rows.length ? '<div class="wb-empty">No residuals match.</div>' : ''}</div>${pager(state.residualPage, rows.length, 40, 'res')}</div>`;
  }
  function fitResiduals() {
    if (!compareOptions().some(o => o[0] === state.fitCompare)) state.fitCompare = 'e1';
    const F = state.fit, stale = F && F.signature !== fitSignature();
    host.innerHTML = `<div class="wb-wrap">${heading('01 / Inspect the unexplained', 'Where the current rules fall short', 'Fit the active rules on one sheet half, score them on the other, and compare with another rule set, such as the active rules without one rule, to see what that rule adds.')}
      ${residualModeField()}
      <div class="wb-card"><div class="wb-fields">${field('wb-fit-compare', 'Compare with', select('wb-fit-compare', compareOptions(), state.fitCompare), true)}${button(F ? 'Fit again' : 'Fit and score', 'fit-run', 'primary')}</div>
      <p class="wb-small">Early Herbal A → Herbal B on four saved sheet splits (from the LC1 study). Rule fractions are fitted on one half and scored on the other. These sheets helped build the rules, so scores may look better than on new sheets.</p>
      <p class="wb-caption" id="wb-fit-status" role="status">${esc(state.fitStatus)}</p></div>
      ${stale ? '<div class="wb-notice">The active rules, the comparison or the Repeats setting changed since this fit. Fit again to update.</div>' : ''}
      ${F ? fitSummary(F) + fitResidualTable(F) : ''}</div>`;
    bind();
  }
  function residuals() {
    if (state.resMode === 'rules') return ruleResiduals();
    if (state.resMode === 'fit') return fitResiduals();
    const e = W.residuals[state.evaluation], rows = residualRows(), target = state.side === 'target';
    const key = target ? 'target_shortfall_after_rate' : 'source_surplus_after_rate';
    const reach = target ? 'target_has_incoming_edge_from_attested_A' : 'source_has_admissible_rule';
    const bins = [...new Set(e.words.map(w => w.spelling_bin))].sort();
    const filteredMass = rows.reduce((sum, r) => sum + r[key], 0);
    host.innerHTML = `<div class="wb-wrap">${heading('01 / Inspect the unexplained', 'Where the current rules fall short', 'Explore the saved LC1 pooled-policy evaluations. Start with a residual form, inspect its contexts, then carry a specific idea into the rule lab.')}
      <div class="wb-notice">Voynichese → Voynichese. These are dialect correspondences and distribution comparisons; the app does not assign meanings in a known language.</div>
      ${residualModeField()}
      <div class="wb-fields">${field('wb-eval', 'Saved evaluation', select('wb-eval', Object.keys(W.residuals).map(k => [k, C.evalLabel(k)]), state.evaluation), true)}</div>
      ${evalNote(state.evaluation)}
      <div class="wb-metrics">${metric('Original overlap', pct(e.overlap_before_rate), 'before the saved policy')}${metric('After existing rules', pct(e.overlap_after_rate), 'LC1 pooled E1 policy')}${metric('Remaining mismatch', pct(e.residual_each_side_rate), 'each residual side, counted once')}${metric('B shortfall without an incoming route', pct(e.untouched.B_shortfall_after_no_incoming_edge_rate / e.residual_each_side_rate * 10000), 'share of remaining B shortfall')}</div>
      <div class="wb-actions">${button('View frequency plots','plot-saved')}</div>
      <div class="wb-grid"><main><div class="wb-card"><div class="wb-fields">
      ${field('wb-side', 'Residual side', select('wb-side', [['target','Herbal B shortfall'],['source','Herbal A surplus']], state.side))}
      ${field('wb-res-query', 'Word pattern', patternInput('wb-res-query', state.query, 'e.g. chol | chor', 'word'))}
      ${field('wb-route', 'E1 route available', select('wb-route', [['all','All forms'],['no','No route'],['yes','Has a route']], state.route))}
      ${field('wb-bin', 'Spelling bin', select('wb-bin', [['','All endings'], ...bins], state.bin))}
      ${button('Apply filters','res-filter','primary')}</div>
      <div class="wb-row-title"><p class="wb-caption">${rows.length} forms · ${fmt(filteredMass)} /10k ${target ? 'shortfall' : 'surplus'}. Click a word to explore its occurrences.</p>${button('Export rows CSV','res-export')}</div>
      <div class="wb-scroll"><table class="wb-table"><thead><tr><th>Form</th><th>A tokens</th><th>B tokens</th><th>A before /10k</th><th>A after /10k</th><th>B /10k</th><th>${target ? 'Shortfall' : 'Surplus'}</th><th>E1 route</th></tr></thead><tbody>${rows.slice(state.residualPage * 40, (state.residualPage + 1) * 40).map(w => `<tr><td>${wordButton(w.word)}</td><td>${w.A_tokens}</td><td>${w.B_tokens}</td><td>${fmt(w.A_before_rate)}</td><td>${fmt(w.A_after_rate)}</td><td>${fmt(w.B_rate)}</td><td><b>${fmt(w[key])}</b></td><td><span class="wb-badge ${w[reach] ? 'neutral' : ''}" title="${esc(JSON.stringify(target ? w.incoming_edges : w.outgoing_edges))}">${w[reach] ? 'Available' : 'No route'}</span></td></tr>`).join('')}</tbody></table>${!rows.length ? '<div class="wb-empty">No residuals match. Try *aiin, another ending, or All forms.</div>' : ''}</div>${pager(state.residualPage, rows.length, 40, 'res')}</div></main>
      <aside><div class="wb-card"><div class="wb-eyebrow">Current research leads</div><h3>Words worth following</h3><p>${wordButton('daiin')} has the largest A surplus in every saved evaluation. The exact ${wordButton('aiin')} correspondence is represented by newer D0 candidates in the rule manager. This saved LC1 ledger predates Echo2’s generalized d/bare-a work.</p><p>${wordButton('chodaiin')} → ${wordButton('chdaiin')} / ${wordButton('chedaiin')} remains a sparse, unlicensed lead. Seven of ten target occurrences lie on f94/f95.</p><div class="wb-actions">${button('Explore *aiin contexts','aiin')}${button('Try daiin → aiin','demo')}</div></div>
      <div class="wb-card"><h3>Read these numbers carefully</h3><p class="wb-small">Early A and Herbal B rates use the tested half’s own denominators: ${fmt(e.N_A)} and ${fmt(e.N_B)} words. A after is fractional modeled mass. A surplus and B shortfall each sum to the same mismatch; adding them doubles it.</p><p class="wb-small">A missing incoming route may still allow repair by retaining original A mass. The conservative no-route floor here is ${fmt(e.untouched.B_shortfall_floor_no_incoming_edge_rate)} /10k.</p><p class="wb-small">Rare supported S4 + coda correspondences are available in the rule manager as S4_COMPOSE, outside this saved E1 baseline. A missing E1 route does not rule out those or other mechanisms.</p><p class="wb-small">The four evaluations are two splits of the same, already inspected sheets: reused development data, not independent replications. Global graph toggles do not change this saved ledger.</p>${[[W.ledger_source.replace('RESIDUALS.json','REPORT.md'),'Read the residual review ↗'],['solve/botanical_enrichment/team_echo/redesign/review_aiin_window_20260926/REPORT.md','Context experiment review ↗'],['solve/botanical_enrichment/team_echo/redesign/RULE_INVENTORY.md','Full research inventory ↗']].map(([path,label])=>EchoDocs.link(path,label,'wb-link wb-small')).filter(Boolean).join('<br>')}</div></aside></div></div>`;
    bind();
  }
  // Load and build the expensive SVG vocabulary only in this view. A generation
  // ticket prevents a late script load from rendering after navigation; leave()
  // also releases its nodes/listeners when switching to a legacy view.
  let chartLibrary, chartGeneration=0;
  function loadChart() {
    if(!chartLibrary) chartLibrary=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='distribution_chart.js?v=817b417677';
      script.onload=()=>resolve(window.EchoDistributionChart);
      script.onerror=()=>{script.remove();chartLibrary=null;reject(new Error('Frequency plots could not load. Reopen Distribution to retry.'));};
      document.head.appendChild(script);
    });
    return chartLibrary;
  }
  async function distribution() {
    const generation=++chartGeneration, src=state.chartSource, saved=src==='saved', fitted=src==='fit';
    const e=W.residuals[state.evaluation], r=state.result, F=state.fit, fitReady=fitted&&F&&F.signature===fitSignature();
    const fi=F?Math.min(state.fitEval,F.active.length-1):0, ready=saved||fitReady||(src==='lab'&&r);
    const empty=fitted?`<div class="wb-card"><p>${F?'The active rules, the comparison or the Repeats setting changed since the last fit.':'Fit the active rules first: each split fits on one sheet half and is plotted on the other.'}</p>${button(F?'Fit again':'Fit and score','fit-run','primary')}<p class="wb-caption" id="wb-fit-status" role="status">${esc(state.fitStatus)}</p></div>`
      :`<div class="wb-card"><p>Run an experiment first. Editing its rules clears the previous results.</p>${button('Open rule lab','open-lab')}</div>`;
    host.innerHTML=`<div class="wb-wrap">${heading('Compare word frequencies','Distribution before and after rules','Compare normalized frequencies across the complete vocabulary. Plots are built only while this tab is open.')}
      <div class="wb-fields">${field('wd-source','Results to plot',select('wd-source',[['saved','Saved LC1 evaluation'],['fit','Fitted active rules (held-out)'],['lab','Latest rule lab experiment']],src))}${saved?field('wd-eval','Saved evaluation',select('wd-eval',Object.keys(W.residuals).map(k=>[k,C.evalLabel(k)]),state.evaluation),true):''}${fitReady?field('wd-fit-eval','Held-out split',select('wd-fit-eval',F.active.map((a,i)=>[String(i),C.evalLabel(a.key)]),String(fi)),true):''}</div>
      ${saved?evalNote(state.evaluation,'Plots'):''}
      <details class="wb-card"><summary>Why can a word get worse? What about partial rules?</summary><p>Rules may keep some source mass and send the rest to alternative forms. In the lab, two matching rules at 30% and 20% send those shares to their outputs and retain 50% unchanged. Disable a rule or set it to 0% to ignore it. Competing branches must total at most 100%; this does not split one token into two consecutive words.</p><p>The saved LC1 policy already fits partial application, sharing fractions by rule and front class, then applying them to other sheets. It optimizes a combined line-class objective, not each word separately. A fraction can therefore remove too much of a particular form, or send too much into an output. Reducing it may help that form while losing useful output elsewhere. Exceptions chosen after inspecting these results need testing on other sheets.</p><p>“Further from target” means a larger absolute frequency difference. It does not always mean lost overlap: extra mass above a target rate earns no additional overlap. Source and output changes must be judged together.</p></details>
      <div id="wb-distribution-chart">${ready?'<p class="wb-caption" role="status">Loading frequency plots…</p>':empty}</div></div>`;
    bind();
    document.getElementById('wd-source').onchange=event=>{state.chartSource=event.target.value;distribution();};
    const evaluation=document.getElementById('wd-eval');if(evaluation)evaluation.onchange=()=>{state.evaluation=evaluation.value;state.residualPage=0;distribution();};
    const fitEval=document.getElementById('wd-fit-eval');if(fitEval)fitEval.onchange=()=>{state.fitEval=+fitEval.value;distribution();};
    if(!ready)return;
    try {
      const chart=await loadChart();
      if(generation!==chartGeneration)return;
      const rows=saved?e.words.map(w=>({word:w.word,before:w.A_before_rate,after:w.A_after_rate,target:w.B_rate})):fitted?F.active[fi].outOfFit.perWord.map(w=>({word:w.word,before:w.before,after:w.after,target:w.target})):r.rows;
      chart.mount(document.getElementById('wb-distribution-chart'),rows,{
        source:saved||fitted?'early Herbal A':label(state.lab.from),target:saved||fitted?'Herbal B':label(state.lab.to),
        policy:saved?'Saved LC1 pooled E1 · '+C.evalLabel(state.evaluation):fitted?`Fitted active rules (${F.rules}) · ${C.evalLabel(F.active[fi].key)}`:'Latest executed rule lab experiment',
        note:saved?'Complete saved evaluation; ledger filters and graph toggles do not change this fitted policy.':fitted?'Fractions fitted on the other half of this split; plotted on the held-out half.':'Editing a rule invalidates these experiment results.',
        onWord:word=>act('word',{dataset:{word}}),
        view:state.distView,onView:v=>{state.distView=v;},actions:'<button class="wb-button" data-share="distribution" title="Copy a link that opens this chart with these settings">Share link</button>'
      });
    } catch(error) {if(generation===chartGeneration)reportError(error);}
  }
  function contextFields(prefix, data, afterQ = '') {
    return `${field(prefix+'-prev2', 'Two words before', patternInput(prefix+'-prev2', data.prev2, 'e.g. *ol', 'word'))}${field(prefix+'-prev', 'Previous word', patternInput(prefix+'-prev', data.prev, 'e.g. *ol | *or; NOT *y', 'word'))}${field(prefix+'-next', 'Next word', patternInput(prefix+'-next', data.next, '*aiin', 'word'))}
      ${field(prefix+'-q', 'Focus q state', select(prefix+'-q', [['any','Either'],['yes','q present'],['no','q absent']], data.q))}
      ${field(prefix+'-nextQ', 'Next word q state', select(prefix+'-nextQ', [['any','Either / boundary'],['yes','q present'],['no','q absent']], data.nextQ))}${afterQ}
      ${field(prefix+'-position', 'Word position', select(prefix+'-position', [['any','Any'],['start','Line start'],['end','Line end'],['interior','Line interior']], data.position))}
      ${field(prefix+'-lineClass', 'Line class', select(prefix+'-lineClass', [['any','Any'],['first','Paragraph initial'],['body','Other lines']], data.lineClass))}`;
  }
  const contextKeys = ['prev2','prev','next','q','nextQ','position','lineClass'];
  function collectContext(prefix) { return Object.fromEntries(contextKeys.map(k => [k, document.getElementById(prefix+'-'+k).value])); }
  function rateCell(n,total,base,sectionTotal,scale=1) {
    const r=C.rateComparison(n,total,base,sectionTotal);
    const tip=`Selected: ${n} / ${total} (${fmt(r.selected*100)}%). Section baseline: ${base} / ${sectionTotal} (${fmt(r.baseline*100)}%). Lift: ${r.lift==null?'unavailable':fmt(r.lift)+'×'}.`;
    if(!total&&state.percentMode!=='section')return `<span class="muted" title="No matching focus occurrences; section baseline ${fmt(r.baseline*100)}%.">—</span>`;
    if(state.percentMode==='section')return `<span title="${esc(tip)}">${fmt(r.per10k)} <small class="rate-unit">/10k</small></span>`;
    if(state.percentMode==='conditional')return `<span title="${esc(tip)}">${fmt(r.selected*100)}%</span>`;
    const direction=r.lift==null?'neutral':r.lift>1.05?'above':r.lift<.95?'below':'neutral';
    const lift=r.lift==null?'—':(r.lift>=10?Math.round(r.lift):r.lift.toFixed(1))+'×';
    // One shared linear rate axis per table. The marker is the unconditional
    // section rate; colour + lift expose enrichment without reading counts.
    return `<div class="rate-visual ${direction}" tabindex="0" role="img" aria-label="${esc(tip)}" title="${esc(tip)}"><div class="rate-top"><span>${fmt(r.selected*100)}%</span><b>${lift}</b></div><div class="rate-track"><i style="width:${100*r.selected/scale}%"></i><em style="left:${Math.min(99,100*r.baseline/scale)}%"></em></div></div>`;
  }
  function signalBadges(tests) {
    return `<div class="context-signals">${['section','selection','shared'].map(kind=>{
      const r=tests[kind],name={section:'Section',selection:'Selection',shared:'Shared'}[kind],active=r.flagged;
      const symbol=active?(r.effect>0?'↑':'↓'):'—';
      const explanation=kind==='shared'?'Enriched over the section baseline in both populations':kind==='section'?'Section rate: comparison minus search':'Gap above section baseline: comparison minus search';
      const lift=v=>v==null?'—':v===Infinity?'∞':v.toFixed(1);
      const effect=r.effect==null?'No rate to compare':(r.effect*100).toFixed(2)+' percentage points'+(kind==='shared'?' (smaller gap)':'');
      const within=r.within?r.within.map((w,i)=>`${label(i?state.search.compare:state.search.section)}: ${w.effect==null?'no matches':(100*w.effect).toFixed(2)+' pp; '+lift(w.lift)+'× baseline'}`).join('. ')+'. ':'';
      const counts=r.support.map((s,i)=>`${r.support.length===2?label(i?state.search.compare:state.search.section):label(i<2?state.search.section:state.search.compare)+(i%2?' baseline':' selected')}: ${s.hits}/${s.n}`).join('; ');
      const tip=`${name}: ${explanation}. ${effect}. ${r.reason||(active?'Flagged for review':'Below review thresholds')}. ${within}${counts}.`;
      return `<span class="context-signal ${active?'detected':''}" tabindex="0" title="${esc(tip)}" aria-label="${esc(tip)}">${name} ${symbol}</span>`;
    }).join('')}</div>`;
  }
  // "Filter to" is the inverse of a breakdown Include checkbox: keep only focus
  // occurrences whose neighbor on that side is one of the chosen spellings.
  const sideWord=side=>side==='prev'?'previous':'following';
  const onlyWords=side=>state.search.neighborOnly?.[side]||[];
  // Group filters keep or drop whole neighbor groups (an ending, a beginning, a gallows type or a word) from the
  // search, in the grouping where they were set. Stored as {side, mode, key, op: 'only' | 'exclude'}.
  const groupFilters=()=>state.search.groupFilters||[];
  const groupNoun=(side,mode)=>mode==='word'?sideWord(side)+' word':mode==='gallows'?sideWord(side)+'-word gallows':side==='prev'?'previous-word ending':'following-word beginning';
  const groupText=g=>`${groupNoun(g.side,g.mode)} ${g.op==='only'?'is':'is not'} ${g.key}`;
  function groupButtons(side,key,mode=state.neighborMode) {
    const set=groupFilters().find(g=>g.side===side&&g.mode===mode&&g.key===key);
    return ['only','exclude'].map(op=>{
      const on=set?.op===op,noun=groupNoun(side,mode);
      const title=on?`Stop ${op==='only'?'keeping only':'excluding'} ${noun} ${key}`:op==='only'?`Keep only occurrences whose ${noun} is ${key}, in the whole search`:`Remove occurrences whose ${noun} is ${key} from the whole search`;
      return `<button class="wb-button only-toggle${on?' on':''}" data-action="neighbor-group" data-side="${side}" data-mode="${mode}" data-group="${esc(key)}" data-op="${op}" aria-pressed="${on}" title="${esc(title)}">${on?(op==='only'?'Only ×':'Excluded ×'):(op==='only'?'Only':'Exclude')}</button>`;
    }).join('');
  }
  function onlyStrip() {
    const sides=['prev','next'].filter(side=>onlyWords(side).length);
    if(!sides.length&&!groupFilters().length)return '';
    // Exclude filters keep the 'boundary / unreadable' group, so say when line starts (or ends) stay in.
    const groupTexts=['prev','next'].flatMap(side=>{
      const gs=groupFilters().filter(g=>g.side===side);if(!gs.length)return [];
      const edgeKept=!onlyWords(side).length&&!gs.some(g=>g.op==='only'||g.key==='boundary / unreadable');
      return [gs.map(g=>esc(groupText(g))).join('; ')+(edgeKept?` (line ${side==='prev'?'starts':'ends'} kept)`:'')];
    });
    const text=[...sides.map(side=>`${sideWord(side)} word is ${onlyWords(side).map(esc).join(' or ')}`),...groupTexts].join('; ');
    return `<div class="context-exclusions context-only" role="status"><span><b>Filtered:</b> ${text[0].toUpperCase()+text.slice(1)}.</span>${sides.flatMap(side=>onlyWords(side).map(w=>`<button class="wb-button" data-action="neighbor-only" data-side="${side}" data-word="${esc(w)}" title="Stop filtering to ${sideWord(side)} word ${esc(w)}">${esc(w)} ×</button>`)).join('')}${groupFilters().map(g=>`<button class="wb-button" data-action="neighbor-group" data-side="${g.side}" data-mode="${g.mode}" data-group="${esc(g.key)}" data-op="${g.op}" title="Remove this filter">${g.op==='only'?'':'not '}${esc(g.key)} ×</button>`).join('')}<button class="wb-button" data-action="neighbor-only-clear" title="Remove every neighbor filter">Clear neighbor filters</button></div>`;
  }
  function onlyNote(side) {
    const own=onlyWords(side),other=onlyWords(side==='prev'?'next':'prev'),groups=groupFilters().filter(g=>g.side===side);
    if(groups.length&&!own.length)return `<p class="wb-small context-only-note">The search keeps only occurrences whose ${groups.map(g=>esc(groupText(g))).join(' and ')}, so rates on this side are set by that filter.</p>`;
    const otherGroups=groupFilters().filter(g=>g.side!==side);
    if(otherGroups.length&&!own.length&&!other.length)return `<p class="wb-small context-only-note">Only occurrences whose ${otherGroups.map(g=>esc(groupText(g))).join(' and ')}.</p>`;
    if(own.length)return `<p class="wb-small context-only-note">Only pairs whose ${sideWord(side)} word is ${own.map(esc).join(' or ')} remain, so enrichment here is set by the filter.</p>`;
    if(other.length)return `<p class="wb-small context-only-note">Only occurrences whose ${sideWord(side==='prev'?'next':'prev')} word is ${other.map(esc).join(' or ')}.</p>`;
    return '';
  }
  function neighborPanel(side, a, b, nA, nB, baselines, sizes, tests) {
    const significant=r=>r.flagged;
    const keys=[...tests.keys()].filter(k=>{const t=tests.get(k),s=significant(t.section),f=significant(t.selection),h=significant(t.shared);return state.signalFilter==='all'||(state.signalFilter==='any'&&(s||f||h))||(state.signalFilter==='both'&&s&&f)||(state.signalFilter==='section'&&s)||(state.signalFilter==='selection'&&f)||(state.signalFilter==='shared'&&h);}).sort((x,y)=>(b.get(y)?.count||0)+(a.get(y)?.count||0)-(b.get(x)?.count||0)-(a.get(x)?.count||0)||x.localeCompare(y));
    // Paginate full-word rendering only; rates, flags and scale use all words.
    const page=state.neighborPages[side]=Math.min(state.neighborPages[side],Math.max(0,Math.ceil(keys.length/50)-1));
    const visibleKeys=state.neighborMode==='word'?keys.slice(page*50,(page+1)*50):keys;
    const title=state.neighborMode==='word'?(side==='prev'?'Previous words':'Following words'):state.neighborMode==='gallows'?(side==='prev'?'Previous-word gallows':'Following-word gallows'):(side==='prev'?'Previous-word endings':'Following-word beginnings');
    const scale=Math.max(.01,...keys.flatMap(k=>[a.get(k)?.count/Math.max(1,nA)||0,b.get(k)?.count/Math.max(1,nB)||0,...baselines.map((g,i)=>(g.get(k)?.count||0)/Math.max(1,sizes[i]))]));
    const cell=(n,total,compare,key)=>rateCell(n,total,baselines[+compare].get(key)?.count||0,sizes[+compare],scale);
    return `<section class="wb-card"><h3>${title}</h3>
      <p class="wb-small">Click a group to see its words. Only and Exclude filter the whole search. Hover a rate for counts.</p>${onlyNote(side)}
      ${(state.search.neighborExcluded?.[side]||[]).length?`<div class="context-exclusions"><span>Excluded neighbors:</span>${state.search.neighborExcluded[side].map(w=>`<button class="wb-button" data-action="neighbor-restore" data-side="${side}" data-word="${esc(w)}">${esc(w)} ×</button>`).join('')}<button class="wb-button" data-action="neighbor-restore-all" data-side="${side}">Restore neighbors</button></div>`:''}
      <div class="wb-scroll"><table class="wb-table context-rates"><thead><tr><th>${state.neighborMode==='word'?'Word':state.neighborMode==='gallows'?'Gallows':side==='prev'?'Ending':'Beginning'}</th><th>${esc(label(state.search.section))}</th><th>${esc(label(state.search.compare))}</th></tr></thead><tbody>${visibleKeys.map(key=>`<tr class="${groupFilters().some(g=>g.side===side&&g.mode===state.neighborMode&&g.key===key&&g.op==='exclude')?'neighbor-excluded':''}"><td><button class="wb-word neighbor-category" data-action="neighbor-drill" data-side="${side}" data-group="${esc(key)}" aria-controls="wb-neighbor-drill" aria-expanded="${state.neighborDrill?.side===side&&state.neighborDrill?.key===key}">${esc(key)}</button>${groupButtons(side,key)}${signalBadges(tests.get(key))}</td><td>${cell(a.get(key)?.count||0,nA,false,key)}</td><td>${cell(b.get(key)?.count||0,nB,true,key)}</td></tr>`).join('')}</tbody></table>${!keys.length?'<p class="wb-empty">No categories match this review filter.</p>':''}</div>${state.neighborMode==='word'?pager(page,keys.length,50,'neighbor-'+side):''}</section>`;
  }
  function neighborDrilldown(groups,baselines,selectedSizes,sizes,populations,selected,tests) {
    if(!state.neighborDrill)return '';
    const {side,key}=state.neighborDrill, [a,b]=groups[side].map(g=>g.get(key)||{count:0,words:new Map()});
    const candidates=selected.map(items=>C.neighborSummary(items,side,state.search.mergeQ,state.neighborMode).get(key)||{words:new Map()});
    const sectionCandidates=populations.map(items=>C.neighborSummary(items,side,state.search.mergeQ,state.neighborMode).get(key)||{words:new Map()});
    const omitted=new Set(state.search.neighborExcluded?.[side]||[]),pinned=new Set(onlyWords(side));
    const onlyButton=w=>pinned.has(w)?`<button class="wb-button only-toggle on" data-action="neighbor-only" data-side="${side}" data-word="${esc(w)}" aria-pressed="true" title="Stop filtering to ${sideWord(side)} word ${esc(w)}">Filtered ×</button>`
      :`<button class="wb-button only-toggle" data-action="neighbor-only" data-side="${side}" data-word="${esc(w)}" aria-pressed="false" title="${pinned.size?`Also allow ${esc(w)} as the ${sideWord(side)} word`:`Show only occurrences whose ${sideWord(side)} word is ${esc(w)}: concordance, forms and the ${sideWord(side==='prev'?'next':'prev')}-word section`}">${pinned.size?'Add to filter':'Filter to this'}</button>`;
    const words=[...tests.keys()].sort((x,y)=>candidates.reduce((n,g)=>n+(g.words.get(y)||0)-(g.words.get(x)||0),0)||x.localeCompare(y));
    const scale=Math.max(.01,...words.flatMap(w=>[a,b].flatMap((g,i)=>[(g.words.get(w)||0)/Math.max(1,selectedSizes[i]),(baselines[side][i].get(key)?.words.get(w)||0)/Math.max(1,sizes[i])])));
    const countLink=(w,i,n,scope)=>`<button class="wb-word pair-count" data-action="neighbor-evidence" data-side="${side}" data-word="${esc(w)}" data-pop="${i}" data-scope="${scope}" title="Show ${scope==='selected'?'matching pairs':'all section pairs'} in ${esc(label(i?state.search.compare:state.search.section))}">${fmt(n)} ${scope==='selected'?(n===1?'pair':'pairs'):'in section'}</button>`;
    return `<section class="wb-card neighbor-breakdown"><div class="wb-row-title"><h3>${state.neighborMode==='word'?(side==='prev'?'Previous word':'Following word'):state.neighborMode==='gallows'?(side==='prev'?'Previous gallows':'Following gallows'):(side==='prev'?'Previous ending':'Following beginning')}: ${esc(key)}</h3><div class="wb-actions">${groupButtons(side,key)}${button('Close breakdown','neighbor-close')}</div></div><p class="wb-small">Counts show ${side==='prev'?'previous-word → matched-word':'matched-word → following-word'} pairs; click a count for source lines. Unchecking a neighbor removes its pairs from this side’s rates and flags. <b>Filter to this</b> instead narrows the whole search (concordance, forms and the ${sideWord(side==='prev'?'next':'prev')}-word table) to that ${sideWord(side)} word.</p>${onlyNote(side)}<div class="wb-scroll"><table class="wb-table context-rates"><thead><tr><th>Include in ${sideWord(side)}-word rates</th><th>${esc(label(state.search.section))}</th><th>${esc(label(state.search.compare))}</th></tr></thead><tbody>${words.map(w=>`<tr class="${omitted.has(w)?'neighbor-excluded':''}"><td><label class="mono"><input class="neighbor-include" type="checkbox" data-side="${side}" data-word="${esc(w)}" aria-label="Include ${side==='prev'?'previous':'following'} ${esc(w)}" ${omitted.has(w)?'':'checked'}> ${esc(w)}</label>${onlyButton(w)}${signalBadges(tests.get(w))}</td>${[a,b].map((g,i)=>`<td>${omitted.has(w)?'<span class="muted">Excluded</span>':rateCell(g.words.get(w)||0,selectedSizes[i],baselines[side][i].get(key)?.words.get(w)||0,sizes[i],scale)}<div class="pair-counts">${countLink(w,i,candidates[i].words.get(w)||0,'selected')}${countLink(w,i,sectionCandidates[i].words.get(w)||0,'section')}</div></td>`).join('')}</tr>`).join('')}</tbody><tfoot><tr><th>Included pairs in group</th><td>${a.count}</td><td>${b.count}</td></tr></tfoot></table>${!words.length?'<p class="wb-empty">No neighbors in this group.</p>':''}</div><p class="wb-small">Rates use all retained pairs in this direction, including other groups. Flags use the same review thresholds as the group summaries.</p></section>${neighborEvidence(populations,selected)}`;
  }
  function neighborEvidence(populations,selected) {
    const e=state.neighborEvidence;if(!e||e.side!==state.neighborDrill?.side)return '';
    const items=(e.scope==='section'?populations:selected)[e.pop].filter(o=>C.neighborWord(o,e.side,state.search.mergeQ)===e.word);
    const population=e.pop?state.search.compare:state.search.section;
    return `<section class="wb-card neighbor-evidence"><div class="wb-row-title"><h3>${esc(e.word)} · ${esc(label(population))} · ${items.length} ${e.scope==='section'?'section':'matching'} ${items.length===1?'pair':'pairs'}</h3>${button('Close source lines','neighbor-evidence-close')}</div><p class="wb-small">Neighbor highlighted · focus word underlined. Original spellings and token positions.</p><div class="wb-scroll">${items.map(o=>{const neighbor=o.index+(e.side==='prev'?-1:1);return `<div class="wb-context"><div><button class="wb-button" data-action="folio" data-folio="${esc(o.line.folio)}">${esc(o.line.folio+'.'+o.line.locus)}</button><small>focus token ${o.index+1} · sheet ${esc(o.line.sheet)}</small></div><div class="mono">${o.line.words.map((w,i)=>i===neighbor?`<mark>${esc(w||'[…]')}</mark>`:i===o.index?`<u>${esc(w||'[…]')}</u>`:esc(w||'[…]')).join(' ')}</div></div>`;}).join('')||'<p class="wb-empty">No pairs in this scope. The section count includes neighbors of words outside your search.</p>'}</div></section>`;
  }
  // One spelling view, shown in both parts of the search settings and beside each list, so changing
  // q treatment never requires scrolling back. Every copy toggles the same setting.
  const contextQToggle=(s,where)=>`<label class="context-q" title="Pool initial q with the unprefixed form in searches, lists and flags. Exclusions are remembered separately for each mode."><input class="context-merge-q" type="checkbox" aria-label="Merge initial q in ${where}" ${s.mergeQ?'checked':''}> Merge q</label>`;
  // The heading and search form of Words & contexts; shown alone when a pattern cannot be read
  function contextSearchCard(s, scope) {
    const qToggle=where=>contextQToggle(s,where);
    const pageOptions = [...new Set(scope.map(o => o.line.folio))], sheets = [...new Set(scope.map(o => o.line.sheet))].sort();
    // With merge on, every word and neighbor loses one initial q before matching, so a q-initial pattern is empty.
    const qMasked=qMaskedIn(s.mergeQ,[s.query,s.compareQuery,s.prev2,s.prev,s.next]);
    return `${heading('02 / Follow words in context', 'Find forms. Read their neighbors.', 'Search related spellings and neighboring words across sections. Merge initial q or compare the original forms.')}
      <div class="wb-card"><div class="wb-fields">
      ${field('wc-section','Search population',select('wc-section',populations,s.section))}${field('wc-compare','Compare with',select('wc-compare',populations,s.compare))}${button('Swap populations','context-swap')}
      ${field('wc-query','Word / pattern',patternInput('wc-query',s.query,'*aiin'),true)}${field('wc-compareQuery','Comparison pattern (optional)',patternInput('wc-compareQuery',s.compareQuery,'Same as word pattern'),true)}${field('wc-mode','Match',select('wc-mode',[['glob','Word pattern'],['related','Within 2 character edits']],s.mode))}${qToggle('search')}
      </div>${qMasked?'<div class="wb-notice">With Merge q on, initial q is removed before matching, so patterns starting with q find nothing.</div>':''}<details ${contextKeys.some(k => s[k] && s[k] !== 'any') || s.folio || s.sheet || (s.locus && s.locus !== 'running') ? 'open' : ''} style="margin-top:16px"><summary>Surrounding words, q state, loci and location</summary><div class="wb-fields">${contextFields('wc',s,qToggle('search filters'))}${field('wc-locus','Loci',select('wc-locus',LOCUS_OPTIONS,s.locus||'running'))}${field('wc-folio','Folio',select('wc-folio',[['','All folios'],...pageOptions],s.folio))}${field('wc-sheet','Physical sheet',select('wc-sheet',[['','All sheets'],...sheets],s.sheet))}</div></details>
      <div class="wb-actions">${button('Search contexts','context-search','primary')}${button('Clear context filters','context-clear')}${button('Use in rule lab','context-lab')}${button('Export occurrences CSV','context-export')}</div><p class="wb-small">${patternHelp(s.mergeQ)} Neighbors never cross a line or unreadable gap; a word at a line start has no previous word, so NOT *y in the Previous word box keeps it. Original spellings remain visible in source lines.</p></div>`;
  }
  function contexts() {
    const s = state.search, scope = searchCorpus(s.section,s.mergeQ,s.locus), compScope = searchCorpus(s.compare,s.mergeQ,s.locus);
    // A pattern that cannot be read finds nothing: show the form and the problem, never earlier results
    const problem=patternProblem([['Word / pattern',s.query],['Comparison pattern',s.compareQuery],...neighborBoxes(s)]);
    if(problem){host.innerHTML=`<div class="wb-wrap">${contextSearchCard(s,scope)}<div class="wb-notice wb-error" role="alert">${esc(problem)}</div></div>`;bind();return;}
    const found = C.search(scope, s), compared = C.search(compScope, {...s, query: s.compareQuery || s.query, folio: '', sheet: ''});
    // Keep excluded candidates visible for restoration. Their counts are shown
    // dimmed, but none contribute to the selected contexts or concordance.
    const candidates=C.search(scope,{...s,excluded:[]}),otherCandidates=C.search(compScope,{...s,query:s.compareQuery||s.query,folio:'',sheet:'',excluded:[]});
    const excluded=new Set(s.excluded||[]);
    const forms = new Map(); candidates.forEach(o => { if (!forms.has(o.word)) forms.set(o.word, {n: 0, sheets: new Set()}); const f = forms.get(o.word); f.n++; f.sheets.add(o.line.sheet); });
    const compareCounts = C.counts(otherCandidates);
    const ordered = [...new Set([...forms.keys(), ...compareCounts.keys()])].map(w => [w, forms.get(w) || {n:0,sheets:new Set()}]).sort((a,b) => (b[1].n+(compareCounts.get(b[0])||0))-(a[1].n+(compareCounts.get(a[0])||0)));
    const selectedBySide=Object.fromEntries(['prev','next'].map(side=>[side,[found,compared].map(items=>C.filterNeighbors(items,side,s.neighborExcluded?.[side],s.mergeQ))]));
    const fullBySide=Object.fromEntries(['prev','next'].map(side=>[side,[scope,compScope].map(items=>C.filterNeighbors(items,side,s.neighborExcluded?.[side],s.mergeQ))]));
    const neighbors=Object.fromEntries(['prev','next'].map(side=>[side,selectedBySide[side].map(items=>C.neighborSummary(items,side,s.mergeQ,state.neighborMode))]));
    // Baseline keeps the identical neighbor position and boundary rules but drops
    // every focus-word/context/location filter. Do not use filtered denominators.
    const baselines=Object.fromEntries(['prev','next'].map(side=>[side,fullBySide[side].map(items=>C.neighborSummary(items,side,s.mergeQ,state.neighborMode))]));
    const sizes=[scope.length,compScope.length];
    const testConfig={...s,neighborMode:state.neighborMode,testMethod:'review',reviewMinGap:state.reviewMinGap,reviewMinLift:state.reviewMinLift,reviewLargeGap:state.reviewLargeGap};
    const tests=window.EchoContextStatistics.analyze([scope,compScope],[found,compared],testConfig);
    const wordTests=state.neighborDrill?window.EchoContextStatistics.analyze([scope,compScope],[found,compared],testConfig,state.neighborDrill)[state.neighborDrill.side]:null;
    const formCount=(n,size)=>`<b>${fmt(n)}</b><small>${size?fmt(n/size*10000):'—'} /10k</small>`;
    const qToggle=where=>contextQToggle(s,where);
    host.innerHTML = `<div class="wb-wrap">${contextSearchCard(s,scope)}
      <div class="wb-metrics">${metric('Matching occurrences',fmt(found.length),label(s.section))}${metric('Distinct forms',fmt(new Set(found.map(o=>o.word)).size),'in the search population')}${metric('Physical sheets',fmt(new Set(found.map(o=>o.line.sheet)).size))}${metric('Comparison occurrences',fmt(compared.length),label(s.compare)+' · '+esc(s.compareQuery||s.query||'all words')+' · same context, all locations')}</div>
      ${onlyStrip()}
      ${excluded.size?`<div class="context-exclusions" role="status"><span>Excluded:</span>${[...excluded].map(w=>`<button class="wb-button" data-action="context-restore" data-word="${esc(w)}" title="Include ${esc(w)} again">${esc(w)} ×</button>`).join('')}${button('Restore all','context-restore-all')}<span>${candidates.length-found.length} / ${otherCandidates.length-compared.length} tokens omitted</span></div>`:''}
      ${s.section===s.compare?'<div class="wb-notice">Both selectors currently name the same population. With the same pattern and location scope, their counts will be identical.</div>':''}
      <div id="wb-page-chart"></div>
      <div class="wb-card context-display"><div class="wb-fields">${field('wc-neighbor-mode','Group neighbors',select('wc-neighbor-mode',[['edges','Ending / beginning'],['gallows','Gallows form'],['word','Full word']],state.neighborMode))}${field('wc-percent','Neighbor rates',select('wc-percent',[['baseline','Section baseline'],['conditional','Within search (%)'],['section','Per 10k eligible section pairs']],state.percentMode))}${field('wc-signals','Show categories',select('wc-signals',[['all','All categories'],['any','Any review flag'],['section','Section gap'],['selection','Selection gap'],['shared','Shared enrichment'],['both','Section + selection']],state.signalFilter))}</div><div class="rate-legend">${state.percentMode==='baseline'?'<span><i></i> Selected %</span><span><em></em> Section %</span>':''}<span>Shared ↑ enriched in both</span></div><details><summary>Review thresholds</summary><div class="wb-fields">${field('wc-review-gap','Min gap (pp)',`<input id="wc-review-gap" type="number" min="0" max="100" step="0.5" value="${state.reviewMinGap}">`)}${field('wc-review-lift','Min ratio (×)',`<input id="wc-review-lift" type="number" min="1" max="1000" step="0.5" value="${state.reviewMinLift}">`)}${field('wc-review-large','Always flag gap (pp)',`<input id="wc-review-large" type="number" min="0" max="100" step="1" value="${state.reviewLargeGap}">`)}</div><p class="wb-small">Flag a gap ≥ ${state.reviewMinGap} percentage points with a ≥ ${state.reviewMinLift}× rate ratio, or any gap ≥ ${state.reviewLargeGap} points. Small counts stay eligible. These are review cues.</p><p class="wb-small">Section: overall rate gap. Selection: difference between each selection’s gap above its section baseline, using the ratio of their lifts. Shared: enrichment clears the thresholds in both sections. Hover badges for gaps and counts. ${EchoDocs.link('apps/echo_rule_network/ANALYSIS_UI_NOTES.md','Method notes')}</p></details></div>
      <div class="context-summaries">${['prev','next'].map(side=>neighborPanel(side,...neighbors[side],...selectedBySide[side].map(items=>items.length),baselines[side],fullBySide[side].map(items=>items.length),tests[side])).join('')}</div>
      <div id="wb-neighbor-drill" aria-live="polite">${state.neighborDrill?neighborDrilldown(neighbors,baselines,selectedBySide[state.neighborDrill.side].map(items=>items.length),fullBySide[state.neighborDrill.side].map(items=>items.length),[scope,compScope],[found,compared],wordTests):''}</div>
      <section class="wb-card"><div class="wb-row-title"><h3>Forms in this search</h3><label class="wb-small">Find form <input id="wc-form-find" type="search" placeholder="Filter this table" aria-label="Find form in table"></label></div><p class="wb-small">Uncheck a form to exclude it from both populations. Counts · rates per 10k section tokens. Dimmed rows are excluded.</p><div class="wb-scroll"><table class="wb-table context-forms"><thead><tr><th>Include / form</th><th>${esc(label(s.section))}</th><th>${esc(label(s.compare))}</th></tr></thead><tbody>${ordered.map(([w,f])=>`<tr data-form="${esc(w)}" class="${excluded.has(w)?'form-excluded':''}"><td><input type="checkbox" class="context-include" data-word="${esc(w)}" aria-label="Include ${esc(w)}" ${excluded.has(w)?'':'checked'}> ${wordButton(w)}<small>${f.sheets.size} search-population sheets</small></td><td>${formCount(f.n,sizes[0])}</td><td>${formCount(compareCounts.get(w)||0,sizes[1])}</td></tr>`).join('')}</tbody></table>${!ordered.length?'<p class="wb-empty">No forms match.</p>':''}</div></section>
      <details class="wb-card context-concordance" ${state.contextPage||state.concordanceOpen?'open':''}><summary>Concordance · ${fmt(found.length)} matching occurrences${['prev','next'].filter(side=>onlyWords(side).length).map(side=>` · ${sideWord(side)} word ${onlyWords(side).join(' or ')}`).join('')}</summary><p class="wb-small">Original spellings · full line, match highlighted${onlyWords('prev').length||onlyWords('next').length?' · the filtered neighbor is marked':''}</p>
      ${found.slice(state.contextPage*30,(state.contextPage+1)*30).map(o=>{
        // The whole transcript line, unreadable gaps kept as […]; match highlighted, filtered neighbor marked.
        const marked=new Set([onlyWords('prev').length?o.index-1:-1,onlyWords('next').length?o.index+1:-1]);
        const text=o.line.words.map((w,i)=>i===o.index?`<mark>${esc(o.raw)}</mark>`:marked.has(i)?`<b class="only-mark">${esc(w||'[…]')}</b>`:esc(w||'[…]')).join(' ');
        return `<div class="wb-context"><div><button class="wb-word" data-action="folio" data-folio="${esc(o.line.folio)}">${esc(o.line.folio)}.${esc(o.line.locus)}</button><div class="wb-small">sheet ${esc(o.line.sheet)}<br>${({label:'label',circle:'circular text',radial:'radial text'})[o.line.category]||(o.line.first?'paragraph initial':'body line')}<br>word ${o.index+1} of ${o.line.words.length}</div></div><div class="mono">${text}</div></div>`;
      }).join('') || '<div class="wb-empty">No occurrences match these filters. Try clearing the context or using *aiin.</div>'}${pager(state.contextPage,found.length,30,'context')}</details></div>`;
    host.querySelector('.context-display .wb-fields').insertAdjacentHTML('beforeend',qToggle('contexts'));
    host.querySelector('.context-forms').closest('section').querySelector('h3').insertAdjacentHTML('afterend',qToggle('forms'));
    host.querySelector('.neighbor-breakdown h3')?.insertAdjacentHTML('afterend',qToggle('breakdown'));
    const conc=host.querySelector('.context-concordance');if(conc)conc.ontoggle=()=>{state.concordanceOpen=conc.open;};
    renderPageChart();
    bind();
  }
  // Matches of the current search on every page of the manuscript. Same engine and filters as the concordance,
  // over all running text; Folio and Physical sheet are drawn as highlights so the rest of the manuscript stays visible.
  // Neighbor Include checkboxes change rates, not matching occurrences, so they do not apply here either.
  // With pattern 'both', `compare` holds the comparison pattern's matches as well (drawn below the axis).
  function pageChartMatches() {
    const s=state.search,pc=state.pageChart,own=s.compareQuery?.trim()&&s.compareQuery.trim()!==s.query.trim();
    if(!own)pc.pattern='search';
    const find=query=>C.search(manuscript(s.mergeQ,s.locus),{...s,query,folio:'',sheet:''});
    const query=pc.pattern==='compare'?s.compareQuery:s.query;
    return {query,own,matches:find(query),compare:pc.pattern==='both'?{query:s.compareQuery,matches:find(s.compareQuery)}:null};
  }
  function pageChartInfo(mode) {
    const link=(href,text)=>`<a class="wb-link" href="${href}" target="_blank" rel="noopener">${text}</a>`;
    const info={
      rz:`René Zandbergen’s ${link('https://www.voynich.nu/extra/rz_lang.html','extension of the Currier languages')}, at page level, from his folio descriptions (fetched ${esc(M.rz_source?.fetched||'')}). The + and − modifiers (high or low q- frequency) are merged into each class; hover a page for its full code.`,
      currier:`Classic Currier A/B, as recorded in the transliteration. It leaves f57v, f65v and the astronomical, cosmological and zodiac pages f67–f73 unclassified; Zandbergen’s site gives f57v as B.`,
      hand:`Lisa Fagin Davis’s scribes, as recorded in the transliteration. f115r switches from hand 2 to hand 3 after line 12, so its lines are split between them.`,
      section:`Illustration type, as recorded in the transliteration.`,
      comparison:`Grey pages are outside both populations. The f1/f8 and f58/f65 bifolia are in no Echo population: they are held out as exploratory sheets.`};
    // Golf groupings: a short summary, and the pages behind the groups in a collapsed list, one line per group in
    // Golf's order (Golf's regime numbers, as in the group labels)
    const n=k=>(window.EchoPageChart?.GOLF_NUMBERS||{})[k]||'';
    const golf=(summary,lines)=>`${summary}<details class="pc-info-pages"><summary>Folio details</summary><ul>${lines.map(([group,pages])=>`<li><b>${group}</b> — ${pages}</li>`).join('')}</ul></details>`;
    const regime=`Golf regimes follow npcompl33t’s “${link('https://www.voynich.ninja/thread-6084.html','Independent Analysis Identifying Languages Beyond Currier A/B, compared to René Zandbergen')}” (Voynich Ninja, 17 Sep 2026). Golf's numbers: ${Object.entries(window.EchoPageChart?.GOLF_NUMBERS||{}).map(([k,v])=>`${v} ${M.regimes.find(r=>r.key===k)?.label||k}`).join(', ')}.`;
    const plus=` Golf regime + splits ${n('lateAP')} and ${n('HB')} by illustration type.`;
    const plus2=` Golf regime ++ also splits ${n('earlyA')} and ${n('Stars')}, following Golf’s page clustering of 7 October 2026. Golf reads these as tendencies, not new regimes. The y-start and near-Bio groups are striped.`;
    const HB=[`${n('HB')}: Herbal B`,'herbal pages, plus f66r, f85r1, f85r2 and f86v3–f86v6 (text-only and cosmological)'];
    const tail=[[`${n('Cel')}: Celestial`,'the hand-4 text'],[`${n('f58')}: f58`,'f58r and f58v']];
    info.regime=golf(regime,[[...HB],...tail]);
    const split=[[`${n('lateAP')}: late Herbal A`,`herbal pages of regime ${n('lateAP')}`],[`${n('lateAP')}: Pharma`,`pharmaceutical pages of regime ${n('lateAP')}`],
      [HB[0],`herbal pages of regime ${n('HB')}`],[`${n('HB')}: non-herbal pages`,'f66r, f85r1, f85r2, f86v3–f86v6 (text-only and cosmological)']];
    info.regimeSplit=golf(regime+plus,[...split,...tail]);
    info.regimeSplit2=golf(regime+plus+plus2,[
      [`${n('earlyA')}: early A, ch-start`,'36 pages with more ch- and sh-initial words; Golf also counts f1r here, which has no regime in the app'],
      [`${n('earlyA')}: early A, y-start`,'49 pages with more y-initial words; this split does not repeat in both line halves'],
      ...split,
      [`${n('Stars')}: Stars, near Herbal B`,'f104–f107, f113–f115'],
      [`${n('Stars')}: Stars, near Bio`,'f103, f108, f111, f112, f116r; this split repeats in both line halves'],
      ...tail]);
    return info[mode]?`<div class="pc-info">${info[mode]}</div>`:'';
  }
  // Chart settings shared by Matches by page and Compare patterns, as [value, label] lists
  const GROUP_OPTIONS=[['section','Section'],['regime','Golf regime'],['regimeSplit','Golf regime +'],['regimeSplit2','Golf regime ++'],['rz','RZ language'],['currier','Currier A/B'],['hand','LFD hand'],['comparison','Comparison']];
  const UNIT_OPTIONS=[['page','Page'],['paragraph','Paragraph'],['bifolium','Bifolium'],['quire','Quire']];
  const LAYOUT_OPTIONS=[['combined','Bars'],['split','Bars split by group'],['histogram','Histograms by group']];
  const MEASURE_OPTIONS=[['count','Matches'],['percent','% of words'],['per10k','Per 10k words'],['perline','Matches per line']];
  // A labelled chart select; `attr` names whose settings it changes (pc: Matches by page, pt: Compare patterns)
  const chartSelect=(attr,key,label,cur,opts,title='')=>`<label class="pc-ctl"${title?` title="${esc(title)}"`:''}><span class="wb-small">${label}</span><select data-${attr}="${key}">${opts.map(([v,t])=>`<option value="${esc(v)}"${v===cur?' selected':''}>${esc(t)}</option>`).join('')}</select></label>`;
  // Bifolia and quires are always in order of their first page
  const fixedOrder=unit=>unit==='bifolium'||unit==='quire';
  // Order for bars (pages and paragraphs only); bins, range and no-match units for histograms
  const chartOrderControls=(attr,pc)=>pc.layout!=='histogram'?(!fixedOrder(pc.unit)?chartSelect(attr,'ordering','Order',pc.ordering,[['manuscript','Page order'],['bifolium','Bifolia together']]):'')
    :chartSelect(attr,'bins','Bins',pc.bins,[['auto','Auto'],['6','About 6'],['12','About 12'],['24','About 24'],['48','About 48']])+chartSelect(attr,'range','Range',pc.range,[['clip','Outliers in one bin'],['full','Full range']])+chartSelect(attr,'zeros','No-match units',pc.zeros,[['show','Shown'],['hide','Hidden']]);
  // The grouping a Color by setting names; the populations of `s` only matter for 'comparison'
  const chartGroup=(mode,s={})=>{const colours=window.EchoColours||{};return window.EchoPageChart.grouping(mode,M,{search:s.section,compare:s.compare,label,populationColours:colours.population,regimeColours:colours.regime});};
  // A view's grouping without the groups hidden in its Groups menu (settings.hidden[mode]), and its lines filtered to the
  // groups shown: the chart, the table, the counts and the export then cover the shown groups only (page_chart.js hideGroups)
  function shownView(settings,s,lines){
    const full=chartGroup(settings.group,s),v=window.EchoPageChart.hideGroups(full,(settings.hidden||{})[settings.group]||[],M.pages);
    return {full,group:v.group,hidden:v.hidden,keep:v.keep,lines:lines.filter(v.keep)};
  }
  // The Groups menu: one checkbox per group of the full grouping (checked = shown). `attr` names whose settings it changes.
  let reopenGroups='';
  const groupMenu=(attr,full,hidden,open)=>{
    const out=new Set(hidden.map(String)),shown=full.groups.length-out.size;
    return `<details class="wb-menu pc-groups"${open?' open':''}><summary class="wb-button"><span class="wb-menu-label">Groups: ${out.size?`${shown} of ${full.groups.length}`:'all'}</span><svg class="wb-chevron" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5l3 3 3-3"/></svg></summary>`
      +`<div class="wb-menu-list">${full.groups.map(g=>`<label class="wb-menu-item pc-group"><input type="checkbox" data-hide="${attr}" value="${esc(g.key)}"${out.has(String(g.key))?'':' checked'}><i class="pc-sw" style="${window.EchoPageChart.paint(g)}"></i>${esc(g.label)}</label>`).join('')}`
      +`${out.size?`<button type="button" class="wb-menu-item" data-hide-all="${attr}">Show all</button>`:''}</div></details>`;
  };
  // A Groups menu checkbox hides or shows its group of the current Color by; the menu stays open for the next choice.
  // The last shown group cannot be hidden.
  function bindGroupMenu(attr,settings,rerender){
    const boxes=[...host.querySelectorAll(`input[data-hide="${attr}"]`)];
    boxes.forEach(box=>{box.onchange=()=>{
      const mode=settings.group,hidden=new Set((settings.hidden||{})[mode]||[]),key=box.value;
      if(box.checked)hidden.delete(key);else{if(hidden.size+1>=boxes.length){box.checked=true;return;}hidden.add(key);}
      settings.hidden={...(settings.hidden||{}),[mode]:[...hidden]};reopenGroups=attr;rerender();
      host.querySelector(`input[data-hide="${attr}"][value="${CSS.escape(key)}"]`)?.focus();
    };});
    const all=host.querySelector(`[data-hide-all="${attr}"]`);
    if(all)all.onclick=()=>{settings.hidden={...(settings.hidden||{}),[settings.group]:[]};reopenGroups=attr;rerender();};
  }
  // Page chart options from a settings object (measure, unit, layout, ordering, bins, range, zeros)
  const chartView=pc=>({measure:pc.measure,ordering:fixedOrder(pc.unit)?'manuscript':pc.ordering,layout:pc.layout,unit:pc.unit,binning:{bins:pc.bins,zeros:pc.zeros!=='hide',clip:pc.range!=='full'},
    names:{section:M.section_names,regime:Object.fromEntries(M.regimes.map(r=>[r.key,r.label]))}});
  function renderPageChart() {
    const el=document.getElementById('wb-page-chart'),P=window.EchoPageChart;if(!el)return;
    if(!M||!P){el.innerHTML='<div class="wb-notice">The page chart needs manuscript_data.js and page_chart.js. Run build_manuscript.py.</div>';return;}
    const s=state.search,pc=state.pageChart,found0=pageChartMatches(),{query,own}=found0;
    // groups hidden in the Groups menu leave the chart, the table and the counts
    const view=shownView(pc,s,linesFor(s.locus)),group=view.group,matches=found0.matches.filter(o=>view.keep(o.line));
    const compare=found0.compare&&{...found0.compare,matches:found0.compare.matches.filter(o=>view.keep(o.line))};
    const pagesIn=new Set(view.lines.map(l=>l.folio)).size, onPages=ms=>fmt(new Set(ms.map(o=>o.line.folio)).size), where=view.hidden.length?'in the shown groups':'in the whole manuscript';
    const found=compare?`▲ ${fmt(matches.length)} and ▼ ${fmt(compare.matches.length)} matches ${where}, on ${onPages(matches)} and ${onPages(compare.matches)} of ${fmt(pagesIn)} pages`
      :`${fmt(matches.length)} ${matches.length===1?'match':'matches'} ${where}, on ${onPages(matches)} of ${fmt(pagesIn)} pages`;
    el.innerHTML=`<details class="wb-card page-chart" ${pc.open?'open':''}><summary><h3>Matches by page</h3><span class="wb-small">${found}</span><button class="wb-button pc-share" data-share="pages" title="Copy a link that opens this chart with these settings">Share link</button></summary>
      <div class="pc-controls">${chartSelect('pc','group','Color by',pc.group,GROUP_OPTIONS)}${groupMenu('pc',view.full,view.hidden,reopenGroups==='pc')}
      ${chartSelect('pc','unit','Unit',pc.unit,UNIT_OPTIONS)}
      ${chartSelect('pc','layout','View',pc.layout,LAYOUT_OPTIONS)}
      ${chartSelect('pc','measure','Show',pc.measure,MEASURE_OPTIONS)}
      ${chartOrderControls('pc',pc)}
      ${own?chartSelect('pc','pattern','Pattern',pc.pattern,[['search',s.query||'(all)'],['compare',s.compareQuery],['both','Both: comparison below']]):''}
      ${exportMenu('pc-export','pc-copy')}</div>
      <div class="pc-body"></div>
      <p class="wb-small pc-note">Every search filter on this page applies, over ${esc(locusText(s.locus))}${s.folio||s.sheet?`; the selected ${s.folio?'folio is':'sheet’s pages are'} highlighted and other pages stay visible`:''}.${pc.unit==='paragraph'?' Paragraphs follow the transcription’s paragraph starts; each page’s other loci form one unit.':''}${pc.unit==='bifolium'?' Bifolia are named by quire and folios: A:1-8 is folios 1 and 8 of quire A. A foldout counts as one bifolium.':''}${pc.unit==='quire'?' Quires are numbered from the transliteration’s quire letters (A = Q1).':''}${pc.layout==='histogram'?' Bins are shared by all groups; Auto sets their width from the spread of the units with matches.':''} Order and view never change the table.</p>
      ${pageChartInfo(pc.group)}</details>`;
    reopenGroups='';
    const d=el.querySelector('details');d.ontoggle=()=>{pc.open=d.open;};
    el.querySelectorAll('.pc-controls select[data-pc]').forEach(x=>{x.onchange=()=>{pc[x.dataset.pc]=x.value;renderPageChart();};});
    bindGroupMenu('pc',pc,renderPageChart);
    P.mount(el.querySelector('.pc-body'),{pages:M.pages,lines:view.lines,matches,compare,query,group,...chartView(pc),highlight:{folio:s.folio,sheet:s.sheet}});
  }

  // ------------------------------------------------------------------ Compare patterns
  // Several word patterns side by side: one column per pattern, one row per group of the manuscript, each cell the
  // group's value under the measure. Built from the parts Words & contexts uses: the pattern matcher and search engine
  // (workbench_core.js), the neighbor, q and line filters (contextFields), the groupings, statistics and table cells
  // of the page chart (page_chart.js), and the Matches by page chart for one or two pinned columns.
  const PT_MAX=20;
  const ptAbbrev=(t,n=40)=>window.EchoPageChart.cutLabel(t,n);   // the chart's own cut, at a whole term
  // Reads the form into state: the patterns as typed, the filters, the loci and Merge q
  function ptCollect(){
    const m=state.patterns;
    m.list=m.list.map((q,i)=>document.getElementById('pt-p'+i)?.value??q);
    if(document.getElementById('pt-prev2'))Object.assign(m,collectContext('pt'));
    const locus=document.getElementById('pt-locus');if(locus)m.locus=locus.value;
    const merge=document.getElementById('pt-mergeq');if(merge)m.mergeQ=merge.checked;
  }
  // Each non-empty pattern's matches in the whole manuscript, in the chosen loci, with every filter applied
  function ptSeries(){
    const m=state.patterns,items=manuscript(m.mergeQ,m.locus);
    const config={mergeQ:m.mergeQ,mode:'glob',prev2:m.prev2,prev:m.prev,next:m.next,q:m.q,nextQ:m.nextQ,position:m.position,lineClass:m.lineClass};
    return m.list.map((query,i)=>({i,query:query.trim()})).filter(x=>x.query).map(x=>({...x,matches:C.search(items,{...config,query:x.query})}));
  }
  const ptStats=(series,group,lines)=>{const P=window.EchoPageChart;return series.map(x=>P.statistics(P.unitModel(M.pages,lines,x.matches,group,'page'),group,state.patterns.measure));};
  function ptForm(m){
    const mark=i=>{const k=m.pinned.indexOf(i);return k<0?'':k?' ▼':' ▲';};
    const box=(q,i)=>`<div class="wb-field pt-field"><div class="pt-label"><label for="pt-p${i}">Pattern ${i+1}${mark(i)}</label>${m.list.length>1?`<button type="button" class="pt-remove" data-action="pt-remove" data-index="${i}" aria-label="Remove pattern ${i+1}">Remove</button>`:''}</div>${patternInput('pt-p'+i,q,i?'':'*aiin')}</div>`;
    const open=contextKeys.some(k=>m[k]&&m[k]!=='any')||m.locus!=='running'||m.mergeQ;
    return `<div class="wb-card"><div class="wb-fields pt-fields">${m.list.map(box).join('')}</div>
      ${qMaskedIn(m.mergeQ,[...m.list,m.prev2,m.prev,m.next])?'<div class="wb-notice">With Merge q on, initial q is removed before matching, so patterns starting with q find nothing.</div>':''}
      <details ${open?'open':''} style="margin-top:16px"><summary>Surrounding words, q state and loci</summary><div class="wb-fields">${contextFields('pt',m)}${field('pt-locus','Loci',select('pt-locus',LOCUS_OPTIONS,m.locus))}<label class="context-q" title="Pool initial q with the unprefixed form"><input id="pt-mergeq" type="checkbox" ${m.mergeQ?'checked':''}> Merge q</label></div></details>
      <div class="wb-actions">${button('Compare','pt-compare','primary')}${m.list.length<PT_MAX?button('Add pattern','pt-add'):''}</div>
      <p class="wb-small">${patternHelp(m.mergeQ)} The filters apply to all patterns.</p></div>`;
  }
  function patterns(){
    const m=state.patterns,P=window.EchoPageChart;
    const title=heading('Several patterns at once','Compare patterns','One column per pattern, one row per group of the manuscript.');
    const problem=!M||!P?'This tab needs manuscript_data.js and page_chart.js. Run build_manuscript.py.':patternProblem([...m.list.map((q,i)=>['Pattern '+(i+1),q]),...neighborBoxes(m)]);
    if(problem){host.innerHTML=`<div class="wb-wrap">${title}${ptForm(m)}<div class="wb-notice wb-error" role="alert">${esc(problem)}</div></div>`;bind();return;}
    // groups hidden in the Groups menu leave the table, the pinned chart and the export
    const view=shownView(m,{},linesFor(m.locus)),group=view.group,series=ptSeries().map(x=>({...x,matches:x.matches.filter(o=>view.keep(o.line))})),stats=ptStats(series,group,view.lines);
    m.pinned=m.pinned.filter(i=>series.some(x=>x.i===i)).slice(0,2);
    const top=title+ptForm(m);
    const full=m.pinned.length>=2,unit=(UNIT_OPTIONS.find(o=>o[0]===m.unit)||UNIT_OPTIONS[0])[1].toLowerCase();
    const head=(x,c)=>{
      const k=m.pinned.indexOf(x.i),on=k>=0,tip=full&&!on?'Two columns are pinned; unpin one first':on?'Remove this column from the chart':'Chart this column by page, paragraph, bifolium or quire';
      const move=(d,glyph,side)=>`<button type="button" class="wb-button pt-move" data-action="pt-move" data-dir="${d}" data-index="${x.i}" data-to="${(series[c+d]||{}).i??''}" aria-label="Move pattern ${x.i+1} ${side}" title="Move ${side}"${series[c+d]?'':' disabled'}>${glyph}</button>`;
      return `<div class="pt-headbox"><span class="pt-pattern">${on?(k?'▼ ':'▲ '):''}<span class="pt-n">#${x.i+1}</span>${esc(ptAbbrev(x.query))}</span><div class="pt-head-actions">${move(-1,'◀','left')}${move(1,'▶','right')}<button type="button" class="wb-button pt-pin${on?' on':''}" data-action="pt-pin" data-index="${x.i}" aria-pressed="${on}"${full&&!on?' disabled':''} title="${tip}">${on?'Unpin':'Pin'}</button></div></div>`;
    };
    const pinned=m.pinned.map(i=>series.find(x=>x.i===i));
    host.innerHTML=`<div class="wb-wrap">${top}
      <section class="wb-card" id="wb-patterns-table"><div class="wb-row-title"><h3>By group</h3><button class="wb-button" data-share="patterns" title="Copy a link that opens this table with these patterns and settings">Share link</button></div>
      <div class="pc-controls">${chartSelect('pt','group','Color by',m.group,GROUP_OPTIONS.filter(o=>o[0]!=='comparison'),m.pinned.length?'Also sets the pinned chart’s Color by':'')}${groupMenu('pt',view.full,view.hidden,reopenGroups==='pt')}${chartSelect('pt','measure','Show',m.measure,MEASURE_OPTIONS)}<div class="pc-ctl"><span class="wb-small" id="pt-bars-label">Bar scale</span><div class="seg" role="group" aria-labelledby="pt-bars-label">${[['table','Table','One scale for the whole table: compare columns'],['column','Column','One scale per column: compare groups within a column']].map(([v,t,tip])=>`<button type="button" data-ptscale="${v}" class="${m.barScale===v?'on':''}" aria-pressed="${m.barScale===v}" title="${tip}">${t}</button>`).join('')}</div></div>${series.length?exportMenu('pt-export','pt-copy'):''}</div>
      ${series.length?P.seriesTable(series.map((x,j)=>({stats:stats[j],head:head(x,j),title:`Pattern ${x.i+1}: ${x.query}`})),m.measure,{scale:m.barScale}):'<div class="wb-empty">Enter a pattern above.</div>'}
      <p class="wb-small">Counted over ${esc(locusText(m.locus))}${m.mergeQ?', q merged':''}. Pin up to two columns to chart them by page, paragraph, bifolium or quire.</p>${pageChartInfo(m.group)}</section>
      ${pinned.length?`<section class="wb-card" id="wb-patterns-chart"><div class="wb-row-title"><h3>Pinned, by ${esc(unit)}</h3><span class="wb-small pt-legend" title="${esc(pinned.map((x,k)=>`${k?'▼':'▲'} #${x.i+1} ${x.query}`).join('\n'))}">▲ #${pinned[0].i+1} ${esc(ptAbbrev(pinned[0].query))}${pinned[1]?` · ▼ #${pinned[1].i+1} ${esc(ptAbbrev(pinned[1].query))}`:''}</span></div>
      <div class="pc-controls">${chartSelect('pt','group','Color by',m.group,GROUP_OPTIONS.filter(o=>o[0]!=='comparison'),'Also sets the table’s Color by')}${chartSelect('pt','unit','Unit',m.unit,UNIT_OPTIONS)}${chartSelect('pt','layout','View',m.layout,LAYOUT_OPTIONS)}${chartOrderControls('pt',m)}</div><div class="pt-key">${group.groups.map(g=>`<span><i class="pc-sw" style="${P.paint(g)}"></i>${esc(g.label)}</span>`).join('')}</div><div class="pc-body"></div></section>`:''}</div>`;
    reopenGroups='';
    // a setting changed on the pinned chart's card keeps that chart where it was on screen (the table above may change
    // height), with the focus back on the same control
    host.querySelectorAll('select[data-pt]').forEach(x=>{x.onchange=()=>{const onChart=!!x.closest('#wb-patterns-chart'),top=onChart&&document.getElementById('wb-patterns-chart').getBoundingClientRect().top;
      ptCollect();m[x.dataset.pt]=x.value;patterns();
      const card=onChart&&document.getElementById('wb-patterns-chart');if(card){host.scrollTop+=card.getBoundingClientRect().top-top;card.querySelector(`select[data-pt="${x.dataset.pt}"]`)?.focus({preventScroll:true});}};});
    bindGroupMenu('pt',m,()=>{ptCollect();patterns();});
    host.querySelectorAll('[data-ptscale]').forEach(b=>{b.onclick=()=>{ptCollect();m.barScale=b.dataset.ptscale;patterns();host.querySelector(`[data-ptscale="${m.barScale}"]`)?.focus();};});
    if(pinned.length)P.mount(host.querySelector('#wb-patterns-chart .pc-body'),{pages:M.pages,lines:view.lines,matches:pinned[0].matches,query:`#${pinned[0].i+1} ${ptAbbrev(pinned[0].query)}`,labelLength:60,
      compare:pinned[1]?{matches:pinned[1].matches,query:`#${pinned[1].i+1} ${ptAbbrev(pinned[1].query)}`}:null,group,...chartView(m),slot:'patterns',showTable:false});
    bind();
  }
  // The table as shown, header first: one row per shown group and the total, one column per pattern, each cell the
  // value under the measure shown. The first header names the measure; numbers carry no thousands separators.
  function ptTable(){
    const m=state.patterns,view=shownView(m,{},linesFor(m.locus)),series=ptSeries().map(x=>({...x,matches:x.matches.filter(o=>view.keep(o.line))}));if(!series.length)throw new Error('Enter a pattern first.');
    const stats=ptStats(series,view.group,view.lines);
    const unit={count:'matches',percent:'% of words',per10k:'per 10k words',perline:'matches per line'}[m.measure];
    const value=s=>m.measure==='count'?s.matches:m.measure==='percent'?+(100*(s.rate||0)).toFixed(4):m.measure==='per10k'?+(s.per10k||0).toFixed(2):+(s.perLine||0).toFixed(4);
    return {name:'echo-pattern-comparison.csv',rows:[[`Group (${unit})`,...series.map(x=>`#${x.i+1} ${x.query}`)],
      ...stats[0].rows.map((g,i)=>[g.label,...stats.map(st=>value(st.rows[i]))]),[stats[0].total.label,...stats.map(st=>value(st.total))]]};
  }
  // Patterns in a link: p1, p2, ... (the non-empty ones, in order) and pin=1,2 (positions in that list)
  function ptLink(){
    const m=state.patterns,kept=m.list.map((q,i)=>[q.trim(),i]).filter(([q])=>q),out={};
    kept.forEach(([q],j)=>{out['p'+(j+1)]=q;});
    const pins=m.pinned.map(i=>kept.findIndex(k=>k[1]===i)+1).filter(n=>n>0);if(pins.length)out.pin=pins;
    return out;
  }
  function ptApply(params){
    const R=window.EchoViewState.read,keys=Object.keys(params).filter(k=>/^p\d+$/.test(k)).sort((a,b)=>a.slice(1)-b.slice(1));
    const list=keys.map(k=>R.text(params[k])).filter(Boolean).slice(0,PT_MAX);if(!list.length)return 0;
    state.patterns.list=list;
    state.patterns.pinned=[...new Set((R.list(params.pin)||[]).map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=list.length).map(n=>n-1))].slice(0,2);
    return list.length;
  }

  function ruleCard(r, i) {
    const prefix='wr'+i;
    return `<section class="wb-rule" data-rule="${i}"><div class="wb-rule-head"><input aria-label="Enable rule ${i+1}" type="checkbox" data-key="enabled" ${r.enabled?'checked':''}><b>Rule ${i+1} <span class="wb-badge neutral">${r.kind==='known'?esc([D.rules.find(x=>x.code===r.code)?.confidence,D.rules.find(x=>x.code===r.code)?.evidence||'Catalog menu'].filter(Boolean).join(' · '))+' · trial fraction':'Experimental spelling edit'}</span></b><button class="wb-button" data-action="rule-remove" data-index="${i}">Remove</button></div>
      <div class="wb-fields">${field(prefix+'-name','Name',input(prefix+'-name',r.name),true)}${field(prefix+'-kind','Edit type',select(prefix+'-kind',[['exact','Whole word'],['prefix','Prefix'],['suffix','Suffix'],['contains','First literal occurrence'],['known','Catalog rule (forward)']],r.kind))}
      ${r.kind==='known'?field(prefix+'-code','Catalog rule',select(prefix+'-code',Object.keys(W.known).map(k=>[k,k+' · '+(D.rules.find(x=>x.code===k)?.pattern||'')]),r.code),true):field(prefix+'-from','Find (q-merged)',input(prefix+'-from',r.from))+field(prefix+'-to','Replace with',input(prefix+'-to',r.to))}
      ${field(prefix+'-fraction','Apply to matching mass (%)',`<input id="${prefix}-fraction" type="number" min="0" max="100" step="1" value="${r.fraction*100}">`)}</div>
      <details ${contextKeys.some(k=>r[k]&&r[k]!=='any')?'open':''}><summary>Only when these original-word contexts match</summary><div class="wb-fields">${contextFields(prefix,r)}</div></details></section>`;
  }
  function lab() {
    host.innerHTML = `<div class="wb-wrap">${heading('03 / Test an explicit hypothesis', 'Rule lab', 'Apply existing rules or candidate spelling edits to observed tokens. Compare the resulting Voynichese distribution with another section, including the overlap a rewrite destroys.')}
      <div class="wb-notice">Exploratory, reused corpus. This experiment starts from original text, separately from the saved LC1 residuals. Catalog entries keep their confidence (Rule, Theory or Hypothesis), shown in the Rule manager.</div>
      <div class="wb-card"><div class="wb-fields">${field('wl-from','Translate from',select('wl-from',populations,state.lab.from))}${field('wl-to','Compare against',select('wl-to',populations,state.lab.to))}<div class="wb-field wide"><span class="wb-small">Catalog menus run forward. A rule’s percentage is shared equally across its alternative outputs; these are trial fractions, not fitted probabilities. q state is preserved.</span></div></div>
      <div id="wb-rule-list">${state.lab.rules.map(ruleCard).join('')}</div>
      <div class="wb-actions">${button('+ Add candidate','rule-add')}${button('+ Add catalog rule','rule-known')}${button('Run experiment','lab-run','primary')}${button('Export experiment JSON','lab-export')}</div>
      <p class="wb-small" id="wb-save-state">${esc(state.storage||'Drafts stay in this browser; export JSON to share an experiment.')}</p>
      <details><summary>Import an experiment or inspect the method</summary><div class="wb-columns"><div><label for="wl-import" class="wb-small">Paste an exported experiment JSON</label><textarea id="wl-import" rows="5" placeholder='{"schema":1,"from":"HA_early","to":"HB_all","rules":[...]}'></textarea><div class="wb-actions">${button('Load pasted JSON','lab-import')}</div></div><div class="wb-caption">Each rule receives its stated fraction of every matching original occurrence. Competing fractions must sum to at most 100%; the rest stays unchanged. Rules do not cascade. Context refers to original neighbors, never transformed neighbors. Each output receives pooled mass and is credited at most its observed target rate. Rates use each population’s original token total. Joins, splits, fitting, and independent validation are outside this sandbox.</div></div></details>
      <div id="wb-lab-message" role="status"></div></div><div id="wb-lab-results" aria-live="polite"></div></div>`;
    bind();
    // Read edits on input, not just blur: running/exporting must never use a stale draft.
    host.querySelectorAll('[data-rule] input, [data-rule] select').forEach(el=>el.addEventListener(el.tagName==='INPUT'?'input':'change',()=>{
      const i=+el.closest('[data-rule]').dataset.rule, r=state.lab.rules[i];
      if(el.dataset.key==='enabled') r.enabled=el.checked;
      else {const key=el.id.slice(('wr'+i+'-').length); r[key]=key==='fraction'?+el.value/100:el.value;}
      state.result=null; save();
      if(el.id.endsWith('-kind')) lab(); else {document.getElementById('wb-lab-results').innerHTML=''; document.getElementById('wb-save-state').textContent=state.storage; document.getElementById('wb-lab-message').textContent='Draft changed. Run the experiment to update the results.';}
    }));
    if(state.result) renderResult();
  }
  function renderResult() {
    const r=state.result;
    const changed=r.rows.filter(w=>Math.abs(w.after-w.before)>1e-8).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)||Math.abs(b.after-b.before)-Math.abs(a.after-a.before));
    const pages=[...new Set(corpus(state.lab.from).map(o=>o.line.folio))];
    if(!pages.includes(state.preview)) state.preview=r.examples[0]?.line.folio||pages[0];
    document.getElementById('wb-lab-results').innerHTML=`<div class="wb-metrics">${metric('Overlap gained', '+'+fmt(r.gained), 'per 10k original tokens')}${metric('Overlap lost', '−'+fmt(r.lost),'existing overlap removed')}${metric('Net overlap change', (r.net>=0?'+':'')+fmt(r.net), pct(r.overlapBefore)+' → '+pct(r.overlapAfter))}${metric('Mass accounted for',fmt(r.mass)+' / '+fmt(r.nSource),'one unit per source occurrence')}</div>
      <div class="wb-caption">${r.matched} matching occurrences · ${r.types} source forms · ${r.sheets} physical sheets · ${fmt(r.moved)} token equivalents moved. Target population: ${r.nTarget} tokens. ${state.lab.from===state.lab.to?'Source and target are the same population; identity begins at 100% overlap.':''}</div><div class="wb-actions">${button('View experiment frequency plots','plot-lab')}</div>
      <div class="wb-columns"><div class="wb-card"><h3>What improved, and what was lost</h3><p class="wb-small">All changed forms (${changed.length}), sorted by absolute overlap change. Multiple routes into a form share its target mass.</p><div class="wb-scroll"><table class="wb-table"><thead><tr><th>Form</th><th>Before</th><th>After</th><th>Target</th><th>Δ overlap</th></tr></thead><tbody>${changed.map(w=>`<tr><td>${wordButton(w.word)}</td><td>${fmt(w.before)}</td><td>${fmt(w.after)}</td><td>${fmt(w.target)}</td><td class="${w.delta>=0?'wb-good':'wb-loss'}">${w.delta>=0?'+':''}${fmt(w.delta)}</td></tr>`).join('')}</tbody></table>${!changed.length?'<div class="wb-empty">No mass moved. Check spelling, context filters, enabled rules, and fractions.</div>':''}</div></div>
      <div class="wb-card"><h3>Applied routes</h3><p class="wb-small">Fractional source-token equivalents. These describe your policy, not observed token ancestry.</p><div class="wb-scroll"><table class="wb-table"><thead><tr><th>Route</th><th>Moved</th></tr></thead><tbody>${r.routes.sort((a,b)=>b[1]-a[1]).map(([route,n])=>`<tr><td class="mono">${esc(route)}</td><td>${fmt(n)}</td></tr>`).join('')}</tbody></table></div></div></div>
      <div class="wb-card"><div class="wb-row-title"><h3>Interlinear experiment preview</h3>${field('wl-preview','Source folio',select('wl-preview',pages,state.preview))}</div><p class="wb-small">Original token above; possible outputs and percentages below. Unlisted tokens retain 100%. q is kept. The experiment reports weighted alternatives rather than selecting a deterministic translation.</p><div id="wb-preview"></div></div>`;
    document.getElementById('wl-preview').onchange=e=>{state.preview=e.target.value;renderPreview();};
    renderPreview();
  }
  function renderPreview() {
    const examples=new Map(state.result.examples.map(o=>[o.line.folio+'|'+o.line.locus+'|'+o.index,o]));
    document.getElementById('wb-preview').innerHTML=W.lines.filter(l=>l.folio===state.preview&&l.sections.includes(state.lab.from)).map(l=>`<div class="wb-preview-line"><span class="wb-small">${esc(l.locus)}</span>${l.words.map((w,i)=>{const o=examples.get(l.folio+'|'+l.locus+'|'+i);return `<div class="wb-preview-token ${o?'changed':''}">${esc(w||'[…]')}${o?`<small>${o.branches.map(b=>esc((w.startsWith('q')?'q':'')+b.word)+' '+fmt(b.weight*100)+'%').join('<br>')}${o.retained>1e-8?'<br>keep '+fmt(o.retained*100)+'%':''}</small>`:''}</div>`;}).join('')}</div>`).join('');
  }
  function csv(rows) { return rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n'); }
  // Tab-separated rows paste into separate spreadsheet cells; a tab or line break inside a value would split it
  function tsv(rows) { return rows.map(row=>row.map(v=>String(v??'').replace(/[\t\r\n]+/g,' ')).join('\t')).join('\n'); }
  async function copyText(text,label) {
    let ok=false;
    try{await navigator.clipboard.writeText(text);ok=true;}
    catch{const t=document.createElement('textarea');t.value=text;t.setAttribute('readonly','');t.style.cssText='position:fixed;top:0;opacity:0';document.body.appendChild(t);t.focus();t.select();try{ok=document.execCommand('copy');}catch{}t.remove();}
    if(label){const was=label.dataset.label||=label.textContent;label.textContent=ok?'Copied':'Copy failed';setTimeout(()=>{label.textContent=was;},1600);}
    return ok;
  }
  function collectSearch() {
    const mergeQ=state.search.mergeQ;
    state.search={neighborExcluded:state.search.neighborExcluded||{},neighborOnly:state.search.neighborOnly||{},groupFilters:state.search.groupFilters||[],excluded:state.search.excluded||[],section:document.getElementById('wc-section').value,compare:document.getElementById('wc-compare').value,query:document.getElementById('wc-query').value,compareQuery:document.getElementById('wc-compareQuery').value,mode:document.getElementById('wc-mode').value,...collectContext('wc'),folio:document.getElementById('wc-folio').value,sheet:document.getElementById('wc-sheet').value,locus:document.getElementById('wc-locus')?.value||state.search.locus||'running'};state.contextPage=0;
    state.search.mergeQ=mergeQ;state.neighborPages={prev:0,next:0};
  }
  function reportError(error) {
    const node=document.getElementById('wb-lab-message')||document.getElementById('wb-error');
    if(node){node.className='wb-notice wb-error';node.textContent=error.message;}
    else {const div=document.createElement('div');div.id='wb-error';div.className='wb-notice wb-error';div.setAttribute('role','alert');div.textContent=error.message;(host.querySelector('.wb-wrap')||host).prepend(div);}
  }
  function bind() {
    host.onclick=e=>{const b=e.target.closest('[data-action]');if(!b)return;b.closest('.wb-menu')?.removeAttribute('open');try{act(b.dataset.action,b);}catch(error){reportError(error);}};
    host.querySelectorAll('input:not([type="checkbox"]):not([type="number"]):not(#wc-form-find)').forEach(el=>el.addEventListener('keydown',e=>{if(e.key==='Enter'&&['residuals','contexts','patterns'].includes(state.tab)){e.preventDefault();try{act(state.tab==='residuals'?'res-filter':state.tab==='patterns'?'pt-compare':'context-search',{});}catch(error){reportError(error);}}}));
    const resMode=document.getElementById('wb-res-mode');if(resMode)resMode.onchange=()=>{state.resMode=resMode.value;state.residualPage=0;residuals();};
    const fitCompare=document.getElementById('wb-fit-compare');if(fitCompare)fitCompare.onchange=()=>{state.fitCompare=fitCompare.value;residuals();};
    const fitEvalSel=document.getElementById('wb-fit-eval');if(fitEvalSel)fitEvalSel.onchange=()=>{state.fitEval=+fitEvalSel.value;state.residualPage=0;residuals();};
    const evalSelect=document.getElementById('wb-eval');if(evalSelect)evalSelect.onchange=()=>{state.evaluation=evalSelect.value;state.residualPage=0;residuals();};
    const percentSelect=document.getElementById('wc-percent');if(percentSelect)percentSelect.onchange=()=>{state.percentMode=percentSelect.value;contexts();};
    const signals=document.getElementById('wc-signals');if(signals)signals.onchange=()=>{state.signalFilter=signals.value;state.neighborPages={prev:0,next:0};contexts();};
    const grouping=document.getElementById('wc-neighbor-mode');if(grouping)grouping.title='Full word uses the selected q view. Gallows form finds gallows anywhere in each adjacent word. Bench gallows stay whole; combined labels retain multiple types. None means a readable word without gallows.';
    if(grouping)grouping.onchange=()=>{
      collectSearch();state.neighborMode=grouping.value;
      // Group keys change, but exclusions describe actual words and stay valid.
      state.neighborDrill=null;state.neighborEvidence=null;contexts();
    };
    // Thresholds change descriptive review flags only; never filter observations.
    for(const [id,key,min,max] of [['wc-review-gap','reviewMinGap',0,100],['wc-review-lift','reviewMinLift',1,1000],['wc-review-large','reviewLargeGap',0,100]]) {
      const el=document.getElementById(id);if(el)el.onchange=()=>{const value=Number(el.value);if(!el.value||!Number.isFinite(value)||value<min||value>max){el.value=state[key];return;}collectSearch();state[key]=value;contexts();document.querySelector('.context-display details').open=true;};
    }
    host.querySelectorAll('.context-merge-q').forEach(box=>box.onchange=()=>{
      const scroll=host.scrollTop,where=box.getAttribute('aria-label'),mergeQ=box.checked;
      collectSearch();
      // A raw-only exclusion must not silently exclude its unprefixed partner.
      // Preserve distinct choices for each mode, restoring them on switching back.
      state.qExclusions[state.search.mergeQ]={excluded:state.search.excluded,neighborExcluded:state.search.neighborExcluded,neighborOnly:state.search.neighborOnly};
      Object.assign(state.search,{mergeQ},state.qExclusions[mergeQ]||{excluded:[],neighborExcluded:{},neighborOnly:{}});
      state.neighborEvidence=null;
      if(state.neighborMode==='word'||(state.neighborDrill?.side==='next'&&state.neighborDrill.key==='q-'&&mergeQ))state.neighborDrill=null;
      contexts();host.querySelector(`[aria-label="${where}"]`)?.focus({preventScroll:true});host.scrollTop=scroll;
    });
    const finder=document.getElementById('wc-form-find');if(finder)finder.oninput=()=>host.querySelectorAll('[data-form]').forEach(row=>row.hidden=!row.dataset.form.includes(finder.value.trim()));
    host.querySelectorAll('.neighbor-include').forEach(box=>box.onchange=()=>{
      const scroll=host.scrollTop,tableScroll=box.closest('.wb-scroll').scrollTop,{side,word}=box.dataset;
      const excluded=new Set(state.search.neighborExcluded?.[side]||[]);box.checked?excluded.delete(word):excluded.add(word);
      state.search.neighborExcluded={...state.search.neighborExcluded,[side]:[...excluded]};
      if(!box.checked&&onlyWords(side).includes(word)){state.search.neighborOnly={...state.search.neighborOnly,[side]:onlyWords(side).filter(w=>w!==word)};state.contextPage=0;}
      contexts();
      const replacement=host.querySelector(`.neighbor-include[data-side="${side}"][data-word="${CSS.escape(word)}"]`);
      replacement.focus({preventScroll:true});replacement.closest('.wb-scroll').scrollTop=tableScroll;host.scrollTop=scroll;
    });
    host.querySelectorAll('.context-include').forEach(box=>box.onchange=()=>{
      const scroll=host.scrollTop,tableScroll=box.closest('.wb-scroll').scrollTop,filter=finder.value,word=box.dataset.word;
      const excluded=new Set(state.search.excluded||[]);box.checked?excluded.delete(word):excluded.add(word);
      state.search.excluded=[...excluded];state.contextPage=0;contexts();
      const replacement=host.querySelector(`.context-include[data-word="${CSS.escape(word)}"]`);
      const nextFinder=document.getElementById('wc-form-find');nextFinder.value=filter;nextFinder.oninput();
      replacement.focus({preventScroll:true});replacement.closest('.wb-scroll').scrollTop=tableScroll;host.scrollTop=scroll;
    });
    // Both selectors must commit and recompute immediately. Previously only the
    // source refreshed, leaving a stale same-population result after a manual swap.
    ['wc-section','wc-compare'].forEach(id=>{const el=document.getElementById(id);if(el)el.onchange=()=>{collectSearch();if(id==='wc-section'){state.search.folio='';state.search.sheet='';}contexts();};});
    ['wl-from','wl-to'].forEach(id=>{const el=document.getElementById(id);if(el)el.onchange=()=>{state.lab[id.slice(3)]=el.value;state.result=null;save();lab();};});
  }
  // Matches by page as rows, header first: one row per page, paragraph, bifolium or quire that has words. Download CSV and
  // Copy as TSV both use these rows.
  function pageChartTable() {
    const s=state.search,unit=state.pageChart.unit,found0=pageChartMatches(),query=found0.query,P=window.EchoPageChart,view=shownView(state.pageChart,s,linesFor(s.locus)),group=view.group;
    const matches=found0.matches.filter(o=>view.keep(o.line)),compare=found0.compare&&{...found0.compare,matches:found0.compare.matches.filter(o=>view.keep(o.line))};
    const model=ms=>P.unitModel(M.pages,view.lines,ms,group,unit),all=model(matches),allC=compare&&model(compare.matches);
    const keep=all.map((r,i)=>i).filter(i=>all[i].totalTokens);
    // a bifolium or quire lists every value its pages have (sections, regimes, ...), separated by semicolons
    const many=r=>r.kind==='bifolium'||r.kind==='quire';
    const of=(r,f)=>many(r)?[...new Set(r.page.pages.flatMap(p=>[].concat(f(p)??[])).filter(v=>v!==''&&v!=null))].join('; '):[].concat(f(r.page)??[]).join(' ');
    const rates=(m,r)=>[m,(100*m/r.totalTokens).toFixed(4),(1e4*m/r.totalTokens).toFixed(2),r.totalLines?(m/r.totalLines).toFixed(4):''];
    return {name:`echo-${unit}-counts.csv`,rows:[['unit','folio','kind','section','regime','rz_language','currier','hands','sheet','populations','loci','words','lines','matches','percent','per_10k_words','per_line','pattern','merge_q',...(compare?['compare_matches','compare_percent','compare_per_10k_words','compare_per_line','compare_pattern']:[])],
      ...keep.map(i=>{const r=all[i];return [P.unitName(r),r.kind==='quire'?`${r.page.pages[0].folio}–${r.page.last}`:r.kind==='bifolium'?r.page.pages.map(p=>p.folio).join('; '):r.page.folio,r.kind,of(r,p=>M.section_names[p.section]),of(r,p=>p.regime),of(r,p=>p.rz),of(r,p=>p.lang),of(r,p=>p.hands),of(r,p=>p.sheet),of(r,p=>p.populations),s.locus,r.totalTokens,r.totalLines,...rates(r.totalMatches,r),query,s.mergeQ,
        ...(compare?[...rates(allC[i].totalMatches,r),compare.query]:[])];})]};
  }
  function act(action,b) {
    if(/^neighbor-(prev|next)-(back|next)$/.test(action)) {
      const [,side,direction]=action.split('-'),scroll=host.scrollTop;
      state.neighborPages[side]+=direction==='next'?1:-1;contexts();host.scrollTop=scroll;return;
    }
    if(action==='word') {
      // Narrowing a concordance to one form must retain the context being studied.
      if(state.tab==='contexts') state.search={...state.search,query:b.dataset.word,mode:'glob'};
      else {
        // Residuals, Distribution and the rule lab list q-merged forms; without merge, search both raw spellings.
        const query=state.search.mergeQ?b.dataset.word:C.qVariants(b.dataset.word);
        state.search={...state.search,query,compareQuery:'',mode:'glob',folio:'',sheet:'',prev2:'',prev:'',next:'',q:'any',nextQ:'any',position:'any',lineClass:'any',neighborOnly:{},groupFilters:[],locus:'running'};
        const rs=state.resMode==='rules'?[state.resFrom,state.resTo]:['HA_early','HB_all'];
        state.search.section=state.tab==='residuals'?(state.side==='target'?rs[1]:rs[0]):state.lab.from;
        state.search.compare=state.tab==='residuals'?(state.side==='target'?rs[0]:rs[1]):state.lab.to;
        if(state.tab==='distribution'&&state.chartSource==='saved'){state.search.section='HA_early';state.search.compare='HB_all';}
      }
      state.contextPage=0;go('contexts');
    }
    else if(action==='plot-saved'||action==='plot-lab'){state.chartSource=action==='plot-saved'?'saved':'lab';go('distribution');}
    else if(action==='open-lab'){go('lab');}
    else if(action==='folio'){go('translate');const el=document.getElementById('trFolio');el.value=b.dataset.folio;el.dispatchEvent(new Event('change'));}
    else if(action==='aiin'){state.search={...state.search,section:'HA_early',compare:'HB_all',query:'*aiin',compareQuery:'',mode:'glob',prev2:'',prev:'',next:'',q:'any',nextQ:'any',position:'any',lineClass:'any',folio:'',sheet:'',neighborOnly:{},groupFilters:[],locus:'running'};state.contextPage=0;go('contexts');}
    else if(action==='demo'){state.lab.rules.push(defaults());if(state.lab.rules.length===2&&JSON.stringify(state.lab.rules[0])===JSON.stringify(defaults()))state.lab.rules.pop();state.result=null;save();go('lab');}
    else if(action==='fit-run'){
      if(state.fitRunning)return;state.fitRunning=true;
      const render=()=>{if(state.tab==='residuals')residuals();else if(state.tab==='distribution')distribution();};
      runFit().then(render).catch(error=>{state.fitStatus='';render();reportError(error);}).finally(()=>{state.fitRunning=false;});
    }
    else if(action==='res-filter'&&state.resMode==='fit'){state.side=document.getElementById('wb-side').value;state.query=document.getElementById('wb-res-query').value;state.fitEval=+document.getElementById('wb-fit-eval').value;state.residualPage=0;residuals();}
    else if(action==='res-filter'){state.side=document.getElementById('wb-side').value;state.query=document.getElementById('wb-res-query').value;state.route=document.getElementById('wb-route').value;
      if(state.resMode==='rules'){state.resFrom=document.getElementById('wb-res-from').value;state.resTo=document.getElementById('wb-res-to').value;state.resCls=document.getElementById('wb-res-cls').value;}
      else state.bin=document.getElementById('wb-bin').value;
      state.residualPage=0;residuals();}
    else if(action==='res-next'||action==='res-back'){state.residualPage+=action.endsWith('next')?1:-1;residuals();}
    else if(action==='res-export'&&state.resMode==='fit'){const F=state.fit;if(!F)return;const rows=fitResidualRows(F),key=state.side==='target'?'shortfall':'surplus',ev=F.active[Math.min(state.fitEval,F.active.length-1)].key;
      download('echo-fit-residuals.csv',csv([['evaluation','comparison','side','repeats','word','early_A_rate','after_comparison','after_active','herbal_B_rate',key],...rows.map(r=>[ev,F.compareLabel,state.side,F.collapse?'collapse':'keep',r.word,r.before,r.cmpAfter,r.after,r.target,r[key]])]),'text/csv');}
    else if(action==='res-export'&&state.resMode==='rules'){const {rows}=ruleResidualRows();const f=['word','gallows_class','source_tokens','target_tokens','source_rate','target_rate','kept','sent_or_received','left_or_missing','source_sheets','target_sheets','has_route'];
      download('echo-rule-residuals.csv',csv([['source','target','side','repeats',...f],...rows.map(r=>[state.resFrom,state.resTo,state.side,window.EchoApp.repeats?.()||'keep',r.word,r.cls,r.countA,r.countB,r.source,r.target,r.same,state.side==='target'?r.received:r.direct,state.side==='target'?r.missing:r.left,r.sheetsA,r.sheetsB,r.route])]),'text/csv');}
    else if(action==='res-export'){const rows=residualRows();const fields=['word','spelling_bin','A_tokens','B_tokens','A_before_rate','A_after_rate','B_rate','source_surplus_after_rate','target_shortfall_after_rate','target_has_incoming_edge_from_attested_A','source_has_admissible_rule'];download('echo-residuals.csv',csv([['evaluation',...fields],...rows.map(r=>[state.evaluation,...fields.map(k=>r[k])])]),'text/csv');}
    else if(action==='context-search'){collectSearch();contexts();}
    else if(action==='context-restore'||action==='context-restore-all'){const scroll=host.scrollTop;state.search.excluded=action==='context-restore-all'?[]:(state.search.excluded||[]).filter(w=>w!==b.dataset.word);state.contextPage=0;contexts();host.scrollTop=scroll;}
    else if(action==='neighbor-drill'){state.neighborDrill={side:b.dataset.side,key:b.dataset.group};state.neighborEvidence=null;contexts();document.getElementById('wb-neighbor-drill').scrollIntoView({block:'nearest'});}
    else if(action==='neighbor-evidence'){const tableScroll=b.closest('.wb-scroll').scrollTop;state.neighborEvidence={side:b.dataset.side,word:b.dataset.word,pop:+b.dataset.pop,scope:b.dataset.scope};contexts();host.querySelector('.neighbor-breakdown .wb-scroll').scrollTop=tableScroll;host.querySelector('.neighbor-evidence').scrollIntoView({block:'nearest'});}
    else if(action==='neighbor-evidence-close'){const scroll=host.scrollTop,tableScroll=host.querySelector('.neighbor-breakdown .wb-scroll').scrollTop;state.neighborEvidence=null;contexts();host.querySelector('.neighbor-breakdown .wb-scroll').scrollTop=tableScroll;host.scrollTop=scroll;}
    else if(action==='neighbor-restore'||action==='neighbor-restore-all'){const scroll=host.scrollTop,side=b.dataset.side;state.search.neighborExcluded={...state.search.neighborExcluded,[side]:action==='neighbor-restore-all'?[]:(state.search.neighborExcluded?.[side]||[]).filter(w=>w!==b.dataset.word)};contexts();host.scrollTop=scroll;}
    else if(action==='neighbor-close'){state.neighborDrill=null;contexts();}
    else if(action==='pc-export'){const t=pageChartTable();download(t.name,csv(t.rows),'text/csv');}
    else if(action==='pc-copy'){copyText(tsv(pageChartTable().rows),b.closest('.wb-menu')?.querySelector('.wb-menu-label'));}
    else if(action==='pt-compare'){ptCollect();patterns();}
    else if(action==='pt-add'){ptCollect();const m=state.patterns;if(m.list.length<PT_MAX)m.list.push('');patterns();document.getElementById('pt-p'+(m.list.length-1))?.focus();}
    else if(action==='pt-remove'){ptCollect();const m=state.patterns,i=+b.dataset.index;m.list.splice(i,1);m.pinned=m.pinned.filter(p=>p!==i).map(p=>p>i?p-1:p);patterns();}
    // swap two patterns (a column and its neighbour); pins follow their pattern, and the boxes and links take the new order
    else if(action==='pt-move'){ptCollect();const m=state.patterns,a=+b.dataset.index,z=+b.dataset.to;[m.list[a],m.list[z]]=[m.list[z],m.list[a]];m.pinned=m.pinned.map(p=>p===a?z:p===z?a:p);patterns();const again=[...document.querySelectorAll(`[data-action="pt-move"][data-index="${z}"]`)];(again.find(x=>x.dataset.dir===b.dataset.dir&&!x.disabled)||again.find(x=>!x.disabled))?.focus();}
    else if(action==='pt-pin'){ptCollect();const m=state.patterns,i=+b.dataset.index;m.pinned=m.pinned.includes(i)?m.pinned.filter(p=>p!==i):[...m.pinned,i].slice(-2);patterns();if(m.pinned.includes(i))document.getElementById('wb-patterns-chart')?.scrollIntoView({block:'nearest'});}
    else if(action==='pt-export'){const t=ptTable();download(t.name,csv(t.rows),'text/csv');}
    else if(action==='pt-copy'){copyText(tsv(ptTable().rows),b.closest('.wb-menu')?.querySelector('.wb-menu-label'));}
    else if(action==='neighbor-only'){
      // Toggle one spelling in this side's filter; filtering to a word re-includes it.
      const scroll=host.scrollTop,tableScroll=host.querySelector('.neighbor-breakdown .wb-scroll')?.scrollTop,{side,word}=b.dataset,words=new Set(onlyWords(side));
      words.has(word)?words.delete(word):words.add(word);
      state.search.neighborOnly={...state.search.neighborOnly,[side]:[...words]};
      if(words.has(word))state.search.neighborExcluded={...state.search.neighborExcluded,[side]:(state.search.neighborExcluded?.[side]||[]).filter(w=>w!==word)};
      state.contextPage=0;state.neighborPages={prev:0,next:0};state.neighborEvidence=null;contexts();
      const t=host.querySelector('.neighbor-breakdown .wb-scroll');if(t&&tableScroll!=null)t.scrollTop=tableScroll;host.scrollTop=scroll;
    }
    else if(action==='neighbor-group'){
      // One filter per group: the same button again removes it, the other button replaces it.
      const scroll=host.scrollTop,{side,mode,group:key,op}=b.dataset,same=g=>g.side===side&&g.mode===mode&&g.key===key;
      const had=groupFilters().some(g=>same(g)&&g.op===op),rest=groupFilters().filter(g=>!same(g));
      state.search.groupFilters=had?rest:[...rest,{side,mode,key,op}];
      state.contextPage=0;state.neighborPages={prev:0,next:0};state.neighborEvidence=null;contexts();host.scrollTop=scroll;
    }
    else if(action==='neighbor-only-clear'){const scroll=host.scrollTop;state.search.neighborOnly={};state.search.groupFilters=[];state.contextPage=0;state.neighborPages={prev:0,next:0};contexts();host.scrollTop=scroll;}
    else if(action==='context-swap'){collectSearch();const s=state.search;[s.section,s.compare]=[s.compare,s.section];if(s.compareQuery)[s.query,s.compareQuery]=[s.compareQuery,s.query||'*'];s.folio='';s.sheet='';contexts();}
    else if(action==='context-clear'){state.search={...state.search,prev2:'',prev:'',next:'',q:'any',nextQ:'any',position:'any',lineClass:'any',folio:'',sheet:'',neighborOnly:{},groupFilters:[],locus:'running'};state.contextPage=0;contexts();}
    else if(action==='context-next'||action==='context-back'){state.contextPage+=action.endsWith('next')?1:-1;contexts();}
    else if(action==='context-lab'&&!state.search.mergeQ){throw new Error('Rule lab uses q-merged forms. Tick Merge q in the search settings first, so spellings and contexts agree.');}
    else if(action==='context-export'){collectSearch();const rows=C.search(searchCorpus(state.search.section,state.search.mergeQ,state.search.locus),state.search);const only=[...['prev','next'].filter(side=>onlyWords(side).length).map(side=>side+'='+onlyWords(side).join('|')),...groupFilters().map(g=>`${g.side} ${g.mode}${g.op==='only'?'=':'!='}${g.key}`)].join(';');
      download('echo-contexts.csv',csv([['section','folio','locus','sheet','word','prev2','prev','next','q','paragraph_initial','merge_q','analyzed_form','neighbor_filter'],...rows.map(o=>[state.search.section,o.line.folio,o.line.locus,o.line.sheet,o.raw,o.prev2,o.prev,o.next,o.raw.startsWith('q'),o.line.first,state.search.mergeQ,o.word,only])]),'text/csv');contexts();}
    else if(action==='context-lab'){collectSearch();const s=state.search;const literal=C.literalWord(s.query);if(groupFilters().length)throw new Error('Rules cannot carry group filters. Use a Previous or Next word pattern such as !*y instead.');if(!literal)throw new Error('Choose an exact word in the forms table first, then use it in the rule lab. A search pattern alone does not specify a rewrite.');if(state.lab.rules.length>=30)throw new Error('Use at most 30 rules.');
      const carried={};
      for(const side of ['prev','next']){const words=onlyWords(side);if(!words.length)continue;
        if(words.some(w=>/^\(|[?*|]/.test(w)))throw new Error(`The ${sideWord(side)}-word filter includes a line boundary, unreadable gap or pattern character, which a rule context cannot express. Remove it from the filter first.`);
        const keep=words.filter(C.pattern(s[side]));if(!keep.length)throw new Error(`No filtered ${sideWord(side)} word also matches the ${side==='prev'?'Previous':'Next'} word pattern.`);carried[side]=keep.join('|');}
      state.lab.from=s.section;state.lab.to=s.compare;state.lab.rules.push({...defaults(),name:'Candidate from context search',from:literal,to:C.literalWord(s.compareQuery)||literal,fraction:0,...Object.fromEntries(contextKeys.map(k=>[k,s[k]])),...carried});state.result=null;save();go('lab');}
    else if(action==='rule-add'||action==='rule-known'){if(state.lab.rules.length>=30)throw new Error('Use at most 30 rules.');state.lab.rules.push({...defaults(),name:action==='rule-known'?'Catalog rule':'New candidate',kind:action==='rule-known'?'known':'exact',fraction:0});state.result=null;save();lab();}
    else if(action==='rule-remove'){state.lab.rules.splice(+b.dataset.index,1);state.result=null;save();lab();}
    else if(action==='lab-run'){state.result=null;document.getElementById('wb-lab-results').innerHTML='';state.result=C.simulate(corpus(state.lab.from),corpus(state.lab.to),state.lab.rules,W.known,window.ECHO_RULE_CATALOG?.routes);save();lab();document.getElementById('wb-lab-message').textContent='Experiment complete. All source occurrence mass reconciles.';}
    else if(action==='lab-export'){const r=state.result;download('echo-experiment.json',{schema:1,...state.lab,provenance:{catalog_reviewed:window.ECHO_RULE_CATALOG?.reviewed,catalog_sources:window.ECHO_RULE_CATALOG?.source_sha256,ledger_sha256:W.ledger_sha256,network_sha256:W.network_sha256,method:'Original occurrence branches; observed context; q preserved; reused corpus; no fitting.'},result:r?Object.fromEntries(Object.entries(r).filter(([k])=>k!=='examples')):null});}
    else if(action==='lab-import'){const text=document.getElementById('wl-import').value;if(text.length>1000000)throw new Error('Experiment JSON is too large.');const next=validate(JSON.parse(text));state.lab=next;state.result=null;save();lab();document.getElementById('wb-lab-message').textContent='Experiment loaded. Run to recalculate on this corpus snapshot.';}
  }
  // Links (view_state.js): per tab, the settings that make the view, as [object, {link parameter: [field, reader]}].
  // Exclusions and neighbor filters are not part of a link.
  function linkGroups(tab) {
    const R=window.EchoViewState.read,pops=populations.map(p=>p[0]),evals=Object.keys(W.residuals),text=v=>R.text(v),evalNo=v=>R.number(v,0,3);
    const pick=(...allowed)=>v=>R.oneOf(v,allowed);
    if(tab==='residuals')return [[state,{res:['resMode',pick('saved','rules','fit')],eval:['evaluation',v=>R.oneOf(v,evals)],side:['side',pick('target','source')],rq:['query',text],
      route:['route',pick('all','no','yes')],bin:['bin',v=>R.text(v,40)],rfrom:['resFrom',v=>R.oneOf(v,pops)],rto:['resTo',v=>R.oneOf(v,pops)],rcls:['resCls',pick('all','O','B','M','N')],
      fitcmp:['fitCompare',v=>/^(e1|defaults|minus:[\w.]+)$/.test(v)?v:undefined],fiteval:['fitEval',evalNo]}]];
    if(tab==='distribution')return [[state,{source:['chartSource',pick('saved','fit','lab')],eval:['evaluation',v=>R.oneOf(v,evals)],fiteval:['fitEval',evalNo]}],
      [state.distView,{dword:['word',v=>R.text(v,40)],dchanged:['changed',R.flag],dlabels:['labels',v=>{const x=R.oneOf(v,['0','12','30']);return x===undefined?undefined:+x;}],
        dmin:['min',v=>R.number(v,0,1e6)],dbasis:['basis',pick('either','both','source','target')]}]];
    if(tab==='contexts')return [
      [state.search,{q:['query',text],cq:['compareQuery',text],pop:['section',v=>R.oneOf(v,pops)],cpop:['compare',v=>R.oneOf(v,pops)],mode:['mode',pick('glob','related')],
        locus:['locus',v=>R.oneOf(v,Object.keys(LOCI))],mergeq:['mergeQ',R.flag],prev2:['prev2',text],prev:['prev',text],next:['next',text],pos:['position',pick('any','start','end','interior')],
        line:['lineClass',pick('any','first','body')],qf:['q',pick('any','yes','no')],nqf:['nextQ',pick('any','yes','no')],folio:['folio',v=>R.text(v,20)],sheet:['sheet',v=>R.text(v,20)]}],
      [state.pageChart,{group:['group',pick('section','regime','regimeSplit','regimeSplit2','rz','currier','hand','comparison')],unit:['unit',pick('page','paragraph','bifolium','quire')],chart:['layout',pick('combined','split','histogram')],
        show:['measure',pick('count','percent','per10k','perline')],order:['ordering',pick('manuscript','bifolium')],pattern:['pattern',pick('search','compare','both')],
        bins:['bins',pick('auto','6','12','24','48')],range:['range',pick('clip','full')],zeros:['zeros',pick('show','hide')]}],
      [state,{neighbors:['neighborMode',pick('edges','gallows','word')],rates:['percentMode',pick('baseline','conditional','section')],signals:['signalFilter',pick('all','any','section','selection','shared','both')]}]];
    if(tab==='patterns')return [[state.patterns,{locus:['locus',v=>R.oneOf(v,Object.keys(LOCI))],mergeq:['mergeQ',R.flag],prev2:['prev2',text],prev:['prev',text],next:['next',text],
      pos:['position',pick('any','start','end','interior')],line:['lineClass',pick('any','first','body')],qf:['q',pick('any','yes','no')],nqf:['nextQ',pick('any','yes','no')],
      group:['group',pick('section','regime','regimeSplit','regimeSplit2','rz','currier','hand')],show:['measure',pick('count','percent','per10k','perline')],unit:['unit',pick('page','paragraph','bifolium','quire')],
      chart:['layout',pick('combined','split','histogram')],order:['ordering',pick('manuscript','bifolium')],bins:['bins',pick('auto','6','12','24','48')],range:['range',pick('clip','full')],zeros:['zeros',pick('show','hide')],bars:['barScale',pick('table','column')]}]];
    return [];
  }
  // Pattern boxes show their reading as you type
  host.addEventListener('input',e=>{const box=e.target;if(!box.classList?.contains('wb-pattern'))return;const out=document.getElementById(box.id+'-reading');if(out)out.innerHTML=reading(box.value,box.dataset.scope);});
  // Export menus close on a click outside them or on Escape
  document.addEventListener('pointerdown',e=>{document.querySelectorAll('.wb-menu[open]').forEach(d=>{if(!d.contains(e.target))d.open=false;});});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.wb-menu[open]').forEach(d=>{d.open=false;d.querySelector('summary').focus();});});
  window.EchoWorkbench={
    view(tab){const out={};for(const [target,fields] of linkGroups(tab))for(const [name,[field]] of Object.entries(fields)){const v=target[field];if(v!==''&&v!=null)out[name]=v;}if(tab==='patterns')Object.assign(out,ptLink());
      const g=tab==='patterns'?state.patterns:tab==='contexts'?state.pageChart:null,hide=g&&(g.hidden[g.group]||[]);if(hide&&hide.length)out.hide=hide;return out;},
    applyView(tab,params){let n=0;for(const [target,fields] of linkGroups(tab))n+=window.EchoViewState.assign(target,params,fields).length;if(tab==='patterns')n+=ptApply(params);
      const g=tab==='patterns'?state.patterns:tab==='contexts'?state.pageChart:null,hide=g&&window.EchoViewState.read.list(params.hide);if(hide){g.hidden={...g.hidden,[g.group]:hide};n++;}state.residualPage=0;state.neighborPages={prev:0,next:0};
      if(params.at==='pages')state.pageChart.open=true;
      state.autoFit=(tab==='distribution'&&state.chartSource==='fit')||(tab==='residuals'&&state.resMode==='fit');
      return n;},
    addCatalogRule(code){if(!W.known[code])throw new Error('This finding needs the research sequence model.');if(state.lab.rules.length>=30)throw new Error('Use at most 30 rules.');state.lab.rules.push({...defaults(),name:D.rules.find(r=>r.code===code)?.name||code,kind:'known',code,fraction:0});state.result=null;save();go('lab');},
    leave(){chartGeneration++;if(state.tab==='distribution')host.replaceChildren();},
    show(tab){state.tab=tab;try{if(tab==='residuals')residuals();else if(tab==='distribution')distribution();else if(tab==='contexts')contexts();else if(tab==='patterns')patterns();else lab();}catch(error){reportError(error);}
      // a link to a fitted view fits on arrival (a fresh browser has no fit yet)
      if(state.autoFit){state.autoFit=false;if(!(state.fit&&state.fit.signature===fitSignature()))act('fit-run');}}
  };
  // Evidence links are already rendered before these larger workbench assets load.
  if(window.EchoViewState.decode(location.hash)?.tab!=='evidence')go('residuals');
})();
