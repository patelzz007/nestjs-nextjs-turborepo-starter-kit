"use client";

import {
	Stepper,
	StepperContent,
	StepperIndicator,
	StepperItem,
	StepperNav,
	StepperPanel,
	StepperSeparator,
	StepperTitle,
	StepperTrigger,
	type StepIndicators,
} from "@workspace/ui/components/stepper";
import { CheckIcon, LoaderCircleIcon } from "lucide-react";
import type * as React from "react";
import { useState } from "react";

interface StepEntry {
	readonly step: number;
	readonly title: string;
}

/** The step the example opens on. */
const INITIAL_STEP = 2;
const STEPS: readonly StepEntry[] = [
	{ step: 1, title: "Account" },
	{ step: 2, title: "Profile" },
	{ step: 3, title: "Review" },
];

const STEP_INDICATORS: StepIndicators = {
	completed: <CheckIcon className="size-3.5" />,
	loading: <LoaderCircleIcon className="size-3.5 animate-spin" />,
};

export function Stepper9Example(): React.JSX.Element {
	const [activeStep, setActiveStep] = useState<number>(INITIAL_STEP);

	return (
		<Stepper value={activeStep} onValueChange={setActiveStep} indicators={STEP_INDICATORS} className="w-full max-w-md space-y-8">
			<StepperNav>
				{STEPS.map(({ step, title }: StepEntry): React.JSX.Element => (
					<StepperItem key={step} step={step} className="relative">
						<StepperTrigger className="flex justify-start gap-1.5">
							<StepperIndicator>{step}</StepperIndicator>
							<StepperTitle>{title}</StepperTitle>
						</StepperTrigger>

						{step < STEPS.length ? <StepperSeparator className="group-data-[state=completed]/step:bg-primary md:mx-2.5" /> : null}
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
