## When to use

- A score out of stars: a product's average, a review
- Picking a score, whole or half stars
- A summary of reviews with a breakdown

## When not to use

- A precise number: use [NumberField](/showcase/number-field) or [Slider](/showcase/slider)
- Yes / no feedback: use buttons
- Progress toward a goal: use [Progress](/showcase/progress)

## Notes

- Read only unless `onChange` is given
- Scores between stars draw to the nearest half

## Rating: a score out of stars

`Rating` shows a score as stars, read only or pickable, in three sizes, with the number beside it when asked.

### What is it?

A row of stars.

### Why use it?

Stars are read at a glance and understood everywhere.

### Features

- **Halves.** Drawn and, with `allowHalf`, picked.
- **Sizes.** `sm`, `md`, `lg`.
- **Value.** `showValue`.
- **Adjustable.** Screen readers step it.

## Integrating with other components

Show counts with [Progress](/showcase/progress) bars for a review summary.

## Frequently asked questions

### How is it read out?

As one control: "4.5 of 5 stars"; a pickable rating can be stepped by swiping.
