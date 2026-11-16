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
	{ step: 3, title: "Review", description: "Confirm your details" },
];

const STEP_INDICATORS: StepIndicators = {
	completed: <CheckIcon className="size-3.5" />,
	loading: <LoaderCircleIcon className="size-3.5 animate-spin" />,
};

export function Stepper13Example(): React.JSX.Element {
	const [activeStep, setActiveStep] = useState<number>(INITIAL_STEP);

	return (
		<div className="flex items-center justify-center">
			<Stepper
				className="flex flex-col items-center justify-center gap-10"
				value={activeStep}
				onValueChange={setActiveStep}
				orientation="vertical"
				indicators={STEP_INDICATORS}>
				<StepperNav>
					{STEPS.map(({ step, title, description }: StepEntry): React.JSX.Element => (
						<StepperItem key={step} step={step} className="relative items-start not-last:flex-1">
							<StepperTrigger className="items-start gap-2.5 pb-12 last:pb-0">
								<StepperIndicator className="data-[state=completed]:bg-success data-[state=completed]:text-success-foreground">{step}</StepperIndicator>
								<div className="mt-0.5 text-left">
									<StepperTitle>{title}</StepperTitle>
									<StepperDescription>{description}</StepperDescription>
								</div>
							</StepperTrigger>
							{step < STEPS.length ? (
								<StepperSeparator className="absolute inset-y-0 top-7 left-3 -order-1 m-0 -translate-x-1/2 group-data-[orientation=vertical]/stepper-nav:h-[calc(100%-2rem)] group-data-[state=completed]/step:bg-success" />
							) : null}
						</StepperItem>
					))}
				</StepperNav>

				<StepperPanel className="w-56 text-center text-sm">
					{STEPS.map(({ step, title }: StepEntry): React.JSX.Element => (
						<StepperContent key={step} value={step}>
							{title} content
						</StepperContent>
					))}
				</StepperPanel>
			</Stepper>
		</div>
	);
}
