## Installation

`CodeBlock` ships with the kit in `packages/ui/src/components/code-block.tsx`; there is nothing to install. Its only npm dependency is `shiki`. Grammars and themes load lazily, one chunk per language, and nothing loads at all when you pass pre-highlighted lines or turn highlighting off.

```showcase-example
c-code-block-1
```

## Usage

```tsx
import { CodeBlock, CodeBlockCopyButton, CodeBlockHeader, CodeBlockLanguage, CodeBlockTitle } from "@workspace/ui/components/code-block";
```

```tsx
<CodeBlock code={code} language="tsx" />
```

That is a complete block. Everything else is composition:

```tsx
<CodeBlock code={code} language="tsx" showLineNumbers>
	<CodeBlockHeader>
		<CodeBlockTitle>use-totals.ts</CodeBlockTitle>
		<CodeBlockLanguage />
		<CodeBlockCopyButton className="ms-auto" />
	</CodeBlockHeader>
</CodeBlock>
```

The copy, download, wrap and expand controls take their accessible names from the app's `UiKitLabelsProvider` (the `codeBlock` messages), so they follow the reader's language; pass `labels` to override a block's strings.

## Anatomy

`CodeBlock` renders the code surface itself. With the default surface, its children are chrome (a header, a copy button, an expand control) and their order never matters. Composing `CodeBlockContent` makes the surface one of the children, and from then on the order is the DOM order.

```tsx
<CodeBlock>
	<CodeBlockHeader>
		<CodeBlockTitle />
		<CodeBlockLanguage />
		<CodeBlockWrapToggle />
		<CodeBlockCopyButton />
	</CodeBlockHeader>
	<CodeBlockContent /> {/* optional: compose it inside your own ScrollArea */}
	<CodeBlockExpandButton />
	<CodeBlockLineActions>{({ line }) => null}</CodeBlockLineActions>
</CodeBlock>
```

A `CodeBlockCopyButton` inside a header is an ordinary flex child. Outside one it pins itself over the surface and stays put under both vertical and horizontal scrolling.

## Framing

The default variant draws a bordered surface. Use `variant="ghost"` when something else already draws the chrome, so the border is not doubled. Ghost keeps the block's own padding; a flush fit is the container's job (`p-0` on the panel, as the framed examples do).

```tsx
<Card>
	<CardContent>
		<CodeBlock code={code} language="tsx" variant="ghost" />
	</CardContent>
</Card>
```

```showcase-example
c-code-block-14
```

## Scrolling

By default the block scrolls inside its own plain `overflow: auto` container — no Scroll Area dependency, native thin scrollbars — and `maxLines` caps it.

To own the scrolling yourself, compose `CodeBlockContent` inside your own scroll container. That ancestor then takes BOTH axes — the surface scrolls nothing itself — and a header above it never scrolls away. The sticky line numbers anchor to the ancestor's viewport, and stick-to-bottom while streaming follows it too. Add a `ScrollBar orientation="horizontal"` child for the horizontal bar; Base UI positions it against the scroll area's root, so it stays pinned although it sits among the children.

```tsx
<CodeBlock code={code} language="tsx" showLineNumbers>
	<CodeBlockHeader>
		<CodeBlockTitle>use-totals.ts</CodeBlockTitle>
		<CodeBlockCopyButton className="ms-auto" />
	</CodeBlockHeader>
	<ScrollArea className="rounded-[inherit] **:data-[slot=scroll-area-viewport]:max-h-72">
		<CodeBlockContent />
		<ScrollBar orientation="horizontal" />
	</ScrollArea>
</CodeBlock>
```

Use `max-h-*`, not a fixed height, so a short file leaves no dead space, and put it on the Scroll Area's VIEWPORT, as above: the viewport is 100% of the root's height, and a percentage of a parent with only a max-height resolves to auto, so a cap on the root clips without ever scrolling.

`maxLines` still marks the block as collapsible, so `CodeBlockExpandButton` works either way; only the height cap belongs to the built-in viewport. To collapse a composed surface, read `expanded` from `useCodeBlockConfig` and cap your own Scroll Area, as the expand example does.

`CodeBlockContent` must appear in the JSX you pass to `CodeBlock` — at any depth, inside any wrapper, your own components included. It goes unseen only when a child component CONSTRUCTS it internally instead of receiving it as children, and development logs an error when that happens.

```showcase-example
c-code-block-19
```

The inverse also works — default blocks that size to their content, listed inside one outer Scroll Area that scrolls the whole set — and ships as the [External Scroll](/components/code-block#external-scroll) example.

## Server rendering

`highlightCode` lives in `@workspace/ui/components/code-block-highlight`, a module with no `"use client"` directive, so a server component can call it. The result is plain JSON: it crosses to the client as data and the browser never downloads a grammar.

```tsx
import { CodeBlock, CodeBlockCopyButton, CodeBlockHeader } from "@workspace/ui/components/code-block";
import { highlightCode } from "@workspace/ui/components/code-block-highlight";

export default async function Page(): Promise<React.JSX.Element> {
	const lines = await highlightCode(source, { language: "tsx" });

	return (
		<CodeBlock lines={lines} showLineNumbers>
			<CodeBlockHeader>
				<CodeBlockCopyButton value={source} />
			</CodeBlockHeader>
		</CodeBlock>
	);
}
```

> `lines` is a plain array, so any highlighter can produce it. If you already use Prism or highlight.js, map its output to `CodeBlockLine[]` and the block never loads Shiki.

## Streaming and AI SDK

Pass a `code` string that grows. The block re-tokenizes on a deferred value, and the highlighter returns the same line objects for the lines that did not change, so an appended chunk re-renders one line rather than the whole file. Lines past what the highlighter has caught up with render as plain text, so the newest token shows at once.

```tsx
<CodeBlock code={partial} language="tsx" streaming={status === "streaming"} />
```

`streaming` is presentational: it shows an underline caret, keeps the viewport at the bottom until the reader scrolls up, sets `aria-busy` and turns on motion. New lines slide in once; tokens deliberately do not animate, because the highlighter runs a chunk behind the stream and replaces plain lines with tokenized ones — colour arriving instantly reads as highlighting, while a fade on every mount would re-flash lines that were already readable. The animation is compositor-only and honours `prefers-reduced-motion`. Incremental rendering is always memoised, so forgetting the prop costs nothing in correctness.

```showcase-example
c-code-block-3
```

### Markdown code fences

Most AI chat UIs do not hold a raw code string: they hold a Markdown message with fenced blocks in it. Two helpers cover both routes.

Rendering a message yourself, `markdownFences` splits it into prose and code and reports a fence whose closing delimiter has not streamed in yet:

```tsx
{
	markdownFences(message.text).map((part) =>
		part.type === "text" ? (
			<p key={part.content}>{part.content}</p>
		) : (
			<CodeBlock key={part.content} code={part.content} language={part.language} streaming={part.open}>
				<CodeBlockCopyButton />
			</CodeBlock>
		),
	);
}
```

With react-markdown, `markdownCodeProps` reads the language and the source out of the props given to `pre`:

```tsx
function MarkdownPre(props: React.ComponentProps<"pre">): React.JSX.Element {
	const { code, language } = markdownCodeProps(props);
	return (
		<CodeBlock code={code} language={language}>
			<CodeBlockCopyButton />
		</CodeBlock>
	);
}

<ReactMarkdown components={{ pre: MarkdownPre }}>{message.text}</ReactMarkdown>;
```

An unknown language and an unterminated fence both render as plain text rather than throwing, which is what a half-streamed message always looks like.

```showcase-example
c-code-block-4
```

## Bundle and CSP

The highlighter uses Shiki's JavaScript regex engine, not Oniguruma. There is no WebAssembly, so the block never forces `'wasm-unsafe-eval'` into the Content Security Policy.

- Shiki loads on the first highlight, never on import.
- Each language is its own chunk, resolved through a static map.
- `highlight={false}` and the `lines` prop never request any of it.

## Adding a language

Languages are a written-out map in `packages/ui/src/components/code-block-highlight.ts`. Add a line:

```ts
export const codeBlockLanguages: Record<string, () => Promise<LanguageInput>> = {
	// …
	elixir: () => import("shiki/langs/elixir.mjs"),
};
```

Aliases resolve first, so shorthands live one map up: add `ex: "elixir"` to `LANGUAGE_ALIASES` and both names work. An entry need not come from Shiki either — `mylang: () => import("./my-grammar.json")` registers a custom TextMate grammar, since the loader feeds `loadLanguage` directly. Anything unresolved renders as plain text.

The map is written out on purpose. Building the specifier from a template literal makes bundlers emit a context module holding every grammar Shiki ships, which quietly turns a lean build into a very large one.

## Theming

Three levels, from no effort to full control:

1. **Defaults.** Blocks ship with One Dark Pro, VS Code's popular dark theme, in both app themes, so the code surface stays dark in light mode too. A handful of its token colours are lifted just enough to pass WCAG AA contrast on its `#282c34` background. Code and file names are set in JetBrains Mono: the block reads the app's `--font-code` variable and falls back to `--font-mono` when an app does not load it.
2. **Any Shiki theme.** Register it in `codeBlockThemes` in `packages/ui/src/components/code-block-highlight.ts` (one line, lazy-loaded), then pass `themes={{ light: "vitesse-light", dark: "vitesse-dark" }}`. Changing the two defaults in that file restyles every block at once. An unregistered name falls back to its side's default and warns in development — check the `codeBlockThemes` entry first when a block renders in the wrong palette.
3. **Design tokens.** Pass the built-in `css-variables` theme and the palette moves into your stylesheet: every token colour becomes a `var(--code-token-*)` reference, so highlighting follows the design system in both modes with no theme JSON at all.

```tsx
<CodeBlock code={code} language="tsx" themes={{ light: "css-variables", dark: "css-variables" }} />
```

```css
:root {
	--code-token-keyword: var(--color-rose-600);
	--code-token-function: var(--color-violet-600);
	--code-token-string: var(--color-emerald-600);
	--code-token-constant: var(--color-sky-600);
	--code-token-parameter: var(--color-amber-600);
	--code-token-comment: var(--color-muted-foreground);
	--code-token-punctuation: var(--color-foreground);
}
.dark {
	--code-token-keyword: var(--color-rose-400);
	/* …and the dark side of each token */
}
```

The full set of variables: `--code-foreground`, and `--code-token-constant`, `-string`, `-comment`, `-keyword`, `-parameter`, `-function`, `-string-expression`, `-punctuation` and `-link`. Blocks with different `themes` coexist on one page; each theme loads once, by name, on first use. The design-token example is the one shown under [Scrolling](#scrolling).

### Dark theme

Code often stays dark even on a light page. Wrap the block in a `dark` scope and every semantic token inside follows; the block needs nothing.

```tsx
<div className="dark">
	<CodeBlock code={code} language="tsx" />
</div>
```

```showcase-example
c-code-block-20
```

## Examples

A representative six; all 27 run live on the [Code Block page](/components/code-block).

### Pinned copy button

```showcase-example
c-code-block-2
```

### Diff

Line state comes straight from props here — the simplest form. For a real patch, see the unified patch review below.

```showcase-example
c-code-block-5
```

### Nested code folding

Regions come from indentation rather than the grammar, so folding works in every language the block can render. Folding an outer region swallows the inner toggles and leaves their own state untouched underneath.

```showcase-example
c-code-block-23
```

### Fix with AI on the failing line

The render prop receives each line's state, so one action group serves the whole block and still offers the fix only where a diagnostic sits.

```showcase-example
c-code-block-24
```

### Reference lines in chat

A gutter button sits where an editor puts it. Pressing it turns the hovered line, or the current selection through `useCodeBlockSelection`, into `file:line` reference badges in the composer below.

```showcase-example
c-code-block-25
```

### Unified patch review

`parseUnifiedDiff` turns a git patch into per-file lines: the tints, the `+` and `-` glyphs and the dual old and new gutter numbers all come from the parse, and the download button saves each file's patch.

```showcase-example
c-code-block-18
```

### The rest

The other fifteen work exactly as these do: ANSI terminal output, line selection, soft wrap, an expand control over a long file, pre-highlighted server lines, before-and-after panes, a language switcher, a Shiki transformer diff, highlighted words, a dark terminal, patch review with accept and reject actions, and a changed-file list inside one scroll area.

## API Reference

```showcase-api

```

## Data attributes

State is published as attributes, so styling never needs `!important` or a `:has()` selector.

| Attribute                       | On              | Values                                                  |
| :------------------------------ | :-------------- | :------------------------------------------------------ |
| `data-variant`                  | root            | `default`, `ghost`                                      |
| `data-has-header`               | root            | present when a header is composed                       |
| `data-streaming`                | root            | present while streaming                                 |
| `data-has-diff`                 | root            | present when any line carries diff state                |
| `data-foldable`                 | root            | present when folding is on                              |
| `data-gutter-channel`           | root            | present when folding reserves the gutter channel        |
| `data-code-line`                | line            | the displayed line number                               |
| `data-highlighted`              | line            | present when marked                                     |
| `data-diff`                     | line            | `add`, `remove`                                         |
| `data-focused` / `data-blurred` | line            | focus mode                                              |
| `data-level`                    | line            | `error`, `warning`, `info`                              |
| `data-selected`                 | line            | present when selected                                   |
| `data-active`                   | line            | present under the keyboard or hover cursor              |
| `data-gutter`                   | line            | a verbatim gutter label (a patch's old and new numbers) |
| `data-code-line-numbers`        | pre             | present when the gutter renders                         |
| `data-wrap`                     | pre             | present while soft-wrapping                             |
| `data-selectable`               | pre             | present when line selection is on                       |
| `data-word`                     | token           | the matched word on a marked token                      |
| `data-position`                 | copy / download | `pinned`, `inline`                                      |
| `data-copied`                   | copy button     | present during the copied beat                          |
| `data-copy-failed`              | copy button     | present for 2 s after a rejected write                  |
| `data-state`                    | fold toggle     | `folded`, `unfolded`                                    |
| `data-state`                    | wrap toggle     | `on`, `off`                                             |
| `data-state`                    | expand button   | `expanded`, `collapsed`                                 |
| `data-side`                     | line actions    | `end`, `gutter`                                         |

## Keyboard

| Key               | Action                                                        |
| :---------------- | :------------------------------------------------------------ |
| `Tab`             | Moves into the scroll region, which is a tab stop.            |
| `↑` `↓`           | Moves the active line when `selectable`.                      |
| `Shift` + `↑` `↓` | Extends the selection.                                        |
| `Enter` `Space`   | Toggles the active line's selection in place.                 |
| `Home` `End`      | Moves the active line to the first or the last rendered line. |
| `Esc`             | Clears the active line, when `selectable`.                    |
| `Enter` `Space`   | Folds or unfolds the region while a fold toggle has focus.    |

## Accessibility

- With the built-in surface, the scroll container is a labelled `region` and a tab stop, so it scrolls without a pointer. Composed, the keyboard scroll stop is your own container, which then needs its own accessible name.
- With `selectable`, the code is a `listbox` and each line an `option` carrying `aria-selected`. The region wrapper holds the only `tabIndex={0}`, so the block is a single tab stop; the arrow keys move the active option, and `aria-activedescendant` on the wrapper exposes it to assistive technology.
- Line numbers and diff glyphs are generated content, so they are outside the accessibility tree and outside a text selection: copying gives the exact source.
- Streaming sets `aria-busy` and announces completion once, through a polite status. The code is deliberately not a live region, which would narrate every token.
