## Context

`plugins/vite-plugin-data.ts` validates three CSV inputs at build time using ~120 lines of hand-rolled imperative checks. The same row shapes are also declared as TypeScript interfaces in `src/types.ts`, so each schema rule effectively lives in two places. CSV files themselves are produced by a Python script (PDF extractor) maintained in a separate repo; the Python author has no automated way to know what the TS side expects beyond reading the README and the validators.

This change makes the row schemas declarative (zod), collapses the type/validator pair into a single source per row, and preserves every observable behavior: same env-var contract, same accepted/rejected inputs, same error message shape, same emitted dataset, same SHA-256 hashing and `build-info.json` output.

## Goals / Non-Goals

**Goals:**
- Replace `validateParams` / `validateResults` / `validateEvents` with zod schemas.
- Produce a single source of truth per row type that doubles as the TS type via `z.infer`.
- Preserve the current error message format: `[<LABEL>] row <N> (id="<id>"): <reason>`, including row numbers (CSV header is row 1, data starts at row 2) and the `id` column when present.
- Keep cross-file FK validation (results → params) explicit and readable.
- Keep the change scoped to TypeScript; the Python generator is untouched.

**Non-Goals:**
- Generating JSON Schema or any other artifact for the Python generator. Sync stays manual.
- Replacing `papaparse`. CSV parsing stays as-is.
- Changing the CSV grammar, column names, env-var names, or `build-info.json` shape.
- Validating in the browser at runtime. Validation remains build-time only.
- Adding new constraints or relaxing existing ones.

## Decisions

### 1. zod over alternatives (valibot, ajv, hand-rolled)

zod is the pragmatic choice: small enough, ubiquitous, and gives `z.infer` for free, which is the main reason to do this at all (collapses `types.ts` row interfaces into the schema). valibot is smaller but the bundle-size win is irrelevant here — schemas run at build time and never reach the browser. ajv (JSON Schema) would force us to maintain a separate JSON Schema document and would not produce TS types directly.

### 2. `z.preprocess` for numeric columns, not `z.coerce`

`z.coerce.number()` calls `Number(input)`, and `Number("") === 0`. That would silently accept empty cells in `hi`, `lo`, and `value`, regressing today's behavior where empty `hi` and empty `value` are errors and empty `lo` is a *distinct* sentinel meaning "no lower bound."

The pattern:

```ts
// `hi`: required number
const required = z.preprocess(
  (s) => (s === '' || s == null ? undefined : Number(s)),
  z.number()
);

// `lo`: empty string → null sentinel
const optionalNullable = z.preprocess(
  (s) => (s === '' || s == null ? null : Number(s)),
  z.number().nullable()
);

// `value`: required number, NaN must reject (Number("abc") === NaN)
const numeric = required.refine((n) => Number.isFinite(n), { message: 'must be a finite number' });
```

This keeps the three cases — empty rejected, empty as `null`, non-numeric rejected — distinct and explicit.

### 3. Cross-file FK as a post-parse pass, not embedded in the schema

`results.param_id ∈ params.id` is a relation between two files. Two ways to express it in zod:

- **A.** Build `resultsSchema` as a factory `(validIds: Set<string>) => z.array(...)` that closes over the set.
- **B.** Parse params and results independently, then run a small loop checking each result's `param_id` against the set.

We pick **B**. Each schema stays standalone and inspectable in isolation. Cross-file logic lives in one obvious place in `vite-plugin-data.ts` rather than being threaded through schema construction. The post-parse pass also keeps zod's own error reporting focused on per-row issues.

### 4. Custom error formatter

zod's default error string (`"Number must be greater than 0 at [3].hi"`) is worse than today's (`'[PARAMS_CSV] row 5 (id="hgb"): hi must be > 0, got -1'`). A small helper preserves the current format:

```ts
function formatZodError(label: string, error: z.ZodError, rows: CsvRow[]): BuildError {
  const issue = error.issues[0]!;
  const rowIdx = typeof issue.path[0] === 'number' ? issue.path[0] : -1;
  const rn = rowIdx + 2; // header is row 1
  const id = rowIdx >= 0 ? rows[rowIdx]?.['id'] ?? '' : '';
  const idPart = id ? ` (id="${id}")` : '';
  const field = issue.path.slice(1).join('.');
  const fieldPart = field ? `: ${field} ${issue.message}` : `: ${issue.message}`;
  return new BuildError(`[${label}] row ${rn}${idPart}${fieldPart}`);
}
```

Throw on first issue (zod collects all by default; current code throws on first). Matches today's "fail fast" behavior.

### 5. Where the schemas live

New file `src/schema.ts` — exports `paramRowSchema`, `paramsSchema`, `resultRowSchema`, `resultsSchema`, `eventRowSchema`, `eventsSchema`, plus the inferred row types. The plugin imports from there. `src/types.ts` keeps `Dataset` (a derived shape, not a row) and re-exports the inferred row types so existing imports across `views/` keep working.

### 6. Required-column check

Today's `requireColumns` check fires before per-row validation and produces a clean "missing required column X" error. zod by default would produce a per-row `Required` error for every row, which is noisy. We keep `requireColumns` (untouched) and run it before handing rows to zod.

## Risks / Trade-offs

- **[Risk] zod error paths are array-indexed, easy to map wrong** → Test fixtures cover at least: header missing, row-level type error, refinement failure (e.g. `hi <= lo`), to confirm row-number arithmetic stays correct after the rewrite.
- **[Risk] Empty-string handling regression** → Decision 2 spells out the three distinct cases. A test for `lo=""` (must succeed, parse to `null`) and `hi=""` (must fail) locks this in.
- **[Risk] zod adds a dependency for a small refactor** → Accepted. zod is small, widely audited, and the `z.infer` win removes a real source of duplication.
- **[Trade-off] Schemas are TS-only — Python still drifts** → Accepted by user. README + zod source are the contract; no codegen.
- **[Trade-off] First-issue-only errors lose zod's ability to report all issues at once** → Accepted to match current behavior. Easy to revisit later.

## Migration Plan

This is a single-PR refactor with no data migration. Verification:

1. Run `npm run typecheck` and `npm run build` against the existing `data/*.sample.csv` fixtures — output `dist/` and `build-info.json` should be byte-identical to a build from `main` (modulo `builtAt` timestamp).
2. Hand-test rejection paths by mutating sample CSVs: missing column, non-numeric `hi`, empty `value`, unknown `param_id`, `date_to <= date`, duplicate `id`. Confirm error messages match today's format closely enough that the README description is still accurate.

Rollback is a single `git revert`.

## Open Questions

None blocking. Decision 4's exact error string for refinements (`hi must be > 0` vs `Number must be greater than 0`) depends on the `message` strings we set on each `.refine()` / constraint — worth double-checking against today's wording during implementation, but not a design-level question.
