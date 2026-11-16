## When to use

- Agent turns: reasoning, tool calls, sub-agents and the sources behind an answer
- Run logs that expand to output, from CI jobs and data builds to webhook deliveries
- Checklists of automated checks or setup steps with running, failed and pending states

## When not to use

- Dated events or milestones joined by a line: use [Timeline](/components/timeline)
- One short status line per step with no expanding detail: use [Marker](/components/marker)

## Notes

- Status shows through colour and motion only: every `TraceTitle` must also say in words that a step is running, failed or pending
- A `TraceLine` on its own is a plain span: wrap it in a link, or a dialog, sheet or popover trigger, to make it act
- `TraceCollapsible` makes a line expandable to its output

## Trace: steps of a run, with their detail

`Trace` lays out the steps of a process — an agent's turn, a CI pipeline, an import — as lines with an icon, a title and a description, each optionally expanding to its output. Steps can show running, done, failed and pending states.

### What is Trace?

`TraceLine`s with a `TraceIcon`, a `TraceTitle` and a `TraceDescription`; `TraceCollapsible` with `TraceCollapsibleTrigger` and `TraceCollapsibleContent` for steps that expand to logs, sources or sub-steps.

### Why use Trace?

AI and automation work happens in steps people want to inspect. A trace shows what ran, in what order, what each step found, and where it failed, without dumping raw logs.

### Trace features

- **Step states.** Running (with motion), done, failed, pending.
- **Expandable detail.** Output, sources and sub-steps behind each line.
- **Nesting.** Sub-agents and sub-steps inside a step.

## Integrating with other components

Show step output in a [Code Block](/components/code-block), sources as [Badge](/components/badge)s or links, and the whole run in a [Card](/components/card) or a [Sheet](/components/sheet).

## Frequently asked questions

### Trace or Timeline?

A trace for the steps of one run with their output; a [Timeline](/components/timeline) for dated events over time.

### Is it accessible?

Lines are text and expandable steps are disclosure buttons; say each state in words, since colour and motion are not announced.
