"use client";

import type * as React from "react";
import { CheckIcon, CheckSquareIcon, ClockCheckIcon, FileTextIcon, LightbulbIcon, TargetIcon, WorkflowIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Frame, FramePanel } from "@workspace/ui/components/frame";
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

import { Button } from "@workspace/ui/components/button";
import { Separator } from "@workspace/ui/components/separator";

/** The step the example opens on. */
const INITIAL_STEP = 3;
/** How far one Previous / Next click moves. */
const STEP_INCREMENT = 1;
const FIRST_STEP = 1;
/** The roving tab stop the last trigger keeps once every step is done. */
const TAB_STOP = 0;

const steps = [
	{
		title: "Resolution",
		detail: "Pick the fix: roll api-gateway back to v2.14.1.",
		icon: <LightbulbIcon className="size-3.5" aria-hidden="true" />,
	},
	{
		title: "Scoping",
		detail: "Limit the change to 6 pods in eu-west-1.",
		icon: <TargetIcon className="size-3.5" aria-hidden="true" />,
	},
	{
		title: "Execution",
		detail: "Replace the pods one at a time.",
		icon: <WorkflowIcon className="size-3.5" aria-hidden="true" />,
	},
	{
		title: "Verification",
		detail: "Watch error rate and p95 latency for 10 min.",
		icon: <CheckSquareIcon className="size-3.5" aria-hidden="true" />,
	},
	{
		title: "Approval",
		detail: "The incident lead signs off on the fix.",
		icon: <ClockCheckIcon className="size-3.5" aria-hidden="true" />,
	},
	{
		title: "Summary",
		detail: "Record the root cause and follow-ups.",
		icon: <FileTextIcon className="size-3.5" aria-hidden="true" />,
	},
];

const completed = <CheckIcon className="size-2.5" aria-hidden="true" />;

const STEP_INDICATORS: StepIndicators = { completed };

export function Stepper40Example(): React.JSX.Element {
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

	return (
		<div className="@container mx-auto w-full max-w-lg">
			<Stepper
				value={current}
				onValueChange={setCurrent}
				orientation="vertical"
				indicators={STEP_INDICATORS}
				className="flex flex-col gap-6 @md:flex-row @md:items-start"
				aria-label="Incident workflow">
				{/* A bare frame that paints nothing: it only hands each row its
            per-style radius, padding and border color. 6px of block padding
            around the 20px text-sm line keeps the drawn 34px row. */}
				<Frame variant="ghost" spacing="xs" className="w-full max-w-45 shrink-0 bg-transparent p-0 [--frame-panel-py-base:--spacing(1.5)]">
					<StepperNav className="gap-1.5">
						{steps.map((item, index) => {
							const step = index + 1;

							// Every row is a panel whose border stays transparent until it
							// is active, so the selection moves without shifting a row, and
							// gap-1.5 absorbs that border to keep the design's row pitch.
							// 3px under the ghost panel radius lands on the drawn 8px. The
							// active row's blue accent is the primary token here.
							return (
								<StepperItem key={item.title} step={step}>
									<StepperTrigger
										tabIndex={allDone && step === steps.length ? TAB_STOP : undefined}
										render={<FramePanel />}
										className="w-full gap-2 rounded-[calc(var(--frame-panel-radius)-3px)] border-transparent bg-transparent text-muted-foreground shadow-none hover:bg-muted/50 data-[state=active]:border-(--frame-panel-border-color) data-[state=active]:bg-muted/50 data-[state=active]:text-primary data-[state=completed]:text-foreground">
										{item.icon}
										<StepperTitle className="min-w-0 flex-1 truncate leading-5">{item.title}</StepperTitle>
										{step < current ? <span className="sr-only">, completed</span> : null}
										<StepperIndicator className="size-3.5 not-data-[state=completed]:hidden data-[state=completed]:bg-success data-[state=completed]:text-success-foreground" />
										{step === current ? (
											<span aria-hidden="true" className="pointer-events-none absolute start-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-e-full bg-primary" />
										) : null}
									</StepperTrigger>
								</StepperItem>
							);
						})}
					</StepperNav>
				</Frame>

				{/* Stacked, 9px (a row's 1px border plus its 8px inline padding)
            lines the copy up with the step icons above it. */}
				{/* Decorative, so hidden from assistive tech: a line across while the
            columns stack, a line between them once they sit side by side. */}
				<Separator aria-hidden="true" className="@md:hidden" />
				<Separator aria-hidden="true" orientation="vertical" className="hidden @md:block" />
				<div className="flex min-w-0 flex-1 flex-col gap-3 px-2.25 text-start @md:px-0">
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
							<p className="text-sm font-medium">Incident closed</p>
							<p className="text-sm text-pretty text-muted-foreground">Approved and summarized, with every step done.</p>
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
			</Stepper>
		</div>
	);
}
