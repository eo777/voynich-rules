/* Pure research operations, shared by the browser and node:test.
 * Never borrow capacity from another occurrence of the same spelling. Rules are
 * mutually exclusive branches of ORIGINAL-token state, not a sequential pipeline.
 * Context is the observed transcript; transformed-neighbor inference is future work.
 */
(function (root) {
  'use strict';
  const core = word => word && word.replace(/^q/, '');
  const add = (map, key, value) => map.set(key, (map.get(key) || 0) + value);
  const sum = map => [...map.values()].reduce((a, b) => a + b, 0);
  // Word patterns. A term is a glob over the whole spelling: * = any letters, ? = one character, every other
  // character is itself; no user-supplied regular expression is ever run. Terms combine with ordinary logic:
  // NOT (!) binds tightest, then AND (&), then OR (|), and parentheses group. NOT applies to the whole term or
  // bracketed group after it, never to one character. Operator words are capitals only, because lowercase or is
  // a Voynich word. A term ends at a space, an operator symbol or a parenthesis. A missing neighbor (line start or
  // end, unreadable gap) matches no term, so *y and NOT *y split every occurrence, exactly like Only / Exclude on
  // the -y group, and * AND NOT *y also requires a readable word.
  // A term may start with an offset and a colon: -1:*k* tests the word before the match, 1:*k* the word after, -2:
  // two words before, and so on along the line, as the Previous / Next word boxes do (no crossing of a line end or an
  // unreadable gap). Such terms need the text around a match: occurrencePattern() evaluates them, while pattern(),
  // which matches one word, refuses them.
  const OPERATORS = {'&': 'AND', '|': 'OR', '!': 'NOT', AND: 'AND', OR: 'OR', NOT: 'NOT'};
  function parsePattern(query = '') {
    query = String(query ?? '');
    if (query.length > 160) throw new Error('Keep patterns under 160 characters.');
    const tokens = [];
    for (let i = 0; i < query.length;) {
      const ch = query[i];
      if (/\s/.test(ch)) { i++; continue; }
      if ('()&|!'.includes(ch)) { tokens.push(ch === '(' || ch === ')' ? {t: ch} : {t: 'op', v: OPERATORS[ch]}); i++; continue; }
      let j = i; while (j < query.length && !/[\s()&|!]/.test(query[j])) j++;
      const text = query.slice(i, j); i = j;
      if (/^(AND|OR|NOT)$/.test(text)) { tokens.push({t: 'op', v: text}); continue; }
      const at = /^([+-]?\d+):(.*)$/.exec(text);
      if (at && !at[2]) throw new Error(`"${text}" needs a pattern after the colon.`);
      tokens.push({t: 'term', v: at ? at[2] : text, offset: at ? Number(at[1]) || 0 : 0, text});
    }
    if (!tokens.length) return null;
    let k = 0;
    const peek = () => tokens[k], isOp = v => peek()?.t === 'op' && peek().v === v;
    const name = tok => tok.t === 'term' ? `"${tok.text}"` : tok.t === 'op' ? tok.v : 'a parenthesis';
    function primary() {
      const tok = peek();
      if (!tok) throw new Error(tokens[k - 1].t === '(' ? 'A parenthesis is not closed.' : `${tokens[k - 1].v} needs a pattern after it.`);
      if (tok.t === 'term') { k++; return {t: 'term', v: tok.v, offset: tok.offset, text: tok.text}; }
      if (tok.t === '(') {
        k++; if (peek()?.t === ')') throw new Error('The parentheses are empty.');
        const inner = or(); if (peek()?.t !== ')') throw new Error('A parenthesis is not closed.');
        k++; return inner;
      }
      if (tok.t === ')') throw new Error('A closing parenthesis has no opening one.');
      throw new Error(`${tok.v} needs a pattern before it.`);
    }
    function not() { if (isOp('NOT')) { k++; return {t: 'not', a: not()}; } return primary(); }
    function and() { let a = not(); while (isOp('AND')) { k++; a = {t: 'and', a, b: not()}; } return a; }
    function or() { let a = and(); while (isOp('OR')) { k++; a = {t: 'or', a, b: and()}; } return a; }
    const tree = or();
    if (k < tokens.length) {
      const tok = tokens[k], before = tokens[k - 1];
      if (tok.t === ')') throw new Error('A closing parenthesis has no opening one.');
      // "chol or chor" (or "chol or" while typing): a lowercase operator word after a pattern was meant as the operator
      if (tok.t === 'term' && /^(and|or|not)$/i.test(tok.text)) throw new Error(`Write ${tok.text.toUpperCase()} in capitals; "${tok.text}" is searched as a word.`);
      throw new Error(`Put AND/OR between ${name(before)} and ${name(tok)}.`);
    }
    return tree;
  }
  function glob(p, word) {
    // Dynamic programming keeps even adversarial *a*a*... patterns bounded.
    let row = [true, ...Array(word.length).fill(false)];
    for (const ch of p) {
      const next = [ch === '*' && row[0]];
      for (let j = 1; j <= word.length; j++) next[j] = ch === '*' ? row[j] || next[j-1] : row[j-1] && (ch === '?' || ch === word[j-1]);
      row = next;
    }
    return row[word.length];
  }
  // One compiler for both matchers: `term` turns a term node into a test of the matched thing (a word, or an
  // occurrence with the text around it).
  function compileTree(node, term) {
    if (!node) return () => true;
    if (node.t === 'term') return term(node);
    if (node.t === 'not') { const a = compileTree(node.a, term); return x => !a(x); }
    const a = compileTree(node.a, term), b = compileTree(node.b, term);
    return node.t === 'and' ? x => a(x) && b(x) : x => a(x) || b(x);
  }
  // Matches one word. Offset terms need the words around a match, which a single word does not have.
  function pattern(query = '') {
    return compileTree(parsePattern(query), node => {
      if (node.offset) throw new Error(`This box matches one word: write "${node.v}" without "${node.offset}:".`);
      return word => word != null && glob(node.v, word);
    });
  }
  // The word `offset` places from an occurrence along its line, in the occurrence's spelling view (q merged or not);
  // null at a line end or past an unreadable gap.
  function wordAt(o, offset) {
    if (!offset) return o.word;
    const words = o.line.words, step = offset < 0 ? -1 : 1, target = o.index + offset;
    for (let i = o.index + step; ; i += step) {
      if (i < 0 || i >= words.length || !words[i]) return null;
      if (i === target) return o.mergeQ ? core(words[i]) : words[i];
    }
  }
  // Matches an occurrence: a term without an offset tests its word, -1:… the word before it, and so on.
  function occurrencePattern(query = '') {
    return compileTree(parsePattern(query), node => o => { const word = wordAt(o, node.offset); return word != null && glob(node.v, word); });
  }
  // The pattern with its grouping written out: NOT's scope always in parentheses, and a group of one operator
  // inside the other in parentheses. '' for an empty pattern.
  function describePattern(query = '') {
    const flat = (n, t) => n.t === t ? [...flat(n.a, t), ...flat(n.b, t)] : [n];
    const show = (n, parent) => {
      if (n.t === 'term') return n.offset ? `${n.offset}:${n.v}` : n.v;
      if (n.t === 'not') return `NOT (${show(n.a, null)})`;
      const text = flat(n, n.t).map(c => show(c, n.t)).join(n.t === 'and' ? ' AND ' : ' OR ');
      return parent ? `(${text})` : text;
    };
    const tree = parsePattern(query);
    return tree ? show(tree, null) : '';
  }
  function patternTerms(query = '') {
    const out = [], walk = n => { if (!n) return; if (n.t === 'term') out.push(n.v); else { walk(n.a); walk(n.b); } };
    walk(parsePattern(query)); return out;
  }
  // The exact spelling a pattern names, or '' when it uses wildcards or operators (or does not parse).
  function literalWord(query = '') {
    try { const tree = parsePattern(query); return tree && tree.t === 'term' && !tree.offset && !/[*?]/.test(tree.v) ? tree.v : ''; }
    catch { return ''; }
  }
  function occurrences(lines, section = 'all', mergeQ = true) {
    const spelling=mergeQ?core:word=>word;
    return lines.filter(l => section === 'all' || l.sections.includes(section)).flatMap(line =>
      line.words.flatMap((raw, index) => raw ? [{line, index, raw, mergeQ, word: spelling(raw),
        prev2: index >= 2 && line.words[index - 1] ? spelling(line.words[index - 2]) : null,
        prev: index ? spelling(line.words[index - 1]) : null,
        next: index + 1 < line.words.length ? spelling(line.words[index + 1]) : null,
        nextRaw: line.words[index + 1] || null,
        start: index === 0, end: index === line.words.length - 1}] : []));
  }
  function conditions(config) {
    const prev2 = pattern(config.prev2), prev = pattern(config.prev), next = pattern(config.next);
    return o => prev2(o.prev2) && prev(o.prev) && next(o.next) &&
      (!config.q || config.q === 'any' || (o.raw.startsWith('q') ? 'yes' : 'no') === config.q) &&
      (!config.nextQ || config.nextQ === 'any' || (o.nextRaw != null && (o.nextRaw.startsWith('q') ? 'yes' : 'no') === config.nextQ)) &&
      (!config.position || config.position === 'any' || (config.position === 'start' ? o.start : config.position === 'end' ? o.end : !o.start && !o.end)) &&
      (!config.lineClass || config.lineClass === 'any' || (o.line.first ? 'first' : 'body') === config.lineClass);
  }
  function distance(a, b) {
    let row = Array.from({length: b.length + 1}, (_, i) => i);
    for (let i = 0; i < a.length; i++) {
      const next = [i + 1];
      for (let j = 0; j < b.length; j++) next.push(Math.min(next[j] + 1, row[j + 1] + 1, row[j] + (a[i] !== b[j])));
      row = next;
    }
    return row[b.length];
  }
  function search(items, config) {
    const matches = occurrencePattern(config.query), context = conditions(config);
    const query = (config.query || '').trim();
    // Exclude focus occurrences only; never remove text or reconnect neighbors.
    const merge=config.mergeQ??items[0]?.mergeQ??true, spelling=merge?core:word=>word;
    const excluded = new Set((config.excluded || []).map(spelling));
    // Breakdown "filter to" choices: exact neighbor spellings (q view included,
    // boundaries as their breakdown labels), alternatives within a side, AND across sides.
    const only = ['prev', 'next'].filter(side => config.neighborOnly?.[side]?.length).map(side => [side, new Set(config.neighborOnly[side])]);
    // Group filters (Only / Exclude on a neighbor group): classes in the grouping they were set in. Within a side,
    // Only groups are alternatives and every Exclude group must miss; sides combine with AND. A missing neighbor is
    // its own group ('boundary / unreadable'), so excluding -y keeps line-initial words.
    const groups = ['prev', 'next'].map(side => [side, (config.groupFilters || []).filter(g => g.side === side)]).filter(([, gs]) => gs.length);
    const inGroups = o => groups.every(([side, gs]) => {
      const hit = g => neighborClass(o[side], side, g.mode) === g.key, keep = gs.filter(g => g.op === 'only');
      return (!keep.length || keep.some(hit)) && !gs.some(g => g.op === 'exclude' && hit(g));
    });
    return items.filter(o => !excluded.has(o.word) && context(o) && only.every(([side, keep]) => keep.has(neighborWord(o, side, merge))) && inGroups(o) &&
      (!config.folio || o.line.folio === config.folio) &&
      (!config.sheet || o.line.sheet === config.sheet) &&
      (config.mode === 'related' && query ? distance(o.word, spelling(query)) <= 2 : matches(o)));
  }
  // Descriptive, disjoint spelling buckets, not inferred glyphs or morphemes.
  // The occurrence view controls whether the spelling retains initial q.
  function neighborClass(word, side, mode='edges') {
    if(word==null)return 'boundary / unreadable';
    // Occurrences already apply the chosen q view; retain the entire neighbor.
    if(mode==='word')return word;
    if(mode==='gallows') {
      // Match bench gallows atomically before bare letters: ckh is cKh, not K.
      // One disjoint bucket per neighbor preserves pair totals. Multi-type
      // words retain every distinct type, in a stable order, rather than silently
      // dropping all but the first gallows or counting one pair several times.
      const labels={t:'T',k:'K',p:'P',f:'F',cth:'cTh',ckh:'cKh',cph:'cPh',cfh:'cFh'};
      const types=new Set(word.match(/cth|ckh|cph|cfh|[tkpf]/g)||[]);
      return Object.keys(labels).filter(type=>types.has(type)).map(type=>labels[type]).join(' + ')||'none';
    }
    if(side==='prev')return word.endsWith('ol')?'-ol':word.endsWith('or')?'-or':word.endsWith('l')?'-l (other)':word.endsWith('r')?'-r (other)':word.endsWith('y')?'-y':'other';
    if(side!=='next')throw new Error('Neighbor side must be prev or next.');
    const beginning=word.match(/^(ckh|cth|cph|cfh|ch|sh|.)/u)?.[0];
    return beginning?beginning+'-':'other';
  }
  function neighborSummary(items, side, mergeQ=false, mode='edges') {
    if(!['prev','next'].includes(side))throw new Error('Neighbor side must be prev or next.');
    const groups=new Map();
    for(const o of items){
      const word=neighborWord(o,side,mergeQ),key=neighborClass(o[side],side,mode);
      if(!groups.has(key))groups.set(key,{count:0,words:new Map()});
      const group=groups.get(key);group.count++;add(group.words,word,1);
    }
    return groups;
  }
  // One source of truth for raw neighbor spelling, including q and barriers.
  // A breakdown row counts pairs around focus tokens, not all word tokens.
  function neighborWord(o,side,mergeQ=false) {
    if(!['prev','next'].includes(side))throw new Error('Neighbor side must be prev or next.');
    const index=o.index+(side==='prev'?-1:1);
    const raw=o.line.words[index];
    return raw?(mergeQ?core(raw):raw):(index<0||index>=o.line.words.length?'(line boundary)':'(unreadable)');
  }
  function filterNeighbors(items,side,excluded=[],mergeQ=false) {
    if(!excluded.length)return items;
    const omit=new Set(excluded);
    return items.filter(o=>!omit.has(neighborWord(o,side,mergeQ)));
  }
  // The inverse of filterNeighbors: keep only pairs whose neighbor is one of `words`.
  function keepNeighbors(items,side,words=[],mergeQ=false) {
    if(!words.length)return items;
    const keep=new Set(words);
    return items.filter(o=>keep.has(neighborWord(o,side,mergeQ)));
  }
  function rateComparison(count, selectedTotal, baselineCount, sectionTotal) {
    const selected=selectedTotal?count/selectedTotal:0,baseline=sectionTotal?baselineCount/sectionTotal:0;
    return {selected,baseline,lift:baseline>0?selected/baseline:null,per10k:sectionTotal?count/sectionTotal*10000:0};
  }
  // routes (the catalog's, optional) list composed outputs such as ed+GEDY_AR; such an output is offered only when
  // the same run also applies every other catalog rule it needs (codes).
  function compile(rule, known, routes = null, codes = new Set()) {
    if (!Number.isFinite(rule.fraction) || rule.fraction < 0 || rule.fraction > 1) throw new Error('Every application fraction must be between 0 and 100%.');
    const context = conditions(rule);
    if (rule.kind === 'known') {
      if (!Object.hasOwn(known, rule.code)) throw new Error('Unknown catalog rule code.');
      if (routes) {
        const R = typeof module !== 'undefined' && module.exports ? require('./rule_manager.js') : root.EchoRuleManager;
        return o => context(o) ? R.outputs({known, routes}, rule.code, o.word, codes) : null;
      }
      return o => context(o) ? known[rule.code][o.word] : null;
    }
    if (!['exact', 'prefix', 'suffix', 'contains'].includes(rule.kind)) throw new Error('Choose a supported spelling edit.');
    if (typeof rule.from !== 'string' || typeof rule.to !== 'string' || !rule.from || rule.from.length > 100 || rule.to.length > 100 || /\s|[?*|]/.test(rule.from + rule.to)) throw new Error('Edits use literal single-word spellings (no wildcards); find text is required.');
    return o => {
      if (!context(o)) return null;
      const w = o.word, a = rule.from, b = rule.to;
      if (rule.kind === 'exact') return w === a ? b : null;
      if (rule.kind === 'prefix') return w.startsWith(a) ? b + w.slice(a.length) : null;
      if (rule.kind === 'suffix') return w.endsWith(a) ? w.slice(0, -a.length) + b : null;
      return w.includes(a) ? w.replace(a, () => b) : null;
    };
  }
  function counts(items) { const out = new Map(); items.forEach(o => add(out, o.word, 1)); return out; }
  function score(before, after, target, nSource, nTarget) {
    if (!nSource || !nTarget) throw new Error('Both populations need readable tokens.');
    let gained = 0, lost = 0, overlapBefore = 0, overlapAfter = 0;
    const rows = [...new Set([...before.keys(), ...after.keys(), ...target.keys()])].map(word => {
      const a = (before.get(word) || 0) * 10000 / nSource;
      const z = (after.get(word) || 0) * 10000 / nSource;
      const b = (target.get(word) || 0) * 10000 / nTarget;
      const pre = Math.min(a, b), post = Math.min(z, b), delta = post - pre;
      overlapBefore += pre; overlapAfter += post; gained += Math.max(delta, 0); lost += Math.max(-delta, 0);
      return {word, before: a, after: z, target: b, delta, surplus: Math.max(z - b, 0), shortfall: Math.max(b - z, 0)};
    });
    return {rows, gained, lost, net: gained - lost, overlapBefore, overlapAfter};
  }
  function simulate(source, target, rules, known = {}, catalogRoutes = null) {
    if (rules.length > 30) throw new Error('Use at most 30 rules per experiment.');
    const codes = new Set(rules.filter(r => r.enabled !== false && r.kind === 'known').map(r => r.code));
    const active = rules.filter(r => r.enabled !== false).map(r => ({rule: r, edit: compile(r, known, catalogRoutes, codes)}));
    const before = counts(source), after = new Map(), examples = [], routes = new Map();
    const support = new Set(), sheets = new Set(); let moved = 0, matched = 0;
    for (const o of source) {
      let used = 0; const branches = [];
      for (const {rule, edit} of active) {
        const result = edit(o);
        if (result == null || rule.fraction === 0) continue;
        // A catalog family is a menu of alternative ONE-word realizations,
        // never consecutive output tokens. The user's fraction is the entire
        // branch budget, shared equally across distinct outputs, not per output.
        const outputs = [...new Set(Array.isArray(result)?result:[result])];
        if (!outputs.length || outputs.length===1 && outputs[0]===o.word) continue;
        used += rule.fraction;
        for (const output of outputs) {
        // Empty outputs would delete a token and invalidate original-token rates.
        if (!output || /^q/.test(output) || /\s/.test(output)) throw new Error('An edit produced an empty, q-prefixed, or multi-word core. Use one nonempty q-merged output.');
        branches.push({word: output, weight: rule.fraction/outputs.length, name: rule.name || rule.code || rule.from});
        }
      }
      if (used > 1 + 1e-10) throw new Error(`Rules allocate ${(used * 100).toFixed(1)}% of ${o.raw} at ${o.line.folio}.${o.line.locus}. Reduce competing fractions to at most 100%.`);
      add(after, o.word, Math.max(0, 1 - used));
      for (const branch of branches) {
        add(after, branch.word, branch.weight);
        add(routes, o.word + ' → ' + branch.word, branch.weight);
      }
      if (used) { moved += used; matched++; support.add(o.word); sheets.add(o.line.sheet); examples.push({...o, retained: Math.max(0, 1 - used), branches}); }
    }
    if (Math.abs(sum(after) - source.length) > 1e-7) throw new Error('Token mass did not reconcile.');
    return {...score(before, after, counts(target), source.length, target.length), nSource: source.length, nTarget: target.length,
      mass: sum(after), moved, matched, types: support.size, sheets: sheets.size, examples, routes: [...routes]};
  }
  // Word counts of one population (q-merged). With collapse, a word repeated immediately on the same line counts
  // once (chol chol -> chol); a line break or an unreadable gap ends a run.
  function populationCounts(lines, section, collapse = false) {
    const counts = new Map(); let N = 0;
    for (const o of occurrences(lines, section, true)) if (!collapse || o.prev !== o.word) { counts.set(o.word, (counts.get(o.word) || 0) + 1); N++; }
    return {N, counts};
  }
  // Raw spellings a q-merged form stands for: the form itself and the form with one initial q.
  const qVariants = word => `${word}|q${word}`;
  // Saved LC1 keys such as 'A|fit1_eval2|merged': sheet split A or B (two seeded halvings of the same sheets), rule
  // fractions fitted on one half and tested on the other. Splits are numbered so they cannot be read as Currier A/B.
  function evalParts(key) {
    const [split, direction] = String(key).split('|'), m = /^fit(\d)_eval(\d)$/.exec(direction || '');
    return m ? {split: ({A: '1', B: '2'})[split] || split, fit: m[1], test: m[2]} : null;
  }
  function evalLabel(key) {
    const p = evalParts(key);
    return p ? `Sheet split ${p.split}: fitted on half ${p.fit}, tested on half ${p.test}` : String(key);
  }
  // Which loci each scope of the search covers: running text is prose, circles and radii; labels are separate.
  const LOCI = {running: ['para', 'circle', 'radial'], all: ['para', 'circle', 'radial', 'label'], para: ['para'], label: ['label'], circle: ['circle'], radial: ['radial']};
  const api = {LOCI, core, pattern, occurrencePattern, wordAt, parsePattern, describePattern, patternTerms, literalWord, occurrences, conditions, distance, search, neighborClass, neighborWord, filterNeighbors, keepNeighbors, neighborSummary, rateComparison, counts, score, simulate, populationCounts, qVariants, evalParts, evalLabel};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EchoWorkbenchCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
