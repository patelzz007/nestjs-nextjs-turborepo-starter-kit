## When to use

- Keyboard-driven palettes in a dialog that search actions, pages and settings from one input
- Search lists of files, team members, favourites and recent pages that narrow as people type
- Inline menus kept open in a card or a panel, with grouped rows and shortcut hints

## When not to use

- A form field that keeps the option people pick, such as a country or an assignee: use [Combobox](/components/combobox)
- A menu opened from a button with a few actions and no search: use [Dropdown Menu](/components/dropdown-menu)

## Notes

- Give each `CommandItem` an `onSelect`: pressing Enter or clicking a row runs it, and nothing runs without it
- `CommandList` stops at `max-h-72` and scrolls its rows inside itself past that height
- `CommandDialog` wraps a command list in a dialog for a ⌘K palette

## Command: a searchable command palette

`Command` is a search box over a list of actions, filtered as people type, walked with the arrow keys and run with Enter or a click. The kit builds it on its own headless `command-primitive` — the WAI-ARIA combobox pattern, with focus kept in the input — and `CommandDialog` turns it into a ⌘K palette.

### What is Command?

The palette behind "⌘K": one input that finds pages, people, files and actions. It also works inline, as a filterable menu inside a card or a popover.

### Why use Command?

Keyboard users and power users navigate faster by typing. A palette makes every action reachable from one place, with groups, shortcuts and recent items to speed up the common ones.

### Command features

- **Filtering.** Locale-aware matching on each item's `value` and `keywords`, or `shouldFilter={false}` to filter yourself.
- **Groups and separators.** Headed sections that hide when nothing in them matches.
- **Shortcuts.** `CommandShortcut` for the key hint.
- **Dialog or inline.** `CommandDialog` for a palette; `Command` anywhere else.
- **Empty state.** `CommandEmpty` while nothing matches.

## Integrating with other components

Open `CommandDialog` with a global ⌘K handler, show [Kbd](/components/kbd) hints in items, and put an inline `Command` in a [Popover](/components/popover) for a searchable menu. The app's own command palette is built from it.

## Frequently asked questions

### Command palette or combobox?

A palette runs actions and navigates; a [Combobox](/components/combobox) stores a chosen value in a form.

### How do I open it with ⌘K?

Listen for `keydown` with `metaKey` (or `ctrlKey`) and `k` on the document, prevent the default, and toggle the `open` state of `CommandDialog`.

### Can it nest subcommands?

Keep a "page" in state: selecting an item switches the list to that page's items, and Backspace on an empty input goes back.

### Is it accessible?

Yes: the input is a `combobox` that controls a `listbox`; the highlighted option is exposed with `aria-activedescendant` while focus stays in the input.
