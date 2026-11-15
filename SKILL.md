---
name: project-html-docs
description: Document an existing software or data-engineering project for business and technical readers as a self-contained HTML manual, with architecture, workflows, data relationships, business rules and usage instructions. Use to create or update project documentation, not to audit or redesign the implementation.
---

# Project HTML Docs

Document a repository's **current implemented state** as one self-contained, offline HTML manual backed by editable Markdown, JSON, and diagram text. Explain purpose, outputs, rules, and usage for non-technical readers before implementation details.

## References (Read on Demand)

- [Authoring contract](references/authoring.md) — manifest schema, Markdown/callout/table rules, validation, and incremental updates.
- [Diagrams, charts & UI](references/diagrams.md) — deterministic 2D `solution`/`flow`/`schema` specs, `mermaid`, `chart`, and desktop/mobile ergonomics.
- [Data engineering profile](references/data-engineering.md) — PySpark, Databricks, Delta Lake, Cosmos DB, Event Hubs, ADLS Gen2, and APIs.
- [Tools and scope](references/tools.md) — pinned runtime dependencies and build-time scope.
- Starter template: [examples/minimal/document.json](examples/minimal/document.json) and [examples/minimal/content.md](examples/minimal/content.md).

Resolve `<skill>` to the directory containing this SKILL.md; it is not the target repository or the shell working directory. Resolve user input/output paths from the caller's working directory.

## Prerequisites

- **Authoring only**: Node.js `>= 22` and Python `>= 3.10` (for repository inspection). Readers only need a browser.
- **First-time install**: `npm ci --ignore-scripts --prefix "<skill>"` (run `node "<skill>/scripts/cli.mjs" doctor` to check environment readiness).

## Workflow

1. **Discover & scope (zero LLM tokens)**
   - **New docs**:
     ```bash
     node "<skill>/scripts/cli.mjs" inspect <repo> --out <work>/inventory.json --plan <work>/reading-plan.md
     ```
     Respects `.docignore`, redacts secrets, and builds a 4-wave reading plan without executing project code.
   - **Updating existing docs**: first re-run `inspect`, then run:
     ```bash
     node "<skill>/scripts/cli.mjs" verify <work>/document.json <work>/documentacao.validation.json --impact --dossier <work>/inventory.json --plan <work>/update-plan.md
     ```
     Read `update-plan.md`: inspect and edit **only** changed sources, transitive dependents, and `stale` sections. If **only** the skill renderer changed (`renderer.needsRebuild: true` with all sources synced), skip reading/prose edits and jump directly to step 4 with `--force`.
2. **Read selectively from `reading-plan.md`**
   - Follow Waves (`Onda 1` Entrypoints/Configs → `Onda 2` Core/Pipelines/APIs → `Onda 3` Schemas/SQL/IaC).
   - For files `> 200` lines, read targeted `symbolIndex` ranges (`[Lstart-Lend]`); check `testsIndex` (`Onda 4`) only when resolving an ambiguous rule. For `scaleProfile.tier === "large"`, gather line-cited fact packs (`file:line`) by domain boundary.
   - Resolve contradictions from the implementing path; never treat historical plans as implemented behavior or run production jobs.
3. **Author inputs**
   - Write `<work>/document.json` and `<work>/content.md` (or `document-summary.json` + `content-summary.md` with `"mode": "summary"` for a 5–7 min Quick Guide; use `companionDoc` to cross-link them).
   - Match Markdown `## H2` headings to `sections[].title` in order; keep H3s for sidebar subnavigation; never use H1 in Markdown.
   - Populate `sections[].sources` on every section for `--impact` tracking, distribute `audience` across `all`, `business`, `technical`, and `operations`, and, for data projects, frame up to 4 Hero cards around **Origins**, **Cadence / Window**, **Delivery / Grain**, and **Scope / Limits**.
   - Keep extensive field dictionaries inside nested `<details>` blocks, explain business rules with worked matrices and semantic blockquotes (`> Regra de negócio:`, `> Exemplo prático:`, `> Atenção:`, `> Limitação:`), and prefer `solution` / `flow` / `schema` 2D diagrams over flat horizontal chains (`> 3` nodes). See [authoring](references/authoring.md) and [diagrams](references/diagrams.md).
4. **Build offline HTML & receipt**
   ```bash
   node "<skill>/scripts/cli.mjs" build <work>/document.json --out <work>/documentacao.html [--mode full|summary] [--force]
   ```
   Compiles HTML + `<out>.validation.json` atomically after AJV schema, URL safety, LaTeX, and SVG checks pass (never overwrites without `--force`).
5. **Verify hashes & contracts**
   ```bash
   node "<skill>/scripts/cli.mjs" verify <work>/document.json <work>/documentacao.validation.json --strict
   ```
6. **Review in a real browser & sign off**
   - Inspect both **desktop** (~1440 px) and **mobile** (~390 px): confirm zero horizontal page overflow, mobile drawer (`#nav-toggle`, `#nav-close`, backdrop, `Escape`, `inert`/focus trap, `#mobile-search-btn`), search highlights, audience filters, table search/print, theme switch (`Vermelho`/`Azul`), and diagram modal Fit/Zoom.
   - After passing browser inspection, stamp the receipt:
     ```bash
     node "<skill>/scripts/cli.mjs" verify <work>/document.json <work>/documentacao.validation.json --mark-reviewed
     ```

## Core Rules & Boundaries

- **Implemented state only**: code proves implementation, not production execution; state `dataAsOf` clearly and ask product context only for missing business ownership, rationale, or runtime status.
- **No audits or redesigns**: document constraints affecting interpretation without inventing defect backlogs, maturity scores, or modernization roadmaps unless requested.
- **No secrets & no fabricated numbers**: never reproduce secret values (name where they live, e.g. Key Vault, `dbutils.secrets`, env vars); date real snapshots and label fictional worked examples explicitly.
- **Never copy facts across repositories**: every table, metric, and rule must come from the target codebase.

## Deliverables & Completion Criteria

- **Artifacts**: `<work>/inventory.json`, `<work>/reading-plan.md`, `<work>/document.json`, `<work>/content.md`, `<work>/documentacao.html`, `<work>/documentacao.validation.json` (plus summary counterparts when requested).
- **Done when**: `build` reports `passed: true`, `verify` reports `ok: true` and `receiptStatus: "complete"`, desktop & mobile browser checks pass (`browserReviewed: true`), and any unverified behavior is disclosed explicitly.
- **Skill maintenance**: if editing the skill itself (`scripts/diagrams.mjs`, `scripts/lib/*`, `assets/*`, `scripts/cli.mjs`), run `npm test --prefix "<skill>"` and regenerate examples.
