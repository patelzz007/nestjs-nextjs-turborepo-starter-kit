// A labelled checkbox. Controlled and data-agnostic: `checked` in,
// `onChange(next)` out. Variants, sizes and states come from CVA over design
// tokens only; `state` is derived by `resolveControlState` (disabled, then
// loading, then the caller's `invalid`), or is `locked`. Its box shows:
// - checked: solid primary with a tick;
// - part-checked (`indeterminate`, some of a group): solid primary with a
//   dash, read as "mixed"; pressing it checks;
// - unchecked: an outlined box;
// - locked (kept as it is by a policy): a tinted box with a lock, never faded.
// A tick or dash pops in when it is pressed (toggle-mark.tsx); the one shown at first stays still.
//
// The row can carry more: `leading` (an icon, an avatar, a logo) before the
// label, `trailing` (a badge, a help tooltip) after it, the box at the row's
// end (`controlPosition="end"`, a settings list), a round box (`shape`, a
// to-do), a categorical colour while checked (`tone`), and a label struck
// through once checked (`strikeWhenChecked`, a done task).

import { cva, type VariantProps } from "class-variance-authority";
import CheckIcon from "lucide-react-native/icons/check";
import LockIcon from "lucide-react-native/icons/lock";
import MinusIcon from "lucide-react-native/icons/minus";
import * as React from "react";
import { type AccessibilityState, type NativeSyntheticEvent, Pressable, type TargetedEvent, Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { resolveControlState, type ControlState } from "../lib/control-state";
import { Icon } from "./icon";
import { ToggleMark, ToggleMarkScope } from "./toggle-mark";

/** The pressable row: the box, then the label. */
export const checkboxVariants = cva("min-h-11 flex-row items-center gap-3 py-2 active:opacity-80", {
	variants: {
		/** `default`: a bare row in a form. `card`: a bordered tile that stands on its own. */
		variant: {
			default: "",
			card: "rounded-xl border border-border bg-card px-3.5",
		},
		size: {
			md: "",
			sm: "gap-2.5",
		},
		state: {
			default: "",
			loading: "opacity-60",
			disabled: "opacity-60",
			error: "",
			locked: "",
		},
	},
	defaultVariants: { variant: "default", size: "md", state: "default" },
});

/** The box itself: filled while checked or part-checked, tinted while locked, outlined in the error colour while invalid. */
export const checkboxBoxVariants = cva("items-center justify-center border-2", {
	variants: {
		size: {
			md: "size-6 rounded-md",
			sm: "size-5 rounded-sm",
		},
		/** `round`: a circle (a to-do item). */
		shape: { square: "", round: "rounded-full" },
		/** The checked fill: the action colour, or a categorical tone. */
		tone: { primary: "", blue: "", green: "", yellow: "" },
		checked: { true: "", false: "" },
		state: {
			default: "",
			loading: "",
			disabled: "",
			error: "border-destructive",
			locked: "",
		},
	},
	compoundVariants: [
		{ checked: true, state: ["default", "loading", "disabled"], className: "border-primary bg-primary" },
		{ checked: false, state: ["default", "loading", "disabled"], className: "border-control-ring bg-card" },
		{ checked: true, state: "error", className: "bg-primary" },
		{ checked: false, state: "error", className: "bg-card" },
		{ checked: true, state: "locked", className: "border-primary/20 bg-primary/20" },
		{ checked: false, state: "locked", className: "border-control-ring bg-muted" },
		{ checked: true, state: ["default", "loading", "disabled"], tone: "blue", className: "border-tone-blue bg-tone-blue" },
		{ checked: true, state: ["default", "loading", "disabled"], tone: "green", className: "border-tone-green bg-tone-green" },
		{ checked: true, state: ["default", "loading", "disabled"], tone: "yellow", className: "border-tone-yellow bg-tone-yellow" },
	],
	defaultVariants: { size: "md", shape: "square", tone: "primary", checked: false, state: "default" },
});

export const checkboxLabelVariants = cva("font-sans", {
	variants: {
		size: { md: "text-body-lg", sm: "text-body" },
		/** A done item: struck through and receding. */
		struck: { true: "text-muted-foreground line-through", false: "text-foreground" },
	},
	defaultVariants: { size: "md", struck: false },
});

type CheckboxBoxVariantProps = VariantProps<typeof checkboxBoxVariants>;
export type CheckboxShape = NonNullable<CheckboxBoxVariantProps["shape"]>;
export type CheckboxTone = NonNullable<CheckboxBoxVariantProps["tone"]>;

type CheckboxVariantProps = VariantProps<typeof checkboxVariants>;
export type CheckboxVariant = NonNullable<CheckboxVariantProps["variant"]>;
export type CheckboxSize = NonNullable<CheckboxVariantProps["size"]>;
/** What the checkbox shows: the control's state, or `locked` for a choice a policy keeps as it is. */
export type CheckboxVisualState = ControlState | "locked";

/** The glyph in the box: a lock while locked, a dash while part-checked, a tick while checked, nothing while unchecked. */
function CheckboxGlyph({
	state,
	checked,
	indeterminate,
}: {
	readonly state: CheckboxVisualState;
	readonly checked: boolean;
	readonly indeterminate: boolean;
}): React.JSX.Element | null {
	if (state === "locked") {
		return <Icon icon={LockIcon} size="control" weight="light" colorClassName="accent-primary" testID="checkbox-lock" />;
	}
	if (indeterminate) {
		return (
			<ToggleMark key="dash">
				<Icon icon={MinusIcon} size="sm" weight="bold" colorClassName="accent-primary-foreground" testID="checkbox-dash" />
			</ToggleMark>
		);
	}
	return checked ? (
		<ToggleMark key="tick">
			<Icon icon={CheckIcon} size="sm" weight="bold" colorClassName="accent-primary-foreground" testID="checkbox-tick" />
		</ToggleMark>
	) : null;
}

export interface CheckboxProps {
	/** Visible label and the checkbox's accessible name. */
	readonly label: string;
	/** A second line under the label. */
	readonly description?: string | undefined;
	readonly checked: boolean;
	/** Some of a group is checked: a dash, read as "mixed". Pressing it reports `true`. */
	readonly indeterminate?: boolean;
	readonly onChange: (checked: boolean) => void;
	readonly onFocus?: (event: NativeSyntheticEvent<TargetedEvent>) => void;
	readonly onBlur?: (event: NativeSyntheticEvent<TargetedEvent>) => void;
	readonly variant?: CheckboxVariant;
	readonly size?: CheckboxSize;
	readonly disabled?: boolean | undefined;
	/** The change is being saved: blocks presses and announces busy. */
	readonly loading?: boolean;
	/** Kept as it is by a policy ("Always on"): a tinted box with a lock, and it takes no presses. */
	readonly locked?: boolean;
	/** The caller's validation outcome (a required consent left unchecked). */
	readonly invalid?: boolean;
	readonly accessibilityHint?: string;
	/** A circle in place of the square box (a to-do item). */
	readonly shape?: CheckboxShape | undefined;
	/** The checked fill: `primary` (default), or a categorical tone. */
	readonly tone?: CheckboxTone | undefined;
	/** `end`: the box at the row's end (a settings list), the label first. */
	readonly controlPosition?: "start" | "end" | undefined;
	/** Before the label: an icon, an avatar, a logo; decorative. */
	readonly leading?: React.ReactNode;
	/** After the label: a badge, a help tooltip. */
	readonly trailing?: React.ReactNode;
	/** Strikes the label through once checked (a done task). */
	readonly strikeWhenChecked?: boolean | undefined;
	/** Draws only the box (a table's row selection): the label is still what screen readers hear. */
	readonly labelHidden?: boolean | undefined;
	/** Extra classes for the row, merged last. */
	readonly className?: string;
	readonly testID?: string | undefined;
}

export const Checkbox = React.memo(
	React.forwardRef<ViewInstance, CheckboxProps>(function Checkbox(
		{
			label,
			description,
			checked,
			indeterminate = false,
			onChange,
			onFocus,
			onBlur,
			variant = "default",
			size = "md",
			disabled = false,
			loading = false,
			locked = false,
			invalid = false,
			accessibilityHint,
			shape = "square",
			tone = "primary",
			controlPosition = "start",
			leading,
			trailing,
			strikeWhenChecked = false,
			labelHidden = false,
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const controlState = resolveControlState({ disabled, loading, invalid });
		const state: CheckboxVisualState = locked ? "locked" : controlState;
		// Locked, disabled and saving checkboxes take no presses (compared, not called, so the compiler can memoise it).
		const isInactive = state === "locked" || state === "disabled" || state === "loading";
		const accessibilityState = React.useMemo(
			(): AccessibilityState => ({ checked: indeterminate ? "mixed" : checked, disabled: isInactive, busy: loading }),
			[checked, indeterminate, isInactive, loading],
		);
		const handlePress = React.useCallback((): void => {
			onChange(indeterminate || !checked);
		}, [checked, indeterminate, onChange]);
		const box = (
			<ToggleMarkScope className={checkboxBoxVariants({ size, shape, tone, checked: checked || indeterminate, state })}>
				<CheckboxGlyph state={state} checked={checked} indeterminate={indeterminate} />
			</ToggleMarkScope>
		);
		return (
			<Pressable
				ref={ref}
				accessibilityRole="checkbox"
				accessibilityLabel={label}
				accessibilityHint={accessibilityHint ?? description}
				accessibilityState={accessibilityState}
				disabled={isInactive}
				onPress={handlePress}
				onFocus={onFocus}
				onBlur={onBlur}
				testID={testID}
				className={cn(checkboxVariants({ variant, size, state }), labelHidden ? "min-w-11 justify-center" : "", className)}>
				{controlPosition === "start" || labelHidden ? box : null}
				{labelHidden ? null : (
					<>
						{leading}
						<View className="flex-1 gap-0.5">
							<View className="flex-row flex-wrap items-center gap-2">
								<Text className={checkboxLabelVariants({ size, struck: strikeWhenChecked && checked })}>{label}</Text>
								{trailing}
							</View>
							{description === undefined ? null : <Text className="text-body font-sans text-muted-foreground">{description}</Text>}
						</View>
						{controlPosition === "end" ? box : null}
					</>
				)}
			</Pressable>
		);
	}),
);
