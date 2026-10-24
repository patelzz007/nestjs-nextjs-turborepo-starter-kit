// An on/off switch for a setting that applies at once ("Notifications"). A
// token-styled track and thumb (not the OS switch), so both themes match the
// web kit's `Switch`; the thumb slides on the selection spring (still under
// Reduce Motion). Controlled and data-agnostic: `checked` in,
// `onChange(next)` out. A screen reader hears a switch, named by `label`.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { type NativeSyntheticEvent, Pressable, type TargetedEvent, Text, View, type ViewInstance } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { withUniwind } from "uniwind";

import { cn } from "../lib/cn";
import { isInactiveState, resolveControlState } from "../lib/control-state";
import { playSelectionFeedback } from "../lib/haptics";
import { SELECTION_SPRING } from "../lib/motion";

/** Reanimated's view with Uniwind's `className` (static classes, animated `style`). */
const StyledAnimatedView = withUniwind(Animated.View);

/** The pressable row: the label (unless hidden), then the track. */
export const switchVariants = cva("min-h-11 flex-row items-center gap-3 active:opacity-80", {
	variants: {
		variant: {
			default: "",
			/** A bordered tile that stands on its own. */
			card: "rounded-xl border border-border bg-card px-3.5 py-2",
		},
		size: { md: "", sm: "gap-2.5" },
		state: {
			default: "",
			loading: "opacity-60",
			disabled: "opacity-60",
			error: "",
		},
	},
	defaultVariants: { variant: "default", size: "md", state: "default" },
});

/** The track: primary while on; outlined in the error colour while invalid. */
export const switchTrackVariants = cva("justify-center rounded-full border p-0.5", {
	variants: {
		size: { md: "h-7 w-12", sm: "h-5 w-9" },
		checked: { true: "border-primary bg-primary", false: "border-input bg-input" },
		state: { default: "", loading: "", disabled: "", error: "border-destructive" },
	},
	defaultVariants: { size: "md", checked: false, state: "default" },
});

export const switchThumbVariants = cva("rounded-full shadow-sm", {
	variants: {
		size: { md: "size-6", sm: "size-4" },
		checked: { true: "bg-primary-foreground", false: "bg-card" },
	},
	defaultVariants: { size: "md", checked: false },
});

export const switchLabelVariants = cva("font-sans text-foreground", {
	variants: { size: { md: "text-base", sm: "text-sm" } },
	defaultVariants: { size: "md" },
});

type SwitchVariantProps = VariantProps<typeof switchVariants>;
export type SwitchVariant = NonNullable<SwitchVariantProps["variant"]>;
export type SwitchSize = NonNullable<SwitchVariantProps["size"]>;

/**
 * How far the thumb travels, in points: the track's width less its padding
 * (`p-0.5` and a 1 pt border, each side) and the thumb. md: 48 − 6 − 24;
 * sm: 36 − 6 − 16.
 */
export const SWITCH_THUMB_TRAVEL: Readonly<Record<SwitchSize, number>> = { md: 18, sm: 14 };
const THUMB_AT_START = 0;

export interface SwitchProps {
	/** The setting's name: shown beside the track and its accessible name. */
	readonly label: string;
	/** A second line under the label. */
	readonly description?: string;
	/** Show only the track (the label still names it for screen readers): inside a list row that already shows the name. */
	readonly hideLabel?: boolean;
	readonly checked: boolean;
	readonly onChange: (checked: boolean) => void;
	readonly onFocus?: (event: NativeSyntheticEvent<TargetedEvent>) => void;
	readonly onBlur?: (event: NativeSyntheticEvent<TargetedEvent>) => void;
	readonly variant?: SwitchVariant;
	readonly size?: SwitchSize;
	readonly disabled?: boolean;
	/** The change is being saved: blocks presses, dims and announces busy. */
	readonly loading?: boolean;
	/** The caller's validation outcome. */
	readonly invalid?: boolean;
	readonly accessibilityHint?: string;
	/** Extra classes for the row, merged last. */
	readonly className?: string;
	readonly testID?: string;
}

export const Switch = React.memo(
	React.forwardRef<ViewInstance, SwitchProps>(function Switch(
		{
			label,
			description,
			hideLabel = false,
			checked,
			onChange,
			onFocus,
			onBlur,
			variant = "default",
			size = "md",
			disabled = false,
			loading = false,
			invalid = false,
			accessibilityHint,
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const state = resolveControlState({ disabled, loading, invalid });
		const isInactive = isInactiveState(state);
		const travel = SWITCH_THUMB_TRAVEL[size];
		const offset = useSharedValue(checked ? travel : THUMB_AT_START);
		const isFirstRender = React.useRef(true);

		React.useEffect((): void => {
			const target = checked ? travel : THUMB_AT_START;
			// The first render places the thumb; only later changes slide it.
			offset.set(isFirstRender.current ? target : withSpring(target, SELECTION_SPRING));
			isFirstRender.current = false;
		}, [checked, offset, travel]);

		const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));
		const accessibilityState = React.useMemo(() => ({ checked, disabled: isInactive, busy: loading }), [checked, isInactive, loading]);
		const handlePress = React.useCallback((): void => {
			playSelectionFeedback();
			onChange(!checked);
		}, [checked, onChange]);

		return (
			<Pressable
				ref={ref}
				accessibilityRole="switch"
				accessibilityLabel={label}
				accessibilityHint={accessibilityHint ?? description}
				accessibilityState={accessibilityState}
				disabled={isInactive}
				onPress={handlePress}
				onFocus={onFocus}
				onBlur={onBlur}
				testID={testID}
				className={cn(switchVariants({ variant, size, state }), hideLabel ? "self-start" : "", className)}>
				{hideLabel ? null : (
					<View className="flex-1 gap-0.5">
						<Text className={switchLabelVariants({ size })}>{label}</Text>
						{description === undefined ? null : <Text className="font-sans text-sm text-muted-foreground">{description}</Text>}
					</View>
				)}
				<View className={switchTrackVariants({ size, checked, state })}>
					<StyledAnimatedView style={thumbStyle} className={switchThumbVariants({ size, checked })} />
				</View>
			</Pressable>
		);
	}),
);
