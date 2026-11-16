## Installation

`EventCalendar` ships with the kit in `packages/ui-native/src/components/event-calendar.tsx`; there is nothing to install.

```showcase-example
c-event-calendar-1
```

## Usage

```tsx
import { EventCalendar } from "@workspace/ui-native/components/event-calendar";
```

```tsx
<EventCalendar events={events} defaultView="month" onEventPress={open} onSelectSlot={book} />
```

## Resources

```showcase-example
c-event-calendar-2
```

## Creating and editing

```showcase-example
c-event-calendar-3
```

## Custom chips

```showcase-example
c-event-calendar-4
```

## Booking

```showcase-example
c-event-calendar-5
```

## API Reference

```showcase-api

```

## Accessibility

- Every event is a button that reads its title and time.
- Every day of the month is a button that says how many events it holds, and whether it is selected.
- The selected day's list is a live region.
