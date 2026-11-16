"use client";

import {
	Stepper,
	StepperContent,
	StepperIndicator,
	StepperItem,
	StepperNav,
	StepperPanel,
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
	{ step: 1, title: "User Details" },
	{ step: 2, title: "Payment Info" },
	{ step: 3, title: "Auth OTP" },
	{ step: 4, title: "Preview Form" },
];

const STEP_INDICATORS: StepIndicators = {
	completed: <CheckIcon className="size-3.5" />,
	loading: <LoaderCircleIcon className="size-3.5 animate-spin" />,
};

export function Stepper6Example(): React.JSX.Element {
	const [activeStep, setActiveStep] = useState<number>(INITIAL_STEP);

	return (
		<Stepper value={activeStep} onValueChange={setActiveStep} indicators={STEP_INDICATORS} className="w-full max-w-lg space-y-8">
			<StepperNav className="gap-3">
				{STEPS.map(({ step, title }: StepEntry): React.JSX.Element => (
					<StepperItem key={step} step={step} className="relative flex-1 items-start">
						<StepperTrigger className="flex grow flex-col items-start justify-center gap-3">
							<StepperIndicator>{step}</StepperIndicator>
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
