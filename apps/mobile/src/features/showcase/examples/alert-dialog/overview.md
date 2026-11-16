## When to use

- A consequential action that needs an explicit decision: delete, sign out, deactivate
- A notice that must be acknowledged (a booking receipt, a finished task)
- A guard before leaving with unsaved changes

## When not to use

- A task with fields: use [Dialog](/showcase/dialog)
- Something that already happened and needs no decision: use [Toast](/showcase/toast)
- An undoable action: do it, then offer Undo in a [Toast](/showcase/toast)

## Notes

- A tap on the scrim does nothing: the person must choose; the system back cancels
- While `pending`, the confirm button spins and nothing can close the dialog
- `error` shows why the action failed, so the person can retry

## AlertDialog: a decision that cannot be skipped

`AlertDialog` is a `Dialog` announced as an alert dialog, with a title, a description and its actions.

### What is it?

A confirmation with a confirm and (optionally) a cancel action.

### Why use it?

It names the consequence before it happens, and makes the destructive path deliberate.

### Features

- **Media.** An icon tile above the title or beside it.
- **Extra content.** A receipt, a checklist or a checkbox between the description and the actions.
- **One or two actions.** Leave out `cancelLabel` for a notice.
- **Layouts.** Stacked, side by side, or two flush cells (`actionsLayout`).
- **Tone.** `destructive` puts the confirm in red.

## Integrating with other components

Use an [IconTile](/showcase/icon-tile) as media, a [Badge](/showcase/badge) for a version or a deadline, and a [Checkbox](/showcase/checkbox) for "don't ask again".

## Frequently asked questions

### Can it open from inside a dialog?

Yes: render it inside the dialog's content; it shows above the dialog.

### How do I show progress while the action runs?

Pass `pending` while it runs; set `error` if it fails.
