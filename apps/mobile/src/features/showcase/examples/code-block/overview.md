## When to use

- Code people read, copy or review: snippets, diffs, logs, terminal output

## When not to use

- Editing code: hand it to an editor
- Prose with a little code: use RichTextView

## Notes

- Colour comes from the caller: the showcase colours snippets with Shiki at generate time; the phone runs no highlighter
- Long lines scroll sideways (or wrap on request); the gutter stays put

## CodeBlock

`CodeBlock` draws code in the code face, with a header, line numbers, marks, highlights, notes, folds, selection and a copy button.

### Features

- **Header and footer** slots: titles, tabs, badges, actions.
- **Line marks**: added, removed, highlight, error, warning.
- **Focus**, **selection** and **highlights** (words and search matches).
- **Notes** under lines and **folding** regions.
- **Gutter actions** and **terminal colours** (`ansiToCodeLines`).

## Integrating with other components

Put it in a Message for chat answers, a Card for reviews, a Frame with tabs for several files; copy with expo-clipboard.

## Frequently asked questions

### Where do the colours come from?

From the caller: each line's tokens carry a role (keyword, string…) drawn with the theme's code colours. The showcase colours its snippets with Shiki when it is generated.

### Can it force a dark look?

Not on a phone: code colours follow the app's theme.
