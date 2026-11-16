## When to use

- A flow done in order: checkout, onboarding, setup
- Progress through stages: a delivery, a refund, a release
- A short list of tasks, each with its state

## When not to use

- Sections people visit in any order: use [Tabs](/showcase/tabs)
- One value of progress: use [Progress](/showcase/progress)
- A history of events: use [Timeline](/showcase/timeline)

## Notes

- Steps before the active one are completed; mark others done with `completed`
- With `onChange` the steps are tabs; without it the stepper only shows progress
- Every step's name says its position and state ("Step 2 of 4: Shipping, current")

## Stepper: progress through steps

`Stepper` takes `steps` and the active `value` (1-based).

### What is it?

A controlled sequence of steps, drawn in one of several looks.

### Why use it?

It shows where people are, what is done and what is left.

### Features

- **Looks.** Circles, dots, bars, a segmented bar, chevrons, icon tiles, a text trail.
- **Orientation.** A row or a column.
- **Titles.** Below, beside, or hidden (still named).
- **Markers.** Numbers, glyphs, or rings.
- **Per step.** A glyph, a badge, a time, a spinner.
- **Tone.** Finished steps in the primary colour or green.

## Integrating with other components

Pair it with [Button](/showcase/button)s for Previous and Next, put it in an [Accordion](/showcase/accordion) for phases, or beside [Badge](/showcase/badge)s for status.

## Frequently asked questions

### Can people jump to any step?

Pass `onChange` and decide in it which steps may open; mark the rest `disabled`.
