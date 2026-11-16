## When to use

- Project plans where a tree of phases and tasks owns bars dragged and resized along a time axis
- Roadmaps, status reports and team-capacity views, read anywhere from a single day to a whole year
- Delivery tracked against a frozen plan, or work chained by dependency arrows and milestone diamonds

## When not to use

- A list of dated steps or updates read in order, with no bars to drag: use [Timeline](/components/timeline)
- A calendar of events by day and hour: use [Event Calendar](/components/event-calendar)

## Notes

- Seed bars with `defaultEvents` for an uncontrolled chart, or pass `events` with `onEventsChange` to keep edits in your store
- Give the root an explicit height (`h-[480px]`, or a flex parent): the view fills whatever it gets
- `onEventUpdate` runs once on release and can accept, reject or adjust a move — the Working Days example snaps to working days

## Gantt: plans on a timeline

`Gantt` is a headless scheduling engine (`useGanttState`) with a composable view on top: a resizable tree pane for the resource hierarchy, a timeline with day, week, month, quarter and year scales, draggable and resizable bars, dependency arrows, milestones, baselines, off days, and a navigation bar.

### What is Gantt?

The composition is `<Gantt><GanttNav /><GanttView /></Gantt>`. The root holds the calendar instance and the view settings in context, so the navigation, the view and each `GanttBar` read from it — and any piece can be replaced.

### Why use Gantt?

Plans are about time and order. Seeing bars against dates, with the dependencies between them, shows slack, overlaps and the critical path in a way a task list cannot.

### Gantt features

- **Five scales.** Day, week, month, quarter and year.
- **Tree of resources.** Groups roll up into summary bars; rows reorder by drag.
- **Interactions.** Drag, resize, slot selection, each switchable; `onEventUpdate` to accept or adjust.
- **Dependencies and milestones.** Finish-to-start arrows; zero-length diamonds.
- **Baselines and progress.** Planned dates ghosted behind actual bars.
- **Off days and time zones.** Weekends and holidays shaded in the chosen zone.
- **Localised.** Labels and dates from the `gantt` messages and a locale.

## Integrating with other components

Render resource labels with [Avatar](/components/avatar)s, statuses with [Badge](/components/badge)s in a task-table column, and edit a bar in a [Dialog](/components/dialog) opened from it. The app's Gantt page is built from it.

## Frequently asked questions

### How do I save changes?

Control the events: pass `events` and `onEventsChange`, and persist in your mutation. Use `onEventUpdate` to reject or adjust a move before it commits.

### Can it skip weekends and holidays?

`offDays` shades them; adjust moves in `onEventUpdate` to keep work on working days, as the Working Days example does.

### Does it handle time zones?

Yes: pass `timeZone`, and the chart lays out and shades its days in that zone.

### Is it accessible?

Bars are focusable and move with the keyboard; the tree pane is a navigable tree, and dates are announced in words.
