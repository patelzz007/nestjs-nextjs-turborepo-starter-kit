"use client";

import type * as React from "react";
import { useCallback, useRef, useState } from "react";
import {
	Stepper,
	StepperContent,
	StepperDescription,
	StepperIndicator,
	StepperItem,
	StepperNav,
	StepperPanel,
	StepperTitle,
	StepperTrigger,
	type StepIndicators,
} from "@workspace/ui/components/stepper";

import { Button } from "@workspace/ui/components/button";
import { Separator } from "@workspace/ui/components/separator";

/** The step the example opens on. */
const INITIAL_STEP = 2;
/** How far one Previous / Next click moves. */
const STEP_INCREMENT = 1;
const FIRST_STEP = 1;
/** The roving tab stop the last trigger keeps once every step is done. */
const TAB_STOP = 0;

const steps = [
	{
		title: "Resolution Planning",
		detail: "Hotfix chosen over a rollback, with an owner per service.",
	},
	{
		title: "Scope Alignment",
		detail: "Checkout and payments are in scope, search waits a sprint.",
	},
	{
		title: "Implementation",
		detail: "Rolling the patch out to 6 pods behind a feature flag.",
	},
	{
		title: "Outcome Verification",
		detail: "Watching error rate and p95 latency for 30 minutes.",
	},
	{
		title: "Final Summary",
		detail: "Root cause, timeline and follow-ups for the postmortem.",
	},
];

// The step in progress splits its 40px bar into four 8px dashes.
const active = (
	<span className="flex h-10 flex-col justify-between">
		{[1, 2, 3, 4].map((dash) => (
			<span key={dash} className="h-2 w-0.5 rounded-full bg-primary" />
		))}
	</span>
);

const STEP_INDICATORS: StepIndicators = { active };

export function Stepper42Example(): React.JSX.Element {
	const [current, setCurrent] = useState<number>(INITIAL_STEP);
	const prevRef = useRef<HTMLButtonElement>(null);
	const nextRef = useRef<HTMLButtonElement>(null);
	// One past the last step marks every step complete. No tab is selected
	// then, so the last one keeps the tablist's tab stop.
	const allDone = current > steps.length;

	const goTo = useCallback((step: number): void => {
		setCurrent(step);
		// The pressed button disables itself at either end, so focus moves to
		// its partner.
		if (step === FIRST_STEP) nextRef.current?.focus();
		if (step > steps.length) prevRef.current?.focus();
	}, []);

	const goToPreviousStep = useCallback((): void => {
		goTo(current - STEP_INCREMENT);
	}, [current, goTo]);

	const goToNextStep = useCallback((): void => {
		goTo(current + STEP_INCREMENT);
	}, [current, goTo]);

	// Side by side from 28rem, which leaves 13rem beside the 13rem steps for
	// the text and the Previous and Next row. Below that both stack in the
	// same 13rem column.
	return (
		<Stepper
			value={current}
			onValueChange={setCurrent}
			orientation="vertical"
			indicators={STEP_INDICATORS}
			className="@container mx-auto max-w-lg"
			aria-label="Incident resolution">
			<div className="mx-auto flex max-w-52 flex-col gap-6 @md:max-w-none @md:flex-row @md:items-start">
				<StepperNav className="w-full gap-3 @md:w-52 @md:shrink-0">
					{steps.map((item, index) => {
						const step = index + 1;

						return (
							<StepperItem key={item.title} step={step} className="items-stretch">
								{/* The whole row is the tab, while the focus ring moves onto
                    the label: a pill around the row would cut through the
                    bar. */}
								<StepperTrigger tabIndex={allDone && step === steps.length ? TAB_STOP : undefined} className="gap-1.5 focus-visible:ring-0">
									<StepperIndicator className="h-10 w-0.5 bg-input data-[state=active]:bg-transparent data-[state=completed]:bg-success" />

									{/* 6px gap plus 10px padding make the drawn 16px, and the
                      padding keeps the ring's rounded ends clear of the
                      text. */}
									<div className="flex min-w-0 flex-col justify-center self-stretch rounded-full px-2.5 text-start ring-ring/50 in-focus-visible:ring-3">
										{/* truncate clips at the line box, so the title gets
                        text-sm's own 20px line back from leading-none, which
                        clips descenders. With the 16px caption: 36px of 40. */}
										<StepperTitle className="truncate leading-5 data-[state=inactive]:text-muted-foreground">{item.title}</StepperTitle>
										<StepperDescription className="text-xs whitespace-nowrap">Step {step}</StepperDescription>
										{/* Only the bar's color says a step is done, so screen
                        readers get it in words. */}
										{step < current ? <span className="sr-only">, completed</span> : null}
									</div>
								</StepperTrigger>
							</StepperItem>
						);
					})}
				</StepperNav>

				{/* Decorative, so hidden from assistive tech: a line across while the
            columns stack, a line between them once they sit side by side. */}
				<Separator aria-hidden="true" className="@md:hidden" />
				<Separator aria-hidden="true" orientation="vertical" className="hidden @md:block" />
				<div className="flex min-w-0 flex-1 flex-col gap-3 text-start">
					<StepperPanel>
						{steps.map((item, index) => (
							<StepperContent key={item.title} value={index + 1}>
								<p className="text-xs text-muted-foreground">
									Step {index + 1} of {steps.length}
								</p>
								<p className="text-sm font-medium">{item.title}</p>
								<p className="text-sm text-pretty text-muted-foreground">{item.detail}</p>
							</StepperContent>
						))}
						<StepperContent value={steps.length + 1}>
							<p className="text-xs text-muted-foreground">All {steps.length} steps done</p>
							<p className="text-sm font-medium">Incident resolved</p>
							<p className="text-sm text-pretty text-muted-foreground">The final summary is shared and the incident closed.</p>
						</StepperContent>
					</StepperPanel>
					<div className="flex justify-start gap-2">
						<Button ref={prevRef} variant="outline" size="sm" disabled={current === FIRST_STEP} onClick={goToPreviousStep}>
							Previous
						</Button>
						<Button ref={nextRef} variant="outline" size="sm" disabled={allDone} onClick={goToNextStep}>
							Next
						</Button>
					</div>
				</div>
			</div>
		</Stepper>
	);
}
