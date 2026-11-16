## When to use

- Many places and actions people find by typing
- A jump list of favourites and recent pages
- Searching people or files with rich rows

## When not to use

- Two or three actions: show them as [Button](/showcase/button)s
- Picking a value for a form: use [Combobox](/showcase/combobox)

## Notes

- `CommandList` is the list itself, always open; `CommandPalette` puts it in a full-screen sheet that closes before the command runs
- The search matches labels, descriptions and keywords
- Shortcuts show as key caps for a hardware keyboard

## Command: a searchable list of commands

`CommandList` and `CommandPalette` take `groups` of commands; each command runs its own `onSelect`.

### What is it?

A search over grouped commands with glyphs, avatars, badges and shortcuts.

### Why use it?

Typing a few letters reaches any part of the app.

### Features

- **Rows.** A glyph on a tile, or an avatar or icon; a line under the label; a badge or a time after it; key caps.
- **Search.** Labels, descriptions and keywords.
- **Disabled rows.** `disabled` keeps a command visible but unavailable.

## Integrating with other components

Rows take an [Avatar](/showcase/avatar) or a [Badge](/showcase/badge); open the palette from a [Button](/showcase/button) or a header search.

## Frequently asked questions

### Inline or in a sheet?

Inline (`CommandList`) on a screen of its own or a card; in a sheet (`CommandPalette`) when it is opened from anywhere.
