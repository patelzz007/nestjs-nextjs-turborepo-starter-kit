// A layered isometric illustration with a glyph (its children) printed on the
// front layer — for empty states, feature callouts and rich list media (the
// web kit's `IconStack`, ported from ReUI). Three translucent layers step up
// and to the right over a soft shadow, in the tone's colour, filled with the
// screen's background.
//
// react-native-svg takes colour values, not classes, so the tone and the fill
// are read from the theme (`useCSSVariable`); until the stylesheet resolves
// them the stack draws nothing rather than a wrong colour. Decorative: hidden
// from screen readers — the copy around it carries the meaning. The ref
// reaches the root view.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { View, type ViewInstance, type ViewStyle } from "react-native";
import Svg, { Ellipse, G, Path } from "react-native-svg";
import { useCSSVariable } from "uniwind";
import { z } from "zod";

import { cn } from "../lib/cn";

const ColorSchema = z.string();

export const iconStackVariants = cva("relative", {
	variants: {
		size: { xs: "h-12 w-11", sm: "h-16 w-14", md: "h-20 w-18", lg: "h-24 w-22", xl: "h-28 w-24" },
	},
	defaultVariants: { size: "md" },
});

/** The tone's colour token: the layers' edges and the shadow. */
const TONE_VARIABLES = {
	neutral: "--color-foreground",
	primary: "--color-primary",
	success: "--color-success",
	warning: "--color-warning",
	destructive: "--color-destructive",
	info: "--color-info",
} satisfies Readonly<Record<string, string>>;

export type IconStackTone = keyof typeof TONE_VARIABLES;
export type IconStackSize = NonNullable<VariantProps<typeof iconStackVariants>["size"]>;

interface LayerSpec {
	/** Opacity of the layer, back to front. */
	readonly opacity: number;
	/** Offset from the back layer, in viewBox units. */
	readonly x: number;
	readonly y: number;
	/** The front layer draws a slightly stronger edge. */
	readonly strokeOpacity: number;
}

/** Back to front: each layer steps up and to the right along the isometric axis. */
const LAYERS: readonly LayerSpec[] = [
	{ opacity: 0.4, x: 0, y: 0, strokeOpacity: 0.2 },
	{ opacity: 0.6, x: 13.65, y: 6.04, strokeOpacity: 0.2 },
	{ opacity: 0.8, x: 27.32, y: 12.08, strokeOpacity: 0.3 },
];

const LAYER_EDGE_PATH =
	"M42.2538 2.046C41.4408 1.6325 40.3965 1.6677 39.2612 2.2424L7.9616 18.1934C5.3895 19.5039 3.301 23.1064 3.301 26.2322V64.3226C3.301 66.0677 3.9458 67.2943 4.962 67.8199L1.8363 66.229C0.8201 65.7104 0.1753 64.4771 0.1753 62.732V24.6412C0.1753 21.5085 2.2638 17.913 4.8359 16.6024L36.1355 0.6515C37.2778 0.0698 38.322 0.0416 39.128 0.4551L42.2538 2.046Z";
const LAYER_FACE_PATH =
	"M42.2545 2.0456C43.2707 2.5643 43.9155 3.7979 43.9155 5.543V43.6337C43.9155 46.7665 41.827 50.3616 39.2549 51.6722L7.9554 67.6235C6.813 68.2052 5.7687 68.2331 4.9628 67.8196C3.9465 67.301 3.3018 66.0673 3.3018 64.3222V26.2318C3.3018 23.0991 5.3903 19.5036 7.9624 18.193L39.2619 2.2421C40.4043 1.6604 41.4486 1.6321 42.2545 2.0456Z";

const STROKE_WIDTH = 0.5;
const SHADOW_OPACITY = 0.055;

/** The front layer's face centre, where the content sits: printed onto it (narrowed and skewed with the face). */
const CONTENT_STYLE: ViewStyle = { left: "71%", top: "58%", transform: [{ scaleX: 0.9 }, { skewY: "-26deg" }] };

export interface IconStackProps {
	/** What is printed on the front layer: a glyph, or a small badge. */
	readonly children?: React.ReactNode;
	/** The layers' colour. Default `neutral`. */
	readonly tone?: IconStackTone | undefined;
	readonly size?: IconStackSize | undefined;
	/** Extra classes for the root, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** One layer: its edge and its face, filled with the background and outlined in the tone. */
function Layer({ layer, tone, fill }: { readonly layer: LayerSpec; readonly tone: string; readonly fill: string }): React.JSX.Element {
	return (
		<G opacity={layer.opacity} transform={`translate(${String(layer.x)} ${String(layer.y)})`}>
			<Path d={LAYER_EDGE_PATH} fill={fill} stroke={tone} strokeOpacity={layer.strokeOpacity} strokeWidth={STROKE_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
			<Path d={LAYER_FACE_PATH} fill={fill} stroke={tone} strokeOpacity={layer.strokeOpacity} strokeWidth={STROKE_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
		</G>
	);
}

export const IconStack = React.memo(
	React.forwardRef<ViewInstance, IconStackProps>(function IconStack({ children, tone = "neutral", size = "md", className, testID }, ref): React.JSX.Element {
		const toneColor = ColorSchema.safeParse(useCSSVariable(TONE_VARIABLES[tone])).data;
		const fill = ColorSchema.safeParse(useCSSVariable("--color-background")).data;
		return (
			<View ref={ref} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={testID} className={cn(iconStackVariants({ size }), className)}>
				{toneColor === undefined || fill === undefined ? null : (
					<Svg width="100%" height="100%" viewBox="0 0 72 81" fill="none">
						<Ellipse cx="36" cy="76" rx="30" ry="7" fill={toneColor} fillOpacity={SHADOW_OPACITY} />
						{LAYERS.map((layer: LayerSpec): React.JSX.Element => (
							<Layer key={layer.opacity} layer={layer} tone={toneColor} fill={fill} />
						))}
					</Svg>
				)}
				{children === undefined || children === null ? null : (
					<View pointerEvents="none" style={CONTENT_STYLE} className="absolute size-0 items-center justify-center">
						{children}
					</View>
				)}
			</View>
		);
	}),
);
