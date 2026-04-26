# allt

Static page that visualizes blood-test results

## Usage

```bash
npm install

RESULTS_CSV=$HOME/labs/jan/results.csv \
PARAMS_CSV=$HOME/labs/jan/params.csv \
EVENTS_CSV=$HOME/labs/jan/events.csv \
  npm run build
```

## CSV schemas

**`params.csv`** — `id,name,short,unit,lo,hi`
- `id` unique, `hi > 0`. Empty `lo` = upper-bound-only; numeric `lo` (incl. `0`) is a real floor and requires `hi > lo`.

**`results.csv`** — `date,param_id,value`
- `date` is `YYYY-MM-DD`; `param_id` must exist in params; `value` uses `.` decimal. Missing pairs render as gaps.

**`events.csv`** — `id,date,date_to,label`
- `id` unique non-empty. Empty `date_to` = point event (dashed line); set = range event (band), strictly `> date`.

## Deploy

```bash
npm run deploy
```

Builds and pushes `dist/` to the `gh-pages` branch via the `gh-pages` dev dependency. Enable GitHub Pages on that branch in the repo settings.

The `gh-pages` branch holds only generated build output — do not edit it by hand. `vite.config.ts` sets `base: './'` so assets resolve under any GitHub Pages subpath; leave that setting in place.

**Deploying publishes one patient's inlined data to a public URL.** See Privacy.

## Scripts

```
npm run dev        # vite dev server, HMR on CSV edits
npm run typecheck  # tsc --noEmit
npm run build      # tsc --noEmit && vite build
npm run preview    # serve dist/ locally
npm run deploy     # build and publish dist/ to the gh-pages branch
```

