# @workspace/docs-sync

Turns documents published in a writing tool into generated Markdown in the repository (ADR 084). Notion is the first
tool; the code is built so Obsidian and Inkdrop can be added.

| File | Owns |
|---|---|
| `src/source.ts` | The `DocsSource` port: the only thing a tool must implement |
| `src/run-sync.ts` | The engine: decide what changed, convert, validate, stage, apply. Knows no tool |
| `src/content-store.ts` | Reading and writing the repository |
| `src/locked-download.ts` | The only way a remote file enters the repository |
| `src/run-report.ts` | Telling the platform how a run went |
| `src/sources/create-source.ts` | The one place a tool is chosen |
| `src/sources/notion/` | Notion's API, blocks and properties |
| `src/sources/notion/import/` | The one-time setup and import, with a temporary write token |

## Commands

```bash
pnpm docs:sync                        # sync what changed
pnpm docs:sync --full                 # rebuild every page from the source
pnpm docs:sync --adopt                # the first sync after the import: take over the hand-written files
pnpm docs:notion:setup --parent <id>  # create the four Notion databases
pnpm docs:import                      # copy the repository's pages into Notion (run again to resume)
pnpm docs:import --only <slug>        # a pilot of a few pages
pnpm docs:import --fresh              # empty both Published databases (to Notion's trash, 30 days), then import from scratch
pnpm docs:notion:drop                 # only empty them (to the trash) and clear the import's progress; imports nothing
pnpm docs:notion:layout [--replace]   # lay out the page the databases are on (setup does this for a new page)
```

Settings live in `packages/docs-sync/.env` (copy `.env.example`).

## Adding a writing tool

The seam is "list the published documents, read one, fetch a file". Everything a tool does differently stays behind it.

| Step | Where |
|---|---|
| 1. Add the tool's name | `DocsSourceKindSchema` in `packages/shared`, the `DocsSourceKind` Prisma enum, `SOURCE_EDIT_LABELS` in `apps/docs` |
| 2. Add a folder implementing `DocsSource` | `src/sources/<tool>/` |
| 3. Add its entry | `SOURCE_FACTORIES` in `src/sources/create-source.ts`. The compiler refuses a tool with no entry |
| 4. Prove it | Call `describeDocsSource` from `src/sources/__tests__/source-contract.ts` in its test |

What each tool will need to do:

| | Notion | Obsidian | Inkdrop |
|---|---|---|---|
| Where documents live | Cloud API | A vault of Markdown files | A local HTTP server, or its sync database |
| How "published" is marked | The Published databases | A front matter field or folder | A notebook, tag or status |
| Body | Blocks → Markdown | Already Markdown; rewrite `[[wikilinks]]` and `![[embeds]]` | Already Markdown; rewrite `inkdrop://` links |
| Identity (`sourceId`) | Page id | A stable id in front matter: a path changes on rename | Note id |
| Change signal | Webhook | None: the schedule, or a push to a vault repository | None: the schedule |
| Address (`slug`) | The folder tree of Docs Published: folder slugs, then the page's own | The file's path in the vault | A notebook path, or a front matter field |
| Details it cannot use | `issues` on `SourceDocumentMeta`: a missing or looping folder, a `/` in a Slug | `issues`: a broken front matter field | `issues` |

A slug can change without the document being edited (a renamed folder), and the engine re-reads such a page, so an
adapter only reports the new slug.

Only Notion has a webhook, so the webhook is not part of the seam: a tool without one runs on the 15-minute schedule
and needs nothing in the API. Obsidian and Inkdrop also live on a person's machine, so GitHub Actions cannot reach them
directly: Obsidian's vault needs to be a Git repository the workflow can check out, and Inkdrop needs its sync database
reachable, or a run from a machine that has it. That decision belongs with the adapter.

## The rules the engine keeps

The same input gives byte-identical output. An unchanged source writes nothing. A failed page keeps its last good
version while the others publish. A workspace-level problem, such as a duplicate slug, writes nothing at all. Nothing is
written until the whole run is decided. A page still linked from another cannot be removed, and a file still in use is
never deleted.
