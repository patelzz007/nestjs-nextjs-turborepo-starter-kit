## When to use

- Form fields that pick one option by typing to search, such as a framework, a timezone or a country
- Fields holding several picks as chips, such as frameworks or team members with avatars
- Task property pickers opened from a button, such as status, priority, assignee, labels, team or due date

## When not to use

- A short fixed list chosen from a button, with no typing to narrow it: use [Select](/components/select)
- A free-text field that suggests matches but keeps whatever was typed: use [Autocomplete](/components/autocomplete)

## Notes

- Rows filter as people type only when `ComboboxCollection` renders them from `items`; static `ComboboxItem` children always stay listed
- For object items, set `itemToStringLabel` so search matches the label; `itemToStringValue` sets only the submitted value
- In multiple mode, anchor the popup to `ComboboxChips` with `useComboboxAnchor`, so it opens under the whole chip field

## Combobox: search a list and pick

`Combobox` is a searchable select: people type to filter the options, then pick one — or several, shown as chips. It is built on Base UI's combobox, so the input keeps focus while the arrow keys move a highlight, and the chosen option, not the typed text, is the value.

### What is Combobox?

An input plus a filtered listbox. Unlike [Autocomplete](/components/autocomplete), the value must be one of the options. It can live in a form field, inside a [Popover](/components/popover) opened from a button (a property picker), or in a [Dialog](/components/dialog).

### Why use Combobox?

Long lists — countries, users, tags — are slow to scroll. Typing two or three letters is faster, and chips make several picks easy to review and remove.

### Combobox features

- **Single or multiple.** `multiple` with `ComboboxChips`, `maxSelected` and `maxChips`.
- **Groups and separators.** Labelled sections of options.
- **Create.** `ComboboxCreate` adds a "Create …" row for a value not in the list.
- **Async-friendly.** `debounceMs`, `loading` and `ComboboxLoading`.
- **Clear.** `ComboboxClear` and `ComboboxClearAll`.
- **Shortcut.** `shortcut` focuses it from the keyboard.

## Integrating with other components

Wrap it in a [Field](/components/field). Show [Avatar](/components/avatar)s or a [Badge](/components/badge) in options and chips; open it from a [Button](/components/button) in a [Popover](/components/popover) for status and assignee pickers.

## Frequently asked questions

### Combobox or Autocomplete?

Combobox when the answer must be one of the options; [Autocomplete](/components/autocomplete) when any text is acceptable and suggestions only help.

### Can people create options that are not in the list?

Yes: render `ComboboxCreate` while the query matches nothing, and add the new option in its handler.

### Does it handle hundreds of options?

Yes. Filtering is fast for hundreds; for thousands, filter on the server with `debounceMs` and `loading`, or virtualise the list.

### Can options show avatars and metadata?

Yes: `ComboboxItem` takes any content. Keep the text the search matches in `itemToStringLabel`.
