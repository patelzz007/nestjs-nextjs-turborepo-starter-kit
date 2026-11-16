## When to use

- Showing saved rich text read-only, exactly as people will read it — a broadcast, a note, a description
- Previews beside a [Rich Text Editor](/components/rich-text-editor)

## When not to use

- Editing: use [Rich Text Editor](/components/rich-text-editor)
- Markdown content: the app renders Markdown with its own renderer

## Notes

- It renders the stored JSON document to React elements: no HTML strings, no `dangerouslySetInnerHTML`
- A call-to-action button shows the host its link really goes to (`richTextLinkHost`), so readers see where it leads

## Rich Text View: rich text, read-only

`RichTextView` renders a stored rich-text document — headings, paragraphs, lists, links, tables, code and call-to-action buttons — with the kit's typography. It is the reading side of the [Rich Text Editor](/components/rich-text-editor).

### What is Rich Text View?

A pure renderer from the editor's JSON to elements, styled for reading.

### Why use Rich Text View?

What people write in the editor should look the same where it is read. Rendering from structured JSON, not HTML, is also safe by construction.

### Rich Text View features

- **All editor content.** Marks, blocks, tables, code and calls to action.
- **Safe rendering.** From JSON, never from HTML strings.
- **Honest links.** Call-to-action buttons show their destination's host.

## Integrating with other components

Pair it with [Rich Text Editor](/components/rich-text-editor) for a live preview, and put it in a [Card](/components/card) or a [Message](/components/message) where the content is read.

## Frequently asked questions

### Is it safe to render user content?

Yes: it renders known node types from JSON as React elements; there is no HTML to inject.

### Is it accessible?

It renders semantic elements — headings, lists, tables, links — so the structure is navigable.
