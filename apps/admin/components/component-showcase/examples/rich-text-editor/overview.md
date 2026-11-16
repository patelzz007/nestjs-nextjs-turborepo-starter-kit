## When to use

- Composing long formatted content: headings, lists, links, tables, code and calls to action
- Writing a message while seeing exactly how it will look, beside a live preview

## When not to use

- Plain multi-line text: use [Textarea](/components/textarea)
- Showing saved rich text read-only: use [Rich Text View](/components/rich-text-view)

## Notes

- Create the editor with `useRichTextEditor` and pass it to `RichTextEditor`; it renders on the client only
- The value is a Tiptap JSON document; store it as is and render it with `RichTextView`
- Compose the toolbar from the parts you need: `RichTextEditor.Toolbar`, `ControlsGroup`, `Bold`, `Link`, `Table`…

## Rich Text Editor: formatted writing, on Tiptap

`RichTextEditor` is a Tiptap editor with a toolbar built from kit controls. You choose the controls — undo and redo, headings, bold, italic, lists, links, code, tables, a call-to-action button — and the editor emits a JSON document.

### What is Rich Text Editor?

A compound component: `RichTextEditor` around `RichTextEditor.Toolbar` (with `ControlsGroup`s of controls), `RichTextEditor.Content` (the editable area) and an optional `Footer`. `useRichTextEditor` creates the editor with the app's extensions.

### Why use Rich Text Editor?

Broadcasts, notes and descriptions need formatting. A shared editor keeps the toolbar, the shortcuts and the stored format the same everywhere, and its output renders identically in `RichTextView`.

### Rich Text Editor features

- **Composable toolbar.** Only the controls you add.
- **Marks and blocks.** Bold, italic, underline, strike, code; headings, lists, quotes, rules, code blocks.
- **Links, tables and calls to action.**
- **Undo and redo.** With the standard shortcuts.
- **JSON output.** Stored and rendered without HTML.

## Integrating with other components

Render the stored document with [Rich Text View](/components/rich-text-view), wrap the editor in a [Field](/components/field) for a label and an error (`invalid`), and size images with [Image Resizer](/components/image-resizer).

## Frequently asked questions

### What format is the content?

Tiptap's JSON (`RichTextDocument`): structured, safe to store, and rendered without `dangerouslySetInnerHTML`.

### Is it accessible?

The content is a labelled editable region, toolbar controls are named toggle buttons with their shortcuts, and the standard shortcuts (⌘B, ⌘I, ⌘Z) work.
