## When to use

- Touch panels that slide in from an edge of the screen and close with a swipe
- Mobile tasks with a scrolling body between a title and footer actions
- Pickers and short forms on phones, where a bottom drawer sits under the thumb

## When not to use

- A desktop side panel opened by mouse or keyboard, with no swipe gesture: use [Sheet](/components/sheet)
- A centred modal for a short form or a confirmation: use [Dialog](/components/dialog)

## Notes

- Set the edge with `swipeDirection` (`down`, `up`, `left` or `right`); the drawer opens from that side
- No grab handle is drawn unless you pass `showSwipeHandle`
- A submit button in the footer does not close the drawer by itself: close it when the work succeeds

## Drawer: swipeable panels for touch

`Drawer` is a panel that slides in from an edge and can be dragged or swiped closed, built on Base UI's drawer. It behaves like a dialog — focus is trapped and Escape closes it — with the gesture handling phones expect.

### What is Drawer?

The bottom sheet of mobile apps: a menu, a picker or a short form that rises from the bottom (or comes from any edge), with an optional handle to drag.

### Why use Drawer?

On phones, a panel from the bottom is easier to reach than a centred dialog, and swiping it away feels natural. One component gives you the gesture, the snap and the modal behaviour.

### Drawer features

- **Any edge.** `swipeDirection` picks the side to open from and swipe towards.
- **Swipe to close.** With an optional visible handle.
- **Structured content.** Header, title, description, scrolling body and footer.

## Integrating with other components

Show a [Command](/components/command) list or a form of [Field](/components/field)s in it on mobile, and switch to a [Dialog](/components/dialog) or a [Sheet](/components/sheet) on wider screens with a breakpoint hook.

## Frequently asked questions

### Drawer, Dialog or Popover?

A drawer on touch screens for panels and pickers; a [Dialog](/components/dialog) on desktop; a [Popover](/components/popover) for small content attached to a control.

### Can it hold a form?

Yes: put the form in the body and its actions in `DrawerFooter`; close the drawer on success.

### How does swipe-to-close work?

Drag the panel towards its edge past a threshold, or flick it; it springs back if released early.

### How do I open it from the right?

`swipeDirection="right"`.

### Is it accessible?

Yes: it is a modal dialog named by `DrawerTitle`, and keyboard users close it with Escape or a close button.
