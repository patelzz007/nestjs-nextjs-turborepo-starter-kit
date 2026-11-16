import { cn } from "@workspace/ui-native/lib/cn";
import { TimelineRailItem } from "@workspace/ui-native/components/timeline-rail";
import * as React from "react";
import { Text, View } from "react-native";

interface Entry {
	readonly key: string;
	readonly date: string;
	readonly verb: string;
	readonly what: string;
	readonly dot: string;
}

const ENTRIES: readonly Entry[] = [
	{ key: "e1", date: "NOV 14", verb: "Shipped", what: "dark mode for charts", dot: "bg-success" },
	{ key: "e2", date: "NOV 02", verb: "Started", what: "the new billing page", dot: "bg-info" },
	{ key: "e3", date: "OCT 21", verb: "Planned", what: "team permissions", dot: "bg-tone-violet" },
];
export function Timeline7Example(): React.JSX.Element {
	return (
		<View>
			{ENTRIES.map((entry: Entry, index: number): React.JSX.Element => (
				<TimelineRailItem key={entry.key} node={<View className={cn("mt-1.5 size-2 rounded-full", entry.dot)} />} isLast={index === ENTRIES.length - 1} size="sm">
					<Text className="text-overline font-sans-semibold text-muted-foreground uppercase">{entry.date}</Text>
					<Text className="text-body font-sans text-foreground">
						<Text className="text-muted-foreground">{`${entry.verb} `}</Text>
						{entry.what}
					</Text>
				</TimelineRailItem>
			))}
		</View>
	);
}
