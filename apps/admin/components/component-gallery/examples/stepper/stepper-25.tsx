"use client";

import type * as React from "react";
import { CheckIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
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
import { cn } from "@workspace/ui/lib/core/utils";

import { Button } from "@workspace/ui/components/button";

/** The step the example opens on. */
const INITIAL_STEP = 3;
/** How far one Previous / Next click moves. */
const STEP_INCREMENT = 1;
const FIRST_STEP = 1;
/** The roving tab stop the last trigger keeps once every step is done. */
const TAB_STOP = 0;

const phases = [
	{
		title: "Choose Resolution",
		summary: "Compare a refund, a replacement and store credit for order #4821.",
	},
	{
		title: "Execute Resolution",
		summary: "Issue the $129.00 refund to the original payment method.",
	},
	{
		title: "Verify Outcome",
		summary: "Confirm the bank has settled the refund with the customer.",
	},
	{
		title: "Resolution Summary",
		summary: "Review every action taken, then close the case.",
	},
];

// pathLength counts the ring as 28 units, so the 3:1 dash pattern closes in
// seven even dashes instead of leaving a stub at the seam.
function Pending({ current = false }: { readonly current?: boolean }): React.JSX.Element {
	return (
		<span className={cn("flex size-4 rounded-full", current ? "bg-primary text-primary-foreground" : "bg-ring/20 text-ring")}>
			<svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={cn("size-4", current && "motion-safe:animate-spin")}>
				<circle cx="8" cy="8" r="4.5" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3 1" pathLength={28} />
			</svg>
		</span>
	);
}

// The 22px indicator is a disc of the page surface and the 16px dot inside
// it carries the state, so a 3px ring cuts the dot out of the track. The
// design draws the 10px check with a 1.4px line: 3.36 on a 24-unit grid.
const indicators: StepIndicators = {
	completed: (
		<span className="flex size-4 items-center justify-center rounded-full bg-ring/20 text-ring">
			<CheckIcon strokeWidth={3.36} className="size-2.5" aria-hidden="true" />
		</span>
	),
	inactive: <Pending />,
	loading: <Pending current />,
};

export function Stepper25Example(): React.JSX.Element {
	const [current, setCurrent] = useState<number>(INITIAL_STEP);
	const prevRef = useRef<HTMLButtonElement>(null);
	const nextRef = useRef<HTMLButtonElement>(null);
	// One past the last step marks every step complete. No tab is selected
	// then, so the last one keeps the tablist's tab stop.
	const allDone = current > phases.length;

	const goTo = useCallback((step: number): void => {
		setCurrent(step);
		// The pressed button disables itself at either end, so focus moves to its partner.
		if (step === FIRST_STEP) nextRef.current?.focus();
		if (step > phases.length) prevRef.current?.focus();
	}, []);

	const goToPreviousStep = useCallback((): void => {
		goTo(current - STEP_INCREMENT);
	}, [current, goTo]);

	const goToNextStep = useCallback((): void => {
		goTo(current + STEP_INCREMENT);
	}, [current, goTo]);

	return (
		<Stepper value={current} onValueChange={setCurrent} indicators={indicators} className="@container max-w-200" aria-label="Resolution phases">
			{/* Under 32rem the labels go screen-reader only and the row keeps its
          track, so any number of steps fits; the panel below names the
          current one. */}
			<StepperNav>
				{phases.map((phase, index) => {
					const step = index + 1;

					// The primitive shows loading on the active phase only, so every
					// phase carries the flag and the spinner follows the selection.
					return (
						<StepperItem key={phase.title} step={step} loading className="relative min-w-0 flex-1 items-stretch">
							{/* Items stretch to the tallest label and mt-auto pins each
                  track slice to the bottom, so the track stays one line when
                  a title wraps. mb-2.25 holds the indicator's 9px overhang. */}
							<StepperTrigger tabIndex={allDone && step === phases.length ? TAB_STOP : undefined} className="w-full flex-col gap-4">
								<span className="flex flex-col items-center gap-1 px-1.75 text-center @max-lg:sr-only">
									<span className="text-xs font-medium whitespace-nowrap text-muted-foreground uppercase">Phase {step}</span>
									<StepperTitle className="data-[state=active]:font-semibold">{phase.title}</StepperTitle>
									{step < current ? <span className="sr-only">, completed</span> : null}
								</span>

								{/* Each phase draws one slice of the track, rounded only at
                    the outer ends; the active fill spans its whole slice, so
                    the first and last reach the track's ends. Its blue
                    accent is the primary token here. */}
								<span className="mt-auto mb-2.25 flex h-1 w-full bg-ring/20 group-first/step:rounded-s-full group-last/step:rounded-e-full">
									<span className="flex flex-1 items-center justify-center rounded-full group-data-[state=active]/step:bg-primary">
										<StepperIndicator className="size-5.5 bg-background data-[state=active]:bg-background data-[state=completed]:bg-background" />
									</span>
								</span>
							</StepperTrigger>

							{/* The design's 14px slash: a 1.2px line turned 45deg, centered
                  on the boundary and on the label rows by leaving out the
                  29px under them. px-1.75 keeps the labels out of its slot,
                  and pointer-events-none passes clicks to the trigger under it. */}
							{step < phases.length ? (
								<StepperSeparator className="pointer-events-none absolute end-0 top-0 bottom-7.25 m-0 my-auto w-[1.2px] translate-x-1/2 rotate-45 bg-ring/20 group-data-[orientation=horizontal]/stepper-nav:h-4.5 @max-lg:hidden rtl:-translate-x-1/2" />
							) : null}
						</StepperItem>
					);
				})}
			</StepperNav>

			<StepperPanel className="mt-6 text-center">
				{phases.map((phase, index) => (
					<StepperContent key={phase.title} value={index + 1}>
						<p className="text-sm font-medium">{phase.title}</p>
						<p className="text-sm text-muted-foreground">{phase.summary}</p>
					</StepperContent>
				))}
				<StepperContent value={phases.length + 1}>
					<p className="text-sm font-medium">Case closed</p>
					<p className="text-sm text-muted-foreground">The refund is settled and every action reviewed.</p>
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
