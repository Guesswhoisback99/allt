# OpenSpec

Spec-driven development for AI assistants. Each change is a folder under `openspec/changes/<name>/` (proposal, design, delta specs, tasks) — agreed before code, then archived into `openspec/specs/`.

## Flow

`propose → apply → verify → archive` (`ff` generates all artifacts at once)

## Slash commands

- `propose` / `new` — start a change (one-shot vs step-by-step)
- `continue` / `ff` — add next artifact / generate all remaining
- `explore` — think through ideas before committing
- `apply` — implement `tasks.md`
- `verify` — check code matches artifacts
- `sync` — merge delta specs into main specs
- `archive` — move change to `archive/YYYY-MM-DD-<name>/` (+ optional sync)
- `onboard` — guided walkthrough

## CLI

- `init` / `update` — set up / refresh agent files
- `list` / `show` / `view` — inspect changes & specs
- `status --change <name>` — artifact completion
- `validate` — check structure
- `archive <name>` — CLI equivalent of `/opsx:archive`
- `config` / `schemas` / `templates` / `instructions` — config & authoring helpers
