// Parts of a whole ("your claims by status"): one bar split into its parts,
// each part as wide as its share, a 2 pt surface gap between them, and the
// legend under it (share-legend.tsx). Parts of zero are listed in the legend
// but take no room in the bar.
//
// Presentational: the caller orders the parts, picks each one's chart colour
// (fixed per part, never by rank) and formats every number.

import * as React from "react";
import { View } from "react-native";

import { CHART_COLOR_CLASSES } from "./chart-colors";
import { describeShares, ShareLegend, type ShareSegment } from "./share-legend";

export type { ShareSegment };

export interface ShareBarProps {
	/** What the bar shows ("Claims by status"): its accessible name. */
	readonly title: string;
	readonly segments: readonly ShareSegment[];
	readonly testID?: string;
}

export function ShareBar({ title, segments, testID }: ShareBarProps): React.JSX.Element {
	const filled = segments.filter((segment: ShareSegment): boolean => segment.value > 0);
	return (
		<View className="gap-4" testID={testID}>
			<View className="h-3 flex-row gap-0.5 overflow-hidden rounded-full bg-muted" accessible accessibilityLabel={`${title}: ${describeShares(segments)}`}>
				{filled.map((segment: ShareSegment): React.JSX.Element => (
					<SharePart key={segment.key} segment={segment} />
				))}
			</View>
			<ShareLegend segments={segments} />
		</View>
	);
}

interface SharePartProps {
	readonly segment: ShareSegment;
}

/** A part of the bar, growing in proportion to its value. */
function SharePart({ segment }: SharePartProps): React.JSX.Element {
	const style = React.useMemo((): { readonly flexGrow: number } => ({ flexGrow: segment.value }), [segment.value]);
	return <View style={style} className={`basis-0 ${CHART_COLOR_CLASSES[segment.color].fill}`} testID={`share-part-${segment.key}`} />;
}
