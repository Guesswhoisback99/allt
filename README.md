# allt

Static page that visualizes blood-test results: a chart of any two parameters with reference ranges and event annotations, plus a per-date results table.

One build = one patient. `npm run build` reads three CSVs from env vars, validates them, and inlines the data into a self-contained `dist/`. No CDN, no runtime fetches.

## Usage

```bash
npm install

RESULTS_CSV=$HOME/labs/jan/results.csv \
PARAMS_CSV=$HOME/labs/jan/params.csv \
EVENTS_CSV=$HOME/labs/jan/events.csv \
  npm run build
```

Real CSVs belong outside the repo. `data/` only holds `*.sample.csv`; everything else there is gitignored.

## CSV schemas

**`params.csv`** — `id,name,short,unit,lo,hi`
- `id` unique, `hi > 0`. Empty `lo` = upper-bound-only; numeric `lo` (incl. `0`) is a real floor and requires `hi > lo`.

**`results.csv`** — `date,param_id,value`
- `date` is `YYYY-MM-DD`; `param_id` must exist in params; `value` uses `.` decimal. Missing pairs render as gaps.

**`events.csv`** — `id,date,date_to,label`
- `id` unique non-empty. Empty `date_to` = point event (dashed line); set = range event (band), strictly `> date`.

See `data/*.sample.csv` for working examples.

## Build output

`dist/index.html`, hashed JS/CSS/font assets, and `build-info.json` (timestamp + input paths + sha256s; no row data). Production builds ship no sourcemaps — they would re-publish the inlined data.

Sample-dataset bundle: JS 94 KB gz, CSS 3 KB gz, woff2 fonts 132 KB. ~150–200 KB transferred per page on modern browsers.

## Privacy

The dataset is inlined into the JS bundle. Each deployed site exposes one patient's data to anyone with the URL — host-level access control is your responsibility.

## Scripts

```
npm run dev        # vite dev server, HMR on CSV edits
npm run typecheck  # tsc --noEmit
npm run build      # tsc --noEmit && vite build
npm run preview    # serve dist/ locally
```

## Legacy

Pre-build-pipeline `index.html` is preserved at the `pre-vite` git tag.
