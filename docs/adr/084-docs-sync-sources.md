---
title: "ADR 084: Docs Written in a Tool, Synced Through Reviewed Pull Requests"
tags: ["adr", "docs", "notion", "integrations", "publishing"]
description: "Docs are written in a writing tool and reach the site as generated Markdown through a pull request. Notion is the first tool; one small port keeps Obsidian and Inkdrop possible."
author: "Platform Team"
category: "Architecture decisions"
date: 1794009600000
lastUpdated: 1794009600000
editedAt: 1794413606459
coverImage: "/images/covers/adr/084-docs-sync-sources.webp"
order: 84
---

# ADR 084: Docs Written in a Tool, Synced Through Reviewed Pull Requests

## Status

Accepted (2026-11-07). Built and tested without a live workspace: a real Notion workspace, GitHub App and Droplet have
not been connected yet. The plan is `docs/architecture/notion-docs-plan.md`, which called this ADR 075 before that
number went to platform deploys.

## Context

The plan makes Notion the place docs are written. The owner then added a requirement: the code must extend to Obsidian
and Inkdrop.

The three tools share less than their names suggest. Notion is a cloud API with webhooks and a block format. Obsidian is
a folder of Markdown files with its own link syntax. Inkdrop is a desktop app with a local HTTP server. Only Notion can
tell a server that something changed.

## Decision

| Part | Decision |
|---|---|
| The seam | `DocsSource` in `packages/docs-sync`: list the published documents, read one, fetch a file. Nothing else varies by tool |
| The engine | Knows no tool. Each source hands over the same neutral document, with links and files as placeholders the engine resolves |
| The webhook | Not part of the seam. It is Notion's way to start a sync sooner; the schedule is what guarantees correctness, and a tool with no webhook uses only that |
| Choosing a tool | `SOURCE_FACTORIES`, a `Record` over `DocsSourceKind`, so a new tool with no entry does not compile |
| Names | Source-neutral throughout: `docs/sync/`, `docs/images/synced/`, `docs-sync/*` branches, `DocsSyncRun`. The plan's `notion-sync/*` and `docs/generated-notion/` changed for this |
| Proof | `describeDocsSource` is a contract every source must pass; the engine's own tests run on a second, fake source |
| Addresses from folders (2026-11-12) | In Notion, Docs Published is a tree, matching the repository's folders: rows are pages or folders (**Kind**), each sits in a folder (**Parent**, a self-relation Notion shows as sub-items), and a row's **Slug** is only its own part of the address. A page's slug is the path of folder slugs above it. So moving a page or renaming a folder moves it on the site, and the engine adds the redirect. The blog stays flat. This is the source's business: the engine still receives one full slug |
| Category and three dates (2026-11-12) | Every guide and post has a category and three dates: first published (`date`, Notion **Date**), last meaningfully updated (`lastUpdated`, Notion **Last updated**, set by the writer) and last edited (`editedAt`, the tool's own edit time). The source hands over all three; the site shows them. The repository's pages were backfilled once from their folders and git history |
| Source findings | `SourceDocumentMeta.issues`: a source says why a document's details are unusable in the writer's terms ("the Parent of this page is not a published folder"), and the page is held back with that reason. A source that cannot work out a slug leaves it null and explains |
| Moved without an edit | The engine re-reads a page whose slug changed even when the page itself was not edited: a renamed folder changes its pages' addresses but not their edit times. The same holds for an Obsidian folder |
| Pilot | Pages no source owns stay as they are, and the sidebar merges synced pages into them, so a few pages can move first. A page takes over a hand-written file only with `--adopt` |
| Reporting | The sync posts each run to the API with a bearer token. The Operations console reads `DocsSyncRun`; one failure raises one alert |
| Verification token | Notion sends it once. Its documentation calls that request unsigned, but the live service signs it with a key the server cannot have yet, so while no secret is configured the handshake is recognised by its body alone. It is held encrypted in Redis for an hour and shown only through an audited POST, so it is never printed to a log |
| Deploy | Built once in GitHub Actions and shipped to a forced command that checks, switches atomically, health-checks and rolls back. Separate from the platform deploy: it runs no migrations |

### Open decisions the plan asked this ADR to record

| Decision | State |
|---|---|
| Workspace owner, backup owner and publishers, by role | **Open: the owner names them** |
| Sensitive sections that always need review | `docs/adr/`, `docs/architecture/`, `docs/technical/security/` (`SENSITIVE_SECTIONS`) |
| Whether the docs bot may bypass the review rule | **Open: the owner decides.** Without it, every docs pull request waits for a reviewer |
| The Droplet's measured headroom | **Open: measure before go-live** |
| Measured latency against the plan's target | **Open: measure in the pilot** |

## Consequences

- A new tool is a folder, an enum value and a factory entry. The engine, the site, the API and the console do not change.
- Obsidian and Inkdrop live on a person's machine, so the adapter must also decide how GitHub Actions reaches them. The
  options are in `packages/docs-sync/README.md`.
- A release is 681 MB with its production dependencies, not the plan's 73 MB, because Start's server is not
  self-contained. Five releases are kept instead of 20.
- Until the import runs, nothing changes for readers: every page is still hand-written.

### Not built yet

| Gap | Why | What happens instead |
|---|---|---|
| Uploaded video, PDF and file blocks | The site serves images only from `docs/` | The page is held back with a clear message |
| Equations | The renderer has no maths support | The page is held back |
| The 1200×630 generated sharing image | Needs an image pipeline | A page with no cover falls back to the site's default |
| In-app, push and email alerts; telling a writer directly | The notification catalogue has no docs event, and a Notion author has no platform address | An operational alert is logged, and the console shows every held-back page |
| Reusing CI's build artifact by tree hash | An optimisation | The deploy builds from the commit CI passed, the plan's stated fallback |
| "Was this helpful?" (enhancement 5.9) | Out of this plan's scope (§16) | Still to do |
