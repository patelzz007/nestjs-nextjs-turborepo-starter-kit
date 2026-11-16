## When to use

- A task beside the screen: an editor, filters, details of a row
- Navigation or settings from an edge (left or right)
- A short choice from the top or the bottom

## When not to use

- A yes or no decision: use [AlertDialog](/showcase/alert-dialog)
- A panel people swipe away: use [Drawer](/showcase/drawer)
- A whole flow: give it a screen

## Notes

- It slides in by its own size while the backdrop fades; under Reduce Motion it appears and goes
- The body scrolls; the title and the footer stay in view
- It keeps clear of the notch and the home indicator

## Sheet: a panel from an edge

`Sheet` slides in from `top`, `right`, `bottom` or `left`, with a title, an optional description and corner close button, a scrolling body and a footer.

### What is it?

A controlled modal panel: `open` in, `onOpenChange(false)` out.

### Why use it?

It keeps the screen behind in view while the person works beside it.

### Features

- **Four sides.** `side`, and `size` for how much of the screen it takes.
- **Footer.** Actions under the body, always in view.
- **Close button.** On by default; `showCloseButton={false}` leaves the footer's Cancel.
- **Swipe.** `swipeToClose` (the drawer's behaviour) with a grab handle.

## Integrating with other components

Put a form of [TextField](/showcase/input)s in it, with [Button](/showcase/button)s in the footer.

## Frequently asked questions

### Sheet or Drawer?

The same panel: a drawer is a sheet that is swiped back to close and shows a grab handle.

### Can it hold a long form?

Yes, the body scrolls. For a whole flow, a screen is clearer.
