"use client";

import { Stepper, StepperContent, StepperIndicator, StepperItem, StepperNav, StepperPanel, StepperTitle, StepperTrigger } from "@workspace/ui/components/stepper";
import type * as React from "react";
import { useState } from "react";

interface StepEntry {
	readonly step: number;
	readonly title: string;
}

/** The step the example opens on. */
const INITIAL_STEP = 2;
const STEPS: readonly StepEntry[] = [
	{ step: 1, title: "User Details" },
	{ step: 2, title: "Payment Info" },
	{ step: 3, title: "Auth OTP" },
	{ step: 4, title: "Preview Form" },
];

export function Stepper11Example(): React.JSX.Element {
	const [activeStep, setActiveStep] = useState<number>(INITIAL_STEP);

	return (
		<Stepper value={activeStep} onValueChange={setActiveStep} className="w-full max-w-lg space-y-8">
			<StepperNav className="mb-10 gap-5">
				{STEPS.map(({ step, title }: StepEntry): React.JSX.Element => (
					<StepperItem key={step} step={step} className="relative flex-1 items-start">
						<StepperTrigger className="flex grow flex-col items-start justify-center gap-3.5">
							<StepperIndicator className="h-1 w-full rounded-full bg-border data-[state=active]:bg-primary data-[state=completed]:bg-primary">
								<span className="sr-only">{step}</span>
							</StepperIndicator>
							<StepperTitle className="text-start font-semibold group-data-[state=inactive]/step:text-muted-foreground">{title}</StepperTitle>
						</StepperTrigger>
					</StepperItem>
				))}
			</StepperNav>

			<StepperPanel className="text-sm">
				{STEPS.map(({ step, title }: StepEntry): React.JSX.Element => (
					<StepperContent key={step} value={step} className="flex items-center justify-center">
						{title} content
					</StepperContent>
				))}
			</StepperPanel>
		</Stepper>
	);
}
