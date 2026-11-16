import { EmojiPickerPanel } from "@workspace/ui-native/components/emoji-picker";
import type { EmojiPickerSelection } from "@workspace/ui-native/lib/emoji-picker";
import * as React from "react";
import { Text, View } from "react-native";

import { ENGLISH_EMOJI } from "./emoji-data";

export function EmojiPicker1Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>(null);
	const pick = React.useCallback((selection: EmojiPickerSelection): void => {
		setValue(selection.value);
	}, []);
	return (
		<View className="gap-2">
			<EmojiPickerPanel data={ENGLISH_EMOJI} value={value} onSelect={pick} variant="card" />
			<Text className="text-body font-sans text-muted-foreground">{value === null ? "Nothing picked yet." : `Picked: ${value}`}</Text>
		</View>
	);
}
