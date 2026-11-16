## When to use

- Assistant replies and agent output that stream code, or lines a reader picks to ask about
- Code review of diffs, git patches and diagnostics, with accept, reject and fix actions
- Docs snippets and terminal or test logs with line numbers, copy, wrap, folding and search

## When not to use

- A full assistant conversation with a transcript and a composer: compose [Message](/components/message) and [Message Scroller](/components/message-scroller), with a code block inside each reply
- A promo or voucher code a shopper copies at checkout: an [Input Group](/components/input-group) with a copy button reads better than a code surface
- A log that keeps growing for minutes while people watch it: a streaming code block suits one reply, but a live console wants a virtualised list

## Notes

- Line specs such as `highlightedLines`, `diff` and `folded` count source lines from 1, whatever `startLine` prints in the gutter
- `maxLines` caps the height only on the built-in surface; with `CodeBlockContent` inside your own `ScrollArea`, cap that viewport yourself
- Hoist `transformers` to module scope: a new array on every render re-tokenizes the whole file

## Code Block: streaming, diffs and AI chat

`CodeBlock` renders source code with syntax highlighting from [Shiki](https://shiki.style). It handles the cases an AI product actually needs — code streaming in token by token, agent-proposed diffs, diagnostics on specific lines and per-line actions — alongside the ordinary documentation cases.

The 27 examples above cover that range: a streaming agent reply with a caret and stick-to-bottom scrolling, a chat message that renders Markdown code fences as they arrive, diff review with added and removed lines, focus walkthroughs, line selection for asking an assistant about a range, terminal output with no highlighting, and multi-file patches.

It is composed rather than configured. The root draws the code surface and its children supply the chrome, so the same block works bare, inside a [Card](/components/card), or inside a [Frame](/components/frame) without a doubled border.

### What is Code Block?

`CodeBlock` renders code as real React elements, not as an HTML string. Shiki tokenizes the code and the result is normalised into a plain array of lines, which is what makes per-line interaction possible: hover actions in the gutter, click and shift-click line selection, diff markers and diagnostic backgrounds all attach to elements instead of being baked into markup.

The happy path is one tag. Pass `code` and a `language` and you get a complete block, highlighted in both the light and the dark theme. Everything else — the header, the file name, the language label, the copy button, the wrap toggle and the expand control — is composed as children.

### Streaming code and AI chat

When code arrives from a model it grows a chunk at a time. The block re-tokenizes against a deferred value and the highlighter returns the same line objects for the lines that did not change, so appending a token re-renders one line, not the whole file. Lines the highlighter has not caught up with render as plain text, so the newest token is on screen at once and gains its colour a frame later.

Most chat UIs hold a Markdown message rather than a raw code string. Two helpers cover that: `markdownFences` splits a message into prose and fenced code and reports a fence whose closing delimiter has not streamed in yet, and `markdownCodeProps` reads the language and the source out of the props react-markdown gives a `pre` element. An unknown language and a half-finished fence both render as plain text instead of throwing.

### Server rendering and bundle cost

The Shiki engine lives in `code-block-highlight.ts`, a module with no `"use client"` directive, so a server component can call `highlightCode` and pass the resulting lines down as plain JSON. The browser then never downloads a grammar.

Highlighting uses Shiki's JavaScript regex engine rather than the WebAssembly one, so the block never forces `'wasm-unsafe-eval'` into the Content Security Policy. Shiki loads on the first highlight, never on import; each language is its own chunk, resolved through a static map; and passing pre-highlighted `lines` or `highlight={false}` requests none of it.

### Diffs, highlights and focus

Line state comes from props or from Shiki notation comments. Highlighted lines, highlighted words, added and removed diff lines, focused lines and error, warning or info levels all take either an array of line numbers or a range string such as `2-4,7`. The `transformers` prop goes straight to Shiki, so the notation comments of `@shikijs/transformers` produce the same state without a second code path.

Every piece of state is published as a data attribute on the line (`data-highlighted`, `data-diff`, `data-focused`, `data-level`, `data-selected`), so restyling any of it is a plain CSS selector. Line numbers and diff glyphs are generated content, so they stay out of a text selection: copying the code gives the exact source, with no gutter digits.

## Integrating with other components

Put a `CodeBlock` with `variant="ghost"` inside a [Card](/components/card) or a [Frame](/components/frame) panel when the container already draws the border. Switch between files with [Tabs](/components/tabs), and label a block's state — "Proposed", "Applied" — with a [Badge](/components/badge) in its header.

For chat, render each assistant reply in a [Message](/components/message) and split its Markdown with `markdownFences`. Long transcripts scroll inside a [Message Scroller](/components/message-scroller), and a file that should scroll with the page goes inside a [Scroll Area](/components/scroll-area) via `CodeBlockContent`.

## Frequently asked questions

### Does the code block work in React Server Components?

Yes. The Shiki engine is in `@workspace/ui/components/code-block-highlight`, which has no client directive, so a server component can `await highlightCode(...)` and pass the lines to `CodeBlock`. The lines are plain JSON, so the browser never downloads a grammar or the highlighter.

### How do I render code from an AI chat message?

Split the message with `markdownFences`, or override `pre` in react-markdown and read its props with `markdownCodeProps`. Both tolerate a fence that is still streaming, so a half-finished block renders as plain text rather than throwing. Pass `streaming` to show the caret and keep the newest line in view.

### Will it make my bundle large?

Shiki is the only dependency, and it loads on the first highlight, never on import. Each language is a separate chunk resolved through a static map, so a page downloads only the grammars it renders. Pre-highlighted `lines` or `highlight={false}` request nothing at all.

### Does it need `'wasm-unsafe-eval'` in the Content Security Policy?

No. Highlighting uses Shiki's JavaScript regex engine, not the WebAssembly Oniguruma engine, so there is no WebAssembly to allow.

### How do I add a language or change the theme?

Languages are the written-out `codeBlockLanguages` map in `packages/ui/src/components/code-block-highlight.ts`: add one line importing the grammar from `shiki/langs`. Themes work the same way in `codeBlockThemes`; changing the two defaults there restyles every block. The maps are written out on purpose: a template import would make the bundler include every grammar Shiki ships.

### Can I use my own syntax highlighter instead of Shiki?

Yes. The block renders from a plain array of lines, each holding tokens with a light and a dark colour. Map the output of Prism, highlight.js or anything else into `CodeBlockLine[]`, pass it as `lines`, and Shiki is never loaded.

### Does copying include the line numbers?

No. Line numbers and diff glyphs are CSS generated content, not DOM text, so they cannot enter a selection. The copy button also strips any Shiki notation comments from what it copies.
