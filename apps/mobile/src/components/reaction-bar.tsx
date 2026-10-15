// Emoji reactions under a comment, as GitHub draws them: one pill per emoji
// someone chose ("👍 2"), outlined in the primary colour when you are one of
// them, and a smiley button that opens the picker of every emoji. Tapping a
// pill adds or takes away your own. Presentational and data-agnostic: the
// caller passes the reactions, the choices and what a choice does; without
// `onToggle` the pills are shown only.

import FaceSmilePlusIcon from "lucide-react-native/icons/face-slightly-smiling-plus";
import * as React from "react";
import { Pressable, Text, View } from "react-native";

import { BottomSheet } from "./bottom-sheet";
import { Icon } from "./icon";

/** One reaction on something. */
export interface Reaction<TKey extends string> {
	readonly key: TKey;
	readonly count: number;
	/** You are one of those who chose it. */
	readonly mine: boolean;
}

/** One emoji the picker offers. */
export interface ReactionChoice<TKey extends string> {
	readonly key: TKey;
	readonly emoji: string;
	/** Its name, for screen readers ("thumbs up"). */
	readonly name: string;
}

export interface ReactionBarProps<TKey extends string> {
	readonly reactions: readonly Reaction<TKey>[];
	/** Every emoji, in the order the picker shows them. */
	readonly choices: readonly ReactionChoice<TKey>[];
	/** Sets your reaction on (`true`) or off; absent shows the reactions without letting you change them. */
	readonly onToggle?: ((key: TKey, mine: boolean) => void) | undefined;
	readonly testID?: string | undefined;
}

/** "1 person" / "3 people". */
function peopleCount(count: number): string {
	return count === 1 ? "1 person" : `${String(count)} people`;
}

export function ReactionBar<TKey extends string>({ reactions, choices, onToggle, testID }: ReactionBarProps<TKey>): React.JSX.Element | null {
	const [picking, setPicking] = React.useState(false);
	const choiceOf = React.useCallback((key: TKey): ReactionChoice<TKey> | undefined => choices.find((choice: ReactionChoice<TKey>): boolean => choice.key === key), [choices]);
	const open = React.useCallback((): void => {
		setPicking(true);
	}, []);
	const close = React.useCallback((): void => {
		setPicking(false);
	}, []);
	const pick = React.useCallback(
		(key: TKey): void => {
			setPicking(false);
			const current = reactions.find((reaction: Reaction<TKey>): boolean => reaction.key === key);
			onToggle?.(key, current?.mine !== true);
		},
		[onToggle, reactions],
	);

	if (reactions.length === 0 && onToggle === undefined) {
		return null;
	}
	return (
		<View className="flex-row flex-wrap items-center gap-2" testID={testID}>
			{reactions.map((reaction: Reaction<TKey>): React.JSX.Element | null => {
				const choice = choiceOf(reaction.key);
				return choice === undefined ? null : <ReactionPill key={reaction.key} reaction={reaction} choice={choice} onToggle={onToggle} />;
			})}
			{onToggle === undefined ? null : (
				<Pressable
					accessibilityRole="button"
					accessibilityLabel="Add a reaction"
					onPress={open}
					hitSlop={6}
					className="h-8 min-w-8 items-center justify-center rounded-full border border-border bg-card px-2 active:opacity-70">
					<Icon icon={FaceSmilePlusIcon} size="sm" colorClassName="accent-muted-foreground" />
				</Pressable>
			)}
			{onToggle === undefined ? null : (
				<BottomSheet visible={picking} title="Add a reaction" onClose={close} testID="reaction-picker">
					<View className="flex-row flex-wrap gap-y-3 pb-2">
						{choices.map((choice: ReactionChoice<TKey>): React.JSX.Element => (
							<PickerEmoji
								key={choice.key}
								choice={choice}
								mine={reactions.some((reaction: Reaction<TKey>): boolean => reaction.key === choice.key && reaction.mine)}
								onPick={pick}
							/>
						))}
					</View>
				</BottomSheet>
			)}
		</View>
	);
}

interface ReactionPillProps<TKey extends string> {
	readonly reaction: Reaction<TKey>;
	readonly choice: ReactionChoice<TKey>;
	readonly onToggle?: ((key: TKey, mine: boolean) => void) | undefined;
}

function ReactionPill<TKey extends string>({ reaction, choice, onToggle }: ReactionPillProps<TKey>): React.JSX.Element {
	const toggle = React.useCallback((): void => {
		onToggle?.(reaction.key, !reaction.mine);
	}, [onToggle, reaction.key, reaction.mine]);
	const label = `${choice.name}: ${peopleCount(reaction.count)}${reaction.mine ? ", including you" : ""}`;
	return (
		<Pressable
			accessibilityRole={onToggle === undefined ? "text" : "togglebutton"}
			accessibilityLabel={label}
			accessibilityState={{ checked: reaction.mine }}
			disabled={onToggle === undefined}
			onPress={toggle}
			hitSlop={6}
			className={`h-8 flex-row items-center gap-1.5 rounded-full border px-2.5 active:opacity-70 ${reaction.mine ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
			<Text className="text-sm">{choice.emoji}</Text>
			<Text className={`font-sans-medium text-sm ${reaction.mine ? "text-primary" : "text-muted-foreground"}`}>{String(reaction.count)}</Text>
		</Pressable>
	);
}

interface PickerEmojiProps<TKey extends string> {
	readonly choice: ReactionChoice<TKey>;
	readonly mine: boolean;
	readonly onPick: (key: TKey) => void;
}

/** One emoji in the picker, four to a row: 48 pt square, ringed when it is already yours (picking it then takes it away). */
function PickerEmoji<TKey extends string>({ choice, mine, onPick }: PickerEmojiProps<TKey>): React.JSX.Element {
	const pick = React.useCallback((): void => {
		onPick(choice.key);
	}, [choice.key, onPick]);
	return (
		<View className="w-1/4 items-center">
			<Pressable
				accessibilityRole="togglebutton"
				accessibilityLabel={choice.name}
				accessibilityState={{ checked: mine }}
				onPress={pick}
				className={`size-12 items-center justify-center rounded-xl border active:opacity-70 ${mine ? "border-primary bg-primary/10" : "border-transparent"}`}>
				<Text className="text-2xl">{choice.emoji}</Text>
			</Pressable>
		</View>
	);
}
