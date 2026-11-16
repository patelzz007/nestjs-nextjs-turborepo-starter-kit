## When to use

- Showing a stored rich-text document: a broadcast body, an announcement

## When not to use

- Editing: use RichTextEditor

## Notes

- Draws the shared `RichTextDocument`: headings, marks, links, lists, quotes, tables, code, images and the one button
- Tables scroll sideways; code blocks copy; the button shows the domain it opens

## RichTextView

`RichTextView` draws a stored rich-text document, read only.

### Features

- **Every allowed node**.
- **Links** opened by the caller (`onOpenLink`).
- **Copyable** code blocks.

## Integrating with other components

Show it in an inbox or a detail screen; open links with `Linking.openURL`.

## Frequently asked questions

### Why does the button show a domain?

So people see where it leads before they press it: a broadcast's link could go anywhere.
