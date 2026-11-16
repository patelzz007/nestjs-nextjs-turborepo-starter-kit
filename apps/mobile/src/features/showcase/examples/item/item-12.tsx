import { Avatar } from "@workspace/ui-native/components/avatar";
import { Badge, type BadgeTone } from "@workspace/ui-native/components/badge";
import { Item, ItemActions, ItemGroup, ItemMedia, ItemTitle } from "@workspace/ui-native/components/item";
import * as React from "react";
import { Text, View } from "react-native";

import { ALEX, EMILY, SARAH, type SamplePerson } from "./item-sample";

interface Activity {
	readonly id: string;
	readonly person: SamplePerson;
	readonly action: string;
	readonly target: string;
	readonly tone: BadgeTone;
	readonly time: string;
}

const ACTIVITIES: readonly Activity[] = [
	{ id: "activity-1", person: SARAH, action: "deployed", target: "v2.4.1 to production", tone: "success", time: "5 min ago" },
	{ id: "activity-2", person: { ...ALEX, name: "Marcus Johnson" }, action: "merged", target: "feat/dark-mode into main", tone: "info", time: "32 min ago" },
	{ id: "activity-3", person: EMILY, action: "opened", target: "issue #284: Fix mobile nav", tone: "warning", time: "1 hour ago" },
];

export function Item12Example(): React.JSX.Element {
	return (
		<ItemGroup size="xs">
			{ACTIVITIES.map((activity: Activity): React.JSX.Element => (
				<Item key={activity.id} variant="outline" size="xs">
					<ItemMedia>
						<Avatar name={activity.person.name} imageUrl={activity.person.imageUrl} size="sm" />
					</ItemMedia>
					<View className="flex-1 gap-1" accessible accessibilityLabel={`${activity.person.name} ${activity.action} ${activity.target}, ${activity.time}`}>
						<ItemTitle>{activity.person.name}</ItemTitle>
						<View className="flex-row flex-wrap items-center gap-1">
							<Badge label={activity.action} tone={activity.tone} variant="light" size="sm" />
							<Text className="text-caption shrink font-sans text-muted-foreground">{activity.target}</Text>
						</View>
					</View>
					<ItemActions>
						<Text className="text-caption font-sans text-muted-foreground">{activity.time}</Text>
					</ItemActions>
				</Item>
			))}
		</ItemGroup>
	);
}
