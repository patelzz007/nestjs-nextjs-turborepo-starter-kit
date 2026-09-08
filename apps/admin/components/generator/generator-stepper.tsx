"use client";

import { Check } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";
import type { WizardStepId } from "@/lib/generator/wizard-draft";

export interface GeneratorStepperProps {
	readonly steps: readonly WizardStepId[];
	readonly currentStepId: WizardStepId["id"];
	readonly completedStepIds: ReadonlySet<WizardStepId["id"]>;
	readonly onStepSelect?: (stepId: WizardStepId["id"]) => void;
}

export const GeneratorStepper = React.memo(function GeneratorStepper({ steps, currentStepId, completedStepIds, onStepSelect }: GeneratorStepperProps): React.JSX.Element {
	const currentIndex = steps.findIndex((step) => step.id === currentStepId);

	const handleStepKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, stepId: WizardStepId["id"]): void => {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			onStepSelect?.(stepId);
		}
	};

	return (
		<nav aria-label="Generator wizard progress" className="w-full">
			<ol className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
				{steps.map((step, index) => {
					const isComplete = completedStepIds.has(step.id);
					const isCurrent = step.id === currentStepId;
					const isUpcoming = index > currentIndex;
					const isFocusable = isComplete && onStepSelect !== undefined;

					const stepContent = (
						<>
							<div
								className={cn(
									"mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
									isComplete ? "bg-primary text-primary-foreground" : isCurrent ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
								)}>
								{isComplete ? <Check className="size-3.5" aria-hidden="true" /> : index + 1}
							</div>
							<div className="min-w-0">
								<p className="text-sm font-medium">{step.label}</p>
								<p className="text-xs text-muted-foreground">{step.description}</p>
							</div>
						</>
					);

					return (
						<li
							key={step.id}
							aria-current={isCurrent ? "step" : undefined}
							className={cn(
								"rounded-xl border px-3 py-3 transition-colors",
								isCurrent ? "border-primary bg-primary/5 shadow-xs" : "border-border bg-card",
								isUpcoming ? "opacity-70" : "opacity-100",
							)}>
							{isFocusable ? (
								<button
									type="button"
									className="flex w-full items-start gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
									onClick={() => {
										onStepSelect(step.id);
									}}
									onKeyDown={(event) => {
										handleStepKeyDown(event, step.id);
									}}>
									{stepContent}
								</button>
							) : (
								<div className="flex items-start gap-2">{stepContent}</div>
							)}
						</li>
					);
				})}
			</ol>
		</nav>
	);
});

GeneratorStepper.displayName = "GeneratorStepper";
