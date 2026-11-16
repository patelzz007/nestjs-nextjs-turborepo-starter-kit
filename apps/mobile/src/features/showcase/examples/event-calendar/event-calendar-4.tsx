import type { CalendarEvent, EventCalendarOccurrence, EventCalendarTone } from "@workspace/ui-kit-logic";
import { EventCalendar } from "@workspace/ui-native/components/event-calendar";
import { Icon, type LucideIcon } from "@workspace/ui-native/components/icon";
import CodeIcon from "lucide-react-native/icons/code";
import CompassIcon from "lucide-react-native/icons/compass";
import MegaphoneIcon from "lucide-react-native/icons/megaphone";
import PaletteIcon from "lucide-react-native/icons/palette";
import * as React from "react";
import { Text, View } from "react-native";

import { SAMPLE_CLOCK, sampleDay, ToneLegend } from "./event-calendar-sample";

type Track = "design" | "engineering" | "marketing" | "product";

/** One source of truth per track: its tone, its legend label and its icon. */
const TRACKS: Readonly<Record<Track, { readonly label: string; readonly tone: EventCalendarTone; readonly icon: LucideIcon }>> = {
	design: { label: "Design", tone: "violet", icon: PaletteIcon },
	engineering: { label: "Engineering", tone: "blue", icon: CodeIcon },
	marketing: { label: "Marketing", tone: "orange", icon: MegaphoneIcon },
	product: { label: "Product", tone: "teal", icon: CompassIcon },
};

const LEGEND = Object.values(TRACKS);
const MONDAY = 1;

/** The sample week's Monday, counted from its Sunday. */
const WEEK = 1;

function span(id: string, title: string, startOffset: number, endOffset: number, track: Track): CalendarEvent {
	return { id, title, start: sampleDay(WEEK + startOffset), end: sampleDay(WEEK + endOffset), allDay: true, color: TRACKS[track].tone, data: track };
}

/** A month of cross-functional work: multi-day project bars. */
const EVENTS: readonly CalendarEvent[] = [
	span("onboarding", "Onboarding revamp", -2, 1, "product"),
	span("design-sprint", "Design sprint", 1, 4, "design"),
	span("api-migration", "API migration", 2, 6, "engineering"),
	span("user-research", "User research", 3, 5, "product"),
	span("brand-refresh", "Brand refresh", 8, 10, "design"),
	span("launch", "Launch campaign", 9, 13, "marketing"),
	span("roadmap", "Roadmap review", 15, 16, "engineering"),
];

function trackOf(occurrence: EventCalendarOccurrence): (typeof TRACKS)[Track] | undefined {
	const [, track] = Object.entries(TRACKS).find(([key]): boolean => key === occurrence.event.data) ?? [];
	return track;
}

/** A custom chip: the track's icon before the title. */
function renderChip(occurrence: EventCalendarOccurrence): React.ReactNode {
	const track = trackOf(occurrence);
	if (track === undefined) {
		return undefined;
	}
	return (
		<View className="flex-row items-center gap-1 rounded-sm bg-muted px-1">
			<Icon icon={track.icon} size="xs" colorClassName="accent-foreground" />
			<Text numberOfLines={1} className="text-overline flex-1 font-sans text-foreground">
				{occurrence.event.title}
			</Text>
		</View>
	);
}

// A Monday-first month of project bars, each led by its track's icon, with a legend below.
export function EventCalendar4Example(): React.JSX.Element {
	return (
		<View className="w-full gap-3">
			<EventCalendar events={EVENTS} defaultView="month" weekStartsOn={MONDAY} clock={SAMPLE_CLOCK} renderEvent={renderChip} />
			<ToneLegend entries={LEGEND} />
		</View>
	);
}
