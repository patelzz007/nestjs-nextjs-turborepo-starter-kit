## When to use

- Quick edits and settings opened from a button, such as dimensions, switches or a volume slider
- Previews opened by a click, such as a person's card, a template image with actions, or a feature pitch
- Inline details and short guides, such as exact times behind a relative date, or a stepped tour

## When not to use

- A task that must block the page and hold focus until it is answered: use [Dialog](/components/dialog)
- A one-line label for an icon button: use [Tooltip](/components/tooltip)
- A preview that opens on hover, not on click: use [Hover Card](/components/hover-card)

## Notes

- Compose `PopoverTrigger` through `render`, e.g. `<PopoverTrigger render={<Button />}>`
- `PopoverContent` is `w-72` whatever it holds: size it with a width class such as `w-auto` or `w-96`
- `PopoverTitle` names the popup for screen readers; add one, or an `aria-label` on the content

## Popover: rich content attached to a control

`Popover` opens a floating panel next to its trigger on click, built on Base UI's popover. It positions itself against the trigger, flips to stay on screen, and closes on Escape or an outside click — but, unlike a dialog, it leaves the page usable.

### What is Popover?

A small, non-modal panel for content tied to one control: a form, settings, a profile card, a date picker, a step of a tour. `PopoverHeader`, `PopoverTitle` and `PopoverDescription` give it structure when it needs one.

### Why use Popover?

Some details and edits are too much for a tooltip and too little for a dialog. A popover keeps them next to the control they belong to, without leaving the page.

### Popover features

- **Positioning.** `side` and `align` on the content, with collision handling.
- **Non-modal.** The page stays interactive; focus moves into the popover and back.
- **Structure.** Optional header, title and description.
- **Controlled.** `open` and `onOpenChange` for tours and guided steps.

## Integrating with other components

Popovers host [Calendar](/components/calendar)s, [Command](/components/command) lists, forms of [Field](/components/field)s, [Slider](/components/slider)s and [Switch](/components/switch)es. Open them from a [Button](/components/button) or an avatar; inside a [Dialog](/components/dialog), they portal above it.

## Frequently asked questions

### Popover or Tooltip?

A tooltip labels a control on hover and holds only text. A popover opens on click and can hold anything, including links and inputs.

### Popover or Dialog?

A popover for small, optional content next to a control; a [Dialog](/components/dialog) when people must finish or cancel before continuing.

### How do I submit a form in a popover?

Put the form inside, handle `onSubmit`, and close the popover by controlling `open` once it succeeds.

### How do I position it?

`side` (`top`, `right`, `bottom`, `left`) and `align` (`start`, `center`, `end`) on `PopoverContent`; it flips when it would leave the screen.

### Is it accessible?

Yes: the trigger exposes its expanded state, focus moves into the popup when it opens, and Escape closes it and returns focus. Name the popup with `PopoverTitle`.
