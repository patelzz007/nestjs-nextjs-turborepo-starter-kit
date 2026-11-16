## When to use

- Picking one option from five or more, where showing them all at once would crowd the screen
- Options that need more than a name: a description, an avatar, a status dot, a badge
- Picking several options from a list that does not fit on screen (`MultiSelectField`)

## When not to use

- Two or three options: use [RadioGroup](/showcase/radio-group), [ToggleGroup](/showcase/toggle-group) or [Switch](/showcase/switch)
- A list people find by typing (countries, people, repositories): use [Combobox](/showcase/combobox)
- A short plain list where the platform's own picker is wanted: use [NativeSelect](/showcase/native-select)
- Commands rather than values: use [DropdownMenu](/showcase/dropdown-menu)

## Notes

- On a phone the options open in a sheet that slides up from the bottom, not a dropdown under the field
- The sheet's list is virtualized: a list of thousands draws only the rows on screen
- `MultiSelectField` keeps its sheet open while options are ticked; the sheet's close button or the backdrop closes it

## SelectField: a labelled dropdown in a sheet

`SelectField` shows the chosen option in a field; pressing it opens a sheet of options. It is controlled: `value` in, `onChange(next)` out.

### What is it?

A form field whose value is one of a list of options. `MultiSelectField` is the same field for several options at once.

### Why use it?

It keeps a long list out of the way until it is needed, and gives every option room for a description, an avatar or a badge.

### Features

- **Rich options.** Each option may carry a description, a `leading` element (an avatar, a flag, a dot, a glyph) and a `trailing` one (a badge, an offset).
- **Groups.** Options with a `group` are listed under its heading; `groupSeparators` rules the groups apart.
- **Search.** `searchable` adds a search box that filters by label and description; `autoHighlight` lets the keyboard's Return key pick the first match.
- **A custom field.** `prefix` ("Status:"), `renderValue` (a badge in place of the label), `chevronIcon`, and a clear button with `onClear`.
- **Several at once.** `MultiSelectField` with removable chips, static chips, a summary line or the caller's own drawing (`renderValues`).
- **Sizes, variants and states.** `md` and `sm`; `default`, `muted` and `ghost`; disabled, loading and invalid.

## Integrating with other components

Put it in a form with a [Button](/showcase/button), beside an [InputGroup](/showcase/input-group) as a filter, or in a [Dialog](/showcase/dialog): its sheet rises over the dialog. Options can lead with an [Avatar](/showcase/avatar) or trail a [Badge](/showcase/badge).

## Frequently asked questions

### Why a sheet and not a dropdown?

A dropdown under a field on a phone covers the keyboard, is hard to hit with a thumb and runs off the bottom of the screen. A sheet is in thumb reach, scrolls and has room for search.

### How do I clear the choice?

Pass `onClear`: a clear button takes the chevron's place while a value is chosen, and you set the value back to `null`.

### How do I show something other than the label in the field?

Pass `renderValue`, a function from the chosen option to what the field draws. The field's accessible name still reads the option's label.

### Can the options be loaded from the server?

Yes: pass `loading` while they load (the field shows a spinner and does not open), then the options.
