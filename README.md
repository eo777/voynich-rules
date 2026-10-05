# Echo rule analyzer

An interactive workbench from Echo, a study of the Voynich manuscript's two main dialects, known as Currier A and
Currier B (or the Currier languages). Echo proposes spelling rules that turn the word forms of one dialect into those
of the other. The rules were developed mainly on the herbal pages, from A to B; the app also compares other sections
and searches the whole manuscript. It applies a chosen set of rules and shows:

- the network of word forms the rules connect;
- how much of the difference in word frequencies the rules account for, including on manuscript sheets that were
  not used to fit them;
- what remains unexplained;
- where any word occurs in the manuscript, and next to which words.

It compares Voynich text with Voynich text; it does not assign meanings in a known language.

**Open the app:** https://eo777.github.io/voynich-rules/

## Running a copy

Everything is static. Open `index.html` straight from disk, or serve the folder (for example with
`python -m http.server`). Only a served copy checks for newer releases, because a page opened from disk cannot
read `version.json`.

## Versions and caching

Each release has a version, `YYYY.MM.DD` (then `.2`, `.3` … for later releases the same day), shown next to the
app's title and recorded as a git tag, `v<version>`, in this repository. Every file the page loads is requested
with a fingerprint of its contents (`file.js?v=<hash>`; not the release version), so a release replaces exactly the
files that changed and a page never mixes two releases. When the app is served from GitHub Pages, a browser may
reuse the page for up to ten minutes, so a served copy reads `version.json`, bypassing the cache, and offers a
reload when a newer release is live.

## Contents

| Path | What it is |
|---|---|
| `index.html` | The app |
| `*.js` | App code |
| `*_data.js` | The data the app reads: word forms, rules, page texts and saved results |
| `workbench.css` | Styles |
| `vendor/highs/` | The HiGHS linear-programming solver as WebAssembly, which fits the rules in the browser (MIT license) |
| `release.js`, `version.json` | The release stamp and the update check |

## Sources

- Text: the Zandbergen–Landini (ZL) transliteration in IVTFF format, version ZL3b of 13 May 2025, from René
  Zandbergen's site [voynich.nu](https://www.voynich.nu/).
- Page languages: René Zandbergen's [extension of the Currier languages](https://www.voynich.nu/extra/rz_lang.html),
  from a snapshot; the app shows its date.
- Page groupings beyond Currier A/B, called Golf regimes in the app after the project workstream that adopted them:
  npcompl33t, [Independent Analysis Identifying
  Languages Beyond Currier A/B, compared to René Zandbergen](https://www.voynich.ninja/thread-6084.html) (Voynich
  Ninja).
- Scribes: Lisa Fagin Davis's hand attributions, as recorded in the transliteration.
- [HiGHS](https://github.com/ERGO-Code/HiGHS) 1.15.3, through the [highs](https://github.com/lovasoa/highs-js) npm
  package; license in `vendor/highs/LICENSE`.

## This repository is generated

The app is developed in a separate research workspace, which is not published. A publishing script copies the app
here, replacing the files it manages, so changes made here are overwritten. Files added here by hand, such as
`CNAME` or `LICENSE`, are left alone.
