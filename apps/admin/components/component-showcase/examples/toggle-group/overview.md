## When to use

- Editor formatting and alignment controls kept as one set, such as bold, italic and underline, or left, centre and justify
- View, column-layout and theme switchers where the pressed item holds the current choice
- Short option rows for a time range, a status, a sort order, a billing period, channels or device settings

## When not to use

- Related actions such as export, zoom or playback joined in one strip with no pressed state: use [Button Group](/components/button-group)
- A single on/off control such as bookmark or mute that stands on its own: use [Toggle](/components/toggle)
- Labelled settings in a list, each flipped on or off beside its own text: use [Switch](/components/switch)

## Notes

- The group picks one item unless `multiple` is set, and its `value` and `defaultValue` are always arrays
- Pressing the pressed item again releases it, so even a single-choice group can end with nothing picked; guard against an empty array if a choice is required
- `spacing={0}` joins the items into one segmented control; the default leaves a small gap

## Toggle Group: one choice, or several, from a set

`ToggleGroup` holds a set of `ToggleGroupItem`s and tracks which are pressed. It is built on Base UI's toggle group, so arrow keys move between items and the pressed ones carry `aria-pressed`.

### What is Toggle Group?

A row (or column) of toggles that together hold one value: a text alignment, a view mode, a time range — or, with `multiple`, a set of marks such as bold and italic. Each item shares the group's `variant` and `size`, so the set always looks consistent.

### Why use Toggle Group?

Segmented pickers are everywhere in dashboards: day / week / month, list / grid, light / dark. `ToggleGroup` gives them roving keyboard focus, pressed semantics and a single `value` to read, instead of wiring several toggles together by hand.

### Toggle Group features

- **Single or multiple.** One pressed item by default; `multiple` allows several.
- **Controlled or uncontrolled.** `value` with `onValueChange`, or `defaultValue`.
- **Joined or spaced.** `spacing={0}` renders a segmented control; any other value sets the gap.
- **Variants and sizes.** `default` or `outline`, and `sm`, `default` or `lg`, applied to every item.
- **Horizontal or vertical.** `orientation` sets the layout and the arrow keys.

## Integrating with other components

Put a toggle group in a [Card](/components/card) header to switch a chart's range, or above a [Data Table](/components/data-table) to switch views. Name icon-only items with `aria-label` and a [Tooltip](/components/tooltip). For actions with no pressed state, use [Button Group](/components/button-group).

## Frequently asked questions

### Toggle Group, Radio Group or Checkbox?

`ToggleGroup` for compact, button-shaped choices in toolbars and headers; [Radio Group](/components/radio-group) for a labelled single choice in a form; [Checkbox](/components/checkbox) for several labelled choices in a form.

### How do I allow several pressed items?

Pass `multiple`. `value` is an array either way, so `onValueChange` always receives the list of pressed values.

### How do I keep one item always pressed?

Ignore a change to an empty array in `onValueChange`: `onValueChange={(next) => { if (next.length > 0) setValue(next); }}`.

### Can I disable one item?

Yes: set `disabled` on that `ToggleGroupItem`, or on the group to disable all of them.

### What does it announce?

Each item is a button with `aria-pressed`; the group renders `role="group"`. Give the group an `aria-label` that names the choice.
