import ImagePlusIcon from "lucide-react-native/icons/smile-plus";
import { Button } from "@workspace/ui-native/components/button";
import { EmojiPicker } from "@workspace/ui-native/components/emoji-picker";
import type { EmojiPickerSelection } from "@workspace/ui-native/lib/emoji-picker";
import * as React from "react";
import { Text, View } from "react-native";

import { ENGLISH_EMOJI } from "./emoji-data";

const PAGE_TITLE = "Product roadmap";

export function EmojiPicker4Example(): React.JSX.Element {
	const [icon, setIcon] = React.useState<string | null>("🚀");
	const [picking, setPicking] = React.useState(false);
	const pick = React.useCallback((selection: EmojiPickerSelection): void => {
		setIcon(selection.value);
	}, []);
	const remove = React.useCallback((): void => {
		setIcon(null);
	}, []);
	const addIcon = React.useCallback((): void => {
		setPicking(true);
	}, []);
	return (
		<View className="gap-3">
			<Text className="text-caption font-sans text-muted-foreground">{`Workspace / ${icon ?? ""} ${PAGE_TITLE}`}</Text>
			{icon === null && !picking ? (
				<Button label="Add icon" icon={ImagePlusIcon} variant="ghost" size="sm" onPress={addIcon} className="self-start" />
			) : (
				<View className="flex-row items-end gap-2">
					<EmojiPicker label="Page icon" data={ENGLISH_EMOJI} value={icon} onSelect={pick} triggerVariant="ghost" triggerSize="lg" />
					{icon === null ? null : <Button label="Remove" variant="ghost" size="sm" onPress={remove} />}
				</View>
			)}
			<Text accessibilityRole="header" className="text-h2 font-heading text-foreground">
				{PAGE_TITLE}
			</Text>
		</View>
	);
}
