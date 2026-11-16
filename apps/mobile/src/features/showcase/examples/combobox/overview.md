## When to use

- Picking from a long list people find by typing: countries, timezones, people, repositories
- Assigning a status, a priority, a lead or a team, where the search doubles as a quick filter
- Picking several values from a long list (`MultiCombobox`)

## When not to use

- A short list people can read at a glance: use [SelectField](/showcase/select) or [RadioGroup](/showcase/radio-group)
- Free text with suggestions, where any value is allowed: use [Autocomplete](/showcase/autocomplete)
- Running commands: use [Command](/showcase/command)

## Notes

- On a phone the search lives in the sheet that opens from the field, focused at once so the keyboard is up
- It is `SelectField` with the search always on: everything a select takes (rich rows, groups, a clear button, `renderValue`) works here too
- `autoHighlight` lets the keyboard's Return key pick the first match

## Combobox: a searchable select

`Combobox` shows the chosen option in a field; pressing it opens a sheet with a focused search box over the options. `MultiCombobox` picks several.

### What is it?

A select whose options are found by typing.

### Why use it?

Scrolling a list of a hundred rows on a phone is slow; typing three letters is not.

### Features

- **Focused search.** The keyboard is up as the sheet opens; the list narrows on label and description.
- **Rich rows.** Avatars, flags, glyphs and badges before or after each option, with a description line.
- **Groups.** Headings and, with `groupSeparators`, rules between groups.
- **Several at once.** `MultiCombobox` with removable or static chips, or the caller's own summary (`renderValues`).
- **A custom field.** Its own glyph (`leadingIcon`), another chevron, a clear button, and a borderless `ghost` variant.

## Integrating with other components

Use it in a form with a [Button](/showcase/button), in a [Dialog](/showcase/dialog), with [Avatar](/showcase/avatar) or [IconTile](/showcase/icon-tile) rows, or next to a [DateField](/showcase/date-picker) for a custom date.

## Frequently asked questions

### Combobox or Autocomplete?

A combobox's value is always one of its options. An autocomplete's value is free text, and the options are only suggestions.

### Why does the keyboard open at once?

A combobox is for finding by typing, so the search box is focused as the sheet opens. Use `SelectField` when people should scan the list first.

### Can a row do something other than pick a value?

Yes: `onChange` is yours. The assignee example treats its Invite row as an action and leaves the value as it was.
