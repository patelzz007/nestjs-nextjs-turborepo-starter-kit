"use client";

import { Progress, ProgressLabel, ProgressValue } from "@workspace/ui/components/feedback/progress";
import {
	Stepper,
	StepperContent,
	StepperDescription,
	StepperIndicator,
	StepperItem,
	StepperStep,
	StepperTitle,
	StepperTrigger,
	type StepperItemStatus,
} from "@workspace/ui/components/navigation/stepper";
import { Check } from "lucide-react";
import { useCallback, type JSX } from "react";

export interface OnboardingTimelineStep<TStepId extends string> {
	readonly id: TStepId;
	readonly label: string;
	readonly description: string;
}

/** Steps before the current one are complete; the rest are still to come. */
export function onboardingStepStatus(index: number, currentIndex: number): StepperItemStatus {
	if (index < currentIndex) {
		return "complete";
	}
	return index === currentIndex ? "current" : "upcoming";
}

/** The current step's position; an unknown id falls back to the first step. */
export function currentStepIndex<TStepId extends string>(steps: readonly OnboardingTimelineStep<TStepId>[], currentStepId: TStepId): number {
	return Math.max(
		0,
		steps.findIndex((step) => step.id === currentStepId),
	);
}

/** The indicator's content: a check once done, otherwise the 1-based step number. */
function StepMark({ index, status }: { readonly index: number; readonly status: StepperItemStatus }): JSX.Element {
	return status === "complete" ? <Check strokeWidth={3} /> : <>{index + 1}</>;
}

interface OnboardingProgressProps<TStepId extends string> {
	readonly steps: readonly OnboardingTimelineStep<TStepId>[];
	readonly currentStepId: TStepId;
}

export interface MerchantOnboardingTimelineProps<TStepId extends string> extends OnboardingProgressProps<TStepId> {
	/** Called with a completed step's id when the user goes back to it. */
	readonly onStepSelect: (stepId: TStepId) => void;
	/** Locks going back (e.g. while the application is being submitted). */
	readonly isNavigationDisabled?: boolean;
}

interface TimelineItemProps<TStepId extends string> {
	readonly step: OnboardingTimelineStep<TStepId>;
	readonly index: number;
	readonly status: StepperItemStatus;
	readonly onStepSelect: (stepId: TStepId) => void;
	readonly isNavigationDisabled: boolean;
}

/** One timeline row: a button back to the step once it is complete, plain text otherwise. */
function TimelineItem<TStepId extends string>({ step, index, status, onStepSelect, isNavigationDisabled }: TimelineItemProps<TStepId>): JSX.Element {
	const handleSelect = useCallback((): void => {
		onStepSelect(step.id);
	}, [onStepSelect, step.id]);

	const content = (
		<>
			<StepperIndicator>
				<StepMark index={index} status={status} />
			</StepperIndicator>
			<StepperContent>
				<StepperTitle>{step.label}</StepperTitle>
				<StepperDescription>{step.description}</StepperDescription>
				{status === "complete" ? <span className="sr-only">(completed, select to edit)</span> : null}
				{status === "current" ? <span className="sr-only">(current step)</span> : null}
			</StepperContent>
		</>
	);

	return (
		<StepperItem status={status}>
			{status === "complete" ? (
				<StepperTrigger disabled={isNavigationDisabled} onClick={handleSelect}>
					{content}
				</StepperTrigger>
			) : (
				<StepperStep>{content}</StepperStep>
			)}
		</StepperItem>
	);
}

/**
 * The application's full timeline: overall progress, then every step with its
 * description. Completed steps are buttons back to that step — never forward,
 * so a step can't be reached without passing the ones before it.
 */
export function MerchantOnboardingTimeline<TStepId extends string>({
	steps,
	currentStepId,
	onStepSelect,
	isNavigationDisabled = false,
}: MerchantOnboardingTimelineProps<TStepId>): JSX.Element {
	const currentIndex = currentStepIndex(steps, currentStepId);

	return (
		<div className="space-y-5">
			<Progress value={currentIndex} max={steps.length} size="sm">
				<ProgressLabel className="text-xs font-medium text-muted-foreground">Application progress</ProgressLabel>
				<ProgressValue className="text-xs font-medium text-foreground" />
			</Progress>

			<Stepper aria-label="Application steps">
				{steps.map((step, index) => (
					<TimelineItem
						key={step.id}
						step={step}
						index={index}
						status={onboardingStepStatus(index, currentIndex)}
						onStepSelect={onStepSelect}
						isNavigationDisabled={isNavigationDisabled}
					/>
				))}
			</Stepper>
		</div>
	);
}

/**
 * The compact, horizontal form of the timeline for narrow screens, where the
 * full timeline would push the form below the fold: numbered marks only, with
 * each step's name kept for assistive technology.
 */
export function MerchantOnboardingCompactProgress<TStepId extends string>({ steps, currentStepId }: OnboardingProgressProps<TStepId>): JSX.Element {
	const currentIndex = currentStepIndex(steps, currentStepId);

	return (
		<Stepper aria-label="Application steps" orientation="horizontal" size="sm">
			{steps.map((step, index) => {
				const status = onboardingStepStatus(index, currentIndex);
				return (
					<StepperItem key={step.id} status={status}>
						<StepperStep>
							<StepperIndicator>
								<StepMark index={index} status={status} />
							</StepperIndicator>
							<StepperTitle className="sr-only">
								{step.label}
								{status === "complete" ? " (completed)" : status === "current" ? " (current step)" : ""}
							</StepperTitle>
						</StepperStep>
					</StepperItem>
				);
			})}
		</Stepper>
	);
}
