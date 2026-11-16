## When to use

- Messages, feedback and other free-text answers that run over several lines
- Labelled long-text fields with a hint under the box, an error state or a disabled state
- Profile bios that count characters towards a limit and grow as people type

## When not to use

- A comment or prompt box with buttons or a live count inside its border: use [Input Group](/components/input-group) with `InputGroupTextarea`
- Formatted text with headings, lists and links: use [Rich Text Editor](/components/rich-text-editor)
- A single line, such as a name or an email address: use [Input](/components/input)

## Notes

- `Textarea` grows with its text through `field-sizing: content` and has no height cap: set `min-h-*` and `max-h-*` classes
- Only `aria-invalid` on `Textarea` turns its border red; `data-invalid` on `Field` leaves the border as it is

## Textarea: multi-line text entry

`Textarea` is the kit's multi-line field, a native `textarea` with the same sizes and states as `Input`. It sizes itself to its content where the browser supports `field-sizing`, so it starts small and grows as people write.

### What is Textarea?

A text box for more than one line: a message, a note, a bio, a support request. It shares `aria-invalid`, `disabled` and `loading` styling with every field in the kit.

### Why use Textarea?

Long answers need room. An auto-growing textarea avoids an inner scrollbar for normal-length text and keeps forms tidy, while a character count keeps an eye on limits.

### Textarea features

- **Grows with its content.** `field-sizing: content`, capped by your own `max-h-*`.
- **Three sizes.** `sm`, `default` and `lg`.
- **Shared states.** `aria-invalid`, `disabled` and `loading`.
- **Native attributes.** `maxLength`, `rows`, `required`, `name` all pass through.

## Integrating with other components

Wrap it in a [Field](/components/field) with a [Label](/components/label), a hint and an error. For a composer with a toolbar or a send button inside the border, use [Input Group](/components/input-group).

## Frequently asked questions

### How do I make it grow as people type?

It already does where the browser supports `field-sizing: content`. Add `max-h-*` (and `overflow-y-auto`) so a very long text scrolls instead of pushing the page.

### Can I enforce a character limit?

Set `maxLength`, and show the count beside the field as the Auto-Resize Counter example does. Validate the length in your schema too.

### Textarea or Input?

[Input](/components/input) for one line — names, emails, titles. `Textarea` when the answer can run to sentences.

### Is it accessible?

It is a native `textarea`: tie a label with `htmlFor`, link the hint and the error with `aria-describedby`, and announce a count only when it matters (near the limit).
