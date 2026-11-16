## Installation

`Gantt` ships with the kit in `packages/ui-native/src/components/gantt.tsx`; there is nothing to install.

```showcase-example
c-gantt-1
```

## Usage

```tsx
import { Gantt } from "@workspace/ui-native/components/gantt";
```

```tsx
<Gantt defaultEvents={bars} resources={rows} defaultScale="month" onEventUpdate={save} />
```

## Reordering rows

```showcase-example
c-gantt-2
```

## Roadmaps

```showcase-example
c-gantt-3
```

## Capacity

```showcase-example
c-gantt-4
```

## Task details

```showcase-example
c-gantt-5
```

## Plan against actual

```showcase-example
c-gantt-6
```

## Dependencies and milestones

```showcase-example
c-gantt-7
```

## Working days

```showcase-example
c-gantt-8
```

## API Reference

```showcase-api

```

## Accessibility

- Each bar is a button that reads its title, dates, row and progress; its actions move it or change its length.
- Changes and reorders are announced.
- Group rows' fold buttons say what they fold.
