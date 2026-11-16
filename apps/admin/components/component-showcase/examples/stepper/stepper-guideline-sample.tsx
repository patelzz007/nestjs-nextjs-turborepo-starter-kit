"use client";

// The stepper the Do / Don't pairs show: steps by name, with Previous and Next, and a check on the finished ones
// when `marksDone` is set.

import { Button } from "@workspace/ui/components/button";
import { Stepper, StepperIndicator, StepperItem, StepperNav, StepperSeparator, StepperTitle, StepperTrigger, type StepIndicators } from "@workspace/ui/components/stepper";
import { CheckIcon } from "lucide-react";
import * as React from "react";

const FIRST_STEP = 1;
const STEP_INCREMENT = 1;

/** A finished step shows a check instead of its number. */
const DONE_INDICATORS: StepIndicators = { completed: <CheckIcon aria-hidden="true" className="size-3.5" /> };
const NO_INDICATORS: StepIndicators = {};

export interface GuidelineStepperProps {
	/** Each step's name, in order. */
	readonly titles: readonly string[];
	/** The step it opens on (1-based). */
	readonly initialStep: number;
	/** Names each step under its number. */
	readonly showTitles: boolean;
	/** Marks finished steps with a check. */
	readonly marksDone: boolean;
}

export function GuidelineStepper({ titles, initialStep, showTitles, marksDone }: GuidelineStepperProps): React.JSX.Element {
	const [step, setStep] = React.useState(initialStep);
	const previous = React.useCallback((): void => {
		setStep((current: number): number => Math.max(FIRST_STEP, current - STEP_INCREMENT));
	}, []);
	const next = React.useCallback((): void => {
		setStep((current: number): number => Math.min(titles.length, current + STEP_INCREMENT));
	}, [titles.length]);
	return (
		<div className="flex w-full max-w-md flex-col gap-4">
			<Stepper value={step} onValueChange={setStep} indicators={marksDone ? DONE_INDICATORS : NO_INDICATORS}>
				<StepperNav>
					{titles.map((title: string, index: number): React.JSX.Element => (
						<StepperItem key={title} step={index + FIRST_STEP} className="not-last:flex-1">
							<StepperTrigger className="flex-col gap-1">
								<StepperIndicator>{index + FIRST_STEP}</StepperIndicator>
								{showTitles ? <StepperTitle className="text-xs">{title}</StepperTitle> : null}
							</StepperTrigger>
							{index + FIRST_STEP < titles.length ? <StepperSeparator className="group-data-[state=completed]/step:bg-primary" /> : null}
						</StepperItem>
					))}
				</StepperNav>
			</Stepper>
			<div className="flex justify-between">
				<Button variant="outline" size="sm" onClick={previous} disabled={step === FIRST_STEP}>
					Previous
				</Button>
				<Button size="sm" onClick={next} disabled={step === titles.length}>
					Next
				</Button>
			</div>
		</div>
	);
}
