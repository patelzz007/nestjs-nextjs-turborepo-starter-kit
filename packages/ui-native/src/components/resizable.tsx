// Panels the user resizes by dragging the handle between them (the web kit's
// `Resizable`): a sidebar beside content, a header over a body, three panes
// in a row, groups nested in groups. Each handle trades size between the two
// panels beside it, never taking either below its minimum; for screen readers
// it is an adjustable control that steps the split by 5 points of a hundred.
//
// The handle is a plain line, a line with a grip, or a pill that grows and
// takes the primary colour while dragged (`handle`).
//
// Sizes are percentages of the group, in panel order. Controlled through
// `sizes` + `onSizesChange`, or the group's own state from `defaultSizes`;
// `onSizesChange` reports every move either way. The ref reaches the group.

import { cva } from "class-variance-authority";
import GripVerticalIcon from "lucide-react-native/icons/grip-vertical";
import GripHorizontalIcon from "lucide-react-native/icons/grip-horizontal";
import * as React from "react";
import { type AccessibilityActionEvent, type GestureResponderEvent, type LayoutChangeEvent, View, type ViewInstance, type ViewStyle } from "react-native";

import { cn } from "../lib/cn";
import { Icon } from "./icon";

export type ResizableDirection = "horizontal" | "vertical";
export type ResizableHandle = "line" | "grip" | "pill";

export const resizableGroupVariants = cva("overflow-hidden", {
	variants: {
		direction: { horizontal: "flex-row", vertical: "flex-col" },
		/** `outline`: a bordered, rounded box. */
		variant: { plain: "", outline: "rounded-card border border-border" },
	},
	defaultVariants: { direction: "horizontal", variant: "plain" },
});

/** The handle's touch area: 24 pt across the divider, the line in its middle. */
const resizableHandleVariants = cva("items-center justify-center", {
	variants: {
		direction: { horizontal: "-mx-3 w-6", vertical: "-my-3 h-6" },
	},
	defaultVariants: { direction: "horizontal" },
});

const resizableLineVariants = cva("absolute bg-border", {
	variants: {
		direction: { horizontal: "top-0 bottom-0 w-px", vertical: "right-0 left-0 h-px" },
		active: { true: "bg-primary", false: "" },
	},
	defaultVariants: { direction: "horizontal", active: false },
});

const resizablePillVariants = cva("rounded-full", {
	variants: {
		direction: { horizontal: "w-1.5", vertical: "h-1.5" },
		active: { true: "bg-primary", false: "bg-border" },
	},
	compoundVariants: [
		{ direction: "horizontal", active: false, className: "h-8" },
		{ direction: "horizontal", active: true, className: "h-16" },
		{ direction: "vertical", active: false, className: "w-8" },
		{ direction: "vertical", active: true, className: "w-16" },
	],
	defaultVariants: { direction: "horizontal", active: false },
});

const FULL = 100;
const STEP = 5;
const DEFAULT_MIN = 10;
const NO_SIZES: readonly number[] = [];
const NO_LABELS: readonly string[] = [];
const ADJUSTABLE_ACTIONS: readonly { readonly name: string }[] = [{ name: "increment" }, { name: "decrement" }];

/** `sizes` after the handle between panels `index` and `index + 1` moved `delta` points, each kept at or above its minimum. */
export function resizeAt(sizes: readonly number[], index: number, delta: number, minSizes: readonly number[]): readonly number[] {
	const before = sizes.at(index);
	const after = sizes.at(index + 1);
	if (before === undefined || after === undefined) {
		return sizes;
	}
	const pair = before + after;
	const minBefore = minSizes.at(index) ?? DEFAULT_MIN;
	const minAfter = minSizes.at(index + 1) ?? DEFAULT_MIN;
	const nextBefore = Math.min(Math.max(before + delta, minBefore), pair - minAfter);
	return sizes.map((size: number, at: number): number => {
		if (at === index) {
			return nextBefore;
		}
		return at === index + 1 ? pair - nextBefore : size;
	});
}

/** Equal shares, when no sizes are given. */
function equalSizes(count: number): readonly number[] {
	return Array.from({ length: count }, (): number => FULL / count);
}

export interface ResizablePanelProps {
	readonly children?: React.ReactNode;
	/** Extra classes for the panel, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** One pane of a group; its size is the group's. */
export const ResizablePanel = React.memo(function ResizablePanel({ children, className, testID }: ResizablePanelProps): React.JSX.Element {
	return (
		<View testID={testID} className={cn("flex-1 overflow-hidden", className)}>
			{children}
		</View>
	);
});

export interface ResizableGroupProps {
	/** The panels (`ResizablePanel`), in order. */
	readonly children: React.ReactNode;
	readonly direction?: ResizableDirection | undefined;
	readonly sizes?: readonly number[] | undefined;
	readonly defaultSizes?: readonly number[] | undefined;
	readonly onSizesChange?: ((sizes: readonly number[]) => void) | undefined;
	/** Each panel's least size, in points of a hundred. Default 10. */
	readonly minSizes?: readonly number[] | undefined;
	readonly handle?: ResizableHandle | undefined;
	readonly variant?: "plain" | "outline" | undefined;
	/** Names the panels for the handles' screen reader names ("Resize Files and Editor"). */
	readonly panelLabels?: readonly string[] | undefined;
	/** Extra classes for the group (give it a height), merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

interface HandleProps {
	readonly index: number;
	readonly direction: ResizableDirection;
	readonly kind: ResizableHandle;
	readonly length: number;
	readonly label: string;
	readonly value: number;
	readonly onResize: (index: number, delta: number) => void;
	readonly testID: string | undefined;
}

const ResizeHandle = React.memo(function ResizeHandle({ index, direction, kind, length, label, value, onResize, testID }: HandleProps): React.JSX.Element {
	const [dragging, setDragging] = React.useState(false);
	const [start, setStart] = React.useState(0);
	const positionOf = React.useCallback(
		(event: GestureResponderEvent): number => (direction === "horizontal" ? event.nativeEvent.pageX : event.nativeEvent.pageY),
		[direction],
	);
	const claim = React.useCallback((): boolean => true, []);
	const keep = React.useCallback((): boolean => false, []);
	const begin = React.useCallback(
		(event: GestureResponderEvent): void => {
			setDragging(true);
			setStart(positionOf(event));
		},
		[positionOf],
	);
	const move = React.useCallback(
		(event: GestureResponderEvent): void => {
			if (length <= 0) {
				return;
			}
			const position = positionOf(event);
			onResize(index, ((position - start) / length) * FULL);
			setStart(position);
		},
		[index, length, onResize, positionOf, start],
	);
	const end = React.useCallback((): void => {
		setDragging(false);
	}, []);
	const act = React.useCallback(
		(event: AccessibilityActionEvent): void => {
			onResize(index, event.nativeEvent.actionName === "increment" ? STEP : -STEP);
		},
		[index, onResize],
	);
	const accessibilityValue = React.useMemo(() => ({ min: 0, max: FULL, now: Math.round(value) }), [value]);
	return (
		<View
			accessible
			accessibilityRole="adjustable"
			accessibilityLabel={label}
			accessibilityValue={accessibilityValue}
			accessibilityActions={ADJUSTABLE_ACTIONS}
			onAccessibilityAction={act}
			onStartShouldSetResponder={claim}
			onMoveShouldSetResponder={claim}
			onResponderTerminationRequest={keep}
			onResponderGrant={begin}
			onResponderMove={move}
			onResponderRelease={end}
			onResponderTerminate={end}
			testID={testID}
			className={cn(resizableHandleVariants({ direction }), "z-10")}>
			<View className={resizableLineVariants({ direction, active: dragging && kind !== "pill" })} />
			{kind === "grip" ? (
				<View className="rounded-sm border border-border bg-card py-1">
					<Icon icon={direction === "horizontal" ? GripVerticalIcon : GripHorizontalIcon} size="xs" colorClassName="accent-muted-foreground" />
				</View>
			) : null}
			{kind === "pill" ? <View className={resizablePillVariants({ direction, active: dragging })} /> : null}
		</View>
	);
});

export const ResizableGroup = React.memo(
	React.forwardRef<ViewInstance, ResizableGroupProps>(function ResizableGroup(
		{
			children,
			direction = "horizontal",
			sizes: shownSizes,
			defaultSizes,
			onSizesChange,
			minSizes = NO_SIZES,
			handle = "line",
			variant = "plain",
			panelLabels = NO_LABELS,
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const panels = React.Children.toArray(children);
		const [ownSizes, setOwnSizes] = React.useState<readonly number[]>(defaultSizes ?? equalSizes(panels.length));
		const sizes = shownSizes ?? ownSizes;
		const [length, setLength] = React.useState(0);
		const measure = React.useCallback(
			(event: LayoutChangeEvent): void => {
				const { width, height } = event.nativeEvent.layout;
				setLength(direction === "horizontal" ? width : height);
			},
			[direction],
		);
		const resize = React.useCallback(
			(index: number, delta: number): void => {
				const next = resizeAt(sizes, index, delta, minSizes);
				setOwnSizes(next);
				onSizesChange?.(next);
			},
			[minSizes, onSizesChange, sizes],
		);
		return (
			<View ref={ref} onLayout={measure} testID={testID} className={cn(resizableGroupVariants({ direction, variant }), className)}>
				{panels
					.map((panel: React.ReactNode, index: number): React.JSX.Element => (
						<PanelSlot key={`panel-${String(index)}`} size={sizes.at(index) ?? 0}>
							{panel}
						</PanelSlot>
					))
					.flatMap((slot: React.JSX.Element, index: number): React.JSX.Element[] =>
						index < panels.length - 1
							? [
									slot,
									<ResizeHandle
										key={`handle-${String(index)}`}
										index={index}
										direction={direction}
										kind={handle}
										length={length}
										label={`Resize ${panelLabels.at(index) ?? `panel ${String(index + 1)}`} and ${panelLabels.at(index + 1) ?? `panel ${String(index + 2)}`}`}
										value={sizes.at(index) ?? 0}
										onResize={resize}
										testID={testID === undefined ? undefined : `${testID}-handle-${String(index)}`}
									/>,
								]
							: [slot],
					)}
			</View>
		);
	}),
);

/** A panel's share of the group. */
function PanelSlot({ size, children }: { readonly size: number; readonly children: React.ReactNode }): React.JSX.Element {
	const style = React.useMemo((): ViewStyle => ({ flexGrow: size, flexShrink: 1, flexBasis: 0 }), [size]);
	return <View style={style}>{children}</View>;
}
