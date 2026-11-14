# Data-engineering profile

Describe consumers, transformations and stored contracts. Adapt to the repository: JSON state is not a relational database, and not every pipeline has bronze/silver/gold or an orchestrator.

For each important object establish business meaning, grain (exactly one row/event/object), natural/technical/composite identity, enforced vs logical uniqueness, join columns/cardinality, event/reference/ingestion times, timezone, source/transformation, format/location, write policy, partitioning, retention and consumption. Define missing/invalid values and their effect on output.

Separate execution order, lineage and association. List all composite-key components. Explain aggregation N:1 without pretending it is a foreign key. Types come from DDL/models/contracts, not guesses from sample values. Show essential attributes in ER and the full dictionary below.

Rules expose denominator eligibility, thresholds, cutoffs, deduplication and exceptions. Give worked examples for nonobvious outcomes. Do not average percentages when code uses ratios of sums, sum cumulative snapshots, or infer incremental behavior without implementation. Explain late data, reuse, reprocessing and idempotency as actually implemented.

Operation explains trigger, configuration, prerequisite state, output, restart/recovery and success criteria. If a successful job can publish a degraded-data diagnostic, explain this distinction.

Use snapshots only when supplied or locally available within scope. Identify run/date/source; do not call them live. Retention or threshold charts can explain implementation without running a pipeline. Never fabricate records to populate executive cards.

This is an as-is guide. Document constraints affecting use. Do not invent owners, SLAs, classifications, optimization plans or historical rationale. An implemented choice can be described even when its original rationale is unknown.
