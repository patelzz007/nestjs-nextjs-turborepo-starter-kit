// A row of headline numbers ("Stars 42", "Commits 1,204"), wrapping onto more
// rows on narrow screens. Presentational and data-agnostic — the caller
// formats each value. Each tile is read by screen readers as "label: value".

import * as React from "react";
import { Text, View } from "react-native";

export interface StatTile {
	readonly label: string;
	readonly value: string;
}

export interface StatTilesProps {
	readonly items: readonly StatTile[];
	readonly testID?: string;
}

export function StatTiles({ items, testID }: StatTilesProps): React.JSX.Element {
	return (
		<View className="flex-row flex-wrap gap-2" testID={testID}>
			{items.map((item: StatTile): React.JSX.Element => (
				<View key={item.label} accessible accessibilityLabel={`${item.label}: ${item.value}`} className="min-w-20 grow gap-0.5 rounded-lg bg-muted px-3 py-2">
					<Text className="font-sans-semibold text-lg text-foreground">{item.value}</Text>
					<Text className="font-sans text-xs text-muted-foreground">{item.label}</Text>
				</View>
			))}
		</View>
	);
}
