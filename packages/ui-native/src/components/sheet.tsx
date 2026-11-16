// A panel that slides in from an edge of the screen (the web kit's `Sheet`
// and `Drawer`): a profile editor from the right, navigation from the left,
// a filter from the top, a short task from the bottom. A title (with an
// optional description and corner close button) heads it, its body scrolls,
// and a footer of actions stays in view under the body.
//
// It slides in by its own size while the backdrop fades, both read from one
// presence value (lib/use-overlay-presence), and the Modal stays up until it
// is fully away; under Reduce Motion it appears and goes. With
// `swipeToClose` (the drawer), dragging it back toward its edge follows the
// finger and lets go past a third of its size closes it; short of that it
// springs back. Tapping the backdrop, the close button or the system back
// closes it too.
//
// Controlled: the caller owns `open` and hears `onOpenChange(false)`. The ref
// reaches the panel.

import { cva, type VariantProps } from "class-variance-authority";
import XIcon from "lucide-react-native/icons/x";
import * as React from "react";
import { type GestureResponderEvent, type LayoutChangeEvent, Modal, Pressable, ScrollView, Text, View, type ViewInstance, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";

import { cn } from "../lib/cn";
import { FieldSurfaceProvider } from "../lib/field-surface";
import { PANEL_SPRING, SHEET_MOTION } from "../lib/motion";
import { OVERLAY_SHOWN, useOverlayPresence } from "../lib/use-overlay-presence";
import { SHEET_SCRIM_OPACITY } from "../lib/use-sheet-motion";
import { Icon } from "./icon";
import { KeyboardAvoidingView } from "./keyboard-avoiding-view";

export const sheetVariants = cva("absolute gap-3 border-border bg-popover", {
	variants: {
		/** The edge it slides from. */
		side: {
			top: "top-0 right-0 left-0 rounded-b-3xl border-b",
			right: "top-0 right-0 bottom-0 border-l",
			bottom: "right-0 bottom-0 left-0 rounded-t-3xl border-t",
			left: "top-0 bottom-0 left-0 border-r",
		},
		/** How much of the screen it may take: `md` four fifths across (or half down), `lg` nearly all. */
		size: { md: "", lg: "" },
	},
	compoundVariants: [
		{ side: ["left", "right"], size: "md", className: "w-4/5 max-w-sm" },
		{ side: ["left", "right"], size: "lg", className: "w-11/12" },
		{ side: ["top", "bottom"], size: "md", className: "max-h-1/2" },
		{ side: ["top", "bottom"], size: "lg", className: "max-h-11/12" },
	],
	defaultVariants: { side: "right", size: "md" },
});

type SheetVariantProps = VariantProps<typeof sheetVariants>;
export type SheetSide = NonNullable<SheetVariantProps["side"]>;
export type SheetSize = NonNullable<SheetVariantProps["size"]>;

const StyledAnimatedView = withUniwind(Animated.View);

/** Let go past this share of its size, and a swiped sheet closes. */
const CLOSE_FRACTION = 3;
/** A drag must move this far before it is a swipe, not a tap. */
const SWIPE_SLOP = 8;
const CLOSE_HIT_SLOP = 6;
const NO_SIZE = 0;

/** Which way the panel travels to leave, and along which axis. */
const AWAY: Readonly<Record<SheetSide, { readonly axis: "x" | "y"; readonly sign: 1 | -1 }>> = {
	top: { axis: "y", sign: -1 },
	right: { axis: "x", sign: 1 },
	bottom: { axis: "y", sign: 1 },
	left: { axis: "x", sign: -1 },
};

export interface SheetProps {
	readonly open: boolean;
	readonly onOpenChange: (open: boolean) => void;
	/** The heading; also the close button's name ("Close edit profile"). */
	readonly title: string;
	readonly description?: string | undefined;
	readonly children: React.ReactNode;
	/** Under the scrolling body, always in view: Save and Cancel. */
	readonly footer?: React.ReactNode | undefined;
	readonly side?: SheetSide | undefined;
	readonly size?: SheetSize | undefined;
	/** A close button by the title. Default `true`. */
	readonly showCloseButton?: boolean | undefined;
	/** Dragging it toward its edge closes it (a drawer). */
	readonly swipeToClose?: boolean | undefined;
	/** A grab handle at the edge it is dragged from. Default: on with `swipeToClose`. */
	readonly showHandle?: boolean | undefined;
	/** The backdrop's accessible name. Default "Close". */
	readonly closeLabel?: string | undefined;
	/** Extra classes for the panel, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** The panel's slide and drag, from its presence and the finger. */
function useSheetSlide(
	open: boolean,
	side: SheetSide,
): {
	readonly presented: boolean;
	readonly backdropStyle: ReturnType<typeof useAnimatedStyle<ViewStyle>>;
	readonly panelStyle: ReturnType<typeof useAnimatedStyle<ViewStyle>>;
	readonly measure: (event: LayoutChangeEvent) => void;
	readonly size: { get: () => number };
	readonly drag: { get: () => number; set: (value: number) => void };
} {
	const { presented, progress } = useOverlayPresence(open, SHEET_MOTION);
	const size = useSharedValue(NO_SIZE);
	const drag = useSharedValue(0);
	const { axis, sign } = AWAY[side];
	const measure = React.useCallback(
		(event: LayoutChangeEvent): void => {
			const { width, height } = event.nativeEvent.layout;
			size.set(axis === "x" ? width : height);
		},
		[axis, size],
	);
	const backdropStyle = useAnimatedStyle<ViewStyle>(() => ({ opacity: progress.get() * SHEET_SCRIM_OPACITY }));
	const panelStyle = useAnimatedStyle<ViewStyle>(() => {
		// Off screen until measured; then its own size away, less what has been shown, plus the drag.
		const away = size.get() === NO_SIZE ? 0 : (OVERLAY_SHOWN - progress.get()) * size.get();
		const offset = sign * (away + drag.get());
		return { opacity: size.get() === NO_SIZE ? 0 : 1, transform: axis === "x" ? [{ translateX: offset }] : [{ translateY: offset }] };
	});
	return { presented, backdropStyle, panelStyle, measure, size, drag };
}

export const Sheet = React.memo(
	React.forwardRef<ViewInstance, SheetProps>(function Sheet(
		{
			open,
			onOpenChange,
			title,
			description,
			children,
			footer,
			side = "right",
			size = "md",
			showCloseButton = true,
			swipeToClose = false,
			showHandle,
			closeLabel = "Close",
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const insets = useSafeAreaInsets();
		const { presented, backdropStyle, panelStyle, measure, size: panelSize, drag } = useSheetSlide(open, side);
		const { axis, sign } = AWAY[side];
		const start = useSharedValue(0);
		const close = React.useCallback((): void => {
			onOpenChange(false);
		}, [onOpenChange]);
		const travelOf = React.useCallback((event: GestureResponderEvent): number => (axis === "x" ? event.nativeEvent.pageX : event.nativeEvent.pageY) * sign, [axis, sign]);
		const claims = React.useCallback(
			(event: GestureResponderEvent): boolean => {
				if (!swipeToClose) {
					return false;
				}
				start.set(travelOf(event));
				return false;
			},
			[start, swipeToClose, travelOf],
		);
		const claimsMove = React.useCallback(
			(event: GestureResponderEvent): boolean => swipeToClose && travelOf(event) - start.get() > SWIPE_SLOP,
			[start, swipeToClose, travelOf],
		);
		const follow = React.useCallback(
			(event: GestureResponderEvent): void => {
				drag.set(Math.max(travelOf(event) - start.get(), 0));
			},
			[drag, start, travelOf],
		);
		const release = React.useCallback((): void => {
			if (drag.get() > panelSize.get() / CLOSE_FRACTION) {
				onOpenChange(false);
				// The presence slide takes it the rest of the way; the drag resets for the next opening.
				drag.set(withSpring(0, PANEL_SPRING));
				return;
			}
			drag.set(withSpring(0, PANEL_SPRING));
		}, [drag, onOpenChange, panelSize]);
		const handle = showHandle ?? swipeToClose;
		const safeArea = React.useMemo((): ViewStyle => {
			switch (side) {
				case "top":
					return { paddingTop: insets.top };
				case "bottom":
					return { paddingBottom: insets.bottom };
				case "left":
				case "right":
					return { paddingTop: insets.top, paddingBottom: insets.bottom };
				default:
					return {};
			}
		}, [insets.bottom, insets.top, side]);

		const panelStyles = React.useMemo(() => [panelStyle, safeArea], [panelStyle, safeArea]);

		return (
			<Modal visible={presented} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
				<KeyboardAvoidingView className="flex-1">
					<StyledAnimatedView pointerEvents="box-none" className="absolute inset-0 bg-scrim" style={backdropStyle}>
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={closeLabel}
							onPress={close}
							className="flex-1"
							testID={testID === undefined ? undefined : `${testID}-backdrop`}
						/>
					</StyledAnimatedView>
					<StyledAnimatedView
						ref={ref}
						accessibilityViewIsModal
						onLayout={measure}
						onStartShouldSetResponderCapture={claims}
						onMoveShouldSetResponderCapture={claimsMove}
						onResponderMove={follow}
						onResponderRelease={release}
						onResponderTerminate={release}
						testID={testID}
						style={panelStyles}
						className={cn(sheetVariants({ side, size }), className)}>
						{handle && side === "bottom" ? <View className="mt-2 h-1.5 w-10 self-center rounded-full bg-border" /> : null}
						<View className="flex-row items-start gap-3 px-4 pt-4">
							<View className="flex-1 gap-1">
								<Text accessibilityRole="header" className="text-h3 font-heading text-foreground">
									{title}
								</Text>
								{description === undefined ? null : <Text className="text-body font-sans text-muted-foreground">{description}</Text>}
							</View>
							{showCloseButton ? (
								<Pressable
									accessibilityRole="button"
									accessibilityLabel={`Close ${title.toLowerCase()}`}
									onPress={close}
									hitSlop={CLOSE_HIT_SLOP}
									className="size-8 items-center justify-center rounded-full active:bg-muted">
									<Icon icon={XIcon} size="sm" colorClassName="accent-icon" />
								</Pressable>
							) : null}
						</View>
						<ScrollView keyboardShouldPersistTaps="handled" className="shrink grow-0" contentContainerClassName="gap-4 px-4 pb-4">
							<FieldSurfaceProvider surface="popover">{children}</FieldSurfaceProvider>
						</ScrollView>
						{footer === undefined ? null : <View className="gap-2 border-t border-border px-4 py-3">{footer}</View>}
						{handle && side === "top" ? <View className="mb-2 h-1.5 w-10 self-center rounded-full bg-border" /> : null}
					</StyledAnimatedView>
				</KeyboardAvoidingView>
			</Modal>
		);
	}),
);

export type DrawerProps = Omit<SheetProps, "swipeToClose" | "side"> & {
	/** The edge it slides from. Default `bottom`. */
	readonly side?: SheetSide | undefined;
};

/** A sheet that is swiped back toward its edge to close, with a grab handle: the web kit's `Drawer`. */
export const Drawer = React.memo(
	React.forwardRef<ViewInstance, DrawerProps>(function Drawer({ side = "bottom", showCloseButton = false, ...props }, ref): React.JSX.Element {
		return <Sheet ref={ref} {...props} side={side} showCloseButton={showCloseButton} swipeToClose />;
	}),
);
