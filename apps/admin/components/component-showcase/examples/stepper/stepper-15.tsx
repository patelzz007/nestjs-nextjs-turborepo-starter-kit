"use client";

import { Button } from "@workspace/ui/components/button";
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
import { useCallback, useRef, useState } from "react";

interface StepEntry {
	readonly step: number;
	readonly title: string;
}

/** The step the example opens on. */
const INITIAL_STEP = 2;
const FIRST_STEP = 1;
/** How far one Previous / Next click moves. */
const STEP_INCREMENT = 1;
/** The roving tab stop a trigger takes when it is the only focusable tab. */
const TAB_STOP = 0;

const STEPS: readonly StepEntry[] = [
	{ step: 1, title: "Account" },
	{ step: 2, title: "Profile" },
	{ step: 3, title: "Review" },
];
/** One past the last step: every step is complete. */
const ALL_DONE_STEP = STEPS.length + STEP_INCREMENT;

const STEP_INDICATORS: StepIndicators = {
	completed: <CheckIcon className="size-3.5" />,
	loading: <LoaderCircleIcon className="size-3.5 animate-spin" />,
};

export function Stepper15Example(): React.JSX.Element {
	const [activeStep, setActiveStep] = useState<number>(INITIAL_STEP);
	const previousRef = useRef<HTMLButtonElement>(null);
	const nextRef = useRef<HTMLButtonElement>(null);
	// One past the last step marks every step complete. No tab is selected
	// then, so the last one keeps the tablist's tab stop.
	const allDone = activeStep > STEPS.length;

	const goTo = useCallback((step: number): void => {
		setActiveStep(step);
		// The pressed button disables itself at either end, so focus moves to its partner.
		if (step === FIRST_STEP) nextRef.current?.focus();
		if (step > STEPS.length) previousRef.current?.focus();
	}, []);

	const goToPreviousStep = useCallback((): void => {
		goTo(activeStep - STEP_INCREMENT);
	}, [activeStep, goTo]);

	const goToNextStep = useCallback((): void => {
		goTo(activeStep + STEP_INCREMENT);
	}, [activeStep, goTo]);

	return (
		<div className="flex items-center justify-center">
			<Stepper
				className="flex flex-col items-center justify-center gap-10"
				value={activeStep}
				onValueChange={setActiveStep}
				orientation="vertical"
				indicators={STEP_INDICATORS}>
				<StepperNav>
					{STEPS.map(({ step, title }: StepEntry): React.JSX.Element => (
						<StepperItem key={step} step={step} className="relative items-start not-last:flex-1">
							<StepperTrigger tabIndex={allDone && step === STEPS.length ? TAB_STOP : undefined} className="items-start gap-2.5 pb-12 last:pb-0">
								<StepperIndicator className="data-[state=completed]:bg-success data-[state=completed]:text-success-foreground">{step}</StepperIndicator>
								<div className="mt-0.5 text-left">
									<StepperTitle>{title}</StepperTitle>
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
					<StepperContent value={ALL_DONE_STEP}>All steps complete</StepperContent>
					<div className="mt-3 flex justify-center gap-2">
						<Button ref={previousRef} variant="outline" size="sm" disabled={activeStep === FIRST_STEP} onClick={goToPreviousStep}>
							Previous
						</Button>
						<Button ref={nextRef} variant="outline" size="sm" disabled={allDone} onClick={goToNextStep}>
							Next
						</Button>
					</div>
				</StepperPanel>
			</Stepper>
		</div>
	);
}
