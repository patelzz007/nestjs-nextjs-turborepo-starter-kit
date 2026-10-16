"use client";

import { Stepper, StepperContent, StepperIndicator, StepperItem, StepperNav, StepperPanel, StepperSeparator, StepperTrigger } from "@workspace/ui/components/stepper";
import type * as React from "react";
import { useState } from "react";

/** The step the example opens on. */
const INITIAL_STEP = 2;
const STEPS: readonly number[] = [1, 2, 3, 4];

export function Stepper2Example(): React.JSX.Element {
	const [activeStep, setActiveStep] = useState<number>(INITIAL_STEP);

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
		</Stepper>
	);
}
