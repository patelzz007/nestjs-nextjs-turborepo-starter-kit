// Lines added and deleted, as GitHub shows them: `+120` in green, `−30` in red.
// Visual only — the row it sits in says the counts in words for screen
// readers ("120 lines added, 30 deleted"), so these are hidden from them.

import * as React from "react";
import { Text, View } from "react-native";

export interface LineCountsProps {
	/** Already formatted ("1,204"). */
	readonly additions: string;
	readonly deletions: string;
	/** Side by side (a row's detail line) or stacked (a row's trailing column). */
	readonly direction?: "row" | "column";
	readonly testID?: string;
}

export function LineCounts({ additions, deletions, direction = "row", testID }: LineCountsProps): React.JSX.Element {
	return (
		<View
			importantForAccessibility="no-hide-descendants"
			accessibilityElementsHidden
			testID={testID}
			className={direction === "row" ? "flex-row items-center gap-2" : "items-end gap-0.5"}>
			<Text className="font-mono text-sm text-success-foreground">+{additions}</Text>
			<Text className="font-mono text-sm text-destructive-foreground">−{deletions}</Text>
		</View>
	);
}
