## When to use

- Forms and setup flows split into numbered steps that people move back and forth through
- Shipment, delivery and freight tracking shown as stops with times, ETAs and the leg under way
- Incident, ticket, sales, proposal and review workflows laid out as stages, cards, rows or nested tasks

## When not to use

- One question per screen, with branching and a single submit: use [Questionnaire](/components/questionnaire)
- A read-only history of events with dates: use [Timeline](/components/timeline)

## Notes

- `StepperTrigger` takes another element through `render`
- Trigger ids come from `step`, so two steppers on one page need their own `id` and `aria-controls` on each trigger
- `StepperContent` unmounts inactive steps: keep field values in the parent, or pass `forceMount`

## Stepper: progress through steps

`Stepper` shows a process as numbered steps, with the current one highlighted, finished ones ticked and the rest waiting. Steps can be clickable to move between them, and each can own a panel of content.

### What is Stepper?

`StepperNav` lays out `StepperItem`s — a `StepperTrigger` with an indicator, a title, a description — joined by `StepperSeparator`s; `StepperPanel` holds a `StepperContent` per step. It runs horizontally or vertically, and each step can show completed, loading or custom states.

### Why use Stepper?

Long tasks feel shorter in visible steps, and people can see what is left. Tracking views — a delivery's stops, a ticket's stages — read naturally as a stepper too.

### Stepper features

- **Horizontal or vertical.** `orientation`.
- **Controlled or uncontrolled.** `value` / `onValueChange`, or `defaultValue`.
- **States.** Completed, active, loading and disabled steps, with custom indicators.
- **Titles and descriptions.** Below, beside or inline with the indicators.
- **Bars and dots.** Separators as lines, bars, segments or dots.

## Integrating with other components

Put a form of [Field](/components/field)s in each `StepperContent`, move between steps with [Button](/components/button)s, mark states with [Badge](/components/badge)s or [Icon Tile](/components/icon-tile)s, and wrap the whole flow in a [Card](/components/card).

## Frequently asked questions

### How do I validate a step before moving on?

Control `value`, and advance only when the current step's fields validate.

### Can people jump to any step?

Only if you let them: triggers move to their step when clicked; disable later steps until the earlier ones are done.

### Is it accessible?

Steps are a tab list over panels: triggers are named and keyboard-operable, and the current step is announced.
