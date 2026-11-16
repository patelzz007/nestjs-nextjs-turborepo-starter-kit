## When to use

- Shortcuts to actions on something on screen: a message, a file, a photo
- The phone form of a desktop's right click

## When not to use

- The only way to reach an action: put it on screen too
- Actions from a visible button: use [DropdownMenu](/showcase/dropdown-menu)

## Notes

- A long press opens the actions in a bottom sheet, with the same rows as DropdownMenu
- Screen readers get it as the area's "Show actions" action, named in its hint
- Checkbox items keep the sheet open; every other item closes it

## ContextMenu: actions on a long press

`ContextMenu` wraps an area; a long press on it opens `items`.

### What is it?

A controlled menu over an area: `items` in, `onSelect(value)` out.

### Why use it?

It keeps actions close to what they act on without cluttering the screen.

### Features

- **Every row kind.** Icons, shortcuts, checkboxes, radios, groups, submenus.
- **Header and footer.** Say what the menu acts on.
- **Screen readers.** A named accessibility action opens it.

## Integrating with other components

Wrap a [Card](/showcase/card), a [Bubble](/showcase/bubble) or an image; it works inside a [Dialog](/showcase/dialog).

## Frequently asked questions

### How do screen reader users open it?

Through the area's actions menu ("Show actions"); the hint says a long press opens it.
