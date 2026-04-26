# Static Build

## Purpose

Describes the build pipeline requirements for producing a self-contained, hermetic static site from CSV data inputs.

## Requirements

### Requirement: Single-command build produces a static deployable

A single `npm run build` invocation SHALL produce a `dist/` directory that is a complete, self-contained static site deployable to any static host (S3, Netlify, Vercel, GitHub Pages, nginx) without server-side execution.

#### Scenario: Successful build
- **WHEN** the user runs `npm run build` with valid env vars and CSV inputs
- **THEN** `dist/` contains `index.html`, hashed JS/CSS bundles, and bundled font files, and opens correctly when served as static content

#### Scenario: Output is hermetic
- **WHEN** the resulting `dist/index.html` is served from a host with no internet egress
- **THEN** the page renders fully — charts, fonts, and table — with no external network requests

### Requirement: Locally bundled third-party assets

Chart.js, its plugins, the date-fns adapter, hammer.js, and the DM Sans / DM Mono fonts SHALL be installed as npm dependencies (or vendored font files) and bundled into `dist/`. No `<script>` or `<link>` tag in the produced HTML SHALL reference an external CDN, Google Fonts, or any third-party origin.

#### Scenario: HTML output inspection
- **WHEN** the produced `dist/index.html` is inspected
- **THEN** every `src` and `href` is either relative or a `data:` URI

### Requirement: Data inlined at build time

The validated CSV-derived data SHALL be inlined into the JS bundle. The bundle SHALL NOT issue runtime fetches to obtain measurement data.

#### Scenario: Network panel after page load
- **WHEN** the built page is loaded in a browser
- **THEN** no XHR/fetch requests for results, params, or events files are made

### Requirement: One build = one HTML

Each invocation of the build SHALL produce exactly one `index.html` corresponding to one dataset (one set of `RESULTS_CSV` / `PARAMS_CSV` / `EVENTS_CSV`). Multi-dataset deployments are out of scope and SHALL be achieved by running the build multiple times.

#### Scenario: Repeated builds with different env values
- **WHEN** the build is run twice with two different sets of CSV paths into different output directories
- **THEN** each output directory is a standalone deployable for its respective dataset

### Requirement: Build failure leaves prior output intact

If the build fails for any reason (missing env, validation error, type-check error, bundler error), `dist/` SHALL not be partially overwritten with a broken artifact.

#### Scenario: Mid-build failure after a previous success
- **WHEN** a prior successful `dist/` exists and a new build fails during validation or bundling
- **THEN** the prior `dist/` is either fully replaced by a new successful build or left untouched — never left in a partially written state

### Requirement: TypeScript type checking gates the build

The build SHALL run TypeScript type checking. Type errors SHALL cause the build to fail.

#### Scenario: Type error in source
- **WHEN** any `.ts` file under `src/` has a type error
- **THEN** `npm run build` exits non-zero and reports the error
