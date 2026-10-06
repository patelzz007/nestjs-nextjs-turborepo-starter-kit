# `@workspace/ui`

Shared, **dumb** UI primitives for the monorepo. Components are stateless, fully controlled by parents, and safe to use with React Hook Form.

## Principles

| Rule | Practice |
|------|----------|
| Smart vs dumb | No data fetching, routing, or `localStorage` in primitives — pages/containers own that logic. |
| `forwardRef` | Every interactive root forwards a ref so RHF `register()` and focus management work. |
| CVA | Styled components use `class-variance-authority` with `variant`, `size`, and `state` (`default` \| `loading` \| `disabled` \| `error`). |
| Copy | No strings in components — every string comes from the app's label registry (see [Copy and languages](#copy-and-languages)); `labels` props override per usage. |
| Tokens | Use design tokens (`bg-primary`, `text-destructive`, `z-overlay`) — no raw `z-50`, `bg-emerald-*`, or hex literals. |
| Types | Zod at boundaries; no `any`, `unknown`, `never`, or runtime `typeof` checks in UI code. |

## Theming

Import global styles once in your app layout:

```tsx
import "@workspace/ui/globals.css";
```

Colour primitives live in `src/styles/palette.css`; semantic tokens (and everything else below) in `src/styles/tokens.css` — see "Palette", "Reward tiers", "Elevation and radius" and "Typography" in `rules/07-ui-system.md`. Z-index layers:

- `z-overlay` — modal / dialog / sheet backdrops
- `z-popover` — dropdowns, selects, tooltips
- `z-toast` — toast stack (above overlays)
- `z-sidebar` / `z-sidebar-rail` — fixed sidebar shell and resize rail
- `z-sticky` — in-flow sticky headers (e.g. `AccordionTrigger sticky`)

App-shell chrome type sizes (consume as `text-(length:--text-…)`): `--text-kbd` (shortcut `<kbd>`
hints), `--text-overline` (uppercase group labels), `--text-micro` (palette footer keys, section
badges) and `--text-chip` (scope chips).

**Shell / navigation copy.** The app-shell and navigation components render no English of their
own: each reads its label family from the app's `UiKitLabelsProvider` with `useUiKitLabels` and
throws without one — `sidebar`, `panelSidebarNav`, `breadcrumb`, `breadcrumbTrail`, `carousel`,
`pagination`, `appShellTopbarSearch`, `appShellProfileDropdown`, `shellThemeToggle`, `scrollToTop`,
`appCommandPalette` and `authLayout` (English: `UI_KIT_LABELS_EN.<family>`). A component's optional
`labels` prop (`UiKitLabelsOverride<"<family>">`, a stable module constant) overrides individual
strings for one usage; single-string props (`ariaLabel` on `Breadcrumb`, `label` on
`BreadcrumbEllipsis` / `ScrollToTop` / `ShellThemeToggle`, `aria-label` on `Pagination`, the topbar
search's `mobileAriaLabel` / `desktopAriaLabel`, the palette's `placeholder`) win over the family.
The `*Labels` interfaces stay in `lib/shell/labels`, `lib/navigation/labels`, `lib/palette/labels`
and `lib/sidebar/labels`. Stateful shell pieces expose a controlled pair alongside their
uncontrolled default: `AppCommandPalette` (`open`/`onOpenChange`, `searchText`/`onSearchTextChange`),
`AppShellProfileDropdown` (`open`/`onOpenChange`), `ScrollToTop` (`visible`/`onVisibleChange`) and
`SidebarProvider` (`openMobile`/`onOpenMobileChange`).

Wrap the app with `ThemeProvider` from `@workspace/ui/components/theme-provider` for light/dark mode.

## Copy and languages

Components contain no user-facing text. Every string a kit component renders or announces is
declared in one typed registry, `UiKitLabels` (`src/lib/labels/ui-kit-labels.ts`), grouped by
component family (`combobox`, `dataTable`, `sidebar`, `toast`, …). The kit ships complete
**language packs** — `UI_KIT_LABELS_EN` (`src/lib/labels/en.ts`) — registered in
`UI_KIT_LANGUAGE_PACKS` (`src/lib/labels/language-packs.ts`).

- **Choose the language once, at the app root.** Each app's root layout mounts
  `<UiKitLanguageProvider language={PLATFORM_UI_KIT_LANGUAGE}>` (the platform setting lives in
  `@workspace/client/lib/i18n/ui-kit-language`). The prop is a plain string, so a Server
  Component layout can pass it. `UiKitLabelsProvider labels={…}` takes a complete custom set
  instead (e.g. a pack extended with product wording).
- **No silent fallback.** A component rendered without a provider throws, naming its family —
  missing copy fails loudly instead of rendering blank or English-by-accident controls.
- **Override per usage, partially.** Every component's `labels` prop is
  `UiKitLabelsOverride<"<family>">` — only the strings that differ for that usage (a dialog's
  "Delete users" confirm button). Keep overrides as module constants.
- **Add a language:** add `src/lib/labels/<lang>.ts` satisfying `UiKitLabels`, add the code to
  `UI_KIT_LANGUAGES` and `UI_KIT_LANGUAGE_PACKS` — TypeScript rejects a pack missing any string.
- **Add a component with copy:** add its `*Labels` interface and a family to `UiKitLabels`; every
  pack must then supply it. Read it with `useUiKitLabels("<family>", labels)`.
- **Tests** render inside `UiKitTestProviders` (`@workspace/ui/testing/ui-kit-test-providers`)
  and assert English through `UI_KIT_LABELS_EN.<family>.<key>`.

Content that is not kit chrome — page titles, domain messages, a QR code's description — stays a
regular prop owned by the page.

## Sidebar (`sidebar.tsx`)

Composable shadcn-style sidebar primitives. **Admin app uses a bespoke sidebar** (`apps/admin/components/layout/sidebar.tsx`) for search, section reorder, and Zustand — the UI kit sidebar targets simpler apps.

```tsx
import { SidebarProvider, Sidebar, SidebarTrigger, SidebarContent, createCookieSidebarStorage } from "@workspace/ui/components/sidebar";

// Inside the app's UiKitLabelsProvider / UiKitLanguageProvider.
<SidebarProvider storage={createCookieSidebarStorage()}>
	<Sidebar>
		<SidebarContent>{/* menu */}</SidebarContent>
	</Sidebar>
	<SidebarTrigger />
</SidebarProvider>;
```

- **`labels`** — optional `UiKitLabelsOverride<"sidebar">`; the toggle + mobile sheet copy comes from the `sidebar` label family
- **`storage`** — optional `SidebarStorageAdapter`; defaults to cookie persistence
- **`open` / `onOpenChange`** — controlled mode; parent can skip cookie adapter
- **CVA** — `sidebarMenuButtonVariants` / `sidebarMenuSubButtonVariants` with `state: default | active | disabled`

## Code block (`code-block.tsx`)

A full port of the [ReUI code block](https://reui.io/components/code-block) (registry items
`base-vega/code-block.json` + `code-block-highlight`, synced to the latest release): Shiki
highlighting, streaming, diffs, folding, focus mode, line selection, per-line actions, wrap,
collapse/expand, copy and download, plus ReUI's markdown helpers for AI transcripts. Public names, prop names,
`data-slot` / `data-*` attributes and `--code-block-*` custom properties match ReUI, so its docs
and examples apply — with the deviations listed below.

Two modules:

- **`code-block.tsx`** (`"use client"`) — the parts and hooks.
- **`code-block-highlight.ts`** (no directive, server-safe) — the lazy Shiki engine
  (JavaScript regex engine, so no `wasm-unsafe-eval` in your CSP; static per-grammar/theme
  import maps — add a language by adding a line to `codeBlockLanguages`) and pure helpers:
  `highlightCode`, `parseLineSpec`, `normalizeCode`, `buildWordDecorations`,
  `stripNotationComments`, `toPlainLines`, `resolveCodeBlockLanguage`,
  `markdownCodeProps`, `markdownFences`, `preloadCodeBlockHighlighter` (kit extra: warms the
  engine where lazy `import()` stops working, e.g. Astro's config runner),
  `resetCodeBlockHighlighter` (test seam), `codeBlockLanguages`, `codeBlockThemes`,
  `DEFAULT_CODE_BLOCK_THEMES`. ReUI ships this file as `.tsx`; nothing in it renders JSX,
  so it stays a plain `.ts` module, server-safe, with no `"use client"`.

**Parts:** `CodeBlock` (root; renders the code surface itself — children are chrome only),
`CodeBlockHeader`, `CodeBlockTitle`, `CodeBlockLanguage`, `CodeBlockCopyButton`,
`CodeBlockDownloadButton`, `CodeBlockWrapToggle`, `CodeBlockExpandButton`,
`CodeBlockLineActions` (render prop, shown on the hovered/focused row, `side="end" | "gutter"`),
`CodeBlockContent` (compose the surface inside your own ScrollArea). **Hooks:**
`useCodeBlockConfig`, `useCodeBlockFolding`, `useCodeBlockSelection`.

**Main `CodeBlock` props:** `code` + `language` (client highlighting) **or** `lines`
(pre-highlighted), `themes` (`{ light, dark }`, default github-light/dark; `"css-variables"`
for token theming), `highlight`, `showLineNumbers` + `startLine` (CSS counter — numbers never
copy), `highlightedLines` / `focusedLines` / `diff` / `lineLevels` (line specs: `[2, 3]` or
`"2-4,7"`, source-numbered), `highlightedWords`, `transformers` (Shiki; `[!code ++]` notation lands
in the same line state — hoist the array to module scope), `streaming` (deferred tokenisation,
caret, stick-to-bottom, completion announcement), `wrap` / `defaultWrap` / `onWrapChange`,
`maxLines` + `expanded` / `defaultExpanded` / `onExpandedChange`, `foldable` + `foldRegions` /
`folded` / `defaultFolded` / `onFoldedChange`, `selectable` + `selectedLines` /
`defaultSelectedLines` / `onSelectedLinesChange`, `variant` (`default | ghost`), `label`,
`completeAnnouncement`, and an optional **`labels`** override.

**Labels.** The kit ships no copy: the block reads the `codeBlock` family (`CodeBlockLabels`) of
the app's `UiKitLabelsProvider` (`UI_KIT_LABELS_EN.codeBlock` in English), and throws without a
provider. The root's optional `labels: UiKitLabelsOverride<"codeBlock">` overrides individual
strings for one block and its parts; parameterised strings (`foldLines`, `unfoldLines`,
`unfoldHiddenLines`, `hiddenLines`, `languageCode`, `lines`, `complete`) are functions. Per-part
props still override (`CodeBlockCopyButton labels`, `CodeBlockDownloadButton label`, root `label`
/ `completeAnnouncement`, children of the wrap and expand buttons). A copy/download button
rendered outside any `CodeBlock` reads the provider directly. Keep an override's reference
stable (module constant or memo) — it reaches every memoised row. Because it contains functions,
a **server component** must import an override object from a module, not build one inline. Tests
render inside `UiKitTestProviders` (`@workspace/ui/testing/ui-kit-test-providers`).

**Server-highlighted path.** A server component awaits `highlightCode` and passes `lines`; the
client then loads no Shiki at all. Copy/download fall back to the lines' text.

```tsx
// server component
import { highlightCode } from "@workspace/ui/components/code-block-highlight";
import { CodeBlock, CodeBlockCopyButton, CodeBlockHeader, CodeBlockLanguage, CodeBlockTitle } from "@workspace/ui/components/code-block";

const lines = await highlightCode(source, { language: "tsx", highlightedLines: "3-5" });

<CodeBlock lines={lines} language="tsx" showLineNumbers>
	<CodeBlockHeader>
		<CodeBlockTitle>app.tsx</CodeBlockTitle>
		<CodeBlockLanguage />
		<CodeBlockCopyButton />
	</CodeBlockHeader>
</CodeBlock>;

// client, streaming from a model
<CodeBlock code={partial} language="python" streaming={!done} maxLines={20} foldable>
	<CodeBlockExpandButton />
</CodeBlock>;
```

**Markdown helpers** (ReUI, re-exported from `code-block` too, so a transcript wires up from one
import path; a server component imports them from `code-block-highlight`):

- `markdownCodeProps(preProps)` → `{ code, language }` from the props react-markdown gives a
  `pre` (`language-*` class, nested children flattened, one trailing newline dropped). Tolerant:
  a still-streaming fence with no language yet comes back as plain `code`.
- `markdownFences(markdown)` → `CodeBlockMarkdownPart[]` (`{ type: "text" | "code", content,
language?, open }`) for transcripts rendered without a markdown dependency. CommonMark
  backtick/tilde fences; an unterminated trailing fence is a `code` part with `open: true`
  (pass it as `streaming`).

```tsx
// react-markdown
<Markdown components={{ pre: (props) => <CodeBlock {...markdownCodeProps(props)} /> }} />;

// raw assistant text, mid-stream
{
	markdownFences(message).map((part, index) =>
		part.type === "code" ? <CodeBlock key={index} code={part.content} language={part.language} streaming={part.open} /> : <p key={index}>{part.content}</p>,
	);
}
```

A pre-built `lines` array can also carry per-line `gutter` labels (e.g. dual old/new numbers for a
patch) and per-token `color` / `colorDark`. ReUI's unified-diff (`parseUnifiedDiff`) and ANSI
(`ansiToLines`) parsers were not kept: nothing in the monorepo uses them, and the ANSI palette is
hard-coded hex that bypasses the kit's tokens. The markdown helpers are kept (see above). Theme tokens used: `--card`, `--primary`, `--success`, `--destructive`, `--warning`,
`--info`, `--accent`, `--muted` (all in `styles/tokens.css`).

**Deliberate deviations from ReUI** (behaviour otherwise identical):

- Every hard-coded English string moved to the `codeBlock` family of the kit's label registry
  (`UiKitLabelsProvider`), with an optional root `labels` override. A copy/download button
  rendered outside any `CodeBlock` reads the provider.
- Every DOM-rendering part forwards a ref (`CodeBlockContent` → the content wrapper;
  `CodeBlockExpandButton` → its button, `className` still styles the floating wrapper).
- `onCopyError` receives an `Error` (a non-`Error` rejection is wrapped, original on `cause`).
- Type-level only: real Shiki/hast types instead of `unknown`/casts; the highlight effect reads its
  serialized spec back through a zod schema; `markdownCodeProps` reads the React tree through a
  recursive zod schema (an unreadable child contributes nothing, as in ReUI's walker) instead of
  `typeof` probes and casts; object types are `interface`s.
- Accessibility: when `selectable`, the listbox (`<pre>`) — not the scroll region — takes focus
  and carries `aria-activedescendant`, so assistive technology announces the active line; a
  plain block keeps the focusable region for keyboard scrolling.
- Tailwind classes are written in their canonical v4 form (e.g. `bg-linear-to-t`,
  `wrap-break-word`, `scrollbar-thin`, `inset-e-2`, `mr-1`); the fold toggle uses the kit's
  `rounded-lg` radius token instead of ReUI's literal `rounded-[4px]`.
- Lint-driven restructuring with no visible change: the latest-value refs sync in a layout effect
  instead of during render; the stream-complete announcement is derived during render instead of
  set in an effect; pointer/focus tracking (`<pre>`) and listbox keyboard handling (viewport) are
  native listeners; the row's `option` role and its handlers are applied together only when
  selectable; clicks inside a line-action group are ignored by the row instead of
  `stopPropagation` on the group.
- Fixes: the folded-lines chip unfolds by source line (ReUI used the displayed number, wrong
  when `startLine ≠ 1`); language/theme/extension lookups ignore `Object.prototype` keys; a
  highlight result is also tagged with its language.

## ReUI components (`alert`, `badge`, `stepper`, `tree`, `code-block`)

These are ports of [ReUI](https://reui.io)'s **Base UI** variants (registry style `base-vega`),
not hand-rolled components. Part names, props, `data-slot` / `data-state` attributes and
composition match ReUI, so its docs and examples apply. Every file starts with a comment that
lists its deliberate deviations; the common ones are:

- **Refs and types** — every part forwards its ref; ReUI's `any`, `as` casts and
  `eslint-disable` comments are replaced with real types. Generic parts (`Tree`, `TreeItem`,
  `TreeItemLabel`) take `ref` as a regular prop (React 19), because `forwardRef` erases `T`.
- **Fully controlled** — `Stepper` requires `value` (no `defaultValue`); `Alert` has no
  dismiss/timer state: the parent renders it conditionally and puts a dismiss `Button` in
  `AlertAction`.
- **Tokens** — ReUI's status colours map onto `tokens.css`: `success|warning|info|destructive`
  plus `-foreground` (text on a light tint, aliased to the tone palette so it keeps its AA
  contrast), `invert` / `invert-foreground`, and `status-foreground` (text on a solid status
  fill, in place of `text-white`). Badge's two smallest sizes use `--text-badge-xs|sm`.
- **Kit extras kept** — `Badge` keeps `ghost`, `link` and the categorical tone palette
  (`green` … `violet`); ReUI's `focus` variants are omitted (no `--focus` colour).

Status badges: use the `-light` variants (`destructive-light`, `success-light`, …) for soft
status chips and the solid ones for high emphasis. Import `BadgeVariant` instead of
re-declaring a union of variant names.

`Tree` wraps a [headless-tree](https://headless-tree.lukasbach.com/) instance: build it with
`useTree` from `@headless-tree/react` in the smart component (data loader, expanded/selected
state, features) and map `tree.getItems()` to `TreeItem` + `TreeItemLabel`. Drag-and-drop and
search states appear only when those features are loaded.

## Entity avatar (`entity-avatar.tsx`)

A square (or `shape="circle"`) brand mark for a named entity — a shop, organization or team.
Composes `Avatar`; data-agnostic (`name` + optional `src`, nothing domain-specific).

- **Logo** — `src` renders lazily in place (`loading="lazy"`), `object-contain` on the neutral
  `bg-background` surface, so a logo is never cropped.
- **Monogram** — with no `src`, or while the logo loads / if it fails, up to two initials
  (`getUserInitials`) on a tint chosen deterministically from the name (`getEntityAvatarTone`,
  `chart-1`…`chart-4` at 20%, foreground text; never `chart-5`, the themes' neutral grey slot) — every app theme, light and dark, recolours it.
- **Sizes** — `sm` (8) · `md` (10) · `lg` (12) · `xl` (16) spacing units.
- **Accessibility** — `alt` follows `<img alt>` semantics and defaults to `name`. Pass `alt=""`
  when the name is already rendered as adjacent text: the mark is then hidden from assistive
  technology instead of announcing the name twice.

```tsx
<EntityAvatar name={shop.name} src={shop.logoUrl} alt="" size="lg" />
```

## Formatting dates, counts and money (`lib/format/`)

The one sanctioned way to render a timestamp, count or money amount in every app. Never call
`toLocaleString()`, `toLocaleDateString()` or date-fns `format()` at a call site: they follow the
runtime's own locale and time zone, which differ between the Node server and the viewer's browser,
so the server HTML and the first client render disagree (a hydration mismatch) and the same instant
reads as different days.

Every formatter takes the locale — and, for dates, the IANA time zone — explicitly. Apps pass
`PLATFORM_DISPLAY_REGION` from `@workspace/shared` (`en-MY`, `Asia/Kuala_Lumpur`: every pilot city
is in that zone, so it is the stores' wall-clock time). Analytics dashboards label buckets in the
report's own zone (`range.timeZone` of the response — the merchant's zone, UTC for admin and
customer).

| Module                 | Exports                                                                                                                                                                                                                                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/format/date-time` | `formatEpochMs(epochMs, "date" \| "dateTime" \| "dayMonth", region)`, `formatEpochMsRange(fromMs, toMs, region)` (half-open range → "6 Sept – 5 Oct 2026"), `formatBucket(startMs, endMs, interval, "axis" \| "full", region)`, `toIsoTimestamp`, `formatRelativeTime(epochMs, nowMs, locale)` |
| `lib/format/number`    | `formatCount(value, locale)`, `formatPercent(percent, locale)`, `formatPercentChange(percent, locale)` (percent units, one decimal)                                                                                                                                                            |
| `lib/format/money`     | `formatMinorUnits(minor, currency, locale)`, `formatMinorUnitsCompact`, `minorToMajorUnits`, `minorUnitExponent` — the minor-unit exponent comes from `SALE_CURRENCY_MINOR_UNIT_EXPONENTS` (ISO 4217) in `@workspace/shared`, never from ICU's display precision                               |

**Relative times** ("5 minutes ago") depend on the current time, which the server and the browser
never share. Render them with `RelativeTime` (`relative-time.tsx`): the server and the
hydrating client both render the absolute time, and only after mount does it switch to the relative
wording (refreshed every 30 s; the absolute time stays as the tooltip).

```tsx
<RelativeTime epochMs={terminal.lastSeenAt} region={PLATFORM_DISPLAY_REGION} />
```

## Analytics primitives (`components/`)

`KpiStatCard`, `TimeSeriesChart` (line / area / bar / stacked bar), `RankedBarList`, `ShareBar`,
`AnalyticsRangePicker`, `AnalyticsPanel` + `ChartStateFrame`, and the chart colour slots in
`lib/charts/chart-colors`. Data-agnostic: they take formatted strings, numbers, colour slots and
callbacks — never an API type. What each is for, the colour rules, accessibility and testing:
[Analytics dashboards](../../docs/technical/frontend/analytics-charts.md).

## React Hook Form

`react-hook-form` is an **optional peer** — install it in the app that owns the form:

```bash
pnpm add react-hook-form
```

**`register()`** — primitives forward refs to the native control:

```tsx
const { register } = useForm<LoginInput>({ resolver: zodResolver(LoginInputSchema) });

<Input {...register("email")} aria-invalid={errors.email ? true : undefined} />;
```

**`Controller`** — for headless primitives (Select, Combobox, Switch):

```tsx
<Controller name="role" control={control} render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
```

**Loading submit** — use `Button` with `loading` or `FormShell` with explicit `submitLabel` / `loadingLabel` (both required).

## Accessibility

- Form controls expose `onBlur`, `onChange`, and `onFocus` without clobbering consumer handlers.
- Error banners use `role="alert"` or `aria-live` where appropriate.
- `Spinner` requires `ariaLabel` via props (no default English label).

## Testing

Contract tests enforce ref forwarding and event composition:

```bash
pnpm --filter @workspace/ui test
```

Files: `form-contract.test.tsx`, `display-contract.test.tsx`, `overlay-contract.test.tsx`, `ui-kit-contract.test.tsx`.

## Package layout

```
src/
  components/   — every component, flat: `components/<name>.tsx`, imported as
                  `@workspace/ui/components/<name>` (no category folders)
  lib/          — utils, format (dates, counts, money), field-variants, field-state, sidebar-labels, sidebar-storage, sidebar-variants
  styles/       — tokens, globals
  hooks/
```
