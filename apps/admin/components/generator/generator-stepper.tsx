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

interface WizardStepItemProps {
	readonly step: WizardStepId;
	readonly index: number;
	readonly isComplete: boolean;
	readonly isCurrent: boolean;
	readonly isUpcoming: boolean;
	readonly onStepSelect?: (stepId: WizardStepId["id"]) => void;
}

function WizardStepItem({ step, index, isComplete, isCurrent, isUpcoming, onStepSelect }: WizardStepItemProps): React.JSX.Element {
	const isFocusable = isComplete && onStepSelect !== undefined;

	const handleClick = React.useCallback((): void => {
		onStepSelect?.(step.id);
	}, [onStepSelect, step.id]);

	const handleKeyDown = React.useCallback(
		function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>): void {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				onStepSelect?.(step.id);
			}
		},
		[onStepSelect, step.id],
	);

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
					onClick={handleClick}
					onKeyDown={handleKeyDown}>
					{stepContent}
				</button>
			) : (
				<div className="flex items-start gap-2">{stepContent}</div>
			)}
		</li>
	);
}

export const GeneratorStepper = React.memo(function GeneratorStepper({ steps, currentStepId, completedStepIds, onStepSelect }: GeneratorStepperProps): React.JSX.Element {
	const currentIndex = steps.findIndex((step) => step.id === currentStepId);

	return (
		<nav aria-label="Generator wizard progress" className="w-full">
			<ol className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
				{steps.map((step, index) => (
					<WizardStepItem
						key={step.id}
						step={step}
						index={index}
						isComplete={completedStepIds.has(step.id)}
						isCurrent={step.id === currentStepId}
						isUpcoming={index > currentIndex}
						onStepSelect={onStepSelect}
					/>
				))}
			</ol>
		</nav>
	);
});

GeneratorStepper.displayName = "GeneratorStepper";
