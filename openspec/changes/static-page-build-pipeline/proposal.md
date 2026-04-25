## Why

`index.html` is currently a single, hand-edited static file with all blood-test data, parameter metadata, and life events hard-coded into a `<script>` block. This blocks reuse: every new dataset (e.g. another patient, another period, a re-export from the lab) requires editing HTML by hand. We need a repeatable build that turns external data into a deployable static page, while keeping the output a single self-contained artifact suitable for any static host.

## What Changes

- Introduce a Vite + vanilla TypeScript build that emits a static `dist/` deployable to any static host.
- Extract data, parameter metadata, and events out of `index.html` and load them at build time from CSV files referenced by environment variables (`RESULTS_CSV`, `PARAMS_CSV`, `EVENTS_CSV`).
- Vendor Chart.js, its plugins, and the DM Sans / DM Mono fonts locally; remove all CDN/Google Fonts requests so the page works offline and leaks no third-party traffic (relevant for medical data).
- Split the single `index.html` into TS modules (chart view, table view, CSV loader, types) while preserving current UI/behavior 1:1.
- Add a CSV→typed-data loader that runs in the Vite build (Node), validates rows, and inlines the resulting JSON into the bundle.
- Add a sample dataset under `data/` and document the CSV schemas in `README.md`.
- **BREAKING**: the repo no longer ships a directly-openable `index.html`; users must run the build to produce a deployable page.

## Capabilities

### New Capabilities
- `data-ingestion`: Loading and validating lab results, parameter metadata, and events from CSV files identified by environment variables at build time.
- `static-build`: Producing a single self-contained static site (HTML + hashed JS/CSS/font assets) from the source code and the resolved dataset, with all third-party libraries bundled locally.
- `results-visualization`: The user-facing capability the page delivers — chart view with two configurable parameters and reference bands, table view per date, and event annotations. Captures the current UI as a stable contract so future data/build changes don't regress it.

### Modified Capabilities
<!-- None — this is a greenfield extraction. No existing specs in openspec/specs/. -->

## Impact

- **Code**: `index.html` is replaced by `index.html` (template shell) + `src/**/*.ts` + `src/styles.css`. The inline `<script>` block is decomposed into modules.
- **Build / deploy**: introduces `package.json`, `vite.config.ts`, `tsconfig.json`, `node_modules/`, and a `dist/` output. CI/host config must run `npm ci && npm run build` with the three CSV env vars set, then publish `dist/`.
- **Dependencies**: adds dev deps `vite`, `typescript`, `papaparse` (CSV parsing); production deps `chart.js`, `chartjs-adapter-date-fns`, `chartjs-plugin-annotation`, `chartjs-plugin-zoom`, `hammerjs`. Adds local font files for DM Sans / DM Mono.
- **No runtime backend**: output is fully static; no API, no fetch at runtime.
- **Data privacy**: medical values are embedded in the built JS bundle. Each build is patient-specific; deployment scope must match.
