## When to use

- An agent's or a tool's steps as they run: searches, edits, commands, lookups
- A pipeline, a deploy or an import, one line per job, each opening to its output
- A tree of timings (request spans, a query plan) where the slow part starts open

## When not to use

- A few numbered steps people move between: use Stepper
- Events in time with dates and people: use Timeline
- A single running task with a known amount left: use Progress

## Notes

- Say the outcome in the title ("failed with 1 error"): the glyph and the colour are not read out
- `TraceStep` is uncontrolled with `defaultOpen`, or controlled with `open` and `onOpenChange`

## Trace

`Trace` is a compact activity log: one line per step, each optionally opening to its detail, indented under a rule. A running step's title breathes; a failed one turns destructive; a pending one is dimmed.

### Features

- **TraceLine**: a glyph or anything `leading`, a title, a description, and a glyph or anything `trailing`.
- **Statuses** `running`, `error`, `pending`; none means done.
- **TraceStep**: a line that opens to its detail, with a chevron that turns, built on the kit's Collapsible.
- **Pressable lines**: `onPress` makes a line a button, or a link (`accessibilityRole`).

## Integrating with other components

Put a CodeBlock, a Table, Badges or a nested Trace inside a step; open a Dialog or a Sheet from a pressable line for detail too long to fold.

## Frequently asked questions

### How do I show a step that is still running?

`status="running"`: the title breathes, and stays still under Reduce Motion. Say it in the title too ("Running pnpm test").

### Controlled or uncontrolled?

Uncontrolled (`defaultOpen`) for a static log; controlled when the step should open itself while it runs and the reader's own tap should still win.
