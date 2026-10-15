// One change and the lines it touched: a title, a line of context, and the
// lines added (+) and deleted (−) — optionally after a leading visual (who made
// it: an avatar). Presentational and data-agnostic — the caller formats the
// text and the counts. With `onPress` the row is a link
// (it opens the change elsewhere); without, it is plain text.

import * as React from "react";
import { Pressable, Text, View } from "react-native";

import { LineCounts } from "./line-counts";

export interface ChangeRowProps {
	readonly title: string;
	/** Context under the title ("octocat · 2 hours ago"). */
	readonly meta: string;
	/** Formatted count of lines added ("1,204"). */
	readonly additions: string;
	/** Formatted count of lines deleted. */
	readonly deletions: string;
	/** Read with the counts by screen readers ("120 lines added, 30 deleted"). */
	readonly changeSummary: string;
	/** Drawn before the title (an avatar); decorative — the label already names the change. */
	readonly leading?: React.ReactNode;
	readonly onPress?: () => void;
	readonly accessibilityHint?: string;
	readonly testID?: string;
}

export function ChangeRow({ title, meta, additions, deletions, changeSummary, leading, onPress, accessibilityHint, testID }: ChangeRowProps): React.JSX.Element {
	const content = (
		<>
			{leading === undefined ? null : (
				<View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
					{leading}
				</View>
			)}
			<View className="flex-1 gap-0.5">
				<Text className="font-sans-medium text-base text-foreground" numberOfLines={2}>
					{title}
				</Text>
				<Text className="font-sans text-sm text-muted-foreground" numberOfLines={1}>
					{meta}
				</Text>
			</View>
			<LineCounts additions={additions} deletions={deletions} direction="column" />
		</>
	);
	const label = `${title}. ${meta}. ${changeSummary}`;
	const rowClassName = "min-h-12 flex-row items-center gap-3 border-b border-border py-3";
	if (onPress === undefined) {
		return (
			<View accessible accessibilityLabel={label} className={rowClassName} testID={testID}>
				{content}
			</View>
		);
	}
	return (
		<Pressable
			accessibilityRole="link"
			accessibilityLabel={label}
			accessibilityHint={accessibilityHint}
			onPress={onPress}
			className={`${rowClassName} active:opacity-70`}
			testID={testID}>
			{content}
		</Pressable>
	);
}
