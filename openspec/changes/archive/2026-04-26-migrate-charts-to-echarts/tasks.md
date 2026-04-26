## 1. Dependency swap

- [x] 1.1 Remove `chart.js`, `chartjs-plugin-zoom`, `chartjs-plugin-annotation`, `chartjs-adapter-date-fns`, `hammerjs`, and `@types/hammerjs` from `package.json`
- [x] 1.2 Add `echarts` (latest 5.x) as a dependency
- [x] 1.3 Run `npm install` and verify `package-lock.json` reflects the swap

## 2. Markup and styles

- [x] 2.1 Remove the `#date-from`, `#date-to`, and `#btn-reset` controls (and their wrapping group) from `index.html`
- [x] 2.2 Replace `<canvas id="mainChart">` with `<div id="mainChart">` sized for ECharts (ECharts renders into a div, not a canvas)
- [x] 2.3 Drop any unused CSS rules from `src/styles.css` left over from the date inputs / reset button

## 3. Rewrite `src/views/chart.ts`

- [x] 3.1 Replace Chart.js imports and `Chart.register(...)` with selective `echarts/core` imports and `echarts.use([...])` for `LineChart`, `GridComponent`, `TooltipComponent`, `MarkAreaComponent`, `MarkLineComponent`, `DataZoomComponent`, `VisualMapComponent`, and `CanvasRenderer`
- [x] 3.2 Initialize a single `echarts.init(el)` instance inside `initChart` and store it in module/closure scope
- [x] 3.3 Build the option object with `xAxis: { type: 'category', data: dates }` and dual `yAxis` entries (left + right) styled to match the current colors
- [x] 3.4 Build series: one `line` series per selected param, `smooth: true`, on its respective `yAxisIndex`; data is the param's value-per-date aligned to the X category list (use `null` for missing dates)
- [x] 3.5 Attach reference annotations as per-series `markArea` (when `lo !== null`) or `markLine` (max-only) using the series color and label text
- [x] 3.6 Attach event annotations to the primary series: `markArea` for ranged events (`date`..`dateTo`), `markLine` for point events; gate by `activeEvents` set
- [x] 3.7 Configure per-series `visualMap` with `pieces` covering `< lo` and `> hi` (or only `> hi` for max-only params), out-of-range color = danger
- [x] 3.8 Configure `dataZoom`: one `slider` on xAxis + one `inside` (wheel + pinch + drag); both bound to the full `dates` extent
- [x] 3.9 Implement the tooltip `formatter` to keep Polish long-form date title and `↑ za wysoki` / `↓ za niski` flags, reusing `fmtVal` and `status` from `format.ts`
- [x] 3.10 Replace `updateChart` with a single `setOption(opt, { notMerge: true, lazyUpdate: true })` call; remove the `chart.destroy(); new Chart(...)` cycle
- [x] 3.11 Wire selector and chip change handlers to rebuild the option and call the new `update`; remove the `dfrom` / `dto` / `resetBtn` listeners
- [x] 3.12 Add a `window.resize` listener that calls `chart.resize()`
- [x] 3.13 Keep `updateLegend` and `renderChips` behavior unchanged (still operate on the same DOM elements)

## 4. Verification

- [x] 4.1 `npm run typecheck` passes
- [x] 4.2 `npm run build` passes; record bundle-size delta vs. main
- [x] 4.3 Manual dev check: dual selectors switch series correctly; right axis hides when sel2 is empty or duplicates sel1
- [x] 4.4 Manual dev check: out-of-range points and segments render in the danger color for both two-bound and max-only params
- [x] 4.5 Manual dev check: dataZoom slider narrows/widens the X range; wheel and pinch zoom around the cursor; click-drag pans
- [x] 4.6 Manual dev check: event chips toggle their `markArea` / `markLine` on and off; ranged vs. point events render correctly
- [x] 4.7 Manual dev check: tooltip shows Polish long-form date and `↑/↓` flags; numbers use `,` as decimal separator

## 5. Docs

- [x] 5.1 Update the tech-stack section of `README.md` to list `echarts` and remove the Chart.js entries (CLAUDE.md requires README to stay in sync)
