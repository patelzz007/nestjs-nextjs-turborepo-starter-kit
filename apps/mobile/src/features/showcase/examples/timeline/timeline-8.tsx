import { cn } from "@workspace/ui-native/lib/cn";
import { TimelineRailItem } from "@workspace/ui-native/components/timeline-rail";
import * as React from "react";
import { Text, View } from "react-native";

interface Phase {
	readonly key: string;
	readonly date: string;
	readonly title: string;
	readonly text: string;
	readonly done: boolean;
}

const PHASES: readonly Phase[] = [
	{ key: "discover", date: "Q1", title: "Discover", text: "Research and interviews.", done: true },
	{ key: "design", date: "Q2", title: "Design", text: "Flows and prototypes.", done: true },
	{ key: "deliver", date: "Q3", title: "Deliver", text: "Build and launch.", done: false },
];

export function Timeline8Example(): React.JSX.Element {
	return (
		<View className="flex-row">
			{PHASES.map((phase: Phase, index: number): React.JSX.Element => (
				<TimelineRailItem
					key={phase.key}
					orientation="horizontal"
					isLast={index === PHASES.length - 1}
					node={<View className={cn("size-3 rounded-full border-2", phase.done ? "border-primary bg-primary" : "border-border bg-card")} />}>
					<Text className="text-body font-sans-semibold text-foreground">{phase.title}</Text>
					<Text className="text-caption font-sans text-muted-foreground">{phase.text}</Text>
				</TimelineRailItem>
			))}
		</View>
	);
}
