## When to use

- Shortcut hints beside an action's name, in a tooltip or inside a search field
- Single keys and key combinations, as loose caps, a group of caps or keys with an icon
- Reference lists that pair each command with its key chord

## When not to use

- A searchable palette of actions picked with the keyboard: use [Command](/components/command)
- A status, a tag or a count shown as a small chip, not a key to press: use [Badge](/components/badge)
- A full shortcuts panel with search and sections: compose a [Sheet](/components/sheet) with a list of `KbdGroup`s

## Notes

- `Kbd` only draws the label: bind each shortcut with your own keydown handler (the kit's `useFocusShortcut` focuses a field)
- `Kbd` turns off pointer events and text selection, so it cannot be clicked, used as a hover trigger or selected

## Kbd: keyboard shortcuts and commands

`Kbd` renders a key cap with the semantic `<kbd>` element; `KbdGroup` renders a chord — a `<kbd>` of `<kbd>`s, as HTML marks up a key combination. Both inherit the colours of where they sit, so a key inside a tooltip turns to the tooltip's palette on its own.

### What is Kbd?

A label for a key the reader can press: `⌘`, `K`, `Esc`, `Enter`. It does nothing on its own — it tells people what to press — so it pairs with a handler that actually listens for the key.

### Why use Kbd?

Shortcuts are only useful once people discover them. Showing the key next to the action — in a button, a menu item, a tooltip or a search field — teaches it in context, and the `<kbd>` element tells assistive technology and search engines that the text is a key.

### Kbd features

- **Semantic markup.** `<kbd>`, and `<kbd>` of `<kbd>`s for a chord.
- **Icons.** Lucide icons such as `Command` or `ArrowUp` size themselves to the cap.
- **Context-aware colours.** Inside a [Tooltip](/components/tooltip) the caps switch to the tooltip's palette.
- **Inert.** No pointer events or text selection, so it never steals a click from the control it sits in.

## Integrating with other components

Show a shortcut at the end of a [Button](/components/button) or a [Dropdown Menu](/components/dropdown-menu) item, inside a [Tooltip](/components/tooltip), or as a hint in an [Input Group](/components/input-group) search field. A [Command](/components/command) palette lists commands with their chords.

## Frequently asked questions

### Should I use `kbd` or just styled text?

`kbd`. The element tells screen readers and search engines that the text is a key; `Kbd` gives it the right look as well.

### How do I show Mac and Windows shortcuts?

Detect the platform once on the client and render the matching key (`⌘` or `Ctrl`). Showing both ("⌘/Ctrl K") works but clutters; one platform-correct chord reads better.

### Where should shortcut hints go?

Beside the action in menus and the command palette, and in the tooltip of a toolbar button. Avoid putting them in every button label: keep labels for the action and hints for the place people look when they want to go faster.

### Is it accessible?

The `<kbd>` element is announced as text, which is right: the hint is prose. Make sure the shortcut actually works, and do not rely on the hint alone to explain an action.
