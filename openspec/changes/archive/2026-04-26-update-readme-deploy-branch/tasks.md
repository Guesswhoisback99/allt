## 1. README cleanup

- [x] 1.1 Remove stale/redundant content from `README.md` — including the data-tracking note that `data/` only holds `*.sample.csv` (the `gh-pages` commit changed `.gitignore` to ignore all of `data/`), and any other lines made redundant by the current build/deploy setup
- [x] 1.2 Tighten remaining sections so each fact appears once (e.g. avoid repeating the inlined-data privacy point in multiple places without purpose)

## 2. README deploy section

- [x] 2.1 Add `npm run deploy` to the "Scripts" code block in `README.md`
- [x] 2.2 Add a "Deploy" section between "Build output" and "Privacy" covering: the `npm run deploy` command, the `gh-pages` branch as auto-managed build output (do not edit by hand), the `gh-pages` dev dependency, and a one-line note that `vite.config.ts` sets `base: './'` for GitHub Pages subpath hosting
- [x] 2.3 Include an inline privacy reminder in the new Deploy section that publishing exposes one patient's inlined data to anyone with the URL

## 3. CLAUDE.md

- [x] 3.1 Create a very short, concise `CLAUDE.md` at the repo root whose only instruction is that `README.md` must be kept in sync with the code/build/deploy setup whenever those change

## 4. Verify

- [x] 4.1 Re-read `README.md` end-to-end and confirm every requirement in `specs/deployment-docs/spec.md` is satisfied and no stale content remains
- [x] 4.2 Run `openspec status --change update-readme-deploy-branch` and confirm artifacts are complete
