## When to use

- Agent run logs and tool-call lists: one short line of status text per step
- Labelled dividers that split a transcript or a run log into named phases
- Ruled summaries such as changed files, and rows that open a link or run an action

## When not to use

- A plain rule between content sections: use [Separator](/components/separator)
- Steps that expand to their output, with running and failed states: use [Trace](/components/trace)

## Notes

- Make a row a link or a button with `render`
- `MarkerIcon` is `aria-hidden` with everything in it, so the `MarkerContent` text alone must say what the row means

## Marker: one line per step

`Marker` is a single line of status — an icon and a short text — for logs, transcripts and summaries. Variants set its emphasis, and the same component draws a labelled divider between phases.

### What is Marker?

`MarkerIcon` and `MarkerContent` in a row. In an agent transcript: "Read 3 files", "Ran tests", "— Planning —".

### Why use Marker?

Logs are easier to scan as short, consistent lines than as paragraphs. Markers keep the rhythm of a run readable at a glance.

### Marker features

- **Variants.** For plain lines, statuses and dividers.
- **Links and actions.** `render` makes a row interactive.

## Integrating with other components

Use markers inside a [Message](/components/message) for an agent's actions, between [Trace](/components/trace) sections as phase dividers, and in a [Card](/components/card) for a changed-files summary.

## Frequently asked questions

### Marker or Trace?

A marker for one line with no detail; a [Trace](/components/trace) for steps that expand to their output and show running or failed states.

### Is it accessible?

The text is read; the icon is hidden. Make the text say the status in words.
