"use client";

import { Progress, ProgressLabel, ProgressValue } from "@workspace/ui/components/progress";
import {
	Stepper,
	StepperDescription,
	StepperIndicator,
	StepperItem,
	StepperNav,
	StepperSeparator,
	StepperTitle,
	StepperTrigger,
	type StepIndicators,
	type StepperOrientation,
} from "@workspace/ui/components/stepper";
import { cn } from "@workspace/ui/lib/core/utils";
import { Check } from "lucide-react";
import { useCallback, type JSX } from "react";

export interface OnboardingTimelineStep<TStepId extends string> {
	readonly id: TStepId;
	readonly label: string;
	readonly description: string;
}

/** The current step's position; an unknown id falls back to the first step. */
export function currentStepIndex<TStepId extends string>(steps: readonly OnboardingTimelineStep<TStepId>[], currentStepId: TStepId): number {
	return Math.max(
		0,
		steps.findIndex((step) => step.id === currentStepId),
	);
}

/**
 * Only steps already passed can be revisited — never a later one, so a step
 * can't be reached without completing those before it. While navigation is
 * locked (submitting), every step but the current one is disabled.
 */
export function isOnboardingStepDisabled(index: number, currentIndex: number, isNavigationDisabled: boolean): boolean {
	if (index === currentIndex) {
		return false;
	}
	return isNavigationDisabled || index > currentIndex;
}

const COMPLETED_INDICATORS: StepIndicators = { completed: <Check className="size-3.5" strokeWidth={3} /> };

interface OnboardingStepperProps<TStepId extends string> {
	readonly steps: readonly OnboardingTimelineStep<TStepId>[];
	readonly currentStepId: TStepId;
	/** Called with a completed step's id when the user goes back to it. */
	readonly onStepSelect: (stepId: TStepId) => void;
	/** Locks going back (e.g. while the application is being submitted). */
	readonly isNavigationDisabled?: boolean;
}

interface OnboardingStepperLayoutProps<TStepId extends string> extends OnboardingStepperProps<TStepId> {
	readonly orientation: StepperOrientation;
}

/** The step trail itself, shared by the full timeline and the compact bar. */
function OnboardingStepper<TStepId extends string>({
	steps,
	currentStepId,
	onStepSelect,
	isNavigationDisabled = false,
	orientation,
}: OnboardingStepperLayoutProps<TStepId>): JSX.Element {
	const currentIndex = currentStepIndex(steps, currentStepId);
	const isVertical = orientation === "vertical";

	// Stepper values are 1-based positions.
	const handleValueChange = useCallback(
		(value: number): void => {
			const target = steps[value - 1];
			if (target !== undefined && target.id !== currentStepId) {
				onStepSelect(target.id);
			}
		},
		[currentStepId, onStepSelect, steps],
	);

	return (
		<Stepper value={currentIndex + 1} onValueChange={handleValueChange} orientation={orientation} indicators={COMPLETED_INDICATORS}>
			<StepperNav aria-label="Application steps" className={isVertical ? "w-full" : undefined}>
				{steps.map((step, index) => {
					const isLast = index === steps.length - 1;
					return (
						<StepperItem
							key={step.id}
							step={index + 1}
							disabled={isOnboardingStepDisabled(index, currentIndex, isNavigationDisabled)}
							className={cn(isVertical && "relative items-start")}>
							<StepperTrigger className={cn("rounded-lg text-start", isVertical && "w-full items-start gap-3", isVertical && !isLast && "pb-6")}>
								<StepperIndicator size={isVertical ? "md" : "sm"} className="data-[state=active]:ring-4 data-[state=active]:ring-primary/15">
									{index + 1}
								</StepperIndicator>
								<div className={cn("min-w-0 space-y-1", isVertical ? "pt-1.5" : "sr-only")}>
									<StepperTitle className="group-data-[state=inactive]/step:text-muted-foreground">{step.label}</StepperTitle>
									<StepperDescription className="text-xs">{step.description}</StepperDescription>
								</div>
							</StepperTrigger>
							{isLast ? null : (
								<StepperSeparator
									className={cn(
										"group-data-[state=completed]/step:bg-primary",
										isVertical && "absolute top-9 bottom-1 left-4 m-0 -translate-x-1/2 group-data-[orientation=vertical]/stepper-nav:h-auto",
										!isVertical && "mx-2",
									)}
								/>
							)}
						</StepperItem>
					);
				})}
			</StepperNav>
		</Stepper>
	);
}

export type MerchantOnboardingTimelineProps<TStepId extends string> = OnboardingStepperProps<TStepId>;

/** The application's full timeline: overall progress, then every step with its description. */
export function MerchantOnboardingTimeline<TStepId extends string>(props: MerchantOnboardingTimelineProps<TStepId>): JSX.Element {
	const currentIndex = currentStepIndex(props.steps, props.currentStepId);

	return (
		<div className="space-y-5">
			<Progress value={currentIndex} max={props.steps.length} size="sm">
				<ProgressLabel className="text-xs font-medium text-muted-foreground">Application progress</ProgressLabel>
				<ProgressValue className="text-xs font-medium text-foreground" />
			</Progress>
			<OnboardingStepper {...props} orientation="vertical" />
		</div>
	);
}

/**
 * The compact, horizontal form of the timeline for narrow screens, where the
 * full timeline would push the form below the fold: numbered marks only, with
 * each step's name and description kept for assistive technology.
 */
export function MerchantOnboardingCompactProgress<TStepId extends string>(props: MerchantOnboardingTimelineProps<TStepId>): JSX.Element {
	return <OnboardingStepper {...props} orientation="horizontal" />;
}
