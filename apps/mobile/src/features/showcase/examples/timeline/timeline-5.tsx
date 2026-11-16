import { cn } from "@workspace/ui-native/lib/cn";
import * as React from "react";
import { Text, View } from "react-native";

interface Milestone {
	readonly key: string;
	readonly date: string;
	readonly title: string;
}

const MILESTONES: readonly Milestone[] = [
	{ key: "seed", date: "2022", title: "Founded" },
	{ key: "first", date: "2023", title: "First customer" },
	{ key: "series", date: "2024", title: "Series A" },
	{ key: "global", date: "2026", title: "Global launch" },
];

function Side({ milestone }: { readonly milestone: Milestone }): React.JSX.Element {
	return (
		<View className="flex-1 gap-0.5 px-3">
			<Text className="text-caption font-sans text-muted-foreground">{milestone.date}</Text>
			<Text className="text-body font-sans-semibold text-foreground">{milestone.title}</Text>
		</View>
	);
}

export function Timeline5Example(): React.JSX.Element {
	return (
		<View>
			<View className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-border" />
			{MILESTONES.map((milestone: Milestone, index: number): React.JSX.Element => {
				const left = index % 2 === 0;
				return (
					<View key={milestone.key} accessible accessibilityLabel={`${milestone.date}: ${milestone.title}`} className="flex-row items-center py-3">
						{left ? <Side milestone={milestone} /> : <View className="flex-1" />}
						<View className={cn("size-3 rounded-full border-2 border-primary bg-card")} />
						{left ? <View className="flex-1" /> : <Side milestone={milestone} />}
					</View>
				);
			})}
		</View>
	);
}
