"use client";

import type * as React from "react";
import { ChevronRightIcon } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
import { Stepper, StepperContent, StepperItem, StepperNav, StepperPanel, StepperTitle, StepperTrigger } from "@workspace/ui/components/stepper";
import { cn } from "@workspace/ui/lib/core/utils";

import { Button } from "@workspace/ui/components/button";

/** The step the example opens on. */
const INITIAL_STEP = 4;
/** How far one Previous / Next click moves. */
const STEP_INCREMENT = 1;
const FIRST_STEP = 1;
/** The roving tab stop the last trigger keeps once every step is done. */
const TAB_STOP = 0;

const steps = [
	{
		title: "Registration",
		summary: "Create your employee login and confirm your contact details.",
	},
	{
		title: "Paperwork",
		summary: "Sign your contract, tax forms and direct deposit details.",
	},
	{
		title: "Store Tour",
		summary: "Walk the floor, stockroom and break room with your manager.",
	},
	{
		title: "Job Training",
		summary: "Learn the register, returns and opening routine with a mentor.",
	},
	{
		title: "First Shift",
		summary: "Saturday from 9:00 AM to 3:00 PM, paired with your mentor.",
	},
];

export function Stepper28Example(): React.JSX.Element {
	const [current, setCurrent] = useState<number>(INITIAL_STEP);
	const labelId = useId();
	const prevRef = useRef<HTMLButtonElement>(null);
	const nextRef = useRef<HTMLButtonElement>(null);
	// One past the last step marks every step complete. No tab is selected
	// then, so the last one keeps the tablist's tab stop.
	const allDone = current > steps.length;

	const goTo = useCallback((step: number): void => {
		setCurrent(step);
		// The pressed button disables itself at either end, so focus moves to its partner.
		if (step === FIRST_STEP) nextRef.current?.focus();
		if (step > steps.length) prevRef.current?.focus();
	}, []);

	const goToPreviousStep = useCallback((): void => {
		goTo(current - STEP_INCREMENT);
	}, [current, goTo]);

	const goToNextStep = useCallback((): void => {
		goTo(current + STEP_INCREMENT);
	}, [current, goTo]);

	return (
		<Stepper value={current} onValueChange={setCurrent} className="@container max-w-200" aria-labelledby={labelId}>
			<div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
				<p id={labelId} className="text-sm font-medium">
					Onboarding
				</p>

				{/* Under 48rem the steps drop to a row of their own and wrap there.
            From 48rem up they fill the space between the label and the
            counter and center in it, which is where justify-between would
            put them. The one-row header needs about 660px. */}
				<StepperNav className="order-last flex-wrap gap-y-2.5 @3xl:order-none @3xl:flex-1 @3xl:justify-center">
					{steps.map((item, index) => {
						const step = index + 1;

						// The primitive grows every item but the last; these stay packed.
						return (
							<StepperItem key={item.title} step={step} className="not-last:flex-none">
								{/* Margin and padding cancel out, so the text stays put while
                    the hit area grows to 24px and the focus ring gets room. */}
								<StepperTrigger tabIndex={allDone && step === steps.length ? TAB_STOP : undefined} className="-mx-1.5 -my-1.25 px-1.5 py-1.25">
									<StepperTitle className="whitespace-nowrap text-muted-foreground data-[state=active]:text-foreground">{item.title}</StepperTitle>
									{step < current ? <span className="sr-only">, completed</span> : null}
								</StepperTrigger>

								{step < steps.length ? (
									<ChevronRightIcon className="mx-1.5 size-3.5 text-ring/50 group-data-[state=completed]/step:text-ring rtl:rotate-180" aria-hidden="true" />
								) : null}
							</StepperItem>
						);
					})}
				</StepperNav>

				{/* Reads as "Step 4 of 5" to assistive tech. */}
				<p className="flex gap-1.5 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
					<span>Step</span>
					<span>
						<span className="text-foreground">{Math.min(current, steps.length)}</span> <span aria-hidden="true">/</span>
						<span className="sr-only">of</span> {steps.length}
					</span>
				</p>
			</div>

			{/* The bar repeats the counter, so assistive tech skips it. */}
			<div aria-hidden="true" className="flex h-1 gap-1">
				{steps.map((item, index) => (
					<span key={item.title} className={cn("flex-1 rounded-full", index < current ? "bg-foreground" : "bg-ring/20")} />
				))}
			</div>

			<StepperPanel className="mt-6 text-center">
				{steps.map((item, index) => (
					<StepperContent key={item.title} value={index + 1}>
						<p className="text-sm font-medium">{item.title}</p>
						<p className="text-sm text-muted-foreground">{item.summary}</p>
					</StepperContent>
				))}
				<StepperContent value={steps.length + 1}>
					<p className="text-sm font-medium">Onboarding complete</p>
					<p className="text-sm text-muted-foreground">All {steps.length} steps are done, welcome to the team.</p>
				</StepperContent>
				<div className="mt-3 flex justify-center gap-2">
					<Button ref={prevRef} variant="outline" size="sm" disabled={current === FIRST_STEP} onClick={goToPreviousStep}>
						Previous
					</Button>
					<Button ref={nextRef} variant="outline" size="sm" disabled={allDone} onClick={goToNextStep}>
						Next
					</Button>
				</div>
			</StepperPanel>
		</Stepper>
	);
}
