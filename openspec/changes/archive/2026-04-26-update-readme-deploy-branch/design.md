## Context

A docs-only change. The deployment mechanism already exists on `main` (commit `d3e0ed7`): `gh-pages` is a dev dep, `npm run deploy` runs `npm run build && gh-pages -d dist`, and `vite.config.ts` sets `base: './'` so assets resolve under any GitHub Pages subpath. The `gh-pages` branch holds only the published `dist/` output. The README has not been updated to reflect any of this.

## Goals / Non-Goals

**Goals:**
- README accurately documents how to deploy and where the build lands.
- Reader understands `main` = source, `gh-pages` = build artifacts (auto-managed).
- Privacy section reinforces that deploying publishes inlined patient data.

**Non-Goals:**
- No CI/CD automation (GitHub Actions etc.).
- No change to the deploy script, Vite config, or branch layout.
- No multi-patient or environment-aware deployment.

## Decisions

- **Add a top-level "Deploy" section** between "Build output" and "Privacy" so readers see deploy mechanics before the privacy warning, then re-read the warning in the new context. Alternative considered: append after "Scripts" — rejected because the privacy implication of deploying must be adjacent to the deploy instructions.
- **Document the `gh-pages` branch as build-artifact-only and managed by the `gh-pages` npm package.** Tell readers not to edit it by hand. Alternative: stay silent on the branch — rejected because a stray `gh-pages` branch with no explanation is confusing and invites manual edits.
- **Mention `base: './'`** so anyone changing the Vite config understands why it is set (relative paths needed for Pages subpath hosting). One-line note, not a full explanation.
- **Add `npm run deploy` to the existing Scripts block** rather than duplicating it inside the Deploy section.

## Risks / Trade-offs

- [Reader deploys without realizing data is public] → Repeat the privacy warning inline in the Deploy section, not just in the standalone Privacy section.
- [Docs drift if deploy mechanism changes] → Keep the Deploy section short (script name + branch name + one-line GitHub Pages setup hint); avoid re-explaining what `gh-pages -d dist` does.
