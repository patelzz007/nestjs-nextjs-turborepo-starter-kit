## When to use

- Composing formatted text a server stores and sends: broadcasts, announcements, notes

## When not to use

- Plain messages: use a Textarea
- Code: use a code editor

## Notes

- Writes the same document JSON as the web's Tiptap editor (`RichTextDocument`, validated by `RichTextDocumentSchema`)
- Each block is its own text field drawing its formatting; Enter splits a block, Backspace at its start joins it to the one before

## RichTextEditor

`RichTextEditor` is a toolbar editor for what a broadcast may hold, producing the shared document JSON.

### Features

- **Marks**: bold, italic, underline, strikethrough, inline code, https links.
- **Blocks**: headings, bulleted and numbered lists, quotes, code blocks, a divider, one button.
- **Undo and redo**.
- **Compact** toolbar.

## Integrating with other components

Pair it with RichTextView for a preview; validate with `RichTextDocumentSchema` before saving.

## Frequently asked questions

### Can it edit tables and images?

Not on a phone yet: a loaded document keeps them as they were and shows them; edit them on the web.

### Are links checked?

Yes: only full https:// addresses are accepted, as on the web and the server.
