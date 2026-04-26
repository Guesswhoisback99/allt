## Why

The repo now ships a GitHub Pages deployment flow (`gh-pages` branch, `npm run deploy`, `base: './'` in Vite), but the README still describes only local build/preview. New contributors have no documented way to publish a build, and the relationship between `main` (source) and `gh-pages` (built artifacts) is undocumented.

## What Changes

- Add a "Deploy" section to `README.md` documenting `npm run deploy` and the `gh-pages` branch convention.
- Note the `gh-pages` dev dependency and the `base: './'` Vite setting (so the doc matches current behavior).
- Update the "Scripts" block to include `npm run deploy`.
- Restate the privacy implication: deploying publishes one patient's inlined data to a public branch / GitHub Pages URL.

## Capabilities

### New Capabilities
- `deployment-docs`: README guidance for publishing a built site to the `gh-pages` branch.

### Modified Capabilities
<!-- None — no existing spec under openspec/specs/ covers README/deployment docs. -->

## Impact

- `README.md` only. No code, dependency, or build-pipeline changes.
- Touches user-facing docs; no runtime behavior changes.
