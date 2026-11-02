// An on/off switch for a setting that applies at once ("Notifications"). A
// token-styled track and thumb (not the OS switch), so both themes match the
// web kit's `Switch`; the thumb slides and grows on the selection spring (still
// under Reduce Motion). Controlled and data-agnostic: `checked` in,
// `onChange(next)` out. A screen reader hears a switch, named by `label`.
//
// Every state looks different, so "off" is never mistaken for "can't change":
// - on: a solid primary track, a full thumb with a check;
// - off: a hollow outlined track, a small solid thumb;
// - disabled: a dashed grey track and a faded thumb (still showing on or off);
// - locked (always on, by policy): a tinted track and a thumb with a lock.

import { cva, type VariantProps } from "class-variance-authority";
import CheckIcon from "lucide-react-native/icons/check";
import LockIcon from "lucide-react-native/icons/lock";
import * as React from "react";
import { type NativeSyntheticEvent, Pressable, type TargetedEvent, Text, View, type ViewInstance } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { withUniwind } from "uniwind";

import { cn } from "../lib/cn";
import { resolveControlState, type ControlState } from "../lib/control-state";
import { playSelectionFeedback } from "../lib/haptics";
import { SELECTION_SPRING } from "../lib/motion";
import { Icon, type IconSize } from "./icon";

/** Reanimated's view with Uniwind's `className` (static classes, animated `style`). */
const StyledAnimatedView = withUniwind(Animated.View);

/** What the switch shows: the control's state, or `locked` for a setting a policy keeps as it is. */
export type SwitchVisualState = ControlState | "locked";

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
			disabled: "",
			error: "",
			locked: "",
		},
	},
	defaultVariants: { variant: "default", size: "md", state: "default" },
});

/** The track: solid while on, hollow while off, dashed grey while disabled, tinted while locked. */
export const switchTrackVariants = cva("justify-center rounded-full border-2 p-0.5", {
	variants: {
		size: { md: "h-8 w-13", sm: "h-6 w-10" },
		checked: { true: "", false: "" },
		state: { default: "", loading: "", disabled: "border-dashed border-muted-foreground/50 bg-muted", error: "border-destructive", locked: "" },
	},
	compoundVariants: [
		{ checked: true, state: ["default", "loading"], className: "border-primary bg-primary" },
		{ checked: false, state: ["default", "loading"], className: "border-muted-foreground bg-background" },
		{ checked: true, state: "error", className: "bg-primary" },
		{ checked: false, state: "error", className: "bg-background" },
		{ checked: true, state: "locked", className: "border-primary/30 bg-primary/30" },
		{ checked: false, state: "locked", className: "border-muted-foreground/30 bg-muted" },
	],
	defaultVariants: { size: "md", checked: false, state: "default" },
});

/** The thumb: full and light while on, small and dark while off, faded while disabled, a lock while locked. */
export const switchThumbVariants = cva("items-center justify-center rounded-full", {
	variants: {
		size: { md: "size-6", sm: "size-4" },
		checked: { true: "", false: "" },
		state: { default: "", loading: "", disabled: "", error: "", locked: "bg-card shadow-sm" },
	},
	compoundVariants: [
		{ checked: true, state: ["default", "loading", "error"], className: "bg-primary-foreground shadow-sm" },
		{ checked: false, state: ["default", "loading", "error"], className: "bg-muted-foreground" },
		{ checked: true, state: "disabled", className: "bg-muted-foreground/60" },
		{ checked: false, state: "disabled", className: "bg-muted-foreground/40" },
	],
	defaultVariants: { size: "md", checked: false, state: "default" },
});

/** Where the thumb sits: the on thumb's size, so the off thumb shrinks around the same centre. */
export const switchThumbSlotVariants = cva("items-center justify-center", {
	variants: { size: { md: "size-6", sm: "size-4" } },
	defaultVariants: { size: "md" },
});

export const switchLabelVariants = cva("font-sans", {
	variants: {
		size: { md: "text-base", sm: "text-sm" },
		state: { default: "text-foreground", loading: "text-foreground", disabled: "text-muted-foreground", error: "text-foreground", locked: "text-foreground" },
	},
	defaultVariants: { size: "md", state: "default" },
});

type SwitchVariantProps = VariantProps<typeof switchVariants>;
export type SwitchVariant = NonNullable<SwitchVariantProps["variant"]>;
export type SwitchSize = NonNullable<SwitchVariantProps["size"]>;

/**
 * How far the thumb travels, in points: the track's width less its padding
 * (`p-0.5` and a 2 pt border, each side) and the thumb. md: 52 − 8 − 24;
 * sm: 40 − 8 − 16.
 */
export const SWITCH_THUMB_TRAVEL: Readonly<Record<SwitchSize, number>> = { md: 20, sm: 16 };
/** The off thumb is drawn smaller than the on one (md: 16 of 24 pt; sm: 10 of 16 pt). */
export const SWITCH_OFF_THUMB_SCALE: Readonly<Record<SwitchSize, number>> = { md: 2 / 3, sm: 0.625 };
const THUMB_AT_START = 0;
const THUMB_FULL_SCALE = 1;
const GLYPH_SIZES: Readonly<Record<SwitchSize, IconSize>> = { md: "sm", sm: "xs" };

/** The glyph inside the thumb: a lock while locked, a check while on, nothing while off. */
function ThumbGlyph({ state, checked, size }: { readonly state: SwitchVisualState; readonly checked: boolean; readonly size: SwitchSize }): React.JSX.Element | null {
	if (state === "locked") {
		return <Icon icon={LockIcon} size={GLYPH_SIZES[size]} weight="bold" colorClassName="accent-primary" testID="switch-lock" />;
	}
	if (!checked) {
		return null;
	}
	return <Icon icon={CheckIcon} size={GLYPH_SIZES[size]} weight="bold" colorClassName={state === "disabled" ? "accent-background" : "accent-primary"} testID="switch-check" />;
}

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
	/** Not available right now (say why in `description`): a dashed grey track. */
	readonly disabled?: boolean;
	/** Kept as it is by a policy ("Always on"): a lock in the thumb; it never changes. */
	readonly locked?: boolean;
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
			locked = false,
			loading = false,
			invalid = false,
			accessibilityHint,
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const controlState = resolveControlState({ disabled, loading, invalid });
		const state: SwitchVisualState = locked ? "locked" : controlState;
		// Locked, disabled and saving switches take no presses (compared, not called, so the compiler can memoise it).
		const isInactive = state === "locked" || state === "disabled" || state === "loading";
		const travel = SWITCH_THUMB_TRAVEL[size];
		const offScale = SWITCH_OFF_THUMB_SCALE[size];
		const offset = useSharedValue(checked ? travel : THUMB_AT_START);
		const scale = useSharedValue(checked ? THUMB_FULL_SCALE : offScale);
		const isFirstRender = React.useRef(true);

		React.useEffect((): void => {
			const target = checked ? travel : THUMB_AT_START;
			const targetScale = checked ? THUMB_FULL_SCALE : offScale;
			// The first render places the thumb; only later changes slide it.
			offset.set(isFirstRender.current ? target : withSpring(target, SELECTION_SPRING));
			scale.set(isFirstRender.current ? targetScale : withSpring(targetScale, SELECTION_SPRING));
			isFirstRender.current = false;
		}, [checked, offScale, offset, scale, travel]);

		const slotStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));
		const thumbStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
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
						<Text className={switchLabelVariants({ size, state })}>{label}</Text>
						{description === undefined ? null : <Text className="font-sans text-sm text-muted-foreground">{description}</Text>}
					</View>
				)}
				<View className={switchTrackVariants({ size, checked, state })}>
					<StyledAnimatedView style={slotStyle} className={switchThumbSlotVariants({ size })}>
						<StyledAnimatedView style={thumbStyle} className={switchThumbVariants({ size, checked, state })}>
							<ThumbGlyph state={state} checked={checked} size={size} />
						</StyledAnimatedView>
					</StyledAnimatedView>
				</View>
			</Pressable>
		);
	}),
);
