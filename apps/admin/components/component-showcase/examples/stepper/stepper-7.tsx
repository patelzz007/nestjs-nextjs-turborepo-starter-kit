"use client";

import { Badge } from "@workspace/ui/components/badge";
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
import { BookUserIcon, CheckIcon, CreditCardIcon, LoaderCircleIcon, LockIcon } from "lucide-react";
import type * as React from "react";
import { useCallback, useState } from "react";

interface StepEntry {
	readonly step: number;
	readonly title: string;
	readonly icon: React.ReactNode;
}

/** The step the example opens on. */
const INITIAL_STEP = 2;
const FIRST_STEP = 1;
/** How far one Previous / Next click moves. */
const STEP_INCREMENT = 1;

const STEPS: readonly StepEntry[] = [
	{ step: 1, title: "User Details", icon: <BookUserIcon className="size-4" /> },
	{ step: 2, title: "Payment Info", icon: <CreditCardIcon className="size-4" /> },
	{ step: 3, title: "Auth OTP", icon: <LockIcon className="size-4" /> },
];

const STEP_INDICATORS: StepIndicators = {
	completed: <CheckIcon className="size-3.5" />,
	loading: <LoaderCircleIcon className="size-3.5 animate-spin" />,
};

function previousStep(step: number): number {
	return step - STEP_INCREMENT;
}

function nextStep(step: number): number {
	return step + STEP_INCREMENT;
}

export function Stepper7Example(): React.JSX.Element {
	const [activeStep, setActiveStep] = useState<number>(INITIAL_STEP);

	const goToPreviousStep = useCallback((): void => {
		setActiveStep(previousStep);
	}, []);

	const goToNextStep = useCallback((): void => {
		setActiveStep(nextStep);
	}, []);

	return (
		<Stepper value={activeStep} onValueChange={setActiveStep} indicators={STEP_INDICATORS} className="w-full max-w-xl space-y-8">
			<StepperNav className="gap-3">
				{STEPS.map(({ step, title, icon }: StepEntry): React.JSX.Element => (
					<StepperItem key={step} step={step} className="relative flex-1 items-start">
						<StepperTrigger className="flex grow flex-col items-start justify-center gap-2.5">
							<StepperIndicator className="size-8 border-2 data-[state=completed]:bg-success data-[state=completed]:text-success-foreground data-[state=inactive]:border-border data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground">
								{icon}
							</StepperIndicator>
							<div className="flex flex-col items-start gap-1">
								<div className="text-[10px] font-semibold text-muted-foreground uppercase">Step {step}</div>
								<StepperTitle className="text-start text-base font-semibold group-data-[state=inactive]/step:text-muted-foreground">{title}</StepperTitle>
								<div>
									<Badge size="sm" variant="primary-light" className="hidden group-data-[state=active]/step:inline-flex">
										In Progress
									</Badge>
									<Badge variant="success-light" size="sm" className="hidden group-data-[state=completed]/step:inline-flex">
										Completed
									</Badge>
									<Badge variant="secondary" size="sm" className="hidden text-muted-foreground group-data-[state=inactive]/step:inline-flex">
										Pending
									</Badge>
								</div>
							</div>
						</StepperTrigger>

						{step < STEPS.length ? (
							<StepperSeparator className="absolute inset-x-0 start-9 top-4 m-0 group-data-[orientation=horizontal]/stepper-nav:w-[calc(100%-2rem)] group-data-[orientation=horizontal]/stepper-nav:flex-none group-data-[state=completed]/step:bg-success" />
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

			<div className="flex items-center justify-between gap-2.5">
				<Button variant="outline" onClick={goToPreviousStep} disabled={activeStep === FIRST_STEP}>
					Previous
				</Button>
				<Button variant="outline" onClick={goToNextStep} disabled={activeStep === STEPS.length}>
					Next
				</Button>
			</div>
		</Stepper>
	);
}
