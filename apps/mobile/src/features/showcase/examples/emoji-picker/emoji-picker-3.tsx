import { Button } from "@workspace/ui-native/components/button";
import { EmojiPicker } from "@workspace/ui-native/components/emoji-picker";
import { cn } from "@workspace/ui-native/lib/cn";
import type { EmojiPickerSelection } from "@workspace/ui-native/lib/emoji-picker";
import * as React from "react";
import { Pressable, Text, View } from "react-native";

import { ENGLISH_EMOJI } from "./emoji-data";

interface Reaction {
	readonly emoji: string;
	readonly count: number;
	readonly mine: boolean;
}

const INITIAL: readonly Reaction[] = [
	{ emoji: "👍", count: 4, mine: false },
	{ emoji: "👍🏽", count: 2, mine: true },
	{ emoji: "🎉", count: 3, mine: false },
];

/** The one tap reactions above the search. */
const QUICK: readonly string[] = ["👍", "❤️", "😂", "🎉", "😮", "🙏"];

/** Adds my reaction, or takes it back when I already gave it. */
function toggleReaction(reactions: readonly Reaction[], emoji: string): readonly Reaction[] {
	const found = reactions.find((reaction: Reaction): boolean => reaction.emoji === emoji);
	if (found === undefined) {
		return [...reactions, { emoji, count: 1, mine: true }];
	}
	return reactions
		.map((reaction: Reaction): Reaction => (reaction.emoji === emoji ? { emoji, count: reaction.count + (reaction.mine ? -1 : 1), mine: !reaction.mine } : reaction))
		.filter((reaction: Reaction): boolean => reaction.count > 0);
}

interface PillProps {
	readonly reaction: Reaction;
	readonly onToggle: (emoji: string) => void;
}

function ReactionPill({ reaction, onToggle }: PillProps): React.JSX.Element {
	const toggle = React.useCallback((): void => {
		onToggle(reaction.emoji);
	}, [onToggle, reaction.emoji]);
	const state = React.useMemo(() => ({ selected: reaction.mine }), [reaction.mine]);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`${reaction.emoji} ${String(reaction.count)}`}
			accessibilityState={state}
			onPress={toggle}
			className={cn("h-8 flex-row items-center gap-1 rounded-full border px-2.5", reaction.mine ? "border-primary bg-primary/10" : "border-border bg-card")}>
			<Text className="text-body">{reaction.emoji}</Text>
			<Text className="text-caption font-sans-medium text-foreground tabular-nums">{String(reaction.count)}</Text>
		</Pressable>
	);
}

interface QuickProps {
	readonly emoji: string;
	readonly onToggle: (emoji: string) => void;
}

function QuickReaction({ emoji, onToggle }: QuickProps): React.JSX.Element {
	const toggle = React.useCallback((): void => {
		onToggle(emoji);
	}, [emoji, onToggle]);
	return <Button label={emoji} variant="ghost" size="sm" onPress={toggle} accessibilityLabel={`React with ${emoji}`} />;
}

export function EmojiPicker3Example(): React.JSX.Element {
	const [reactions, setReactions] = React.useState<readonly Reaction[]>(INITIAL);
	const toggle = React.useCallback((emoji: string): void => {
		setReactions((current: readonly Reaction[]): readonly Reaction[] => toggleReaction(current, emoji));
	}, []);
	const pick = React.useCallback(
		(selection: EmojiPickerSelection): void => {
			toggle(selection.value);
		},
		[toggle],
	);
	const quick = (
		<View className="flex-row justify-between">
			{QUICK.map((emoji: string): React.JSX.Element => (
				<QuickReaction key={emoji} emoji={emoji} onToggle={toggle} />
			))}
		</View>
	);
	return (
		<View className="rounded-card gap-3 border border-border bg-card p-3">
			<Text className="text-body font-sans text-foreground">The release notes are up. Have a read before Friday!</Text>
			<View className="flex-row flex-wrap items-center gap-1.5">
				{reactions.map((reaction: Reaction): React.JSX.Element => (
					<ReactionPill key={reaction.emoji} reaction={reaction} onToggle={toggle} />
				))}
				<EmojiPicker label="Add reaction" data={ENGLISH_EMOJI} value={null} onSelect={pick} header={quick} triggerVariant="ghost" />
			</View>
		</View>
	);
}
