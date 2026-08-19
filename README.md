# dsh-skills-manager

DSH native Skills visual manager with an external Agent Skills importer.

This plugin adds a **Settings → Skills** tab that Views, Searches, Creates, Edits and Deletes DSH native Skills through DSH's official Skills service. It also performs a one-time scan of common external Agent Skills libraries (Claude Code, OpenAI Codex, Cursor, Gemini CLI) and imports them into DSH's managed `$DSH_HOME/skills` directory.

The plugin deliberately does **not** reimplement DSH's Skill Registry, Loader, Runtime, Context Injector, Catalog, Progressive Disclosure, Cache, or Watcher. It only reads through `ctx.skills` (with the same agent-preset scope used by DSH's `/api/skill.list`) and writes into DSH-managed skill directories.

## Features

- `Settings → Skills` UI (search / view / new / edit / delete)
- External import pipeline: `scan → normalize → deduplicate → conflict detect → import`
- Three-layer dedup: canonical realpath, deterministic content fingerprint, name conflict
- Never auto-overwrites DSH existing skills; never deletes external source files
- Idempotent re-runs
- Thin same-origin JSON API: `POST /skills-manager/api/*`

## Build

```bash
npm install   # or pnpm install (dev-only)
pnpm run typecheck
pnpm run typecheck:client
pnpm run test
pnpm run build:client
pnpm exec tsc -p tsconfig.json
```

Or use the DSH plugin build helper:

```bash
DSH_CHECKOUT=<checkout> bash scripts/build.sh
```

## API

All routes require a same-origin POST.

- `skills.list` / `skills.get` / `skills.create` / `skills.update` / `skills.delete`
- `import.scan` / `import.meta` / `import.conflicts` / `import.resolve`
