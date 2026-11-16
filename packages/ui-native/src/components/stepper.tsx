// A sequence of steps ("Details → Shipping → Payment → Review") with the
// active one marked: every earlier (or explicitly completed) step is
// `completed`, the active one is `active`, later ones are `inactive` — the web
// kit's `StepState` vocabulary. Controlled: the caller owns `value` (the
// 1-based active step, as on the web) and decides whether a step may be
// opened; pass `onChange` to make the steps pressable tabs, omit it for a
// read-only progress display. Labels are generic and overridable.
//
// Looks (`variant`): numbered circles joined by connectors (`default`), tiny
// rings joined by dotted links (`dots`), a bar segment per step with its title
// under it (`bar`), one thick bar of joined segments (`segmented`), arrow
// shaped chevrons (`chevron`), icon tiles split by chevrons (`tiles`), or the
// step names as a text trail (`trail`). Titles sit below or beside the
// marker, or not at all (`labelPosition`); the marker is a number, the step's
// glyph, or a ring (`indicator`); finished steps take the primary colour or
// green (`completedTone`). A step can carry a glyph, a status badge, a time,
// and its own spinner.

import { cva, type VariantProps } from "class-variance-authority";
import CheckIcon from "lucide-react-native/icons/check";
import ChevronRightIcon from "lucide-react-native/icons/chevron-right";
import * as React from "react";
import { ActivityIndicator, Pressable, Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { isInactiveState, resolveControlState } from "../lib/control-state";
import { Icon, type LucideIcon } from "./icon";
import { IconTile } from "./icon-tile";

export type StepperOrientation = "horizontal" | "vertical";
export type StepState = "active" | "completed" | "inactive";

export interface StepperStep {
	/** Stable identity of the step. */
	readonly key: string;
	readonly title: string;
	readonly description?: string | undefined;
	/** Marks the step done even when it is after the active one. */
	readonly completed?: boolean | undefined;
	/** The step cannot be opened. */
	readonly disabled?: boolean | undefined;
	/** The step's glyph (with `indicator="icon"`, or the `tiles` look). */
	readonly icon?: LucideIcon | undefined;
	/** A status after the title: a badge. Decorative: the state is read with the label. */
	readonly badge?: React.ReactNode | undefined;
	/** A short time or estimate under the title ("09:40", "ETA 14:10"). */
	readonly meta?: string | undefined;
	/** The step's own work is running: a spinner in its marker. */
	readonly loading?: boolean | undefined;
}

export function stepStateFor(step: number, activeStep: number, completed: boolean): StepState {
	if (completed || step < activeStep) {
		return "completed";
	}
	return step === activeStep ? "active" : "inactive";
}

/** "Step 2 of 4: Shipping". */
export function defaultStepLabel(step: number, stepCount: number, title: string): string {
	return `Step ${String(step)} of ${String(stepCount)}: ${title}`;
}

/** Spoken after each step's label. */
export const DEFAULT_STEP_STATE_LABELS: Readonly<Record<StepState, string>> = {
	completed: "completed",
	active: "current",
	inactive: "upcoming",
};

export const stepperVariants = cva("", {
	variants: {
		variant: { default: "", dots: "", bar: "", segmented: "", chevron: "", tiles: "", trail: "" },
		orientation: { horizontal: "flex-row gap-2", vertical: "" },
		size: { md: "", sm: "" },
		state: { default: "", loading: "", disabled: "opacity-60", error: "" },
	},
	compoundVariants: [
		{ variant: "segmented", orientation: "horizontal", className: "gap-1" },
		{ variant: "chevron", orientation: "horizontal", className: "gap-0" },
		{ variant: ["tiles", "trail"], orientation: "horizontal", className: "items-center" },
	],
	defaultVariants: { variant: "default", orientation: "horizontal", size: "md", state: "default" },
});

export const stepperIndicatorVariants = cva("items-center justify-center rounded-full", {
	variants: {
		state: {
			completed: "",
			active: "bg-primary",
			inactive: "border border-border bg-muted",
		},
		tone: { primary: "", success: "" },
		indicator: { number: "", icon: "", ring: "border-2 bg-transparent" },
		size: { md: "size-8", sm: "size-6", dot: "size-3" },
	},
	compoundVariants: [
		{ state: "completed", tone: "primary", className: "bg-primary" },
		{ state: "completed", tone: "success", className: "bg-success" },
		{ indicator: "ring", state: "active", className: "border-primary" },
		{ indicator: "ring", state: "completed", tone: "primary", className: "border-primary" },
		{ indicator: "ring", state: "completed", tone: "success", className: "border-success" },
		{ indicator: "ring", state: "inactive", className: "border-border" },
	],
	defaultVariants: { state: "inactive", tone: "primary", indicator: "number", size: "md" },
});

const stepperIndicatorTextVariants = cva("font-sans-semibold", {
	variants: {
		state: { completed: "text-primary-foreground", active: "text-primary-foreground", inactive: "text-muted-foreground" },
		size: { md: "text-body", sm: "text-caption", dot: "text-caption" },
	},
	defaultVariants: { state: "inactive", size: "md" },
});

/** The line from a step to the next one: filled once the step is completed (unless `filled` is off). */
const stepperSeparatorVariants = cva("rounded-full", {
	variants: {
		orientation: { horizontal: "h-0.5 flex-1", vertical: "my-1 w-0.5 flex-1" },
		fill: { primary: "bg-primary", success: "bg-success", none: "bg-border" },
		dotted: { true: "h-0 border-t-2 border-dotted border-border bg-transparent", false: "" },
	},
	defaultVariants: { orientation: "horizontal", fill: "none", dotted: false },
});

/** A bar look's segment: filled up to the active step. */
const stepperSegmentVariants = cva("rounded-full", {
	variants: {
		reached: { true: "", false: "bg-border" },
		tone: { primary: "", success: "" },
		thickness: { thin: "h-1.5", thick: "h-2.5" },
	},
	compoundVariants: [
		{ reached: true, tone: "primary", className: "bg-primary" },
		{ reached: true, tone: "success", className: "bg-success" },
	],
	defaultVariants: { reached: false, tone: "primary", thickness: "thin" },
});

/** A chevron look's stage: filled while active or done. */
const stepperChevronVariants = cva("h-10 flex-1 flex-row items-center justify-center gap-1.5 px-2", {
	variants: {
		state: { completed: "bg-primary/15", active: "bg-primary", inactive: "bg-muted" },
		edge: { first: "rounded-l-full", middle: "", last: "rounded-r-full", only: "rounded-full" },
	},
	defaultVariants: { state: "inactive", edge: "middle" },
});

const stepperChevronTextVariants = cva("text-caption font-sans-semibold", {
	variants: {
		state: { completed: "text-primary", active: "text-primary-foreground", inactive: "text-muted-foreground" },
	},
	defaultVariants: { state: "inactive" },
});

const stepperTitleVariants = cva("", {
	variants: {
		state: { completed: "font-sans-medium text-foreground", active: "font-sans-semibold text-foreground", inactive: "font-sans text-muted-foreground" },
		size: { md: "text-body", sm: "text-caption" },
	},
	defaultVariants: { state: "inactive", size: "md" },
});

const stepperItemVariants = cva("", {
	variants: {
		orientation: { horizontal: "flex-1 gap-1.5", vertical: "min-h-11 flex-row gap-3" },
		pressable: { true: "active:opacity-70", false: "" },
		compact: { true: "flex-none", false: "" },
	},
	defaultVariants: { orientation: "horizontal", pressable: false, compact: false },
});

type StepperVariantProps = VariantProps<typeof stepperVariants>;
export type StepperVariant = NonNullable<StepperVariantProps["variant"]>;
export type StepperSize = NonNullable<StepperVariantProps["size"]>;
export type StepperLabelPosition = "below" | "inline" | "none";
export type StepperIndicator = "number" | "icon" | "ring";
export type StepperTone = "primary" | "success";

export interface StepperProps {
	readonly steps: readonly StepperStep[];
	/** The active step (1-based). */
	readonly value: number;
	/** Makes the steps pressable tabs; omitted, the stepper only shows progress. */
	readonly onChange?: ((step: number) => void) | undefined;
	readonly orientation?: StepperOrientation | undefined;
	readonly variant?: StepperVariant | undefined;
	readonly size?: StepperSize | undefined;
	/** Where each title sits: under its marker (default), beside it, or nowhere (the label still names the step). */
	readonly labelPosition?: StepperLabelPosition | undefined;
	/** The marker: the step's number (default), its glyph, or a ring (a dot when current, a check when done). */
	readonly indicator?: StepperIndicator | undefined;
	/** The colour of finished steps. Default `primary`. */
	readonly completedTone?: StepperTone | undefined;
	/** Fill a finished step's connector. Default `true`. */
	readonly fillConnectors?: boolean | undefined;
	/** The active step is working: its marker spins and the stepper is busy. */
	readonly loading?: boolean | undefined;
	readonly disabled?: boolean | undefined;
	readonly formatStepLabel?: ((step: number, stepCount: number, title: string) => string) | undefined;
	readonly stateLabels?: Readonly<Record<StepState, string>> | undefined;
	readonly accessibilityLabel?: string | undefined;
	/** Extra classes for the root view, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

export const Stepper = React.memo(
	React.forwardRef<ViewInstance, StepperProps>(function Stepper(
		{
			steps,
			value,
			onChange,
			orientation = "horizontal",
			variant = "default",
			size = "md",
			labelPosition = "below",
			indicator = "number",
			completedTone = "primary",
			fillConnectors = true,
			loading = false,
			disabled = false,
			formatStepLabel = defaultStepLabel,
			stateLabels = DEFAULT_STEP_STATE_LABELS,
			accessibilityLabel,
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const state = resolveControlState({ disabled, loading });
		const isInactive = isInactiveState(state);
		const look = React.useMemo(
			(): StepLook => ({ variant, orientation, size, labelPosition, indicator, completedTone, fillConnectors }),
			[completedTone, fillConnectors, indicator, labelPosition, orientation, size, variant],
		);
		return (
			<View
				ref={ref}
				accessibilityRole={onChange === undefined ? undefined : "tablist"}
				accessibilityLabel={accessibilityLabel}
				testID={testID}
				className={cn(stepperVariants({ variant, orientation, size, state }), className)}>
				{steps.map((step: StepperStep, index: number): React.JSX.Element => {
					const position = index + 1;
					const stepState = stepStateFor(position, value, step.completed === true);
					return (
						<StepperItem
							key={step.key}
							step={step}
							position={position}
							count={steps.length}
							stepState={stepState}
							label={`${formatStepLabel(position, steps.length, step.title)}, ${stateLabels[stepState]}`}
							isLast={position === steps.length}
							isLoading={step.loading === true || (loading && stepState === "active")}
							isBlocked={isInactive || step.disabled === true}
							look={look}
							onChange={onChange}
							testID={testID === undefined ? undefined : `${testID}-step-${step.key}`}
						/>
					);
				})}
			</View>
		);
	}),
);

interface StepLook {
	readonly variant: StepperVariant;
	readonly orientation: StepperOrientation;
	readonly size: StepperSize;
	readonly labelPosition: StepperLabelPosition;
	readonly indicator: StepperIndicator;
	readonly completedTone: StepperTone;
	readonly fillConnectors: boolean;
}

interface StepperItemProps {
	readonly step: StepperStep;
	readonly position: number;
	readonly count: number;
	readonly stepState: StepState;
	readonly label: string;
	readonly isLast: boolean;
	readonly isLoading: boolean;
	readonly isBlocked: boolean;
	readonly look: StepLook;
	readonly onChange: ((step: number) => void) | undefined;
	readonly testID: string | undefined;
}

const MARKER_COLOR = "accent-primary-foreground";

interface MarkerProps {
	readonly step: StepperStep;
	readonly position: number;
	readonly stepState: StepState;
	readonly isLoading: boolean;
	readonly look: StepLook;
}

/** A step's marker: a spinner while it works, a check (or ring mark) when done, else its number, glyph or ring. */
function StepMarker({ step, position, stepState, isLoading, look }: MarkerProps): React.JSX.Element {
	const markerSize = look.variant === "dots" ? "dot" : look.size;
	const onFill = look.indicator === "ring" ? "accent-primary" : MARKER_COLOR;
	let inner: React.ReactNode = null;
	if (isLoading) {
		inner = <ActivityIndicator size="small" colorClassName={look.indicator === "ring" ? "accent-primary" : MARKER_COLOR} />;
	} else if (look.variant === "dots") {
		inner = null;
	} else if (stepState === "completed") {
		inner = (
			<Icon
				icon={CheckIcon}
				size="sm"
				weight="bold"
				colorClassName={look.indicator === "ring" ? (look.completedTone === "success" ? "accent-success" : "accent-primary") : MARKER_COLOR}
			/>
		);
	} else if (look.indicator === "ring") {
		inner = stepState === "active" ? <View className="size-2.5 rounded-full bg-primary" /> : null;
	} else if (look.indicator === "icon" && step.icon !== undefined) {
		inner = <Icon icon={step.icon} size="sm" colorClassName={stepState === "inactive" ? "accent-muted-foreground" : onFill} />;
	} else {
		inner = <Text className={stepperIndicatorTextVariants({ state: stepState, size: markerSize })}>{position}</Text>;
	}
	return <View className={stepperIndicatorVariants({ state: stepState, tone: look.completedTone, indicator: look.indicator, size: markerSize })}>{inner}</View>;
}

function edgeOf(position: number, count: number): "first" | "middle" | "last" | "only" {
	if (count === 1) {
		return "only";
	}
	if (position === 1) {
		return "first";
	}
	return position === count ? "last" : "middle";
}

const StepperItem = React.memo(function StepperItem({
	step,
	position,
	count,
	stepState,
	label,
	isLast,
	isLoading,
	isBlocked,
	look,
	onChange,
	testID,
}: StepperItemProps): React.JSX.Element {
	const handlePress = React.useCallback((): void => {
		onChange?.(position);
	}, [onChange, position]);
	const accessibilityState = React.useMemo(() => ({ selected: stepState === "active", disabled: isBlocked, busy: isLoading }), [stepState, isBlocked, isLoading]);
	const { variant, orientation, size, labelPosition, completedTone, fillConnectors } = look;
	const reached = stepState !== "inactive";

	const title =
		labelPosition === "none" ? null : (
			<View className={orientation === "vertical" ? cn("flex-1 gap-0.5", isLast ? "" : "pb-4") : "gap-0.5"}>
				<View className="flex-row flex-wrap items-center gap-1.5">
					<Text className={stepperTitleVariants({ state: stepState, size })} numberOfLines={orientation === "horizontal" ? 1 : undefined}>
						{step.title}
					</Text>
					{step.badge === undefined ? null : <View importantForAccessibility="no-hide-descendants">{step.badge}</View>}
				</View>
				{step.description === undefined ? null : <Text className="text-caption font-sans text-muted-foreground">{step.description}</Text>}
				{step.meta === undefined ? null : <Text className="text-caption font-mono text-muted-foreground">{step.meta}</Text>}
			</View>
		);

	let content: React.ReactNode;
	let compact = false;
	if (variant === "bar" || variant === "segmented") {
		content = (
			<>
				<View className={stepperSegmentVariants({ reached, tone: completedTone, thickness: variant === "segmented" ? "thick" : "thin" })} />
				{variant === "bar" ? title : null}
			</>
		);
	} else if (variant === "chevron") {
		content = (
			<View className={stepperChevronVariants({ state: stepState, edge: edgeOf(position, count) })}>
				{step.icon === undefined ? null : (
					<Icon icon={step.icon} size="xs" colorClassName={stepState === "active" ? MARKER_COLOR : stepState === "completed" ? "accent-primary" : "accent-muted-foreground"} />
				)}
				{labelPosition === "none" ? null : (
					<Text numberOfLines={1} className={stepperChevronTextVariants({ state: stepState })}>
						{step.title}
					</Text>
				)}
			</View>
		);
	} else if (variant === "tiles" || variant === "trail") {
		compact = true;
		content = (
			<View className="flex-row items-center gap-2">
				{variant === "tiles" && step.icon !== undefined ? <IconTile icon={step.icon} tone={stepState === "inactive" ? "neutral" : "brand"} size="sm" /> : null}
				{labelPosition === "none" ? null : <Text className={stepperTitleVariants({ state: stepState, size })}>{step.title}</Text>}
				{isLast ? null : <Icon icon={ChevronRightIcon} size="xs" colorClassName="accent-muted-foreground" />}
			</View>
		);
	} else {
		const marker = <StepMarker step={step} position={position} stepState={stepState} isLoading={isLoading} look={look} />;
		const separator = isLast ? null : (
			<View
				className={stepperSeparatorVariants({
					orientation,
					fill: fillConnectors && stepState === "completed" ? completedTone : "none",
					dotted: variant === "dots" && orientation === "horizontal",
				})}
			/>
		);
		if (orientation === "vertical") {
			content = (
				<>
					<View className="items-center">
						{marker}
						{separator}
					</View>
					{title}
				</>
			);
		} else if (labelPosition === "inline") {
			content = (
				<View className="flex-row items-center gap-2">
					{marker}
					{title}
					{separator}
				</View>
			);
		} else {
			content = (
				<>
					<View className="flex-row items-center gap-2">
						{marker}
						{separator}
					</View>
					{title}
				</>
			);
		}
	}

	if (onChange === undefined) {
		return (
			<View accessible accessibilityLabel={label} testID={testID} className={stepperItemVariants({ orientation, pressable: false, compact })}>
				{content}
			</View>
		);
	}
	return (
		<Pressable
			accessibilityRole="tab"
			accessibilityLabel={label}
			accessibilityState={accessibilityState}
			disabled={isBlocked}
			onPress={handlePress}
			testID={testID}
			className={stepperItemVariants({ orientation, pressable: true, compact })}>
			{content}
		</Pressable>
	);
});
