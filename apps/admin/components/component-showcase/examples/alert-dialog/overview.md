## When to use

- Modal prompts that block the page and ask people to answer or acknowledge
- Confirmations, permission requests and notices that a backdrop click must not close
- Destructive actions that should take a typed confirmation, a reason or a short countdown

## When not to use

- A form or a settings panel that a click outside may dismiss: use [Dialog](/components/dialog)
- A status or warning shown in the page with no decision to make: use [Alert](/components/alert)
- A notice that needs no answer and should not interrupt: use a [Toast](/components/toast)

## Notes

- Run the action from `onConfirm` (on the content, the footer or `AlertDialogAction`); with `confirmLoading` the action shows a spinner and the dialog stays open until you close it
- `AlertDialogTrigger` takes its button through `render`
- A small (`size="sm"`) dialog lays the footer out as two equal columns, so keep it to two buttons

## Alert Dialog: confirm, acknowledge, or stop

`AlertDialog` is a modal that demands a response. Built on Base UI's alert dialog, it ignores backdrop clicks and traps focus until it is answered. The kit's version adds what real confirmations need: severity styling, a loading confirm, typed confirmation, a required reason, a countdown before the action enables, a third action and an "undo" hint.

### What is Alert Dialog?

A dialog with a title, a description, an optional icon (`AlertDialogMedia`) and a footer of a cancel and an action. `severity` — `info`, `success`, `warning`, `destructive` — colours the icon and the action.

### Why use Alert Dialog?

Irreversible actions deserve one deliberate step. A dialog that cannot be dismissed by accident, explains the consequence and can ask for a typed name or a reason prevents the costly mistakes a plain button cannot.

### Alert Dialog features

- **Severity.** Icon and action colour per severity.
- **Typed confirmation.** `requireConfirmation` with the value to type (the record's name).
- **Reason.** `requireReason` collects why, for the audit trail.
- **Countdown.** `delaySeconds` keeps the action disabled for a moment.
- **Loading confirm.** `confirmLoading` while the mutation runs.
- **Third action and shortcut.** `thirdAction` ("Save and close") and `confirmShortcut`.
- **Remember the choice.** "Don't ask again" through `onPreferenceChange`.

## Integrating with other components

Open it from a destructive [Button](/components/button) or a [Dropdown Menu](/components/dropdown-menu) item, confirm with a [Toast](/components/toast) once the action succeeds, and use it from inside a [Dialog](/components/dialog) for "discard unsaved changes?".

## Frequently asked questions

### Alert dialog or regular dialog?

An alert dialog when the only question is "are you sure?" and an accidental dismissal must not count as an answer; a [Dialog](/components/dialog) for forms and content.

### Should I make people type the name to delete?

For high-impact deletions, yes — `requireConfirmation` with the record's name. For everyday actions, the dialog alone is enough; prefer undo where possible.

### Which variant for the destructive action?

`severity="destructive"`: the action turns red and the icon warns. `actionOrder` sets which button comes first.

### Is it keyboard-accessible?

Yes: focus moves into the dialog and Tab stays inside it, and Escape cancels. It is `role="alertdialog"`, named by its title and described by its description.
