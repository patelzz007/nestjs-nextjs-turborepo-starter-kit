## Installation

The timeline parts ship with the kit in `packages/ui/src/components/timeline.tsx`; there is nothing to install.

```showcase-example
c-timeline-1
```

## Usage

```tsx
import { Timeline, TimelineContent, TimelineDate, TimelineHeader, TimelineIndicator, TimelineItem, TimelineSeparator, TimelineTitle } from "@workspace/ui/components/timeline";
```

```tsx
<Timeline value={2}>
	<TimelineItem step={1}>
		<TimelineHeader>
			<TimelineDate>March 2026</TimelineDate>
			<TimelineTitle>Project started</TimelineTitle>
		</TimelineHeader>
		<TimelineIndicator />
		<TimelineSeparator />
		<TimelineContent>The repository and the first architecture were set up.</TimelineContent>
	</TimelineItem>
	{/* …more items */}
</Timeline>
```

## Examples

### Roadmap

```showcase-example
c-timeline-2
```

### Order status

```showcase-example
c-timeline-3
```

### Horizontal

```showcase-example
c-timeline-8
```

### Deployment log

```showcase-example
c-timeline-10
```

## API Reference

```showcase-api

```

## Accessibility

- Items render in reading order; dates, titles and content are text.
- Completed state is styling: say it in words (a badge or text) when it matters.
