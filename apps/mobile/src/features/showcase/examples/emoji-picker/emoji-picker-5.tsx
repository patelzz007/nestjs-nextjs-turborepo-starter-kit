import UsersIcon from "lucide-react-native/icons/users";
import { EmojiPicker, type EmojiPickerCustomCategory } from "@workspace/ui-native/components/emoji-picker";
import type { EmojiPickerCustomEmoji, EmojiPickerSelection } from "@workspace/ui-native/lib/emoji-picker";
import { Image } from "expo-image";
import * as React from "react";
import { Text, View } from "react-native";

import { ENGLISH_EMOJI } from "./emoji-data";

/** The team's own emoji: images, stored in posts as their colon codes. */
const TEAM_EMOJI: readonly EmojiPickerCustomEmoji[] = [
	{ id: "shipit", label: "ship it", src: "https://github.githubassets.com/images/icons/emoji/shipit.png", category: "team" },
	{ id: "octocat", label: "octocat", src: "https://github.githubassets.com/images/icons/emoji/octocat.png", category: "team" },
	{ id: "bowtie", label: "bowtie", src: "https://github.githubassets.com/images/icons/emoji/bowtie.png", category: "team" },
	{ id: "trollface", label: "troll face", src: "https://github.githubassets.com/images/icons/emoji/trollface.png", category: "team" },
];
const TEAM_CATEGORIES: readonly EmojiPickerCustomCategory[] = [{ id: "team", label: "Acme team", icon: UsersIcon }];
const FREQUENT: readonly string[] = ["👍", ":shipit:", "🎉"];
const CUSTOM_CODE = /^:(?<code>[\w+-]+):$/u;

/** A stored value drawn back: a team emoji's image, or the native emoji. */
function StoredEmoji({ value }: { readonly value: string }): React.JSX.Element {
	const code = CUSTOM_CODE.exec(value)?.groups?.code;
	const custom = TEAM_EMOJI.find((emoji: EmojiPickerCustomEmoji): boolean => emoji.id === code);
	return custom === undefined ? (
		<Text className="text-h2">{value}</Text>
	) : (
		<Image source={custom.src} accessibilityLabel={custom.label} contentFit="contain" className="size-7" />
	);
}

export function EmojiPicker5Example(): React.JSX.Element {
	const [posted, setPosted] = React.useState<readonly string[]>([]);
	const pick = React.useCallback((selection: EmojiPickerSelection): void => {
		setPosted((current: readonly string[]): readonly string[] => [...current, selection.value]);
	}, []);
	return (
		<View className="gap-3">
			<View className="flex-row items-center gap-3">
				<EmojiPicker
					label="React"
					data={ENGLISH_EMOJI}
					value={null}
					onSelect={pick}
					customEmoji={TEAM_EMOJI}
					customCategories={TEAM_CATEGORIES}
					customPosition="start"
					frequent={FREQUENT}
				/>
				<Text className="text-body flex-1 font-sans text-muted-foreground">{posted.length === 0 ? "Post a reaction." : `Stored as: ${posted.join(" ")}`}</Text>
			</View>
			<View className="flex-row flex-wrap gap-2">
				{posted.map((value: string, index: number): React.JSX.Element => (
					<StoredEmoji key={`${value}-${String(index)}`} value={value} />
				))}
			</View>
		</View>
	);
}
