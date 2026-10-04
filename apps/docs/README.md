# @workspace/docs — the documentation site

A static [Astro](https://astro.build) site that renders the repository's own guides
(`docs/*.md`) and engineering blog (`blog/*.md`) as a searchable "learning center" at
**http://localhost:3002**. There is no server and no database: `astro build` writes plain HTML
to `dist/`, which any static host can serve.

> The markdown files are the single source of truth. They are written to read well on GitHub
> **and** on this site; you never copy content into `apps/docs`.

## Commands

Run these from `apps/docs` (or with `pnpm --filter @workspace/docs <script>` from the root).

| Command              | What it does                                                          |
| -------------------- | --------------------------------------------------------------------- |
| `pnpm dev`           | Dev server on port 3002 (clears the rendered-Markdown cache on start) |
| `pnpm build`         | Checks every internal link, then builds the static site into `dist/`  |
| `pnpm preview`       | Serves the built `dist/` on port 3002                                 |
| `pnpm test`          | Vitest: markdown plugins, navigation, search, and the browser scripts |
| `pnpm lint`          | ESLint (shared monorepo config)                                       |
| `pnpm typecheck`     | `astro check` — types **and** every guide's frontmatter               |
| `pnpm check:links`   | Only the link checker (`scripts/check-links.mjs`)                     |
| `pnpm docs:api`      | Re-render `docs/technical/api-reference/` from `docs/generated/` (vitest `--update`) |

## The generated API reference

`docs/technical/api-reference/` is rendered by `src/lib/api-reference/` from the OpenAPI export
(`docs/generated/openapi.json`), the API's controller decorators and the captured seed samples
(`docs/generated/api-samples.json`, written by `scripts/capture-api-samples.mjs` against a throwaway
seeded API — the script header lists the exact commands). `pnpm test` fails when the committed pages
are stale; `pnpm docs:api` re-renders them. Full description:
[API conventions → How the reference is generated](../../docs/technical/api/README.md#how-the-reference-is-generated).

## Adding or editing a guide

1. Create `docs/<name>.md` (sub-folders are fine: `docs/technical/authorization/backend.md`
   becomes `/docs/technical/authorization/backend`; the id keeps its case, so `README.md` is
   `/docs/README`).
2. Start it with frontmatter. The schema lives in `src/content.config.ts` and **the build fails**
   if a field is missing or misspelt:

   ```yaml
   ---
   title: "Messaging Infrastructure"
   description: "Operational reference for Redis, BullMQ, Kafka and the outbox." # optional
   order: 4                     # optional
   author: "Backend Team"
   lastUpdated: 1790812800000   # epoch ms, UTC midnight of the day you edited it
   coverImage: "https://images.unsplash.com/…" # used for link previews (og:image)
   tags: ["infrastructure", "messaging"]        # optional; "superseded" hides it from the sidebar
   ---
   ```

3. Add its id to `docs/meta.json` under the right `--- Section ---` separator. Guides not
   listed there still build, and appear under **More Guides**.
4. Optionally give it an icon in `DOC_ICONS` (`src/lib/icons.ts`); new sections get one in
   `SECTION_ICONS`.
5. Run `pnpm build` — it runs the link checker first.

Blog posts work the same way in `blog/` (`title`, `description`, `author`, `date`, `category`)
with their order in `blog/meta.json`.

### Markdown features

| Write this                                     | You get                                                   |
| ---------------------------------------------- | --------------------------------------------------------- |
| `[Database](./database.md#seed-data)`          | A link to `/docs/technical/database#seed-data` (from `docs/technical/`) |
| `[registry](../apps/api/src/…/registry.ts)`    | A link to that file on GitHub                             |
| `> [!NOTE]`, `[!TIP]`, `[!WARNING]`, `[!CAUTION]` | A coloured callout (emoji markers like `> ⚠️` work too) |
| ```` ```ts title="app.ts" {2-4} ````           | A `CodeBlock` with a title, language, copy button, line numbers and lines 2–4 lit |
| ```` ```mermaid ````                           | A diagram, rendered in the browser in the current theme   |
| `![alt](./images/email/welcome.png)`           | The image, served from `docs/images/` at `/images/…`      |
| A table whose cells are images                 | A responsive screenshot gallery                           |
| `RBAC`, `RLS`, `ReBAC`, … in prose             | An `<abbr>` tooltip with the definition                   |

The leading `# Heading` is dropped (the page title comes from `title`), and headings get the
same anchors GitHub generates, so `#section` links work in both places.

## How it is put together

```
apps/docs/
├── astro.config.ts            # markdown pipeline (remark/rehype plugins), sitemap, Tailwind
├── turbo.json                 # adds repo-root docs/ + blog/ to the build cache inputs
├── scripts/check-links.mjs    # fails the build on broken internal links / anchors
└── src/
    ├── content.config.ts      # the docs + blog collections and their frontmatter schemas
    ├── lib/                   # pure, unit-tested logic (navigation, search, TOC, dates, markdown plugins)
    ├── components/ layouts/   # .astro markup — header, sidebar + mobile drawer (shared NavTree), TOC, cards, pager, search
    ├── pages/                 # routes: /, /docs, /docs/[...slug], /blog, /images/…, /search-index.json, /feed.xml
    ├── scripts/               # progressive enhancement: theme, drawer, search, TOC scroll spy, copy, mermaid
    └── styles/global.css      # every colour, size and weight is a token (light + dark), matched to docs.apidog.com
```

- **Search** — `/search-index.json` is generated at build time (one entry per guide and per
  h2/h3 heading, plus blog posts). The `⌘K` / `Ctrl K` / `/` dialog downloads it on first open,
  validates it with zod, and ranks matches in the browser (`src/lib/search.ts`). If the corpus
  ever grows past a few MB, swap in a chunked index such as Pagefind.
- **Look** — modelled on docs.apidog.com: body text in `#344054`, hairline `#f2f4f7` borders,
  one violet accent (`#9373ee`) for bars, borders and fills, ReUI-style code blocks, and a soft
  violet glow at the top of the page. Text in the accent colour (links, the active nav / TOC
  item) uses `--brand-text`, a darker (light theme) / lighter (dark theme) shade of the same hue
  that keeps WCAG AA contrast (≥ 4.5:1). The tokens at the top of `global.css` are the only place
  to change any of it.
- **Typography** — see [Typography](#typography) below.
- **Code blocks** — every fence renders the shared `CodeBlock` from `@workspace/ui` (the full
  ReUI port, `packages/ui/src/components/display/code-block.tsx`). `src/lib/markdown/code-block.ts`
  highlights each fence at build time with the component's own `highlightCode` (Shiki,
  github-light + github-dark), renders it to HTML and embeds its props; `src/scripts/code-blocks.ts`
  then hydrates it with React (only on pages that have code) so copy, wrap, folding and
  "Show more" work. Two build details matter:
  - `astro.config.ts` awaits `preloadCodeBlockHighlighter()`. Astro closes the module runner
    that loaded the config, so lazy grammar imports during rendering would fail and every block
    would silently render uncoloured; the build now throws if that ever happens.
  - `dev` and `build` pass `--force`: Astro caches rendered Markdown and does not notice changes
    to the remark/rehype plugins, so without it an old render survives code changes.
- **Navigation** — the guide tree renders twice from one component (`NavTree.astro`): as the
  sticky sidebar from 1024px up, and inside the full-height mobile drawer below that.
- **Theme** — light / dark follows the OS until the reader picks one (stored in
  `localStorage`); an inline script applies it before first paint to avoid a flash.
- **No framework runtime** — pages ship as HTML; the only JavaScript is `src/scripts/*`
  (~95 kB, mostly zod), plus mermaid, which is downloaded only on pages that contain a diagram.

## Typography

| Role             | Face                  | Size / line height / weight                         |
| ---------------- | --------------------- | --------------------------------------------------- |
| Body copy        | IBM Plex Sans         | 16px / 1.65 / 400, at most `70ch` per line          |
| Page title (h1)  | IBM Plex Sans         | 36px (30px on phones) / 1.2 / 700, tracked −0.022em |
| h2 · h3 · h4     | IBM Plex Sans         | 24 · 20 · 18px / 1.2–1.35 / 600                     |
| Chrome           | IBM Plex Sans         | 14px / 1.5 — nav tree, TOC, metadata, tables, controls; 12px for tags and hints |
| Code             | JetBrains Mono        | 0.875em inline (follows the text around it), 14px in code blocks, ligatures off |

- **Why these faces** — the "Developer Mono" pairing that the ui-ux-pro-max typography search
  (`.claude/skills/ui-ux-pro-max`, query "technical documentation developer") recommends for
  documentation and developer tools: IBM Plex Sans is a sturdy, open UI/prose face with clear
  `Il1` / `0O` shapes, and JetBrains Mono is drawn for reading code (tall x-height, distinct
  punctuation). The sizes follow the same tool's UX rules: 16px minimum body text, line height
  1.5–1.75, 65–75 characters per line, one consistent scale (12 · 14 · 16 · 18 · 20 · 24 · 30 · 36px).
- **Code ligatures are off** — readers copy what they see, so `!==`, `=>` and `>=` must look like
  the characters they type.
- **Self-hosted** — the font files come from the `@fontsource-variable/ibm-plex-sans` and
  `@fontsource-variable/jetbrains-mono` packages and are served from this site (no Google Fonts
  request, so no third-party tracking and no extra DNS/TLS handshake). The Astro Fonts API
  (`fonts` in `astro.config.ts`, `<Font>` in `src/layouts/BaseLayout.astro`) emits the
  `@font-face` rules with `font-display: swap`, preloads the upright IBM Plex Sans file, and
  generates metric-matched fallback faces (Arial / Courier New with `size-adjust` and
  ascent/descent overrides) so text does not jump when the web font arrives.
- **Latin only, variable weights** — one variable file per style (≈45 kB upright, ≈49 kB italic
  for Plex; ≈40 kB / ≈43 kB for JetBrains Mono) covers every weight. Characters outside the Latin
  subset (box-drawing lines, most arrows, emoji) come from the fallback fonts; in code blocks on
  macOS and Windows that is Courier New, whose 0.6em advance equals JetBrains Mono's, so ASCII
  diagrams stay aligned.
- **Tokens** — every size, weight, line height and letter spacing is a `--type-*` token at the top
  of `src/styles/global.css`. Use them; never write a raw `font-size` / `font-weight` in a rule.
  Fenced code blocks take their size from `--type-code-block-size` (passed to the shared
  `CodeBlock` in `src/lib/code-block/element.ts`).

## Environment

All optional — the defaults are the local dev ports.

| Variable              | Used for                                     | Default                          |
| --------------------- | -------------------------------------------- | -------------------------------- |
| `PUBLIC_SITE_URL`     | Canonical URLs, sitemap, RSS, `og:url`        | `http://localhost:3002`          |
| `PUBLIC_ADMIN_URL`    | The "Admin" header link                      | `http://localhost:3001`          |
| `PUBLIC_API_DOCS_URL` | The "API Reference" header link              | `http://localhost:8080/v1/docs`  |

## Do / don't

- ✅ Link between guides with relative `.md` paths — they work on GitHub and here.
- ✅ Bump `lastUpdated` whenever you change a guide.
- ✅ Keep new logic in `src/lib/` as pure functions with a test next to them.
- ❌ Don't put content in `apps/docs` — it belongs in `docs/` or `blog/`.
- ❌ Don't hardcode colours, font sizes or weights in components — add or reuse a token in `global.css`.
- ❌ Don't add a font from a CDN — add the Fontsource package and register it in `fonts` in `astro.config.ts`.
- ❌ Don't link to `/docs/<slug>` for another guide by hand when a relative `.md` link will do;
  the relative link is checked by the link checker and survives renames better.
