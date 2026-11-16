## When to use

- Options that form a tree people walk: region, country, city; team, member; folder, file
- Long hierarchies where search across levels finds a leaf faster than drilling
- Picking several leaves, or whole branches at once (`cascade`)

## When not to use

- A flat list: use [Select](/showcase/select) or [Combobox](/showcase/combobox)
- Two or three options: use [RadioGroup](/showcase/radio-group) or [ToggleGroup](/showcase/toggle-group)
- Browsing and acting on a tree (rename, move): use [Tree](/showcase/tree)

## Notes

- On a phone the default is `drill`: one level at a time with a way back; `columns` and `tree` suit wider screens and shallow trees
- Search writes each hit's path under it, so repeated names stay apart
- Nodes carry no payload: keep extra data in your own map keyed by `value`

## Cascader: a picker for a tree

`Cascader` is a field that opens `CascaderPanel` in a bottom sheet and writes the picked path; `CascaderPanel` can also sit on a screen or a card.

### What is it?

A controlled picker over nested (or flat, parent-pointer) nodes that reports the picked value, its node and its path.

### Why use it?

Deep option sets do not fit a flat list. Drilling keeps each level short, and search reaches any level at once.

### Features

- **Three layouts.** `drill`, `columns` and `tree`.
- **One or several.** `multiple`, `max`, and `cascade` for whole branches.
- **What can be picked.** `selectable`: leaves, any node, or your rule.
- **Search.** The shown level, everything under it, or the whole tree (`searchScope`).
- **Loading on demand.** `getChildren` with loading, error and Retry states.
- **Rich rows.** `icon`, `description`, `count`, `group`, `renderLabel` and `renderTrailing`.
- **The field's text.** `display` (path, leaf, count), `collapse`, `maxSegments`, or `renderValue`.
- **Any language.** Every word in `labels`, plurals included.

## Integrating with other components

Rows take an [Avatar](/showcase/avatar), an [IconTile](/showcase/icon-tile) or a [Badge](/showcase/badge); the footer takes a [Button](/showcase/button) or a [DropdownMenu](/showcase/dropdown-menu).

## Frequently asked questions

### Can a branch be picked, not only a leaf?

Yes: `selectable="any"`, or a function that decides per node.

### My data is flat rows with a parent id. Do I nest it first?

No: pass `getParent`, or turn rows into nodes with `cascaderTreeFromRows`.

### How do I load a level from the server?

Mark the branch `hasChildren` and pass `getChildren`, which returns a promise of its children. A failed load shows Retry.
