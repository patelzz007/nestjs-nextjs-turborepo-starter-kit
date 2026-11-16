## When to use

- Page, form and dialog actions in primary, secondary, outline, ghost, destructive and link weights
- Icon-only controls and sign-in rows, such as close, search, copy, menu or theme switches and provider logos
- Actions that report their state or carry extras, such as a spinner, a saved check, a count or a shortcut

## When not to use

- Several related actions joined edge to edge into one segmented control: use [Button Group](/components/button-group)
- A control that stays pressed on or off, such as bold in an editor toolbar: use [Toggle](/components/toggle)
- An action inside a text field, such as a search submit or a clear: use [Input Group](/components/input-group)

## Notes

- `Button` renders a real `button` with `type="button"`, so it never submits a form by accident: pass `type="submit"` for the form's submit
- A link styled as a button passes its anchor through `render` with `nativeButton={false}` — `<Button render={<Link href="/" />} nativeButton={false}>`
- Mark a leading or trailing icon with `data-icon="inline-start"` or `"inline-end"`, so the padding on that side tightens around it

## Button: primary actions and form submission

`Button` is the kit's clickable control for actions, form submission and navigation. It is built on Base UI's button primitive, so it keeps native button semantics — focus, Enter and Space, `disabled` — while the look comes from the kit's design tokens.

It comes in seven variants (`default`, `secondary`, `outline`, `ghost`, `destructive`, `link` and `nav`) and nine sizes (`xs`, `sm`, `default`, `md`, `lg`, and the square `icon-xs`, `icon-sm`, `icon`, `icon-lg`), with loading, disabled and invalid states built in.

### What is Button?

A button starts an action: save, send, delete, open. `Button` composes the native element with variant classes for colour, size and state, so every action in the app looks and behaves the same without one-off CSS.

The examples above show the full ladder of weights, icon placement, icon-only buttons, social sign-in rows, counts and badges riding on a button, copy feedback and async actions — so you can pick the variant, the size and whether a label needs an icon by seeing them side by side.

### Why use Button?

Consistent weights let people scan a screen for the action that matters: one `default` button per view, `secondary` or `outline` for the alternatives, `ghost` for dense toolbars and `destructive` for anything that cannot be undone. The states are part of the component rather than of each screen — `loading` shows a spinner and disables the button, an `aria-invalid` button picks up the error ring — so every form gets them for free.

### Button features

- **Seven variants.** `default`, `secondary`, `outline`, `ghost`, `destructive`, `link`, and `nav` for a full-width row in a menu.
- **Nine sizes.** Text sizes from `xs` to `lg`, and square icon sizes from `icon-xs` to `icon-lg` for icon-only controls.
- **Loading.** `loading` shows a spinner before the label and disables the button until the work finishes.
- **Icons.** Lucide icons before or after the label, sized by the button; `data-icon` trims the padding on the icon's side.
- **Invalid and disabled.** `aria-invalid` adds the destructive ring; `disabled` dims the button and removes it from interaction.
- **Polymorphic.** `render` turns it into a link or any element, keeping the styles.

## Integrating with other components

Use a `default` button for the primary action in a [Dialog](/components/dialog) or an [Alert Dialog](/components/alert-dialog), beside a `secondary` or `outline` one to cancel. Inside forms, pair it with [Input](/components/input) and [Field](/components/field), and give the submit `type="submit"`.

Join related actions with [Button Group](/components/button-group), and give an icon-only button a [Tooltip](/components/tooltip) that names it. A shortcut hint reads best as a [Kbd](/components/kbd) inside the button or its tooltip.

## Frequently asked questions

### Which variant is the primary action?

`default` — the filled one — for the single action a screen exists for. Use `secondary` or `outline` for the alternatives, and keep `destructive` for actions that delete or cannot be undone.

### How do I show a loading state?

Pass `loading`. The button shows a spinner before its label and is disabled until you clear it, so a double click cannot submit twice. Change the label too ("Saving…") when the wait is long enough to read.

### Can a button be a link?

Yes: pass the anchor through `render` and set `nativeButton={false}`, e.g. `<Button render={<Link href="/settings" />} nativeButton={false}>Settings</Button>`. It keeps the button's look and becomes a real link for the browser and assistive technology. For a link that should look like text, use `variant="link"`.

### What is the difference between `secondary`, `outline` and `ghost`?

`secondary` is a soft fill, `outline` a border with no fill, and `ghost` neither until it is hovered. Use `ghost` sparingly — in toolbars and dense rows — where a border on every control would be noise.

### Why does my button not submit the form?

The kit's `Button` defaults to `type="button"`. Set `type="submit"` on the button that submits.

### How do I make an icon-only button accessible?

Use an `icon-*` size and give the button an `aria-label`; the icon itself stays `aria-hidden`. A [Tooltip](/components/tooltip) with the same words helps sighted users too.
