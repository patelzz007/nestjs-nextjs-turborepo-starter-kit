import { TimelineRailItem } from "@workspace/ui-native/components/timeline-rail";
import * as React from "react";
import { Text, View } from "react-native";

interface Entry {
	readonly key: string;
	readonly title: string;
}

const ENTRIES: readonly Entry[] = [
	{ key: "a", title: "Something happened" },
	{ key: "b", title: "Something else happened" },
	{ key: "c", title: "Another thing" },
];
export function TimelineDont1Example(): React.JSX.Element {
	return (
		<View>
			{ENTRIES.map((entry: Entry, index: number): React.JSX.Element => (
				<TimelineRailItem key={entry.key} node={<View className="mt-1 size-3 rounded-full bg-border" />} isLast={index === ENTRIES.length - 1}>
					<Text className="text-body font-sans text-foreground">{entry.title}</Text>
				</TimelineRailItem>
			))}
		</View>
	);
}
