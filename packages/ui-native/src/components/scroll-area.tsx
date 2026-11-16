// A bounded scroll container (the web kit's `ScrollArea`): a list of tags in a
// short column, a row of photos that pans sideways, a table that pans both
// ways. Its edges can fade while content is hidden past them (`fadeEdges`),
// telling people there is more; the fades follow the scroll, appearing only on
// the sides that hide something. `gutter` pads the content on the scrollbar's
// side once it overflows, keeping the bar clear of it.
//
// Presentational: the caller sizes it (`className`, e.g. `h-72` or `w-full`)
// and passes the content. The fades are drawn in the colour of the surface it
// sits on (`surface`). The ref reaches the scroll view.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, ScrollView, type ScrollViewInstance, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useCSSVariable } from "uniwind";
import { z } from "zod";

import { cn } from "../lib/cn";

export const scrollAreaVariants = cva("overflow-hidden", {
	variants: {
		/** `plain`: no frame; `outline`: a bordered, rounded box. */
		variant: { plain: "", outline: "rounded-card border border-border" },
	},
	defaultVariants: { variant: "plain" },
});

const scrollAreaFadeVariants = cva("absolute", {
	variants: {
		edge: { top: "top-0 right-0 left-0 h-6", bottom: "right-0 bottom-0 left-0 h-6", start: "top-0 bottom-0 left-0 w-6", end: "top-0 right-0 bottom-0 w-6" },
	},
	defaultVariants: { edge: "top" },
});

type ScrollAreaVariantProps = VariantProps<typeof scrollAreaVariants>;
export type ScrollAreaVariant = NonNullable<ScrollAreaVariantProps["variant"]>;
export type ScrollAreaOrientation = "vertical" | "horizontal" | "both";
export type ScrollAreaSurface = "background" | "card" | "popover";

const ColorSchema = z.string();
/** How close to an edge (in points) counts as being at it. */
const EDGE_SLOP = 1;
const FADE_SOLID = 1;
const FADE_CLEAR = 0;
/** How often (ms) the fades follow the scroll. */
const SCROLL_THROTTLE_MS = 16;
const SVG_ID_UNSAFE = /[^\w-]/gu;

export interface ScrollAreaProps {
	readonly children: React.ReactNode;
	readonly orientation?: ScrollAreaOrientation | undefined;
	/** Fade the edges that hide content. */
	readonly fadeEdges?: boolean | undefined;
	/** The surface under the area: the fades are drawn in its colour. Default `background`. */
	readonly surface?: ScrollAreaSurface | undefined;
	/** Pad the content on the scrollbar's side once it overflows. */
	readonly gutter?: boolean | undefined;
	/** Show the scrollbar(s). Default `true`. */
	readonly showScrollbar?: boolean | undefined;
	readonly variant?: ScrollAreaVariant | undefined;
	/** Names the region for screen readers. */
	readonly accessibilityLabel?: string | undefined;
	/** Extra classes for the frame (give it a height or width), merged last. */
	readonly className?: string | undefined;
	/** Extra classes for the content, merged last. */
	readonly contentClassName?: string | undefined;
	readonly testID?: string | undefined;
}

interface Hidden {
	readonly top: boolean;
	readonly bottom: boolean;
	readonly start: boolean;
	readonly end: boolean;
}

const NOTHING_HIDDEN: Hidden = { top: false, bottom: false, start: false, end: false };

/** Which edges hide content, from the scroll position and the sizes. */
export function hiddenEdgesOf(
	offset: { readonly x: number; readonly y: number },
	content: { readonly width: number; readonly height: number },
	frame: { readonly width: number; readonly height: number },
): Hidden {
	return {
		top: offset.y > EDGE_SLOP,
		bottom: offset.y + frame.height < content.height - EDGE_SLOP,
		start: offset.x > EDGE_SLOP,
		end: offset.x + frame.width < content.width - EDGE_SLOP,
	};
}

interface FadeProps {
	readonly edge: keyof Hidden;
	readonly color: string;
}

/** A gradient from the surface colour to clear, toward the content. */
function Fade({ edge, color }: FadeProps): React.JSX.Element {
	const id = `scroll-fade-${edge}-${React.useId().replace(SVG_ID_UNSAFE, "")}`;
	const vertical = edge === "top" || edge === "bottom";
	const fromSolid = edge === "top" || edge === "start";
	return (
		<View pointerEvents="none" className={scrollAreaFadeVariants({ edge })}>
			<Svg width="100%" height="100%">
				<Defs>
					<LinearGradient id={id} x1="0" y1="0" x2={vertical ? "0" : "1"} y2={vertical ? "1" : "0"}>
						<Stop offset="0" stopColor={color} stopOpacity={fromSolid ? FADE_SOLID : FADE_CLEAR} />
						<Stop offset="1" stopColor={color} stopOpacity={fromSolid ? FADE_CLEAR : FADE_SOLID} />
					</LinearGradient>
				</Defs>
				<Rect width="100%" height="100%" fill={`url(#${id})`} />
			</Svg>
		</View>
	);
}

export const ScrollArea = React.memo(
	React.forwardRef<ScrollViewInstance, ScrollAreaProps>(function ScrollArea(
		{
			children,
			orientation = "vertical",
			fadeEdges = false,
			surface = "background",
			gutter = false,
			showScrollbar = true,
			variant = "plain",
			accessibilityLabel,
			className,
			contentClassName,
			testID,
		},
		ref,
	): React.JSX.Element {
		const color = ColorSchema.safeParse(useCSSVariable(`--color-${surface}`)).data;
		const [frame, setFrame] = React.useState({ width: 0, height: 0 });
		const [content, setContent] = React.useState({ width: 0, height: 0 });
		const [offset, setOffset] = React.useState({ x: 0, y: 0 });
		const measureFrame = React.useCallback((event: LayoutChangeEvent): void => {
			const { width, height } = event.nativeEvent.layout;
			setFrame({ width, height });
		}, []);
		const measureContent = React.useCallback((width: number, height: number): void => {
			setContent({ width, height });
		}, []);
		const follow = React.useCallback((event: NativeSyntheticEvent<NativeScrollEvent>): void => {
			const { x, y } = event.nativeEvent.contentOffset;
			setOffset({ x, y });
		}, []);
		const hidden = frame.width === 0 ? NOTHING_HIDDEN : hiddenEdgesOf(offset, content, frame);
		const overflows = orientation === "horizontal" ? content.width > frame.width : content.height > frame.height;
		const horizontal = orientation === "horizontal";
		const inner =
			orientation === "both" ? (
				<ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={showScrollbar} onScroll={follow} scrollEventThrottle={SCROLL_THROTTLE_MS}>
					<View>{children}</View>
				</ScrollView>
			) : (
				children
			);
		return (
			<View onLayout={measureFrame} testID={testID === undefined ? undefined : `${testID}-frame`} className={cn(scrollAreaVariants({ variant }), className)}>
				<ScrollView
					ref={ref}
					horizontal={horizontal}
					accessibilityLabel={accessibilityLabel}
					showsVerticalScrollIndicator={showScrollbar}
					showsHorizontalScrollIndicator={showScrollbar}
					onScroll={follow}
					onContentSizeChange={measureContent}
					scrollEventThrottle={SCROLL_THROTTLE_MS}
					testID={testID}
					contentContainerClassName={cn(gutter && overflows ? (horizontal ? "pb-3" : "pr-3") : undefined, contentClassName)}>
					{inner}
				</ScrollView>
				{fadeEdges && color !== undefined ? (
					<>
						{hidden.top && !horizontal ? <Fade edge="top" color={color} /> : null}
						{hidden.bottom && !horizontal ? <Fade edge="bottom" color={color} /> : null}
						{hidden.start && orientation !== "vertical" ? <Fade edge="start" color={color} /> : null}
						{hidden.end && orientation !== "vertical" ? <Fade edge="end" color={color} /> : null}
					</>
				) : null}
			</View>
		);
	}),
);
