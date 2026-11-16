## When to use

- A labelled bar that reports how far an upload, a download or a setup has got
- File rows with the time left, and setup checklists whose bar counts the steps done
- Slim bars in dense rows, and bars in a colour of their own

## When not to use

- A wait of unknown length: use Spinner
- Numbered steps people can move between: use Stepper
- A value people set by dragging: use Slider

## Notes

- `accessibilityLabel` names the bar for screen readers; `label` shows a name over it
- `showValue` shows the percent done, or `valueText` when a number says too little ("3 of 5 files")

## Progress

`Progress` shows how far a task has got: a track and a fill that eases to each new value (and jumps under Reduce Motion), with an optional label row over it.

### Features

- **Sizes** `sm`, `md`, `lg`, `xl`.
- **Tones** `default`, `info`, `success`, `warning`, `destructive`, or a fill of your own (`indicatorClassName`).
- **States**: dimmed when disabled, announced busy while loading, destructive when invalid.
- **Label and value** over the bar, hidden from screen readers (the bar announces both).

## Integrating with other components

Show upload progress in a list row, in a Toast's `content`, or in a Card for a setup checklist.

## Frequently asked questions

### Progress or Spinner?

Progress when you know how much is done; a Spinner when you do not.

### Why is the label row hidden from screen readers?

The bar itself is a progress bar named by `accessibilityLabel` with its value: reading the row too would say everything twice.
