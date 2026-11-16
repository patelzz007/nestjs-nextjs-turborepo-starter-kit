"use client";

import type * as React from "react";
import { CheckIcon, CircleDashedIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Frame } from "@workspace/ui/components/frame";
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
import { cn } from "@workspace/ui/lib/core/utils";

import { Button } from "@workspace/ui/components/button";

/** The step the example opens on. */
const INITIAL_STEP = 6;
/** How far one Previous / Next click moves. */
const STEP_INCREMENT = 1;
const FIRST_STEP = 1;
/** The roving tab stop the last trigger keeps once every step is done. */
const TAB_STOP = 0;

const steps = [
	{ title: "Intake", description: "Log the brief, scope and deadline." },
	{ title: "Structure", description: "Outline the sections and name owners." },
	{ title: "Kick-off", description: "Brief writers on tone and timeline." },
	{ title: "Draft", description: "Write a first pass of every section." },
	{ title: "Consolidate", description: "Merge sections into one voice." },
	{ title: "Internal check", description: "Legal and finance review terms." },
	{ title: "Negotiate", description: "Settle open terms with procurement." },
	{ title: "Package", description: "Export, sign and send the proposal." },
];

// The step in progress adds a center dot and spins the dashed ring around it.
function Ring({ active = false }: { readonly active?: boolean }): React.JSX.Element {
	return (
		<span className="relative flex items-center justify-center">
			<CircleDashedIcon className={cn("size-3.5", active && "motion-safe:animate-spin")} aria-hidden="true" />
			{active ? <span className="absolute size-1/6 rounded-full bg-current" /> : null}
		</span>
	);
}

const indicators: StepIndicators = {
	completed: <CheckIcon className="size-3.5" aria-hidden="true" />,
	inactive: <Ring />,
	loading: <Ring active />,
};

// A chevron cut from its box: --notch bites into the start edge and --arrow
// points out of the end edge, and --stretch scales both (as --n and --a) for a
// taller copy whose edges stay parallel. Every corner is rounded, so the clip
// traces each with three points, both ends of the curve and its middle; an end
// with no depth collapses them onto a straight edge. The shape mirrors whole in
// RTL, which is why its outer corners round the physical left and right.
function Chevron({ className }: { readonly className?: string | undefined }): React.JSX.Element {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"absolute -z-10 [--a:calc(var(--arrow)*var(--stretch,1))] [--n:calc(var(--notch)*var(--stretch,1))] [clip-path:polygon(calc(var(--n)*0.26)_0,calc(100%_-_var(--a)*1.29)_0,calc(100%_-_var(--a)*1.04)_calc(var(--a)*0.07),calc(100%_-_var(--a)*0.86)_calc(var(--a)*0.25),calc(100%_-_var(--a)*0.14)_calc(50%_-_var(--a)*0.25),calc(100%_-_var(--a)*0.08)_50%,calc(100%_-_var(--a)*0.14)_calc(50%_+_var(--a)*0.25),calc(100%_-_var(--a)*0.86)_calc(100%_-_var(--a)*0.25),calc(100%_-_var(--a)*1.04)_calc(100%_-_var(--a)*0.07),calc(100%_-_var(--a)*1.29)_100%,calc(var(--n)*0.26)_100%,calc(var(--n)*0.13)_calc(100%_-_var(--n)*0.07),calc(var(--n)*0.13)_calc(100%_-_var(--n)*0.22),calc(var(--n)*0.86)_calc(50%_+_var(--n)*0.25),calc(var(--n)*0.92)_50%,calc(var(--n)*0.86)_calc(50%_-_var(--n)*0.25),calc(var(--n)*0.13)_calc(var(--n)*0.22),calc(var(--n)*0.13)_calc(var(--n)*0.07))] rtl:-scale-x-100",
				className,
			)}
		/>
	);
}

export function Stepper33Example(): React.JSX.Element {
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
		<Stepper value={current} onValueChange={setCurrent} indicators={indicators} className="@container flex flex-col items-center gap-6" aria-label="Proposal workflow">
			{/* The design rounds the frame at radius-sm and the chevron ends 2px
          inside it; min() keeps lyra and sera square. Under 56rem the steps
          around the current one drop to their icon, under 24rem the current
          one too (the panel names it); past that the frame
          scrolls, and its 4px inset keeps the 2px focus ring inside the clip.
          min-w-max keeps the end padding in range. */}
			<Frame
				ref={rowRef}
				variant="inverse"
				className="relative max-w-full overflow-x-auto rounded-[min(var(--frame-radius),var(--radius-sm))] border-input/50 [--frame-panel-radius:min(var(--frame-radius),var(--radius-sm)_-_2px)] [--frame-px:--spacing(1)] [--frame-py:--spacing(1)]">
				<StepperNav className="min-w-max gap-1">
					{steps.map((item, index) => {
						const step = index + 1;

						// The primitive shows loading on the active step only, so every
						// step carries the flag and the spinner follows the selection.
						// Steps hug their labels rather than share out the row.
						return (
							<StepperItem key={item.title} step={step} loading className="not-last:flex-none">
								{/* The 8px notch reaches back over the 4px gap, so the
                    chevrons nest with an even channel between them. */}
								<StepperTrigger
									tabIndex={allDone && step === steps.length ? TAB_STOP : undefined}
									className="relative isolate h-7 gap-1.5 ps-1.5 pe-4 [--arrow:--spacing(2)] [--notch:--spacing(2)] group-first/step:ps-2 group-first/step:[--notch:0px] group-last/step:pe-2.5 group-last/step:[--arrow:0px] focus-visible:ring-0 data-[state=active]:text-primary-foreground data-[state=completed]:text-success-foreground dark:data-[state=completed]:text-success">
									{/* The focus ring is the same chevron 2px larger all round,
                      so 32/28 of h-7 and --stretch is 8/7. The fill in front
                      of it is opaque, so only its outer 2px shows. */}
									<Chevron className="-inset-y-0.5 -start-[calc(var(--notch)*var(--stretch)+--spacing(0.5))] -end-0.5 hidden bg-ring/50 [--stretch:8/7] group-first/step:rounded-l-[calc(var(--frame-panel-radius)+--spacing(0.5))] group-last/step:rounded-r-[calc(var(--frame-panel-radius)+--spacing(0.5))] in-focus-visible:block" />
									{/* Each state tints ::after over an opaque background, the
                      layers the design uses: input at 40%, success at 20%,
                      and the primary token for the step in progress. */}
									<Chevron className="inset-y-0 -start-(--notch) end-0 overflow-hidden bg-background group-first/step:rounded-l-(--frame-panel-radius) group-last/step:rounded-r-(--frame-panel-radius) after:absolute after:inset-0 after:bg-input/40 group-data-[state=active]/step:after:bg-primary group-data-[state=completed]/step:after:bg-success/20" />

									<StepperIndicator className="size-3.5 bg-transparent text-current data-[state=active]:bg-transparent data-[state=active]:text-current data-[state=completed]:bg-transparent data-[state=completed]:text-current" />
									<StepperTitle className="whitespace-nowrap @max-4xl:not-data-[state=active]:sr-only @max-sm:sr-only">{item.title}</StepperTitle>
									{step < current ? <span className="sr-only">, completed</span> : null}
								</StepperTrigger>
							</StepperItem>
						);
					})}
				</StepperNav>
			</Frame>

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
					<p className="text-sm font-medium">Proposal sent</p>
					<p className="text-sm text-muted-foreground">The packaged proposal is out with the client.</p>
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
