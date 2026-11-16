## When to use

- A few controls tied to one trigger: dimensions, player settings
- A preview of something with an action: a profile with Follow, a template with Use
- A short step-by-step tour beside the control it explains

## When not to use

- A one-line explanation: use [Tooltip](/showcase/tooltip)
- A preview opened by a long press: use [HoverCard](/showcase/hover-card)
- A list of actions: use [DropdownMenu](/showcase/dropdown-menu)
- A long form: use [Sheet](/showcase/sheet) or [Dialog](/showcase/dialog)

## Notes

- It opens beside its trigger and moves to the other side, then inside the screen's edges, when it does not fit
- A tap outside or the system back closes it
- The trigger is a kit control: the popover hands it the press that opens it

## Popover: a panel beside its trigger

`Popover` wraps one trigger and shows `content` beside it.

### What is it?

A small modal panel anchored to the control that opened it.

### Why use it?

It keeps a few related controls next to what they change, without leaving the screen.

### Features

- **Sides and alignment.** `side` and `align`, with flipping and edge clamping.
- **Sizes.** `sm`, `md`, `lg` or the content's width (`auto`).
- **Controlled or not.** `open` and `onOpenChange`, or its own state.
- **Long press.** `openOn="longPress"` (what [HoverCard](/showcase/hover-card) uses).

## Integrating with other components

Put [Switch](/showcase/switch)es, a [Slider](/showcase/slider), [Input](/showcase/input)s or [Button](/showcase/button)s in it; it works inside a [Dialog](/showcase/dialog).

## Frequently asked questions

### What can be the trigger?

Any control that takes `onPress`: Button, IconButton, or a Pressable you style.

### Why did it open on the other side?

There was not enough room on the side you asked for; it moves to the opposite side, then stays inside the screen.
