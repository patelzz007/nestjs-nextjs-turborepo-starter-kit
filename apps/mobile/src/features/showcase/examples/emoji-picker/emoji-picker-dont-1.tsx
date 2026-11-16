import { EmojiPickerPanel } from "@workspace/ui-native/components/emoji-picker";
import type { EmojiPickerSelection } from "@workspace/ui-native/lib/emoji-picker";
import * as React from "react";
import { Text, View } from "react-native";

import { ENGLISH_EMOJI } from "./emoji-data";

export function EmojiPickerDont1Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>(null);
	const pick = React.useCallback((selection: EmojiPickerSelection): void => {
		setValue(selection.value);
	}, []);
	return (
		<View className="gap-2">
			<Text className="text-body font-sans-medium text-foreground">Status emoji</Text>
			<EmojiPickerPanel data={ENGLISH_EMOJI} value={value} onSelect={pick} />
		</View>
	);
}
