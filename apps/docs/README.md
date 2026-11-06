# @workspace/docs — the documentation site

The repository's own guides (`docs/*.md`) and engineering blog (`docs/blog/*.md`) as a searchable site at
**http://localhost:3002**, built with [TanStack Start](https://tanstack.com/start). Every page is
pre-rendered at build (`dist/client/docs/x.html`); the small Start server renders on request only what
cannot be static: the 404 page and search with `?q=`.

> The Markdown files are the single source of truth. They are written to read well on GitHub **and** on
> this site; you never copy content into `apps/docs`.

## Commands

Run these from `apps/docs` (or with `pnpm --filter @workspace/docs <script>` from the root).

| Command                       | What it does                                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                    | Dev server on port 3002 (Vite; edits to guides and to the renderer reload the page)                      |
| `pnpm build`                  | Checks every internal link, pre-renders the site into `dist/`, then checks it against the Astro baseline |
| `pnpm preview` / `pnpm start` | Serves the built site on port 3002                                                                       |
| `pnpm test`                   | Vitest with coverage: content model, search, reading progress, components, browser helpers, styles       |
| `pnpm lint`                   | Oxfmt check + Oxlint (`react-internal` preset)                                                           |
| `pnpm typecheck`              | `tsrs --noEmit` (TypeScript 7, like every workspace)                                                     |
| `pnpm check:links`            | Only the link checker (`scripts/check-links.ts`)                                                        |
| `pnpm check:baseline`         | Only the regression check of `dist/` against `regression-baseline/`                                      |
| `pnpm tools docs:api`         | Re-render `docs/technical/api-reference/` (lives in `packages/docs-renderer`)                            |

## TanStack, and the shared kit

| Library                           | Job here                                                                                                                                                 |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Start + Router**                | File routes (`src/routes/`), pre-rendering, typed links, `?q=` validated with zod, the head tags of every page                                           |
| **Start static server functions** | Page data (`src/server/functions.ts`) is written to JSON at build; client navigation reads those files, so a pre-rendered page never needs a live server |
| **Query**                         | The search index and the endpoint list, loaded on first use and kept for the session                                                                     |
| **Table**                         | The endpoint explorer (`/endpoints`), through the shared `DataTable`                                                                                     |
| **Pacer**                         | Debounces the search box (dialog and `/search`)                                                                                                          |

Every interface part that exists in `@workspace/ui` is the shared component: `Alert` (callouts), `CodeBlock`,
`Command` (search), `Sheet` (phone menu and the "On this page" sheet), `DataTable`, `Badge`, `Button`, `Kbd`,
`CoverImage`, `IconTile`, `InputGroup`, `NotFoundContent`, `Spinner`. The kit's stylesheet is loaded first
(`@workspace/ui/globals.css`), so they look exactly as in the apps; the docs then redefine the semantic
tokens for their own identity.

## How it is put together

```
apps/docs/
├── vite.config.ts             # Start plugin: the page list (every guide, post, image), pre-rendering, sitemap
├── regression-baseline/       # captured from the last Astro build: every page's title, h1, anchors; search results
├── scripts/                   # check-links.ts, check-baseline.ts (runs after `vite build`), capture-api-samples.mjs
└── src/
    ├── routes/                # /, /docs, /docs/$, /blog, /blog/$, /search, /endpoints, feed.xml, robots.txt, …
    ├── server/                # content.server.ts (Vite globs of docs/ and docs/blog/), functions.ts (server functions)
    ├── lib/                   # pure, tested logic: content model, navigation, search, reading progress, SEO, RSS
    ├── components/            # header, guide tree, article, "On this page", search, endpoint explorer, …
    ├── browser/               # DOM helpers the components call: theme, code theme, islands, diagrams, PDF embeds
    ├── hooks/                 # search index (Query), reading progress
    └── styles/app.css         # the kit's CSS, then the docs palette, reading styles and embeds
```

- **Rendering** — `packages/docs-renderer` turns each Markdown file into HTML with the plugin order the
  Astro site used (GitHub-flavoured Markdown and SmartyPants first, then the docs' remark and rehype
  plugins). Code fences become the shared `CodeBlock`, callouts the shared `Alert` (`role="note"`), media
  fences carousels and resizable images. The HTML ships in the page; code blocks and media embeds are
  hydrated as islands inside it (`src/browser/islands.ts`), diagrams are drawn by Pele.
- **Regression baseline** — `regression-baseline/routes.json` records every page the Astro site published:
  its title, h1, sharing image, canonical path and every heading anchor. `pnpm build` fails if the new site
  loses any of them (`src/lib/baseline.ts`, `scripts/check-baseline.ts`), so no saved link breaks. Two
  differences are deliberate and listed in `EXPECTED_CHANGES`: the 404 page is served by the Start server,
  and the sitemap is one `/sitemap.xml`; a heading renamed on purpose is listed in `RENAMED_ANCHORS`.
  `search-results.json` records the ranked results of 12 queries.
- **Search** — `/search-index.json` is written at build (one entry per guide, per h2/h3 and per post). The
  `⌘K` / `Ctrl K` / `/` dialog loads it on first open with TanStack Query, validates it with zod and ranks
  matches in the browser (`src/lib/search.ts`); highlights are React nodes, so a query can never inject
  markup. `/search?q=` shows every match and can be linked to.
- **Endpoints** — `/api-endpoints.json` is built from the OpenAPI export and the controllers' decorators
  (`packages/docs-renderer/src/api-reference/endpoint-index.ts`); `/endpoints` lists every operation with
  its method, path, group and access, each linked to its section of the generated reference.
- **"On this page"** — a progress ring (percent read, time left) over a vertical timeline: one node per h2,
  filled up to where the reader is, subsections hanging from their section on a rule like the app sidebars.
  The arithmetic is pure (`src/lib/reading-progress.ts`); each section's words are counted at build. Below
  1280px it is a glass bar under the header that opens the same timeline in a sheet.

## Look

B + F, chosen from six mocked directions: B's precise layout (drafting-grid header on frosted glass, the
guide's source file as its breadcrumb, `#` anchors, numbered code lines, verb-coded endpoints) in F's
palette (graphite and verdigris on a cool neutral `#f1f4f9` canvas, never pure white; `#1f1f1d` dark), with the guide's own `coverImage` as a band
across the top and its page icon over the edge.

- **Tokens** — every colour is a token at the top of `src/styles/app.css`: the shared semantic tokens
  redefined for light and dark plus the docs' own (`--docs-*`).
  `src/styles/__tests__/theme-contrast.test.ts` holds every text pair, the diagram tints and the dark code
  chrome to WCAG AA in both themes.
- **Typography** — IBM Plex Sans for everything and IBM Plex Mono for code, file paths and HTTP verbs,
  self-hosted from Fontsource (no font CDN). Code ligatures stay off: readers copy what they see.
- **Code theme** — code has its own light / dark theme, independent of the site's (the toggle in every code
  block's header: Auto → Light → Dark, stored as `docs:code-theme`). Dark code keeps One Dark Pro's charcoal.
- **Theme** — light / dark (the apps' Nord is not offered) is a class on `<html>` (the kit's contract), applied before first paint by
  the inline script `THEME_BOOTSTRAP_SCRIPT` (`src/browser/theme.ts`); it follows the OS until the reader picks.

## Adding or editing a guide

1. Create `docs/<name>.md` (sub-folders are fine: `docs/technical/authorization/backend.md` becomes
   `/docs/technical/authorization/backend`; the id keeps its case, so `README.md` is `/docs/README`).
2. Start it with front matter — at the very first line (GitHub only reads it there). The schema is
   `src/lib/frontmatter.ts` and **the build fails** if a field is missing or misspelt:

   ```yaml
   ---
   title: "Messaging Infrastructure"
   description: "Operational reference for Redis, BullMQ, Kafka and the outbox." # optional
   order: 4 # optional
   author: "Backend Team"
   lastUpdated: 1790812800000 # epoch ms, UTC midnight of the day you edited it
   coverImage: "https://images.unsplash.com/…" # the page's cover band and its link preview (og:image)
   tags: ["infrastructure", "messaging"] # optional; "superseded" hides it from the sidebar
   ---
   ```

3. Add its id to `docs/meta.json` under the right `--- Section ---` separator. Guides not listed there
   still build, and appear under **More Guides**.
4. Optionally give it an icon in `DOC_ICONS` (`src/lib/icons.ts`); new sections get one in `SECTION_ICONS`.
5. Run `pnpm build` — it checks the links first and the baseline last.

Blog posts work the same way in `docs/blog/` (`title`, `description`, `author`, `date`, `category`) with their
order in `docs/blog/meta.json`.

### Markdown features

| Write this                                        | You get                                                                                                                                                                                                                                                                       |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[Database](./database.md#seed-data)`             | A link to `/docs/technical/database#seed-data` (from `docs/technical/`)                                                                                                                                                                                                       |
| `[registry](../apps/api/src/…/registry.ts)`       | A link to that file on GitHub                                                                                                                                                                                                                                                 |
| `> [!NOTE]`, `[!TIP]`, `[!WARNING]`, `[!CAUTION]` | A coloured callout (emoji markers like `> ⚠️` work too)                                                                                                                                                                                                                       |
| ` ```ts title="app.ts" {2-4} `                    | The shared `CodeBlock` with a title, language, copy button, line numbers and lines 2–4 lit                                                                                                                                                                                    |
| ` ```mermaid `                                    | A diagram (Mermaid syntax), drawn by Pele in the browser, coloured by role; it must parse or the build fails                                                                                                                                                                  |
| ` ```qr title="Pairing QR" `                      | A scannable QR code of the fence's text, drawn at build time as inline SVG by the shared encoder (`packages/docs-renderer/src/markdown/qr-code.ts`)                                                                                                                           |
| ` ```pdf title="Statement.pdf" `                  | The PDF at the fence's URL (a site path or `https://`), framed under a header with open-in-new-tab and download, drawn by the browser's own PDF engine (`packages/docs-renderer/src/markdown/pdf-embed.ts`). `/files/pdf-viewer-sample.pdf` is a sample written at build time |
| ` ```carousel ratio="16/9" `                      | The `@workspace/ui` `ImageCarousel` (Embla) of the fence's images, one `![alt](url)` per line: rendered at build time, hydrated in the browser (`packages/docs-renderer/src/markdown/media-embeds.ts`, `packages/docs-renderer/src/media/`)                                   |
| ` ```image-resize width="480" height="270" `      | The `@workspace/ui` `ImageResizer` of the fence's one image, starting at that size and keeping its shape (`aspect="free"` lets the sides change independently)                                                                                                                |
| `![alt](./images/email/welcome.png)`              | The image, served from `docs/images/` at `/images/…`                                                                                                                                                                                                                          |
| A table whose cells are images                    | A responsive screenshot gallery                                                                                                                                                                                                                                               |
| `RBAC`, `RLS`, `ReBAC`, … in prose                | An `<abbr>` tooltip with the definition                                                                                                                                                                                                                                       |

The leading `# Heading` is dropped (the page title comes from `title`), and headings get the
same anchors GitHub generates, so `#section` links work in both places.

## Environment

All optional — the defaults are the local dev ports.

| Variable              | Used for                               | Default                         |
| --------------------- | -------------------------------------- | ------------------------------- |
| `PUBLIC_SITE_URL`     | Canonical URLs, sitemap, RSS, `og:url` | `http://localhost:3002`         |
| `PUBLIC_ADMIN_URL`    | The "Admin" header link                | `http://localhost:3001`         |
| `PUBLIC_API_DOCS_URL` | The "Swagger" header link              | `http://localhost:8080/v1/docs` |

## Do / don't

- ✅ Link between guides with relative `.md` paths — they work on GitHub and here, and the link checker sees them.
- ✅ Bump `lastUpdated` whenever you change a guide.
- ✅ Keep new logic in `src/lib/` as pure functions with a test beside them (`__tests__/`).
- ✅ Use the `@workspace/ui` component when one exists; style through tokens.
- ❌ Don't put content in `apps/docs` — it belongs in `docs/` or `docs/blog/`.
- ❌ Don't hardcode colours, font sizes or weights in components — add or reuse a token in `app.css`.
- ❌ Don't add a font from a CDN — add the Fontsource package and import it in `app.css`.
- ❌ Don't change `regression-baseline/` to make the build pass: it is the record of what was published. A
  deliberate change goes into `EXPECTED_CHANGES` (a page or file) or `RENAMED_ANCHORS` (a heading) with its reason.
