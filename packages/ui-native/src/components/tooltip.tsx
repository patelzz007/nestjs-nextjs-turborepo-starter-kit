// A short explanation of what something is ("Verified by GitHub"): the phone
// form of the web kit's Tooltip and HoverCard. A phone has no hover, so the
// bubble shows while the wrapped element is long-pressed and hides when the
// finger lifts. Screen readers hear the same text as the element's
// accessibility hint, so nobody has to find the gesture.
//
// The wrapped child should be display content (a badge, an icon, a stat), not
// another control: the tooltip is the pressable. Give it `onPress` for a tap
// action of its own. The open flag is display state the tooltip keeps itself;
// a caller that needs to own it passes `open` + `onOpenChange`.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Pressable, Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { isInactiveState, resolveControlState } from "../lib/control-state";

export const tooltipVariants = cva("items-center", {
	variants: {
		variant: { default: "" },
		size: { sm: "", md: "" },
		state: { default: "", loading: "", disabled: "opacity-60", error: "" },
	},
	defaultVariants: { variant: "default", size: "md", state: "default" },
});

/** The bubble's slot: as wide as a short sentence, centred on the wrapped element, above or below it. */
export const tooltipSlotVariants = cva("absolute z-50 w-56 items-center", {
	variants: {
		side: { top: "bottom-full mb-2", bottom: "top-full mt-2" },
	},
	defaultVariants: { side: "top" },
});

/** The bubble itself: the web tooltip's inverted look (foreground surface, background text). */
export const tooltipBubbleVariants = cva("rounded-md bg-foreground shadow-md", {
	variants: {
		size: { sm: "px-2 py-1", md: "px-3 py-1.5" },
	},
	defaultVariants: { size: "md" },
});

export const tooltipTextVariants = cva("text-center font-sans text-background", {
	variants: {
		size: { sm: "text-xs", md: "text-sm" },
	},
	defaultVariants: { size: "md" },
});

type TooltipVariantProps = VariantProps<typeof tooltipVariants>;
export type TooltipVariant = NonNullable<TooltipVariantProps["variant"]>;
export type TooltipSize = NonNullable<TooltipVariantProps["size"]>;
export type TooltipSide = NonNullable<VariantProps<typeof tooltipSlotVariants>["side"]>;

export interface TooltipProps {
	/** The explanation, shown in the bubble and read as the accessibility hint. */
	readonly content: string;
	/** The element being explained. */
	readonly children: React.ReactNode;
	/** The wrapped element's accessible name ("Verified"). */
	readonly accessibilityLabel: string;
	/** A tap on the element, when it has an action of its own (it is then announced as a button). */
	readonly onPress?: (() => void) | undefined;
	/** Owns the open flag: pass with `onOpenChange`. Left out, the tooltip keeps it itself. */
	readonly open?: boolean | undefined;
	readonly onOpenChange?: ((open: boolean) => void) | undefined;
	/** Where the bubble shows (default `top`). */
	readonly side?: TooltipSide;
	readonly variant?: TooltipVariant;
	readonly size?: TooltipSize;
	readonly disabled?: boolean;
	/** Extra classes for the wrapper, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

export const Tooltip = React.memo(
	React.forwardRef<ViewInstance, TooltipProps>(function Tooltip(
		{ content, children, accessibilityLabel, onPress, open, onOpenChange, side = "top", variant = "default", size = "md", disabled = false, className, testID },
		ref,
	): React.JSX.Element {
		const [ownOpen, setOwnOpen] = React.useState(false);
		const isOpen = open ?? ownOpen;
		const state = resolveControlState({ disabled });
		const isInactive = isInactiveState(state);
		const accessibilityState = React.useMemo(() => ({ disabled: isInactive }), [isInactive]);

		const changeOpen = React.useCallback(
			(next: boolean): void => {
				if (open === undefined) {
					setOwnOpen(next);
				}
				onOpenChange?.(next);
			},
			[onOpenChange, open],
		);
		const show = React.useCallback((): void => {
			changeOpen(true);
		}, [changeOpen]);
		const hide = React.useCallback((): void => {
			if (isOpen) {
				changeOpen(false);
			}
		}, [changeOpen, isOpen]);

		return (
			<Pressable
				ref={ref}
				accessibilityRole={onPress === undefined ? "text" : "button"}
				accessibilityLabel={accessibilityLabel}
				accessibilityHint={content}
				accessibilityState={accessibilityState}
				disabled={isInactive}
				onPress={onPress}
				onLongPress={show}
				onPressOut={hide}
				testID={testID}
				className={cn(tooltipVariants({ variant, size, state }), className)}>
				{children}
				{isOpen ? (
					// The hint already carries the text for screen readers: the bubble is for the eye only.
					<View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden className={tooltipSlotVariants({ side })}>
						<View className={tooltipBubbleVariants({ size })} testID={testID === undefined ? undefined : `${testID}-bubble`}>
							<Text className={tooltipTextVariants({ size })}>{content}</Text>
						</View>
					</View>
				) : null}
			</Pressable>
		);
	}),
);
