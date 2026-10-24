// A sequence of steps ("Details → Shipping → Payment → Review") with the
// active one marked: every earlier (or explicitly completed) step is
// `completed`, the active one is `active`, later ones are `inactive` — the web
// kit's `StepState` vocabulary. Controlled: the caller owns `value` (the
// 1-based active step, as on the web) and decides whether a step may be
// opened; pass `onChange` to make the steps pressable tabs, omit it for a
// read-only progress display. Labels are generic and overridable.

import CheckIcon from "lucide-react-native/icons/check";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { ActivityIndicator, Pressable, Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { isInactiveState, resolveControlState } from "../lib/control-state";
import { Icon } from "./icon";

export type StepperOrientation = "horizontal" | "vertical";
export type StepState = "active" | "completed" | "inactive";

export interface StepperStep {
	/** Stable identity of the step (not its position). */
	readonly key: string;
	readonly title: string;
	readonly description?: string;
	/** Marks the step completed regardless of the active step. */
	readonly completed?: boolean;
	/** The step cannot be opened (only meaningful with `onChange`). */
	readonly disabled?: boolean;
}

/** The step's state from its position and the active step (the web kit's rule). */
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
		variant: { default: "" },
		orientation: { horizontal: "flex-row gap-2", vertical: "" },
		size: { md: "", sm: "" },
		state: { default: "", loading: "", disabled: "opacity-60", error: "" },
	},
	defaultVariants: { variant: "default", orientation: "horizontal", size: "md", state: "default" },
});

export const stepperIndicatorVariants = cva("items-center justify-center rounded-full", {
	variants: {
		state: {
			completed: "bg-primary",
			active: "bg-primary",
			inactive: "border border-border bg-muted",
		},
		size: { md: "size-8", sm: "size-6" },
	},
	defaultVariants: { state: "inactive", size: "md" },
});

const stepperIndicatorTextVariants = cva("font-sans-semibold", {
	variants: {
		state: { completed: "text-primary-foreground", active: "text-primary-foreground", inactive: "text-muted-foreground" },
		size: { md: "text-sm", sm: "text-xs" },
	},
	defaultVariants: { state: "inactive", size: "md" },
});

/** The line from a step to the next one: filled once the step is completed. */
const stepperSeparatorVariants = cva("rounded-full", {
	variants: {
		orientation: { horizontal: "h-0.5 flex-1", vertical: "my-1 w-0.5 flex-1" },
		state: { completed: "bg-primary", active: "bg-border", inactive: "bg-border" },
	},
	defaultVariants: { orientation: "horizontal", state: "inactive" },
});

const stepperTitleVariants = cva("", {
	variants: {
		state: { completed: "font-sans-medium text-foreground", active: "font-sans-semibold text-foreground", inactive: "font-sans text-muted-foreground" },
		size: { md: "text-sm", sm: "text-xs" },
	},
	defaultVariants: { state: "inactive", size: "md" },
});

const stepperItemVariants = cva("", {
	variants: {
		orientation: { horizontal: "flex-1 gap-1.5", vertical: "min-h-11 flex-row gap-3" },
		pressable: { true: "active:opacity-70", false: "" },
	},
	defaultVariants: { orientation: "horizontal", pressable: false },
});

const CHECK_COLOR = "accent-primary-foreground";

type StepperVariantProps = VariantProps<typeof stepperVariants>;
export type StepperVariant = NonNullable<StepperVariantProps["variant"]>;
export type StepperSize = NonNullable<StepperVariantProps["size"]>;

export interface StepperProps {
	readonly steps: readonly StepperStep[];
	/** The active step (1-based, as on the web). */
	readonly value: number;
	/** Called with the step the user opens; omit it to make the steps read-only. */
	readonly onChange?: (step: number) => void;
	readonly orientation?: StepperOrientation;
	readonly variant?: StepperVariant;
	readonly size?: StepperSize;
	/** The active step is working: its indicator shows a spinner and no step can be opened. */
	readonly loading?: boolean;
	readonly disabled?: boolean;
	/** Each step's accessible name, before its state; defaults to "Step 2 of 4: Shipping". */
	readonly formatStepLabel?: (step: number, stepCount: number, title: string) => string;
	/** The word spoken for each state ("completed", "current", "upcoming"). */
	readonly stateLabels?: Readonly<Record<StepState, string>>;
	/** The group's accessible name ("Checkout progress"). */
	readonly accessibilityLabel?: string;
	/** Extra classes for the container, merged last. */
	readonly className?: string;
	readonly testID?: string;
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
							stepState={stepState}
							label={`${formatStepLabel(position, steps.length, step.title)}, ${stateLabels[stepState]}`}
							isLast={position === steps.length}
							isLoading={loading ? stepState === "active" : false}
							isBlocked={isInactive || step.disabled === true}
							orientation={orientation}
							size={size}
							onChange={onChange}
							testID={testID === undefined ? undefined : `${testID}-step-${step.key}`}
						/>
					);
				})}
			</View>
		);
	}),
);

interface StepperItemProps {
	readonly step: StepperStep;
	readonly position: number;
	readonly stepState: StepState;
	readonly label: string;
	readonly isLast: boolean;
	readonly isLoading: boolean;
	readonly isBlocked: boolean;
	readonly orientation: StepperOrientation;
	readonly size: StepperSize;
	readonly onChange: ((step: number) => void) | undefined;
	readonly testID: string | undefined;
}

const StepperItem = React.memo(function StepperItem({
	step,
	position,
	stepState,
	label,
	isLast,
	isLoading,
	isBlocked,
	orientation,
	size,
	onChange,
	testID,
}: StepperItemProps): React.JSX.Element {
	const handlePress = React.useCallback((): void => {
		onChange?.(position);
	}, [onChange, position]);
	const accessibilityState = React.useMemo(() => ({ selected: stepState === "active", disabled: isBlocked, busy: isLoading }), [stepState, isBlocked, isLoading]);

	const indicator = (
		<View className={stepperIndicatorVariants({ state: stepState, size })}>
			{isLoading ? <ActivityIndicator size="small" colorClassName={CHECK_COLOR} /> : null}
			{!isLoading && stepState === "completed" ? <Icon icon={CheckIcon} size="sm" weight="bold" colorClassName={CHECK_COLOR} /> : null}
			{!isLoading && stepState !== "completed" ? <Text className={stepperIndicatorTextVariants({ state: stepState, size })}>{position}</Text> : null}
		</View>
	);
	const separator = isLast ? null : <View className={stepperSeparatorVariants({ orientation, state: stepState })} />;
	const text = (
		<View className={orientation === "vertical" ? cn("flex-1 gap-0.5", isLast ? "" : "pb-4") : "gap-0.5"}>
			<Text className={stepperTitleVariants({ state: stepState, size })} numberOfLines={orientation === "horizontal" ? 1 : undefined}>
				{step.title}
			</Text>
			{step.description === undefined ? null : <Text className="font-sans text-xs text-muted-foreground">{step.description}</Text>}
		</View>
	);
	const content =
		orientation === "horizontal" ? (
			<>
				<View className="flex-row items-center gap-2">
					{indicator}
					{separator}
				</View>
				{text}
			</>
		) : (
			<>
				<View className="items-center">
					{indicator}
					{separator}
				</View>
				{text}
			</>
		);

	if (onChange === undefined) {
		return (
			<View accessible accessibilityLabel={label} testID={testID} className={stepperItemVariants({ orientation, pressable: false })}>
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
			className={stepperItemVariants({ orientation, pressable: true })}>
			{content}
		</Pressable>
	);
});
