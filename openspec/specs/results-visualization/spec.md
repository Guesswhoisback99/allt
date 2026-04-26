# Results Visualization

## Purpose

Describes the browser-side UI for viewing health results, including the chart and table views, event annotations, date filtering, and Polish locale formatting.

## Requirements

### Requirement: Two top-level views — Chart and Table

The page SHALL present a header with two tabs, "Wykres" (Chart) and "Tabela" (Table), and switch between the two views without a full page reload. Chart SHALL be active by default.

#### Scenario: Default load
- **WHEN** the user first opens the page
- **THEN** the Chart tab is active and the chart view is visible

#### Scenario: Tab switch
- **WHEN** the user clicks the "Tabela" tab
- **THEN** the chart view is hidden, the table view becomes visible, and the URL hash/state need not be persisted

### Requirement: Chart view — two parameters with independent axes

The chart view SHALL allow the user to pick two parameters from the params dataset and plot them as time series, with parameter 1 on a left Y axis and parameter 2 on a right Y axis. Either selector MAY be set to "— brak —" (none) to hide that axis.

#### Scenario: Both parameters selected
- **WHEN** both selectors hold distinct parameter ids
- **THEN** both series are rendered with their reference ranges and both Y axes are shown

#### Scenario: Same parameter chosen on both selectors
- **WHEN** the user selects the same parameter on both selectors
- **THEN** only the left-axis series is rendered; the right axis is hidden

#### Scenario: One parameter set to none
- **WHEN** a selector is set to the empty value
- **THEN** the corresponding series, axis, and reference annotation are hidden; the other side renders normally

### Requirement: Reference range annotations and out-of-range marking

For each plotted series, the chart SHALL render the parameter's reference range as a per-series `markArea` `[lo, hi]` when `lo` is set, or as a single dashed `markLine` at `hi` when `lo` is unset (upper-bound-only parameter). Data points and connecting segments where the value falls outside the range SHALL be drawn in the danger color, expressed via a per-series `visualMap` with `pieces` covering `< lo` and `> hi` (or only `> hi` for upper-bound-only parameters).

#### Scenario: Value below lo
- **WHEN** a measurement is below the parameter's `lo`
- **THEN** that point is rendered in the danger color and labelled "↓ za niski" in the tooltip

#### Scenario: Value above hi
- **WHEN** a measurement is above the parameter's `hi`
- **THEN** that point is rendered in the danger color and labelled "↑ za wysoki" in the tooltip

#### Scenario: Upper-bound-only parameter
- **WHEN** a parameter has `lo` unset
- **THEN** the chart renders a single dashed `markLine` at `hi` instead of a shaded band, and only `value > hi` triggers danger styling

### Requirement: Date range filtering and reset

The chart view SHALL provide an inline X-axis range control (an ECharts `dataZoom` slider) that lets the user narrow and widen the visible date range. A separate "Od" / "Do" / "Resetuj" input group SHALL NOT be present; the slider's handles and reset gesture replace them.

#### Scenario: Narrow the range
- **WHEN** the user drags the left handle of the dataZoom slider inward
- **THEN** the chart's X axis minimum updates to the date under that handle and the rest of the chart re-renders to fit

#### Scenario: Widen back to full range
- **WHEN** the user drags both handles back to the slider extents (or uses the slider's reset affordance)
- **THEN** the X axis returns to the full `[first, last]` range of the results dataset

### Requirement: Zoom and pan

The chart SHALL support mouse-wheel and pinch zoom on the X axis and click-drag panning on the X axis (via an `inside` dataZoom), bounded by the original data range. The visible slider dataZoom SHALL stay in sync with inside-zoom interactions.

#### Scenario: Wheel zoom
- **WHEN** the user scrolls the wheel over the chart
- **THEN** the X axis zooms around the cursor, the slider handles move to reflect the new range, and vertical scaling is unchanged

#### Scenario: Drag pan inside the chart
- **WHEN** the user click-drags horizontally inside the chart area while zoomed in
- **THEN** the visible X range translates without changing zoom level, and the slider handles move with it

### Requirement: Event annotations toggleable per event

The chart view SHALL display a chip for each event in the events dataset, keyed by the event's `id` (so chip state is stable across edits to label, date, or row order). Each chip SHALL toggle the rendering of that event's annotation on the chart, implemented as a `markArea` for ranged events and a `markLine` for point events. All events SHALL be enabled by default.

#### Scenario: Toggle off
- **WHEN** the user clicks an active event chip
- **THEN** the chip becomes inactive and the corresponding `markArea` / `markLine` is removed from the next `setOption` update

#### Scenario: Range event rendering
- **WHEN** an active event has both `date` and `date_to`
- **THEN** the chart renders a `markArea` spanning `[date, date_to]` with the event label

#### Scenario: Point event rendering
- **WHEN** an active event has only `date`
- **THEN** the chart renders a dashed `markLine` at `date` with the event label

### Requirement: Table view — date sidebar with anomaly flags

The table view SHALL present a sidebar listing every result date in reverse chronological order. Each date SHALL show a danger-colored flag dot iff at least one parameter on that date is out of range. The sidebar SHALL include a free-text search field that filters dates by ISO or `dd.mm.yyyy` substring match. The most recent date SHALL be selected by default.

#### Scenario: Select a date
- **WHEN** the user clicks a date in the sidebar
- **THEN** the right pane shows that date's results table and the sidebar item is marked active

#### Scenario: Search filter
- **WHEN** the user types into the search field
- **THEN** the sidebar shows only matching dates and a "N / total" count is displayed

#### Scenario: Anomaly flag
- **WHEN** at least one of the parameters for a given date is below `lo` or above `hi`
- **THEN** that date's sidebar item shows the danger-colored flag dot

### Requirement: Table view — per-date results table

For the selected date, the right pane SHALL render a header showing the date and an aggregate status ("Wszystkie wyniki w normie" or "N wyników poza normą") followed by a table with columns Parametr, Wynik, Jednostka, Zakres referencyjny, Status. Status SHALL be a badge: ✓ Norma / ↑ Podwyższony / ↓ Obniżony.

#### Scenario: All in range
- **WHEN** every parameter on the selected date is within `[lo, hi]`
- **THEN** the header shows "Wszystkie wyniki w normie" in the OK color

#### Scenario: Mixed range and danger values
- **WHEN** at least one parameter is out of range
- **THEN** the header shows the count in the danger color and out-of-range rows have danger-colored values and a non-ok badge

### Requirement: Polish locale and number formatting

Dates SHALL be displayed as `dd.mm.yyyy` in the table sidebar and Polish long form (e.g. "15 czerwca 2023") in chart tooltips. Numeric values SHALL use `,` as the decimal separator with up to 2 fractional digits, trailing zeros stripped.

#### Scenario: Decimal value formatting
- **WHEN** a measurement value is `13.80`
- **THEN** it is rendered as `13,8`
