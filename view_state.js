/* Links to a view: the part after # holds the tab and the settings that make the view, as plain parameters
 * (#v=1&tab=net&mid=HA_late&rules=C3,ed&q=chol). network.html writes them (copy link) and applies them on load; each
 * tab reads only its own parameters and ignores values it does not accept. The parameters are listed in VIEWS.md.
 */
(function (root) {
  'use strict';
  const VERSION = '1';

  // {tab: 'net', q: 'chol', rules: ['C3', 'ed'], min: 6} -> 'v=1&tab=net&q=chol&rules=C3,ed&min=6'. Empty values are
  // left out, except `rules`, where an empty list means "no rules".
  function encode(view) {
    const p = new URLSearchParams({v: VERSION});
    for (const [k, v] of Object.entries(view)) {
      if (v == null || (v === '' && k !== 'rules')) continue;
      p.set(k, Array.isArray(v) ? v.join(',') : typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
    }
    return p.toString().replace(/%2C/g, ',');      // lists stay readable; commas are allowed after #
  }
  // '#v=1&tab=net&...' -> {tab: 'net', ...} with string values, or null when the hash is not a view link.
  function decode(hash) {
    const p = new URLSearchParams(String(hash || '').replace(/^#/, ''));
    if (p.get('v') !== VERSION || !p.get('tab')) return null;
    return Object.fromEntries([...p.entries()].filter(([k]) => k !== 'v'));
  }

  // Readers for decoded values: each returns undefined for a value the view should ignore.
  const read = {
    oneOf: (v, allowed) => allowed.includes(v) ? v : undefined,
    list: v => v == null ? undefined : v.split(',').map(x => x.trim()).filter(Boolean),
    text: (v, max = 200) => typeof v === 'string' && v.length <= max ? v : undefined,
    number: (v, lo, hi) => { const n = Number(v); return v != null && v !== '' && Number.isFinite(n) && n >= lo && n <= hi ? n : undefined; },
    flag: v => v === '1' ? true : v === '0' ? false : undefined,
  };
  // Copies each readable parameter onto `target` (name in the link -> field), returning the fields set.
  function assign(target, params, fields) {
    const set = [];
    for (const [name, [field, reader]] of Object.entries(fields)) {
      if (!(name in params)) continue;
      const value = reader(params[name]);
      if (value !== undefined) { target[field] = value; set.push(field); }
    }
    return set;
  }

  const api = {VERSION, encode, decode, read, assign};
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.EchoViewState = api;
})(typeof window !== 'undefined' ? window : globalThis);
