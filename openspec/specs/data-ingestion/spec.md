# Data Ingestion

## Purpose

Describes how the build pipeline reads and validates CSV input files at build time, ensuring only typed, validated data is inlined into the browser bundle.

## Requirements

### Requirement: CSV inputs identified by environment variables

The build SHALL accept three filesystem paths via environment variables — `RESULTS_CSV`, `PARAMS_CSV`, and `EVENTS_CSV` — and read the referenced CSV files at build time. No data SHALL be loaded at runtime in the browser.

#### Scenario: All three env vars provided
- **WHEN** the build is invoked with `RESULTS_CSV`, `PARAMS_CSV`, and `EVENTS_CSV` pointing to readable files
- **THEN** the build parses each file and inlines the resulting typed data into the bundled JavaScript

#### Scenario: A required env var is missing
- **WHEN** any of `RESULTS_CSV`, `PARAMS_CSV`, `EVENTS_CSV` is unset or empty
- **THEN** the build fails with a non-zero exit code and an error message naming the missing variable

#### Scenario: A referenced file does not exist or is unreadable
- **WHEN** an env var points to a path that cannot be read
- **THEN** the build fails with a non-zero exit code and an error message identifying the path and the underlying I/O error

### Requirement: Results CSV schema

The results CSV SHALL have a header row with columns `date`, `param_id`, `value`. Each subsequent row represents one measurement.

- `date` MUST be an ISO-8601 calendar date (`YYYY-MM-DD`).
- `param_id` MUST match an `id` defined in the params CSV.
- `value` MUST be a number using `.` as the decimal separator.

#### Scenario: Valid results file
- **WHEN** every row has a valid date, a `param_id` present in the params CSV, and a numeric `value`
- **THEN** the loader returns one entry per row keyed by `(date, param_id)` and the build proceeds

#### Scenario: Unknown param_id
- **WHEN** a row references a `param_id` not present in the params CSV
- **THEN** the build fails with an error naming the row number and the unknown id

#### Scenario: Malformed numeric value
- **WHEN** a row's `value` is empty or cannot be parsed as a number
- **THEN** the build fails with an error naming the row number and the offending value

### Requirement: Params CSV schema

The params CSV SHALL have a header row with columns `id`, `name`, `short`, `unit`, `lo`, `hi`. Each row defines one measurable parameter and its reference range.

- `id` MUST be unique within the file and a stable kebab/snake identifier referenced from results.
- `hi` MUST be a number greater than `0`.
- `lo` MAY be a number or an empty cell. An empty cell means "no lower bound" (upper-bound-only parameter); a numeric `lo` means a true lower bound, even if that value is `0`. There is NO sentinel value: `lo=0` means "values below 0 are out of range," not "no lower bound."
- When `lo` is numeric, `hi` MUST be strictly greater than `lo`.

#### Scenario: Valid params file with mixed bound types
- **WHEN** every row has a unique id, a numeric `hi > 0`, and `lo` either empty or numeric with `hi > lo`
- **THEN** the loader returns the parameter list preserving file order; rows with empty `lo` are flagged as upper-bound-only

#### Scenario: Duplicate id
- **WHEN** two rows share the same `id`
- **THEN** the build fails with an error naming the duplicated id

#### Scenario: hi not greater than lo
- **WHEN** a row has numeric `lo` and `hi` with `hi <= lo`
- **THEN** the build fails with an error naming the row and the offending values

#### Scenario: hi non-positive or non-numeric
- **WHEN** a row has `hi` empty, non-numeric, or `<= 0`
- **THEN** the build fails with an error naming the row

### Requirement: Events CSV schema

The events CSV SHALL have a header row with columns `id`, `date`, `date_to`, `label`. Each row represents one life event annotation on the chart.

- `id` MUST be a non-empty string, unique within the file. It is the stable key used by UI state (chip toggles).
- `date` MUST be an ISO-8601 date.
- `date_to` MAY be empty (point event) or an ISO-8601 date strictly greater than `date` (range event). `date_to == date` is invalid; encode a single-day event as a point event with empty `date_to`.
- `label` MUST be a non-empty string. `label` is for display only and MAY be edited freely without breaking UI state, because state is keyed by `id`.

#### Scenario: Point event
- **WHEN** a row has `id`, `date` set, `date_to` empty, and a non-empty `label`
- **THEN** the loader emits a point event used by the chart as a vertical dashed line

#### Scenario: Range event
- **WHEN** a row has `id`, `date`, and `date_to` set with `date_to > date`
- **THEN** the loader emits a range event used by the chart as a shaded band

#### Scenario: date_to equal to date
- **WHEN** a row has `date_to == date`
- **THEN** the build fails with an error naming the row

#### Scenario: Duplicate event id
- **WHEN** two rows share the same `id`
- **THEN** the build fails with an error naming the duplicated id

#### Scenario: Empty events file
- **WHEN** the events CSV contains only a header row
- **THEN** the build succeeds and the events bar is rendered empty

### Requirement: Build-time validation, no silent failures

All schema validation SHALL happen at build time. The browser bundle SHALL receive only typed, validated data.

#### Scenario: Any validation error
- **WHEN** any CSV violates its schema
- **THEN** the build exits non-zero before producing `dist/` artifacts and the previous successful build output (if any) is left untouched
