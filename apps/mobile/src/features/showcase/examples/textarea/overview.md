## When to use

- Several lines of text: a message, a description, feedback
- A bio or a note with a character count
- Free text a person writes, not picks

## When not to use

- One line: use [Input](/showcase/input)
- Formatted text with headings and lists: use [RichTextEditor](/showcase/rich-text-editor)
- A composer with a toolbar: use [InputGroup](/showcase/input-group) with `multiline` and a `footer`

## Notes

- It grows with its text from its starting height (`sm`, `md`, `lg`)
- Inside a `Field` it takes the field's label and state

## Textarea: several lines of text

`Textarea` is an `Input` that wraps, starts at the top and is taller, with the same controlled contract and states.

### What is it?

A multi-line text field.

### Why use it?

Longer text needs room to read back what was typed.

### Features

- **Three heights.** `sm`, `md`, `lg`, growing with the text.
- **States.** Disabled, loading, invalid.
- **Counts.** `maxLength` with a count in the field's `labelTrailing`.

## Integrating with other components

Wrap it in a [Field](/showcase/field); for a toolbar under it use [InputGroup](/showcase/input-group).

## Frequently asked questions

### How do I show how much is left?

Pass `maxLength` and show the count in the field's `labelTrailing`; turn it to the warning colour near the end.
