import { ColorPicker, ColorPickerSwatch } from "@workspace/ui-native/components/color-picker";
import * as React from "react";
import { View } from "react-native";

/** How many recent picks the row keeps. */
const RECENT_LIMIT = 8;

export function ColorPicker9Example(): React.JSX.Element {
	const [color, setColor] = React.useState<string>("#3b82f6");
	const [recent, setRecent] = React.useState<readonly string[]>(["#ef4444", "#22c55e"]);
	const pick = React.useCallback((next: string): void => {
		setColor(next);
		setRecent((current: readonly string[]): readonly string[] => [next, ...current.filter((hex: string): boolean => hex !== next)].slice(0, RECENT_LIMIT));
	}, []);
	return (
		<View className="gap-3">
			<ColorPicker value={color} onChange={pick} showInput={false} />
			<View accessibilityLabel="Recent colours" className="flex-row flex-wrap gap-2">
				{recent.map((hex: string): React.JSX.Element => (
					<ColorPickerSwatch key={hex} color={hex} onPress={pick} size="sm" />
				))}
			</View>
		</View>
	);
}
