## Why

The Chart.js stack (chart.js + chartjs-plugin-zoom + chartjs-plugin-annotation + chartjs-adapter-date-fns + hammerjs) brings a heavy dependency footprint and forces destroy/recreate cycles on every option change. ECharts ships a single tree-shakeable library that natively supports zoom/pan via `dataZoom`, range annotations via `markArea`/`markLine`, and conditional point coloring via `visualMap` — letting us shed five dependencies, simplify update logic, and replace bespoke segment/point coloring with declarative configuration.

## What Changes

- Replace `chart.js`, `chartjs-plugin-zoom`, `chartjs-plugin-annotation`, `chartjs-adapter-date-fns`, and `hammerjs` with `echarts` (selective imports from `echarts/core`).
- Rewrite `src/views/chart.ts` to build an ECharts option object instead of a Chart.js config; mount once via `echarts.init(el).setOption(option)` and use `setOption` for updates instead of destroy/recreate.
- **BREAKING (UX)**: Remove the manual "Od" / "Do" date inputs and "Resetuj" button; use an ECharts `dataZoom` slider with `inside` zoom for wheel + pinch + drag.
- Translate annotations to ECharts primitives: event ranges → `markArea`; point events and max-only thresholds → `markLine`; reference bands → per-series `markArea`; out-of-range point coloring → `visualMap.pieces` (replaces hand-rolled `ptColors` and `segment.borderColor`).
- Preserve dual y-axis layout, smooth lines, dual-series selectors, and event chips toggle behavior.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `results-visualization`: chart rendering engine swaps from Chart.js to ECharts; date-range inputs are replaced by an inline `dataZoom` control; reference bands, out-of-range coloring, and event annotations are expressed declaratively via ECharts `markArea` / `markLine` / `visualMap`.

## Impact

- **Code**: `src/views/chart.ts` rewritten end-to-end; `index.html` loses the "Od" / "Do" / "Resetuj" inputs; `src/styles.css` may shed related rules.
- **Dependencies**: drop `chart.js`, `chartjs-plugin-zoom`, `chartjs-plugin-annotation`, `chartjs-adapter-date-fns`, `hammerjs`, `@types/hammerjs`; add `echarts`. `date-fns` retained for tooltip formatting.
- **Bundle**: net reduction expected via selective `echarts/core` imports (only `LineChart`, `MarkAreaComponent`, `MarkLineComponent`, `DataZoomComponent`, `VisualMapComponent`, `TooltipComponent`, `GridComponent`, `LegendComponent`, `CanvasRenderer`).
- **Docs**: `README.md` tech-stack section needs updating (per CLAUDE.md sync rule).
- **Specs**: `results-visualization` requirements for date filtering and zoom/pan are reworded; reference-range and event-annotation scenarios stay behaviorally equivalent.
