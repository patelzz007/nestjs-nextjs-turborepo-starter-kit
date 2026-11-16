## When to use

- Editor formatting controls that stay pressed, such as bold, italic, underline and strikethrough
- Reaction and save controls, such as like, repost, share and bookmark, with or without a count
- Media and app controls with an on and an off state, such as mute, pin to sidebar or a notifications bell

## When not to use

- A one-off action such as Save, Send or Delete that keeps no pressed state: use [Button](/components/button)
- Related actions joined edge to edge into one strip, such as playback or zoom controls: use [Button Group](/components/button-group)
- A set of options read as one value and crossed with the arrow keys, such as text alignment: use [Toggle Group](/components/toggle-group)

## Notes

- The pressed state lives inside each `Toggle` unless you control it: read `onPressedChange` (or pass `pressed`) to persist it
- `aria-label` wins over the visible text for screen readers, so update both when you relabel a toggle

## Toggle: two-state buttons for on and off

`Toggle` is a button that stays pressed. It is built on Base UI's toggle, so it renders a native `button` with `aria-pressed`, and the pressed look comes from that attribute — the state screen readers hear is the state people see.

### What is Toggle?

A control for a single on/off option that applies immediately: bold, mute, bookmark, follow. Like a [Switch](/components/switch) it flips a boolean, but it looks like a button and usually lives in a toolbar or beside content, not in a settings list.

### Why use Toggle?

Formatting bars, reaction rows and media controls all need buttons that remember being pressed. `Toggle` gives them the pressed styling, the `aria-pressed` semantics and a controlled or uncontrolled state without any wiring of your own.

### Toggle features

- **Controlled or uncontrolled.** `pressed` with `onPressedChange`, or `defaultPressed` and let it manage itself.
- **Two looks.** `default` (a soft fill when pressed) and `outline` (bordered).
- **Sizes.** `sm`, `default` and `lg`, for text, icons or both.
- **Loading and disabled.** `loading` disables it while the change is saved; `disabled` dims it.
- **Icon swaps and counts.** Change the icon, the label or a count with the pressed state, as the reaction examples do.

## Integrating with other components

Line toggles up in a toolbar, or use [Toggle Group](/components/toggle-group) when they form one set. Name icon-only toggles with an `aria-label` and a [Tooltip](/components/tooltip), and show a count beside a reaction toggle with a [Badge](/components/badge) or plain text.

## Frequently asked questions

### Toggle, Switch or Checkbox?

[Checkbox](/components/checkbox) for choices in a form that are submitted together, [Switch](/components/switch) for a setting that applies at once, and `Toggle` for a button-shaped control in a toolbar or beside content, such as bold or mute.

### How do I control a toggle?

Pass `pressed` and `onPressedChange`: `<Toggle pressed={isBold} onPressedChange={setIsBold}>`. Leave both out and use `defaultPressed` for an uncontrolled toggle.

### How do I make an icon-only toggle accessible?

Give it an `aria-label`: `<Toggle aria-label="Bold"><Bold /></Toggle>`. Screen readers announce the name and whether it is pressed.

### Can I disable a toggle?

Yes: `disabled`. Pair it with a [Tooltip](/components/tooltip) that says why, since a disabled control cannot explain itself.

### Toggle or Toggle Group for several options?

Use separate toggles for independent on/off options, and [Toggle Group](/components/toggle-group) when the options form one value — one alignment, one view — or a set to pick several from.
