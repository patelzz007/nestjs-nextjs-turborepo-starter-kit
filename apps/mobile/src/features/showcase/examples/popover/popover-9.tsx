import { Popover } from "@workspace/ui-native/components/popover";
import * as React from "react";
import { Pressable, Text, View } from "react-native";

const ZONES: readonly { readonly zone: string; readonly time: string }[] = [
	{ zone: "UTC", time: "Sun, 15 Nov 2026, 09:42" },
	{ zone: "New York", time: "Sun, 15 Nov 2026, 04:42" },
	{ zone: "Tokyo", time: "Sun, 15 Nov 2026, 18:42" },
];

const TIME_CONTENT = (
	<View className="gap-2">
		{ZONES.map((entry): React.JSX.Element => (
			<View key={entry.zone} className="flex-row justify-between gap-3">
				<Text className="text-body font-sans text-muted-foreground">{entry.zone}</Text>
				<Text className="text-body font-mono text-foreground">{entry.time}</Text>
			</View>
		))}
	</View>
);

export function Popover9Example(): React.JSX.Element {
	return (
		<View className="flex-row flex-wrap items-center">
			<Text className="text-body font-sans text-foreground">Deployed </Text>
			<Popover content={TIME_CONTENT} accessibilityLabel="Deploy time in time zones" size="lg">
				<Pressable accessibilityRole="button" accessibilityLabel="3 hours ago">
					<Text className="text-body border-b border-dashed border-muted-foreground font-sans text-foreground">3 hours ago</Text>
				</Pressable>
			</Popover>
			<Text className="text-body font-sans text-foreground"> by Ava.</Text>
		</View>
	);
}
