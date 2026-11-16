## When to use

- A short task or a list of choices that people dismiss with a swipe
- Panels from the edge a thumb reaches: the bottom most often

## When not to use

- A task that must not be dismissed by accident: use [Dialog](/showcase/dialog)
- A long form: give it a screen

## Notes

- Dragging the drawer toward its edge follows the finger; let go past a third of its size and it closes, short of that it springs back
- A tap on the backdrop or the system back closes it too
- The grab handle shows that it can be swiped

## Drawer: a panel swiped away

`Drawer` is a [Sheet](/showcase/sheet) with `swipeToClose` and a grab handle, from the bottom by default.

### What is it?

A controlled panel: `open` in, `onOpenChange(false)` out, closing by swipe, tap or back.

### Why use it?

A swipe is the quickest way out on a phone.

### Features

- **Any side.** `side`: bottom (default), top, left, right.
- **Swipe to close.** Follows the finger, springs back short of the threshold.
- **Handle.** Shown at the bottom or top edge it is dragged from.

## Integrating with other components

Put a few [Button](/showcase/button)s or a short form in it.

## Frequently asked questions

### Can people still close it without swiping?

Yes: the backdrop, the system back, and any button you put in it.
