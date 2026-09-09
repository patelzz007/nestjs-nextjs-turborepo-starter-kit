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
}: MerchantOnboardingStepperProps): React.JSX.Element {
	const currentIndex = steps.findIndex((step) => step.id === currentStepId);

	return (
		<nav aria-label="Onboarding progress" className="w-full">
			<ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{steps.map((step, index) => {
					const isComplete = completedStepIds.has(step.id);
					const isCurrent = step.id === currentStepId;
					const isUpcoming = index > currentIndex;

					const stepClassName = isCurrent
						? "rounded-xl border border-primary bg-primary/5 px-3 py-3 shadow-xs transition-colors"
						: isUpcoming
							? "rounded-xl border border-border bg-card px-3 py-3 opacity-70 transition-colors"
							: "rounded-xl border border-border bg-card px-3 py-3 transition-colors";
					const indicatorClassName = isComplete
						? "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground"
						: isCurrent
							? "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-medium text-primary"
							: "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground";

					return (
						<li key={step.id} aria-current={isCurrent ? "step" : undefined} className={stepClassName}>
							<div className="flex items-start gap-2">
								<div className={indicatorClassName} aria-hidden="true">
									{isComplete ? "✓" : index + 1}
								</div>
								<div className="min-w-0">
									<p className="text-sm font-medium">{step.label}</p>
									<p className="text-xs text-muted-foreground">{step.description}</p>
								</div>
							</div>
						</li>
					);
				})}
			</ol>
		</nav>
	);
});

MerchantOnboardingStepper.displayName = "MerchantOnboardingStepper";
