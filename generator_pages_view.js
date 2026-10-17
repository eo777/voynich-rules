/* Full-page context for a verified chain in the pinned Java generator. */
(function (root) {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  let host = null, back = null, observer = null, selected = 3400;
  const data = () => root.ECHO_GENERATOR_PAGES_DATA;
  const chain = () => data()?.chain || [];
  const location = t => `${t.page}:${t.locus} · word ${t.position + 1}`;
  const description = t => `${t.word} · ${location(t)} · generated line ${t.line} · token #${t.id} · ${t.sectionCount} occurrence${t.sectionCount === 1 ? '' : 's'} in the ${t.stage}-sized comparison window · ${t.mode} / ${t.method}`;

  function tokenHtml(t) {
    const c = chain().find(n => n.id === t.id);
    if (!c) return `<span class="va-tok gp-context" data-gp-token="${t.id}">${esc(t.word)}</span>`;
    const rank = chain().indexOf(c) + 1;
    return `<button type="button" class="va-tok gp-node ${rank < 3 ? 'gp-old' : 'gp-new'} ${c.sectionCount === 1 ? 'gp-hapax' : ''}" data-gp-token="${t.id}" data-gp-select="${t.id}" title="${esc(description(c))}" aria-label="${esc(description(c))}"><sup>${rank}</sup>${esc(t.word)}</button>`;
  }

  function pageHtml(p) {
    return `<section class="wb-card va-page gp-page" data-gp-page="${esc(p.id)}"><h3>${esc(p.id)} <span class="wb-small">Generated lines ${p.startLine}–${p.endLine} · all 29 lines</span></h3>
      <p class="wb-small gp-page-caption">${p.id === 'G14' ? 'Three solid arrows are logged parent links within this page.' : 'The highlighted token borrows from the paragraph-start archive on G14; its parent is not on this page.'}</p>
      <div class="va-text va-s gp-text">${p.lines.map(l => `<div class="va-line"><span class="va-ln" title="generated line ${l.line}${l.paragraphInitial ? ', paragraph start' : ''}">${l.locus}${l.paragraphInitial ? ' ¶' : ''}</span><span class="va-words">${l.tokens.map(tokenHtml).join('')}</span></div>`).join('')}<svg class="va-links gp-links" aria-hidden="true"></svg></div>
      <p class="wb-small gp-page-footer">Page-local line numbers; ¶ marks a paragraph start. The text is generated output, not manuscript transcription.</p></section>`;
  }

  function stepsHtml() {
    return chain().slice(1).map((t, i) => {
      const p = chain()[i], local = p.page === t.page;
      return `<button type="button" class="wb-button gp-step ${local ? '' : 'gp-remote-step'}" data-gp-select="${t.id}"><b>${esc(p.word)} → ${esc(t.word)}</b><span>${esc(p.page)}:${p.locus} → ${esc(t.page)}:${t.locus} · ${local ? 'same page' : 'archive borrowing'}</span></button>`;
    }).join('');
  }

  function updateSelection() {
    if (!host) return;
    const t = chain().find(n => n.id === selected) || chain()[2];
    const i = chain().indexOf(t), p = i > 0 ? chain()[i - 1] : null;
    for (const element of host.querySelectorAll('[data-gp-select]')) {
      const on = Number(element.dataset.gpSelect) === t.id;
      element.classList.toggle('gp-selected', on);
      element.setAttribute('aria-pressed', String(on));
    }
    const detail = host.querySelector('.gp-detail');
    if (detail) detail.innerHTML = p
      ? `<b>${esc(p.word)} → ${esc(t.word)}</b> · ${esc(location(p))} → ${esc(location(t))}. ${p.page === t.page ? `Known same-page parent; ${t.line - p.line} generated line${t.line - p.line === 1 ? '' : 's'} later.` : `Known remote parent: ${t.line - p.line} generated lines later, retrieved through the paragraph-initial archive. This edge does not support a same-page explanation.`} <span class="wb-small">Logged method: ${esc(t.method)}; source mode: ${esc(t.mode)}.</span>`
      : `<b>${esc(t.word)}</b> · ${esc(location(t))}. Start of the displayed chain; its own logged parent is on the preceding generated page.`;
    redraw();
  }

  function redraw() {
    if (!host?.isConnected) return;
    for (const card of host.querySelectorAll('.gp-page')) {
      const text = card.querySelector('.gp-text'), svg = card.querySelector('.gp-links');
      const bounds = text.getBoundingClientRect();
      svg.setAttribute('viewBox', `0 0 ${Math.max(1, bounds.width)} ${Math.max(1, bounds.height)}`);
      const marker = `gp-arrow-${card.dataset.gpPage}`;
      const paths = [];
      for (let i = 1; i < chain().length; i++) {
        const p = chain()[i - 1], t = chain()[i];
        if (p.page !== t.page || t.page !== card.dataset.gpPage) continue;
        const a = text.querySelector(`[data-gp-token="${p.id}"]`), b = text.querySelector(`[data-gp-token="${t.id}"]`);
        if (!a || !b) continue;
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        const x1 = ra.left + ra.width / 2 - bounds.left, y1 = ra.bottom - bounds.top;
        const x2 = rb.left + rb.width / 2 - bounds.left, y2 = rb.top - bounds.top - 2;
        let d;
        if (t.line - p.line > 3) {
          const gutter = 9;
          d = `M ${x1} ${y1} C ${x1} ${y1 + 12}, ${gutter} ${y1 + 12}, ${gutter} ${y1 + 22} L ${gutter} ${y2 - 20} C ${gutter} ${y2 - 9}, ${x2} ${y2 - 9}, ${x2} ${y2}`;
        } else {
          const middle = (y1 + y2) / 2;
          d = `M ${x1} ${y1} C ${x1} ${middle}, ${x2} ${middle}, ${x2} ${y2}`;
        }
        paths.push(`<path class="gp-parent-link ${selected === t.id ? 'gp-active-link' : ''}" data-gp-parent="${p.id}" data-gp-child="${t.id}" marker-end="url(#${marker})" d="${d}"><title>${esc(p.word)} → ${esc(t.word)}: verified same-page parent</title></path>`);
      }
      svg.innerHTML = `<defs><marker id="${marker}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"/></marker></defs>${paths.join('')}`;
    }
  }

  function show(target, onBack, options = {}) {
    leave(); host = target; back = onBack;
    if (!data()) { host.innerHTML = '<p class="wb-notice">Generated page data is unavailable.</p>'; return; }
    const embedded = !!options.embedded;
    if (options.selectedId != null && chain().some(t => t.id === Number(options.selectedId))) selected = Number(options.selectedId);
    host.innerHTML = `<div class="gp-root${embedded ? ' gp-embedded' : ''}"><div class="gp-heading"><div><${embedded ? 'h3' : 'h2'}>Actual generator · complete pages</${embedded ? 'h3' : 'h2'}><p class="wb-small">Pinned Java generator · seed 1 · actual accepted-token ancestry${embedded ? ' · shown alongside the manuscript evidence' : ''}</p></div>${embedded ? '' : '<button class="wb-button" data-gp-back>Back to manuscript pages</button>'}</div>
      <p class="gp-summary"><b>G14 contains the local chain: chol → ychol → ycheor → cheor.</b> Its first two steps span consecutive lines; the third returns to the changed form 19 lines later on the same page.</p>
      <div class="gp-steps">${stepsHtml()}</div><div class="wb-notice gp-detail" aria-live="polite"></div>
      <div class="gp-legend"><span><i class="gp-swatch gp-old"></i>Before the added e</span><span><i class="gp-swatch gp-new"></i>Added e preserved</span><span><i class="gp-swatch gp-hapax"></i>Section hapax: ycheor</span><span>Solid arrow: verified same-page parent</span></div>
      <p class="wb-small gp-rarity"><b>Ycheor occurs once</b> in the 1,798-token generated window matched to 1.5a, yet is the logged parent of cheor. The window names match manuscript sample sizes; they are not manuscript section identities.</p>
      <div class="gp-archive"><b>Separate mechanism — remote paragraph-initial borrowing:</b> cheor on G14:22 → cheo on G28:18. These words are on different pages, separated by 402 generated lines. No same-page arrow is drawn for this edge.</div>
      <p class="wb-small gp-page-structure">G14 and G28 are separate generated pages, not a bifolium. The generator does not assign physical sheets or conjugate leaves.</p>
      <div class="va-pages gp-pages">${data().pages.map(pageHtml).join('')}</div>
      <p class="wb-small gp-provenance">Both pages are shown in full, including the end of G28 beyond the 7,316-token comparison window. Source: Torsten Timm’s SelfCitationTextgenerator, commit ${esc(data().commit.slice(0, 12))}. Passive trace instrumentation was verified against identical uninstrumented output.</p></div>`;
    host.querySelector('[data-gp-back]')?.addEventListener('click', () => back?.());
    for (const button of host.querySelectorAll('[data-gp-select]')) button.addEventListener('click', () => { selected = Number(button.dataset.gpSelect); updateSelection(); });
    if (root.ResizeObserver) { observer = new root.ResizeObserver(redraw); observer.observe(host); }
    root.addEventListener('resize', redraw);
    updateSelection();
    root.requestAnimationFrame(redraw);
  }

  function select(id) {
    if (!chain().some(t => t.id === Number(id))) return false;
    selected = Number(id);
    updateSelection();
    return true;
  }

  function leave() { observer?.disconnect(); observer = null; root.removeEventListener('resize', redraw); host = null; back = null; }
  root.EchoGeneratorPages = {show, leave, redraw, select};
})(window);
