## When to use

- Short forms and settings that need an answer before the page continues
- Long text such as terms, read in a scrolling body that can grow to nearly full screen
- Reference overlays and notices, such as a keyboard-shortcut list or a session timeout

## When not to use

- A yes/no confirmation before a destructive action: use [Alert Dialog](/components/alert-dialog)
- Long forms or record details that slide in from the edge of the screen: use [Sheet](/components/sheet)
- Mobile panels that open from the bottom and close with a swipe: use [Drawer](/components/drawer)

## Notes

- Compose the trigger through `render`, e.g. `<DialogTrigger render={<Button />}>Open</DialogTrigger>`
- `DialogContent` draws its own close button; pass `showCloseButton={false}` to drop it

## Dialog: a modal window for focused tasks

`Dialog` opens a window over the page, built on Base UI's dialog: focus moves into it and stays there, the page behind is inert, and Escape or a click on the backdrop closes it. `DialogHeader`, `DialogTitle`, `DialogDescription`, a body and `DialogFooter` give every dialog the same structure.

### What is Dialog?

A modal for a short, self-contained task — rename a file, invite a teammate, read the terms — that should be finished or cancelled before going back to the page.

### Why use Dialog?

It keeps people in context: the page stays visible behind the backdrop, and closing the dialog returns them exactly where they were, with focus back on the trigger.

### Dialog features

- **Focus management.** Focus moves in on open, stays trapped, and returns to the trigger on close.
- **Structured content.** Header, title, description, scrolling body and a sticky footer.
- **Close button.** Built in, localised, and optional (`showCloseButton`).
- **Sizes.** From a compact prompt to full screen.
- **Nested.** A dialog can open from inside another.

## Integrating with other components

Put a form of [Field](/components/field)s in the body and [Button](/components/button)s in `DialogFooter`, with `DialogClose` on Cancel. Use [Alert Dialog](/components/alert-dialog) for confirmations, and [Scroll Area](/components/scroll-area) for a long body with a pinned footer.

## Frequently asked questions

### Dialog, Drawer or a new page?

A dialog for short tasks that return to the page; a [Drawer](/components/drawer) on mobile; a page when the task is long or should have its own URL.

### How do I submit a form in a dialog?

Put the `form` in the dialog, give the save button `type="submit"`, and close the dialog (control `open`) once the mutation succeeds.

### Can dialogs be nested?

Yes. Each stacks over the last and Escape closes the top one first; keep it to two levels.

### How do I stop it closing with unsaved changes?

Control `open` with `onOpenChange`, and when a close is requested with unsaved changes, ask first (an [Alert Dialog](/components/alert-dialog)) instead of closing.

### Is it accessible?

Yes: it is `role="dialog"` with `aria-modal`, named by `DialogTitle` and described by `DialogDescription`; focus is trapped while it is open.
