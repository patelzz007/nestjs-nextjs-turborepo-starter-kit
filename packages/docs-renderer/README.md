# @workspace/docs-renderer

The Markdown pipeline behind the docs site (`apps/docs`): every remark and rehype plugin, the code-block
highlighter, the carousel / image-resizer embeds, the shared `Alert` for callouts, and the generator of the
API reference pages. It has no framework dependency, so the docs site (TanStack Start today) and the planned
Notion sync (`docs/architecture/notion-docs-plan.md`, phase 2) render with the same code.

| Entry point                                | What it is                                                                                                                                                 |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@workspace/docs-renderer/pipeline`        | `createMarkdownRenderer()` — Markdown string → `{ html, headings }`, in the exact plugin order the site used under Astro                                   |
| `@workspace/docs-renderer/markdown/*`      | The individual plugins (`remark-plugins`, `rehype-plugins`, `links`, `code-block`, `media-embeds`, `pdf-embed`, `qr-code`, `callout-alert`, `heading-ids`) |
| `@workspace/docs-renderer/code-block/*`    | The `@workspace/ui` CodeBlock composition, its props schema and island markup                                                                              |
| `@workspace/docs-renderer/media/*`         | The `ImageCarousel` / `ImageResizer` embeds                                                                                                                |
| `@workspace/docs-renderer/api-reference/*` | Renders `docs/technical/api-reference/*.md` from the OpenAPI export, the controllers and the captured samples                                              |

```bash
pnpm --filter @workspace/docs-renderer test       # plugins, pipeline, API reference staleness guard
pnpm --filter @workspace/docs-renderer docs:api   # re-render docs/technical/api-reference/ (`pnpm tools docs:api`)
```

The pipeline's output is guarded twice: the unit tests here, and `apps/docs`'s regression test, which checks
every page's anchors against the baseline captured from the last Astro build (`apps/docs/regression-baseline/`).
