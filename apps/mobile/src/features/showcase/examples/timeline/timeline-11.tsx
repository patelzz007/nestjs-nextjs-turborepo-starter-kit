import { Avatar } from "@workspace/ui-native/components/avatar";
import { TimelineRailItem } from "@workspace/ui-native/components/timeline-rail";
import * as React from "react";
import { Text, View } from "react-native";

interface Entry {
	readonly key: string;
	readonly name: string;
	readonly action: string;
	readonly target: string;
	readonly when: string;
}

const ENTRIES: readonly Entry[] = [
	{ key: "a1", name: "Ava Patel", action: "commented on", target: "Launch plan", when: "5m ago" },
	{ key: "a2", name: "Ben Ortiz", action: "assigned you", target: "Fix login bug", when: "1h ago" },
	{ key: "a3", name: "Chloe Kim", action: "closed", target: "Q3 review", when: "Yesterday" },
];
export function Timeline11Example(): React.JSX.Element {
	return (
		<View>
			{ENTRIES.map((entry: Entry, index: number): React.JSX.Element => (
				<TimelineRailItem key={entry.key} node={<Avatar name={entry.name} imageUrl={null} size="md" />} isLast={index === ENTRIES.length - 1}>
					<Text className="text-body font-sans text-foreground">
						<Text className="font-sans-semibold">{entry.name}</Text>
						<Text className="text-muted-foreground">{` ${entry.action} `}</Text>
						<Text className="font-sans-semibold">{entry.target}</Text>
					</Text>
					<Text className="text-caption font-sans text-muted-foreground">{entry.when}</Text>
				</TimelineRailItem>
			))}
		</View>
	);
}
