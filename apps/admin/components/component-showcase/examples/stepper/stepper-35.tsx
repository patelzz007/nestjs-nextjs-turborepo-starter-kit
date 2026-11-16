"use client";

import type * as React from "react";
import { CheckIcon, CircleDashedIcon, LoaderCircleIcon } from "lucide-react";
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

import { Button } from "@workspace/ui/components/button";

/** The step the example opens on. */
const INITIAL_STEP = 4;
/** How far one Previous / Next click moves. */
const STEP_INCREMENT = 1;
const FIRST_STEP = 1;
/** The roving tab stop the last trigger keeps once every step is done. */
const TAB_STOP = 0;

const steps = [
	{ title: "Intake", description: "Collect the brief and key dates" },
	{ title: "Structure", description: "Outline clauses and owners" },
	{ title: "Draft", description: "Write the first full version" },
	{ title: "Internal check", description: "Legal and finance review" },
	{ title: "Negotiate", description: "Trade redlines with the counterparty" },
	{ title: "Package", description: "Bundle and send the signed files" },
];

// The check and the spinner are drawn at 1.4px, so their strokes are raised
// from lucide's default (1px at 12px, 1.17px at 14px). The dashed circle
// keeps the default.
const indicators: StepIndicators = {
	completed: <CheckIcon strokeWidth={2.8} className="size-3" aria-hidden="true" />,
	loading: <LoaderCircleIcon strokeWidth={2.4} className="size-3.5 motion-safe:animate-spin" aria-hidden="true" />,
	inactive: <CircleDashedIcon className="size-3.5" aria-hidden="true" />,
};

export function Stepper35Example(): React.JSX.Element {
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
		<Stepper value={current} onValueChange={setCurrent} indicators={indicators} className="flex w-full flex-col items-center" aria-label="Contract plan">
			{/* The design's 4px inset, 6px corner and 4px inner corners, each
          capped at the style's frame radius so square styles stay square. */}
			<Frame
				variant="inverse"
				className="w-full rounded-[min(var(--frame-radius),var(--radius-sm))] border-input/50 [--frame-panel-radius:min(var(--frame-radius),var(--radius-sm)_-_2px)] [--frame-px:--spacing(1)] [--frame-py:--spacing(1)]">
				{/* The steps share the full width. Under 48rem the steps around the
            current one drop to their indicator, under 24rem the current one
            too (the panel names it); past that the row scrolls
            here, clipped to the frame's inner corners, and min-w-max keeps
            the nav from shrinking. relative keeps the sr-only text in the
            scroller: placed against the Frame, it escapes and widens the
            page. */}
				<div ref={rowRef} className="@container relative flex gap-0.5 overflow-x-auto rounded-(--frame-panel-radius)">
					<span className="flex shrink-0 items-center rounded-(--frame-panel-radius) bg-input px-1.5 text-xs font-medium whitespace-nowrap text-foreground/70 uppercase">
						Plan {current - 1}/{steps.length}
					</span>

					<StepperNav className="min-w-max flex-1">
						{steps.map((item, index) => {
							const step = index + 1;

							// The primitive shows loading on the active step only, so every
							// step carries the flag and the spinner follows the selection.
							// Pulled back 6px, each 8px notch wraps the previous arrow with
							// 2px between them. Folded steps hug their icon and the current
							// one takes the rest; once every label is folded they share the
							// width again.
							return (
								<StepperItem
									key={item.title}
									step={step}
									loading
									className="flex-1 not-first:-ms-1.5 @max-3xl:not-data-[state=active]:flex-none @max-sm:not-data-[state=active]:flex-1">
									{/* The design's chevron: an 8px --notch at the start, an
                      8px --arrow at the end, each corner rounded at 4px (1.2px
                      at the acute notch corners) through three points, y tuned
                      to the h-6 row and x to the two variables, so the outer
                      steps zero one and round that side instead. The clip
                      trims the hit area too, so a click lands where it hits. */}
									<StepperTrigger
										tabIndex={allDone && step === steps.length ? TAB_STOP : undefined}
										className="h-6 flex-1 rounded-none bg-input/40 px-3 text-muted-foreground [--arrow:--spacing(2)] [--notch:--spacing(2)] [clip-path:polygon(calc(var(--notch)*0.28)_0,calc(100%_-_var(--arrow)*1.268)_0,calc(100%_-_var(--arrow)*1.032)_1.97%,calc(100%_-_var(--arrow)*0.852)_7.42%,calc(100%_-_var(--arrow)*0.185)_40.75%,calc(100%_-_var(--arrow)*0.101)_50%,calc(100%_-_var(--arrow)*0.185)_59.25%,calc(100%_-_var(--arrow)*0.852)_92.58%,calc(100%_-_var(--arrow)*1.032)_98.03%,calc(100%_-_var(--arrow)*1.268)_100%,calc(var(--notch)*0.28)_100%,calc(var(--notch)*0.148)_97.36%,calc(var(--notch)*0.155)_92.23%,calc(var(--notch)*0.815)_59.25%,calc(var(--notch)*0.899)_50%,calc(var(--notch)*0.815)_40.75%,calc(var(--notch)*0.155)_7.77%,calc(var(--notch)*0.148)_2.64%)] group-first/step:rounded-s-(--frame-panel-radius) group-first/step:ps-1 group-first/step:[--notch:0px] group-last/step:rounded-e-(--frame-panel-radius) group-last/step:ps-2.5 group-last/step:pe-1.5 group-last/step:[--arrow:0px] data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=completed]:bg-input/60 data-[state=completed]:text-foreground/70 rtl:[clip-path:polygon(calc(100%_-_var(--notch)*0.28)_0,calc(var(--arrow)*1.268)_0,calc(var(--arrow)*1.032)_1.97%,calc(var(--arrow)*0.852)_7.42%,calc(var(--arrow)*0.185)_40.75%,calc(var(--arrow)*0.101)_50%,calc(var(--arrow)*0.185)_59.25%,calc(var(--arrow)*0.852)_92.58%,calc(var(--arrow)*1.032)_98.03%,calc(var(--arrow)*1.268)_100%,calc(100%_-_var(--notch)*0.28)_100%,calc(100%_-_var(--notch)*0.148)_97.36%,calc(100%_-_var(--notch)*0.155)_92.23%,calc(100%_-_var(--notch)*0.815)_59.25%,calc(100%_-_var(--notch)*0.899)_50%,calc(100%_-_var(--notch)*0.815)_40.75%,calc(100%_-_var(--notch)*0.155)_7.77%,calc(100%_-_var(--notch)*0.148)_2.64%)]">
										{/* clip-path cuts the trigger's own focus ring, so this
                        pill draws it: px-1 completes the step's padding, py-0.5
                        clears the label's descenders and keeps the ring inside
                        the 24px chevron. The design sets the last step 6px
                        past its notch with a 6px icon gap. */}
										<span className="flex items-center gap-1 rounded-full px-1 py-0.5 ring-ring group-last/step:gap-1.5 in-focus-visible:ring-2">
											<StepperIndicator className="size-3.5 bg-transparent text-current data-[state=active]:bg-transparent data-[state=active]:text-current data-[state=completed]:size-3 data-[state=completed]:bg-transparent data-[state=completed]:text-current" />
											<StepperTitle className="whitespace-nowrap @max-3xl:not-data-[state=active]:sr-only @max-sm:sr-only">{item.title}</StepperTitle>
											{step <= current ? <span className="sr-only">{step < current ? ", done" : ", in progress"}</span> : null}
										</span>
									</StepperTrigger>
								</StepperItem>
							);
						})}
					</StepperNav>
				</div>
			</Frame>

			<StepperPanel className="mt-6 text-center">
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
					<p className="text-sm font-medium">Contract ready</p>
					<p className="text-sm text-muted-foreground">Every step is done and the contract is ready to sign.</p>
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
