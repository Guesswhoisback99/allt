## 0. Pre-flight

- [x] 0.1 Tag the current commit `pre-vite` and push the tag, so the legacy single-file `index.html` is recoverable before any structural changes land.

## 1. Project scaffold

- [x] 1.1 Add `package.json` with deps: `vite`, `typescript`, `papaparse`, `@types/papaparse`, `chart.js`, `chartjs-adapter-date-fns`, `chartjs-plugin-annotation`, `chartjs-plugin-zoom`, `hammerjs`, `@fontsource/dm-sans`, `@fontsource/dm-mono`. Pin exact versions.
- [x] 1.2 Add `tsconfig.json` with `strict: true`, `module: ESNext`, `moduleResolution: bundler`, `target: ES2022`, `types: ["vite/client"]`, `noUncheckedIndexedAccess: true`.
- [x] 1.3 Add `vite.config.ts` registering the data plugin (1.4) and configuring `build.outDir = 'dist'`, `build.assetsInlineLimit = 0`, and `build.sourcemap` driven by mode: `false` for production, `true` for `development`. Do NOT ship a production sourcemap (D9: medical data leak vector).
- [x] 1.4 Create `plugins/vite-plugin-data.ts` skeleton exposing virtual module `virtual:dataset` (no parsing yet, just returns an empty `Dataset`).
- [x] 1.5 Create `src/data/virtual.d.ts` declaring `module 'virtual:dataset'` exporting `Dataset`.
- [x] 1.6 Add `.gitignore` covering `node_modules/`, `dist/`, and `data/*` with an explicit unignore of `data/*.sample.csv`. Real patient CSVs are expected to live OUTSIDE the repo (e.g. `~/labs/<patient>/`); env vars hold absolute paths.
- [x] 1.7 Add `npm` scripts:
  - `typecheck`: `tsc --noEmit`
  - `build`: `tsc --noEmit && vite build` (D8 — type errors must abort before Vite runs and before `dist/` is touched)
  - `dev`: `vite`
  - `preview`: `vite preview`

## 2. Types and validation

- [x] 2.1 Define `src/types.ts` with `Param` (where `lo: number | null`), `Result`, `EventAnno` (with `id: string`), `Dataset` interfaces matching the CSV schemas.
- [x] 2.2 In the plugin, implement `readCsv(path)` that errors clearly on missing path or unreadable file.
- [x] 2.3 Implement `validateParams(rows)` — required columns, unique ids, numeric `hi > 0`, `lo` either empty (→ `null`, upper-bound-only) or numeric with `hi > lo`. Empty `lo` is the ONLY way to express "no lower bound"; `lo=0` means a real floor at zero (data-ingestion spec).
- [x] 2.4 Implement `validateResults(rows, params)` — ISO date, known `param_id`, numeric `value`; report row number on failure.
- [x] 2.5 Implement `validateEvents(rows)` — required columns including `id`; unique non-empty `id`; ISO `date`; `date_to` empty or strictly `> date` (equal dates fail); non-empty `label`.
- [x] 2.6 Build `Dataset` shape with `Map<param_id, Map<date, number>>` lookups precomputed.
- [x] 2.7 In the plugin's `configResolved` hook, read `RESULTS_CSV` / `PARAMS_CSV` / `EVENTS_CSV` from `process.env`, run all reads + parsing + validation, and throw with a clear message on any failure. This MUST happen before `buildStart` so Vite's `emptyOutDir` never runs on a doomed build (D7).
- [x] 2.8 Call `this.addWatchFile(path)` for each CSV path so `vite dev` hot-reloads on data change (D10).
- [x] 2.9 Emit `dist/build-info.json` in `closeBundle` containing only input paths, file sha256s, and build timestamp. Do NOT include CSV contents.

## 3. Sample data

- [x] 3.1 Author `data/results.sample.csv` from the current `PARAMS[*].vals` × `DATES` matrix.
- [x] 3.2 Author `data/params.sample.csv` from the current `PARAMS` metadata. Map current `lo:0` entries (chol/ldl/trig/crp) to **empty `lo` cells** (upper-bound-only) — `0` is no longer the sentinel.
- [x] 3.3 Author `data/events.sample.csv` from the current `EVENTS` array, assigning a stable `id` to each row (e.g. `statins-start`, `covid-2024`, `diet-change`).
- [x] 3.4 Verify `npm run build` succeeds against the sample CSVs and produces `dist/index.html`.

## 4. Strip and split index.html

- [x] 4.1 Move the `<style>` block into `src/styles.css` (no changes); import it from `src/main.ts`.
- [x] 4.2 Reduce `index.html` to a shell: head meta + `<header>`/`<main>` markup + `<script type="module" src="/src/main.ts">`. Remove all CDN `<script>` and Google Fonts `<link>`.
- [x] 4.3 Import `@fontsource/dm-sans/{300,400,500,600}.css` and `@fontsource/dm-mono/{400,500}.css` from `src/main.ts`.

## 5. Shared UI utilities

- [x] 5.1 Create `src/format.ts` with `fmtDatePL`, `fmtVal`, `status(v, p)`. Unit-test via a tiny ad-hoc script if convenient (optional).
- [x] 5.2 Create `src/views/tabs.ts` (or inline in `main.ts`) wiring tab switching unchanged from current behavior.

## 6. Chart view

- [x] 6.1 Create `src/views/chart.ts` exporting an `init(dataset)` function.
- [x] 6.2 Register Chart.js components, date-fns adapter, annotation + zoom plugins exactly once at module top-level (idempotent across re-inits / tab switches). Do NOT register inside `init()`.
- [x] 6.3 Populate `sel1`/`sel2` from `dataset.params`; default to first two ids.
- [x] 6.4 Build datasets keyed by date from the `Map<param_id, Map<date, number>>`; render gaps for missing pairs. Honor `noUncheckedIndexedAccess`: lookups return `T | undefined`, handle the `undefined` branch — no `!` non-null assertions.
- [x] 6.5 Port reference range / max-line annotations from current code, switched on `param.lo === null` (max-line) vs numeric (band).
- [x] 6.6 Port event annotations (line vs box) and the chips bar. Key the `activeEvents` set by `event.id` (string), not array index, so chip state is stable when the events CSV is reordered or rows are added/removed.
- [x] 6.7 Port date-range filtering (`Od`/`Do`) and `Resetuj` button.
- [x] 6.8 Port legend rendering and tooltip callbacks (Polish strings, `fmtVal`, status flags).
- [x] 6.9 Verify zoom+pan still works (wheel, pinch, drag) — bounded to original range.

## 7. Table view

- [x] 7.1 Create `src/views/table.ts` exporting `init(dataset)`.
- [x] 7.2 Build the date sidebar in reverse chronological order with anomaly flag dots.
- [x] 7.3 Port the date search filter and N/total counter.
- [x] 7.4 Render the per-date results table with status badges, danger styling, and aggregate header note.
- [x] 7.5 Default-select the most recent date; `scrollIntoView` the active item.

## 8. Verification

- [x] 8.1 Run `npm run build` (which includes `tsc --noEmit`) clean. Verify that introducing a deliberate type error makes `npm run build` fail before Vite starts.
- [x] 8.2 Run `npm run build`; confirm `dist/index.html` references only relative URLs and no `cdn.jsdelivr.net` / `fonts.googleapis.com` strings appear in any built file. Confirm no `*.map` files are present in `dist/` for a production build.
- [ ] 8.3 Serve `dist/` via `npm run preview` with browser DevTools; confirm zero outbound third-party requests.
- [ ] 8.4 Side-by-side visual diff against the legacy `index.html` (checkout `pre-vite` tag in a worktree) on chart and table views.
- [x] 8.5 Negative tests, each must fail with a clear message and non-zero exit AND leave any prior `dist/` untouched:
  - each of `RESULTS_CSV` / `PARAMS_CSV` / `EVENTS_CSV` unset
  - env points to a missing/unreadable file
  - results row with malformed numeric value
  - results row with unknown `param_id`
  - params row with `hi <= lo`
  - params row with non-positive `hi`
  - events row with `date_to == date`
  - events file with duplicate `id`
- [x] 8.6 Measure final bundle size: gzipped + brotli total of JS/CSS/fonts in `dist/`. Record the number for the README (replaces the TBD placeholder in design.md).

## 9. Documentation

- [x] 9.1 Write `README.md` covering: env vars (with absolute-path examples like `RESULTS_CSV=$HOME/labs/jan-kowalski/results.csv`, NOT `data/`), CSV schemas with example rows including an upper-bound-only param (empty `lo`) and both event flavors, `npm run build` usage, the bundle-size measurement from 8.6, deployment notes, and the medical-data privacy caveat (one build = one patient; do not commit real CSVs to `data/`).
- [x] 9.2 Document the `build-info.json` artifact: what it contains (paths + sha256s + timestamp) and explicitly that it does NOT contain CSV contents.
