"use client";

import {
	Stepper,
	StepperContent,
	StepperIndicator,
	StepperItem,
	StepperNav,
	StepperPanel,
	StepperSeparator,
	StepperTrigger,
	type StepIndicators,
} from "@workspace/ui/components/stepper";
import { CheckIcon, LoaderCircleIcon } from "lucide-react";
import type * as React from "react";
import { useState } from "react";

/** The step the example opens on — it is also the one shown loading. */
const INITIAL_STEP = 2;
const LOADING_STEP = 2;
const STEPS: readonly number[] = [1, 2, 3];

const STEP_INDICATORS: StepIndicators = {
	completed: <CheckIcon className="size-3.5" />,
	loading: <LoaderCircleIcon className="size-3.5 animate-spin" />,
};

export function Stepper14Example(): React.JSX.Element {
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
					{STEPS.map((step: number): React.JSX.Element => (
						<StepperItem key={step} step={step} loading={step === LOADING_STEP}>
							<StepperTrigger>
								<StepperIndicator className="data-[state=completed]:bg-success data-[state=completed]:text-success-foreground">{step}</StepperIndicator>
							</StepperTrigger>
							{step < STEPS.length ? <StepperSeparator className="group-data-[state=completed]/step:bg-success" /> : null}
						</StepperItem>
					))}
				</StepperNav>

				<StepperPanel className="w-56 text-center text-sm">
					{STEPS.map((step: number): React.JSX.Element => (
						<StepperContent key={step} value={step}>
							Step {step} content
						</StepperContent>
					))}
				</StepperPanel>
			</Stepper>
		</div>
	);
}
