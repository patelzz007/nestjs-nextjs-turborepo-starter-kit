## When to use

- Screen, form and dialog actions in primary, secondary, outline, ghost, destructive and link weights
- Icon-only controls and sign-in rows, such as close, search, copy, menu or theme switches
- Actions that report their state or carry extras, such as a spinner, a saved check, a count or a shortcut

## When not to use

- Several related actions joined edge to edge into one segmented control: use [Button Group](/showcase/button-group)
- A control that stays pressed on or off, such as bold in an editor toolbar: use [Toggle](/showcase/toggle)
- A row of a settings list that opens another screen: use [ListRow](/showcase/item)

## Notes

- `label` is required, even for a button that only shows its glyph: it is the name screen readers speak, so an icon-only control is an `IconButton` with a `label`
- A press runs `onPress`; `loading` and `disabled` both block presses, and `loading` is announced as busy
- Compact sizes (`sm`, `xs`) keep a 44 pt touch area through their hit slop, so a small button is still easy to tap

## Button: primary actions on a phone

`Button` is the kit's pressable control for actions, form submission and navigation. It is a React Native `Pressable` with the button role, so screen readers announce it as one and switch control reaches it, while its look comes from the kit's design tokens: 48 pt tall, 10 pt corners and a 15 pt label in the button face.

It comes in six variants (`primary`, `secondary`, `outline`, `ghost`, `destructive` and `link`) and four sizes (`xs`, `sm`, `md`, `lg`), with loading, disabled and invalid states built in. `IconButton` is its square, icon-only twin, and `TextLink` the inline link inside a sentence.

### What is Button?

A button starts an action: save, send, delete, open. `Button` composes the native pressable with variant classes for colour, size and state, so every action in the app looks and behaves the same without one-off styles.

The examples above show the full ladder of weights, glyph placement, icon-only buttons, sign-in rows, counts and badges riding on a button, copy feedback and async actions, so you can pick the variant, the size and whether a label needs a glyph by seeing them side by side.

### Why use Button?

Consistent weights let people scan a screen for the action that matters: one `primary` button per screen, `secondary` or `outline` for the alternatives, `ghost` for dense rows and `destructive` for anything that cannot be undone. The states belong to the component rather than to each screen — `loading` shows a spinner and blocks presses, `invalid` adds the destructive border — so every form gets them for free.

### Button features

- **Six variants.** `primary`, `secondary`, `outline`, `ghost`, `destructive` and `link`.
- **Four sizes.** `xs` and `sm` for dense rows (with a 44 pt touch area), `md` for forms, `lg` for a hero's call to action.
- **Loading.** `loading` shows a spinner in place of the glyph and blocks presses until the work finishes.
- **Glyphs.** A Lucide glyph before or after the label (`iconPosition`), coloured by the variant.
- **Slots.** `leading` (an avatar) and `trailing` (a count, a badge, a shortcut) sit inside the button; `description` makes it a two-line choice.
- **Invalid and disabled.** `invalid` adds the destructive border; `disabled` takes the disabled fill and blocks presses.

## Integrating with other components

Use a `primary` button for the main action of a [Dialog](/showcase/dialog) or an [Alert Dialog](/showcase/alert-dialog), beside a `secondary` or `outline` one to cancel. Inside forms, pair it with [Input](/showcase/input) and [Field](/showcase/field), and run the submit from `onPress` with `loading` while it is in flight.

Join related actions with [Button Group](/showcase/button-group), and give an icon-only button a [Tooltip](/showcase/tooltip) that names it on press and hold. A shortcut hint reads best as a [Kbd](/showcase/kbd) inside the button or its tooltip.

## Frequently asked questions

### Which variant is the primary action?

`primary` — the solid one — for the single action a screen exists for. Use `secondary` or `outline` for the alternatives, and keep `destructive` for actions that delete or cannot be undone.

### How do I show a loading state?

Pass `loading`. The button shows a spinner and blocks presses until you clear it, so a double tap cannot submit twice, and screen readers hear it is busy. Change the label too ("Saving…") when the wait is long enough to read.

### How does a button go to another screen?

Call the router in `onPress` (`router.push("/settings")`). For a link inside a sentence, use `TextLink`; for a link-looking action on its own, `variant="link"`.

### What is the difference between `secondary`, `outline` and `ghost`?

`secondary` is a soft fill, `outline` a border with no fill, and `ghost` neither until it is pressed. Use `ghost` sparingly — in toolbars and dense rows — where a border on every control would be noise.

### Why is the small button easy to tap?

`sm` and `xs` are drawn 36 and 28 pt tall but keep a 44 pt touch area through `hitSlop`, the minimum a finger needs. Leave a little room around them so two touch areas never overlap.

### How do I make an icon-only button accessible?

Use `IconButton` and give it a `label`: screen readers speak it, and the glyph itself is never read out. A [Tooltip](/showcase/tooltip) with the same words helps sighted people too.
