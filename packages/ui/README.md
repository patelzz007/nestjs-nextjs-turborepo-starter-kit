# `@workspace/ui`

Shared, **dumb** UI primitives for the monorepo. Components are stateless, fully controlled by parents, and safe to use with React Hook Form.

## Principles

| Rule | Practice |
|------|----------|
| Smart vs dumb | No data fetching, routing, or `localStorage` in primitives — pages/containers own that logic. |
| `forwardRef` | Every interactive root forwards a ref so RHF `register()` and focus management work. |
| CVA | Styled components use `class-variance-authority` with `variant`, `size`, and `state` (`default` \| `loading` \| `disabled` \| `error`). |
| Labels | No English defaults in dumb components — pass copy via `labels` props or required string props. |
| Tokens | Use design tokens (`bg-primary`, `text-destructive`, `z-overlay`) — no raw `z-50`, `bg-emerald-*`, or hex literals. |
| Types | Zod at boundaries; no `any`, `unknown`, `never`, or runtime `typeof` checks in UI code. |

## Theming

Import global styles once in your app layout:

```tsx
import "@workspace/ui/globals.css";
```

Tokens live in `src/styles/tokens.css`. Z-index layers:

- `z-overlay` — modal / dialog / sheet backdrops
- `z-popover` — dropdowns, selects, tooltips
- `z-toast` — toast stack (above overlays)
- `z-sidebar` / `z-sidebar-rail` — fixed sidebar shell and resize rail

Wrap the app with `ThemeProvider` from `@workspace/ui/components/theme-provider` for light/dark mode.

## Sidebar (`navigation/sidebar.tsx`)

Composable shadcn-style sidebar primitives. **Admin app uses a bespoke sidebar** (`apps/admin/components/layout/sidebar.tsx`) for search, section reorder, and Zustand — the UI kit sidebar targets simpler apps.

```tsx
import {
	SidebarProvider,
	Sidebar,
	SidebarTrigger,
	SidebarContent,
	DEFAULT_SIDEBAR_LABELS,
	createCookieSidebarStorage,
} from "@workspace/ui/components/navigation/sidebar";

<SidebarProvider labels={DEFAULT_SIDEBAR_LABELS} storage={createCookieSidebarStorage()}>
	<Sidebar>
		<SidebarContent>{/* menu */}</SidebarContent>
	</Sidebar>
	<SidebarTrigger />
</SidebarProvider>
```

- **`labels`** (required on `SidebarProvider`) — toggle + mobile sheet copy
- **`storage`** — optional `SidebarStorageAdapter`; defaults to cookie persistence
- **`open` / `onOpenChange`** — controlled mode; parent can skip cookie adapter
- **CVA** — `sidebarMenuButtonVariants` / `sidebarMenuSubButtonVariants` with `state: default | active | disabled`


## Code block (`display/code-block.tsx`)

A full port of the [ReUI code block](https://reui.io/components/code-block) (registry item
`code-block.json`): Shiki highlighting, streaming, diffs, ANSI, folding, focus mode, line
selection, per-line actions, wrap, collapse/expand, copy and download. Public names, prop names,
`data-slot` / `data-*` attributes and `--code-block-*` custom properties match ReUI, so its docs
and examples apply — with the deviations listed below.

Two modules:

- **`display/code-block.tsx`** (`"use client"`) — the parts and hooks.
- **`display/code-block-highlight.ts`** (no directive, server-safe) — the lazy Shiki engine
  (JavaScript regex engine, so no `wasm-unsafe-eval` in your CSP; static per-grammar/theme
  import maps — add a language by adding a line to `codeBlockLanguages`) and pure helpers:
  `highlightCode`, `parseLineSpec`, `normalizeCode`, `buildWordDecorations`,
  `stripNotationComments`, `toPlainLines`, `markdownCodeProps`, `markdownFences`,
  `resolveCodeBlockLanguage`, `parseUnifiedDiff`, `ansiToLines`, `resetCodeBlockHighlighter`
  (test seam), `codeBlockLanguages`, `codeBlockThemes`, `DEFAULT_CODE_BLOCK_THEMES`.

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
`completeAnnouncement`, and **`labels` (required)**.

**Labels.** The kit keeps English out of components (rule 11), so the root requires
`labels: CodeBlockLabels`. Pass `DEFAULT_CODE_BLOCK_LABELS` or a translated copy; parameterised
strings (`foldLines`, `unfoldLines`, `unfoldHiddenLines`, `hiddenLines`, `languageCode`, `lines`,
`complete`) are functions. Per-part props still override (`CodeBlockCopyButton labels`,
`CodeBlockDownloadButton label`, root `label` / `completeAnnouncement`, children of the wrap and
expand buttons). Keep the object reference stable (module constant) — it reaches every memoised
row. Because it contains functions, a **server component** must import the labels object from a
module (e.g. `DEFAULT_CODE_BLOCK_LABELS` from this client module), not build one inline.

**Server-highlighted path.** A server component awaits `highlightCode` and passes `lines`; the
client then loads no Shiki at all. Copy/download fall back to the lines' text.

```tsx
// server component
import { highlightCode } from "@workspace/ui/components/display/code-block-highlight";
import {
	CodeBlock,
	CodeBlockCopyButton,
	CodeBlockHeader,
	CodeBlockLanguage,
	CodeBlockTitle,
	DEFAULT_CODE_BLOCK_LABELS,
} from "@workspace/ui/components/display/code-block";

const lines = await highlightCode(source, { language: "tsx", highlightedLines: "3-5" });

<CodeBlock labels={DEFAULT_CODE_BLOCK_LABELS} lines={lines} language="tsx" showLineNumbers>
	<CodeBlockHeader>
		<CodeBlockTitle>app.tsx</CodeBlockTitle>
		<CodeBlockLanguage />
		<CodeBlockCopyButton />
	</CodeBlockHeader>
</CodeBlock>;

// client, streaming from a model
<CodeBlock labels={DEFAULT_CODE_BLOCK_LABELS} code={partial} language="python" streaming={!done} maxLines={20} foldable>
	<CodeBlockExpandButton />
</CodeBlock>;
```

`parseUnifiedDiff(patch)` returns per-file `lines` with dual old/new gutter labels;
`ansiToLines(stdout)` turns SGR colour codes into `lines` (palette overridable via
`--code-ansi-*`). `markdownCodeProps` / `markdownFences` are the react-markdown / raw-transcript
glue. Theme tokens used: `--card`, `--primary`, `--success`, `--destructive`, `--warning`,
`--info`, `--accent`, `--muted` (all in `styles/tokens.css`).

**Deliberate deviations from ReUI** (behaviour otherwise identical):

- `labels` root prop (required) + `DEFAULT_CODE_BLOCK_LABELS`; every hard-coded English string
  moved there. A copy/download button rendered outside any `CodeBlock` falls back to the defaults.
- Every DOM-rendering part forwards a ref (`CodeBlockContent` → the content wrapper;
  `CodeBlockExpandButton` → its button, `className` still styles the floating wrapper).
- `onCopyError` receives an `Error` (a non-`Error` rejection is wrapped, original on `cause`).
- Type-level only: real Shiki/hast types instead of `unknown`/casts; the highlight effect reads its
  serialized spec back through a zod schema; object types are `interface`s.
- Lint-driven restructuring with no visible change: the latest-value refs sync in a layout effect
  instead of during render; the stream-complete announcement is derived during render instead of
  set in an effect; pointer/focus tracking (`<pre>`) and listbox keyboard handling (viewport) are
  native listeners; the row's `option` role and its handlers are applied together only when
  selectable; clicks inside a line-action group are ignored by the row instead of
  `stopPropagation` on the group.
- Fixes: the folded-lines chip unfolds by source line (ReUI used the displayed number, wrong
  when `startLine ≠ 1`); language/theme/extension lookups ignore `Object.prototype` keys; a
  highlight result is also tagged with its language.

## Entity avatar (`display/entity-avatar.tsx`)

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
is in that zone, so it is the stores' wall-clock time), and `ANALYTICS_BUCKET_DISPLAY_REGION` for
analytics series points, which the API buckets by UTC week.

| Module | Exports |
|---|---|
| `lib/format/date-time` | `formatEpochMs(epochMs, "date" \| "dateTime" \| "dayMonth", region)`, `toIsoTimestamp`, `formatRelativeTime(epochMs, nowMs, locale)` |
| `lib/format/number` | `formatCount(value, locale)` |
| `lib/format/money` | `formatMinorUnits(minor, currency, locale)`, `formatMinorUnitsCompact`, `minorToMajorUnits`, `minorUnitExponent` — the minor-unit exponent comes from `SALE_CURRENCY_MINOR_UNIT_EXPONENTS` (ISO 4217) in `@workspace/shared`, never from ICU's display precision |

**Relative times** ("5 minutes ago") depend on the current time, which the server and the browser
never share. Render them with `RelativeTime` (`display/relative-time.tsx`): the server and the
hydrating client both render the absolute time, and only after mount does it switch to the relative
wording (refreshed every 30 s; the absolute time stays as the tooltip).

```tsx
<RelativeTime epochMs={terminal.lastSeenAt} region={PLATFORM_DISPLAY_REGION} />
```

## React Hook Form

`react-hook-form` is an **optional peer** — install it in the app that owns the form:

```bash
pnpm add react-hook-form
```

**`register()`** — primitives forward refs to the native control:

```tsx
const { register } = useForm<LoginInput>({ resolver: zodResolver(LoginInputSchema) });

<Input {...register("email")} aria-invalid={errors.email ? true : undefined} />
```

**`Controller`** — for headless primitives (Select, Combobox, Switch):

```tsx
<Controller
	name="role"
	control={control}
	render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
/>
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
  components/
    form/       — inputs, buttons, field shell
    overlay/    — dialog, sheet, popover, …
    navigation/ — sidebar, tabs, pagination, …
    feedback/   — alert, toast, spinner, …
    display/    — table, card, chart, …
  lib/          — utils, format (dates, counts, money), field-variants, field-state, sidebar-labels, sidebar-storage, sidebar-variants
  styles/       — tokens, globals
  hooks/
```
