---
title: "Kit compare: keeping the web kit identical in both repositories"
description: "How pnpm kit:compare checks packages/ui, the shared table logic and the showcase examples against their copy in nextjs-admin-dashboard-layout, what counts as the same, and how to settle a difference."
author: "Platform Team"
category: "Tooling"
date: 1795212034000
lastUpdated: 1795212034000
editedAt: 1795212034000
coverImage: "/images/covers/technical/tooling/kit-compare.webp"
order: 21
tags: ["tooling", "ui-kit", "kit-compare"]
---

# Kit compare

The web kit lives in two repositories: this starter (`packages/ui`, the table and spreadsheet logic in
`packages/ui-kit-logic`, the showcase examples in `apps/admin/components/component-showcase/examples/`) and
`nextjs-admin-dashboard-layout` (`components/ui/`, `lib/ui/`, `hooks/`, `features/showcase/examples/`). Both must hold
the same code. Neither repository's CI can see the other, so the check runs on your machine:

```bash
pnpm kit:compare ../nextjs-admin-dashboard-layout
pnpm kit:compare ../nextjs-admin-dashboard-layout --scope packages/ui/src/internal/
```

It prints every file that is `missing` in the dashboard or `differs` from its copy, then a count, and exits 1 while
anything is left to settle.

## What counts as the same

A file is the same when, after this repository's names are written the dashboard's way, it matches its copy. The names
it rewrites are `kitPairs.web` in `tooling.config.ts`:

| What | This starter | The dashboard |
|---|---|---|
| Folders | `packages/ui/src/components/`, `internal/`, `hooks/`, `lib/` | `components/ui/`, `components/ui/internal/`, `hooks/`, `lib/ui/` |
| Import specifiers | `@workspace/ui/components/…`, `@workspace/shared`, `@workspace/tokens` | `@/components/ui/…`, `@/lib/shared`, `@/lib/tokens` |
| Showcase links in the docs | `[Tabs](/components/tabs)` | `[Tabs](/showcase/tabs)` |
| File paths a doc or comment quotes | `` `packages/ui/src/components/accordion.tsx` `` | `` `components/ui/accordion.tsx` `` |
| The upload helpers | `examples/file-upload/file-upload-shared.tsx` | `features/shared/file-upload-parts.tsx` (the dashboard's own upload features use them) |

Imports may come in any order, and a formatter may wrap a long import over several lines: each repository's
specifiers have their own length, so its formatter wraps different imports.

## Settling a difference

1. **Write imports that map.** Inside one kit folder, a relative import (`../alert`, `./code-block-model`) is the same
   in both repositories. Across folders (a component reaching `lib/`, a test reaching `lib/labels/en`), use the alias
   (`@workspace/ui/lib/labels/en`): a relative path from `components/` to `lib/` does not exist in the dashboard,
   where `lib/ui/` sits beside `components/ui/`.
2. **Change the code in this starter first**, then copy it to the dashboard with `--sync` (below). The starter is
   where the kit is developed; the dashboard follows it.
3. **Only add a mapping for a real naming difference** (a folder, an alias, a route): never to hide code that differs.

## Copying a change across: `--sync`

```bash
pnpm kit:compare ../nextjs-admin-dashboard-layout --sync
pnpm kit:compare ../nextjs-admin-dashboard-layout --scope packages/ui-kit-logic/ --sync
```

`--sync` writes this starter's version of every `missing` or `differs` file (inside `--scope`, when given) into the
dashboard, with every specifier, quoted path and showcase link mapped, and creates folders it needs. The starter is
the source of truth, so a change made only in the dashboard is overwritten: port it here first. Afterwards run the
dashboard's formatter (it orders the imports), then its typecheck, lint and tests, and review the diff there before
committing. A new export the dashboard's own entry points need (`lib/shared/index.ts`, `lib/tokens/index.ts`) is
added by hand: those files list each repository's own modules.

It never deletes. A file only the dashboard has inside a kit folder (left behind when the starter moved or deleted
it) is not reported; remove it in the dashboard when you move or delete its source here.

## What is mapped

| This starter | The dashboard |
|---|---|
| `packages/ui/src/components/`, `internal/`, `hooks/`, `lib/` | `components/ui/`, `components/ui/internal/`, `hooks/`, `lib/ui/` |
| `packages/ui-kit-logic/src/` (every component's shared logic: table, spreadsheet, gantt, event calendar, filters, kanban, file type) | `lib/ui/kit-logic/` |
| The `@workspace/shared` helpers the kit imports: `time.ts`, `entity-avatar-tone.ts`, `image-sources.ts`, `navigation-menu/breadcrumb-tree.ts`, `navigation-menu/menu-trail.ts`, with their tests | the same files under `lib/shared/` |
| `packages/tokens/src/diagram.ts` | `lib/tokens/diagram.ts` |
| `apps/admin/components/component-showcase/examples/` | `features/showcase/examples/` |

The rest of `@workspace/shared` and `@workspace/tokens` is not mapped: the apps' domain helpers and each product's own
themes and palette are not kit code. Showcase examples link only to routes both apps have (`ROUTES.home`,
`ROUTES.analytics.index`, `ROUTES.account.*`) or to the showcase itself (`SHOWCASE_ROUTES`), so they stay identical.
