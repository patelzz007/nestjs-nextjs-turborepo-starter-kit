// How far a value is towards a target ("RM 412 of RM 600 budget"): a ring
// filled clockwise from 12 o'clock over a muted track, the value in the
// middle. Past the target the ring is full; the caller's words say by how
// much. Read by screen readers as a progress bar with its numbers.
//
// Presentational: the caller formats the value and writes the words.

import * as React from "react";
import { Text, View } from "react-native";
import { Path } from "react-native-svg";

import { arcPath, progressShare, type ChartPoint } from "../lib/chart-geometry";
import { CHART_COLOR_CLASSES, type ChartColor } from "./chart-colors";
import { SvgLayer } from "./svg-layer";

export interface ProgressRingProps {
	/** What the ring measures ("Monthly budget"): its accessible name. */
	readonly label: string;
	readonly value: number;
	/** The target; the ring is full at it. */
	readonly max: number;
	/** In the middle ("68%"). */
	readonly valueLabel: string;
	/** Under it ("used"). */
	readonly caption: string;
	/** Read with the numbers ("RM 412.30 of RM 600.00"). */
	readonly accessibilityValueText: string;
	readonly color?: ChartColor;
	readonly testID?: string;
}

/** Side of the ring's box, in points (`size-32`). */
const RING_SIZE = 128;
const RING_WIDTH = 12;
const RADIUS = (RING_SIZE - RING_WIDTH) / 2;
const CENTER: ChartPoint = { x: RING_SIZE / 2, y: RING_SIZE / 2 };

export function ProgressRing({ label, value, max, valueLabel, caption, accessibilityValueText, color = "chart-1", testID }: ProgressRingProps): React.JSX.Element {
	const share = progressShare(value, max);
	return (
		<View
			className="size-32"
			accessible
			accessibilityRole="progressbar"
			accessibilityLabel={label}
			accessibilityValue={{ min: 0, max, now: Math.min(Math.max(0, value), max), text: accessibilityValueText }}
			testID={testID}>
			<SvgLayer width={RING_SIZE} height={RING_SIZE} colorClassName="accent-muted">
				<Path d={arcPath(CENTER, RADIUS, { start: 0, end: 1 })} fill="none" stroke="currentColor" strokeWidth={RING_WIDTH} />
			</SvgLayer>
			{share > 0 ? (
				<SvgLayer width={RING_SIZE} height={RING_SIZE} colorClassName={CHART_COLOR_CLASSES[color].accent} {...(testID === undefined ? {} : { testID: `${testID}-arc` })}>
					<Path
						d={arcPath(CENTER, RADIUS, { start: 0, end: share })}
						fill="none"
						stroke="currentColor"
						strokeWidth={RING_WIDTH}
						strokeLinecap={share < 1 ? "round" : "butt"}
					/>
				</SvgLayer>
			) : null}
			<View className="absolute inset-0 items-center justify-center px-5" importantForAccessibility="no-hide-descendants">
				<Text className="font-sans-semibold text-2xl text-foreground" numberOfLines={1} adjustsFontSizeToFit>
					{valueLabel}
				</Text>
				<Text className="font-sans text-xs text-muted-foreground">{caption}</Text>
			</View>
		</View>
	);
}
