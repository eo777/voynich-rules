/* Same-page evidence for the Variants transcription view. Pure: no DOM.
 * A manuscript link is a spelling candidate, never recovered copying ancestry.
 * Resolve by folio + transcription locus + zero-based word position + exact word;
 * never infer a position from the event id (its middle field is a paragraph rank).
 * Full candidate/repetition lists come from validated event targets, since the
 * study's exported `candidates` and `later` arrays are deliberately truncated. */
(function (root) {
  'use strict';
  const SCOPES = ['page', 'local3', 'local10', 'normalPage'];
  const inRule = (e, rule) => (e.ruleIds || []).includes(rule);
  const isNew = e => !!e.new;

  function analyze(page, dataset, options = {}) {
    const rule = options.rule || 'CHOL_SHOL';
    const scope = SCOPES.includes(options.scope) ? options.scope : 'page';
    const data = dataset?.manuscript || dataset || {};
    const mismatches = [], eventByToken = new Map(), roles = new Map();
    const folio = page?.folio || '', lines = page?.lines || [];
    const byLocus = new Map();
    lines.forEach((line, i) => {
      const key = String(line.locus);
      const list = byLocus.get(key) || [];
      list.push({line, lineIndex: i}); byLocus.set(key, list);
    });
    const mismatch = (e, reason) => { mismatches.push({eventId: e.id, page: folio, locus: e.target?.locus ?? e.locus, reason}); return null; };
    function resolve(e) {
      const ref = e.target;
      if (!ref || ref.page !== folio || e.page !== folio) return mismatch(e, 'Target folio does not match this page');
      const found = byLocus.get(String(ref.locus)) || [];
      if (found.length !== 1) return mismatch(e, found.length ? 'Transcription locus is ambiguous' : 'Transcription locus is absent');
      const {line, lineIndex} = found[0], pos = ref.tokenIndex;
      if (!Number.isInteger(pos) || pos < 0 || pos >= line.tokens.length) return mismatch(e, 'Word position is outside the transcription line');
      const token = line.tokens[pos];
      if (token.w !== ref.word || e.word !== ref.word) return mismatch(e, 'Word differs at the recorded transcription position');
      if (String(e.locus) !== String(ref.locus) || e.tokenIndex !== pos) return mismatch(e, 'Event and target reference disagree');
      if (Array.isArray(ref.words) && (ref.words.length !== line.tokens.length || ref.words.some((w, i) => w !== line.tokens[i].w))) return mismatch(e, 'Recorded full line differs from the transcription');
      if (!Number.isInteger(token.index) || page.tokens?.[token.index] !== token) return mismatch(e, 'Page token index does not resolve to this word');
      return {...ref, id: e.id, index: token.index, lineIndex, locus: String(line.locus), tokenIndex: pos, word: token.w, page: folio};
    }
    const events = (data.events || []).filter(e => e.page === folio && inRule(e, rule)).map(e => {
      const target = resolve(e);
      return target ? {...e, target} : null;
    }).filter(Boolean).sort((a, b) => a.target.index - b.target.index);

    // Match the frozen study: donor lines must already be completed. Later exact
    // words may be farther along the same line. The usual-page pool excludes the
    // first two completed lines once at least three lines have been completed.
    for (const e of events) {
      const t = e.target;
      const earlier = events.filter(x => x.family === e.family && isNew(x) !== isNew(e) && x.target.lineIndex < t.lineIndex);
      const refs = earlier.map(x => ({...x.target, distance: t.lineIndex - x.target.lineIndex, samePage: true}));
      refs.sort((a, b) => a.distance - b.distance || a.tokenIndex - b.tokenIndex);
      e.donorsByScope = {
        page: refs,
        local3: refs.filter(r => r.distance <= 3),
        local10: refs.filter(r => r.distance <= 10),
        normalPage: refs.filter(r => t.lineIndex >= 3 ? r.lineIndex >= 2 : r.lineIndex === t.lineIndex - 1)
      };
      e.candidates = e.donorsByScope[scope];
      e.source = e.candidates[0] || null;
      e.later = events.filter(x => x.word === e.word && x.target.index > t.index).map(x => ({...x.target, distance: t.lineIndex - x.target.lineIndex, samePage: true}));
      e.earlierExact = events.filter(x => x.word === e.word && x.target.index < t.index).map(x => x.target);
      e.firstExactOnPage = e.earlierExact.length === 0;
      e.firstVariantOnPage = !events.some(x => x.family === e.family && isNew(x) === isNew(e) && x.target.index < t.index);
      e.sameLineEarlier = events.filter(x => x.family === e.family && isNew(x) !== isNew(e) && x.target.lineIndex === t.lineIndex && x.target.index < t.index).map(x => x.target);
      eventByToken.set(t.index, e);
    }
    const chosen = events.find(e => e.id === options.eventId)
      || events.find(e => e.id === 'f88r:13:2')
      || events.find(e => isNew(e) && e.source && e.later.length)
      || events.find(e => isNew(e) && e.source)
      || events.find(e => isNew(e)) || events[0] || null;
    function role(ref, name, eventId) {
      let entry = roles.get(ref.index);
      if (!entry) { entry = {role: name, roles: [], eventId, ref}; roles.set(ref.index, entry); }
      if (!entry.roles.includes(name)) entry.roles.push(name);
      if (name !== 'eligible') { entry.role = name; entry.eventId = eventId; }
    }
    for (const e of events) role(e.target, 'eligible', e.id);
    const sources = chosen?.candidates || [], later = chosen?.later || [], links = [];
    if (chosen) {
      for (const ref of sources) {
        role(ref, 'source', chosen.id);
        links.push({from: ref.index, to: chosen.target.index, kind: 'candidate', fromRef: ref, toRef: chosen.target});
      }
      for (const ref of later) {
        role(ref, 'later', chosen.id);
        links.push({from: chosen.target.index, to: ref.index, kind: 'later', fromRef: chosen.target, toRef: ref});
      }
      role(chosen.target, 'target', chosen.id);
    }
    const stats = {
      targets: events.length,
      eBearing: events.filter(isNew).length,
      withEarlierOpposite: events.filter(e => e.candidates.length).length,
      withLaterExact: events.filter(e => e.later.length).length,
      sectionHapaxes: events.filter(e => e.sectionCount === 1).length,
      candidatePairs: events.reduce((n, e) => n + e.candidates.length, 0),
      laterPairs: events.reduce((n, e) => n + e.later.length, 0),
      supportByScope: Object.fromEntries(SCOPES.map(s => [s, events.filter(e => e.donorsByScope[s].length).length]))
    };
    return {page: folio, stage: page?.col || '', rule, scope, events, eventByToken, chosen, selected: chosen,
      eventId: chosen?.id || '', sources, later, links, roles, annotations: roles, stats, mismatches};
  }
  const api = {analyze, SCOPES};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EchoPageCopyFlow = api;
})(typeof window !== 'undefined' ? window : globalThis);
