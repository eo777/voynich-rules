/* Occurrences of the current Words & contexts search across the manuscript, by page or by paragraph.
 * Pure model functions (grouping, units and their counts, order, facet layout, group statistics, histograms, axis
 * ticks) are exported for node tests; mount() draws the bars or histograms and the statistics table into a container.
 * Order and layout only move columns: the statistics depend on the grouping, the unit, the measure and the counts.
 * Colours are CSS variable names so the chart follows the light/dark theme without redrawing.
 */
(function (root) {
  'use strict';
  // Illustration sections. Bio, Pharmaceutical and Stars keep their population colours; the rest were chosen to
  // separate sections that sit next to each other in the manuscript (normal and colour-blind vision, both themes).
  const SECTION_COLOURS = {H: '--secB', A: '--secAt', C: '--secL', Z: '--secBt', B: '--secN', P: '--secM', S: '--m1n', T: '--ink2'};
  // RZ classes and Currier languages reuse the regime colours of their counterparts (A ~ early Herbal A, Ae ~ late A +
  // pharma, B ~ Herbal B, Bb ~ Bio, Bs ~ Stars, C ~ Celestial), so switching groupings shows where they disagree.
  const RZ_COLOURS = {A: '--secA', Ae: '--secM', B: '--secB', Bb: '--secN', Bs: '--m1n', C: '--secH', Ce: '--secL', Cb: '--secBt'};
  const RZ_LABELS = {A: 'A', Ae: 'Ae · pharma', B: 'B', Bb: 'Bb · bio', Bs: 'Bs · stars', C: 'C · cosmological', Ce: 'Ce · zodiac', Cb: 'Cb · bio'};
  const CURRIER_COLOURS = {A: '--secA', B: '--secB'};
  // Hands have no colour elsewhere in the app; chosen to separate hands whose pages sit next to each other.
  const HAND_COLOURS = {1: '--secA', 2: '--secBt', 3: '--secMt', 4: '--secL', 5: '--secN'};
  const OTHER = '--pc-other';           // recessive grey, distinct from Bio's slate in both themes
  // Late Herbal A when the late A + pharma regime is split (pharma keeps the joint regime's colour). Checked against
  // every other regime colour and the grey for colour-blind separation (OKLab dE >= 14 in both themes).
  const LATE_A_COLOUR = '--rgLA';
  // The Herbal B regime's non-herbal pages (text-only and cosmological: f66r, f85r1, f85r2, f86v3-f86v6) in Golf regime +.
  // Checked like late A against every regime colour and the grey (OKLab dE x100, simulated protan / deutan / tritan vision):
  // dark theme #47dcfd, >= 14.5 dichromat and >= 18.0 normal; light theme #b13d75, >= 11.7 dichromat (Stars, protan) and
  // >= 17.8 normal (Celestial). In the light theme only near-black colours clear 14, and those read as text.
  const HB_OTHER_COLOUR = '--rgBX';
  // Golf's regime numbers, in Golf's order (1, 2, 3a, 3b, 4, 5, 6), as published with the regimes (Voynich Ninja thread 6084)
  const GOLF_NUMBERS = {earlyA: '1', lateAP: '2', HB: '3a', Stars: '3b', Bio: '4', Cel: '5', f58: '6'};
  // Golf v2 (Golf 2.0, 8 October 2026; manuscript.golf2, Golf's working membership copied by build_manuscript.py): one
  // class per page and text kind, under Golf's own codes. Each class takes the colour of the Golf regime it comes from (a
  // regime key) or of its Golf regime + group (late Herbal A; the Rosette, from Herbal B's non-herbal pages); a
  // family's second class is striped (`hatch`) and its third dotted (`dots`), so seventeen classes need no new hues.
  // The intermediate candidates are drawn in the text colour, the one colour apart from every class in both themes
  // (OKLab dE x100 >= 19 normal, >= 13 simulated colour-blind); text with no working class is grey.
  const GOLF2_PAINTS = {'1a': ['earlyA'], '1b': ['earlyA', 'hatch'], '2a': [LATE_A_COLOUR], '2b': ['lateAP'], '2c': ['lateAP', 'hatch'],
    '3a': ['HB'], '3b': ['HB', 'hatch'], '3c': ['Stars'], '3d-c': [HB_OTHER_COLOUR], '3d-l': [HB_OTHER_COLOUR, 'hatch'],
    '4a': ['Bio'], '4b': ['Bio', 'hatch'], '4c': ['Stars', 'hatch'], '5a': ['Cel'], '5b': ['Cel', 'hatch'], '5c': ['Cel', 'dots'], '6': ['f58']};
  const INTERMEDIATE_COLOUR = '--ink';
  // Golf v2.1 (Golf 2.1, 10 October 2026; manuscript.golf21) paints Golf 2.1's codes the same way: 1.5a (Transitional
  // A) takes late Herbal A's colour and 2a (Late A / Pharma, Golf 2.0's 2a and 2b merged) the joint regime's; the other
  // codes keep Golf v2's paints, so the seventeen classes stay apart as they are in Golf v2.
  const GOLF21_PAINTS = Object.fromEntries(Object.entries({...GOLF2_PAINTS, '1.5a': [LATE_A_COLOUR], '2a': ['lateAP']}).filter(([code]) => code !== '2b'));
  // Orders along Golf's proposed path (manuscript.golf_path): pages by their own positions ('path', 'pathPos') or by
  // their sheet's pooled position with the sheet's pages together ('pathBif', 'pathBifPos'); evenly spaced in that
  // order (rank), or at the positions themselves (Pos), so the path's empty stretches stay empty.
  const PATH_ORDERS = ['path', 'pathPos', 'pathBif', 'pathBifPos'];
  const atPositions = ordering => ordering === 'pathPos' || ordering === 'pathBifPos';
  const sheetsTogether = ordering => ordering === 'bifolium' || ordering === 'pathBif' || ordering === 'pathBifPos';
  // Pattern colours, for bars stacked by pattern: ten families of three shades (light, mid, deep), each a CSS variable
  // (--ser-<id>, workbench.css) with a value per theme. A family's mid is the app's categorical colour; its light and
  // deep shades keep the family's hue one step lighter and deeper in OKLCH, apart from each other by OKLab dE x100 >= 15
  // in normal vision and >= 13 under simulated colour-blindness (dark-theme green: 14). Patterns are coloured in a fixed
  // order: the eight mids in the categorical order (adjacent pairs dE >= 19 normal, >= 8.4 colour-blind, both themes),
  // then the deep shades, then the light ones; teal and grey come last, mainly for choosing by hand.
  const SERIES_FAMILIES = [['blue', 'Blue'], ['orange', 'Orange'], ['aqua', 'Aqua'], ['yellow', 'Yellow'], ['pink', 'Pink'], ['green', 'Green'],
    ['violet', 'Violet'], ['red', 'Red'], ['teal', 'Teal'], ['grey', 'Grey']];
  const SERIES_COLOURS = SERIES_FAMILIES.flatMap(([f, name]) => [['light', `${name}, light`], ['', `${name}, mid`], ['deep', `${name}, deep`]]
    .map(([shade, label]) => { const id = shade ? `${f}-${shade}` : f; return {id, family: f, shade: shade || 'mid', label, colour: `--ser-${id}`}; }));
  const AUTO_COLOURS = [...['', '-deep', '-light'].flatMap(s => SERIES_FAMILIES.slice(0, 8).map(([f]) => f + s)), ...['teal', 'grey'].flatMap(f => [f, f + '-deep', f + '-light'])];
  const seriesColour = id => (SERIES_COLOURS.find(c => c.id === id) || {}).colour || null;
  // Every charted pattern (an index into `colours`, the patterns' colour ids) without a colour takes the first automatic
  // colour no pattern has. Colours already given never change, so a pattern keeps its colour while others come and go.
  function assignColours(colours, charted) {
    const out = [...colours], used = new Set(out.filter(seriesColour));
    for (const i of charted) {
      if (seriesColour(out[i])) continue;
      out[i] = AUTO_COLOURS.find(c => !used.has(c)) || AUTO_COLOURS[used.size % AUTO_COLOURS.length]; used.add(out[i]);
    }
    return out;
  }
  // How several patterns share a chart: 'mirror' (two patterns, the second below the axis), 'stack' (a bar per unit, a
  // segment per pattern in its colour, the first at the bottom), 'stack100' (the same as shares of the bar) or 'rows' (a
  // row of bars per pattern). One pattern needs none ('single'). Histograms do not stack and three patterns do not
  // mirror: both take rows. Two patterns mirror unless told otherwise.
  function arrangement(n, wanted, histogram = false) {
    if (n < 2) return 'single';
    if (wanted === 'mirror' || (!wanted && n === 2)) return n === 2 ? 'mirror' : 'rows';
    return !histogram && (wanted === 'stack' || wanted === 'stack100') ? wanted : 'rows';
  }
  const quireNumber = q => q.charCodeAt(0) - 64;                       // transliteration quire letters: A = quire 1
  const rzClass = code => code ? code.replace(/[+\-]+$/, '') : null;   // RZ q-frequency modifiers (+ / -) are dropped

  const readable = line => line.words.reduce((n, w) => n + (w ? 1 : 0), 0);
  const category = line => line.category || 'para';                    // workbench lines are paragraph text
  const sum = (keys, obj) => keys.reduce((n, k) => n + (obj[k] || 0), 0);

  // A grouping assigns every token to one group key. Section, regime, RZ and Currier language are page attributes;
  // LFD hand and comparison membership are read per line, because f115r changes hand (and population) mid-page, and
  // so are Golf v2 classes, which Golf gives per page and text kind.
  function grouping(mode, manuscript, opts = {}) {
    const pages = manuscript.pages;
    const byPage = (keyOfPage, keys, label, colour, noneLabel) => {
      const present = new Set(pages.map(p => keyOfPage(p) ?? 'none'));
      const groups = keys.filter(k => present.has(k)).map(k => ({key: k, label: label(k), colour: colour(k) || OTHER, members: [k]}));
      if (present.has('none')) groups.push({key: 'none', label: noneLabel, colour: OTHER, members: ['none']});
      return {mode, groups, keyOf: (line, page) => keyOfPage(page) ?? 'none'};
    };
    if (mode === 'section') return byPage(p => p.section, Object.keys(manuscript.section_names), k => manuscript.section_names[k], k => SECTION_COLOURS[k], 'No section');
    if (mode === 'regime' || mode === 'regimeSplit') {
      // Golf's own regime numbers (npcompl33t, Voynich Ninja thread 6084; team_golf/LANGUAGES.md), in Golf's order;
      // colours stay with their regime (opts.regimeColours follows the manuscript's regime list)
      const order = manuscript.regimes.map(r => r.key), colours = opts.regimeColours || [];
      const rank = k => GOLF_NUMBERS[k] ? Object.keys(GOLF_NUMBERS).indexOf(k) : Infinity;
      const keys = [...order].sort((a, b) => rank(a) - rank(b) || order.indexOf(a) - order.indexOf(b));
      const num = k => GOLF_NUMBERS[k] || '', colour = k => colours[order.indexOf(k)];
      const named = (k, text) => num(k) ? `${num(k)}: ${text}` : text;
      const label = k => named(k, manuscript.regimes[order.indexOf(k)].label);
      if (mode === 'regime') return byPage(p => p.regime, keys, label, colour, 'No regime');
      // Golf regime +, two regimes split by illustration, both parts keeping their regime's number: late A + pharma into
      // late Herbal A and Pharma (pharmaceutical pages); Herbal B into Herbal B (herbal pages) and its non-herbal pages
      const JOINT = 'lateAP', names = {lateA: named(JOINT, 'late Herbal A'), pharma: named(JOINT, 'Pharma'), HBx: named('HB', 'non-herbal pages')};
      const own = {lateA: LATE_A_COLOUR, pharma: colour(JOINT), HBx: HB_OTHER_COLOUR};
      const plus = p => p.regime === JOINT ? (p.section === 'P' ? 'pharma' : 'lateA') : p.regime === 'HB' && p.section !== 'H' ? 'HBx' : p.regime;
      const plusKeys = keys.flatMap(k => k === JOINT ? ['lateA', 'pharma'] : k === 'HB' ? ['HB', 'HBx'] : [k]);
      return byPage(plus, plusKeys, k => names[k] || label(k), k => own[k] || colour(k), 'No regime');
    }
    if (mode === 'golf2' || mode === 'golf2x' || mode === 'golf21' || mode === 'golf21x') {
      // Golf v2: each line takes its page's working class for its text kind (Golf's membership, export schema 2: the
      // audit's class, or the previous class kept where the audit abstained), else No working class. Golf v2 extended
      // shows the six intermediate candidates apart from their working classes, in groups under the candidate's code.
      // Golf v2.1 does the same with Golf 2.1's working membership; its extended view groups the 27 candidates by the
      // two classes of the boundary each sits on (3a/3b). With `opts.lines` (the text in view) only the groups with
      // words there are listed, so the label classes stay out of a view of running text.
      const v21 = mode === 'golf21' || mode === 'golf21x', G = v21 ? manuscript.golf21 : manuscript.golf2, PAINTS = v21 ? GOLF21_PAINTS : GOLF2_PAINTS;
      if (!G) throw new Error(v21 ? 'Golf v2.1 needs manuscript_data.js with Golf 2.1 classes; run build_manuscript.py' : 'Golf v2 needs manuscript_data.js with Golf 2.0 classes; run build_manuscript.py');
      const order = manuscript.regimes.map(r => r.key), colours = opts.regimeColours || [];
      const paintOf = code => { const [c, texture] = PAINTS[code] || [OTHER]; return {colour: c.startsWith('--') ? c : colours[order.indexOf(c)] || OTHER, ...(texture ? {[texture]: true} : {})}; };
      const unit = line => line.folio + '|' + category(line);
      const extended = mode === 'golf2x' || mode === 'golf21x', keyOf = line => (extended && G.intermediate[unit(line)]) || G.units[unit(line)] || 'none';
      const present = opts.lines ? new Set(opts.lines.filter(l => readable(l)).map(keyOf)) : null, has = k => !present || present.has(k);
      const groups = [...G.classes.filter(c => has(c.code)).map(c => ({key: c.code, label: `${c.code}: ${c.label.replace(': ', ', ')}`, members: [c.code], ...paintOf(c.code)})),
        ...(extended ? G.intermediate_codes : []).filter(x => has(x.code)).map(x => ({key: x.code, label: `${x.code}: candidate between ${x.ends[0]} and ${x.ends[1]}`, members: [x.code], colour: INTERMEDIATE_COLOUR}))];
      if (has('none')) groups.push({key: 'none', label: 'No working class', colour: OTHER, members: ['none']});
      return {mode, groups, keyOf};
    }
    if (mode === 'rz') return byPage(p => rzClass(p.rz), Object.keys(RZ_COLOURS), k => RZ_LABELS[k], k => RZ_COLOURS[k], 'No RZ code');
    if (mode === 'currier') return byPage(p => p.lang || null, ['A', 'B'], k => 'Currier ' + k, k => CURRIER_COLOURS[k], 'Not classified');
    if (mode === 'hand') {
      const lineHand = manuscript.line_hands || {}, hands = [...new Set(pages.flatMap(p => p.hands))].sort();
      const keyOf = (line, page) => page.hands.length === 1 ? page.hands[0] : lineHand[line.folio + '|' + line.locus];
      return {mode, groups: hands.map(h => ({key: h, label: 'Hand ' + h, colour: HAND_COLOURS[h] || OTHER, members: [h]})), keyOf};
    }
    if (mode !== 'comparison') throw new Error('Unknown page grouping: ' + mode);
    const A = opts.search, B = opts.compare, label = opts.label || (k => k), colour = opts.populationColours || {};
    // opts.member(key) gives a population's line test (Golf v2 classes too); by default a line's own populations
    const member = opts.member || (key => line => line.sections.includes(key)), inA = member(A), inB = member(B);
    const same = A === B;
    const keyOf = line => { const a = inA(line), b = !same && inB(line); return a && b ? 'both' : a ? 'A' : b ? 'B' : 'other'; };
    // Rows are whole populations (the overlap counts in both), so they match the counts above the chart.
    const groups = [{key: 'A', label: label(A), colour: colour[A] || '--secA', members: same ? ['A'] : ['A', 'both'], role: 'search'}];
    if (!same) groups.push({key: 'B', label: label(B), colour: colour[B] || '--secB', members: ['B', 'both'], role: 'comparison'});
    groups.push({key: 'other', label: 'Rest of manuscript', colour: OTHER, members: ['other']});
    const both = !same ? {key: 'both', label: `${label(A)} and ${label(B)}`, colours: [colour[A] || '--secA', colour[B] || '--secB']} : null;
    return {mode, groups, both, keyOf};
  }

  // Groups left out of a view (by key): the grouping without them, and `keep(line)` for the text that stays, a line
  // staying when its own group (its page's, or its hand on a split page) is shown. Filtering lines and matches with
  // `keep` removes the hidden groups from the units, the chart and the table; the total row then covers the groups
  // shown. Hiding every group is refused (the view would be empty).
  function hideGroups(group, hidden = [], pages = []) {
    // keys that name no group of this grouping (from another Group by, or an old link) hide nothing
    const out = new Set(hidden.map(String)), gone = group.groups.filter(g => out.has(String(g.key))), shown = group.groups.filter(g => !out.has(String(g.key)));
    if (!gone.length || !shown.length) return {group, keep: () => true, hidden: []};
    const members = new Set(shown.flatMap(g => g.members.map(String))), pageOf = new Map(pages.map(p => [p.folio, p]));
    return {group: {...group, groups: shown, totalLabel: 'Shown groups'}, hidden: gone.map(g => g.key),
      keep: line => members.has(String(group.keyOf(line, pageOf.get(line.folio))))};
  }

  // Units and their readable words, text lines and matches per group. 'page': one unit per page. 'paragraph': the
  // paragraph lines of each page in locus order, a new unit at every paragraph-initial line, and one more unit per
  // page for all its other loci in scope (labels, circles, radii). 'bifolium': one unit per physical sheet (Golf's
  // `sheet`, a foldout counting as one) and 'quire': one unit per quire, each in the order of its first page; its
  // `page` lists its pages. A line's group always comes from its own page, so a sheet or quire whose pages fall in
  // different groups is split between them. `matches` are occurrences from the search engine. With a rate `base`
  // (workbench_core.js rateBase: a test of {line, index, word}), tokens and lines count only the words in the base and
  // the lines holding any, so rates are per word of that class; `words` keeps every readable word, for the band.
  function unitModel(pages, lines, matches, group, unit = 'page', base = null) {
    if (!['page', 'paragraph', 'bifolium', 'quire'].includes(unit)) throw new Error('Unknown unit: ' + unit);
    const pageAt = new Map(pages.map((p, i) => [p.folio, i])), byPage = new Map(), rows = [], rowOf = new Map(), bundles = new Map();
    const id = l => l.folio + '|' + l.locus;
    const make = (page, index, kind, n) => ({page, index, kind, n, tokens: {}, lines: {}, matches: {}, words: {}, totalTokens: 0, totalLines: 0, totalMatches: 0});
    for (const l of lines) {
      if (!pageAt.has(l.folio)) throw new Error('Line on unknown page ' + l.folio);
      if (!byPage.has(l.folio)) byPage.set(l.folio, []); byPage.get(l.folio).push(l);
    }
    const locus = l => { const n = parseFloat(l.locus); return Number.isFinite(n) ? n : Infinity; };
    pages.forEach((p, i) => {
      const own = byPage.get(p.folio) || [];
      if (unit === 'page') { const r = make(p, i, 'page', 0); rows.push(r); own.forEach(l => rowOf.set(id(l), r)); return; }
      if (unit === 'quire' || unit === 'bifolium') {
        const at = unit === 'quire' ? p.quire : p.sheet;
        if (!at) throw new Error(`No ${unit} for ${p.folio}`);
        let r = bundles.get(at);
        if (!r) {
          r = unit === 'quire' ? make({folio: p.folio, quire: p.quire, pages: []}, i, 'quire', quireNumber(p.quire))
            : make({folio: p.folio, sheet: p.sheet, quire: p.quire, pages: []}, i, 'bifolium', bundles.size + 1);
          bundles.set(at, r); rows.push(r);
        }
        r.page.pages.push(p); r.page.last = p.folio; own.forEach(l => rowOf.set(id(l), r)); return;
      }
      const ordered = own.map((l, k) => [l, k]).sort((a, b) => locus(a[0]) - locus(b[0]) || a[1] - b[1]).map(x => x[0]);
      let para = null, n = 0, other = null;
      for (const l of ordered) {
        if (category(l) === 'para') { if (!para || l.first) { para = make(p, i, 'para', ++n); rows.push(para); } rowOf.set(id(l), para); }
        else { if (!other) other = make(p, i, 'other', 0); rowOf.set(id(l), other); }
      }
      if (other) rows.push(other);
    });
    const add = (obj, k, v) => { obj[k] = (obj[k] || 0) + v; };
    const key = line => { const k = group.keyOf(line, pages[pageAt.get(line.folio)]); if (k == null) throw new Error(`No ${group.mode} group for ${line.folio}.${line.locus}`); return k; };
    const counted = base ? l => l.words.reduce((n, w, i) => n + (w && base({line: l, index: i, word: w}) ? 1 : 0), 0) : readable;
    for (const l of lines) {
      const row = rowOf.get(id(l)), all = readable(l); if (!all) continue;
      const k = key(l), n = base ? counted(l) : all; add(row.words, k, all); if (!n) continue;
      add(row.tokens, k, n); add(row.lines, k, 1); row.totalTokens += n; row.totalLines++;
    }
    for (const o of matches) {
      const row = rowOf.get(id(o.line)); if (!row) throw new Error('Match on unknown page ' + o.line.folio);
      add(row.matches, key(o.line), 1); row.totalMatches++;
    }
    return rows;
  }
  const pageModel = (pages, lines, matches, group) => unitModel(pages, lines, matches, group, 'page');
  const unitName = (r, short = false) => r.kind === 'quire' ? 'Q' + r.n : r.kind === 'bifolium' ? r.page.sheet : r.kind === 'para' ?`${r.page.folio} ¶${r.n}` : r.kind === 'other' ? `${r.page.folio}${short ? ' other' : ' · other loci'}` : r.page.folio;

  // Display order of units: manuscript (pages in order, paragraphs within them) or bifolia together, sheets in order
  // of their first page; or along Golf's proposed path (`path`: manuscript.golf_path), by each unit's place on it
  // (pathPlace). Ties fall to Golf's rank, then to page order, so a sheet's pages stay together in page order. Units
  // without a place (pages with no text Golf projected, the two zodiac sheets, quires) follow, in manuscript order.
  function rowOrder(rows, ordering = 'manuscript', path = null) {
    const idx = rows.map((r, i) => i);
    if (ordering === 'manuscript') return idx;
    const first = new Map(); rows.forEach(r => { if (!first.has(r.page.sheet) || r.index < first.get(r.page.sheet)) first.set(r.page.sheet, r.index); });
    const sheetFirst = (a, b) => first.get(rows[a].page.sheet) - first.get(rows[b].page.sheet);
    if (ordering === 'bifolium') return idx.sort((a, b) => sheetFirst(a, b) || rows[a].index - rows[b].index || a - b);
    if (!PATH_ORDERS.includes(ordering)) throw new Error('Unknown page order: ' + ordering);
    if (!path) throw new Error("Path orders need manuscript_data.js with Golf's proposed path; run build_manuscript.py");
    const at = rows.map(r => pathPlace(r, ordering, path));
    return idx.sort((a, b) => {
      const p = at[a], q = at[b];
      if (!p !== !q) return p ? -1 : 1;
      if (p && (p.position !== q.position || p.rank !== q.rank)) return p.position - q.position || p.rank - q.rank;
      return (sheetsTogether(ordering) ? sheetFirst(a, b) : 0) || rows[a].index - rows[b].index || a - b;
    });
  }
  // A unit's place on Golf's path: a bifolium unit, or any unit when sheets go together, at its sheet's pooled position;
  // otherwise at its page's own position (a paragraph at its page's). A quire has none. {position, rank, sheet} or null.
  function pathPlace(r, ordering, path) {
    if (r.kind === 'quire') return null;
    const sheet = r.kind === 'bifolium' || sheetsTogether(ordering), p = sheet ? path.sheets[r.page.sheet] : path.pages[r.page.folio];
    return p ? {position: p.position, rank: p.rank ?? Infinity, sheet} : null;
  }
  const pageOrder = (pages, ordering = 'manuscript', path = null) => rowOrder(pages.map((page, index) => ({page, index})), ordering, path);

  // Keys in stacking / legend order: groups, then the comparison overlap, then the rest.
  const drawKeys = group => [...group.groups.map(g => g.key).filter(k => k !== 'other'), ...(group.both ? ['both'] : []), ...(group.groups.some(g => g.key === 'other') ? ['other'] : [])];

  // Columns in one row. Combined: one column per unit with text in scope. Split: one facet per group, in legend
  // order; a unit appears in every group it has text in, showing only that group's part (f115r in two hands). At path
  // positions each column also carries its position (`pos`, null without one) and its block (a page's units, or a
  // sheet's when sheets go together), which columnFrame keeps side by side.
  function layoutColumns(rows, group, ordering = 'manuscript', layout = 'combined', path = null) {
    // a unit with words in any charted pattern's rate base (a second pattern's rows hang on .cmp, several on .all)
    const counted = r => r.all || [r, r.cmp];
    const order = rowOrder(rows, ordering, path).filter(i => counted(rows[i]).some(x => x?.totalTokens > 0)), keys = drawKeys(group);
    const placed = i => { if (!atPositions(ordering)) return {}; const p = pathPlace(rows[i], ordering, path);
      return {pos: p ? p.position : null, block: p ? (p.sheet ? 's:' + rows[i].page.sheet : 'p:' + rows[i].page.folio) : null}; };
    if (layout === 'combined') return {facets: [{key: null, label: '', start: 0, end: order.length}], columns: order.map(i => ({row: rows[i], keys, facet: 0, ...placed(i)}))};
    if (layout !== 'split') throw new Error('Unknown layout: ' + layout);
    const facets = [], columns = [];
    for (const g of group.groups) {
      const own = keys.filter(k => g.members.includes(k));
      const cols = order.filter(i => own.some(k => counted(rows[i]).some(x => x?.tokens[k]))).map(i => ({row: rows[i], keys: own, facet: facets.length, ...placed(i)}));
      if (!cols.length) continue;
      facets.push({key: g.key, label: g.label, colour: g.colour, start: columns.length, end: columns.length + cols.length});
      columns.push(...cols);
    }
    return {facets, columns};
  }
  const colTokens = c => sum(c.keys, c.row.tokens), colMatches = c => sum(c.keys, c.row.matches), colLines = c => sum(c.keys, c.row.lines);

  // Lefts for blocks of the given widths, kept in order and apart, each as near the left its centre asks for as the
  // others allow: least squares, so a run of touching blocks sits at the mean of its members' wishes. Then the runs are
  // pushed inside lo..hi (when the blocks fit there at all). blocks: [{centre, width}] in order.
  function placeBlocks(blocks, lo, hi) {
    const runs = [];
    blocks.forEach((b, i) => {
      let run = {first: i, last: i, width: b.width, sum: b.centre - b.width / 2, n: 1};
      for (let prev = runs[runs.length - 1]; prev && prev.sum / prev.n + prev.width > run.sum / run.n + 1e-9; prev = runs[runs.length - 1]) {
        runs.pop();
        run = {first: prev.first, last: run.last, width: prev.width + run.width, sum: prev.sum + run.sum - run.n * prev.width, n: prev.n + run.n};
      }
      runs.push(run);
    });
    let edge = lo;
    for (const r of runs) { r.left = Math.max(r.sum / r.n, edge); edge = r.left + r.width; }
    edge = hi;
    for (const r of [...runs].reverse()) { r.left = Math.max(lo, Math.min(r.left, edge - r.width)); edge = r.left; }
    const lefts = [];
    for (const r of runs) { let x = r.left; for (let i = r.first; i <= r.last; i++) { lefts[i] = x; x += blocks[i].width; } }
    return lefts;
  }
  // Round path values between lo and hi, about one per `room` pixels of `width`; the two ends when none fall inside.
  function pathTicks(lo, hi, width, room = 70) {
    if (!(hi > lo)) return [{value: lo, label: lo.toFixed(2)}];
    const step = niceWidth((hi - lo) / Math.max(1, Math.floor(width / room)), false), out = [];
    for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10));
    const decimals = Math.max(0, ...out.map(v => (String(v).split('.')[1] || '').length));
    return out.length >= 2 ? out.map(value => ({value, label: value.toFixed(decimals)})) : [lo, hi].map(value => ({value, label: value.toFixed(2)}));
  }
  // Where each column sits, from `left` to `W - right`: `x` (left edges), the slot each takes, the bar drawn in it,
  // each facet's span, each column's hover range, and the path ticks. Evenly spaced by default: one pitch per column and
  // `gap` between facets. At path positions (`positions`, columns carrying `pos`) each facet keeps the share of the
  // width its number of columns gives it and maps its own range of positions onto it. A slot is narrower than the
  // pitch, so the path's empty stretches stay empty; the columns of a block sit side by side, each block as near its
  // position as the others allow (placeBlocks). Columns without a position follow at the facet's end after a gap. One
  // facet gets round ticks on the path's scale; several (split by group) each get the range they span, as one label.
  function columnFrame(columns, facets, {W, left, right, gap = 0, positions = false}) {
    const inner = W - left - right - gap * Math.max(0, facets.length - 1), pitch = inner / Math.max(1, columns.length), x = [], spans = [];
    if (!positions) {
      columns.forEach((c, i) => { x[i] = left + i * pitch + c.facet * gap; });
      facets.forEach(f => spans.push(f.end > f.start ? [x[f.start], x[f.end - 1] + pitch] : [left, left]));
      return {x, slot: pitch, bar: Math.max(1, pitch - (pitch >= 3 ? 1 : 0)), spans, hits: x.map(v => [v, v + pitch]), ticks: [], tails: []};
    }
    const slot = Math.min(8, Math.max(1, pitch * 0.6)), tailGap = 12, ticks = [], tails = [];
    let start = left;
    facets.forEach((f, fi) => {
      const end = start + (f.end - f.start) * pitch, blocks = [], loose = [];
      for (let c = f.start; c < f.end; c++) {
        if (columns[c].pos == null) { loose.push(c); continue; }
        const last = blocks[blocks.length - 1];
        if (last && last.key === columns[c].block) last.cols.push(c); else blocks.push({key: columns[c].block, pos: columns[c].pos, cols: [c]});
      }
      const hi = end - (loose.length ? tailGap + loose.length * slot : 0), lo = start;
      if (blocks.length) {
        const pmin = Math.min(...blocks.map(b => b.pos)), pmax = Math.max(...blocks.map(b => b.pos));
        const at = v => pmax > pmin ? lo + slot / 2 + (v - pmin) / (pmax - pmin) * (hi - lo - slot) : (lo + hi) / 2;
        const lefts = placeBlocks(blocks.map(b => ({centre: at(b.pos), width: b.cols.length * slot})), lo, hi);
        blocks.forEach((b, k) => b.cols.forEach((c, j) => { x[c] = lefts[k] + j * slot; }));
        const [a, b] = [pmin, pmax].map(v => v.toFixed(2));
        if (facets.length > 1) ticks.push({value: pmin, label: a === b ? a : `${a}–${b}`, x: (lo + hi) / 2, facet: fi});
        else pathTicks(pmin, pmax, hi - lo).forEach(t => ticks.push({...t, x: at(t.value), facet: fi}));
      }
      const tail = blocks.length ? hi + tailGap : lo;      // a facet with no position at all starts at its left
      loose.forEach((c, j) => { x[c] = tail + j * slot; });
      if (loose.length) tails.push({facet: fi, start: tail, end: tail + loose.length * slot});
      spans.push([start, end]);
      start = end + gap;
    });
    // hover: each column's own slot, widened into the space beside it up to 6 px or halfway to its neighbour
    const hits = x.map(v => [v - 6, v + slot + 6]);
    facets.forEach(f => {
      const cols = []; for (let c = f.start; c < f.end; c++) cols.push(c);
      cols.sort((a, b) => x[a] - x[b]).forEach((c, k, all) => {
        if (k) hits[c][0] = Math.max(hits[c][0], (x[all[k - 1]] + slot + x[c]) / 2);
        if (k + 1 < all.length) hits[c][1] = Math.min(hits[c][1], (x[c] + slot + x[all[k + 1]]) / 2);
      });
    });
    return {x, slot, bar: Math.max(1, slot - (slot >= 3 ? 1 : 0)), spans, hits, ticks, tails};
  }

  const median = xs => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  // A unit's value under the chosen measure: matches, matches per readable word (shown as a percentage), matches per
  // 10,000 readable words, or matches per text line.
  const measureOf = (measure, m, t, l) => measure === 'percent' ? (t ? m / t : 0) : measure === 'per10k' ? (t ? 1e4 * m / t : 0)
    : measure === 'perline' ? (l ? m / l : 0) : m;
  // A column's value for each charted pattern (its units on c.row.all, in pattern order): the pattern's matches under
  // the measure, over its own words or lines. With `share`, each as a share of their sum (all 0 when nothing matches),
  // so a stacked bar fills to 100%: shares of the matches for counts, of the summed rates otherwise.
  function patternValues(c, measure, share = false) {
    const vs = c.row.all.map(r => measureOf(measure, sum(c.keys, r.matches), sum(c.keys, r.tokens), sum(c.keys, r.lines)));
    if (!share) return vs;
    const total = vs.reduce((a, b) => a + b, 0);
    return vs.map(v => total ? v / total : 0);
  }

  // One statistics row per group plus the whole manuscript. Rates are pooled (matches / words, matches / lines);
  // the median follows the measure (word rates for counts, per 10,000 words for that measure); the top unit follows
  // the measure.
  function statistics(rows, group, measure = 'count') {
    const totalMatches = rows.reduce((n, r) => n + r.totalMatches, 0);
    const summarize = (key, label, members) => {
      let units = 0, unitsWith = 0, matches = 0, tokens = 0, lines = 0, best = null; const rates = [], perLines = [];
      for (const r of rows) {
        const t = sum(members, r.tokens); if (!t) continue;
        const m = sum(members, r.matches), l = sum(members, r.lines);
        units++; tokens += t; matches += m; lines += l; if (m) unitsWith++; rates.push(m / t); perLines.push(l ? m / l : 0);
        const v = measureOf(measure, m, t, l);
        if (m && (!best || v > best.value)) best = {folio: r.page.folio, unit: unitName(r), value: v, matches: m, tokens: t, lines: l};
      }
      const med = median(measure === 'perline' ? perLines : rates);
      return {key, label, pages: units, pagesWith: unitsWith, matches, tokens, lines, rate: tokens ? matches / tokens : null,
        per10k: tokens ? 1e4 * matches / tokens : null, perLine: lines ? matches / lines : null,
        share: totalMatches ? matches / totalMatches : null, median: med != null && measure === 'per10k' ? 1e4 * med : med, best};
    };
    const out = group.groups.map(g => ({...summarize(g.key, g.label, g.members), colour: g.colour, hatch: g.hatch, dots: g.dots, members: g.members, role: g.role}));
    const all = [...new Set(group.groups.flatMap(g => g.members).concat(group.both ? ['both'] : []))];
    return {rows: out, total: summarize('total', group.totalLabel || 'Whole manuscript', all), totalMatches};
  }

  // Pearson's r of two equal-length samples; null below three pairs or when either sample is constant.
  function pearson(xs, ys) {
    const n = xs.length; if (n < 3) return null;
    const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
    return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
  }
  // Spearman's rho: Pearson's r of the ranks, ties sharing their average rank.
  const ranks = xs => {
    const order = xs.map((x, i) => i).sort((a, b) => xs[a] - xs[b]), out = new Array(xs.length);
    for (let i = 0; i < order.length;) { let j = i; while (j + 1 < order.length && xs[order[j + 1]] === xs[order[i]]) j++; for (let k = i; k <= j; k++) out[order[k]] = (i + j) / 2 + 1; i = j + 1; }
    return out;
  };
  const spearman = (xs, ys) => pearson(ranks(xs), ranks(ys));

  // For two patterns counted over the same units (rows and rowsC, in the same order): per group and over the whole
  // manuscript, the correlation of their unit values under the measure, across the units with text in the group
  // (each unit's own part there, as in the histograms).
  function correlations(rows, rowsC, group, measure = 'count') {
    const of = members => {
      const xs = [], ys = [];
      rows.forEach((r, i) => {
        const t = sum(members, r.tokens), l = sum(members, r.lines), tC = sum(members, rowsC[i].tokens), lC = sum(members, rowsC[i].lines);
        if (!t || !tC) return;                    // each pattern's rate is over its own base; both need words there
        xs.push(measureOf(measure, sum(members, r.matches), t, l)); ys.push(measureOf(measure, sum(members, rowsC[i].matches), tC, lC));
      });
      return {n: xs.length, r: pearson(xs, ys), rho: spearman(xs, ys)};
    };
    const all = [...new Set(group.groups.flatMap(g => g.members).concat(group.both ? ['both'] : []))];
    return {groups: Object.fromEntries(group.groups.map(g => [g.key, of(g.members)])), total: of(all)};
  }

  // About `count` evenly spaced round ticks from 0, the last at or above max.
  function niceTicks(max, count = 4, integer = false) {
    if (!(max > 0)) return [0, 1];
    const raw = max / count, mag = 10 ** Math.floor(Math.log10(raw));
    let step = [1, 2, 2.5, 5, 10].map(f => f * mag).find(s => s >= raw);
    if (integer) step = Math.max(1, Math.ceil(step));
    const ticks = []; for (let v = 0; v < max + step * 1e-9; v += step) ticks.push(+v.toFixed(10));
    if (ticks[ticks.length - 1] < max) ticks.push(+(ticks[ticks.length - 1] + step).toFixed(10));
    return ticks;
  }

  // A round bin width at or above `raw` (1, 2, 2.5 or 5 times a power of ten); whole numbers for counts.
  const niceWidth = (raw, integer) => {
    if (!(raw > 0)) return 1;
    const mag = 10 ** Math.floor(Math.log10(raw)), w = [1, 2, 2.5, 5, 10].map(f => f * mag).find(x => x >= raw - 1e-12);
    return integer ? Math.max(1, Math.ceil(w)) : w;
  };
  const quantile = (sorted, q) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))] : 0;

  // Histograms of each group's unit values on bins shared by every group, so the panels compare. The bins follow the
  // units that have matches, not the largest value: their width comes from the Freedman–Diaconis rule (2 × IQR ×
  // n^-1/3; Sturges when the spread is zero) or from a requested number of bins; with `clip`, outliers share one
  // last bin (see below), so a few cannot squeeze the rest into one bar; units without a match
  // get their own bin unless `zeros` is false (their number is reported either way). Counts use whole-number bins.
  // With `compare` (the same units counted for a second pattern), each series also gets the comparison's counts,
  // and the bins follow both patterns' values. With `all` (the same units counted for each of several patterns), each
  // series gets one tally per pattern (`tallies`), a group stays when any pattern has units there, and the bins follow
  // every pattern's values.
  function histograms(rows, group, measure = 'count', opts = {}) {
    const {bins: want = 'auto', zeros = true, clip = true, compare = null, all = null} = opts;
    const integer = measure === 'count';
    const valuesOf = (units, g) => {
      const values = [];
      for (const r of units) { const t = sum(g.members, r.tokens); if (t) values.push(measureOf(measure, sum(g.members, r.matches), t, sum(g.members, r.lines))); }
      return values;
    };
    const series = group.groups.map(g => ({key: g.key, label: g.label, colour: g.colour, hatch: g.hatch, dots: g.dots, values: valuesOf(rows, g), valuesC: compare ? valuesOf(compare, g) : null,
      valuesAll: all ? all.map(units => valuesOf(units, g)) : null})).filter(s => s.values.length || (s.valuesAll || []).some(v => v.length));
    const nz = series.flatMap(s => s.values.concat(s.valuesC || [], ...(s.valuesAll || []))).filter(v => v > 0).sort((a, b) => a - b), max = nz.length ? nz[nz.length - 1] : 0;
    // Outliers: above the 95th percentile with 20 or more units with matches; with 5-19, beyond 3 IQR above the
    // upper quartile (Tukey's far-out fence); fewer than 5 are never split.
    let upper = max;
    if (clip && nz.length >= 20) { const q = quantile(nz, 0.95); if (q > 0 && q < max) upper = q; }
    else if (clip && nz.length >= 5) { const q3 = quantile(nz, 0.75), fence = q3 + 3 * (q3 - quantile(nz, 0.25)); if (fence > 0 && fence < max) upper = fence; }
    let width = 1;
    if (upper > 0) {
      const inRange = nz.filter(v => v <= upper), iqr = quantile(inRange, 0.75) - quantile(inRange, 0.25);
      const fd = 2 * iqr / Math.cbrt(Math.max(1, inRange.length));
      const k = want === 'auto' ? Math.min(48, Math.max(6, Math.round(fd > 0 ? upper / fd : Math.log2(Math.max(1, inRange.length)) + 1))) : Math.max(1, +want);
      width = niceWidth(upper / k, integer);
    }
    const bins = zeros ? [{lo: 0, hi: 0, exact: true}] : [];
    if (upper > 0) {
      if (integer && width === 1) for (let v = 1; v <= Math.round(upper); v++) bins.push({lo: v, hi: v, exact: true});
      else for (let lo = 0; lo < upper - 1e-12; lo = +(lo + width).toFixed(12)) bins.push({lo, hi: +(lo + width).toFixed(12)});
    }
    const regular = bins.filter(b => !(b.exact && b.lo === 0)), top = regular.length ? regular[regular.length - 1].hi : 0;
    if (max > top + 1e-12) bins.push({lo: top, hi: max, overflow: true});
    const binOf = v => {
      if (v === 0) return zeros ? 0 : -1;
      return bins.findIndex(b => b.overflow ? v > b.lo + 1e-12 : b.exact ? v === b.lo : v > b.lo + 1e-12 && v <= b.hi + 1e-12);
    };
    const tally = values => {
      const out = {counts: bins.map(() => 0), zeros: 0, median: median(values), n: values.length, matchedMedian: median(values.filter(v => v > 0))};
      for (const v of values) {
        if (v === 0) out.zeros++;
        const i = binOf(v); if (i === -1) continue;
        if (i < 0) throw new Error('Value outside the bins: ' + v);
        out.counts[i]++;
      }
      return out;
    };
    for (const s of series) {
      Object.assign(s, tally(s.values));
      if (s.valuesC) { const c = tally(s.valuesC); Object.assign(s, {countsC: c.counts, zerosC: c.zeros, medianC: c.median, matchedMedianC: c.matchedMedian}); }
      if (s.valuesAll) s.tallies = s.valuesAll.map(tally);
    }
    return {bins, series, max, upper, width, top, zeros};
  }

  // x-axis labels: folio numbers (f1, f10, f20 ... restarting in each facet) or, with sheets together, sheet names at
  // the first page of each sheet; along the path by rank, each page's name; bifolium and quire units are labelled by
  // name. At path positions the path's own values label the axis instead (columnFrame ticks). Labels closer than their
  // own width to the previous one, or running past `right` (the plot's edge), are skipped.
  function axisLabels(columns, facets, ordering, xOf, right = Infinity) {
    if (atPositions(ordering)) return [];
    const out = [];
    for (const f of facets) {
      let next = null;
      for (let c = f.start; c < f.end; c++) {
        const p = columns[c].row.page;
        if (columns[c].row.kind === 'quire' || columns[c].row.kind === 'bifolium') { out.push({c, label: unitName(columns[c].row)}); continue; }
        if (sheetsTogether(ordering)) { if (c === f.start || p.sheet !== columns[c - 1].row.page.sheet) out.push({c, label: p.sheet}); continue; }
        if (ordering === 'path') { if (c === f.start || p.folio !== columns[c - 1].row.page.folio) out.push({c, label: p.folio}); continue; }
        const n = parseInt((p.folio.match(/^f(\d+)/) || [])[1], 10);
        if (c === f.start || n >= next) { out.push({c, label: 'f' + n}); next = n < 10 ? 10 : Math.floor(n / 10) * 10 + 10; }
      }
    }
    let last = -1e9;
    return out.filter(t => { const x = xOf(t.c), w = t.label.length * 5.6 + 8; if (x - last < w || x + w - 8 > right) return false; last = x; return true; });
  }

  // ------------------------------------------------------------------ drawing
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const num = n => Number(n).toLocaleString();
  const pctText = (x, digits) => x == null ? '—' : (100 * x).toFixed(digits ?? (100 * x >= 10 ? 1 : 2)) + '%';
  const lineText = x => x == null ? '—' : x.toFixed(x >= 1 ? 2 : 3);
  const per10kText = x => x == null ? '—' : !x ? '0' : x >= 100 ? num(Math.round(x)) : x.toFixed(x >= 10 ? 1 : 2);
  const plain = v => num(+v.toFixed(4));       // axis ticks and bin edges: round numbers, no trailing zeros
  const fill = c => `fill:var(${c})`;
  // A group's paint: its colour, or for a striped (hatch) or dotted (dots) group its colour in diagonal stripes or a
  // grid of dots (each covering about half and a third of the area). paint() is a CSS background for HTML swatches
  // and bars. In SVG, svgPaint() fills with a pattern that hatchDefs() defines under ids
  // unique to that drawing, since several charts can share a page.
  const paint = g => g.hatch ? `background:repeating-linear-gradient(135deg,var(${g.colour}) 0 2px,transparent 2px 4px)`
    : g.dots ? `background:radial-gradient(circle,var(${g.colour}) 0 1.2px,transparent 1.6px) 0 0/4px 4px` : `background:var(${g.colour})`;
  let hatchSeq = 0;
  const hatchIds = () => { const n = ++hatchSeq; return key => `pc-hatch-${n}-${String(key).replace(/[^\w-]/g, '_')}`; };
  const textured = g => g.hatch || g.dots;
  const hatchDefs = (groups, id) => groups.filter(textured).map(g => `<pattern id="${id(g.key)}" width="4" height="4" patternUnits="userSpaceOnUse"${g.hatch
    ? ` patternTransform="rotate(45)"><rect width="2" height="4" style="${fill(g.colour)}"/>` : `><circle cx="2" cy="2" r="1.3" style="${fill(g.colour)}"/>`}</pattern>`).join('');
  const svgPaint = (g, id) => textured(g) ? `fill:url(#${id(g.key)})` : fill(g.colour);
  const MODE_NAMES = {section: 'section', regime: 'Golf regime', regimeSplit: 'Golf regime +', golf2: 'Golf v2', golf2x: 'Golf v2 extended', golf21: 'Golf v2.1', golf21x: 'Golf v2.1 extended',
    rz: 'RZ language', currier: 'Currier language', hand: 'LFD hand', comparison: 'comparison'};
  const UNITS = {page: {one: 'page', many: 'pages'}, paragraph: {one: 'paragraph', many: 'paragraphs'}, bifolium: {one: 'bifolium', many: 'bifolia'},
    quire: {one: 'quire', many: 'quires'}};
  // A pattern label cut to about n characters at a whole term: back to the last space, then without a trailing
  // operator (AND, OR, NOT, &, |, !, an opening parenthesis), so it never ends on a bare connector; … marks the cut.
  // Shared by the chart's labels and the pattern comparison's column heads.
  function cutLabel(text, n = 28) {
    text = String(text ?? '');
    if (text.length <= n) return text;
    let cut = text.slice(0, n - 1);
    const space = cut.lastIndexOf(' ');
    if (space > n / 2) cut = cut.slice(0, space);
    return cut.replace(/(?:\s+(?:AND|OR|NOT)|\s*[&|!(])+\s*$/, '').trimEnd() + '…';
  }
  // The caption under the bars is one SVG line; when it is wider than `room` (long patterns, a narrow window) it
  // breaks after its separators (' · ', '; ') into lines, and the SVG grows to hold them.
  function wrapCaption(cap, room, H) {
    if (!cap || !cap.getComputedTextLength || cap.getComputedTextLength() <= room) return;
    const lines = [''];
    for (const part of cap.textContent.split(/(?<= · |; )/)) {
      cap.textContent = lines[lines.length - 1] + part;
      if (lines[lines.length - 1] && cap.getComputedTextLength() > room) lines.push(part); else lines[lines.length - 1] += part;
    }
    const x = cap.getAttribute('x'), svg = cap.ownerSVGElement, step = 13, height = H + step * (lines.length - 1);
    cap.textContent = '';
    lines.forEach((line, i) => {
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
      t.setAttribute('x', x); if (i) t.setAttribute('dy', step);
      t.textContent = line.replace(/\s*·\s*$/, '').trim(); cap.appendChild(t);
    });
    svg.setAttribute('height', height); svg.setAttribute('viewBox', `0 0 ${svg.getAttribute('width')} ${height}`);
  }
  // One resize observer per chart slot: re-mounting a slot (the app redraws its one chart) releases the old one, and
  // the viewer gives each of its charts a slot of its own.
  const observers = new Map();

  // Table cells, shared by the Matches by page table and the pattern comparison table. A group's value under a
  // measure is pooled over the group (statistics()); its text follows the measure.
  const MEASURE_VALUE = {count: s => s.matches, percent: s => s.rate || 0, per10k: s => s.per10k || 0, perline: s => s.perLine || 0};
  const MEASURE_TEXT = {count: s => num(s.matches), percent: s => pctText(s.rate), per10k: s => per10kText(s.per10k), perline: s => lineText(s.perLine)};
  const swatch = s => `<i class="pc-sw" style="${paint(s)}"></i>`;
  // An inline bar on a scale shared by the columns it is compared with (`max`); rows without a colour, the whole
  // manuscript, get none. A value above zero keeps a minimum width (class pc-nz), so a small value never looks empty.
  const inlineBar = (measure, s, max, cmp = false) => s.colour ? `<span class="pc-ib${cmp ? ' pc-cmp' : ''}"><i${MEASURE_VALUE[measure](s) > 0 ? ' class="pc-nz"' : ''} style="width:${(100 * MEASURE_VALUE[measure](s) / max).toFixed(1)}%;${paint(s)}"></i></span>` : '';
  // The value in a box as wide as the column's longest value, so the bars before it start at one margin however many
  // digits a row has.
  const valueBox = (measure, s, width) => `<span class="pc-num" style="min-width:${width}ch">${MEASURE_TEXT[measure](s)}</span>`;
  const valueWidth = (measure, stats) => 1 + Math.max(...stats.map(s => MEASURE_TEXT[measure](s).length));

  // Several patterns side by side: one row per group and one for the whole manuscript, one column per pattern, each
  // cell the group's value under the measure with its inline bar. The bar scale is the largest group value of the
  // whole table (scale 'table', as the two columns of a comparison in the Matches by page table share one), of each
  // column (scale 'column', for patterns of very different frequency), or of each row (scale 'row', to compare the
  // patterns within a group). `series`: [{stats (statistics() of that pattern, same grouping), head (header HTML,
  // escaped by the caller), title (header tooltip)}].
  function seriesTable(series, measure = 'count', opts = {}) {
    if (!series.length) return '';
    const rows = series[0].stats.rows, everyRow = series.flatMap(x => [...x.stats.rows, x.stats.total]), value = MEASURE_VALUE[measure];
    const columnMax = x => Math.max(1e-12, ...x.stats.rows.map(value)), tableMax = Math.max(...series.map(columnMax));
    const rowMax = rows.map((g, i) => Math.max(1e-12, ...series.map(x => value(x.stats.rows[i]))));
    const maxOf = (x, i) => opts.scale === 'column' ? columnMax(x) : opts.scale === 'row' ? rowMax[i] : tableMax;
    const width = valueWidth(measure, everyRow);
    // an empty last cell takes the spare width, so the columns sit next to the group names; the whole-manuscript row
    // (no index) has no bar
    const cells = (pick, i) => series.map(x => { const s = pick(x.stats); return `<td class="pc-m">${inlineBar(measure, s, maxOf(x, i))}${valueBox(measure, s, width)}</td>`; }).join('') + '<td class="pt-fill"></td>';
    const body = rows.map((g, i) => `<tr data-g="${esc(g.key)}"><td class="pc-name">${swatch(g)}${esc(g.label)}</td>${cells(st => st.rows[i], i)}</tr>`).join('')
      + `<tr class="pc-total" data-g="total"><td class="pc-name">${esc(series[0].stats.total.label)}</td>${cells(st => ({...st.total, colour: null}))}</tr>`;
    return `<div class="wb-scroll pc-tablewrap"><table class="wb-table pc-table pt-table"><thead><tr><th>Group</th>${series.map(x => `<th class="pt-head" title="${esc(x.title || '')}">${x.head}</th>`).join('')}<th class="pt-fill" aria-hidden="true"></th></tr></thead><tbody>${body}</tbody></table></div>`;
  }

  // The patterns charted: `series` ([{matches, query, tag, title, base, baseText, colour}], in drawing order), or one
  // pattern (`matches`, `query`, `base`, `baseText`) with an optional `compare` ({matches, query, base, baseText}), as
  // Words & contexts and the viewer give them. `arrange` (arrangement()) says how two or more share the chart: a second
  // pattern mirrored below the axis (its histograms below each panel's axis, its value next to the measure in the
  // table), stacked by pattern in `colour` (a CSS variable; stack100 as shares), or a row per pattern (`rowScale`:
  // 'shared' or 'own'). `tag` names a pattern briefly (#1); `onColour(k, id)` makes the key of a stacked chart offer
  // the colour families for pattern k (id '' = automatic); `groupKey` adds a key of the groups above the chart.
  function mount(el, opts) {
    const {pages, lines, group, measure = 'count', ordering = 'manuscript', layout = 'combined', unit = 'page', highlight = {}, names = {}, binning = {},
      slot = 'page', showTable = true, labelLength = 28, rowScale = 'shared', onColour = null, groupKey = false, path = null} = opts;
    const abbrev = text => cutLabel(text, labelLength);
    observers.get(slot)?.disconnect(); observers.delete(slot);
    // each pattern's rates are over its own base (workbench_core.js rateBase; none = all words)
    const series = opts.series || [{matches: opts.matches, query: opts.query || '', base: opts.base || null, baseText: opts.baseText || ''}, ...(opts.compare ? [opts.compare] : [])];
    const n = series.length, histogram = layout === 'histogram', arrange = arrangement(n, opts.arrange, histogram);
    const stacked = arrange === 'stack' || arrange === 'stack100', share = arrange === 'stack100', multi = stacked || arrange === 'rows';
    const compare = arrange === 'mirror' ? series[1] : null;            // the pattern drawn below the axis
    const query = series[0].query || '', baseText = series[0].baseText || '';
    const models = series.map(s => unitModel(pages, lines, s.matches, group, unit, s.base || null));
    const rows = models[0], stats = statistics(rows, group, measure);
    // two patterns: the second's units hang on .cmp (the mirrored bars, the table's second column, the correlation);
    // in a stack or rows, every pattern's units hang on .all, in pattern order
    const rowsC = n === 2 ? models[1] : null, statsC = rowsC ? statistics(rowsC, group, measure) : null;
    if (rowsC) rows.forEach((r, i) => { r.cmp = rowsC[i]; });
    if (multi) rows.forEach((r, i) => { r.all = models.map(m => m[i]); });
    const baseTextC = rowsC ? series[1].baseText || '' : '', rated = measure !== 'count';
    const tag = k => arrange === 'mirror' ? (k ? '▼' : '▲') : series[k].tag || '#' + (k + 1);
    // a pattern named with its tag in front, unless its query already starts with it (Compare patterns: '#2 *aiin')
    const named = (k, length = labelLength) => { const q = cutLabel(series[k].query || '(all)', length); return q.startsWith(tag(k) + ' ') ? q : `${tag(k)} ${q}`; };
    const bases = series.map(s => s.baseText || '');
    // several bases: each named once with its patterns, in pattern order ([pgi]* (#1), all words (#2, #3))
    const byBase = [...new Set(bases)].map(b => `${b || 'all words'} (${bases.map((x, k) => x === b ? tag(k) : null).filter(Boolean).join(', ')})`);
    const overText = !rated || bases.every(b => !b) ? '' : bases.every(b => b === bases[0]) ? ` · rates over ${bases[0]}`
      : arrange === 'mirror' ? ` · rates over ${baseText || 'all words'} ▲ and ${baseTextC || 'all words'} ▼`
      : ` · rates over ${byBase.join(', ')}`;
    const corr = rowsC ? correlations(rows, rowsC, group, measure) : null;
    const {facets, columns} = histogram ? {facets: [], columns: []} : layoutColumns(rows, group, ordering, layout, path);
    const hist = histogram ? histograms(rows, group, measure, {...binning, compare: arrange === 'mirror' ? rowsC : null, all: arrange === 'rows' ? models : null}) : null, keys = drawKeys(group);
    const U = UNITS[unit];
    const above = abbrev(query || '(all)'), below = compare ? abbrev(compare.query || '(all)') : '';
    const colourOf = k => series[k].colour || seriesColour(AUTO_COLOURS[k % AUTO_COLOURS.length]);
    const groupOf = k => group.groups.find(g => g.key === k) || {colour: OTHER}, hatchId = hatchIds();
    const keyFill = k => k === 'both' ? 'fill:url(#pc-both)' : svgPaint(groupOf(k), hatchId);
    const groupName = k => k === 'both' ? group.both.label : (group.groups.find(g => g.key === k) || {}).label;
    const perOf = (tokens, lines) => measure === 'percent' ? tokens || 1 : measure === 'per10k' ? (tokens || 1) / 1e4 : measure === 'perline' ? lines || 1 : 1;
    const per = c => perOf(colTokens(c), colLines(c)), perC = c => perOf(sum(c.keys, c.row.cmp.tokens), sum(c.keys, c.row.cmp.lines));
    const value = (c, k) => (c.row.matches[k] || 0) / per(c), total = c => colMatches(c) / per(c);
    const valueC = (c, k) => (c.row.cmp.matches[k] || 0) / perC(c), totalC = c => sum(c.keys, c.row.cmp.matches) / perC(c);
    const fmtValue = v => measure === 'percent' ? pctText(v) : measure === 'per10k' ? per10kText(v) : measure === 'perline' ? lineText(v) : num(v);
    const measureName = measure === 'percent' ? `matches as a share of each ${U.one}'s words`
      : measure === 'per10k' ? `matches per 10,000 words of each ${U.one}`
      : measure === 'perline' ? `matches per text line of each ${U.one}` : `matches in each ${U.one}`;
    const litPage = p => (highlight.folio && p.folio === highlight.folio) || (highlight.sheet && p.sheet === highlight.sheet);
    const lit = p => p.pages ? p.pages.some(litPage) : litPage(p);       // a quire is marked when any of its pages is
    const dominant = c => c.keys.reduce((best, k) => (c.row.words[k] || 0) > (c.row.words[best] || 0) ? k : best, c.keys[0]);
    // the drawing's frame (columnFrame): xOf gives a column's left edge and pitch its slot
    let pinned = null, xOf = () => 0, pitch = 1, frame = null, histLayout = null;

    // keys above the chart: a stack's patterns in their colours, and (groupKey) the groups, of the bars or of the band
    const keysHtml = stacked || groupKey ? `<div class="pc-keys">${stacked ? seriesKey() : ''}${groupKey ? groupKeyHtml() : ''}</div>` : '';
    el.innerHTML = `${keysHtml}<div class="pc-readout" aria-live="polite"></div><div class="pc-plot"></div>${showTable ? table() : ''}`;
    const plot = el.querySelector('.pc-plot'), readout = el.querySelector('.pc-readout');
    const render = () => (histogram ? (arrange === 'rows' ? drawHistogramRows() : drawHistograms()) : multi ? drawMulti() : draw());
    render();
    if (typeof ResizeObserver !== 'undefined') {
      let width = plot.clientWidth;
      const observer = new ResizeObserver(() => { if (Math.abs(plot.clientWidth - width) > 4) { width = plot.clientWidth; render(); } });
      observer.observe(plot); observers.set(slot, observer);
    }
    bindTable(); bindKeys();
    say(null);
    return {rows, stats, statsC, columns, facets, hist, models, arrange};

    function draw() {
      // With a comparison, its bars hang below the axis on the same scale; each side is as tall as its own largest
      // column needs. Without one, the chart is unchanged: one side, 180 px.
      const W = Math.max(560, plot.clientWidth || 900), left = 46, right = 10, top = 18, plotH = compare ? 240 : 180, gap = facets.length > 1 ? 14 : 0;
      const x0 = left;
      const barW = setFrame(W, left, right, gap);
      const maxS = Math.max(0, ...columns.map(total)), maxC = compare ? Math.max(0, ...columns.map(totalC)) : 0;
      const ticks = niceTicks(Math.max(maxS, maxC), 4, measure === 'count'), step = ticks[1] - ticks[0];
      const upS = compare ? Math.max(step, Math.ceil(maxS / step - 1e-9) * step) : ticks[ticks.length - 1] || 1;
      const upC = compare ? Math.max(step, Math.ceil(maxC / step - 1e-9) * step) : 0;
      const sc = plotH / (upS + upC), base = top + sc * upS, bottom = base + sc * upC, H = bottom + 74;
      const y = v => base - sc * v, yC = v => base + sc * v;
      const order = orderText();
      let svg = `<svg class="pc-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`Bars: ${measureName}${compare ? `, ${above} above the axis and ${below} below it` : ''}, ${order}${layout === 'split' ? ', split by ' : ', colored by '}${MODE_NAMES[group.mode] || group.mode}. The table below gives the totals by group.`)}">`;
      if (group.groups.some(textured)) svg += `<defs>${hatchDefs(group.groups, hatchId)}</defs>`;
      if (group.both) svg += `<defs><pattern id="pc-both" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="4" style="${fill(group.both.colours[0])}"/><rect x="2" width="2" height="4" style="${fill(group.both.colours[1])}"/></pattern></defs>`;
      // location filters are shown, not applied: marked above the plot and under the band (a column would read as a bar)
      columns.forEach((c, i) => { if (lit(c.row.page)) svg += `<rect class="pc-lit" x="${xOf(i)}" y="${top - 9}" width="${Math.max(pitch, 2)}" height="5"/><rect class="pc-lit" x="${xOf(i)}" y="${bottom + 12}" width="${Math.max(pitch, 2)}" height="3"/>`; });
      svg += `<line class="pc-hover" x1="-10" x2="-10" y1="${top}" y2="${bottom + 10}"/>`;
      const decimals = (String(+(100 * step).toFixed(10)).split('.')[1] || '').length;
      const tick = t => measure === 'percent' ? (100 * t).toFixed(decimals) + '%' : measure === 'perline' ? String(+t.toFixed(4)) : measure === 'per10k' ? plain(t) : num(t);
      const steps = up => Array.from({length: Math.round(up / step) + 1}, (_, i) => +(i * step).toFixed(10));
      const grid = (t, yy) => `<line class="pc-grid" x1="${x0}" x2="${W - right}" y1="${yy}" y2="${yy}"/><text class="pc-ytick" x="${x0 - 6}" y="${yy + 3.5}" text-anchor="end">${tick(t)}</text>`;
      steps(upS).forEach(t => { svg += grid(t, y(t)); });
      if (compare) steps(upC).slice(1).forEach(t => { svg += grid(t, yC(t)); });
      svg += separators(top, bottom);
      // bars: one stack per column, groups in legend order; the comparison's stack hangs from the axis
      columns.forEach((c, i) => {
        const x = xOf(i) + (pitch - barW) / 2;
        let acc = 0;
        for (const k of c.keys) {
          const v = value(c, k); if (!v) continue;
          const y1 = y(acc + v), h = y(acc) - y1; acc += v;
          svg += `<rect class="pc-bar" data-k="${k}" x="${x.toFixed(2)}" y="${y1.toFixed(2)}" width="${barW.toFixed(2)}" height="${Math.max(h, 0.8).toFixed(2)}" style="${keyFill(k)}"/>`;
        }
        if (!compare) return;
        acc = 0;
        for (const k of c.keys) {
          const v = valueC(c, k); if (!v) continue;
          const y1 = yC(acc), h = yC(acc + v) - y1; acc += v;
          svg += `<rect class="pc-bar pc-cmp" data-k="${k}" x="${x.toFixed(2)}" y="${y1.toFixed(2)}" width="${barW.toFixed(2)}" height="${Math.max(h, 0.8).toFixed(2)}" style="${keyFill(k)}"/>`;
        }
      });
      svg += axisLines(base);
      if (compare) svg += `<text class="pc-tag" x="${x0 + 4}" y="${top + 9}">▲ ${esc(above)}</text><text class="pc-tag" x="${x0 + 4}" y="${bottom - 4}">▼ ${esc(below)}</text>`;
      svg += under(bottom, W, right);
      svg += `<text class="pc-ytick pc-caption" x="${x0}" y="${H - 4}">Bar height: ${measureName}${compare ? `; ${esc(above)} above the axis, ${esc(below)} below` : ''}${esc(overText)} · band: each ${U.one}'s words by group · ${orderText()} →</text>`;
      finish(svg, top, bottom, H, W, x0, right);
    }

    // Several patterns (arrange 'stack', 'stack100' or 'rows'). Stacked: a bar per column, a segment per pattern in its
    // colour, the first pattern at the bottom and 1 px of surface between segments; stack100 draws each pattern's share
    // of the bar. Rows: a row of bars per pattern, the first on top, coloured by group as with one pattern, on one scale
    // for every row or each on its own (rowScale). The band, the names and the axis labels sit once, under the lowest row.
    function drawMulti() {
      const W = Math.max(560, plot.clientWidth || 900), left = 46, right = 10, gap = facets.length > 1 ? 14 : 0, x0 = left;
      const barW = setFrame(W, left, right, gap), vals = columns.map(c => patternValues(c, measure, share));
      const labelH = 15, gapR = 10, rowH = stacked ? 220 : Math.max(48, Math.min(120, Math.round(330 / n)));
      const top = stacked ? 18 : 18 + labelH, litY = top - (stacked ? 0 : labelH) - 9, baseOf = p => top + p * (rowH + labelH + gapR) + rowH;
      const bottom = baseOf(stacked ? 0 : n - 1), H = bottom + 74;
      const tickText = (t, step) => share ? Math.round(100 * t) + '%' : measure === 'percent' ? (100 * t).toFixed((String(+(100 * step).toFixed(10)).split('.')[1] || '').length) + '%'
        : measure === 'perline' ? String(+t.toFixed(4)) : measure === 'per10k' ? plain(t) : num(t);
      const grid = (t, yy, step) => `<line class="pc-grid" x1="${x0}" x2="${W - right}" y1="${yy}" y2="${yy}"/><text class="pc-ytick" x="${x0 - 6}" y="${yy + 3.5}" text-anchor="end">${tickText(t, step)}</text>`;
      const shareOf = measure === 'count' ? 'matches' : `summed rates (${measure === 'percent' ? '% of words' : measure === 'per10k' ? 'per 10,000 words' : 'per line'})`;
      const what = share ? `each pattern's share of the ${U.one}'s ${shareOf}` : stacked ? `${measureName}, a segment per pattern` : `${measureName}, a row per pattern, colored by group`;
      const names = series.map((s, k) => named(k)).join(', ');
      let svg = `<svg class="pc-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`Bars: ${what} (${names}), ${orderText()}${layout === 'split' ? ', split by ' : stacked ? ', with a band by ' : ', colored by '}${MODE_NAMES[group.mode] || group.mode}.`)}">`;
      if (group.groups.some(textured)) svg += `<defs>${hatchDefs(group.groups, hatchId)}</defs>`;
      if (group.both) svg += `<defs><pattern id="pc-both" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="4" style="${fill(group.both.colours[0])}"/><rect x="2" width="2" height="4" style="${fill(group.both.colours[1])}"/></pattern></defs>`;
      columns.forEach((c, i) => { if (lit(c.row.page)) svg += `<rect class="pc-lit" x="${xOf(i)}" y="${litY}" width="${Math.max(pitch, 2)}" height="5"/><rect class="pc-lit" x="${xOf(i)}" y="${bottom + 12}" width="${Math.max(pitch, 2)}" height="3"/>`; });
      svg += `<line class="pc-hover" x1="-10" x2="-10" y1="${top}" y2="${bottom + 10}"/>`;
      svg += separators(top, bottom);
      const axis = axisLines;
      const bar = (x, y1, h, attrs, style) => `<rect class="pc-bar" ${attrs} x="${x.toFixed(2)}" y="${y1.toFixed(2)}" width="${barW.toFixed(2)}" height="${Math.max(h, 0.8).toFixed(2)}" style="${style}"/>`;
      if (stacked) {
        const ticks = share ? [0, 0.25, 0.5, 0.75, 1] : niceTicks(Math.max(0, ...vals.map(v => v.reduce((a, b) => a + b, 0))), 4, measure === 'count');
        const up = ticks[ticks.length - 1] || 1, base = baseOf(0), y = v => base - rowH * v / up;
        ticks.forEach(t => { svg += grid(t, y(t), ticks[1] - ticks[0]); });
        columns.forEach((c, i) => {
          const x = xOf(i) + (pitch - barW) / 2, groups = c.keys.filter(k => c.row.words[k]).join(' ');
          let acc = 0;
          vals[i].forEach((v, k) => {
            if (!v) return;
            const y1 = y(acc + v), h = y(acc) - y1, below = acc > 0 && h > 2 ? 1 : 0; acc += v;
            svg += bar(x, y1, h - below, `data-s="${k}" data-k="${esc(groups)}"`, `fill:var(${colourOf(k)})`);
          });
        });
        svg += axis(base);
      } else {
        const most = k => Math.max(0, ...vals.map(v => v[k])), all = Math.max(0, ...series.map((s, k) => most(k)));
        series.forEach((s, k) => {
          const ticks = niceTicks(rowScale === 'own' ? most(k) : all, 2, measure === 'count'), up = ticks[ticks.length - 1] || 1, base = baseOf(k), y = v => base - rowH * v / up;
          svg += `<text class="pc-run" x="${x0}" y="${base - rowH - 5}">${esc(abbrev(s.query || '(all)'))}${rated && s.baseText ? ` <tspan class="pc-muted">over ${esc(s.baseText)}</tspan>` : ''}</text>`;
          ticks.forEach(t => { svg += grid(t, y(t), ticks[1] - ticks[0]); });
          columns.forEach((c, i) => {
            const x = xOf(i) + (pitch - barW) / 2, r = c.row.all[k], per = perOf(sum(c.keys, r.tokens), sum(c.keys, r.lines));
            let acc = 0;
            for (const key of c.keys) {
              const v = (r.matches[key] || 0) / per; if (!v) continue;
              const y1 = y(acc + v), h = y(acc) - y1; acc += v;
              svg += bar(x, y1, h, `data-k="${key}" data-s="${k}"`, keyFill(key));
            }
          });
          svg += axis(base);
        });
      }
      svg += under(bottom, W, right, stacked);
      // a stack of rates over different words adds rates with different bases; the caption says so
      const mixed = stacked && !share && rated && !bases.every(b => b === bases[0]);
      svg += `<text class="pc-ytick pc-caption" x="${x0}" y="${H - 4}">Bar height: ${esc(what)}${stacked ? `, ${esc(tag(0))} at the bottom` : rowScale === 'own' ? ', each row on its own scale' : ''}${esc(overText)}${mixed ? ' · the rates have different bases, so a bar’s total is not one rate' : ''} · band: each ${U.one}'s words by group · ${orderText()} →</text>`;
      finish(svg, top, bottom, H, W, x0, right);
    }

    // Under every bar chart: the group band (every column's group, so units without matches still show where they
    // belong; in bifolium order a hairline gap separates sheets), the names under it (facet names when split, runs of one
    // group when combined), and the axis labels
    // (soft: under a stack, the band is drawn faint, as is its key, so the pattern colours above stay apart from it)
    function under(bottom, W, right, soft = false) {
      let svg = '';
      columns.forEach((c, i) => {
        const tot = sum(c.keys, c.row.words), cut = sheetsTogether(ordering) && i + 1 < columns.length && columns[i + 1].facet === c.facet && columns[i + 1].row.page.sheet !== c.row.page.sheet ? 1.2 : 0;
        let off = 0; const parts = c.keys.filter(k => c.row.words[k]);
        parts.forEach((k, j) => { const w = (pitch - cut) * c.row.words[k] / tot;
          svg += `<rect class="pc-band${soft ? ' pc-soft' : ''}" data-k="${k}" x="${(xOf(i) + off).toFixed(2)}" y="${bottom + 3}" width="${(w + (j === parts.length - 1 && !cut ? 0.4 : 0)).toFixed(2)}" height="7" style="${keyFill(k)}"/>`; off += w; });
      });
      // a name cut to fit keeps its whole text as a tooltip
      const label = (x1, x2, text) => {
        const width = x2 - x1, room = Math.floor((width - 6) / 5.6);
        if (!text || room < 3) return '';
        const t = text.length <= room ? text : text.slice(0, room - 1) + '…';
        return `<text class="pc-run" x="${(x1 + x2) / 2}" y="${bottom + 22}" text-anchor="middle">${t === text ? '' : `<title>${esc(text)}</title>`}${esc(t)}</text>`;
      };
      // a group's name where it fits, else its code (the part before ': ', as 1.5a or 3d-c) where that fits
      const code = text => text.includes(': ') ? text.slice(0, text.indexOf(': ')) : '';
      const named = (width, text, least) => width >= Math.max(least, text.length * 5.6 + 8) ? text : code(text) && width >= Math.max(20, code(text).length * 5.6 + 8) ? code(text) : '';
      if (layout === 'split') facets.forEach((f, fi) => { const [a, b] = frame.spans[fi]; svg += label(a, b, named(b - a, f.label || '', 0) || f.label); });
      else {
        let start = 0;
        for (let i = 1; i <= columns.length; i++) {
          if (i < columns.length && dominant(columns[i]) === dominant(columns[start])) continue;
          const text = named(xOf(i - 1) + pitch - xOf(start), groupName(dominant(columns[start])) || '', 40);
          if (text) svg += label(xOf(start), xOf(i - 1) + pitch, text);
          start = i;
        }
      }
      const tick = (x, text, anchor = 'start') => `<line class="pc-tick" x1="${x}" x2="${x}" y1="${bottom + 26}" y2="${bottom + 31}"/><text class="pc-xtick" x="${x}" y="${bottom + 41}" text-anchor="${anchor}">${esc(text)}</text>`;
      axisLabels(columns, facets, ordering, xOf, W - right).forEach(t => { svg += tick(xOf(t.c), t.label); });
      // at path positions: the path's values under each facet (skipping labels that would touch), and a mark for the
      // units without a position at a facet's end
      let last = -1e9;
      frame.ticks.forEach(t => { const w = t.label.length * 5.6 + 6; if (t.x - w / 2 < last) return; svg += tick(t.x, t.label, 'middle'); last = t.x + w / 2; });
      frame.tails.forEach(t => { svg += `<text class="pc-xtick" x="${(t.start + t.end) / 2}" y="${bottom + 41}" text-anchor="middle">${t.end - t.start >= 60 ? 'no position' : 'none'}<title>No position on the path</title></text>`; });
      return svg;
    }
    function orderText() {
      const none = frame && frame.tails.length ? '; units without a path position come last' : '';
      return ordering === 'path' ? `order along Golf's proposed path, by rank${none}`
        : ordering === 'pathPos' ? `x: position on Golf's proposed path (0 = Early A end, 1 = Bio end), nudged apart where units would overlap${none}`
        : ordering === 'pathBif' ? `bifolia along Golf's proposed path, by rank, their pages together${none}`
        : ordering === 'pathBifPos' ? `x: bifolium position on Golf's proposed path (0 = Early A end, 1 = Bio end), its pages side by side${none}`
        : ordering === 'bifolium' ? 'bifolia together, in order of their first page' : unit === 'quire' ? 'quire order' : unit === 'bifolium' ? 'bifolia in order of their first page' : 'page order';
    }
    // The frame of a bar chart (columnFrame): sets xOf and pitch (the slot) and returns the bar width
    function setFrame(W, left, right, gap) {
      frame = columnFrame(columns, facets, {W, left, right, gap, positions: atPositions(ordering)});
      xOf = c => frame.x[c]; pitch = frame.slot;
      return frame.bar;
    }
    // dotted lines between facets, and each facet's axis
    function separators(top, bottom) {
      let svg = '';
      for (let f = 1; f < facets.length; f++) { const x = (frame.spans[f - 1][1] + frame.spans[f][0]) / 2; svg += `<line class="pc-sep" x1="${x}" x2="${x}" y1="${top}" y2="${bottom + 30}"/>`; }
      return svg;
    }
    function axisLines(yy) { return frame.spans.map(([a, b]) => `<line class="pc-axis" x1="${a}" x2="${b}" y1="${yy}" y2="${yy}"/>`).join(''); }
    // The end of every bar chart: a hover target per column (from `top` to under the band), the drawing, the caption's
    // wrap, hover and click to pin; then the readout is measured for the new drawing
    function finish(svg, top, bottom, H, W, x0, right) {
      columns.forEach((c, i) => { const [a, b] = frame.hits[i]; svg += `<rect class="pc-hit" data-i="${i}" x="${a}" y="${top}" width="${b - a}" height="${bottom - top + 12}"/>`; });
      plot.innerHTML = svg + '</svg>';
      wrapCaption(plot.querySelector('.pc-caption'), W - x0 - right, H);
      const hover = plot.querySelector('.pc-hover');
      const show = i => { const x = i == null ? -10 : xOf(i) + pitch / 2; hover.setAttribute('x1', x); hover.setAttribute('x2', x); say(i); };
      plot.querySelectorAll('.pc-hit').forEach(h => {
        h.onmouseenter = () => show(+h.dataset.i);
        h.onmouseleave = () => show(pinned);
        h.onclick = () => { pinned = pinned === +h.dataset.i ? null : +h.dataset.i; show(pinned); };
      });
      fitReadout();
      if (pinned != null) show(pinned);
    }

    // Small multiples, one per group, on shared bins; each panel has its own vertical scale and marks its median.
    function drawHistograms() {
      // Panels per row follow the width, but a change under 40 px (a scrollbar) keeps the last choice, so the panel
      // height cannot feed back into the width and make the layout oscillate.
      const W = Math.max(320, plot.clientWidth || 900), n = hist.series.length;
      if (!histLayout || Math.abs(W - histLayout.W) >= 40) histLayout = {W, cols: Math.max(1, Math.min(n, W >= 980 ? 3 : W >= 620 ? 2 : 1))};
      // with a comparison, each panel mirrors it below the axis on the same bins and the same vertical scale
      // (its medians and no-match counts take a second title line)
      const cols = histLayout.cols, gapX = 22, panelW = (W - gapX * (cols - 1)) / cols, plotH = compare ? 64 : 92, head = compare ? 34 : 22;
      const panelH = 36 + head + (compare ? 2 : 1) * plotH, left = 30;
      const rowsN = Math.max(1, Math.ceil(n / cols)), H = rowsN * (panelH + 14), nb = hist.bins.length;
      const tickOf = binTick, rangeOf = binRange;
      let svg = `<svg class="pc-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`Histograms, one per ${MODE_NAMES[group.mode] || group.mode} group: how many ${U.many} have each value of ${measureName}${compare ? `, ${above} above each axis and ${below} below it` : ''}. The table below gives the totals by group.`)}">`;
      if (group.groups.some(textured)) svg += `<defs>${hatchDefs(group.groups, hatchId)}</defs>`;
      const binOf = v => v == null ? -1 : hist.bins.findIndex(b => b.overflow ? v > b.lo + 1e-12 : b.exact ? v === b.lo : v > b.lo + 1e-12 && v <= b.hi + 1e-12);
      hist.series.forEach((s, si) => {
        const px = (si % cols) * (panelW + gapX), py = Math.floor(si / cols) * (panelH + 14), x0 = px + left, w = panelW - left - 6, base = py + head + plotH;
        const lowest = base + (compare ? plotH : 0);
        // with no-match units hidden, the median shown (and marked) is that of the units drawn
        const med = hist.zeros ? s.median : s.matchedMedian, medC = compare ? (hist.zeros ? s.medianC : s.matchedMedianC) : null;
        const show = v => v == null ? '—' : esc(fmtValue(v)), drawn = hist.zeros ? '' : ' with a match';
        const title = `<tspan style="${svgPaint(s, hatchId)}">■</tspan> ${esc(s.label)} · ${num(s.n)} ${s.n === 1 ? U.one : U.many}`;
        if (compare) svg += `<text class="pc-run" x="${px}" y="${py + 12}">${title}</text><text class="pc-ytick" x="${px}" y="${py + 25}">median ${show(med)} ▲ · ${show(medC)} ▼${drawn}${s.zeros || s.zerosC ? ` · without a match ${num(s.zeros)} ▲ · ${num(s.zerosC)} ▼` : ''}</text>`;
        else svg += `<text class="pc-run" x="${px}" y="${py + 12}" text-anchor="start">${title}${s.zeros ? ` · ${num(s.zeros)} without a match` : ''}${med == null ? '' : ` · median ${show(med)}${drawn}`}</text>`;
        if (!nb || !s.counts.some(Boolean) && !(compare && s.countsC.some(Boolean))) { svg += `<text class="pc-ytick" x="${x0}" y="${py + head + plotH / 2}">No ${U.many} with a match</text>`; return; }
        // the overflow bin sits apart from the regular bins
        const gap = hist.bins[nb - 1].overflow ? Math.min(10, w / (nb + 2)) : 0, bw = (w - gap) / nb, xb = b => x0 + b * bw + (hist.bins[b].overflow ? gap : 0);
        const ymax = Math.max(1, ...s.counts, ...(compare ? s.countsC : [])), yt = niceTicks(ymax, 2, true), topv = yt[yt.length - 1];
        const y = v => base - plotH * v / topv, yC = v => base + plotH * v / topv;
        const grid = (t, yy) => `<line class="pc-grid" x1="${x0}" x2="${x0 + w}" y1="${yy}" y2="${yy}"/><text class="pc-ytick" x="${x0 - 4}" y="${yy + 3.5}" text-anchor="end">${num(t)}</text>`;
        yt.forEach(t => { svg += grid(t, y(t)); });
        if (compare) yt.slice(1).forEach(t => { svg += grid(t, yC(t)); });
        const barAt = (b, c, cmp) => `<rect class="pc-bar${hist.bins[b].overflow ? ' pc-over' : ''}${cmp ? ' pc-cmp' : ''}" data-k="${esc(s.key)}" x="${(xb(b) + 0.5).toFixed(2)}" y="${(cmp ? base : y(c)).toFixed(2)}" width="${Math.max(1, bw - 1).toFixed(2)}" height="${(cmp ? yC(c) - base : base - y(c)).toFixed(2)}" style="${svgPaint(s, hatchId)}"/>`;
        s.counts.forEach((c, b) => {
          if (c) svg += barAt(b, c, false);
          if (compare && s.countsC[b]) svg += barAt(b, s.countsC[b], true);
          svg += `<rect class="pc-hit" data-s="${si}" data-b="${b}" x="${xb(b).toFixed(2)}" y="${py + head}" width="${bw.toFixed(2)}" height="${lowest - py - head}"/>`;
        });
        const mb = binOf(med), mbC = binOf(medC);
        // the dashed median over a surface-coloured halo, so it shows on bars of any colour (the intermediate groups
        // are drawn in the text colour)
        const medianAt = (b, y1, y2) => ['pc-median-halo', 'pc-median'].map(c => `<line class="${c}" x1="${xb(b) + bw / 2}" x2="${xb(b) + bw / 2}" y1="${y1}" y2="${y2}"/>`).join('');
        if (mb >= 0) svg += medianAt(mb, py + head - 4, base);
        if (mbC >= 0) svg += medianAt(mbC, base, lowest + 4);
        svg += `<line class="pc-axis" x1="${x0}" x2="${x0 + w}" y1="${base}" y2="${base}"/>`;
        const step = Math.max(1, Math.ceil(nb / Math.max(2, Math.floor(w / 56))));
        hist.bins.forEach((b, i) => { if (i % step === 0 || i === nb - 1 || b.overflow) svg += `<text class="pc-xtick" x="${xb(i) + bw / 2}" y="${lowest + 13}" text-anchor="middle">${esc(tickOf(b))}</text>`; });
      });
      plot.innerHTML = svg + '</svg>';
      plot.querySelectorAll('.pc-hit').forEach(h => {
        const s = hist.series[+h.dataset.s], b = hist.bins[+h.dataset.b], c = s.counts[+h.dataset.b];
        const counted = compare ? `▲ ${num(c)} · ▼ ${num(s.countsC[+h.dataset.b])} ${U.many} ${esc(rangeOf(b))} <span class="muted">of ${num(s.n)}</span>` : `${num(c)} of ${num(s.n)} ${s.n === 1 ? U.one : U.many} ${esc(rangeOf(b))}`;
        h.onmouseenter = () => { readout.innerHTML = `<b>${esc(s.label)}</b>: ${counted}`; settle(); };
        h.onmouseleave = () => say(null);
      });
    }

    // Histograms with a row per pattern (arrange 'rows'): a panel per group, as with one pattern, holding a small
    // histogram per pattern on the shared bins and on one vertical scale for the panel; each row names its pattern, its
    // number of units, its median and its units without a match.
    function drawHistogramRows() {
      const W = Math.max(320, plot.clientWidth || 900), panels = hist.series.length;
      if (!histLayout || Math.abs(W - histLayout.W) >= 40) histLayout = {W, cols: Math.max(1, Math.min(panels, W >= 980 ? 3 : W >= 620 ? 2 : 1))};
      const cols = histLayout.cols, gapX = 22, panelW = (W - gapX * (cols - 1)) / cols, head = 20, labelH = 16, rowH = Math.max(26, Math.min(56, Math.round(170 / n)));
      const panelH = head + n * (labelH + rowH) + 20, left = 30, rowsN = Math.max(1, Math.ceil(panels / cols)), H = rowsN * (panelH + 14), nb = hist.bins.length;
      const names = series.map((s, k) => named(k)).join(', ');
      let svg = `<svg class="pc-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`Histograms, one per ${MODE_NAMES[group.mode] || group.mode} group, a row per pattern (${names}): how many ${U.many} have each value of ${measureName}.`)}">`;
      if (group.groups.some(textured)) svg += `<defs>${hatchDefs(group.groups, hatchId)}</defs>`;
      const binOf = v => v == null ? -1 : hist.bins.findIndex(b => b.overflow ? v > b.lo + 1e-12 : b.exact ? v === b.lo : v > b.lo + 1e-12 && v <= b.hi + 1e-12);
      const show = v => v == null ? '—' : esc(fmtValue(v)), drawn = hist.zeros ? '' : ' with a match';
      hist.series.forEach((s, si) => {
        const px = (si % cols) * (panelW + gapX), py = Math.floor(si / cols) * (panelH + 14), x0 = px + left, w = panelW - left - 6;
        svg += `<text class="pc-run" x="${px}" y="${py + 12}"><tspan style="${svgPaint(s, hatchId)}">■</tspan> ${esc(s.label)}</text>`;
        const gap = nb && hist.bins[nb - 1].overflow ? Math.min(10, w / (nb + 2)) : 0, bw = (w - gap) / Math.max(1, nb), xb = b => x0 + b * bw + (hist.bins[b].overflow ? gap : 0);
        const topv = niceTicks(Math.max(1, ...s.tallies.flatMap(t => t.counts)), 1, true).slice(-1)[0];
        let lowest = py + head;
        s.tallies.forEach((t, k) => {
          const rTop = py + head + k * (labelH + rowH), base = rTop + labelH + rowH, y = v => base - rowH * v / topv; lowest = base;
          // with no-match units hidden, the median shown (and marked) is that of the units drawn
          const med = hist.zeros ? t.median : t.matchedMedian;
          svg += `<text class="pc-ytick" x="${px}" y="${rTop + 10}">${esc(named(k, 24))} · ${num(t.n)} ${t.n === 1 ? U.one : U.many}${med == null ? '' : ` · median ${show(med)}${drawn}`}${t.zeros ? ` · ${num(t.zeros)} without a match` : ''}</text>`;
          if (!nb || !t.counts.some(Boolean)) { svg += `<line class="pc-axis" x1="${x0}" x2="${x0 + w}" y1="${base}" y2="${base}"/>`; return; }
          svg += `<line class="pc-grid" x1="${x0}" x2="${x0 + w}" y1="${base - rowH}" y2="${base - rowH}"/><text class="pc-ytick" x="${x0 - 4}" y="${base - rowH + 8}" text-anchor="end">${num(topv)}</text>`;
          t.counts.forEach((c, b) => {
            if (c) svg += `<rect class="pc-bar${hist.bins[b].overflow ? ' pc-over' : ''}" data-k="${esc(s.key)}" x="${(xb(b) + 0.5).toFixed(2)}" y="${y(c).toFixed(2)}" width="${Math.max(1, bw - 1).toFixed(2)}" height="${(base - y(c)).toFixed(2)}" style="${svgPaint(s, hatchId)}"/>`;
            svg += `<rect class="pc-hit" data-s="${si}" data-p="${k}" data-b="${b}" x="${xb(b).toFixed(2)}" y="${rTop + labelH}" width="${bw.toFixed(2)}" height="${rowH}"/>`;
          });
          const mb = binOf(med);
          if (mb >= 0) svg += ['pc-median-halo', 'pc-median'].map(cls => `<line class="${cls}" x1="${xb(mb) + bw / 2}" x2="${xb(mb) + bw / 2}" y1="${base - rowH - 2}" y2="${base}"/>`).join('');
          svg += `<line class="pc-axis" x1="${x0}" x2="${x0 + w}" y1="${base}" y2="${base}"/>`;
        });
        const step = Math.max(1, Math.ceil(nb / Math.max(2, Math.floor(w / 56))));
        hist.bins.forEach((b, i) => { if (i % step === 0 || i === nb - 1 || b.overflow) svg += `<text class="pc-xtick" x="${xb(i) + bw / 2}" y="${lowest + 13}" text-anchor="middle">${esc(binTick(b))}</text>`; });
      });
      plot.innerHTML = svg + '</svg>';
      plot.querySelectorAll('.pc-hit').forEach(h => {
        const s = hist.series[+h.dataset.s], k = +h.dataset.p, t = s.tallies[k], b = hist.bins[+h.dataset.b], c = t.counts[+h.dataset.b];
        h.onmouseenter = () => { readout.innerHTML = `<b>${esc(s.label)}</b> · ${esc(named(k))}: ${num(c)} of ${num(t.n)} ${t.n === 1 ? U.one : U.many} ${esc(binRange(b))}`; settle(); };
        h.onmouseleave = () => say(null);
      });
    }
    // A bin's edge, its axis label and its description, in the measure's units
    function binEdge(v) { return measure === 'percent' ? pctText(v) : measure === 'perline' ? lineText(v) : measure === 'per10k' ? plain(v) : num(v); }
    function binTick(b) { return b.overflow ? '>' + binEdge(b.lo) : b.exact ? (b.lo === 0 && measure !== 'count' ? '0' : binEdge(b.lo)) : binEdge(b.hi); }
    function binRange(b) {
      return b.overflow ? `above ${binEdge(b.lo)} (the top values)` : b.exact ? (b.lo === 0 ? 'without a match' : `with ${num(b.lo)} ${b.lo === 1 ? 'match' : 'matches'}`)
        : measure === 'count' ? `with ${num(b.lo + 1)}–${num(b.hi)} matches` : `at ${binEdge(b.lo)}–${binEdge(b.hi)}`;
    }

    // The readout for column i (none: the hint). A unit split between groups lists each group's part under its
    // short name (a code such as 1a, or the whole name when it has none), so the line rarely wraps.
    function readoutHtml(i) {
      if (i == null) return `<span class="muted">${histogram ? 'Hover a bar to show how many ' + U.many + ' fall in it.' : `Hover a ${U.one} to show its counts; click to pin them.`}</span>`;
      const c = columns[i], r = c.row, p = r.page, hands = (p.hands || []).filter(Boolean), m = colMatches(c), t = colTokens(c), l = colLines(c);
      const parts = c.keys.filter(k => r.tokens[k]).map(k => ({k, m: r.matches[k] || 0, t: r.tokens[k]}));
      const short = k => { const n = groupName(k) || ''; return n.includes(': ') ? n.slice(0, n.indexOf(': ')) : n; };
      const split = parts.length > 1 ? ` · ${parts.map(x => `${esc(short(x.k))}: ${num(x.m)} of ${num(x.t)}`).join(' · ')}` : '';
      const part = t !== r.totalTokens ? `${esc(facets[c.facet].label || '')} part: ` : '', whole = t !== r.totalTokens ? `; whole ${U.one}: ${num(r.totalMatches)} in ${num(r.totalTokens)}` : '';
      const meta = r.kind === 'quire' ? [`quire ${p.quire}`, `${p.pages[0].folio}–${p.last}`, `${p.pages.length} pages`]
        : r.kind === 'bifolium' ? [`quire ${p.quire}`, p.pages.map(x => x.folio).join(', '), `${p.pages.length} ${p.pages.length === 1 ? 'page' : 'pages'}`]
        : [(names.section || {})[p.section] || p.section, p.regime ? ((names.regime || {})[p.regime] || p.regime) + ' regime' : 'no regime',
          p.rz ? 'RZ ' + p.rz : '', p.lang ? 'Currier ' + p.lang : 'no Currier language', hands.length ? 'hand ' + hands.join(', ') : '', 'sheet ' + p.sheet].filter(Boolean);
      if (path && PATH_ORDERS.includes(ordering) && r.kind !== 'quire') meta.push(pathNote(r));
      if (multi) {
        // each pattern: its value under the measure (and its share of a 100% bar), its matches and its words; words
        // are named by base only when the patterns' bases differ
        const v = patternValues(c, measure), sh = share ? patternValues(c, measure, true) : null, oneBase = bases.every(b => b === bases[0]);
        const of = layout === 'split' && Object.keys(r.words).some(k => r.words[k] && !c.keys.map(String).includes(k)) ? `<span class="pc-val">${esc(facets[c.facet].label || '')} part:</span>` : '';
        const items = series.map((s, k) => {
          const x = r.all[k], mk = sum(c.keys, x.matches), tk = sum(c.keys, x.tokens), lk = sum(c.keys, x.lines);
          const within = measure === 'perline' ? `${num(lk)} ${lk === 1 ? 'line' : 'lines'}` : `${num(tk)} ${!oneBase && s.baseText ? `words of ${esc(s.baseText)}` : tk === 1 ? 'word' : 'words'}`;
          const sw = stacked ? `<i class="pc-sw" style="background:var(${colourOf(k)})"></i>` : '';
          return `<span class="pc-rs">${sw}${esc(tag(k))} <b>${measure === 'count' ? num(mk) : esc(fmtValue(v[k]))}</b>${sh ? ` · ${pctText(sh[k], 1)} of the bar` : ''} <span class="muted">(${measure === 'count' ? '' : num(mk) + ' '}in ${within})</span></span>`;
        }).join('');
        return `<b class="mono">${esc(unitName(r))}</b> <span class="muted">${meta.map(esc).join(' · ')}</span>${of}${items}${pinned === i ? ' <span class="pc-pin">pinned</span>' : ''}`;
      }
      const rate = (x, n) => measure === 'per10k' ? per10kText(n ? 1e4 * x / n : 0) + ' per 10k words' : pctText(n ? x / n : 0);
      const where = (n, k, text) => `in ${num(n)} ${text ? `words of ${esc(text)}` : 'words'} and ${num(k)} ${k === 1 ? 'line' : 'lines'}`;
      const mC = compare ? sum(c.keys, r.cmp.matches) : 0, tC = compare ? sum(c.keys, r.cmp.tokens) : 0, lC = compare ? sum(c.keys, r.cmp.lines) : 0;
      const both = baseTextC === baseText ? where(t, l, baseText) : `▲ ${where(t, l, baseText)}, ▼ ${where(tC, lC, baseTextC)}`;
      const counts = compare ? `▲ <b>${num(m)}</b> · ▼ <b>${num(mC)}</b> matches ${both} · ▲ <b>${rate(m, t)}</b> · ▼ <b>${rate(mC, tC)}</b> · ${lineText(l ? m / l : 0)} / ${lineText(lC ? mC / lC : 0)} per line`
        : `<b>${num(m)}</b> ${m === 1 ? 'match' : 'matches'} ${where(t, l, baseText)} · <b>${rate(m, t)}</b> · ${lineText(l ? m / l : 0)} per line`;
      return `<b class="mono">${esc(unitName(r))}</b> <span class="muted">${meta.map(esc).join(' · ')}</span>
        <span class="pc-val">${part}${counts}${whole}${split}</span>${pinned === i ? ' <span class="pc-pin">pinned</span>' : ''}`;
    }
    // Where a unit sits on Golf's path, for the readout: its page's position (from its paragraph text, or else the
    // text Golf projected), and its sheet's pooled position when sheets go together; a bifolium unit its sheet's
    function pathNote(r) {
      const at = v => v.toFixed(3), sheet = path.sheets[r.page.sheet];
      const missing = 'no position on the path';
      if (r.kind === 'bifolium') return sheet ? `path ${at(sheet.position)}` : missing;
      const page = path.pages[r.page.folio], own = page ? at(page.position) + (page.text === 'para' ? '' : ` (from its ${page.text} text)`) : null;
      if (!sheetsTogether(ordering)) return own ? `path ${own}` : missing;
      return sheet ? `path ${at(sheet.position)} (its sheet; the page ${own ? 'at ' + own : 'has none'})` : missing;
    }
    // The readout keeps the tallest height it needs, so hovering along the chart never moves the chart up and down:
    // after each draw it is measured with the longest texts (fitReadout), and it never shrinks while shown (settle).
    function settle() { const h = readout.offsetHeight; if (h > (parseFloat(readout.style.minHeight) || 0)) readout.style.minHeight = h + 'px'; }
    function fitReadout() {
      readout.style.minHeight = '';
      const keep = readout.innerHTML, texts = columns.map((c, i) => readoutHtml(i)), plain = h => h.replace(/<[^>]*>/g, '').length;
      for (const i of texts.map((h, i) => i).sort((a, b) => plain(texts[b]) - plain(texts[a])).slice(0, 5)) { readout.innerHTML = texts[i]; settle(); }
      readout.innerHTML = keep; settle();
    }
    function say(i) {
      el.querySelectorAll('.pc-table tr.on').forEach(tr => tr.classList.remove('on'));
      readout.innerHTML = readoutHtml(i); settle();
      if (i == null) return;
      const c = columns[i], r = c.row;
      for (const k of c.keys.filter(k => r.tokens[k])) group.groups.forEach(g => { if (g.members.includes(k)) el.querySelector(`.pc-table tr[data-g="${CSS.escape(g.key)}"]`)?.classList.add('on'); });
    }

    function table() {
      // three or more patterns: a column per pattern (seriesTable); two: the second's value beside the measure shown,
      // marked ▲ ▼ when mirrored, else by the patterns' tags
      if (n > 2) return seriesTable(models.map((m, k) => ({stats: statistics(m, group, measure), head: `${esc(tag(k))} ${esc(abbrev(series[k].query || '(all)'))}`, title: series[k].title || series[k].query || ''})), measure);
      const A = tag(0), B = n === 2 ? tag(1) : '', second = n === 2 ? abbrev(series[1].query || '(all)') : '';
      const max = Math.max(1e-12, ...stats.rows.map(MEASURE_VALUE[measure]), ...(statsC ? statsC.rows.map(MEASURE_VALUE[measure]) : []));
      const best = s => !s.best ? '—' : `${esc(s.best.unit)} <span class="muted">${fmtValue(s.best.value)}</span>`;
      const bar = (s, cmp) => inlineBar(measure, s, max, cmp);
      const everyRow = [...stats.rows, stats.total, ...(statsC ? [...statsC.rows, statsC.total] : [])];
      const width = Object.fromEntries(Object.keys(MEASURE_TEXT).map(m => [m, valueWidth(m, everyRow)]));
      const value = (m, s) => valueBox(m, s, width[m]);
      // the two patterns' correlation over the group's units (Spearman's rho and n in the tooltip)
      const fixed = (x, d) => (x < 0 ? '−' : '') + Math.abs(x).toFixed(d);
      const corrCell = s => {
        const c = s.key === 'total' ? corr.total : corr.groups[s.key];
        const tip = c.r == null ? `Needs at least three ${U.many} and variation in both patterns` : `Pearson r ${fixed(c.r, 3)} · Spearman ρ ${c.rho == null ? '—' : fixed(c.rho, 3)} · ${num(c.n)} ${c.n === 1 ? U.one : U.many}`;
        return `<td class="pc-r" title="${tip}">${c.r == null ? '—' : fixed(c.r, 2)}</td>`;
      };
      // each measure's column; with a comparison, the measure shown gets a second column for it, on the same bar
      // scale, and then the correlation column
      const cell = (m, s, sC) => `<td class="pc-m">${measure === m ? bar(s) : ''}${value(m, s)}</td>`
        + (sC && measure === m ? `<td class="pc-m">${bar(sC, true)}${value(m, sC)}</td>${corrCell(s)}` : '');
      const row = (s, sC, cls = '') => `<tr class="${cls}" data-g="${esc(s.key)}"><td class="pc-name">${s.colour ? swatch(s) : ''}${esc(s.label)}</td>
        <td>${num(s.pagesWith)} <span class="muted">of ${num(s.pages)}</span></td>
        ${cell('count', s, sC)}<td>${s.share == null ? '—' : pctText(s.share, 1)}</td><td>${num(s.tokens)}</td><td>${num(s.lines)}</td>
        ${cell('percent', s, sC)}${cell('per10k', s, sC)}${cell('perline', s, sC)}
        <td>${s.median == null ? '—' : measure === 'perline' ? lineText(s.median) : measure === 'per10k' ? per10kText(s.median) : pctText(s.median)}</td><td>${best(s)}</td></tr>`;
      const head = (m, label, title) => statsC && measure === m
        ? `<th title="${esc(title + ': ' + (query || '(all)'))}">${esc(A)} ${label}</th><th title="${esc(title + ': ' + (series[1].query || '(all)'))}">${esc(B)} ${label}</th>`
          + `<th title="${esc(`Pearson's r of ${A} and ${B}, ${U.one} by ${U.one}, in the measure shown; hover a value for Spearman's ρ`)}">Correlation</th>`
        : `<th title="${title}">${label}</th>`;
      const overlap = group.both && rows.some(r => r.tokens.both);
      const Unit = U.one[0].toUpperCase() + U.one.slice(1), Units = U.many[0].toUpperCase() + U.many.slice(1);
      // a sheet or quire whose pages fall in different groups counts in each of them, with only its own pages there
      const split = unit === 'quire' || unit === 'bifolium' ? rows.filter(r => group.groups.filter(g => g.members.some(k => r.tokens[k])).length > 1).map(r => unitName(r)) : [];
      return `<div class="wb-scroll pc-tablewrap"><table class="wb-table pc-table"><thead><tr><th>Group</th><th title="${Units} with at least one match, of the group's ${U.many}">${Units} with matches</th>${head('count', 'Matches', 'Matches')}<th title="This group's share of all matches in the manuscript">Share</th><th title="${esc(baseText ? `Words of ${baseText}, the rate base, in the selected loci` : 'Readable words in the selected loci (unreadable tokens excluded)')}">Words</th><th title="${esc(baseText ? `Text lines with at least one word of ${baseText}` : 'Text lines with at least one readable word')}">Lines</th>${head('percent', 'Per word', 'Matches ÷ words, pooled over the group')}${head('per10k', 'Per 10k words', 'Matches per 10,000 words, pooled over the group')}${head('perline', 'Per line', 'Matches ÷ lines, pooled over the group')}<th title="Median of the group's ${U.one} rates${measure === 'perline' ? ' per line' : measure === 'per10k' ? ' per 10,000 words' : ' per word'}">Median ${U.one}</th><th title="${Unit} with the highest value of the chosen measure">Top ${U.one}</th></tr></thead>
        <tbody>${stats.rows.map((s, i) => row(s, statsC && statsC.rows[i])).join('')}${row({...stats.total, colour: null}, statsC && {...statsC.total, colour: null}, 'pc-total')}</tbody></table></div>
        ${baseText || baseTextC ? `<p class="wb-small">Rates over ${statsC && baseTextC !== baseText ? `${esc(baseText || 'all words')} ${esc(A)} and ${esc(baseTextC || 'all words')} ${esc(B)}` : esc(baseText)}: the words where the pattern and the position filters can match. The Words and Lines columns use that same base.</p>` : ''}
        ${statsC ? `<p class="wb-small">${esc(A)} ${esc(above)} · ${esc(B)} ${esc(second)}. Correlation pairs the two ${U.one} by ${U.one} within each group; the other columns count ${esc(A)} only.</p>` : ''}
        ${split.length ? `<p class="wb-small">Split between groups: ${esc(split.join(', '))}. Each group counts only the pages that fall within it.</p>` : ''}
        ${overlap ? `<p class="wb-small">Striped ${U.many} belong to both populations and count in both rows.</p>` : ''}`;
    }

    // A group of the table or the key stands out: its bars and band (a stacked segment carries every group of its
    // column, so a page's whole bar stays); a pattern of the key: its segments, the band untouched
    // (declarations, not constants: mount returns above them)
    function focus(on) { plot.classList.add('pc-focus'); plot.querySelectorAll('.pc-bar, .pc-band').forEach(b => b.classList.toggle('on', on(b))); }
    function focusGroup(g) { const members = g.members.map(String); focus(b => String(b.dataset.k ?? '').split(' ').some(k => members.includes(k))); }
    function unfocus() { plot.classList.remove('pc-focus', 'pc-sfocus'); }
    function focusSeries(k) { plot.classList.add('pc-sfocus'); plot.querySelectorAll('.pc-bar').forEach(b => b.classList.toggle('on', b.dataset.s === k)); }
    function bindTable() {
      el.querySelectorAll('.pc-table tbody tr[data-g]').forEach(tr => {
        const g = group.groups.find(x => String(x.key) === tr.dataset.g); if (!g) return;
        tr.onmouseenter = () => focusGroup(g);
        tr.onmouseleave = unfocus;
      });
    }

    // The keys: a stack's patterns (Bars), each with its colour, and the groups (of the bars, or of the Band under a
    // stack). With onColour, a pattern's key is a button that opens the colour families.
    function seriesKey() {
      return `<div class="pc-key"><span class="pc-key-name">Bars</span>${series.map((s, k) => {
        const inner = `<i class="pc-sw" style="background:var(${colourOf(k)})"></i>${esc(abbrev(s.query || '(all)'))}`;
        return onColour ? `<button type="button" class="pc-key-item pc-colour" data-s="${k}" aria-haspopup="dialog" aria-expanded="false" title="${esc(`Color of ${s.title || s.query || '(all)'}: click to change`)}">${inner}</button>`
          : `<span class="pc-key-item" data-s="${k}">${inner}</span>`;
      }).join('')}</div>`;
    }
    function groupKeyHtml() {
      return `<div class="pc-key">${stacked ? '<span class="pc-key-name">Band</span>' : ''}${group.groups.map(g => `<span class="pc-key-item" data-g="${esc(g.key)}"><i class="pc-sw${stacked ? ' pc-soft' : ''}" style="${paint(g)}"></i>${esc(g.label)}</span>`).join('')}</div>`;
    }
    function bindKeys() {
      const keysEl = el.querySelector('.pc-keys'); if (!keysEl) return;
      keysEl.querySelectorAll('.pc-key-item[data-s]').forEach(item => {
        item.onmouseenter = () => focusSeries(item.dataset.s);
        item.onmouseleave = unfocus;
        if (item.classList.contains('pc-colour')) item.onclick = () => openPicker(item);
      });
      keysEl.querySelectorAll('.pc-key-item[data-g]').forEach(item => {
        const g = group.groups.find(x => String(x.key) === item.dataset.g); if (!g) return;
        item.onmouseenter = () => focusGroup(g);
        item.onmouseleave = unfocus;
      });
    }
    // The colour families under pattern k's key: a column per family, light to deep downwards, the current colour
    // marked, and Automatic. A choice calls onColour(k, id) (Automatic: id ''); Escape or a click elsewhere closes it.
    function openPicker(button) {
      const keysEl = el.querySelector('.pc-keys'), k = +button.dataset.s, open = keysEl.querySelector('.pc-picker');
      if (open) { const same = open.dataset.s === button.dataset.s; closePicker(); if (same) return; }
      const current = (SERIES_COLOURS.find(c => c.colour === colourOf(k)) || {}).id;
      const pop = document.createElement('div');
      pop.className = 'pc-picker'; pop.dataset.s = k; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', `Color of ${series[k].title || series[k].query || tag(k)}`);
      pop.innerHTML = `<div class="pc-picker-grid">${['light', 'mid', 'deep'].flatMap(shade => SERIES_COLOURS.filter(c => c.shade === shade)).map(c =>
        `<button type="button" class="pc-pick${c.id === current ? ' on' : ''}" data-id="${c.id}" title="${esc(c.label)}" aria-label="${esc(c.label)}" aria-pressed="${c.id === current}" style="background:var(${c.colour})"></button>`).join('')}</div>`
        + `<button type="button" class="pc-picker-auto" data-id="" title="The next free color in the default order">Automatic</button>`;
      pop.style.left = button.offsetLeft + 'px'; pop.style.top = (button.offsetTop + button.offsetHeight + 6) + 'px';
      keysEl.appendChild(pop); button.setAttribute('aria-expanded', 'true');
      const away = e => { if (!pop.contains(e.target) && e.target !== button && !button.contains(e.target)) closePicker(); };
      pop.onclick = e => { const b = e.target.closest('[data-id]'); if (!b) return; closePicker(); onColour(k, b.dataset.id); };
      pop.onkeydown = e => { if (e.key === 'Escape') { e.stopPropagation(); closePicker(); button.focus(); } };
      document.addEventListener('pointerdown', away, true);
      pop.close = () => document.removeEventListener('pointerdown', away, true);
      (pop.querySelector('.pc-pick.on') || pop.querySelector('.pc-pick')).focus();
    }
    function closePicker() {
      const pop = el.querySelector('.pc-picker'); if (!pop) return;
      pop.close(); pop.remove();
      el.querySelectorAll('.pc-colour[aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
    }
  }

  const api = {GOLF_NUMBERS, GOLF2_PAINTS, INTERMEDIATE_COLOUR, paint, SECTION_COLOURS, RZ_COLOURS, RZ_LABELS, CURRIER_COLOURS, HAND_COLOURS, OTHER, rzClass, category, grouping, unitModel, pageModel, unitName,
    rowOrder, pageOrder, layoutColumns, axisLabels, statistics, histograms, niceWidth, measureOf, niceTicks, pearson, spearman, correlations, seriesTable, cutLabel, hideGroups, mount,
    SERIES_FAMILIES, SERIES_COLOURS, AUTO_COLOURS, seriesColour, assignColours, arrangement, patternValues,
    GOLF21_PAINTS, PATH_ORDERS, pathPlace, placeBlocks, pathTicks, columnFrame};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EchoPageChart = api;
})(typeof window !== 'undefined' ? window : globalThis);
