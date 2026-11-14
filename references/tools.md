# Tools and scope

Beautiful Mermaid 1.1.3 (https://github.com/lukilabs/beautiful-mermaid, MIT) renders SVG. Marked parses Markdown; AJV validates the manifest; sanitize-html defines the content boundary; Cheerio inspects HTML/SVG. Exact dependency versions are pinned in package-lock.json; licenses remain in the installed npm packages. Output embeds generated SVG, not their JavaScript runtimes.

The shell, bar chart, search, copy, print and enlargement behavior are maintained locally. No CDN, web service, model API or hosted wiki is needed. Network is used for initial npm installation, not reading documents.

Archify was evaluated as an explainer and diagram tool. This implementation uses a consistent long-document shell with inline SVG rather than importing its interactive explainer layout. Quarto is a valid alternative compiler but is not needed here. Wikipilot and DeepWiki are not runtime dependencies.

An agent understands source and authors semantics; deterministic helpers render it. inspect_repo.py assists discovery only. This separation lets different models reuse the same source format without binding to an LLM vendor.

Add components for demonstrated needs, preserve offline output, pin dependencies and test failure modes. Optional renderers must complete at build time and embed their results; never introduce runtime chart/image endpoints.
