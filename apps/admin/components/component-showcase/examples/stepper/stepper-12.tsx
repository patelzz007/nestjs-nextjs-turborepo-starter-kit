"use client";

import { Button } from "@workspace/ui/components/button";
import { Stepper, StepperContent, StepperIndicator, StepperItem, StepperNav, StepperPanel, StepperTrigger } from "@workspace/ui/components/stepper";
import { cn } from "@workspace/ui/lib/core/utils";
import { ArrowLeftIcon } from "lucide-react";
import type * as React from "react";
import { useCallback, useState } from "react";

const FIRST_STEP = 1;
/** How far one Back / Next click moves. */
const STEP_INCREMENT = 1;
const STEPS: readonly number[] = [1, 2, 3, 4];

function previousStep(step: number): number {
	return step - STEP_INCREMENT;
}

function nextStep(step: number): number {
	return step + STEP_INCREMENT;
}

export function Stepper12Example(): React.JSX.Element {
	const [activeStep, setActiveStep] = useState<number>(FIRST_STEP);

	const goToPreviousStep = useCallback((): void => {
		setActiveStep(previousStep);
	}, []);

	const goToNextStep = useCallback((): void => {
		setActiveStep(nextStep);
	}, []);

	return (
		<div className="w-full max-w-md">
			<Stepper value={activeStep} onValueChange={setActiveStep}>
				<StepperNav>
					{STEPS.map((step: number): React.JSX.Element => (
						<StepperItem key={step} step={step} className="flex-1 overflow-hidden transition-all duration-300 first:rounded-s-full last:rounded-e-full">
							<StepperTrigger className="w-full flex-col items-start gap-2">
								<StepperIndicator className="h-2 w-full rounded-none! bg-border">
									<span className="sr-only">{step}</span>
								</StepperIndicator>
							</StepperTrigger>
						</StepperItem>
					))}
				</StepperNav>

				<div className="flex items-center justify-between gap-2.5 py-1">
					<Button variant="link" onClick={goToPreviousStep} className={cn("px-0", activeStep === FIRST_STEP && "pointer-events-none opacity-0")}>
						<ArrowLeftIcon className="size-4" />
						Back
					</Button>

					<div className="text-sm font-medium">
						<span className="text-foreground">{activeStep}</span> <span className="text-muted-foreground/60">/ {STEPS.length}</span>
					</div>
				</div>

				<StepperPanel className="py-6 text-sm">
					{STEPS.map((step: number): React.JSX.Element => (
						<StepperContent className="flex w-full items-center justify-center" key={step} value={step}>
							Step {step} content
						</StepperContent>
					))}
				</StepperPanel>

				<div className="flex items-center justify-end gap-2.5">
					<Button variant="outline" onClick={goToNextStep} disabled={activeStep === STEPS.length}>
						Next
					</Button>
				</div>
			</Stepper>
		</div>
	);
}
