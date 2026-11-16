## When to use

- Single on/off preferences beside a label, such as airplane mode, sign-in security or an AI feature
- Grouped notification, privacy and editor preferences in a card, a Frame panel or a dense list
- Options with a supporting sentence set as clickable tiles, including a risky one that asks to confirm

## When not to use

- A row of pressed buttons that picks a view, an alignment or a time range: use [Toggle Group](/components/toggle-group)
- A consent or terms box that is ticked and sent with a form: use [Checkbox](/components/checkbox)

## Notes

- A switch should take effect immediately: save the change in `onCheckedChange`, or use a checkbox if it waits for a submit
- Give it a `name` when it sits in a native form, or the post carries no value for it

## Switch: settings that apply at once

`Switch` is a sliding on/off control built on Base UI's switch. It renders a button with `role="switch"` and a hidden native input, and reads as "on" or "off" to assistive technology.

### What is Switch?

The control for a setting that changes the moment it is flipped: notifications on, dark mode on, two-factor sign-in on. It pairs with a label and, often, a sentence explaining what the setting does.

### Why use Switch?

A switch tells people the change is immediate — no save button. Settings pages read faster as a list of labelled switches than as a form of checkboxes and a submit.

### Switch features

- **Controlled or uncontrolled.** `checked` / `onCheckedChange`, or `defaultChecked`.
- **Two sizes.** `sm` and `default`.
- **States.** `disabled`, `aria-invalid` and `loading` while the change is saved.
- **Rows and tiles.** With [Field](/components/field), a switch sits beside a title and a description.

## Integrating with other components

Lay settings out with [Field](/components/field) (`orientation="horizontal"`, `FieldContent`), group them in a [Card](/components/card) or a [Frame](/components/frame), and confirm a destructive switch with an [Alert Dialog](/components/alert-dialog), as the Destructive Confirm example does.

## Frequently asked questions

### Switch or checkbox for a boolean field?

A switch for a setting that applies at once; a [Checkbox](/components/checkbox) for a choice submitted with a form.

### How do I pair it with a label?

Give the switch an `id` and a `Label` with `htmlFor`; clicking the label flips the switch.

### Should a switch have a description?

When the setting's effect is not obvious from its name, yes — a `FieldDescription` under the title, linked with `aria-describedby`.

### Is it keyboard-accessible?

Yes: it is a focusable `role="switch"`, and Space (or Enter) flips it.
