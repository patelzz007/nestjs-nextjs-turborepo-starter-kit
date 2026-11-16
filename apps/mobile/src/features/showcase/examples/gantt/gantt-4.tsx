import type { GanttEvent, GanttResource } from "@workspace/ui-kit-logic";
import { Avatar } from "@workspace/ui-native/components/avatar";
import { Button } from "@workspace/ui-native/components/button";
import { Gantt } from "@workspace/ui-native/components/gantt";
import PlusIcon from "lucide-react-native/icons/plus";
import * as React from "react";
import { Text, View } from "react-native";

import { SAMPLE_CLOCK, sampleBar, sampleDay } from "./gantt-sample";

/** Teammates grouped by squad. */
const RESOURCES: readonly GanttResource[] = [
	{
		id: "product-squad",
		title: "Product Squad",
		children: [
			{ id: "ada", title: "Ada Lovelace" },
			{ id: "alan", title: "Alan Turing" },
		],
	},
	{
		id: "design-squad",
		title: "Design Squad",
		children: [
			{ id: "grace", title: "Grace Hopper" },
			{ id: "linus", title: "Linus Torvalds" },
		],
	},
];

/** The web examples' portraits (images.unsplash.com). */
const PORTRAIT = "?w=96&h=96&dpr=2&q=80";
const AVATARS: ReadonlyMap<string, string> = new Map([
	["ada", `https://images.unsplash.com/photo-1519699047748-de8e457a634e${PORTRAIT}`],
	["alan", `https://images.unsplash.com/photo-1485206412256-701ccc5b93ca${PORTRAIT}`],
	["grace", `https://images.unsplash.com/photo-1485893086445-ed75865251e0${PORTRAIT}`],
	["linus", `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde${PORTRAIT}`],
]);

const PEOPLE: readonly string[] = ["ada", "alan", "grace", "linus"];

/** Assignments the toolbar hands out in turn, each two days long. */
const ASSIGNMENTS: readonly { readonly title: string; readonly color: string }[] = [
	{ title: "Bug triage", color: "yellow" },
	{ title: "Code review", color: "red" },
	{ title: "Spec draft", color: "teal" },
	{ title: "Pairing", color: "orange" },
];
const ASSIGNMENT_DAYS = 2;

const BARS: readonly GanttEvent[] = [
	sampleBar("ada", "Checkout API", -1, 3, "blue"),
	sampleBar("alan", "Search Indexing", 0, 3, "teal"),
	sampleBar("grace", "Dashboard Redesign", 1, 3, "violet"),
	sampleBar("linus", "Infra Migration", -2, 3, "green"),
];

/** People rows get their portrait; squad rows keep their plain title. */
function renderPerson(resource: GanttResource): React.ReactNode {
	const avatar = AVATARS.get(resource.id);
	if (avatar === undefined) {
		return undefined;
	}
	return (
		<View className="flex-row items-center gap-2">
			<Avatar name={resource.title} imageUrl={avatar} size="sm" />
			<Text numberOfLines={1} className="text-label flex-1 font-sans text-foreground">
				{resource.title}
			</Text>
		</View>
	);
}

// A week of capacity: weekends shaded, and each added assignment stacks into another lane on its teammate's row.
export function Gantt4Example(): React.JSX.Element {
	const [events, setEvents] = React.useState<readonly GanttEvent[]>(BARS);
	const [added, setAdded] = React.useState(0);
	const assign = React.useCallback((): void => {
		const person = PEOPLE.at(added % PEOPLE.length) ?? "ada";
		const assignment = ASSIGNMENTS.at(added % ASSIGNMENTS.length) ?? { title: "Task", color: "blue" };
		setEvents((current): readonly GanttEvent[] => [
			...current,
			{
				id: `assignment-${String(added)}`,
				title: assignment.title,
				start: sampleDay(added % ASSIGNMENT_DAYS),
				end: sampleDay((added % ASSIGNMENT_DAYS) + ASSIGNMENT_DAYS),
				allDay: true,
				color: assignment.color,
				resourceId: person,
			},
		]);
		setAdded((count): number => count + 1);
	}, [added]);
	const toolbar = <Button label="Add assignment" icon={PlusIcon} size="sm" variant="outline" onPress={assign} />;
	return (
		<Gantt
			events={events}
			onEventsChange={setEvents}
			resources={RESOURCES}
			defaultScale="week"
			clock={SAMPLE_CLOCK}
			offDays
			renderResource={renderPerson}
			treeWidth="lg"
			toolbarContent={toolbar}
		/>
	);
}
