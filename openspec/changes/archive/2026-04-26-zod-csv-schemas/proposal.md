## Why

CSV input validation in `plugins/vite-plugin-data.ts` is hand-rolled across three nearly-parallel functions (`validateParams`, `validateResults`, `validateEvents`, ~120 lines combined). The TS row types in `src/types.ts` duplicate that schema in a second form. Adding a column or tweaking a constraint means editing both, plus updating the README by hand and remembering to mirror the change in the separate Python generator script. Switching to a declarative schema (zod) collapses the validators and the row types into one definition each, making the contract that the Python generator must honor easier to read at a glance.

## What Changes

- Add `zod` as a runtime dependency.
- Introduce `src/schema.ts` exporting `paramRowSchema`, `resultRowSchema`, `eventRowSchema` and the array-level schemas built from them.
- Replace the hand-rolled `validateParams` / `validateResults` / `validateEvents` in `plugins/vite-plugin-data.ts` with zod parsing.
- Derive `Param`, `Result`, `EventAnno` row types via `z.infer` from the schemas; remove the duplicated interface definitions in `src/types.ts` (keep `Dataset` since it is a derived shape, not a row type).
- Add a small `formatZodError(label, issues, rows)` helper that produces messages of the same shape as today: `[<LABEL>] row <N> (id="<id>"): <reason>`.
- Keep the cross-file foreign-key check (`results.param_id` must exist in `params`) as a post-parse pass — not embedded in the zod schema — so each schema stays standalone.
- Use `z.preprocess` (not `z.coerce`) for numeric columns so that an empty string fails validation rather than silently coercing to `0`.
- Keep `papaparse` for CSV parsing. Keep the env-var loading, SHA-256 hashing, and `build-info.json` emission unchanged.
- No JSON Schema export. The Python generator lives in a separate repo and stays in sync by hand against the README + zod schema source.

No observable behavior changes: same env-var contract, same accepted/rejected inputs, same error message shape, same emitted dataset.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `data-ingestion`: tighten the `Results CSV schema` and `Params CSV schema` requirements by splitting the lumped "empty or non-numeric" scenarios into distinct scenarios for empty-cell rejection and non-numeric rejection, and explicitly forbid coercing empty strings to `0`. This pins down the exact behavior that the zod refactor must preserve (the precise regression risk identified in `design.md`). No accepted/rejected inputs change; the split is a tightening of testable scenarios, not a relaxation or expansion.

## Impact

- **Code**: `plugins/vite-plugin-data.ts` (validators replaced), `src/schema.ts` (new), `src/types.ts` (row interfaces removed, `Dataset` retained).
- **Dependencies**: adds `zod` to `dependencies` in `package.json`.
- **Docs**: `README.md` CSV schema section gains a pointer to `src/schema.ts` as the authoritative definition. Schema rules themselves do not change.
- **External**: the Python generator in the separate repo is unaffected by this change but its maintainers should treat `src/schema.ts` as the contract.
- **Build / runtime**: no change to bundle output beyond a tiny size delta from zod (zod is build-time only here — used by the Vite plugin during `configResolved`, not shipped to the browser).
