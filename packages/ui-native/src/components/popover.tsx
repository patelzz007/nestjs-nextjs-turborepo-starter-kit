// A small panel anchored to the control that opened it (the web kit's
// `Popover`): a profile card, a couple of settings, a short form, a step of a
// tour. It opens beside its trigger — below it by default, or on any `side`,
// lined up with the trigger's start, centre or end (`align`) — and moves to
// the other side, then inside the screen's edges, when it would not fit.
// Tapping outside it or the system back closes it.
//
// The trigger is the one child: a kit control (Button, IconButton, a
// Pressable) that takes `onPress` / `onLongPress`; the popover hands it the
// gesture that opens it (`openOn`), so there is no second pressable around
// it. Open is the popover's own display state unless the caller owns it
// (`open` + `onOpenChange`). The panel's content is the caller's; it is a
// modal window of its own, so screen readers stay inside it until it closes.

import { cva } from "class-variance-authority";
import * as React from "react";
import { type LayoutChangeEvent, Modal, Pressable, useWindowDimensions, View, type ViewInstance, type ViewStyle } from "react-native";

import { cn } from "../lib/cn";
import { FieldSurfaceProvider } from "../lib/field-surface";
import { useReduceMotion } from "../lib/use-reduce-motion";

export type PopoverSide = "top" | "right" | "bottom" | "left";
export type PopoverAlign = "start" | "center" | "end";

export const popoverVariants = cva("absolute gap-3 rounded-2xl border border-border bg-popover p-4 shadow-lg", {
	variants: {
		/** How wide the panel is: `sm` a hint, `md` a card, `auto` its content's width. */
		size: { sm: "w-56", md: "w-72", lg: "w-80", auto: "" },
	},
	defaultVariants: { size: "md" },
});

export type PopoverSize = "sm" | "md" | "lg" | "auto";

/** A rectangle on the screen, in window coordinates. */
export interface PopoverRect {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

export interface PopoverPlacement {
	readonly top: number;
	readonly left: number;
	/** The side it ended up on, after flipping. */
	readonly side: PopoverSide;
}

/** The gap between the trigger and the panel, and the panel and the screen's edge. */
export const POPOVER_GAP = 8;
export const POPOVER_EDGE = 16;

const OPPOSITE: Readonly<Record<PopoverSide, PopoverSide>> = { top: "bottom", bottom: "top", left: "right", right: "left" };
const HALF = 2;

function clamp(value: number, low: number, high: number): number {
	return Math.min(Math.max(value, low), Math.max(low, high));
}

function alongOf(start: number, length: number, size: number, align: PopoverAlign): number {
	if (align === "start") {
		return start;
	}
	return align === "end" ? start + length - size : start + length / HALF - size / HALF;
}

function placeOn(
	anchor: PopoverRect,
	panel: { readonly width: number; readonly height: number },
	side: PopoverSide,
	align: PopoverAlign,
): { readonly top: number; readonly left: number } {
	switch (side) {
		case "top":
			return { top: anchor.y - panel.height - POPOVER_GAP, left: alongOf(anchor.x, anchor.width, panel.width, align) };
		case "bottom":
			return { top: anchor.y + anchor.height + POPOVER_GAP, left: alongOf(anchor.x, anchor.width, panel.width, align) };
		case "left":
			return { top: alongOf(anchor.y, anchor.height, panel.height, align), left: anchor.x - panel.width - POPOVER_GAP };
		case "right":
			return { top: alongOf(anchor.y, anchor.height, panel.height, align), left: anchor.x + anchor.width + POPOVER_GAP };
		default:
			return assertNeverSide(side);
	}
}

function fits(
	place: { readonly top: number; readonly left: number },
	panel: { readonly width: number; readonly height: number },
	screen: { readonly width: number; readonly height: number },
): boolean {
	return (
		place.top >= POPOVER_EDGE &&
		place.left >= POPOVER_EDGE &&
		place.top + panel.height <= screen.height - POPOVER_EDGE &&
		place.left + panel.width <= screen.width - POPOVER_EDGE
	);
}

/** Where the panel goes: on `side` lined up by `align`, on the other side when it does not fit, then kept inside the screen's edges. */
export function popoverPlacementOf(
	anchor: PopoverRect,
	panel: { readonly width: number; readonly height: number },
	screen: { readonly width: number; readonly height: number },
	side: PopoverSide,
	align: PopoverAlign,
): PopoverPlacement {
	const wanted = placeOn(anchor, panel, side, align);
	const flipped = placeOn(anchor, panel, OPPOSITE[side], align);
	const useFlip = !fits(wanted, panel, screen) && fits(flipped, panel, screen);
	const place = useFlip ? flipped : wanted;
	return {
		top: clamp(place.top, POPOVER_EDGE, screen.height - POPOVER_EDGE - panel.height),
		left: clamp(place.left, POPOVER_EDGE, screen.width - POPOVER_EDGE - panel.width),
		side: useFlip ? OPPOSITE[side] : side,
	};
}

function assertNeverSide(value: never): never {
	throw new Error(`Unhandled popover side: ${String(value)}`);
}

/** What a trigger takes from the popover that it opens. */
export interface PopoverTriggerProps {
	readonly onPress?: (() => void) | undefined;
	readonly onLongPress?: (() => void) | undefined;
	readonly accessibilityHint?: string | undefined;
}

export interface PopoverProps {
	/** The trigger: one control that takes `onPress` / `onLongPress`. */
	readonly children: React.ReactElement<PopoverTriggerProps>;
	/** The panel's content. */
	readonly content: React.ReactNode;
	/** The panel's name for screen readers. */
	readonly accessibilityLabel: string;
	/** What opens it: a tap (default) or a long press (a hover card). */
	readonly openOn?: "press" | "longPress" | undefined;
	readonly open?: boolean | undefined;
	readonly onOpenChange?: ((open: boolean) => void) | undefined;
	readonly side?: PopoverSide | undefined;
	readonly align?: PopoverAlign | undefined;
	readonly size?: PopoverSize | undefined;
	/** The trigger's hint, for screen readers. Default "Opens <name>". */
	readonly accessibilityHint?: string | undefined;
	/** Extra classes for the view around the trigger (it hugs the trigger by default). */
	readonly anchorClassName?: string | undefined;
	/** Extra classes for the panel, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

interface PanelSize {
	readonly width: number;
	readonly height: number;
}

export const Popover = React.memo(
	React.forwardRef<ViewInstance, PopoverProps>(function Popover(
		{
			children,
			content,
			accessibilityLabel,
			openOn = "press",
			open: shownOpen,
			onOpenChange,
			side = "bottom",
			align = "center",
			size = "md",
			accessibilityHint,
			anchorClassName,
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const reduceMotion = useReduceMotion();
		const screen = useWindowDimensions();
		const anchorRef = React.useRef<ViewInstance>(null);
		const [ownOpen, setOwnOpen] = React.useState(false);
		const [anchor, setAnchor] = React.useState<PopoverRect | null>(null);
		const [panel, setPanel] = React.useState<PanelSize | null>(null);
		const open = shownOpen ?? ownOpen;
		const change = React.useCallback(
			(next: boolean): void => {
				setOwnOpen(next);
				onOpenChange?.(next);
			},
			[onOpenChange],
		);
		const show = React.useCallback((): void => {
			// Open at once (unseen until placed), and place it once the trigger has been measured.
			change(true);
			anchorRef.current?.measureInWindow((x: number, y: number, width: number, height: number): void => {
				setAnchor({ x, y, width, height });
			});
		}, [change]);
		const hide = React.useCallback((): void => {
			change(false);
		}, [change]);
		const measurePanel = React.useCallback((event: LayoutChangeEvent): void => {
			const { width, height } = event.nativeEvent.layout;
			setPanel({ width, height });
		}, []);
		const placement = anchor === null || panel === null ? null : popoverPlacementOf(anchor, panel, screen, side, align);
		const panelStyle = React.useMemo(
			(): ViewStyle => (placement === null ? { opacity: 0, top: 0, left: 0 } : { opacity: 1, top: placement.top, left: placement.left }),
			[placement],
		);
		const hint = accessibilityHint ?? `Opens ${accessibilityLabel.toLowerCase()}`;
		const trigger = React.cloneElement(children, openOn === "press" ? { onPress: show, accessibilityHint: hint } : { onLongPress: show, accessibilityHint: hint });
		return (
			<>
				<View ref={anchorRef} collapsable={false} className={cn("self-start", anchorClassName)}>
					{trigger}
				</View>
				<Modal visible={open} transparent animationType={reduceMotion ? "none" : "fade"} onRequestClose={hide} statusBarTranslucent>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel="Close"
						onPress={hide}
						className="absolute inset-0"
						testID={testID === undefined ? undefined : `${testID}-backdrop`}
					/>
					<View
						ref={ref}
						accessibilityViewIsModal
						accessibilityLabel={accessibilityLabel}
						onLayout={measurePanel}
						style={panelStyle}
						testID={testID}
						className={cn(popoverVariants({ size }), className)}>
						<FieldSurfaceProvider surface="popover">{content}</FieldSurfaceProvider>
					</View>
				</Modal>
			</>
		);
	}),
);
