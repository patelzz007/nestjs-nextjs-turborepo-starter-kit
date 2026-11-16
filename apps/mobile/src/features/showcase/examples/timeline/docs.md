## Installation

`TimelineRailItem` ships with the kit in `packages/ui-native/src/components/timeline-rail.tsx`; there is nothing to install.

```showcase-example
c-timeline-1
```

## Usage

```tsx
import { TimelineRailIcon, TimelineRailItem } from "@workspace/ui-native/components/timeline-rail";
```

```tsx
<TimelineRailItem node={<TimelineRailIcon icon={CheckIcon} tone="success" />} isLast>
	<Text>{TITLE}</Text>
</TimelineRailItem>
```

## Stages

```showcase-example
c-timeline-3
```

```showcase-example
c-timeline-6
```

## Activity

```showcase-example
c-timeline-4
```

```showcase-example
c-timeline-11
```

## Horizontal

```showcase-example
c-timeline-8
```

```showcase-example
c-timeline-12
```

## API Reference

```showcase-api

```

## Accessibility

- Nodes are hidden from screen readers: the entry says what happened.
- Give each entry a title and a time in text.
