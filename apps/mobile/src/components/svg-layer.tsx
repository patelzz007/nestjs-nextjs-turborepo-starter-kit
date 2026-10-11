// One colour layer of a chart: an SVG the size of the plot whose marks are
// drawn in `currentColor`, coloured by an `accent-*` token utility through
// `colorClassName` (like Icon and BrandMark). A chart stacks layers — the
// grid, each series, the scrub line — so every mark takes its colour from the
// theme on screen, never from a colour value in code. Layers never take
// touches: the chart's own overlay does.

import * as React from "react";
import { StyleSheet } from "react-native";
import Svg from "react-native-svg";
import { withUniwind } from "uniwind";

interface LayerProps {
	readonly width: number;
	readonly height: number;
	/** Filled in by Uniwind from `colorClassName`; unresolved, the marks keep the default colour. */
	readonly color?: string | undefined;
	readonly children: React.ReactNode;
	readonly testID?: string | undefined;
}

function Layer({ width, height, color, children, testID }: LayerProps): React.JSX.Element {
	return (
		<Svg
			width={width}
			height={height}
			pointerEvents="none"
			style={StyleSheet.absoluteFill}
			{...(color === undefined ? {} : { color })}
			{...(testID === undefined ? {} : { testID })}>
			{children}
		</Svg>
	);
}

/** Maps `colorClassName` (an `accent-*` token utility) onto the layer's `color`. */
const ThemedLayer = withUniwind(Layer);

export interface SvgLayerProps {
	readonly width: number;
	readonly height: number;
	/** An `accent-*` token utility: `accent-chart-1`, `accent-border`, … */
	readonly colorClassName: string;
	/** `Path` / `Circle` / `Line` marks painted with `currentColor`. */
	readonly children: React.ReactNode;
	readonly testID?: string;
}

export function SvgLayer({ width, height, colorClassName, children, testID }: SvgLayerProps): React.JSX.Element {
	return (
		<ThemedLayer width={width} height={height} colorClassName={colorClassName} testID={testID}>
			{children}
		</ThemedLayer>
	);
}
