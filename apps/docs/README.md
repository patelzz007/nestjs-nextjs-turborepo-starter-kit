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
| `pnpm lint`          | Oxfmt check + Oxlint (shared monorepo config)                         |
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
   coverImage: "https://images.unsplash.com/…" # the page's banner (PageCover.astro) and its link preview (og:image)
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
| ```` ```mermaid ````                           | A diagram (Mermaid syntax), drawn by Pele in the browser, coloured by role; it must parse or the build fails |
| ```` ```qr title="Pairing QR" ````            | A scannable QR code of the fence's text, drawn at build time as inline SVG by the shared encoder (`src/lib/markdown/qr-code.ts`) |
| ```` ```pdf title="Statement.pdf" ````        | The PDF at the fence's URL (a site path or `https://`), framed under a header with open-in-new-tab and download, drawn by the browser's own PDF engine (`src/lib/markdown/pdf-embed.ts`). `/files/pdf-viewer-sample.pdf` is a sample written at build time |
| ```` ```carousel ratio="16/9" ````             | The `@workspace/ui` `ImageCarousel` (Embla) of the fence's images, one `![alt](url)` per line: rendered at build time, hydrated in the browser (`src/lib/markdown/media-embeds.ts`, `src/lib/media/`) |
| ```` ```image-resize width="480" height="270" ```` | The `@workspace/ui` `ImageResizer` of the fence's one image, starting at that size and keeping its shape (`aspect="free"` lets the sides change independently) |
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
    ├── scripts/               # progressive enhancement: theme, drawer, search, TOC scroll spy, copy, diagrams
    └── styles/global.css      # every colour, size and weight is a token (light + dark); colours map onto the packages/tokens palette
```

- **Search** — `/search-index.json` is generated at build time (one entry per guide and per
  h2/h3 heading, plus blog posts). The `⌘K` / `Ctrl K` / `/` dialog downloads it on first open,
  validates it with zod, and ranks matches in the browser (`src/lib/search.ts`). If the corpus
  ever grows past a few MB, swap in a chunked index such as Pagefind.
- **Look** — layout modelled on docs.apidog.com; colours are the product's shared palette:
  `global.css` imports `@workspace/tokens/palette.css` (the `--palette-*` primitives) and maps
  its own names onto them, so the docs and the apps cannot drift. Light: white reading surfaces,
  the cool "ink" grey text scale (`neutral-900` / `700` / `600`), `neutral-200` borders and the one
  slate accent (`brand-800`; `brand-300` in dark mode) for links, the active state, bars and fills,
  plus a soft glow at the top of the page. Dark: the apps' cool ink surface (`ink-900`). Text in
  the accent colour uses `--brand-text`; `src/styles/theme-contrast.test.ts` holds every text pair
  to WCAG AA (≥ 4.5:1) in every theme (light, dark and Nord). Callout and card-tile hues are docs-only and stay literal.
  The tokens at the top of `global.css` are the only place to change any of it.
- **Typography** — see [Typography](#typography) below.
- **One reading column** — paragraphs, tables, code blocks and diagrams share one width
  (`--type-measure`, 52rem / 832px, ~85 characters of body copy — at 1440px it fills the space
  between the sidebar and the "On this page" rail), centred between the two, so nothing juts out past the text. Content wider than the column scrolls inside its
  own frame; a table shows an edge shadow on the side that has more columns.
- **Tables** — reference material, read across a row: no vertical rules, a tinted header, the first
  column as the row's key (text colour, medium weight), a row highlight under the pointer and
  tabular numerals. `rehypeTableWrapper` adds a `<wbr>` after each `.` and `/` of a code chip in a
  cell, and after each `_` of an identifier longer than 22 characters, so a column of names wraps
  at an identifier's joints instead of pushing the table past the column (copied text is
  unchanged).
- **Diagrams** — ```` ```mermaid ```` fences are drawn by [Pele](https://pele.run), a Mermaid-syntax
  renderer that outputs plain SVG themed by CSS variables, so a theme switch recolours a diagram
  without re-rendering it. Pele measures labels in the page's own font (no clipped labels) and
  re-orients a flowchart that is too wide for the column instead of shrinking it.
  `remarkDiagrams` parses every diagram at build time and fails the build on a syntax error, with
  its line; `src/lib/markdown/__tests__/docs-diagrams.test.ts` reports the same in `pnpm test`.
  Colour carries meaning, the same in every diagram (`src/scripts/diagrams.ts` tags the nodes,
  `global.css` → "Diagrams" colours them):

  | Role | Hue | What it is |
  | --- | --- | --- |
  | Entry point | blue | a flowchart node nothing points to |
  | Step | slate | everything in between |
  | Store | teal | a cylinder — a table, cache or queue |
  | Decision | amber | a diamond |
  | Outcome | violet | a node that points to nothing |
  | Person | rose | a circle |

  Sequence participants take the six hues in order; notes are neutral and dashed. A node the
  author styled (`classDef` / `style`) keeps the author's colours. A `;` inside sequence message
  text ends the statement — write `#59;` for a literal semicolon.
- **Cover images** — a guide's `coverImage` (required) and a post's (optional) show as a 3:1
  banner under the breadcrumbs (`src/components/PageCover.astro`) and as the page's link preview.
- **Code block theme** — code has its own light / dark theme, independent of the site's: the
  toggle in every code block's header cycles **Auto** (match the site) → **Light** → **Dark** and
  applies to every block (`src/scripts/code-theme.ts`, stored as `docs:code-theme`, applied before
  first paint by the bootstrap in `BaseLayout.astro`). It sets `data-code-theme` on `<html>`;
  `global.css` re-declares the theme tokens inside `.code-block-island` and the `dark:` variant
  follows that attribute inside code blocks only. The sidebar's active page is a solid slate pill
  with white text (slate-900 light, slate-700 dark). The toggle renders all three states and CSS
  shows the current one, so hydration never disagrees with the stored choice.
- **Code blocks** — every fence renders the shared `CodeBlock` from `@workspace/ui` (the full
  ReUI port, `packages/ui/src/components/code-block.tsx`). `src/lib/markdown/code-block.ts`
  highlights each fence at build time with the component's own `highlightCode` (Shiki,
  github-light + one-dark-pro, `src/lib/code-block/themes.ts`; dark code gets One Dark's own
  charcoal `#282c34` and chrome, not the page's near-black), renders it to HTML and embeds its props; `src/scripts/code-blocks.ts`
  then hydrates it with React (only on pages that have code) so copy, wrap, folding and
  "Show more" work. Each block is its own React island with no app root above it, so
  `src/lib/code-block/element.ts` wraps it in the kit's `UiKitLabelsProvider` with the English
  pack (`UI_KIT_LABELS_EN`) — the docs declare no copy of their own. The fence glue stays
  hast-based: ReUI's `markdownCodeProps` / `markdownFences` read react-markdown props and raw
  markdown strings, not the rehype tree this pipeline works on. Two build details matter:
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
  (~95 kB, mostly zod), plus the diagram renderer, which is downloaded only on pages that contain a diagram.

## Typography

| Role             | Face                         | Size / line height / weight                         |
| ---------------- | ---------------------------- | --------------------------------------------------- |
| Body copy        | Atkinson Hyperlegible Next   | 16px / 1.65 / 400, at most 52rem (~85ch) per line   |
| Page title (h1)  | Atkinson Hyperlegible Next   | 36px (30px on phones) / 1.2 / 700, tracked −0.022em |
| h2 · h3 · h4     | Atkinson Hyperlegible Next   | 24 · 20 · 18px / 1.2–1.35 / 600                     |
| Card titles      | Atkinson Hyperlegible Next   | 20px / 1.35 / 600                                   |
| Tables           | Atkinson Hyperlegible Next   | 15px / 1.5, tabular numerals                        |
| Chrome           | Atkinson Hyperlegible Next   | 14px / 1.5 — nav tree, TOC, metadata, controls; 12px for tags and hints |
| Code             | Atkinson Hyperlegible Mono   | 0.875em inline (follows the text around it), 14px in code blocks, ligatures off |

- **One family** — headings, prose and UI are Atkinson Hyperlegible Next and code is Atkinson
  Hyperlegible Mono (`--font-sans`, `--font-mono`; `--type-family-heading` is the sans).
  Hierarchy comes from weight and size, not a second display face. The docs deliberately differ
  from the apps (Bricolage Grotesque / Geist): they are a reading surface, not app UI.
- **Why these faces** — designed by the Braille Institute so look-alike characters never blur
  together: `0` / `O`, `1` / `l` / `I`, `rn` / `m`. Reference text full of identifiers, numbers and
  environment variable names is where that matters most. The sizes follow the ui-ux-pro-max UX
  rules: 16px minimum body text, line height 1.5–1.75, 65–75 characters per line, one consistent
  scale (12 · 14 · 15 · 16 · 18 · 20 · 24 · 30 · 36px).
- **Code ligatures are off** — readers copy what they see, so `!==`, `=>` and `>=` must look like
  the characters they type.
- **Self-hosted** — the font files come from the `@fontsource-variable/atkinson-hyperlegible-next`
  and `@fontsource-variable/atkinson-hyperlegible-mono` packages and are served from this site (no
  Google Fonts request, so no third-party tracking and no extra DNS/TLS handshake). The Astro
  Fonts API (`fonts` in `astro.config.ts`, `<Font>` in `src/layouts/BaseLayout.astro`) emits the
  `@font-face` rules with `font-display: swap`, preloads the upright sans file, and generates
  metric-matched fallback faces (`size-adjust` and ascent/descent overrides) so text does not jump
  when the web font arrives.
- **Latin only, variable weights** — one variable file per style (≈34 kB upright, ≈38 kB italic
  for the sans; ≈18 kB / ≈19 kB for the mono) covers every weight from 200 to 800. Characters
  outside the Latin subset (box-drawing lines, most arrows, emoji) come from the fallback fonts.
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
