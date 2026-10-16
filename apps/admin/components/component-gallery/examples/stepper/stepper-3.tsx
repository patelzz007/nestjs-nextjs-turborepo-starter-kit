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

export function Stepper3Example(): React.JSX.Element {
	const [activeStep, setActiveStep] = useState<number>(INITIAL_STEP);

	return (
		<Stepper className="w-full max-w-md" value={activeStep} onValueChange={setActiveStep} indicators={STEP_INDICATORS}>
			<StepperNav className="mb-5">
				{STEPS.map((step: number): React.JSX.Element => (
					<StepperItem key={step} step={step} loading={step === LOADING_STEP}>
						<StepperTrigger>
							<StepperIndicator className="size-5 border-2 data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=completed]:border-success data-[state=completed]:bg-success data-[state=completed]:text-success-foreground data-[state=inactive]:border-muted">
								<span className="hidden size-1.5 rounded-full bg-primary-foreground group-data-[state=active]/step:block"></span>
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
