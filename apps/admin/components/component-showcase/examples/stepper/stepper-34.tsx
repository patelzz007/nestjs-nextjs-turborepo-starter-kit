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
		title: "Intake",
		description: "Brief, scope and deadline logged from the request.",
	},
	{
		title: "Structure",
		description: "Sections outlined, each with a named owner.",
	},
	{ title: "Draft", description: "A first pass of every section is shared." },
	{
		title: "Internal check",
		description: "Legal and finance are reviewing pricing and terms.",
	},
	{
		title: "Negotiate",
		description: "Open terms settled with the client's procurement.",
	},
	{
		title: "Package",
		description: "Final proposal exported, signed and sent.",
	},
];

const indicators: StepIndicators = {
	completed: <CheckIcon className="size-3.5" aria-hidden="true" />,
	inactive: <CircleDashedIcon className="size-3.5" aria-hidden="true" />,
	loading: <LoaderCircleIcon className="size-3.5 motion-safe:animate-spin" aria-hidden="true" />,
};

// A chevron cut from its box: --notch bites into the start edge and --arrow
// points out of the end edge, and --stretch scales both (as --n and --a) for a
// taller copy whose edges stay parallel. Every corner is rounded as in the
// design, so the clip traces each with three points on its curve; an end with
// no depth collapses them onto a straight edge. The shape mirrors whole in
// RTL, so its corners and everything inside it use physical sides.
function Chevron({ className, ...props }: React.ComponentProps<"span">): React.JSX.Element {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"absolute -z-10 [--a:calc(var(--arrow)*var(--stretch,1))] [--n:calc(var(--notch)*var(--stretch,1))] [clip-path:polygon(calc(var(--n)*0.28)_0,calc(100%_-_var(--a)*1.268)_0,calc(100%_-_var(--a)*1.032)_calc(var(--a)*0.059),calc(100%_-_var(--a)*0.852)_calc(var(--a)*0.223),calc(100%_-_var(--a)*0.185)_calc(50%_-_var(--a)*0.277),calc(100%_-_var(--a)*0.101)_50%,calc(100%_-_var(--a)*0.185)_calc(50%_+_var(--a)*0.277),calc(100%_-_var(--a)*0.852)_calc(100%_-_var(--a)*0.223),calc(100%_-_var(--a)*1.032)_calc(100%_-_var(--a)*0.059),calc(100%_-_var(--a)*1.268)_100%,calc(var(--n)*0.28)_100%,calc(var(--n)*0.148)_calc(100%_-_var(--n)*0.079),calc(var(--n)*0.155)_calc(100%_-_var(--n)*0.233),calc(var(--n)*0.815)_calc(50%_+_var(--n)*0.277),calc(var(--n)*0.899)_50%,calc(var(--n)*0.815)_calc(50%_-_var(--n)*0.277),calc(var(--n)*0.155)_calc(var(--n)*0.233),calc(var(--n)*0.148)_calc(var(--n)*0.079))] rtl:-scale-x-100",
				className,
			)}
			{...props}
		/>
	);
}

// The notch and arrow sides traced from the design, stroked 2px wide on the
// clip line: the clip keeps the inner 1px, the weight of the border they
// meet. That border insets the outline's padding box, so each side reaches
// 1px past it at both ends.
const edges = {
	notch: "M12 0H2.24C1.28 0 .71 1.07 1.24 1.87L6.52 9.78C7.42 11.12 7.42 12.88 6.52 14.22L1.24 22.13C.71 22.93 1.28 24 2.24 24H12",
	arrow: "M0 0H1.86C3.2 0 4.45.67 5.19 1.78L10.52 9.78C11.42 11.12 11.42 12.88 10.52 14.22L5.19 22.22C4.45 23.33 3.2 24 1.86 24H0",
};

function Edge({ side, className }: { readonly side: keyof typeof edges; readonly className: string }): React.JSX.Element {
	return (
		<svg viewBox="0 0 12 24" fill="none" stroke="currentColor" strokeWidth={2} className={cn("absolute -top-px h-[calc(100%+2px)] w-3 overflow-visible", className)}>
			<path d={edges[side]} />
		</svg>
	);
}

export function Stepper34Example(): React.JSX.Element {
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
		<Stepper value={current} onValueChange={setCurrent} indicators={indicators} className="flex w-full flex-col items-center gap-6" aria-label="Proposal plan">
			{/* The steps share the full width. With every label the row needs
          about 690px, so under 48rem the steps around the current one drop to
          their indicator and under 24rem the current one too (the panel names
          it); past that the strip scrolls, and the 2px padding keeps the focus
          ring inside the scrollport.
          The corner is capped at --radius-sm, 2px less inside, so the square
          styles stay square. */}
			<Frame
				ref={rowRef}
				variant="inverse"
				className="@container relative w-full flex-row overflow-x-auto rounded-[min(var(--frame-radius),var(--radius-sm))] border-input/50 [--frame-gap:--spacing(0.5)] [--frame-panel-radius:min(var(--frame-radius),var(--radius-sm)_-_2px)] [--frame-px:--spacing(0.5)] [--frame-py:--spacing(0.5)]">
				{/* Every step before the current one counts as done. */}
				<span className="flex shrink-0 items-center rounded-(--frame-panel-radius) bg-input/60 px-1.5 text-xs font-medium whitespace-nowrap text-muted-foreground uppercase tabular-nums">
					Plan {current - 1}/{steps.length}
				</span>

				<StepperNav className="min-w-max flex-1 gap-0.5">
					{steps.map((item, index) => {
						const step = index + 1;

						// The primitive shows loading on the active step only, so every
						// step carries the flag and the spinner follows the selection.
						// Folded steps hug their icon and the current one takes the rest;
						// once every label is folded they share the width again.
						return (
							<StepperItem key={item.title} step={step} loading className="flex-1 @max-3xl:not-data-[state=active]:flex-none @max-sm:not-data-[state=active]:flex-1">
								{/* The 8px notch reaches back over the 2px gap, so each
                    arrow nests in the next notch with a 2px channel. The
                    clip bounds hit testing too, so the corners that reach
                    back select this step, not the one under them. */}
								<StepperTrigger
									tabIndex={allDone && step === steps.length ? TAB_STOP : undefined}
									className="relative isolate h-6 flex-1 gap-1.5 ps-1.5 pe-4 text-muted-foreground [--arrow:--spacing(2)] [--notch:--spacing(2)] group-first/step:ps-2 group-first/step:[--notch:0px] group-last/step:pe-2.5 group-last/step:[--arrow:0px] focus-visible:ring-0 data-[state=active]:text-primary data-[state=completed]:text-success-foreground dark:data-[state=completed]:text-success">
									{/* The clip and the traced sides assume the 24px of h-6, so
                      the focus ring, 2px larger all round, is 28/24 of it,
                      behind the opaque base below. */}
									<Chevron className="-inset-y-0.5 -start-[calc(var(--notch)*var(--stretch)+--spacing(0.5))] -end-0.5 hidden bg-ring/50 [--stretch:7/6] group-first/step:rounded-l-[calc(var(--frame-panel-radius)+--spacing(0.5))] group-last/step:rounded-r-[calc(var(--frame-panel-radius)+--spacing(0.5))] in-focus-visible:block" />

									{/* The step in progress takes the primary
                      token (the design's blue accent). The tint sits on ::after;
                      the outline is drawn solid and faded as one layer, so
                      its border and traced sides never double up. */}
									<Chevron className="inset-y-0 -start-(--notch) end-0 bg-background group-first/step:rounded-l-(--frame-panel-radius) group-last/step:rounded-r-(--frame-panel-radius) after:absolute after:inset-0 after:rounded-[inherit] after:bg-input/40 group-data-[state=active]/step:after:bg-primary/20 group-data-[state=completed]/step:after:bg-success/10">
										<span className="absolute inset-0 rounded-[inherit] border-y border-current opacity-0 group-first/step:border-l group-last/step:border-r group-data-[state=active]/step:text-primary group-data-[state=active]/step:opacity-10 group-data-[state=completed]/step:text-success group-data-[state=completed]/step:opacity-15">
											<Edge side="notch" className="left-0 group-first/step:hidden" />
											<Edge side="arrow" className="right-0 group-last/step:hidden" />
										</span>
									</Chevron>

									<StepperIndicator className="size-3.5 bg-transparent text-current data-[state=active]:bg-transparent data-[state=active]:text-current data-[state=completed]:bg-transparent data-[state=completed]:text-current" />
									<StepperTitle className="whitespace-nowrap @max-3xl:not-data-[state=active]:sr-only @max-sm:sr-only">{item.title}</StepperTitle>
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
					<p className="text-sm font-medium">Proposal ready</p>
					<p className="text-sm text-muted-foreground">The package is ready to send to the client.</p>
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
