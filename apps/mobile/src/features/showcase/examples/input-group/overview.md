## When to use

- A field with a glyph or a short text inside it: a search glass, "https://", a currency
- A field with an action at its end: copy, clear, send, show the password
- A composer: a field with rows above or below it inside one border (attachments, a toolbar, a count)

## When not to use

- A plain field with nothing inside: use [Input](/showcase/input)
- Buttons beside a field rather than inside it: use [ButtonGroup](/showcase/button-group)
- A field whose suggestions list under it: use [Autocomplete](/showcase/autocomplete)

## Notes

- Addons are decorative; the field is still named by its label
- `header` and `footer` move the border round the whole group, the text sitting in it borderless

## InputGroup: a field with addons

`InputGroup` is an `Input` with addons inside its box — glyphs, short texts, any element before or after the text — and, with `header` and `footer`, rows above and below it inside the same border.

### What is it?

A field and what belongs to it, in one outline.

### Why use it?

Prefixes, units and actions read as part of the field when they sit inside it, and save the room separate controls would take.

### Features

- **Text and glyph addons.** `leadingIcon`, `leadingText`, `trailingIcon`, `trailingText`.
- **Any element.** `leading` and `trailing`: a menu, a key cap, a button, an avatar.
- **Rows.** `header` and `footer` inside the border.
- **Everything Input has.** Sizes, states and keyboards.

## Integrating with other components

Put buttons from [Button](/showcase/button) or [IconButton](/showcase/button) and menus from [DropdownMenu](/showcase/dropdown-menu) in its slots; wrap it in a [Field](/showcase/field) for a label.

## Frequently asked questions

### How do I make a clear button?

Put an `IconButton` in `trailing`, shown only while there is text, that sets the value to "".

### Can it hold several lines?

Yes: pass `multiline`; a `footer` then makes a composer with its toolbar.
