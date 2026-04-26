## MODIFIED Requirements

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
