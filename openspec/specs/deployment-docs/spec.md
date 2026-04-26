# deployment-docs Specification

## Purpose

TBD - created by archiving change update-readme-deploy-branch. Documents how the project's deployment workflow is described to contributors via the README.

## Requirements

### Requirement: README documents the deploy command

The README SHALL describe how to publish a built site, naming the `npm run deploy` script and stating that it runs the production build and pushes `dist/` to the `gh-pages` branch.

#### Scenario: Reader looks up how to deploy
- **WHEN** a contributor opens `README.md` looking for deployment instructions
- **THEN** they find a section that names `npm run deploy` and explains it builds and publishes `dist/`

#### Scenario: Scripts table lists deploy
- **WHEN** a reader scans the "Scripts" code block
- **THEN** `npm run deploy` appears alongside `dev`, `typecheck`, `build`, and `preview`

### Requirement: README explains the gh-pages branch convention

The README SHALL state that the `gh-pages` branch contains only built artifacts, is managed by the `gh-pages` npm package, and MUST NOT be edited by hand.

#### Scenario: Reader sees an unfamiliar gh-pages branch
- **WHEN** a contributor notices the `gh-pages` branch in the repo
- **THEN** the README tells them it is auto-generated build output and not a source branch

### Requirement: README repeats the privacy warning in the deploy context

The deploy section SHALL include (or directly reference) the warning that publishing exposes one patient's inlined data to anyone with the URL, so readers cannot follow the deploy steps without seeing the privacy implication.

#### Scenario: Reader follows the deploy steps
- **WHEN** a reader reads the deploy section end-to-end
- **THEN** they encounter an explicit reminder that the deployed site exposes inlined patient data

### Requirement: README notes the relative-base Vite setting

The README SHALL note that `vite.config.ts` sets `base: './'` to support GitHub Pages subpath hosting, so future editors of the Vite config understand why the setting exists.

#### Scenario: Reader edits Vite config
- **WHEN** a contributor opens the README before changing `vite.config.ts`
- **THEN** they find a one-line note explaining the `base: './'` setting is required for GitHub Pages
