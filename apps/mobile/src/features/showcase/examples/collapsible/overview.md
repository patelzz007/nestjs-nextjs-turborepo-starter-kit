## When to use

- One region that can hide: an order's details, advanced options, a long answer
- A card that opens to more detail

## When not to use

- Several sections: use [Accordion](/showcase/accordion)
- Information people always need: show it

## Notes

- The trigger says whether the region is open; the closed region is not rendered
- The content fades in; Reduce Motion turns that off
- The open state is yours: open it from any control, not only the trigger

## Collapsible: one region behind a trigger

`Collapsible` holds a `CollapsibleTrigger` and a `CollapsibleContent`.

### What is it?

A controlled disclosure: `open` in, `onOpenChange` out.

### Why use it?

It keeps the essentials in view and the detail one tap away.

### Features

- **Looks.** Plain, card, or inset (inside a framed list).
- **Rich triggers.** A glyph, a leading tile or avatar, a description, a trailing badge.
- **Indicators.** Chevron, plus and minus, or a chevron at the start.

## Integrating with other components

Put [Checkbox](/showcase/checkbox)es, a [DropdownMenu](/showcase/dropdown-menu) per row, or a [Progress](/showcase/progress) bar in it.

## Frequently asked questions

### Can a button elsewhere open it?

Yes: `open` is yours; any control can set it.
