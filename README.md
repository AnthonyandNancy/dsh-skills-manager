# dsh-skills-manager

English | [简体中文](README.zh.md)

`dsh-skills-manager` is a visual manager for **DSH Native Skills**. It keeps DSH's native Skill Registry, Loader, Runtime, discovery, progressive loading, and context injection as the source of truth. The plugin adds a Settings surface and a manual External Skills import pipeline with safe deduplication; it does not implement a second Skills runtime.

## Features

- Settings → Skills: search, view, create, edit, and delete DSH Native Skills.
- External Skills Import for Claude Code, OpenAI Codex, Cursor, and Gemini CLI.
- Canonical-path, content-fingerprint, and name-conflict deduplication.
- No overwrite of existing DSH skills and no modification of external source files.
- Bilingual UI that follows DSH's native Locale Runtime without a page reload.
- Responsive table with visual two-line Description clamping, per-row expansion, path tooltips, and a compact Actions menu.

## Screenshots

The main surface is the DSH Settings → Skills page. It contains a title row, a wrapped search/import toolbar, an adaptive import summary, and a fixed-layout Skills table designed for narrow Settings panels.

## Requirements

- DSH with the current web client Locale, Settings Slots, UI Primitives, and Client Modules packages.
- Node.js 20 or newer.
- A DSH Web profile with the native Skills service available.

## Installation

Install the published Bundle into a profile:

```bash
dsh plugin add dsh-skills-manager
```

For a separate verification profile:

```bash
dsh plugin --profile skills-test add dsh-skills-manager
dsh --profile skills-test --dump-config
```

The package declares `dsh.bundle` and ships `cordis.patch.yml`. DSH adds the bundle layer automatically and activates the Host plugin plus its browser client entry; no manual edit to `~/.dsh/cordis.patch.yml` is required.

## Usage

Open DSH Web and choose Settings → Skills. The navigation label follows the active DSH language: `技能` in Chinese and `Skills` in English. Changing Settings → Language updates the plugin UI live.

Descriptions are clamped to two visual lines. A More/展开 control appears only when the rendered text overflows; each row expands and collapses independently. Long paths stay ellipsized and are available through hover/focus tooltip text.

## External Skills Import

External import is manual only. Use the Scan External Skills action in the Settings UI to scan the supported external skill roots, then use the conflict-resolution page when needed. The Host never scans or imports those roots during plugin load. Import is intentionally explicit about conflict handling and only writes DSH-managed skill directories.

## Deduplication

Import classification uses three layers:

1. Canonical real path prevents the same source from being scanned twice.
2. Deterministic content fingerprints identify identical Skills from different roots.
3. Name conflicts are surfaced instead of silently overwriting a DSH-managed Skill.

## Safety

The plugin delegates all runtime behavior to DSH Native Skills. It does not replace the registry, loader, runtime, discovery, progressive loading, or context injection. Delete and import operations are fenced to DSH-managed roots; external source files are never deleted or overwritten. No npm `postinstall` hook scans Skills.

## Development

This repository contains the Host entry in `src/index.ts` and the DSH ModuleLoader client entry in `src/client/index.ts`. A local DSH checkout can be selected with `DSH_CHECKOUT` for the build helper:

```bash
DSH_CHECKOUT=/path/to/deepseek-harness bash scripts/build.sh
```

## Build

```bash
pnpm run typecheck
pnpm run typecheck:client
pnpm run test
pnpm run build
pnpm pack
```

`prepack` builds both Host and Client artifacts and checks the Bundle metadata. The published tarball contains prebuilt `lib/index.js`, `lib/client.js`, declarations, `cordis.patch.yml`, both READMEs, and `LICENSE`. `lib/` is committed as well, so a git install (`dsh plugin add github:AnthonyandNancy/dsh-skills-manager`) needs no pnpm build approval; rebuild with `pnpm run build` and commit `lib/` before tagging a release.

## Publish

After updating the version and verifying the tarball:

```bash
npm pack
npm publish
```

The client build remains a CJS closure factory that calls `window.__ModuleLoader__.load({ id: 'dsh-skills-manager', factory })`; it is not converted to a standalone browser ESM bundle.

## Compatibility

The package targets DSH `0.1.0-rc` or later within the declared peer ranges, and React 18. It uses the current DSH Locale Runtime (`ctx.locale.register`, `ctx.locale.bind`, and the locale-aware settings section slot), the current UI Primitives (`Button`, `Input`, `Menu`, and `Tooltip`), and the current Bundle patch contract.

Where those surfaces changed between releases, the plugin probes what the running Host actually provides instead of pinning one generation:

- **Preset skill scope.** `agentPresets.standingKeyFor()` (≤0.1.6) or `agentPresets.acquireScope()` (≥0.1.7, a reference lease the plugin releases after every read). Neither available — or the preset unusable — the manager lists the global layer and says so in diagnostics.
- **Import metadata.** `ctx.settings.register()` when the release still exposes that seam; otherwise the plugin persists its own `$DSH_HOME/skills-manager/metadata.json`. DSH 0.1.7 replaced the settings namespace seam with profile-patch form projection, which models composed entries rather than plugin-private data.
- **Opening the skills folder.** The session Remote (`canOpenWorkspacePath` / `openWorkspacePath`) on releases that mount it, the older `connection.api.host.openPath()` facade on releases that still publish one, and no control at all when neither exists.
- **Chevron glyph.** `IconChevronDownOutlineMedium`/`Regular` (≥0.1.7) or `IconChevronDownOutline14` (≤0.1.6), resolved at runtime; a kit that ships none renders without the glyph.

The plugin's own devDependencies track the DSH release it is developed against (currently 0.1.7-rc.1) so the type checks see the same contracts the Host enforces.

## License

BSD-3-Clause. See [LICENSE](LICENSE).

