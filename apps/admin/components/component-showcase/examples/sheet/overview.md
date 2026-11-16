## When to use

- Edit forms and long scrolling content that slide in from an edge of the screen over the page
- Panels pinned to the top, right, bottom or left edge, with their own footer actions
- Record details opened from a table row, kept beside the list rather than replacing it

## When not to use

- A touch panel people drag or swipe closed: use [Drawer](/components/drawer)
- A short decision or form that belongs in the middle of the screen: use [Dialog](/components/dialog)

## Notes

- `SheetContent` draws its own corner close button; set `showCloseButton={false}` when the footer closes it
- Top and bottom sheets grow with their content and have no height cap, so bound them (`max-h-*`)
- `SheetTrigger` and `SheetClose` take their element through `render`

## Sheet: a panel from the edge of the screen

`Sheet` is a dialog that slides in from a side of the screen — right by default, or `left`, `top` or `bottom`. It is built on Base UI's dialog, so focus is trapped and Escape closes it, like any modal.

### What is Sheet?

A side panel for work that needs more room than a dialog but should keep the page in view: editing a record, a filters panel, notifications, a detail view opened from a list.

### Why use Sheet?

Edge panels keep the list or page behind them visible and familiar. A tall sheet scrolls naturally, and its footer stays in reach.

### Sheet features

- **Four sides.** `side` is `top`, `right`, `bottom` or `left`.
- **Structured content.** Header, title, description, a scrolling body and a footer.
- **Close button.** Built in and optional (`showCloseButton`).

## Integrating with other components

Open it from a [Data Table](/components/data-table) row to edit the record, put a form of [Field](/components/field)s inside, and save with [Button](/components/button)s in `SheetFooter`. On phones, a [Drawer](/components/drawer) is often the better fit.

## Frequently asked questions

### Sheet or Drawer?

A sheet for desktop panels opened by mouse or keyboard; a [Drawer](/components/drawer) for touch panels that swipe closed.

### Sheet or Dialog?

A sheet for long forms and detail views; a [Dialog](/components/dialog) for short tasks and confirmations.

### How do I make it change sides on mobile?

Pick `side` from a breakpoint hook (`bottom` on narrow screens, `right` on wide ones), or render a Drawer on mobile instead.

### Can the content scroll without the page scrolling?

Yes: the sheet's body scrolls inside the panel while the page behind is locked.

### Is it accessible?

It is a modal dialog: named by `SheetTitle`, focus trapped, Escape closes it and focus returns to the trigger.
