// A tappable row in a settings list: a label, an optional value or
// description, and a chevron for navigation.

import * as React from "react";
import { Pressable, Text, View } from "react-native";

export interface ListRowProps {
	readonly label: string;
	readonly onPress: () => void;
	/** The current setting, shown at the end of the row ("Dark", "On"). */
	readonly value?: string;
	readonly description?: string;
	/** Something visual under the label (coloured line counts); say what it shows in `accessibilityLabel`. */
	readonly detail?: React.ReactNode;
	/** Overrides the accessible name (defaults to the label and the value). */
	readonly accessibilityLabel?: string;
	readonly accessibilityHint?: string;
	readonly testID?: string;
}

export function ListRow({ label, onPress, value, description, detail, accessibilityLabel, accessibilityHint, testID }: ListRowProps): React.JSX.Element {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel ?? (value === undefined ? label : `${label}, ${value}`)}
			accessibilityHint={accessibilityHint}
			onPress={onPress}
			testID={testID}
			className="min-h-12 flex-row items-center gap-3 py-3 active:opacity-70">
			<View className="flex-1 gap-0.5">
				<Text className="font-sans text-base text-foreground">{label}</Text>
				{description === undefined ? null : <Text className="font-sans text-sm text-muted-foreground">{description}</Text>}
				{detail}
			</View>
			{value === undefined ? null : <Text className="font-sans text-base text-muted-foreground">{value}</Text>}
			<Text className="font-sans text-lg text-muted-foreground" importantForAccessibility="no" accessibilityElementsHidden>
				›
			</Text>
		</Pressable>
	);
}
