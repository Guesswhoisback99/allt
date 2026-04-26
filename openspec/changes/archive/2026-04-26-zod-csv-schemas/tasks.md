## 1. Dependency

- [x] 1.1 Add `zod` to `dependencies` in `package.json` and run `npm install`
- [x] 1.2 Confirm `npm run typecheck` still passes against unchanged code

## 2. Schema module

- [x] 2.1 Create `src/schema.ts`
- [x] 2.2 Define `paramRowSchema` (object: `id`, `name`, `short`, `unit`, `lo`, `hi`) using `z.preprocess` for `lo` (empty → `null`) and `hi` (empty → fail), with `.refine` for `hi > 0` and `hi > lo` when `lo` is numeric
- [x] 2.3 Define `resultRowSchema` (object: `date` matching `/^\d{4}-\d{2}-\d{2}$/`, `param_id` non-empty, `value` numeric via `z.preprocess` rejecting empty cells, refined to `Number.isFinite`)
- [x] 2.4 Define `eventRowSchema` (object: `id` non-empty, `date` ISO, `date_to` empty-or-ISO, `label` non-empty) with row-level `.refine` for `date_to > date` when `date_to` is set
- [x] 2.5 Wrap each row schema in `z.array(...).superRefine(...)` for unique-id checks (`paramsSchema`, `eventsSchema`); `resultsSchema` is a plain `z.array(resultRowSchema)` (FK enforced post-parse — see 4.2)
- [x] 2.6 Export inferred row types: `export type Param = z.infer<typeof paramRowSchema>` and same for `Result`, `EventAnno`

## 3. Type cleanup

- [x] 3.1 In `src/types.ts`, remove the `Param`, `Result`, `EventAnno` interfaces
- [x] 3.2 Re-export the inferred row types from `src/schema.ts` so existing import sites in `src/views/*` keep working unchanged
- [x] 3.3 Keep `Dataset` in `src/types.ts` (derived shape, not a row type)
- [x] 3.4 Run `npm run typecheck` to confirm no import sites broke

## 4. Plugin rewrite

- [x] 4.1 In `plugins/vite-plugin-data.ts`, delete `validateParams`, `validateResults`, `validateEvents`, and the `parseNumber` helper
- [x] 4.2 Replace each call site with: `requireColumns(...)` (kept) → `schema.safeParse(rows)` → on failure throw via `formatZodError` (see 4.3) → on success use the parsed array; perform the FK check (`results.param_id ∈ params.id` Set) as a separate post-parse loop, throwing a `BuildError` matching today's "unknown param_id" message
- [x] 4.3 Add `formatZodError(label, error, rows)` that maps `issues[0].path[0]` to a row number (`+ 2` for header), looks up `id` from the row when present, and emits `[<LABEL>] row <N> (id="<id>"): <message>`
- [x] 4.4 Verify the imported types from `src/types.ts` still resolve and `buildDataset` signature is unchanged

## 5. Verification

- [x] 5.1 Run `npm run typecheck` and `npm run build` against `data/*.sample.csv`; diff the resulting `dist/` against a build from `main` — should be byte-identical except `build-info.json`'s `builtAt`
- [x] 5.2 Hand-test rejection paths by mutating sample CSVs one at a time and confirming the error message format matches today's: missing column, `hi=""`, `hi="abc"`, `hi=-1`, `hi <= lo`, `value=""`, `value="abc"`, `param_id` not in params, `date="2024-13-01"`, `date_to <= date`, duplicate `id` in params, duplicate `id` in events
- [x] 5.3 Confirm a row with `lo=""` parses successfully and produces `lo: null` in the inlined dataset
- [x] 5.4 Confirm a row with `lo="0"` parses successfully and produces `lo: 0` (sentinel-free behavior preserved)

## 6. Docs

- [x] 6.1 Update `README.md` CSV schemas section to add a one-line pointer to `src/schema.ts` as the authoritative schema definition
- [x] 6.2 Confirm README rules still match the zod schemas (no drift introduced)
