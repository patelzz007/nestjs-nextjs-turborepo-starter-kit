"use client";

import * as React from "react";

export interface MerchantOnboardingStep {
	readonly id: string;
	readonly label: string;
	readonly description: string;
}

export interface MerchantOnboardingStepperProps {
	readonly steps: readonly MerchantOnboardingStep[];
	readonly currentStepId: string;
	readonly completedStepIds: ReadonlySet<string>;
}

export const MerchantOnboardingStepper = React.memo(function MerchantOnboardingStepper({
	steps,
	currentStepId,
	completedStepIds,
}: MerchantOnboardingStepperProps): React.JSX.Element | null {
	const currentIndex = Math.max(
		0,
		steps.findIndex((step) => step.id === currentStepId),
	);
	const currentStep = steps[currentIndex];

	if (currentStep === undefined || steps.length === 0) {
		return null;
	}

	return (
		<nav aria-label={`Onboarding step ${String(currentIndex + 1)} of ${String(steps.length)}: ${currentStep.label}`} className="w-full space-y-2">
			<div className="flex items-baseline justify-between gap-3">
				<p className="text-sm font-medium text-foreground">{currentStep.label}</p>
				<p className="shrink-0 text-xs text-muted-foreground tabular-nums">
					{currentIndex + 1} / {steps.length}
				</p>
			</div>

			<ol className="flex gap-1">
				{steps.map((step, index) => {
					const isComplete = completedStepIds.has(step.id);
					const isCurrent = step.id === currentStepId;
					const isFilled = index <= currentIndex;

					const segmentClassName = isFilled ? "bg-primary" : "bg-muted";

					return (
						<li key={step.id} aria-current={isCurrent ? "step" : undefined} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${segmentClassName}`}>
							<span className="sr-only">
								{step.label}
								{isComplete ? " (completed)" : isCurrent ? " (current)" : ""}
							</span>
						</li>
					);
				})}
			</ol>
		</nav>
	);
});

MerchantOnboardingStepper.displayName = "MerchantOnboardingStepper";
