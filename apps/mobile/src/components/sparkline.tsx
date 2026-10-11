// A tiny trend line with no axes: the shape of a KPI over the range, beside
// its number. Decorative — the number and its change carry the meaning — so
// screen readers skip it. Stretches to its container's width.

import * as React from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { Path } from "react-native-svg";

import { linePath, pointsOf, type ChartPoint } from "../lib/chart-geometry";
import { CHART_COLOR_CLASSES, type ChartColor } from "./chart-colors";
import { SvgLayer } from "./svg-layer";

export interface SparklineProps {
	/** One value per bucket, in order. */
	readonly values: readonly number[];
	readonly color: ChartColor;
	readonly testID?: string;
}

/** Height of the line's box, in points. */
const SPARKLINE_HEIGHT = 28;
/** Room above and below the line for its stroke. */
const SPARKLINE_INSET = 2;
const SPARKLINE_WIDTH = 1.5;
/** The scale of an all-zero range: a flat line along the bottom. */
const EMPTY_SCALE_TOP = 1;

const styles = StyleSheet.create({
	box: { height: SPARKLINE_HEIGHT },
});

export function Sparkline({ values, color, testID }: SparklineProps): React.JSX.Element {
	const [width, setWidth] = React.useState(0);
	const measure = React.useCallback((event: LayoutChangeEvent): void => {
		setWidth(event.nativeEvent.layout.width);
	}, []);
	// The peak touches the top: a sparkline shows the shape, not the size.
	const top = Math.max(EMPTY_SCALE_TOP, ...values);
	const points = pointsOf(values, top, { width, height: SPARKLINE_HEIGHT - 2 * SPARKLINE_INSET }).map((point: ChartPoint): ChartPoint => ({
		x: point.x,
		y: point.y + SPARKLINE_INSET,
	}));

	return (
		<View style={styles.box} className="w-full" onLayout={measure} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden testID={testID}>
			{width > 0 ? (
				<SvgLayer width={width} height={SPARKLINE_HEIGHT} colorClassName={CHART_COLOR_CLASSES[color].accent} {...(testID === undefined ? {} : { testID: `${testID}-line` })}>
					<Path d={linePath(points)} fill="none" stroke="currentColor" strokeWidth={SPARKLINE_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
				</SvgLayer>
			) : null}
		</View>
	);
}
