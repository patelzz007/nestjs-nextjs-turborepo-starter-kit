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

const PHASES: readonly Phase[] = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"].map((month: string, index: number): Phase => ({
	key: month,
	date: month,
	title: `${month} milestone`,
	text: "A long description that cannot fit.",
	done: index < 3,
}));

export function TimelineDont2Example(): React.JSX.Element {
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
