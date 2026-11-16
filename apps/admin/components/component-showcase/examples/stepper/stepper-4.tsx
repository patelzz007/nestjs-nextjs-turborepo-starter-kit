"use client";

import { Button } from "@workspace/ui/components/button";
import { Stepper, StepperContent, StepperIndicator, StepperItem, StepperNav, StepperPanel, StepperSeparator, StepperTrigger } from "@workspace/ui/components/stepper";
import type * as React from "react";
import { useCallback, useState } from "react";

/** The step the example opens on. */
const INITIAL_STEP = 2;
const FIRST_STEP = 1;
/** How far one Previous / Next click moves. */
const STEP_INCREMENT = 1;
const STEPS: readonly number[] = [1, 2, 3, 4];

function previousStep(step: number): number {
	return step - STEP_INCREMENT;
}

function nextStep(step: number): number {
	return step + STEP_INCREMENT;
}

export function Stepper4Example(): React.JSX.Element {
	const [activeStep, setActiveStep] = useState<number>(INITIAL_STEP);

	const goToPreviousStep = useCallback((): void => {
		setActiveStep(previousStep);
	}, []);

	const goToNextStep = useCallback((): void => {
		setActiveStep(nextStep);
	}, []);

	return (
		<Stepper value={activeStep} onValueChange={setActiveStep} className="w-full max-w-md space-y-8">
			<StepperNav>
				{STEPS.map((step: number): React.JSX.Element => (
					<StepperItem key={step} step={step}>
						<StepperTrigger>
							<StepperIndicator className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=completed]:bg-success data-[state=completed]:text-success-foreground data-[state=inactive]:text-muted-foreground">
								{step}
							</StepperIndicator>
						</StepperTrigger>
						{step < STEPS.length ? <StepperSeparator className="group-data-[state=completed]/step:bg-success" /> : null}
					</StepperItem>
				))}
			</StepperNav>

			<StepperPanel className="text-sm">
				{STEPS.map((step: number): React.JSX.Element => (
					<StepperContent className="flex w-full items-center justify-center" key={step} value={step}>
						Step {step} content
					</StepperContent>
				))}
			</StepperPanel>

			<div className="flex items-center justify-between gap-2.5">
				<Button variant="outline" onClick={goToPreviousStep} disabled={activeStep === FIRST_STEP}>
					Previous
				</Button>
				<Button variant="outline" onClick={goToNextStep} disabled={activeStep === STEPS.length}>
					Next
				</Button>
			</div>
		</Stepper>
	);
}
