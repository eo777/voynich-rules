/* Echo7: observed line candidates and logged generator ancestry.
 * Rendering only. The exported study owns eligibility, donor windows and controls.
 * Never convert an observed spelling relation into a historical parent claim. */
(function (root) {
  'use strict';
  const state = {corpus: 'manuscript', rule: 'CHOL_SHOL', scope: 'normalPage', frequency: 'all', event: '', chance: true, supported: false, namedEdge: '', namedStage: '2a', namedEvent: ''};
  const STAGES = ['1b', '1.5a', '2a'];
  const SCOPES = [['normalPage', 'Generator’s usual page pool'], ['local3', 'Previous 3 lines'], ['local10', 'Previous 10 lines'], ['page', 'Earlier on this page'], ['history', 'Earlier stage + earlier page lines']];
  const FREQ = [['all', 'All eligible words'], ['1', 'Section hapaxes'], ['2-9', '2–9 in section'], ['10+', '10+ in section']];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const num = v => Number(v || 0).toLocaleString('en-US');
  const percent = (k, n, digits = 0) => n ? `${(100 * k / n).toFixed(digits)}%` : '—';
  const countOf = e => Number(e.sectionCount ?? e.count ?? e.target?.sectionCount ?? 0);
  const isNew = e => e.innovative !== undefined ? !!e.innovative : e.isNew !== undefined ? !!e.isNew : e.new !== undefined ? !!e.new : /e/.test(String(e.variant ?? ''));
  const isHapax = e => countOf(e) === 1;
  const stageOf = e => String(e.stage ?? e.target?.stage ?? '');
  const wordOf = e => e.word ?? e.target?.word ?? '';
  const idOf = e => String(e.id);
  const location = t => t ? `${t.page || ''}${t.locus != null ? ':' + t.locus : ''}${t.tokenIndex != null ? ' · word ' + (Number(t.tokenIndex) + 1) : ''}` : '';
  let host = null, back = null, bifoliumView = null;
  let manuscriptSelection = {event: 'f88r:13:2', rule: 'CHOL_SHOL', scope: 'normalPage'};

  function datasets() {
    const d = root.ECHO_COPYING_TRACE_DATA || {};
    return {manuscript: d.manuscript, generator: d.generator || root.ECHO_COPYING_TRACE_GENERATOR_DATA?.generator || root.ECHO_COPYING_TRACE_GENERATOR_DATA};
  }
  function frequency(e, key) {
    const n = countOf(e);
    return key === 'all' || (key === '1' && n === 1) || (key === '2-9' && n >= 2 && n < 10) || (key === '10+' && n >= 10);
  }
  function inRule(e, rule) {
    const rs = e.ruleIds || e.rules;
    if (Array.isArray(rs)) return rs.includes(rule);
    if (e.ruleId || e.rule) return (e.ruleId || e.rule) === rule;
    return rule === 'CHEO';
  }
  function support(e, scope = state.scope) {
    const s = e.supports || {};
    if (s[scope] !== undefined) return !!s[scope];
    if (e.sources && Object.hasOwn(e.sources, scope)) return !!e.sources[scope];
    return !!sourceOf(e, scope);
  }
  function distance(t) { const v = t?.distance ?? t?.lineDistance ?? t?.lineDist; return v == null ? NaN : Number(v); }
  function sourceOf(e, scope = state.scope) {
    if (e.sources && Object.hasOwn(e.sources, scope)) return e.sources[scope];
    const cand = [...(e.candidates || []), ...(e.source ? [e.source] : [])];
    const local = n => cand.find(t => t.page === (e.page || e.target?.page) && distance(t) >= 0 && distance(t) <= n);
    if (scope === 'local3') return local(3) || null;
    if (scope === 'local10') return local(10) || null;
    if (scope === 'page' || scope === 'normalPage') return cand.find(t => t.page === (e.page || e.target?.page)) || null;
    return e.historySource || cand[0] || null;
  }
  function laterOf(e) { return e.later || e.descendants || []; }
  function model() {
    const d = datasets()[state.corpus];
    if (!d) return null;
    const rules = d.rules || [{id: 'CHEO', label: 'Bench + o: e insertion'}];
    if (!rules.some(r => r.id === state.rule)) state.rule = rules[0]?.id || 'CHEO';
    const all = (d.events || []).filter(e => inRule(e, state.rule));
    const visible = all.filter(e => frequency(e, state.frequency) && (!state.supported || support(e)));
    let selected = visible.find(e => idOf(e) === state.event);
    if (!selected) selected = visible.find(e => !state.event && !state.supported && state.corpus === 'manuscript' && idOf(e) === 'f88r:13:2') || visible.find(e => state.corpus === 'generator' && isNew(e) && sourceOf(e)?.word !== wordOf(e) && support(e) && laterOf(e).length) || visible.find(e => support(e) && laterOf(e).length && isNew(e)) || visible.find(e => support(e)) || visible[0];
    state.event = selected ? idOf(selected) : '';
    return {d, rules, rule: rules.find(r => r.id === state.rule), stages: d.stages || STAGES, all, visible, selected, generated: state.corpus === 'generator'};
  }
  const options = (items, v) => items.map(([k, name]) => `<option value="${esc(k)}" ${k === v ? 'selected' : ''}>${esc(name)}</option>`).join('');
  function controlOf(x, stage, frequency = state.frequency) {
    return (x.d.controls || []).find(c => c.stage === stage && c.rule === state.rule && c.frequency === frequency)?.details?.[state.scope] || null;
  }
  function toolbar(x) {
    return `<section class="wb-card ct-toolbar">
      <div class="ct-field"><label for="ct-rule">Rule family</label><select id="ct-rule">${options(x.rules.map(r => [r.id, r.label || r.id]), state.rule)}</select></div>
      <div class="ct-field"><label for="ct-scope">${x.generated ? 'Logged parent window' : 'Candidate donor window'}</label><select id="ct-scope">${options(SCOPES, state.scope)}</select></div>
      <div class="ct-field"><label for="ct-frequency">Word frequency</label><select id="ct-frequency">${options(FREQ, state.frequency)}</select></div>
      <label class="ct-check"><input type="checkbox" id="ct-supported" ${state.supported ? 'checked' : ''}> Show ${x.generated ? 'linked events' : 'supported candidates'} only</label>
      <label class="ct-check"><input type="checkbox" id="ct-chance" ${state.chance ? 'checked' : ''}> Show direction / chance controls</label>
      <button class="wb-button" id="ct-jump-detail">Show manuscript bifolium ↓</button>
      ${x.generated ? '<div class="ct-quick"><span>Logged examples</span><button class="wb-button" data-ct-example="g1:3400">E gain through a prefixed form</button><button class="wb-button" data-ct-example="g1:103">pchey → cheol</button><button class="wb-button" data-ct-example="g1:1020">cheol preserved</button></div>' : ''}
    </section>`;
  }
  function stageSummary(x) {
    return `<div class="ct-summary">${x.stages.map(stage => {
      const all = x.all.filter(e => stageOf(e) === stage), use = all.filter(e => frequency(e, state.frequency));
      const k = use.filter(isNew).length, n = use.length, s = use.filter(e => support(e)).length, ctl = state.chance && !x.generated ? controlOf(x, stage) : null;
      const rates = [['all', 'All'], ['1', 'Hapax'], ['10+', '10+']].map(([f, label]) => {
        const a = all.filter(e => frequency(e, f)), yes = a.filter(isNew).length;
        return `<div class="ct-rate"><span>${label} · ${num(a.length)}</span><span class="ct-bar"><i style="width:${a.length ? 100 * yes / a.length : 0}%"></i></span><span class="ct-number">${percent(yes, a.length)}</span></div>`;
      }).join('');
      return `<section class="ct-stage"><h3>${esc(stage)} <span>${x.generated ? 'generator block' : stage === '1b' ? 'Early A' : stage === '1.5a' ? 'Transitional A' : 'Late A / Pharma'}</span></h3><div class="ct-total"><b>${percent(k, n)}</b><span>e-bearing · ${num(k)} / ${num(n)} selected tokens</span></div>${rates}<div class="ct-metrics"><div class="ct-rate ct-support"><span>${x.generated ? 'Parent' : 'Donor'} found</span><span class="ct-bar"><i style="width:${n ? 100 * s / n : 0}%"></i>${ctl && n ? `<em style="left:${Math.min(100, 100 * ctl.mean / n)}%" title="Shuffled line order: ${ctl.mean.toFixed(1)} expected"></em>` : ''}</span><span class="ct-number">${num(s)}/${num(n)}</span></div>${ctl ? `<p class="ct-small">Shuffled line order: ${ctl.mean.toFixed(1)} donors expected (${ctl.low}–${ctl.high}).</p>` : ''}</div></section>`;
    }).join('')}</div>`;
  }
  function coords(x) {
    const W = 1000, left = 42, right = 18, segment = (W - left - right) / x.stages.length;
    const positions = new Map();
    x.stages.forEach((stage, si) => {
      const all = x.all.filter(e => stageOf(e) === stage);
      const max = Math.max(1, ...all.map(e => Number(e.displayPosition ?? e.position ?? e.target?.position ?? e.target?.lineSeq ?? e.lineSeq ?? 0)));
      all.forEach((e, i) => {
        const pos = Number(e.displayPosition ?? e.position ?? e.target?.position ?? e.target?.lineSeq ?? e.lineSeq ?? i);
        const fraction = all.some(t => t.position != null || t.target?.position != null || t.target?.lineSeq != null) ? pos / max : i / Math.max(1, all.length - 1);
        const lane = isNew(e) ? 0 : 1, band = isHapax(e) ? 1 : 0;
        positions.set(idOf(e), {x: left + si * segment + 12 + Math.max(0, Math.min(1, fraction)) * (segment - 28), y: 66 + lane * 61 + band * 20 + (i % 3 - 1) * 4});
      });
    });
    return {W, left, right, segment, positions};
  }
  function eventMap(x) {
    const c = coords(x), H = 201, selected = x.selected && c.positions.get(idOf(x.selected));
    const parts = [`<svg viewBox="0 0 ${c.W} ${H}" role="img" aria-label="Eligible words in the order of the three stages. Select a point to read its line.">`];
    x.stages.forEach((stage, i) => {
      const start = c.left + i * c.segment;
      if (i) parts.push(`<line class="ct-grid" x1="${start - 6}" x2="${start - 6}" y1="18" y2="178"/>`);
      parts.push(`<text class="ct-svg-stage" x="${start + 11}" y="21">${esc(stage)}</text><text x="${start + c.segment - 22}" y="21" text-anchor="end">${x.generated ? 'generation' : 'page display order'} →</text>`);
      parts.push(`<line class="ct-grid" x1="${start + 7}" x2="${start + c.segment - 18}" y1="100" y2="100"/>`);
    });
    parts.push('<text x="2" y="73">e</text><text x="2" y="134">no e</text>');
    if (selected) parts.push(`<rect class="ct-focus" x="${selected.x - 7}" y="39" width="14" height="120" rx="5"/>`);
    for (const e of x.visible) {
      const p = c.positions.get(idOf(e)); if (!p) continue;
      const cls = `ct-event ${isNew(e) ? 'new' : ''} ${isHapax(e) ? 'hapax' : ''} ${support(e) ? 'candidate' : ''} ${idOf(e) === state.event ? 'selected' : ''}`;
      const title = `${wordOf(e)} · ${location(e.target || e)} · ${stageOf(e)} · ${countOf(e)} in section${support(e) ? x.generated ? ' · logged parent in window' : ' · opposite-variant donor in window' : ''}`;
      const attrs = `class="${cls}" data-ct-event="${esc(idOf(e))}" tabindex="0" role="button" aria-label="${esc(title)}"`;
      parts.push(isHapax(e) ? `<rect ${attrs} x="${p.x - 3}" y="${p.y - 3}" width="6" height="6"><title>${esc(title)}</title></rect>` : `<circle ${attrs} cx="${p.x}" cy="${p.y}" r="${idOf(e) === state.event ? 5 : 3.4}"><title>${esc(title)}</title></circle>`);
    }
    if (selected) {
      for (const t of laterOf(x.selected)) {
        const e = x.all.find(e => (t.id != null && idOf(e) === String(t.id)) || (wordOf(e) === t.word && location(e.target || e) === location(t)));
        const p = e && c.positions.get(idOf(e)); if (!p || p.x <= selected.x) continue;
        parts.push(`<path class="ct-link" d="M ${selected.x} ${selected.y} Q ${(selected.x + p.x) / 2} 8 ${p.x} ${p.y}"/><circle class="ct-dotlater" cx="${p.x}" cy="${p.y}" r="4"/>`);
      }
      if (x.generated && x.selected.lineage?.length) {
        const chain = x.selected.lineage;
        for (let i = 1; i < chain.length; i++) {
          const a = c.positions.get(String(chain[i - 1].id)), b = c.positions.get(String(chain[i].id));
          if (!a || !b) continue;
          parts.push(`<path class="ct-link ct-known-link" d="M ${a.x} ${a.y} Q ${(a.x + b.x) / 2} 27 ${b.x} ${b.y}"><title>Logged ancestry: ${esc(chain[i - 1].word)} → ${esc(chain[i].word)}</title></path><circle class="ct-dotlater" cx="${b.x}" cy="${b.y}" r="4"/>`);
        }
      }
    }
    parts.push(`<text x="42" y="190">${x.generated ? 'Each point is one generated token, in generation order.' : 'Each point is one eligible token. Stage order is assumed; page display order within a stage is not a chronology.'}</text></svg>`);
    return `<section class="wb-card ct-map"><div class="ct-card-title"><h3>Where the forms occur</h3><p>${num(x.visible.length)} of ${num(x.all.length)} eligible tokens shown · select a point</p></div><div class="ct-legend"><span><i class="new"></i>e-bearing</span><span><i></i>without e</span><span><i class="ring"></i>${x.generated ? 'logged parent' : 'opposite-variant candidate'} in window</span><span><i class="hapax"></i>section hapax</span><span>green link: ${x.generated ? 'logged descendant' : 'later same spelling'}</span></div><div class="ct-scroll">${parts.join('')}</div></section>`;
  }
  function lineCard(t, role, title, note = '') {
    if (!t) return '';
    let words = t.words || t.tokens || [];
    if (typeof words === 'string') words = words.split(/\s+/);
    const wi = Number(t.tokenIndex ?? t.positionInLine ?? -1);
    const text = words.map((w, i) => { const word = typeof w === 'object' ? w.word || w.w : w; return i === wi ? `<mark>${esc(word)}</mark>` : `<span>${esc(word)}</span>`; }).join('');
    return `<section class="ct-linecard ${role}"><header><b>${esc(title)}</b><span>${esc(location(t))}${/^G\d/.test(t.page || '') && t.lineSeq ? ' · generated line ' + esc(t.lineSeq) : ''}${t.stage ? ' · ' + esc(t.stage) : ''}${note ? ' · ' + esc(note) : ''}</span></header><div class="ct-words">${text || `<mark>${esc(t.word || '')}</mark>`}</div></section>`;
  }
  function detail(x) {
    const e = x.selected;
    if (!e) return '<section class="wb-card ct-detail"><div class="ct-empty">No eligible events match these filters.</div></section>';
    const source = sourceOf(e), target = e.target || e, later = laterOf(e), next = later[0];
    const d = distance(source), known = x.generated;
    const fullLineage = known ? e.lineage || [] : [], selectedIndex = fullLineage.findIndex(t => t.id === e.id);
    const hasLineage = selectedIndex >= 0;
    const sequence = hasLineage ? `<div class="ct-path">${fullLineage.map((t,i)=>`${i ? '<span>→</span>' : ''}<code class="${i < selectedIndex ? 'old' : i === selectedIndex ? 'new' : 'keep'}">${esc(t.word)}</code>`).join('')}</div>` : `<div class="ct-path">${source ? `<code class="old">${esc(source.word)}</code><span>${known ? 'copied / edited →' : 'candidate →'}</span>` : ''}<code class="new">${esc(wordOf(e))}</code>${next ? `<span>${known ? 'descendant →' : 'later occurrence →'}</span><code class="keep">${esc(next.word || wordOf(e))}</code>` : ''}</div>`;
    const noSource = known ? 'No logged parent in this window. A token may use an older source or a synthetic prototype.' : 'No earlier opposite-variant word in the selected donor window. This is an observed gap in this particular copying route.';
    const sourceNote = Number.isFinite(d) ? `${d} line${d === 1 ? '' : 's'} earlier` : '';
    const provenance = known ? `The parent link is recorded by the instrumented generator. ${e.exactVariantChange ? 'This is a direct same-frame e / no-e change.' : 'This parent relation is not a direct same-frame e / no-e change.'}` : 'This is a same-frame spelling candidate, not an identified historical source or a guarantee that the generator accepts this edit. The manuscript records spellings and positions, not the act of copying.';
    const laterTitle = known ? '3 · Recorded descendant' : '3 · Later same spelling';
    const alternatives = (e.candidates || []).filter(t => t !== source).slice(0, 3);
    const future = e.future || [];
    return `<section class="wb-card ct-detail"><div class="ct-card-title"><h3>${esc(location(target))} · <code>${esc(wordOf(e))}</code></h3><span class="ct-badge ${isHapax(e) ? '' : 'new'}">${isHapax(e) ? 'section hapax' : countOf(e) + ' in section'}</span></div><p class="ct-detail-sub">${esc(stageOf(e))} · frame ${esc(e.family || '—')} · ${isNew(e) ? 'e-bearing variant' : 'variant without e'}${e.sourceClass ? ' · previous-stage family: ' + esc(e.sourceClass) : ''}</p>${known && (e.mode || e.method) ? `<p class="ct-small"><b>Recorded operation:</b> ${esc(e.method || 'copy')} · ${esc(e.mode || '')}</p>` : ''}${e.description || e.lineageDescription ? `<p class="ct-small">${esc(e.description || e.lineageDescription)}</p>` : ''}${sequence}
      ${hasLineage ? fullLineage.map((t,i)=>lineCard(t, i < selectedIndex ? 'source' : i === selectedIndex ? 'target' : 'later', `${i + 1} · ${i < selectedIndex ? 'Recorded ancestor' : i === selectedIndex ? 'E-bearing form created' : 'Recorded descendant'}`, [t.method,t.mode].filter(Boolean).join(' · '))).join('') : `${source ? lineCard(source, 'source', known ? '1 · Logged parent' : '1 · Earlier candidate donor', sourceNote) : `<div class="ct-empty">${noSource}</div>`}${lineCard(target, 'target', known ? '2 · Generated token' : '2 · Observed target')}${next ? lineCard(next, 'later', laterTitle) : `<div class="ct-empty">${known ? 'No exported later descendant for this event.' : 'No later attestation of this exact spelling in the three-stage window.'}</div>`}`}
      <p class="ct-small">${provenance} ${known ? '' : next ? 'A later occurrence establishes persistence of the spelling, not descent from this particular token.' : 'Absence of a later occurrence does not establish that an underlying word disappeared.'}</p>
      ${later.length > 1 ? `<details><summary>${hasLineage ? 'Other exported descendant lines' : (later.length - 1) + ' more ' + (known ? 'descendant lines' : 'later attestations')}</summary>${later.slice(hasLineage ? 0 : 1).map(t => lineCard(t, 'later', known ? 'Recorded descendant' : 'Later same spelling')).join('')}</details>` : ''}
      ${known && e.otherParents?.length ? `<details><summary>Other recorded parents</summary>${e.otherParents.map(t => lineCard(t, 'source', 'Additional recorded parent')).join('')}</details>` : ''}
      ${!known && alternatives.length ? `<details><summary>Other earlier candidates</summary>${alternatives.map(t => lineCard(t, 'source', 'Alternative donor', Number.isFinite(distance(t)) ? distance(t) + ' lines earlier' : '')).join('')}</details>` : ''}
      ${!known && state.chance ? `<details><summary>Direction control: similar forms after the target</summary><p class="ct-small">Future words cannot be donors under this order. Similarity in both directions tests how much a nearby match can arise from local vocabulary alone.</p>${future.length ? future.slice(0, 3).map(t => lineCard(t, 'source', 'Future comparison', Number.isFinite(distance(t)) ? Math.abs(distance(t)) + ' lines later' : '')).join('') : '<p class="ct-small">No exported future opposite-variant candidate in the control window.</p>'}</details>` : ''}
    </section>`;
  }
  function list(x) {
    // The map carries every token. Keep the list bounded without hiding where selection sits.
    const sorted = x.visible.slice().sort((a, b) => x.stages.indexOf(stageOf(a)) - x.stages.indexOf(stageOf(b)) || Number(a.displayPosition ?? a.position ?? 0) - Number(b.displayPosition ?? b.position ?? 0));
    const chosen = sorted.findIndex(e => idOf(e) === state.event), from = Math.max(0, Math.min(chosen - 35, sorted.length - 160));
    const a = sorted.slice(from, from + 160);
    return `<section><div class="ct-card-title"><h3>Read the line evidence</h3><p>${num(x.visible.length)} tokens</p></div><div class="ct-list">${a.map(e => `<button data-ct-event="${esc(idOf(e))}" class="${idOf(e) === state.event ? 'on' : ''}" aria-pressed="${idOf(e) === state.event}"><span class="ct-event-top"><b>${esc(wordOf(e))}</b><span class="ct-badge ${support(e) ? 'keep' : ''}">${support(e) ? x.generated ? 'parent found' : 'candidate found' : 'no donor'}</span></span><small>${esc(stageOf(e))} · ${esc(location(e.target || e))} · ${isHapax(e) ? 'hapax' : countOf(e) + ' in section'}${laterOf(e).length ? ' · later ' + (x.generated ? 'descendant' : 'attested') : ''}</small></button>`).join('') || '<div class="ct-empty">No events match.</div>'}</div>${x.visible.length > a.length ? `<p class="ct-small">Showing ${from + 1}–${from + a.length} of ${num(x.visible.length)} near the selected event. Every event remains selectable in the map.</p>` : ''}</section>`;
  }
  function controlTable(x) {
    if (!state.chance || x.generated) return '';
    const windowKey = state.scope === 'local10' ? 'future10' : state.scope === 'local3' ? 'future3' : null;
    return `<section class="wb-card ct-method"><div class="ct-card-title"><h3>Does the direction add evidence?</h3><p>Counts use exactly the selected rule and frequency class</p></div><div class="ct-metrics"><table><thead><tr><th>Stage</th><th>Eligible</th><th>Earlier donor</th><th>Shuffled mean (95% interval)</th><th>${windowKey ? 'Future counterpart' : 'Later same spelling'}</th></tr></thead><tbody>${x.stages.map(stage => { const a = x.all.filter(e => stageOf(e) === stage && frequency(e, state.frequency)); const prior = a.filter(e => support(e)).length, future = windowKey ? a.filter(e => !!e.supports?.[windowKey]).length : null, later = a.filter(e => laterOf(e).length).length, ctl = controlOf(x, stage); return `<tr><td>${esc(stage)}</td><td>${num(a.length)}</td><td>${num(prior)} · ${percent(prior, a.length, 1)}</td><td>${ctl ? `${ctl.mean.toFixed(1)} (${ctl.low}–${ctl.high})` : 'Not available for this window'}</td><td>${future == null ? num(later) + ' · ' + percent(later, a.length, 1) : num(future) + ' · ' + percent(future, a.length, 1)}</td></tr>`; }).join('')}</tbody></table></div><p class="ct-small">The shuffle preserves page vocabulary and opening lines, then permutes continuation lines (1,000 runs). Its interval describes the shuffled count, not uncertainty in the manuscript’s count. The future comparison is a direction control, not a probability of copying. Section hapaxes cannot repeat in their own section by definition; their observed match rate need not equal the rate among common words, even if edits are frequency-blind.</p></section>`;
  }
  function preservation(x) {
    const p = x.d.preservation;
    if (!p?.rows || x.generated) return '';
    const rows = p.rows.filter(r => ['1', '2-9', '10+', 'all'].includes(r.priorClass));
    return `<section class="wb-card ct-method"><div class="ct-card-title"><h3>After the first e-bearing form: is it preserved?</h3><p>All CHEO frames · fixed ${p.horizonLines || 3}-line follow-up</p></div><p class="ct-small">Start at the first e-bearing token of each frame on each page, with enough lines remaining to observe the follow-up. Classify frequency using only the frame’s earlier tokens on that page. This avoids defining a hapax by its failure to repeat.</p><div class="ct-preservation">${x.stages.map(stage => { const r = rows.find(r => r.stage === stage && r.priorClass === 'all'); if (!r) return ''; return `<div><b>${esc(stage)}</b><strong>${percent(r.repeat, r.n, 1)}</strong><span>${r.repeat} / ${r.n} exact spellings recur</span><small>${r.variantRepeat} e-bearing variants recur; ${r.oldReturns} earlier variants return.</small></div>`; }).join('')}</div><details><summary>Breakdown by frequency before the first e-bearing token</summary><div class="ct-metrics"><table><thead><tr><th>Stage · prior tokens</th><th>First e-bearing events</th><th>Exact spelling recurs</th><th>Earlier variant returns</th></tr></thead><tbody>${p.rows.filter(r => r.priorClass !== 'all').map(r => `<tr><td>${esc(r.stage)} · ${esc(r.priorClass)}</td><td>${r.n}</td><td>${r.repeat} · ${percent(r.repeat, r.n, 1)}</td><td>${r.oldReturns} · ${percent(r.oldReturns, r.n, 1)}</td></tr>`).join('')}</tbody></table></div></details></section>`;
  }
  function namedForms(x) {
    if (!x.d.namedCounts?.length) return '';
    const groups = [['chol / shol', ['chol', 'shol', 'chor', 'shor']], ['cheol / sheol', ['cheol', 'sheol', 'cheor', 'sheor']], ['cheo / sheo', ['cheo', 'sheo']], ['chey / shey', ['chey', 'shey']], ['chedy / shedy', ['chedy', 'shedy']]];
    return `<section class="wb-card ct-method"><div class="ct-card-title"><h3>The named sequence in the copying account</h3><p>Exact spelling counts · each box is a different proposed step</p></div><div class="ct-named">${groups.map(([name, words]) => `<div><h4>${esc(name)}</h4>${x.stages.map(stage => `<p><span>${esc(stage)}</span><b>${words.reduce((a, w) => a + Number(x.d.namedCounts.find(r => r.word === w)?.counts?.[stage] || 0), 0)}</b></p>`).join('')}<small>${words.map(esc).join(', ')}</small></div>`).join('')}</div><p class="ct-small">These counts show which named forms are present in each section. They are not copied-token flows: e insertion, liquid loss, o → y and d insertion are different changes. The line explorer above tests the e / no-e step while holding the full remaining frame fixed.</p>${namedExplorer(x)}</section>`;
  }
  function namedExplorer(x) {
    const chain = x.d.namedChain; if (!chain?.edges?.length) return '';
    const key = e => e.source + '>' + e.target;
    if (!chain.edges.some(e => key(e) === state.namedEdge)) state.namedEdge = key(chain.edges[0]);
    const edge = chain.edges.find(e => key(e) === state.namedEdge);
    const events = chain.events.filter(e => e.sourceWord === edge.source && e.targetWord === edge.target && stageOf(e) === state.namedStage && e.forward);
    let selected = events.find(e => idOf(e) === state.namedEvent);
    const window = state.scope === 'normalPage' && !events.some(e => Object.hasOwn(e.sources || {}, 'normalPage')) ? 'page' : state.scope;
    if (!selected) selected = events.find(e => idOf(e) === `${state.namedEdge}:f88r:13:2`) || events.find(e => support(e, window) && laterOf(e).length) || events.find(e => support(e, window)) || events[0];
    state.namedEvent = selected ? idOf(selected) : '';
    const source = selected && sourceOf(selected, window);
    return `<details class="ct-chain-explorer"><summary>Inspect a named step line by line</summary><div class="ct-toolbar"><div class="ct-field"><label for="ct-named-edge">Proposed step</label><select id="ct-named-edge">${options(chain.edges.map(e => [key(e), `${e.source} → ${e.target} · ${e.operation}`]), state.namedEdge)}</select></div><div class="ct-field"><label for="ct-named-stage">Target section</label><select id="ct-named-stage">${options(x.stages.map(s => [s, s]), state.namedStage)}</select></div><div class="ct-field"><label for="ct-named-event">Observed target</label><select id="ct-named-event">${options(events.map(e => [idOf(e), `${location(e.target)} · ${wordOf(e)}`]), state.namedEvent)}</select></div></div><p class="ct-small">${num(events.length)} target tokens; ${num(events.filter(e => support(e, window)).length)} with the proposed source in ${esc(SCOPES.find(s => s[0] === window)?.[1]?.toLowerCase() || window)}. A candidate at one step does not establish the whole sequence.</p>${selected ? `${source ? lineCard(source, 'source', 'Earlier candidate: ' + edge.source) : '<div class="ct-empty">No candidate source in this window.</div>'}${lineCard(selected.target, 'target', 'Observed target: ' + edge.target)}${laterOf(selected)[0] ? lineCard(laterOf(selected)[0], 'later', 'Later same spelling') : '<div class="ct-empty">No later same-spelling attestation in the exported window.</div>'}` : '<div class="ct-empty">This target spelling is absent from this section.</div>'}</details>`;
  }
  function replicates(x) {
    if (!x.generated || !x.d.replicateSummary?.length) return '';
    const W = 740, H = 205, L = 48, T = 20, B = 36, R = 75;
    const xs = x.stages.map((_, i) => L + i * (W - L - R) / Math.max(1, x.stages.length - 1));
    const yy = s => T + (H - T - B) * (1 - s);
    const observed = x.stages.map(stage => datasets().manuscript?.stats?.find(s => s.stage === stage && s.rule === 'CHEO' && s.frequency === 'all'));
    const svg = [`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Eight fixed-policy generator trajectories compared with manuscript e-bearing shares">`];
    for (const t of [0, .25, .5, .75, 1]) svg.push(`<line class="ct-grid" x1="${L}" x2="${W-R+4}" y1="${yy(t)}" y2="${yy(t)}"/><text x="${L-10}" y="${yy(t)+4}" text-anchor="end">${t*100}%</text>`);
    for (const r of x.d.replicateSummary) {
      const pts = x.stages.map((stage, i) => { const a = r.rates.find(a => a.stage === stage); return a?.n ? `${xs[i]},${yy(a.k/a.n)}` : ''; }).filter(Boolean).join(' ');
      svg.push(`<polyline class="ct-replicate ${r.seed === x.d.seed ? 'selected' : ''}" points="${pts}"><title>Seed ${r.seed}: ${r.rates.map(a => percent(a.k,a.n,1)).join(' → ')}; ${r.exactSameFrameChange} direct same-frame changes</title></polyline>`);
    }
    if (observed.every(Boolean)) {
      svg.push(`<polyline class="ct-observed" points="${observed.map((s,i)=>`${xs[i]},${yy(s.k/s.n)}`).join(' ')}"/>`);
      observed.forEach((s,i)=>svg.push(`<circle class="ct-observed-dot" cx="${xs[i]}" cy="${yy(s.k/s.n)}" r="4"/><text x="${xs[i]}" y="${yy(s.k/s.n)-11}" text-anchor="middle">${percent(s.k,s.n,1)}</text>`));
    }
    x.stages.forEach((s,i)=>svg.push(`<text x="${xs[i]}" y="${H-9}" text-anchor="middle">${esc(s)}</text>`));
    svg.push('</svg>');
    return `<section class="wb-card ct-method"><div class="ct-card-title"><h3>Does a fixed policy reproduce the section gradient?</h3><p>All eligible CHEO tokens · eight seeds · matched block sizes</p></div><div class="ct-replicates">${svg.join('')}</div><div class="ct-legend"><span><i class="new"></i>manuscript</span><span><i></i>seed ${esc(x.d.seed)} shown above</span><span>thin grey: other fixed-policy runs</span></div><p class="ct-small">Each run starts from the same source and keeps policy ${esc(x.d.policy || 'A')} throughout. Block labels align token counts with the manuscript; they do not change generator rules. Eight runs are a descriptive check, not a fitted probability of the full manuscript pattern.</p><details><summary>Exact rates and direct edit counts</summary><div class="ct-metrics"><table><thead><tr><th>Seed</th>${x.stages.map(s=>`<th>${esc(s)}</th>`).join('')}<th>Eligible tokens</th><th>Direct same-frame e changes</th></tr></thead><tbody>${x.d.replicateSummary.map(r=>`<tr><td>${r.seed}</td>${x.stages.map(s=>{const a=r.rates.find(a=>a.stage===s);return `<td>${a?`${a.k}/${a.n} · ${percent(a.k,a.n,1)}`:'—'}</td>`;}).join('')}<td>${num(r.eligible)}</td><td>${num(r.exactSameFrameChange)}</td></tr>`).join('')}</tbody></table></div></details></section>`;
  }
  function methods(x) {
    return `<section class="wb-card ct-method"><details><summary>Definitions, ordering and provenance</summary><p class="ct-small">${esc(x.rule?.description || 'The tested change inserts or removes e between a ch/sh bench and o while keeping the rest of the spelling fixed. Exact word and extended-frame scopes are separate selectors.')} The orange variant contains e; blue has no e. Frequencies count exact spellings within each section. These are graphic forms, not established lexemes or meanings.</p><p class="ct-small">${esc(x.d.orderDescription || x.d.order_description || (x.generated ? 'The three labels partition one generated sequence into consecutive blocks; they do not imply that the fixed generator changes its policy at those boundaries.' : 'The section sequence is 1b → 1.5a → 2a. The map displays Golf bifolium order and conventional folio order within each bifolium; within-stage page order does not authorize cross-page donors.'))}</p><p class="ct-small">${esc(typeof x.d.provenance === 'string' ? x.d.provenance : x.d.description || '')}</p>${x.d.notes ? `<p class="ct-small">${(Array.isArray(x.d.notes) ? x.d.notes : [x.d.notes]).map(esc).join('<br>')}</p>` : ''}</details></section>`;
  }
  function render() {
    if (!host) return;
    bifoliumView?.leave();
    root.EchoGeneratorPages?.leave();
    const x = model();
    const toggle = `<div class="ct-mode"><button id="ct-back" aria-pressed="false">Original Variants workspace</button><button class="on" aria-pressed="true">Copying study <span>1b → 1.5a → 2a</span></button></div>`;
    const corpus = `<div class="ct-head-actions"><div><span class="ct-small">Statistics corpus</span><div class="ct-segment" aria-label="Statistics corpus"><button data-ct-corpus="manuscript" class="${state.corpus === 'manuscript' ? 'on' : ''}">Manuscript</button><button data-ct-corpus="generator" class="${state.corpus === 'generator' ? 'on' : ''}">Actual generator</button></div></div><button class="wb-button" data-share="tab">Share this trace</button></div>`;
    const heading = `<div class="wb-heading ct-heading"><div><div class="wb-eyebrow">Echo 7 · Follow the proposed copying process</div><h2>Copying in page and bifolium context</h2><p>Follow the chol / shol family through 1b → 1.5a → 2a. The manuscript’s complete bifolium and the generator’s complete example pages appear together below. Select manuscript words to inspect same-page candidates and repetitions while keeping the conjugate leaves in view.</p></div>${corpus}</div>`;
    if (!x) {
      host.innerHTML = `<div class="wb-wrap ct-wrap">${heading}${toggle}<div class="ct-empty">${state.corpus === 'generator' ? 'The actual-generator trace is not available in this data bundle.' : 'The copying trace data bundle is not available.'}</div></div>`;
      bind(); return;
    }
    if (!x.generated && x.selected) manuscriptSelection = {event: idOf(x.selected), rule: state.rule, scope: state.scope};
    const finding = x.d.finding || (!x.generated && datasets().generator ? 'Mechanism check: the default generator rejects direct word-initial chol → cheol expansion. The manuscript pairs are spelling relations; the full generated pages below show the different route the program really takes.' : '');
    const examples = `<div class="ct-quick"><span>Manuscript examples</span><button class="wb-button" data-ct-page-example="f5v:1:3" data-ct-page-rule="CHEO">1b · f5v</button><button class="wb-button" data-ct-page-example="f24r:7:4" data-ct-page-rule="CHOL_SHOL">1.5a · f24r</button><button class="wb-button" data-ct-page-example="f88r:13:2" data-ct-page-rule="CHOL_SHOL">2a · f88r</button><button class="wb-button" data-ct-page-example="f100v:8:9" data-ct-page-rule="CHEO">Hapax · f100v</button></div>`;
    host.innerHTML = `<div class="wb-wrap ct-wrap">${heading}${toggle}<div class="ct-assumption"><b>Observed spelling candidates and logged computational ancestry.</b> Dashed manuscript links identify possible same-page relations; solid generator links identify recorded parents. Later manuscript repetitions establish persistence, not descent. 1a is excluded.</div>${toolbar(x)}${examples}<div id="ct-bifolium-host"></div><section class="ct-inline-generator"><h3 class="ct-inline-heading">Actual generator · complete pages in the same study</h3><p class="ct-small">A verified example from the pinned generator, shown alongside the manuscript. G14 and G28 are separate generated pages, with no physical bifolium relationship. Changing the statistics corpus above keeps both displays here.</p><div id="ct-generator-pages"></div></section><h3 class="ct-inline-heading">${x.generated ? 'Generator' : 'Manuscript'} section statistics and selected lines</h3>${finding ? `<div class="ct-finding">${esc(finding)}</div>` : ''}${stageSummary(x)}${eventMap(x)}<div class="ct-explorer">${list(x)}${detail(x)}</div>${controlTable(x)}${preservation(x)}${replicates(x)}${namedForms(x)}${methods(x)}</div>`;
    bind();
    const manuscript = datasets().manuscript?.events.find(e => idOf(e) === manuscriptSelection.event);
    const mount = host.querySelector('#ct-bifolium-host');
    if (mount && manuscript && root.EchoVariants?.createEmbedded) {
      bifoliumView ||= root.EchoVariants.createEmbedded();
      bifoliumView.showEmbedded(mount, {page: manuscript.page, eventId: manuscriptSelection.event, rule: manuscriptSelection.rule, scope: manuscriptSelection.scope, onSelect: id => selectManuscript(id, manuscriptSelection.rule)});
    }
    const generatedMount = host.querySelector('#ct-generator-pages');
    if (generatedMount) root.EchoGeneratorPages?.show(generatedMount, null, {embedded: true});
  }
  function selectManuscript(id, rule) {
    state.corpus = 'manuscript'; state.event = id; state.rule = rule;
    state.frequency = 'all'; state.supported = false;
    state.scope = manuscriptSelection.scope;
    render();
  }
  function bind() {
    host.onclick = e => {
      const token = e.target.closest('[data-ct-event]'), corpus = e.target.closest('[data-ct-corpus]'), example = e.target.closest('[data-ct-example]'), pageExample = e.target.closest('[data-ct-page-example]');
      if (token) { state.event = token.dataset.ctEvent; render(); }
      else if (pageExample) selectManuscript(pageExample.dataset.ctPageExample, pageExample.dataset.ctPageRule);
      else if (example) { state.rule = 'CHEO'; state.frequency = 'all'; state.supported = false; state.scope = 'history'; state.event = example.dataset.ctExample; render(); }
      else if (corpus) { state.corpus = corpus.dataset.ctCorpus; state.event = state.corpus === 'generator' ? 'g1:3400' : manuscriptSelection.event; state.rule = state.corpus === 'generator' ? 'CHEO' : manuscriptSelection.rule; if (state.corpus === 'manuscript') state.scope = manuscriptSelection.scope; state.frequency = 'all'; state.supported = false; render(); }
      else if (e.target.closest('#ct-jump-detail')) host.querySelector('#ct-bifolium-host')?.scrollIntoView({behavior: 'smooth', block: 'start'});
      else if (e.target.closest('#ct-back')) { if (back) back(); }
    };
    host.onkeydown = e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('svg [data-ct-event]')) { e.preventDefault(); state.event = e.target.dataset.ctEvent; render(); } };
    for (const [id, key, flag] of [['ct-rule', 'rule'], ['ct-scope', 'scope'], ['ct-frequency', 'frequency'], ['ct-supported', 'supported', true], ['ct-chance', 'chance', true], ['ct-named-edge', 'namedEdge'], ['ct-named-stage', 'namedStage'], ['ct-named-event', 'namedEvent']]) {
      const el = host.querySelector('#' + id); if (el) el.onchange = () => { const named = key.startsWith('named'); state[key] = flag ? el.checked : el.value; if (key === 'rule' || key === 'frequency') state.event = ''; if (key === 'namedEdge' || key === 'namedStage') state.namedEvent = ''; render(); if (named) host.querySelector('.ct-chain-explorer').open = true; };
    }
  }
  root.EchoCopyingTrace = {
    show(el, onBack) { host = el; back = onBack; render(); },
    leave() { bifoliumView?.leave(); root.EchoGeneratorPages?.leave(); if (host) host.onkeydown = null; host = null; },
    view() { return {traceCorpus: state.corpus, traceRule: state.rule, traceScope: state.scope, traceFrequency: state.frequency, traceEvent: state.event, traceChance: state.chance ? 1 : 0, traceSupported: state.supported ? 1 : 0, traceNamedEdge: state.namedEdge, traceNamedStage: state.namedStage, traceNamedEvent: state.namedEvent}; },
    applyView(p) {
      const r = root.EchoViewState.read;
      const c = r.oneOf(p.traceCorpus, ['manuscript', 'generator']); if (c) state.corpus = c;
      const rule = r.text(p.traceRule, 60); if (rule) state.rule = rule;
      const s = r.oneOf(p.traceScope, SCOPES.map(x => x[0])); if (s) state.scope = s;
      const f = r.oneOf(p.traceFrequency, FREQ.map(x => x[0])); if (f) state.frequency = f;
      const e = r.text(p.traceEvent, 100); if (e !== undefined) state.event = e;
      const chance = r.flag(p.traceChance); if (chance !== undefined) state.chance = chance;
      const supported = r.flag(p.traceSupported); if (supported !== undefined) state.supported = supported;
      const ne = r.text(p.traceNamedEdge, 100); if (ne !== undefined) state.namedEdge = ne;
      const ns = r.oneOf(p.traceNamedStage, STAGES); if (ns) state.namedStage = ns;
      const nt = r.text(p.traceNamedEvent, 150); if (nt !== undefined) state.namedEvent = nt;
    },
    // Exposed for artifact verification; these helpers make no historical inference.
    inspect: {model, frequency, inRule, support, sourceOf, isNew, location},
  };
})(typeof window !== 'undefined' ? window : globalThis);
