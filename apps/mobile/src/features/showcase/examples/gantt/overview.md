## When to use

- A schedule across rows: a project's tasks, a team's capacity, a roadmap by workstream
- Work whose order matters: dependencies, milestones, a plan against what happened

## When not to use

- Events at times of day for one person: use a calendar
- A list of tasks without dates: use a list or Kanban

## Notes

- Lays a schedule out with the same rules as the web kit (`@workspace/ui-kit-logic` `gantt`): ranges, the axis, lanes, baselines, rollups, dependencies, recurrence
- Tap a bar to select it; its readout moves it or changes its length, and a selected bar drags along the timeline
- Every change goes through `onEventUpdate`: refuse it, or adjust it (a working-day snap)

## Gantt

`Gantt` draws a tree of rows beside a timeline that scrolls sideways: bars with progress, planned baselines, milestones, group rollups, dependency arrows, shaded weekends and holidays, and a today line, with a toolbar for the period and the scale.

### Features

- **Scales**: day, week, month, quarter, year.
- **Bars**: progress, baselines (early, late, on time), milestones, dependencies.
- **Rows**: a tree with folding groups, rollups, custom labels (an avatar, a status), a reorder menu.
- **Changes**: buttons, a drag, and screen-reader actions, through one commit gate.
- **Time zones and working days**: off days shaded; a commit gate can snap to them.

## Integrating with other components

Put a Button in `toolbarContent` to add work; draw rows with Avatar and Badge; keep the bars' state with `events` and `onEventsChange` and save each change from `onEventUpdate`.

## Frequently asked questions

### How do I move a bar without a mouse?

Tap it. The readout's buttons move it a day (an hour on the day scale) or change its length; drag it along the timeline once selected; or use a screen reader's actions.

### How do I keep work off weekends?

Pass `offDays` (weekends and holidays) and return an adjustment from `onEventUpdate`: the next working day, with the task's working-day length.
