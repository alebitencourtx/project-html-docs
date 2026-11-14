---
name: project-html-docs
description: Document an existing software or data-engineering project for business and technical readers as a self-contained HTML manual, with architecture, workflows, data relationships, business rules and usage instructions. Use to create or update project documentation, not to audit or redesign the implementation.
---

# Project HTML Docs

Describe the project's **current implemented state**. Deliver one offline HTML file; keep editable inputs in Markdown, JSON and diagram text. A nontechnical reader should understand purpose, outputs and usage before implementation details.

## Workflow

1. Establish the repository and output. Keep existing documentation unless replacement was requested. Read [authoring](references/authoring.md); for data pipelines, analytics and lakehouses also read [data engineering](references/data-engineering.md).
2. Map the repository. Optionally run `python <skill>/scripts/inspect_repo.py <repo> --out <work>/inventory.json`. This lists candidate sources and revision; it does not understand the system. Read relevant code, configuration, schemas, workflows and existing docs. Do not dump the whole repository into context.
3. Establish purpose, consumers, inputs/outputs, components, processing, rules, data grain and operation. Resolve contradictions using the implementing path. Historical plans do not prove implementation. Do not execute collection jobs or alter production to populate documentation.
4. Write `<work>/document.json` and `<work>/content.md`. Follow the [runnable example](examples/minimal/content.md) and [manifest](examples/minimal/document.json). Markdown H2 headings match manifest titles in order. Select sections by applicability, retaining functional and technical depth; source IDs associate sections with actual files.
5. Install once: `npm ci --ignore-scripts --prefix <skill>`. Generate: `node <skill>/scripts/build.mjs <work>/document.json --out <work>/documentacao-v2.html`. Node 22+ is needed only for authoring. Readers need a browser, not a server. The builder refuses overwriting; `--force` is for a deliberate update of the requested output.
6. Verify the document against its sources: `node <skill>/scripts/verify.mjs <work>/document.json <work>/documentacao.validation.json` compares source hashes and the Git revision with the receipt. Use `--strict` in CI. The builder refuses overwriting; `--force` is for a deliberate update of the requested output.
7. Read the validation receipt, inspect desktop/narrow layouts, and exercise search, expansion, copy, diagram enlargement and print. Fix inputs and rebuild. Structural validation does not prove semantic correctness or visual quality. Deliver the HTML and disclose concrete unverified behavior.

## Decisions

- Explain business rules in plain language, then give conditions/calculation and a useful example. Separate using the product from running its pipeline.
- Use architecture, processing and data relationships as distinct views when applicable. `mermaid` fences produce embedded SVG with the bundled Beautiful Mermaid renderer.
  - **Solution Design & Architecture (v1.2.0 Standard)**: Never draw single-line horizontal architectures (`flowchart LR` continuous with more than 3 nodes). Structure solutions in **stacked functional 2D stages** using thematic `subgraph`s, numbered steps (①..⑤), descriptive `<small>` subtitles in nodes, and standardized semantic legends via `.figure-legend`. See [authoring](references/authoring.md) and [data engineering](references/data-engineering.md).
- Charts need a real question, unit and source. Numerical snapshots need their date; fictional examples must be labeled. Never invent telemetry or turn absence into zero.
  - **Bar Chart Reengineering (v1.2.0)**: Values are rendered with Gestalt proximity (inside long bars >= 64px or connected by dotted guide lines), discrete scale gridlines (25%, 50%, 75%, 100% ticks), explicit semantic zero handling (`0 (zero)` badge/text instead of crude lines), optional semantic color variants (`variant`: warning, danger, success, neutral, accent), and offline accessible `<title>` tooltips in `<g class="chart-row">`. Embedded `<details>` tables adapt fluidly without forced width penalties.
- Keep core explanations visible. Put long dictionaries, schemas and secondary recipes in native `details` blocks. Use recognizable navigation categories.
- **Reading Ergonomics & Design System (v1.2.0)**: Paragraphs and lists are constrained to 76ch measure for optimal readability. Tables feature contained scrolling with truly sticky headers (`th { position: sticky }`). Wide diagrams feature native CSS scroll shadows in `.diagram-scroll`. Accordions use smooth rotating vector chevrons, and active sidebar items automatically sync into view on scroll.
- Preserve grain, identities, branching and edge meaning when simplifying diagrams. Split dense maps into overview/detail rather than deleting meaningful relationships.
- Describe limitations affecting correct interpretation. Do not add a defect backlog, maturity score, severity matrix or modernization plan unless requested. Sources support documentation, not an audit report.
- When the repository cannot establish business purpose, ownership, deployment status or rationale, consult product context or ask for that specific missing fact. Code proves implementation, not a successful production run.
- Never reproduce secret values found in code or configuration. Describe where they live, their role and the need to rotate them; do not turn this into a security audit.

## Portability and maintenance

Agents without skill discovery can read this file as the entrypoint. Dependencies are pinned in `package-lock.json`; manifest paths are relative to the manifest. Do not copy Admin Metrics facts into another project. `outputs/` contains a pilot, not universal architecture or section-count requirements.

The maintained visual components are `assets/document.css` and `assets/document.js`. Prefer them to per-project CSS. Version 1.2.0 establishes enhanced typography, table stickiness, diagram scroll indicators, rotating chevrons, and reengineered bar charts. Change the renderer only for a demonstrated missing capability. Validate generator changes with `npm test --prefix <skill>` and regenerate the minimal example plus the affected document.

Diagram dependency: [Beautiful Mermaid](https://github.com/lukilabs/beautiful-mermaid), MIT, pinned at build time. See [tools and scope](references/tools.md).
