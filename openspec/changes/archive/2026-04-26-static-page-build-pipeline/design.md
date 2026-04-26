## Context

Today the project is a single hand-edited `index.html` (~1000 lines) containing:
- a CSS block,
- inline data arrays (`DATES`, `PARAMS`, `EVENTS`),
- inline rendering logic for tabs, table, sidebar, and Chart.js,
- five third-party scripts loaded from `cdn.jsdelivr.net` and a Google Fonts stylesheet.

The page is intended to be hosted as a static asset. The data will be supplied later as CSV files; at build time we read three files referenced by env vars and inline their contents into the bundle. There is no runtime backend.

Stakeholders: a single tech lead / owner (the user); end-users view the page in a browser. Data is medical (lab results) so we want to avoid third-party requests at runtime.

## Goals / Non-Goals

**Goals:**
- Repeatable build: `RESULTS_CSV=… PARAMS_CSV=… EVENTS_CSV=… npm run build` → `dist/`.
- Single self-contained `dist/` deployable to any static host, no CDN calls.
- Strong types end-to-end: CSV parsed → validated → typed objects → bundled.
- Preserve current UI 1:1 — visual regressions are not acceptable.
- Keep the dependency surface and folder layout small enough that a single dev can hold it in their head.

**Non-Goals:**
- No SSR, no runtime data fetching, no auth, no i18n framework (Polish strings stay inline).
- No multi-dataset output in one build invocation. One build = one HTML.
- No automated visual regression tests (manual diff against current `index.html` is acceptable for v1).
- No PWA / offline service worker.
- No theming/dark mode beyond what already exists.

## Decisions

### D1. Tooling: Vite + TypeScript + npm

**Choice:** Vite as bundler/dev-server, TypeScript for source, npm for package management.

**Why:** Vite gives us out-of-the-box env var injection (`import.meta.env`, `define`), automatic asset hashing, font/CSS handling, and a fast dev loop. TypeScript catches the kind of structural bugs (param id typos, off-by-one in `vals[di]`) that a CSV-fed pipeline is most prone to. Both are mainstream; the user is comfortable in modern web tooling.

**Alternatives considered:**
- *Plain Node build script* — minimal deps but we'd reinvent asset hashing, CSS bundling, font handling, and dev server. Rejected as false economy.
- *Astro / 11ty* — overkill for a single page, and Astro's component model would push us into a framework idiom for code that's already vanilla DOM.
- *Plain JS, no TS* — loses the type-safety win, which is the main benefit when data shapes are externalized.

### D2. Data loading: Vite plugin runs CSV → JSON at build time

**Choice:** A small Vite plugin (`vite-plugin-data.ts`) reads `RESULTS_CSV` / `PARAMS_CSV` / `EVENTS_CSV` from `process.env` during `configResolved`, parses each via `papaparse`, validates against a schema, and exposes the result through a virtual module `virtual:dataset` that `src/main.ts` imports.

**Why:**
- Validation errors fail the build before any output is written (per `static-build` spec).
- The browser never sees CSVs — only typed JS objects — so there's no runtime parse cost or fetch.
- A virtual module keeps the data out of the source tree (no committed `data.ts`).
- Clean cache key: when CSV files change, Vite invalidates the virtual module.

**Alternatives considered:**
- *`define`-style global injection of stringified JSON* — works but loses the module/import affordance and complicates types.
- *Runtime `fetch('data.json')`* — violates the "no runtime fetches" requirement and would add a deploy step to copy data.json into `dist/`.
- *Codegen step writing `src/__generated__/data.ts`* — committable and debuggable, but adds a second source of truth and pollutes git diffs. Acceptable fallback if the virtual-module approach causes friction.

### D3. CSV parsing: `papaparse` with header row, strict validation layer

**Choice:** Use `papaparse` for CSV parsing only; do all validation (required fields, numeric coercion, cross-file id integrity) in our own `validate.ts` module.

**Why:** papaparse is robust against quoting and BOMs, but its type coercion is loose. A separate validation pass lets us produce one consolidated error message per build failure, identifying file + row + column.

**Alternatives:** `csv-parse` (similar trade-offs), hand-rolled splitter (fragile against quoted commas in Polish labels).

### D4. Local fonts and chart libs as npm deps

**Choice:** Install Chart.js, `chartjs-adapter-date-fns`, `chartjs-plugin-annotation`, `chartjs-plugin-zoom`, and `hammerjs` from npm. Use `@fontsource/dm-sans` and `@fontsource/dm-mono` for fonts (woff2 files become hashed assets).

**Why:** Eliminates CDN/Google Fonts requests, satisfies "hermetic output" for medical data, and lets Vite tree-shake/minify chart code. Bundle size grows (~250 KB gzipped) but is one-time and cacheable.

**Alternatives:** Self-vendor woff2 files manually (more maintenance), keep CDN (rejected per user choice and privacy posture).

### D5. Source layout

```
.
├── data/                          # sample CSVs ONLY — real patient data lives outside the repo
│   ├── results.sample.csv
│   ├── params.sample.csv
│   └── events.sample.csv
├── src/
│   ├── main.ts                    # entry; wires tabs + views
│   ├── styles.css                 # extracted from <style>
│   ├── types.ts                   # Result, Param, Event, Dataset
│   ├── format.ts                  # fmtDatePL, fmtVal, status()
│   ├── views/
│   │   ├── chart.ts               # Chart.js config, event chips, legend
│   │   └── table.ts               # date sidebar, results table
│   └── data/
│       ├── virtual.d.ts           # `declare module 'virtual:dataset'`
│       └── (loader lives in plugin, not src)
├── plugins/
│   └── vite-plugin-data.ts        # reads env, parses CSV, validates
├── index.html                     # shell only: <header>, <main>, <script type=module src=/src/main.ts>
├── vite.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

**Why split views:** chart and table are independent in current code (tab toggles `display`). Splitting them keeps each file under ~200 lines and lets one evolve without touching the other.

### D6. Reshape from "parallel arrays" to keyed objects

Current code stores measurements as `PARAMS[i].vals[di]` — a parameter array each holding a `vals` array indexed by `DATES`. With CSV input we no longer have a guarantee that every (param, date) pair is present.

**Choice:** internal model is a `Map<param_id, Map<date, number>>`. The chart's `(date, value)` series is built by iterating dates that have a value for the chosen param; missing pairs become gaps (Chart.js `spanGaps: true` already handles this). The table iterates params and looks up the value for the selected date; missing values render as "—".

**Why:** robust to incomplete CSVs and matches how lab data actually arrives (not every parameter is measured every visit). The current 8×12 dense matrix in `index.html` is an artifact of the demo dataset.

### D7. Build failure semantics — fail before Vite touches `dist/`

**Choice:** All env-var presence checks, CSV reads, parsing, and validation run inside the data plugin's `configResolved` hook — *before* `buildStart` and *before* `build.emptyOutDir` clears the output. If anything fails we throw from `configResolved`; Vite aborts and `dist/` is never touched. Type-checking (D8) runs as a separate step before `vite build` is even invoked, so type errors also abort before any directory mutation.

**Why:** This satisfies the `static-build` spec's "prior `dist/` left untouched" requirement without hand-rolling temp-dir-and-rename. The contract is: any failure that the build can detect deterministically (missing env, missing file, schema violation, type error) happens before any output mutation. Failures that arise *during* the bundling phase (e.g. a Rollup plugin error) are rare and correspond to "broken source" rather than "broken data" — for those, the user re-runs the build after fixing the source; it's acceptable that `dist/` is empty between such a failure and the next success.

**Alternatives considered:**
- *Build into a temp dir and atomically rename to `dist/`* — strongest guarantee but requires custom `closeBundle` plumbing and breaks `build.outDir` semantics for tooling (e.g. `vite preview`). Reserve as a follow-up if mid-bundle failures become a real problem.
- *Throwing from `buildStart`* — too late: `emptyOutDir` runs in `buildStart` itself, so by then `dist/` is already gone. Do not use this hook for validation.

### D8. Type-checking gates the build

**Choice:** `npm run build` is `tsc --noEmit && vite build`. Vite does not type-check; running `tsc --noEmit` first means a type error fails the build before Vite starts and before `dist/` is touched.

**Why:** Cheaper and more standard than `vite-plugin-checker`. Keeps `tsc` as a separately runnable step (`npm run typecheck`) that editors/CI can call.

**Alternatives:** `vite-plugin-checker` (extra dep, runs in dev too — useful but unnecessary for v1).

### D9. Sourcemaps off in production

**Choice:** `build.sourcemap = false` for production builds; enable only via `mode === 'development'` (i.e. `vite dev` / `vite build --mode development`).

**Why:** A production sourcemap embeds the original modules' source — including the `virtual:dataset` module that contains all medical values verbatim as JSON. Shipping a sourcemap to a static host effectively re-publishes the dataset in plaintext alongside the (already inlined) bundle, doubling the surface area for accidental disclosure (e.g. caches, archive sites). Dev sourcemaps are fine because dev builds aren't deployed.

### D10. CSV watch in dev — decided, not optional

The plugin calls `this.addWatchFile(path)` for each of `RESULTS_CSV` / `PARAMS_CSV` / `EVENTS_CSV`. In `vite dev`, editing a CSV invalidates `virtual:dataset` and the page hot-reloads. This is cheap and a clear DX win when iterating on a new dataset.

## Risks / Trade-offs

- **[Bundle size grows from "0 bytes of JS we ship" to a non-trivial baseline]** → Chart.js + zoom + annotation + hammer + date-fns adapter + 6 font weights are not small. Measured against the sample dataset: JS ~293 KB raw / ~94 KB gzipped, CSS ~13 KB raw / ~3 KB gzipped, woff2 fonts ~132 KB (already compressed). Per-page transfer ~150–200 KB gzipped on modern browsers. Mitigated by long-cache hashed filenames. Documented in README; re-measure when adding deps.
- **[CSV schema rigidity]** → Lab exporters vary. We control the schema, so any new source format requires an upstream transform script. Document this clearly; do not try to make the loader "smart".
- **[Medical data inlined into JS bundle]** → Each build is patient-specific. Mitigation: README must call this out; deployments must scope hosting per patient (e.g., one bucket per patient, signed URL, or basic auth at the host layer). The build pipeline does not own access control.
- **[Sourcemaps as a leak vector]** → A production sourcemap re-exposes the inlined dataset as plaintext JSON. D9 disables prod sourcemaps; do not flip that flag without revisiting the privacy posture.
- **[Real data committed by reflex]** → `data/` exists in the repo for *sample* CSVs; users may drop real exports there out of habit. Mitigation: gitignore `data/*` except `*.sample.csv`, document in README that real CSVs belong outside the repo (e.g. `~/labs/<patient>/*.csv`), and have CI fail if a non-sample CSV appears under `data/`.
- **[Chart.js plugin churn]** → annotation + zoom plugins occasionally have breaking changes. Pin exact versions in `package.json`; renovate manually.
- **[Virtual module + TS DX]** → Requires a `virtual.d.ts` shim to type the import. If this proves brittle in editors, fall back to D2's codegen alternative.
- **[1:1 visual fidelity]** → No automated regression check. Mitigation: keep `index.html` from the old version in git history; manual side-by-side compare on first migration.

## Migration Plan

This is a greenfield refactor of a single-file demo, so "migration" is mostly a one-shot replacement.

1. Land Vite scaffold + TS + tooling on a feature branch; `npm run build` works against committed sample CSVs.
2. Port chart view; manual diff against current `index.html` rendered side-by-side.
3. Port table view; same diff procedure.
4. Wire CSV plugin + virtual module; verify validation errors fail the build with clear messages.
5. Delete the old monolithic `<script>` block from `index.html`; reduce it to the shell + module entry.
6. Document env vars and CSV schemas in README. Add `data/*.sample.csv` examples.
7. Tag the pre-migration commit (`pre-vite`) so the legacy single-file version remains accessible.

**Rollback:** check out the `pre-vite` tag and serve `index.html` directly. The legacy file is fully self-contained.

## Open Questions

- Should the build write a `build-info.json` next to `dist/index.html` recording the input CSV paths/hashes and build timestamp for traceability of which dataset produced which deploy? Default: yes, small and useful for medical context. **Caveat:** `build-info.json` MUST NOT contain the CSV contents — only paths, sha256s, and timestamp — to avoid re-leaking data.
- Where does the CSV transform live when a real lab export arrives in a different shape? Out of scope for this change but expect a follow-up `lab-export-adapters` capability.
