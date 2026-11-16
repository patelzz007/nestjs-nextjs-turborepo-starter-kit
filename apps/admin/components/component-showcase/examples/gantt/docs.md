## Installation

The gantt ships with the kit in `packages/ui/src/components/gantt/`, built on `date-fns` and `@date-fns/tz`, already installed. Its strings come from the `gantt` labels.

```showcase-example
c-gantt-1
```

## Usage

```tsx
import { Gantt } from "@workspace/ui/components/gantt/gantt";
import { GanttNav } from "@workspace/ui/components/gantt/gantt-nav";
import type { GanttEvent, GanttResource } from "@workspace/ui/components/gantt/gantt-types";
import { GanttView } from "@workspace/ui/components/gantt/gantt-view";
```

```tsx
const RESOURCES: GanttResource[] = [
	{
		id: "design",
		title: "Design",
		children: [
			{ id: "wireframes", title: "Wireframes" },
			{ id: "visual-design", title: "Visual design" },
		],
	},
];

const EVENTS: GanttEvent[] = [
	{ id: "1", title: "Wireframes", start: new Date("2026-07-06"), end: new Date("2026-07-10"), allDay: true, resourceId: "wireframes", progress: 60 },
];

<Gantt defaultEvents={EVENTS} resources={RESOURCES} defaultScale="month" className="h-[480px]">
	<GanttNav />
	<GanttView />
</Gantt>;
```

Give the root an explicit height: it is a flex column with no minimum height, and the view fills whatever it gets. The root also sets the type scale, so every label inherits its size.

## Examples

### Drag to reorder rows

```showcase-example
c-gantt-2
```

### Quarter roadmap

```showcase-example
c-gantt-3
```

### Capacity board

```showcase-example
c-gantt-4
```

### Baseline tracking

```showcase-example
c-gantt-6
```

### Dependencies and milestones

```showcase-example
c-gantt-7
```

### Working days

```showcase-example
c-gantt-8
```

## API Reference

```showcase-api

```

## Accessibility

- The resource pane is a tree navigable with the arrow keys; bars are focusable and can be moved and resized from the keyboard.
- Bars carry accessible names with their dates in words; navigation buttons are labelled from the `gantt` messages.
