import { Textarea } from "@workspace/ui-native/components/textarea";
import { completeShortcode, type EmojiPickerEmoji, openShortcodeOf, replaceShortcodes, searchEmojis } from "@workspace/ui-native/lib/emoji-picker";
import * as React from "react";
import { Pressable, Text, View } from "react-native";

import { ENGLISH_EMOJI } from "./emoji-data";

/** How many matches the suggestion list shows. */
const SUGGESTION_COUNT = 5;

interface SuggestionProps {
	readonly emoji: EmojiPickerEmoji;
	readonly onPick: (emoji: EmojiPickerEmoji) => void;
}

function Suggestion({ emoji, onPick }: SuggestionProps): React.JSX.Element {
	const pick = React.useCallback((): void => {
		onPick(emoji);
	}, [emoji, onPick]);
	const [code = emoji.id] = emoji.shortcodes;
	return (
		<Pressable accessibilityRole="button" accessibilityLabel={emoji.label} onPress={pick} className="min-h-11 flex-row items-center gap-3 px-3 active:bg-muted">
			<Text className="text-h3">{emoji.emoji}</Text>
			<Text className="text-body font-mono text-foreground">{`:${code}:`}</Text>
		</Pressable>
	);
}

export function EmojiPicker6Example(): React.JSX.Element {
	const [text, setText] = React.useState("");
	const code = openShortcodeOf(text);
	const matches = code === null ? [] : searchEmojis(ENGLISH_EMOJI.emojis, code, { limit: SUGGESTION_COUNT });
	const change = React.useCallback((next: string): void => {
		// A closed code (`:tada:`) swaps for its emoji as soon as it is typed.
		setText(replaceShortcodes(next, ENGLISH_EMOJI.emojis));
	}, []);
	const pick = React.useCallback((emoji: EmojiPickerEmoji): void => {
		setText((current: string): string => completeShortcode(current, emoji.emoji));
	}, []);
	return (
		<View className="gap-2">
			<Textarea value={text} onChange={change} placeholder="Type : and a few letters, like :tad" accessibilityLabel="Message" />
			{matches.length === 0 ? null : (
				<View accessibilityRole="list" className="rounded-card overflow-hidden border border-border bg-popover">
					{matches.map((emoji: EmojiPickerEmoji): React.JSX.Element => (
						<Suggestion key={emoji.id} emoji={emoji} onPick={pick} />
					))}
				</View>
			)}
		</View>
	);
}
