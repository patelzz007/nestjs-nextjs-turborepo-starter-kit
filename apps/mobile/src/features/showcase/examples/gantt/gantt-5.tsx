import type { GanttEvent, GanttResource } from "@workspace/ui-kit-logic";
import { Avatar } from "@workspace/ui-native/components/avatar";
import { Badge, type BadgeTone } from "@workspace/ui-native/components/badge";
import { Button } from "@workspace/ui-native/components/button";
import { Gantt } from "@workspace/ui-native/components/gantt";
import PlusIcon from "lucide-react-native/icons/plus";
import * as React from "react";
import { Text, View } from "react-native";

import { SAMPLE_CLOCK, sampleBar } from "./gantt-sample";

type TaskStatus = "Done" | "In progress" | "Not started";

interface TaskMeta {
	readonly owner: string;
	readonly status: TaskStatus;
}

const STATUS_TONES: Readonly<Record<TaskStatus, BadgeTone>> = { Done: "success", "In progress": "info", "Not started": "neutral" };

const INITIAL_RESOURCES: readonly GanttResource[] = [
	{
		id: "planning",
		title: "Planning",
		children: [
			{ id: "requirements", title: "Requirements" },
			{ id: "design-phase", title: "Design" },
		],
	},
	{
		id: "build",
		title: "Build",
		children: [
			{ id: "frontend", title: "Frontend" },
			{ id: "backend", title: "Backend" },
		],
	},
	{
		id: "launch",
		title: "Launch",
		children: [
			{ id: "qa", title: "QA & Testing" },
			{ id: "rollout", title: "Rollout" },
		],
	},
];

/** Owner and status per task, by row id: a row holds only its title, so the example keeps the rest. */
const INITIAL_META: ReadonlyMap<string, TaskMeta> = new Map([
	["requirements", { owner: "Ada Lovelace", status: "Done" }],
	["design-phase", { owner: "Grace Hopper", status: "Done" }],
	["frontend", { owner: "Alan Turing", status: "In progress" }],
	["backend", { owner: "Linus Torvalds", status: "In progress" }],
	["qa", { owner: "Katherine Johnson", status: "Not started" }],
	["rollout", { owner: "Margaret Hamilton", status: "Not started" }],
]);

/** A status report: read-only bars. */
const BARS: readonly GanttEvent[] = [
	sampleBar("requirements", "Requirements", -10, 8, "blue", 100),
	sampleBar("design-phase", "Design", -8, 8, "teal", 100),
	sampleBar("frontend", "Frontend", -2, 10, "violet", 60),
	sampleBar("backend", "Backend", 0, 10, "red", 45),
	sampleBar("qa", "QA & Testing", 8, 8, "yellow", 0),
	sampleBar("rollout", "Rollout", 14, 5, "green", 0),
].map((bar): GanttEvent => ({ ...bar, readOnly: true }));

// The tree column shows each task's owner and status beside its name; the toolbar adds a task to Launch.
export function Gantt5Example(): React.JSX.Element {
	const [resources, setResources] = React.useState<readonly GanttResource[]>(INITIAL_RESOURCES);
	const [meta, setMeta] = React.useState<ReadonlyMap<string, TaskMeta>>(INITIAL_META);
	const renderTask = React.useCallback(
		(resource: GanttResource): React.ReactNode => {
			const task = meta.get(resource.id);
			if (task === undefined) {
				return undefined;
			}
			return (
				<View className="gap-0.5">
					<Text numberOfLines={1} className="text-label font-sans text-foreground">
						{resource.title}
					</Text>
					<View className="flex-row items-center gap-1.5">
						<Avatar name={task.owner} imageUrl={null} size="sm" />
						<Badge label={task.status} tone={STATUS_TONES[task.status]} variant="light" size="sm" />
					</View>
				</View>
			);
		},
		[meta],
	);
	const addTask = React.useCallback((): void => {
		const id = `task-${String(meta.size + 1)}`;
		setResources((current): readonly GanttResource[] =>
			current.map((group): GanttResource => (group.id === "launch" ? { ...group, children: [...(group.children ?? []), { id, title: "New task" }] } : group)),
		);
		setMeta((current): ReadonlyMap<string, TaskMeta> => new Map(current).set(id, { owner: "Unassigned", status: "Not started" }));
	}, [meta.size]);
	const toolbar = <Button label="Add task" icon={PlusIcon} size="sm" variant="outline" onPress={addTask} />;
	return <Gantt defaultEvents={BARS} resources={resources} defaultScale="month" clock={SAMPLE_CLOCK} renderResource={renderTask} treeWidth="lg" toolbarContent={toolbar} />;
}
