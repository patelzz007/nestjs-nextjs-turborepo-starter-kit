"use client";

import {
	Stepper,
	StepperContent,
	StepperDescription,
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
	readonly description: string;
}

/** The step the example opens on. */
const INITIAL_STEP = 2;
const STEPS: readonly StepEntry[] = [
	{ step: 1, title: "Account", description: "Create your account" },
	{ step: 2, title: "Profile", description: "Set up your profile" },
	{ step: 3, title: "Complete", description: "Review and finish" },
];

const STEP_INDICATORS: StepIndicators = {
	completed: <CheckIcon className="size-3.5" />,
	loading: <LoaderCircleIcon className="size-3.5 animate-spin" />,
};

export function Stepper8Example(): React.JSX.Element {
	const [activeStep, setActiveStep] = useState<number>(INITIAL_STEP);

	return (
		<Stepper value={activeStep} onValueChange={setActiveStep} indicators={STEP_INDICATORS} className="w-full max-w-md space-y-8">
			<StepperNav>
				{STEPS.map(({ step, title, description }: StepEntry): React.JSX.Element => (
					<StepperItem key={step} step={step} className="relative flex-1 items-start">
						<StepperTrigger className="flex flex-col gap-2.5">
							<StepperIndicator>{step}</StepperIndicator>
							<StepperTitle>{title}</StepperTitle>
							<StepperDescription>{description}</StepperDescription>
						</StepperTrigger>

						{step < STEPS.length ? (
							<StepperSeparator className="absolute inset-x-0 top-2.5 left-[calc(50%+0.875rem)] m-0 group-data-[orientation=horizontal]/stepper-nav:w-[calc(100%-2rem+0.225rem)] group-data-[orientation=horizontal]/stepper-nav:flex-none group-data-[state=completed]/step:bg-primary" />
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
