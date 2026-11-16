## When to use

- Text fields with a leading icon, prefix or suffix text, a unit or a status mark inside one border
- Search, link and API bars that end in a copy, clear, filter, menu or send control
- Prompt and comment composers: a text area with a toolbar row above or below the text

## When not to use

- Selects, fields and actions joined edge to edge, each keeping its own border: use [Button Group](/components/button-group)
- A plain text field with nothing inside its border: use [Input](/components/input)
- A full chat screen with a thread above the prompt box: compose [Message Scroller](/components/message-scroller) and [Message](/components/message) above an input group

## Notes

- The border turns red from `aria-invalid` on the control; `data-invalid` on `Field` only tints text, so set both
- Addon icons and text never name the control: tie a label to the input or give it an `aria-label`
- `InputGroupButton` defaults to `type="button"`; pass `type="submit"` when it should send the surrounding form

## Input Group: icons, text and actions inside a field

`InputGroup` draws one border around an input (or a textarea) and the `InputGroupAddon`s beside it: icons, text, keyboard hints, buttons, spinners. Addons go before or after the text (`inline-start`, `inline-end`), or above or below it (`block-start`, `block-end`) for a composer with a toolbar.

### What is Input Group?

A field with things attached. `InputGroupInput` and `InputGroupTextarea` are the controls; `InputGroupAddon` holds the attachments, `InputGroupText` a prefix or suffix such as `https://` or `kg`, and `InputGroupButton` a compact action such as copy, clear or send. Clicking an addon's padding focuses the input, so the whole box behaves like one field.

### Why use Input Group?

Search bars, URL fields, amounts with a currency, API keys with a copy button and chat composers are all "a field plus something". Building them by hand means faking one border around several elements and keeping the focus ring and error state in sync; `InputGroup` does it with the focus and invalid styling of the inner control.

### Input Group features

- **Four positions.** `inline-start`, `inline-end`, `block-start` and `block-end`.
- **Text and textarea.** `InputGroupInput` for one line, `InputGroupTextarea` for a composer that grows.
- **Actions.** `InputGroupButton`, a compact ghost button that never submits by accident.
- **Shared states.** Focus and `aria-invalid` on the control style the whole group.

## Integrating with other components

Put a [Kbd](/components/kbd) in an addon for a search shortcut, a [Spinner](/components/spinner) while a lookup runs, a [Dropdown Menu](/components/dropdown-menu) trigger in an `InputGroupButton`, and a [Tooltip](/components/tooltip) on icon-only actions. Wrap the group in a [Field](/components/field) for its label and error.

## Frequently asked questions

### Input Group or a plain Input?

Use an input group as soon as something sits inside the field's border — an icon, a unit, a button. A plain [Input](/components/input) is lighter when nothing does.

### How do I add a search icon or button?

An `InputGroupAddon` with the icon before the input, and an `InputGroupAddon align="inline-end"` with an `InputGroupButton` after it.

### Does it work with validation?

Yes: set `aria-invalid` on `InputGroupInput` and the whole group turns red; show the message in a `FieldError` below.

### Is it accessible?

The input is a native field: name it with a label or an `aria-label`. Icon-only buttons need their own `aria-label`; decorative icons stay `aria-hidden`.

### How do I add a currency or a unit?

An `InputGroupText` inside an addon — `$` before the input, `kg` after it.
