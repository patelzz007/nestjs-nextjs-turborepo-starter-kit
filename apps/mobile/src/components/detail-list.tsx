// Label/value pairs ("Signed in: 3 Oct 2026"). Values are rendered as text,
// never as markup (client-reported device details included).

import * as React from "react";
import { Text, View } from "react-native";

export interface DetailItem {
	readonly label: string;
	readonly value: string;
}

export interface DetailListProps {
	readonly items: readonly DetailItem[];
}

export function DetailList({ items }: DetailListProps): React.JSX.Element {
	return (
		<View className="gap-1">
			{items.map((item: DetailItem): React.JSX.Element => (
				<View key={item.label} className="flex-row flex-wrap gap-1" accessible accessibilityLabel={`${item.label}: ${item.value}`}>
					<Text className="font-sans text-sm text-muted-foreground">{item.label}:</Text>
					<Text className="shrink font-sans text-sm text-foreground">{item.value}</Text>
				</View>
			))}
		</View>
	);
}
