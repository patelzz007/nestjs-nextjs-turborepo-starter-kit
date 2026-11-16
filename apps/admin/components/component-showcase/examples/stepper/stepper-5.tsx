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
	{ step: 1, title: "Step 1" },
	{ step: 2, title: "Step 2" },
	{ step: 3, title: "Step 3" },
];

const STEP_INDICATORS: StepIndicators = {
	completed: <CheckIcon className="size-3.5" />,
	loading: <LoaderCircleIcon className="size-3.5 animate-spin" />,
};

export function Stepper5Example(): React.JSX.Element {
	const [activeStep, setActiveStep] = useState<number>(INITIAL_STEP);

	return (
		<Stepper className="w-full max-w-md space-y-8" value={activeStep} onValueChange={setActiveStep} indicators={STEP_INDICATORS}>
			<StepperNav>
				{STEPS.map(({ step, title }: StepEntry): React.JSX.Element => (
					<StepperItem key={step} step={step} className="relative flex-1 items-start">
						<StepperTrigger className="flex flex-col gap-2.5">
							<StepperIndicator>{step}</StepperIndicator>
							<StepperTitle>{title}</StepperTitle>
						</StepperTrigger>

						{step < STEPS.length ? (
							<StepperSeparator className="absolute inset-x-0 top-3 left-[calc(50%+0.875rem)] m-0 group-data-[orientation=horizontal]/stepper-nav:w-[calc(100%-2rem+0.225rem)] group-data-[orientation=horizontal]/stepper-nav:flex-none group-data-[state=completed]/step:bg-primary" />
						) : null}
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
