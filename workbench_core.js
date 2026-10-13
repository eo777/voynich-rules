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
  // After the offset, a term may name where its word stands. Word position: [li] line initial (the first token of its
  // line, as Word position: Line start) and [lf] line final. Line class, as the Line class filter (the same tests):
  // [pi] paragraph initial, [pgi] page initial, [lpi] later paragraph initial, [npi] not paragraph initial. ! inside the
  // brackets negates the place alone: [!pgi]p* is p* AND NOT [pgi]*, while NOT before a term (![pgi]p*) negates the
  // whole term, spelling included. Qualifiers stack ([pi][!pgi]p* is [lpi]p*) and are plain conditions. No spelling
  // contains a bracket, so a bracket only ever opens a qualifier. pattern() refuses qualifiers too.
  const OPERATORS = {'&': 'AND', '|': 'OR', '!': 'NOT', AND: 'AND', OR: 'OR', NOT: 'NOT'};
  // Page-initial lines: the first prose line of each page (lowest locus), which in this transliteration always starts a
  // paragraph. Marked on the line objects (`pageFirst`) from the whole text, so any subset of it keeps the marks.
  function markPageInitial(lines) {
    const first = new Map();
    for (const l of lines) if ((l.category || 'para') === 'para') { const f = first.get(l.folio); if (!f || parseFloat(l.locus) < parseFloat(f.locus)) first.set(l.folio, l); }
    for (const l of lines) l.pageFirst = first.get(l.folio) === l;
    return lines;
  }
  // Line classes: paragraph initial (first), page initial (page), paragraph initial below the page's first line
  // (later), and every other line (body)
  const LINE_CLASSES = {first: l => !!l.first, page: l => l.pageFirst, later: l => !!l.first && !l.pageFirst, body: l => !l.first};
  function lineClassTest(name) {
    if (!name || name === 'any') return () => true;
    const test = LINE_CLASSES[name];
    if (!test) throw new Error('Unknown line class: ' + name);
    return line => {
      if ((name === 'page' || name === 'later') && line.pageFirst === undefined) throw new Error('Page-initial lines are not marked; call markPageInitial on the whole text.');
      return test(line);
    };
  }
  const QUALIFIERS = {
    li: {name: 'line initial', not: 'not line initial', test: (line, i) => i === 0},
    lf: {name: 'line final', not: 'not line final', test: (line, i) => i === line.words.length - 1},
    pi: {name: 'paragraph-initial line', not: 'not a paragraph-initial line', test: lineClassTest('first')},
    pgi: {name: 'page-initial line', not: 'not a page-initial line', test: lineClassTest('page')},
    lpi: {name: 'later paragraph-initial line', not: 'not a later paragraph-initial line', test: lineClassTest('later')},
    npi: {name: 'line that is not paragraph initial', not: 'paragraph-initial line', test: lineClassTest('body')},
  };
  const QUALIFIER_LIST = Object.keys(QUALIFIERS).map(q => `[${q}]`).join(', ');
  // A qualifier as written between its brackets: a code ('pgi'), or ! and a code for its negation ('!pgi')
  const qualifierName = q => q.startsWith('!') ? QUALIFIERS[q.slice(1)].not : QUALIFIERS[q].name;
  const qualifierTest = q => { if (!q.startsWith('!')) return QUALIFIERS[q].test; const test = QUALIFIERS[q.slice(1)].test; return (line, i) => !test(line, i); };
  // A term's leading qualifiers and the spelling pattern after them
  function qualified(rest, text) {
    const quals = [];
    for (let m; (m = /^\[([^\]]*)\]/.exec(rest)); rest = rest.slice(m[0].length)) {
      if (!QUALIFIERS[m[1].replace(/^!/, '')]) throw new Error(`"[${m[1]}]" is not a qualifier; use ${QUALIFIER_LIST}, or one with ! inside to negate it, as in [!pgi].`);
      if (!quals.includes(m[1])) quals.push(m[1]);
    }
    if (rest.startsWith('[')) throw new Error(`"${text}": close the qualifier with ], as in [li]p*.`);
    const offset = /^[+-]?\d+:/.exec(rest);
    if (offset && quals.length) throw new Error(`Write the offset first: ${offset[0]}${quals.map(q => `[${q}]`).join('')}${rest.slice(offset[0].length)}.`);
    if (/[[\]]/.test(rest)) throw new Error(`"${text}": a qualifier such as [li] goes at the start of a term, before the spelling.`);
    if (quals.length && !rest) throw new Error(`"${text}" needs a spelling after the qualifier, e.g. ${text}*.`);
    return {glob: rest, quals};
  }
  function parsePattern(query = '') {
    query = String(query ?? '');
    if (query.length > 160) throw new Error('Keep patterns under 160 characters.');
    const tokens = [];
    for (let i = 0; i < query.length;) {
      const ch = query[i];
      if (/\s/.test(ch)) { i++; continue; }
      if ('()&|!'.includes(ch)) { tokens.push(ch === '(' || ch === ')' ? {t: ch} : {t: 'op', v: OPERATORS[ch]}); i++; continue; }
      // a term runs to a space or an operator symbol, except that inside a qualifier's brackets ! negates the code
      let j = i, inside = false;
      for (; j < query.length; j++) { const c = query[j]; if (c === '[') inside = true; else if (c === ']') inside = false; else if (/\s/.test(c) || (!inside && /[()&|!]/.test(c))) break; }
      const text = query.slice(i, j); i = j;
      if (/^(AND|OR|NOT)$/.test(text)) { tokens.push({t: 'op', v: text}); continue; }
      const at = /^([+-]?\d+):(.*)$/.exec(text);
      if (at && !at[2]) throw new Error(`"${text}" needs a pattern after the colon.`);
      const {glob: v, quals} = qualified(at ? at[2] : text, text);
      tokens.push({t: 'term', v, quals, offset: at ? Number(at[1]) || 0 : 0, text});
    }
    if (!tokens.length) return null;
    let k = 0;
    const peek = () => tokens[k], isOp = v => peek()?.t === 'op' && peek().v === v;
    const name = tok => tok.t === 'term' ? `"${tok.text}"` : tok.t === 'op' ? tok.v : 'a parenthesis';
    function primary() {
      const tok = peek();
      if (!tok) throw new Error(tokens[k - 1].t === '(' ? 'A parenthesis is not closed.' : `${tokens[k - 1].v} needs a pattern after it.`);
      if (tok.t === 'term') { k++; return {t: 'term', v: tok.v, quals: tok.quals, offset: tok.offset, text: tok.text}; }
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
      if (node.quals.length) throw new Error(`This box matches one word: write "${node.v}" without "${node.quals.map(q => `[${q}]`).join('')}".`);
      return word => word != null && glob(node.v, word);
    });
  }
  // The position of the word `offset` places from an occurrence along its line; -1 at a line end or past an
  // unreadable gap.
  function indexAt(o, offset) {
    if (!offset) return o.index;
    const words = o.line.words, step = offset < 0 ? -1 : 1, target = o.index + offset;
    for (let i = o.index + step; ; i += step) {
      if (i < 0 || i >= words.length || !words[i]) return -1;
      if (i === target) return i;
    }
  }
  // That word in the occurrence's spelling view (q merged or not); null where indexAt finds none.
  function wordAt(o, offset) {
    if (!offset) return o.word;
    const i = indexAt(o, offset);
    return i < 0 ? null : o.mergeQ ? core(o.line.words[i]) : o.line.words[i];
  }
  // Matches an occurrence: a term without an offset tests its word, -1:… the word before it, and so on; qualifiers
  // test where that word stands.
  // One term against an occurrence: the word its offset points at exists, matches the spelling and stands where the
  // qualifiers say. Also used, with the spelling *, for rate bases (rateBase).
  function occurrenceTerm(node) {
    const tests = node.quals.map(qualifierTest);
    return o => {
      const i = indexAt(o, node.offset); if (i < 0) return false;
      const word = node.offset ? (o.mergeQ ? core(o.line.words[i]) : o.line.words[i]) : o.word;
      return glob(node.v, word) && tests.every(t => t(o.line, i));
    };
  }
  function occurrencePattern(query = '') { return compileTree(parsePattern(query), occurrenceTerm); }
  // A pattern tree with its grouping written out: NOT's scope always in parentheses, and a group of one operator
  // inside the other in parentheses.
  const flatten = (n, t) => n.t === t ? [...flatten(n.a, t), ...flatten(n.b, t)] : [n];
  function showTree(n, parent = null) {
    if (n.t === 'term') return `${n.offset ? `${n.offset}:` : ''}${n.quals.map(q => `[${q}]`).join('')}${n.v}`;
    if (n.t === 'not') return `NOT (${showTree(n.a)})`;
    const text = flatten(n, n.t).map(c => showTree(c, n.t)).join(n.t === 'and' ? ' AND ' : ' OR ');
    return parent ? `(${text})` : text;
  }
  // The pattern written out that way; '' for an empty pattern.
  function describePattern(query = '') { const tree = parsePattern(query); return tree ? showTree(tree) : ''; }
  // The rate base of a search: the words standing where its pattern and its position filters require, so that a rate
  // is matches per word in that class. Qualifiers restrict it ([pi]p* is rated over [pi]*); spellings, neighbor
  // spellings, q states and locations never do. AND and OR combine the terms' bases. NOT keeps a base only over
  // qualifiers alone (p* AND NOT [li]* is rated over NOT ([li]*)); NOT over a spelling too (NOT [pi]p*) leaves all
  // words, as does OR with an unrestricted side. The Line class and Word position filters add their own qualifiers,
  // and terms on the word itself merge into one ([pi]* AND [li]* reads [pi][li]*). Returns {all, text, test}: text in
  // pattern syntax ('' for all words); test takes an occurrence or any {line, index, word}.
  const FILTER_QUALIFIERS = {lineClass: {first: ['pi'], page: ['pgi'], later: ['lpi'], body: ['npi']}, position: {start: ['li'], end: ['lf'], interior: ['!li', '!lf']}};
  function rateBase(config = {}) {
    const placeOnly = n => n.t === 'term' ? n.quals.length > 0 && n.v === '*' : n.t === 'not' ? placeOnly(n.a) : placeOnly(n.a) && placeOnly(n.b);
    const strip = n => {
      if (!n) return null;
      if (n.t === 'term') return n.quals.length ? {t: 'term', v: '*', quals: n.quals, offset: n.offset} : null;
      if (n.t === 'not') {
        if (!placeOnly(n.a)) return null;
        // NOT of one code on the word itself reads as that code negated: NOT [li]* is [!li]*
        const a = strip(n.a), one = a.t === 'term' && !a.offset && a.quals.length === 1;
        return one ? {t: 'term', v: '*', quals: [a.quals[0].startsWith('!') ? a.quals[0].slice(1) : '!' + a.quals[0]], offset: 0} : {t: 'not', a};
      }
      const a = strip(n.a), b = strip(n.b);
      return n.t === 'and' ? (a && b ? {t: 'and', a, b} : a || b) : (a && b ? {t: 'or', a, b} : null);
    };
    let node = config.mode === 'related' ? null : strip(parsePattern(config.query));
    const quals = [...(FILTER_QUALIFIERS.lineClass[config.lineClass] || []), ...(FILTER_QUALIFIERS.position[config.position] || [])];
    if (quals.length) { const filter = {t: 'term', v: '*', quals, offset: 0}; node = node ? {t: 'and', a: node, b: filter} : filter; }
    if (node && node.t === 'and') {
      const parts = flatten(node, 'and'), own = parts.filter(x => x.t === 'term' && !x.offset);
      if (own.length > 1) node = [{t: 'term', v: '*', quals: [...new Set(own.flatMap(x => x.quals))], offset: 0}, ...parts.filter(x => !own.includes(x))].reduce((a, b) => ({t: 'and', a, b}));
    }
    if (!node) return {all: true, text: '', test: () => true};
    return {all: false, text: showTree(node), test: compileTree(node, occurrenceTerm)};
  }
  // The qualifiers a pattern uses, in order of first use (for the line under a pattern box)
  function patternQualifiers(query = '') {
    const out = [], walk = n => { if (!n) return; if (n.t === 'term') n.quals.forEach(q => { if (!out.includes(q)) out.push(q); }); else { walk(n.a); walk(n.b); } };
    walk(parsePattern(query)); return out;
  }
  function patternTerms(query = '') {
    const out = [], walk = n => { if (!n) return; if (n.t === 'term') out.push(n.v); else { walk(n.a); walk(n.b); } };
    walk(parsePattern(query)); return out;
  }
  // The exact spelling a pattern names, or '' when it uses wildcards or operators (or does not parse).
  function literalWord(query = '') {
    try { const tree = parsePattern(query); return tree && tree.t === 'term' && !tree.offset && !tree.quals.length && !/[*?]/.test(tree.v) ? tree.v : ''; }
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
    const prev2 = pattern(config.prev2), prev = pattern(config.prev), next = pattern(config.next), lineClass = lineClassTest(config.lineClass);
    return o => prev2(o.prev2) && prev(o.prev) && next(o.next) &&
      (!config.q || config.q === 'any' || (o.raw.startsWith('q') ? 'yes' : 'no') === config.q) &&
      (!config.nextQ || config.nextQ === 'any' || (o.nextRaw != null && (o.nextRaw.startsWith('q') ? 'yes' : 'no') === config.nextQ)) &&
      (!config.position || config.position === 'any' || (config.position === 'start' ? o.start : config.position === 'end' ? o.end : !o.start && !o.end)) &&
      lineClass(o.line);
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
  const api = {LOCI, core, pattern, occurrencePattern, wordAt, parsePattern, describePattern, patternTerms, literalWord, occurrences, markPageInitial, LINE_CLASSES, QUALIFIERS, qualifierName, patternQualifiers, rateBase, conditions, distance, search, neighborClass, neighborWord, filterNeighbors, keepNeighbors, neighborSummary, rateComparison, counts, score, simulate, populationCounts, qVariants, evalParts, evalLabel};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EchoWorkbenchCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
