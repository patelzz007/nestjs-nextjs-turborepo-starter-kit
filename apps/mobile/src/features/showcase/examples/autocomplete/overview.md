## When to use

- Free text with suggestions: a tag, a city, a name
- A search box that offers matches as people type
- A lookup against a server with a status line

## When not to use

- A value that must be one of the options: use [Combobox](/showcase/combobox)
- A short list to pick from: use [SelectField](/showcase/select)
- A plain field with no suggestions: use [Input](/showcase/input)

## Notes

- The text is the value; a suggestion only fills it in
- `filter={null}` leaves filtering to the caller (a server lookup)

## Autocomplete: suggestions as you type

`Autocomplete` is a text field that lists matching suggestions under it, with groups, a highlighted first match, clear and open-list buttons, and a status line.

### What is it?

A field and its suggestions.

### Why use it?

Suggestions save typing and fix spelling, without forbidding new values.

### Features

- **Filtering.** Every word matches, accents ignored; or the caller's.
- **Highlight.** `autoHighlight` and return.
- **Buttons.** `showClear`, `showTrigger`.
- **Status.** `status` for async lookups.
- **Sizes.** `sm`, `md`, `lg`.

## Integrating with other components

For a value that must come from the list, use [Combobox](/showcase/combobox).

## Frequently asked questions

### Autocomplete or Combobox?

Autocomplete keeps whatever is typed; a [Combobox](/showcase/combobox) picks from its options only.

### How do I search a server?

Pass `filter={null}`, fetch as the text changes, and show progress and counts in `status`.
