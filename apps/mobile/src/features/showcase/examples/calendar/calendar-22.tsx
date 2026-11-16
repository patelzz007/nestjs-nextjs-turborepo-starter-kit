import type { LocalDate } from "@workspace/shared";
import PlusIcon from "lucide-react-native/icons/plus";
import { Button } from "@workspace/ui-native/components/button";
import { cn } from "@workspace/ui-native/lib/cn";
import { Calendar } from "@workspace/ui-native/components/calendar";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress, SAMPLE_LOCALE, SAMPLE_MAX_DATE, SAMPLE_MIN_DATE, SAMPLE_TODAY } from "../example-support";

interface CalendarEvent {
	readonly id: string;
	readonly day: LocalDate;
	readonly title: string;
	readonly time: string;
	readonly bar: string;
}

const EVENTS: readonly CalendarEvent[] = [
	{ id: "standup", day: "2026-11-15", title: "Team standup", time: "09:00 – 09:15", bar: "bg-info" },
	{ id: "review", day: "2026-11-15", title: "Design review", time: "11:00 – 12:00", bar: "bg-tone-violet" },
	{ id: "lunch", day: "2026-11-15", title: "Lunch with Sam", time: "12:30 – 13:30", bar: "bg-success" },
	{ id: "planning", day: "2026-11-17", title: "Sprint planning", time: "10:00 – 11:30", bar: "bg-warning" },
	{ id: "retro", day: "2026-11-20", title: "Retrospective", time: "16:00 – 17:00", bar: "bg-destructive" },
];

function eventsOn(day: LocalDate): readonly CalendarEvent[] {
	return EVENTS.filter((event: CalendarEvent): boolean => event.day === day);
}

/** A dot under each day that has events. */
function EventDot(day: LocalDate): React.JSX.Element | null {
	return eventsOn(day).length === 0 ? null : <View className="size-1 rounded-full bg-primary" />;
}

function describeEvents(day: LocalDate): string | undefined {
	const count = eventsOn(day).length;
	return count === 0 ? undefined : `${String(count)} ${count === 1 ? "event" : "events"}`;
}

function EventRow({ event }: { readonly event: CalendarEvent }): React.JSX.Element {
	return (
		<View className="flex-row gap-3">
			<View className={cn("w-1 rounded-full", event.bar)} />
			<View className="flex-1 gap-0.5 py-1">
				<Text className="text-body font-sans-medium text-foreground">{event.title}</Text>
				<Text className="text-caption font-sans text-muted-foreground">{event.time}</Text>
			</View>
		</View>
	);
}

export function Calendar22Example(): React.JSX.Element {
	const [day, setDay] = React.useState<LocalDate | null>(SAMPLE_TODAY);
	const shown = day === null ? [] : eventsOn(day);
	return (
		<View className="rounded-card gap-3 border border-border bg-card p-3">
			<Calendar
				today={SAMPLE_TODAY}
				minDate={SAMPLE_MIN_DATE}
				maxDate={SAMPLE_MAX_DATE}
				locale={SAMPLE_LOCALE}
				value={day}
				onChange={setDay}
				renderDayFooter={EventDot}
				describeDay={describeEvents}
			/>
			<View className="gap-2 border-t border-border pt-3">
				{shown.length === 0 ? <Text className="text-body font-sans text-muted-foreground">No events.</Text> : null}
				{shown.map((event: CalendarEvent): React.JSX.Element => (
					<EventRow key={event.id} event={event} />
				))}
				<Button label="Add event" icon={PlusIcon} variant="outline" size="sm" onPress={ignorePress} />
			</View>
		</View>
	);
}
