## MODIFIED Requirements

### Requirement: Results CSV schema

The results CSV SHALL have a header row with columns `date`, `param_id`, `value`. Each subsequent row represents one measurement.

- `date` MUST be an ISO-8601 calendar date (`YYYY-MM-DD`).
- `param_id` MUST match an `id` defined in the params CSV.
- `value` MUST be a number using `.` as the decimal separator. An empty cell is NOT a valid value and MUST be rejected; the schema MUST NOT coerce empty strings to `0` or any other number.

#### Scenario: Valid results file
- **WHEN** every row has a valid date, a `param_id` present in the params CSV, and a numeric `value`
- **THEN** the loader returns one entry per row keyed by `(date, param_id)` and the build proceeds

#### Scenario: Unknown param_id
- **WHEN** a row references a `param_id` not present in the params CSV
- **THEN** the build fails with an error naming the row number and the unknown id

#### Scenario: Empty value cell
- **WHEN** a row's `value` cell is empty
- **THEN** the build fails with an error naming the row number and indicating that `value` is required

#### Scenario: Non-numeric value
- **WHEN** a row's `value` is non-empty but cannot be parsed as a finite number
- **THEN** the build fails with an error naming the row number and the offending value

### Requirement: Params CSV schema

The params CSV SHALL have a header row with columns `id`, `name`, `short`, `unit`, `lo`, `hi`. Each row defines one measurable parameter and its reference range.

- `id` MUST be unique within the file and a stable kebab/snake identifier referenced from results.
- `hi` MUST be a number greater than `0`. An empty `hi` cell is NOT valid and MUST be rejected; the schema MUST NOT coerce empty strings to `0`.
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

#### Scenario: hi empty
- **WHEN** a row's `hi` cell is empty
- **THEN** the build fails with an error naming the row and indicating that `hi` is required

#### Scenario: hi non-numeric
- **WHEN** a row's `hi` cell is non-empty but cannot be parsed as a finite number
- **THEN** the build fails with an error naming the row and the offending value

#### Scenario: hi non-positive
- **WHEN** a row's `hi` parses as a number `<= 0`
- **THEN** the build fails with an error naming the row and the offending value

#### Scenario: lo non-numeric
- **WHEN** a row's `lo` cell is non-empty but cannot be parsed as a finite number
- **THEN** the build fails with an error naming the row and the offending value
