import { cn } from "@workspace/ui-native/lib/cn";
import { TimelineRailItem } from "@workspace/ui-native/components/timeline-rail";
import * as React from "react";
import { Text, View } from "react-native";

interface Entry {
	readonly key: string;
	readonly date: string;
	readonly title: string;
	readonly text: string;
	readonly done: boolean;
}

const ENTRIES: readonly Entry[] = [
	{ key: "plan", date: "Mar 2026", title: "Planning", text: "Scope and goals agreed with the team.", done: true },
	{ key: "build", date: "Jun 2026", title: "Building", text: "The first release is built and tested.", done: true },
	{ key: "launch", date: "Sep 2026", title: "Launch", text: "Public release and announcement.", done: false },
];
export function Timeline2Example(): React.JSX.Element {
	return (
		<View>
			{ENTRIES.map((entry: Entry, index: number): React.JSX.Element => (
				<TimelineRailItem
					key={entry.key}
					node={<View className={cn("mt-1 size-3 rounded-full border-2", entry.done ? "border-primary bg-primary" : "border-border bg-card")} />}
					isLast={index === ENTRIES.length - 1}>
					<View className="flex-row gap-3">
						<Text className="text-caption w-20 text-right font-sans text-muted-foreground">{entry.date}</Text>
						<View className="flex-1 gap-0.5">
							<Text className="text-body font-sans-semibold text-foreground">{entry.title}</Text>
							<Text className="text-body font-sans text-muted-foreground">{entry.text}</Text>
						</View>
					</View>
				</TimelineRailItem>
			))}
		</View>
	);
}
