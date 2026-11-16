import { Button } from "@workspace/ui-native/components/button";
import { EmojiPicker } from "@workspace/ui-native/components/emoji-picker";
import { Textarea } from "@workspace/ui-native/components/textarea";
import type { EmojiPickerCategory, EmojiPickerSelection } from "@workspace/ui-native/lib/emoji-picker";
import * as React from "react";
import { Text, View } from "react-native";

import { ENGLISH_EMOJI } from "./emoji-data";

/** Categories left out of a workplace set. */
const LEFT_OUT: readonly EmojiPickerCategory[] = ["nature", "food", "travel", "flags"];
const SPACE_BEFORE = /\S$/u;

/** `text` with `emoji` added, spaced off the word before it. */
function insertSpaced(text: string, emoji: string): string {
	return `${text}${SPACE_BEFORE.test(text) ? " " : ""}${emoji} `;
}

export function EmojiPicker7Example(): React.JSX.Element {
	const [text, setText] = React.useState("");
	const [posted, setPosted] = React.useState<string | null>(null);
	const pick = React.useCallback((selection: EmojiPickerSelection): void => {
		setText((current: string): string => insertSpaced(current, selection.value));
	}, []);
	const post = React.useCallback((): void => {
		setPosted(text.trim());
		setText("");
	}, [text]);
	const undo = React.useCallback((): void => {
		setText(posted ?? "");
		setPosted(null);
	}, [posted]);
	return (
		<View className="gap-2">
			<Textarea value={text} onChange={setText} placeholder="Share an update with the team" accessibilityLabel="Update" />
			<View className="flex-row items-center gap-2">
				<EmojiPicker label="Emoji" data={ENGLISH_EMOJI} value={null} onSelect={pick} excludeCategories={LEFT_OUT} keepOpen />
				<View className="flex-1" />
				<Button label="Post" disabled={text.trim().length === 0} onPress={post} />
			</View>
			{posted === null ? null : (
				<View className="flex-row items-center gap-2">
					<Text className="text-body flex-1 font-sans text-muted-foreground">{`Posted: ${posted}`}</Text>
					<Button label="Undo" variant="link" size="sm" onPress={undo} />
				</View>
			)}
		</View>
	);
}
