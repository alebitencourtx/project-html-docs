# Visual review and sign-off

Run after a successful build, before marking a document reviewed:

```bash
node <skill>/scripts/cli.mjs review <work>/documentacao.html --out <work>/review
```

The command uses installed Chrome, Edge or Chromium through CDP with Node >=22 native APIs. It downloads no browser or npm dependency. `doctor` reports browser availability separately from build readiness. Use `--browser <executable>` or `PHD_BROWSER` for nonstandard installations. It launches an isolated temporary profile and closes it after review.

The default is **1440 px desktop, smart tiles**: hero including cards, figures at the primary viewport, and the first part of sections with detected errors. DOM and interaction checks inspect all expanded sections at each requested width. Add `--viewports 1440,1024,390` when tablet/mobile review is requested. `--tiles all` adds every section (split into tiles up to 1600 px high), figures at every viewport and a blue-theme hero capture. Smart figure captures are capped at 1600 px; use all mode for complete tall-section coverage.

Each run writes PNGs, `review.json` and `rubric.md` in a unique subdirectory of `--out` (paths are returned in JSON). Without `--out`, the parent directory is `<html-basename>.review`. You may supply a receipt instead of HTML, or use `--receipt`/`--html` for custom filenames.

| Check | Detects |
|---|---|
| `text-escape` | Text outside cards/clipping boundaries or intersecting a neighboring card |
| `page-overflow` | Horizontal overflow of the document; local diagram/table scrolling is allowed |
| `grid-orphan` | Final single card after a row of multiple cards |
| `svg-text-escape` | SVG text outside viewport, node frame or inferred chip bounds |
| `svg-text-overlap` | Intersecting SVG text boxes |
| `literal-backtick` | Unrendered backticks in SVG text and diagram captions/notes |
| `console-error` | Browser exceptions and console errors |
| Interactions | Search hit/no-result/restore, expand/collapse, audience, theme, diagram Fit/Zoom/Escape, table filter, back-to-top and mobile drawer at <=960 px |

Optional widgets absent from a document are reported as skipped. Checks are heuristics using real browser geometry; they do not certify contrast, meaning, connector routing, cardinalities, print quality, keyboard focus traps, clipboard behavior or production facts. Inspect those when relevant. A successful exit (`0`) means automated checks passed, not that a person inspected the images. Review failures return `1`; argument/environment errors return `2`.

## Inspect and mark the rubric

Open **every** listed PNG and assess legibility, clipping, overlap, spacing, contrast and figure clarity. Keep each tile ID and the HTML hash/review ID intact:

```markdown
- [x] 1440-hero — 1440-hero.png
- [!] 1440-fig01-flow — 1440-fig01-flow.png
- [ ] 1440-fig02-schema — 1440-fig02-schema.png
```

`[x]` means inspected and acceptable, `[!]` flags a defect, `[ ]` is pending. Record issues in Notes, fix the inputs/renderer, rebuild and rerun review. Do not automatically check boxes based only on a passing report. When an independent fresh-eyes pass is warranted and delegation is available and authorized, give a reviewer only the tiles and rubric criteria, without prior conclusions; reconcile its observations before sign-off.

```bash
node <skill>/scripts/cli.mjs verify <work>/document.json <work>/documentacao.validation.json --strict --mark-reviewed --rubric <returned-rubric-path>
```

The gate refuses missing/stale review, automated errors, interaction failures, missing rubric, pending/flagged/missing tiles or a rubric from another run. A review is bound to the HTML SHA-256 and each rerun resets `browserReviewed` to false. Build likewise clears prior review evidence. Sign-off writes the receipt atomically.

If the browser is unavailable or a known issue must be accepted, explicitly disclose the limitation and use `--mark-reviewed --accept-issues "<reason of at least 10 characters>"`. This bypasses the **visual** gate and records `reviewOverride` (reason, timestamp, presence of review, bypassed reasons). It never bypasses source/artifact integrity failures. An overridden sign-off is an exception, not evidence that visual inspection passed.
