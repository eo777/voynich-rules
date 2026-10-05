// Links to the research documents behind rules and results. Paths are relative to the research workspace root
// (solve/botanical_enrichment/ECHO_RULES.md). In the workspace a link opens the file itself, two folders up from
// this page. A published copy (publish/publish.py) sets ECHO_RELEASE.docs: the rendered copies it carries, or null
// when it carries none. A document the copy lacks gets no link at all, so callers drop empty results.
(function (root) {
  'use strict';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  function href(path) {
    const release = root.ECHO_RELEASE;
    if (!release) return '../../' + path;
    const docs = release.docs;
    if (docs && !docs[path]) console.warn('Not in this published copy: ' + path);
    return (docs && docs[path]) || null;
  }
  // `label` is HTML: callers escape their own text. Returns '' when the document is not available.
  function link(path, label, cls = '') {
    const url = href(path);
    return url ? `<a${cls ? ` class="${cls}"` : ''} href="${esc(url)}" target="_blank" rel="noopener">${label}</a>` : '';
  }
  root.EchoDocs = {href, link};
})(typeof window !== 'undefined' ? window : globalThis);
