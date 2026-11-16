## When to use

- Status and severity labels in solid, light and outline tones for success, warning, info and errors
- Counts and short tags, such as an unread number or a New marker, sized to the text around them
- Compact chips pairing a label with an icon, a dot, an avatar, a flag or a remove control, or acting as a link

## When not to use

- An action that saves, opens or submits: use [Button](/components/button)
- Help text revealed on hover or focus: use [Tooltip](/components/tooltip)
- A domain status mapped to a fixed tone across the app: use [Status Badge](/components/status-badge)

## Notes

- Prefer the `*-light` variants for statuses in tables and cards: they read without shouting
- `radius="full"` gives a pill in every style
- A badge rendered as a link (`render={<a />}`) or with a remove button is interactive: give it a clear name

## Badge: short labels for status and counts

`Badge` is a small label for a status, a count or a tag. It comes in solid, light and outline tones of every semantic colour, in several sizes, with room for an icon, a dot or an avatar.

### What is Badge?

The chip next to a title or in a table cell: "Active", "3", "New", "Overdue". Variants include `default`, `secondary`, `outline`, and `info`, `success`, `warning`, `destructive`, `focus` and `invert`, each with `-light` and `-outline` forms.

### Why use Badge?

Status should be scannable in a list. A consistent badge — the same colour for the same meaning everywhere — lets people read state at a glance.

### Badge features

- **Tones.** Solid, light and outline forms of each semantic colour.
- **Sizes and radius.** `size` and `radius` (`full` for pills).
- **Extras.** Icons, dots, avatars, flags and a remove button.
- **Polymorphic.** `render` makes it a link.

## Integrating with other components

Badges sit in [Table](/components/table) and [Data Table](/components/data-table) cells, [Card](/components/card) headers, [Tabs](/components/tabs) and [Sidebar](/components/sidebar) items for counts. For app-wide statuses, [Status Badge](/components/status-badge) maps each status to its tone.

## Frequently asked questions

### Which tone should I use?

Light tones for everyday statuses, solid for counts and strong emphasis, outline for neutral tags. Keep one meaning per colour across the app.

### Can a badge be a link?

Yes: `render={<a href="…" />}`. It keeps the badge's look and becomes a real link.

### Is it accessible?

It is text: make sure the words carry the meaning, not only the colour (a dot alone needs a label).
