// Parts of a whole as a ring ("when you spend"): each part an arc as long as
// its share, clockwise from 12 o'clock in the caller's order, a 2 pt surface
// gap between parts, and the whole named in the middle ("RM 1,204.50 spent").
// The legend under it (share-legend.tsx) carries every name and number, so
// the ring is never the only way to read a part. Best for two to five parts
// with a fixed colour each; more than that belongs in a ranked list.
//
// Presentational: the caller orders the parts, picks each one's chart colour
// (fixed per part, never by rank) and formats every number.

import * as React from "react";
import { Text, View } from "react-native";
import { Path } from "react-native-svg";

import { arcPath, ringSpans, type ArcSpan, type ChartPoint } from "../lib/chart-geometry";
import { CHART_COLOR_CLASSES } from "./chart-colors";
import { describeShares, ShareLegend, type ShareSegment } from "./share-legend";
import { SvgLayer } from "./svg-layer";

export interface DonutChartProps {
	/** What the ring shows ("When you spend"): its accessible name. */
	readonly title: string;
	readonly segments: readonly ShareSegment[];
	/** The whole, in the middle ("RM 1,204.50"). */
	readonly centerValue: string;
	/** Under it ("spent"). */
	readonly centerLabel: string;
	readonly testID?: string;
}

/** Side of the ring's box, in points. */
const RING_SIZE = 176;
/** The ring's thickness. */
const RING_WIDTH = 22;
const RADIUS = (RING_SIZE - RING_WIDTH) / 2;
const CENTER: ChartPoint = { x: RING_SIZE / 2, y: RING_SIZE / 2 };
/** The surface gap between parts (2 pt), as a share of a turn at the ring's middle. */
const GAP_POINTS = 2;
const GAP_TURN = GAP_POINTS / (2 * Math.PI * RADIUS);

export function DonutChart({ title, segments, centerValue, centerLabel, testID }: DonutChartProps): React.JSX.Element {
	const spans = ringSpans(
		segments.map((segment: ShareSegment): number => segment.value),
		GAP_TURN,
	);
	return (
		<View className="gap-4" testID={testID}>
			<View className="size-44 self-center" accessible accessibilityLabel={`${title}: ${centerValue} ${centerLabel}. ${describeShares(segments)}`}>
				<SvgLayer width={RING_SIZE} height={RING_SIZE} colorClassName="accent-muted">
					<Path d={arcPath(CENTER, RADIUS, { start: 0, end: 1 })} fill="none" stroke="currentColor" strokeWidth={RING_WIDTH} />
				</SvgLayer>
				{segments.map((segment: ShareSegment, index: number): React.JSX.Element | null => {
					const span: ArcSpan | null = spans.at(index) ?? null;
					return span === null ? null : (
						<SvgLayer
							key={segment.key}
							width={RING_SIZE}
							height={RING_SIZE}
							colorClassName={CHART_COLOR_CLASSES[segment.color].accent}
							{...(testID === undefined ? {} : { testID: `${testID}-${segment.key}` })}>
							<Path d={arcPath(CENTER, RADIUS, span)} fill="none" stroke="currentColor" strokeWidth={RING_WIDTH} />
						</SvgLayer>
					);
				})}
				<View className="absolute inset-0 items-center justify-center px-8" importantForAccessibility="no-hide-descendants">
					<Text className="font-sans-semibold text-xl text-foreground" numberOfLines={1} adjustsFontSizeToFit>
						{centerValue}
					</Text>
					<Text className="font-sans text-xs text-muted-foreground">{centerLabel}</Text>
				</View>
			</View>
			<ShareLegend segments={segments} />
		</View>
	);
}
