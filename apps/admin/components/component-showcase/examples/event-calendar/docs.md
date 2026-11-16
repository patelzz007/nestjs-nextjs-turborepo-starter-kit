## Installation

The event calendar ships with the kit in `packages/ui/src/components/event-calendar/`, built on `date-fns` and `@date-fns/tz`, already installed. Its strings come from the `eventCalendar` labels.

```showcase-example
c-event-calendar-1
```

## Usage

```tsx
import { EventCalendar } from "@workspace/ui/components/event-calendar/event-calendar";
import { EventCalendarContent } from "@workspace/ui/components/event-calendar/event-calendar-content";
import { EventCalendarNav } from "@workspace/ui/components/event-calendar/event-calendar-nav";
import type { CalendarEvent } from "@workspace/ui/components/event-calendar/event-calendar-types";
```

```tsx
const [events, setEvents] = React.useState<CalendarEvent[]>(initialEvents);

<EventCalendar events={events} onEventsChange={setEvents} defaultView="week" className="h-[600px]">
	<EventCalendarNav />
	<EventCalendarContent />
</EventCalendar>;
```

Pass `defaultEvents` for uncontrolled state or `events` with `onEventsChange` for controlled state; the same pairing exists for `view`, `date`, `dayCount`, `selection`, `interactions` and `viewSettings`.

## Examples

### Room bookings

```showcase-example
c-event-calendar-2
```

### Event form dialog

```showcase-example
c-event-calendar-3
```

### Custom event chips

```showcase-example
c-event-calendar-4
```

### Drag to book

```showcase-example
c-event-calendar-5
```

## API Reference

```showcase-api

```

## Accessibility

- Events and time slots are focusable; navigation buttons and view switches are labelled from the `eventCalendar` messages.
- Event chips carry accessible names with their times in words.
