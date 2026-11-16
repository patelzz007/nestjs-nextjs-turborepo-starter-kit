## When to use

- Search and filter fields that suggest matching options while people type
- People and record look-ups, grouped by team or fetched from a server as the query changes
- Form fields whose typed or picked text is validated with the rest of the form on submit

## When not to use

- A selection that stores the chosen option rather than typed text, or several as chips: use [Combobox](/components/combobox)
- Options nested in levels that people drill into one at a time: use [Cascader](/components/cascader)
- A palette of app actions and keyboard shortcuts, often opened in a dialog: use [Command](/components/command)

## Notes

- `value` and `onValueChange` carry the input's text as a string; picking an item only fills that text and stores no item object
- `AutocompleteList` takes a render function, so the file that renders it needs `"use client"`
- Pass `filter={null}` and filter yourself when results come from a server

## Autocomplete: a text field that suggests

`Autocomplete` is a free-text input with a list of suggestions that narrows as people type. It is built on Base UI's autocomplete: the input keeps focus while the arrow keys move a highlight through the list, and Enter or a click fills the input with the chosen item.

### What is Autocomplete?

A search box with help. Unlike a [Combobox](/components/combobox), the value is the text in the field — people can pick a suggestion or keep typing something that is not in the list. Groups, separators, an empty state, a status line for async results, a clear button and a trigger button are all composable parts.

### Why use Autocomplete?

Search fields, tag inputs and look-ups are faster with suggestions, but they must still accept any text. `Autocomplete` gives you the suggestion list, keyboard navigation and screen-reader announcements without turning the field into a strict picker.

### Autocomplete features

- **Free text.** The value is whatever is typed; suggestions only help.
- **Built-in or custom filtering.** Base UI's locale-aware matching, or `filter={null}` and your own (for server search).
- **Groups and separators.** `AutocompleteGroup`, `AutocompleteGroupLabel` and `AutocompleteSeparator`.
- **Async.** `AutocompleteStatus` announces "Searching…" and result counts.
- **Clear and trigger buttons.** `AutocompleteClear` empties the field; `AutocompleteTrigger` opens the list.
- **Sizes.** `size` on `AutocompleteInput`: `sm`, `default` or `lg`.

## Integrating with other components

Put it in a [Field](/components/field) for a label and an error, and validate its text with the rest of the form. Show avatars or icons in items with [Avatar](/components/avatar), and use [Kbd](/components/kbd) for a focus shortcut in the field.

## Frequently asked questions

### Autocomplete or Combobox?

Autocomplete when the answer is text and suggestions are a convenience (search, tags people can invent). [Combobox](/components/combobox) when the answer must be one of the options.

### How do I load suggestions from a server?

Keep the query in state from `onValueChange`, fetch with TanStack Query, pass the results as `items` with `filter={null}`, and show progress in `AutocompleteStatus`.

### How do I group suggestions?

Pass `items` as groups (`{ group, items }`) and render each with `AutocompleteGroup`, `AutocompleteGroupLabel` and `AutocompleteCollection`.

### Is it accessible?

The input is a combobox that controls a listbox; the highlighted option is exposed with `aria-activedescendant`, and `AutocompleteStatus` is a live region. Name the input with a label.
