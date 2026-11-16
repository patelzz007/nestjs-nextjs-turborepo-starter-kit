## When to use

- Labelled bars that report how far an upload, a download or a setup has got, as a percentage
- File-transfer rows with time left, and setup checklists whose bar counts the steps done
- Compact bars in dense list rows, and bars at a set height or in a colour of their own

## When not to use

- A wait of unknown length: use [Spinner](/components/spinner)
- Numbered steps people can move between: use [Stepper](/components/stepper)
- A value people set by dragging: use [Slider](/components/slider)

## Notes

- `ProgressLabel` names the bar for screen readers; give a bar without one an `aria-label` naming the task
- Set the bar's height on the `progress-track` slot (`**:data-[slot=progress-track]:h-1`)

## Progress: how much is done

`Progress` shows how far a task has got, built on Base UI's progress: a track, an indicator that fills it, an optional label and the value as text. With `value={null}` it becomes indeterminate.

### What is Progress?

`Progress` with `ProgressTrack` and `ProgressIndicator`, plus `ProgressLabel` ("Uploading invoice.pdf") and `ProgressValue` ("64%"). The value runs from `min` to `max` (0–100 by default).

### Why use Progress?

A known wait feels shorter when people can see it moving, and a percentage says whether to wait or come back later.

### Progress features

- **Determinate or indeterminate.** A value, or `null`.
- **Label and value.** Named for assistive technology, with the formatted value.
- **Sizes and colours.** Through classes on the track and indicator.

## Integrating with other components

Show upload progress in [Item](/components/item) rows, in a [Toast](/components/toast), or in a [Card](/components/card) for a setup checklist; per-star counts in a [Rating](/components/rating) summary use it too.

## Frequently asked questions

### Progress or Spinner?

Progress when you know how much is done; a [Spinner](/components/spinner) when you do not.

### How do I format the value?

`format` takes `Intl.NumberFormat` options (percent by default); `ProgressValue` renders the result.

### Is it accessible?

It is `role="progressbar"` with `aria-valuenow`, named by `ProgressLabel` (or `aria-label`).
