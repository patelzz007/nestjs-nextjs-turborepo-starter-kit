"use client";

import type * as React from "react";
import { CheckIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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

const steps = [
	{
		title: "Registration",
		description: "Account created and start date confirmed.",
	},
	{
		title: "Paperwork",
		description: "Tax forms, direct deposit and ID checked.",
	},
	{
		title: "Store Tour",
		description: "Walk the floor and stockroom with your manager.",
	},
	{
		title: "Job Training",
		description: "Register, returns and safety modules, about 2 hours.",
	},
	{
		title: "First Shift",
		description: "Saturday from 9:00 AM, paired with a team buddy.",
	},
];

// The design draws the 10px check with a 1.4px line: 3.36 on a 24-unit grid.
// stroke-[3.36] repeats it as CSS, which beats the svg's own stroke-width
// attribute, so the weight holds where a wrapper does not forward the prop.
const completed = <CheckIcon strokeWidth={3.36} className="size-2.5 stroke-[3.36]" aria-hidden="true" />;

// pathLength counts the circle as 28 units, so the 3:1 dash pattern closes
// in seven even dashes instead of leaving a stub at the seam.
function DashedRing({ spin = false }: { readonly spin?: boolean }): React.JSX.Element {
	return (
		<svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={cn("size-4", spin && "motion-safe:animate-spin")}>
			<circle cx="8" cy="8" r="4.5" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3 1" pathLength={28} />
		</svg>
	);
}

const indicators: StepIndicators = {
	completed,
	inactive: <DashedRing />,
	loading: <DashedRing spin />,
};

export function Stepper29Example(): React.JSX.Element {
	const [current, setCurrent] = useState<number>(INITIAL_STEP);
	const prevRef = useRef<HTMLButtonElement>(null);
	const nextRef = useRef<HTMLButtonElement>(null);
	// One past the last step marks every step complete. No tab is selected
	// then, so the last one keeps the tablist's tab stop.
	const allDone = current > steps.length;

	// Past the collapsed width (many steps in a small box) the row scrolls, so
	// the current step comes back into view when it changes or the row resizes,
	// and a tab comes into view when focus lands on it (the browser leaves a
	// half-hidden one where it is). Only the row scrolls, never the page.
	const rowRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const row = rowRef.current;
		if (!row) return;
		const reveal = (tab: Element | null): void => {
			if (!tab) return;
			const box = row.getBoundingClientRect();
			const { left, right } = tab.getBoundingClientRect();
			if (left < box.left || right > box.right) {
				row.scrollLeft += (left + right - box.left - box.right) / 2;
			}
		};
		const onFocus = (event: FocusEvent): void => {
			reveal(event.target instanceof Element ? event.target.closest('[role="tab"]') : null);
		};
		const observer = new ResizeObserver((): void => {
			reveal(row.querySelector('[aria-selected="true"]'));
		});
		observer.observe(row);
		row.addEventListener("focusin", onFocus);
		return (): void => {
			observer.disconnect();
			row.removeEventListener("focusin", onFocus);
		};
	}, [current]);

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
		<Stepper value={current} onValueChange={setCurrent} indicators={indicators} className="flex max-w-200 flex-col gap-6" aria-label="New hire onboarding">
			{/* Under 42rem the labels around the current step drop to their
          indicator; past that the row scrolls instead of crushing them. p-2
          keeps the focus ring in view, and -mx-1 reaches only 4px past the
          stepper, so a tightly padded parent does not scroll sideways. */}
			<div ref={rowRef} className="@container relative -mx-1 -my-2 overflow-x-auto p-2">
				<StepperNav className="min-w-max gap-1">
					{steps.map((item, index) => {
						const step = index + 1;

						// The primitive shows loading on the active step only, so every
						// step carries the flag and the ring spins on the current one.
						return (
							<StepperItem key={item.title} step={step} loading className="gap-1.5">
								{/* -m-1 p-1 grows the target to 24px tall and gives the
                    focus ring room without moving the row. */}
								<StepperTrigger tabIndex={allDone && step === steps.length ? TAB_STOP : undefined} className="-m-1 gap-1.5 p-1">
									{/* Done and current steps take the primary token
                      (the design's blue accent), as does the connector. */}
									<StepperIndicator className="size-4 bg-ring/20 text-ring/50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=completed]:bg-primary data-[state=completed]:text-primary-foreground" />
									<StepperTitle className="whitespace-nowrap data-[state=inactive]:text-muted-foreground @max-2xl:not-data-[state=active]:sr-only">{item.title}</StepperTitle>
									{step < current ? <span className="sr-only">, completed</span> : null}
								</StepperTrigger>

								{/* Solid once the step is done, fading out of the current
                    step, gray ahead of it. */}
								{step < steps.length ? (
									<StepperSeparator className="m-0 min-w-6 bg-transparent bg-linear-to-r from-primary to-ring/20 data-[state=completed]:to-primary data-[state=inactive]:from-ring/20 rtl:bg-linear-to-l" />
								) : null}
							</StepperItem>
						);
					})}
				</StepperNav>
			</div>

			<StepperPanel className="text-center">
				{steps.map((item, index) => (
					<StepperContent key={item.title} value={index + 1}>
						<p className="text-xs text-muted-foreground">
							Step {index + 1} of {steps.length}
						</p>
						<p className="text-sm font-medium">{item.title}</p>
						<p className="text-sm text-muted-foreground">{item.description}</p>
					</StepperContent>
				))}
				<StepperContent value={steps.length + 1}>
					<p className="text-xs text-muted-foreground">All {steps.length} steps done</p>
					<p className="text-sm font-medium">Onboarding complete</p>
					<p className="text-sm text-muted-foreground">Welcome to the team.</p>
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
