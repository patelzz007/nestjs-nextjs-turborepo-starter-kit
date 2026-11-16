# @workspace/docs-content

The rules every synced document follows, whatever tool it was written in (ADR 084). No network and no file
access, so every rule is tested on its own.

| File | Owns |
|---|---|
| `document.ts` | What a source hands over: a document's details and its Markdown body |
| `slug.ts` | Which slugs are safe, and where each one lives on disk |
| `manifest.ts` | `docs/sync/manifest.json`: which generated file came from which document |
| `front-matter.ts` | The front matter of a generated file |
| `redirects.ts` | `docs/sync/redirects.json`, built from slug history and checked |
| `navigation.ts` | Places synced pages into `docs/meta.json` and `docs/blog/meta.json` |

The site reads `redirects.ts` and `front-matter.ts`; `packages/docs-sync` reads all of them.
