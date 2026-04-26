## Context

`src/views/chart.ts` currently renders the time-series chart with Chart.js plus four ecosystem plugins (`chartjs-plugin-zoom`, `chartjs-plugin-annotation`, `chartjs-adapter-date-fns`, `hammerjs`). The implementation hand-rolls per-point colors (`ptColors`) and per-segment border colors (`segment.borderColor`) to mark out-of-range values, builds an annotation map keyed by event id, and rebuilds the chart from scratch on every selector change (`chart.destroy(); new Chart(...)`). Date filtering happens via two `<input type="date">` controls plus a "Resetuj" button that reset `scales.x.min/max`.

ECharts (Apache, 5.x) supports the same chart family with declarative primitives that match this app's needs one-to-one: `dataZoom` for slider + inside zoom/pan, `markArea`/`markLine` for annotations, `visualMap.pieces` for value-conditional coloring, native dual y-axis. It is also tree-shakeable via `echarts/core`, so we can hand-pick a small set of components instead of pulling the whole library.

## Goals / Non-Goals

**Goals:**
- Drop the Chart.js dependency tree (chart.js + 4 plugins + hammerjs) in favor of a single tree-shaken ECharts import.
- Replace destroy/recreate updates with a single `setOption` lifecycle (init once, mutate options).
- Replace manual date inputs with a `dataZoom` slider; keep wheel + pinch zoom via `inside` dataZoom.
- Express reference bands, max-only thresholds, event ranges, event points, and out-of-range coloring declaratively (no per-point/per-segment callbacks).
- Preserve all observable behavior of the existing chart: dual selectors, dual y-axes, smooth lines, event-chip toggling, Polish locale tooltip, danger coloring of out-of-range points.

**Non-Goals:**
- Restyling the chart beyond what the engine swap forces.
- Changes to the Table view, data ingestion, or Polish formatting helpers (`format.ts`).
- Persisting zoom state across reloads.
- Migrating other parts of the app or introducing new visualizations.

## Decisions

### Decision 1: Use ECharts via selective `echarts/core` imports
Pull only `LineChart`, `GridComponent`, `TooltipComponent`, `LegendComponent` (off but registered for type compatibility — actually skip if unused), `MarkAreaComponent`, `MarkLineComponent`, `DataZoomComponent`, `VisualMapComponent`, plus `CanvasRenderer`. Register them once at module top-level (mirroring the current `Chart.register(...)` pattern).
- **Why**: Tree-shaken footprint is far smaller than `import 'echarts'`. Matches our actual feature set; no other components needed.
- **Alternative considered**: Full `echarts` import — simpler but ships every chart type and component we don't use.

### Decision 2: One `echarts.init` per page; updates via `setOption(opt, { notMerge: true })`
Keep a single `EChartsType` instance for the lifetime of the chart view. On selector or chip change, rebuild the option object and call `setOption(opt, { notMerge: true, lazyUpdate: true })` to fully replace series, markAreas, markLines, and visualMap.
- **Why**: Eliminates the destroy/recreate churn we have today and avoids the merge-vs-replace edge cases (e.g., stale markLines persisting). `notMerge: true` gives Chart.js-style "rebuild from scratch" semantics with a single API call.
- **Alternative considered**: Incremental merge updates — finer-grained but harder to reason about when series count or axes change.

### Decision 3: `dataZoom` replaces `date-from` / `date-to` / "Resetuj"
Use one `slider` dataZoom on the X axis (visible) plus one `inside` dataZoom (wheel + pinch + drag pan). The slider's drag handles + double-click-to-reset cover the manual-input use case; "Resetuj" becomes redundant.
- **Why**: The slider gives continuous, visible feedback that two date inputs cannot, and `inside` dataZoom delivers wheel/pinch/pan without the `chartjs-plugin-zoom` + `hammerjs` pair.
- **Trade-off**: Users lose the ability to type an exact date. Acceptable for a personal-results dashboard; revisit if requested.
- **Alternative considered**: Keep the date inputs and bind them to the dataZoom — extra wiring for a feature the slider already covers.

### Decision 4: Annotation translation table
| Current (Chart.js)                           | New (ECharts)                                                       |
|----------------------------------------------|---------------------------------------------------------------------|
| Event range (`box` xMin/xMax)                | Series-level `markArea` with two-point pair (date, dateTo)          |
| Event point (`line` xMin=xMax)               | Series-level `markLine` at xAxis date                               |
| Reference band (`box` yMin=lo, yMax=hi)      | Per-series `markArea` on its own y axis                             |
| Max-only threshold (`line` yMin=yMax=hi)     | Per-series `markLine` at y=hi with dashed style                     |
| `ptColors` + `segment.borderColor` (danger)  | `visualMap.pieces` over series y-value with `outOfRange` color      |

Event annotations are attached to the first/primary series (so they render once per event regardless of how many series are visible). Reference annotations attach to their own series so they hide automatically when the series is hidden.

### Decision 5: Per-series `visualMap` instead of callbacks
Each series gets its own `visualMap` (controlled by `seriesIndex`) with `pieces`:
- For two-bound params: `[{ lt: lo, color: DANGER }, { gt: hi, color: DANGER }]`, default in-range color = series color.
- For max-only params: `[{ gt: hi, color: DANGER }]`.
This colors both points and the connecting line segments declaratively — replacing today's `ptColors` array and `segment.borderColor` callback.
- **Why**: Single source of truth; no per-point arrays to keep in sync with data.
- **Alternative considered**: Use ECharts' `itemStyle` callback per data item — works but reintroduces the imperative pattern we're trying to delete.

### Decision 6: X axis uses `time` with proportional date spacing
The X axis is configured as `xAxis.type: 'time'` with `min` / `max` clamped to the first and last dates in the dataset. Tooltip formatting still uses local helpers for Polish long-form rendering; no date adapter dependency is needed (ECharts' `time` axis handles parsing natively).
- **Why**: `dataZoom` operates on real timestamps, so the slider handles, wheel zoom, and pan map cleanly to date ranges. Event `markArea`/`markLine` and reference annotations are also expressed against timestamps, which removes the need to translate between category indices and dates. The proportional spacing (gaps between sparse measurements) is acceptable and arguably more accurate than the uniform-category look.
- **Alternative considered**: `xAxis.type: 'category'` over the `dates` array — would keep uniform point spacing but forces all dataZoom/markArea inputs through category-index math, which is harder to reason about and conflicts with how events express ranges.

## Risks / Trade-offs

- **Risk**: ECharts visualMap segment coloring may render the connecting line segment color differently from Chart.js's per-segment border (e.g., a partial-segment gradient when a segment crosses the threshold). → **Mitigation**: Accept the ECharts default (gradient transition); verify visually in dev. If unacceptable, fall back to `series.itemStyle.color` callback.
- **Risk**: Removing the date inputs is a UX change users may notice. → **Mitigation**: Documented as BREAKING in the proposal; the `dataZoom` slider is more discoverable, not less.
- **Risk**: `markArea` / `markLine` labels may collide on dense event ranges. → **Mitigation**: Use the same muted gray styling as today; if collision is severe, set `label.distance` and `label.position` per-event during testing.
- **Trade-off**: Bundle has one heavier core dep instead of five smaller ones, but with selective imports the net is expected to be smaller. Validate with `vite build` size diff before/after.

## Migration Plan

1. Install `echarts`; remove `chart.js`, `chartjs-plugin-zoom`, `chartjs-plugin-annotation`, `chartjs-adapter-date-fns`, `hammerjs`, `@types/hammerjs`.
2. Rewrite `src/views/chart.ts` against ECharts (single `init`, `setOption`-driven updates).
3. Remove `#date-from`, `#date-to`, `#btn-reset` from `index.html` and any related styles from `src/styles.css`.
4. Update `results-visualization` spec: rewrite the date-range and zoom/pan requirements; leave behavioral requirements (dual-axis, reference bands, event chips, danger coloring) unchanged.
5. Run `npm run typecheck` and `npm run build`; record bundle-size delta.
6. Manual verification in `npm run dev`: dual selectors, both axes visible, slider + wheel zoom, chip toggles, out-of-range points red, max-only param shows dashed line.
7. Update `README.md` tech-stack section.

Rollback: revert the commit; the dependency swap is fully contained in `package.json`, `chart.ts`, `index.html`, `styles.css`, and the spec.

## Open Questions

- Should we keep a "reset zoom" affordance (e.g., a small button or double-click handler) for users who lose the "Resetuj" button? Default proposal: rely on the dataZoom slider's own reset.
