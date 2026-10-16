"use client";

import type * as React from "react";
import { CheckIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import {
	Stepper,
	StepperContent,
	StepperDescription,
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

const checkpoints = [
	{
		title: "Goods Loaded",
		time: "10:52AM",
		summary: "22 pallets sealed into trailer 4 at the Antwerp depot.",
	},
	{
		title: "Checkpoint 1",
		time: "11:09AM",
		summary: "E19 weigh station at Brecht, axle load check.",
	},
	{
		title: "Checkpoint 2",
		time: "11:27AM",
		summary: "Hazeldonk border post, customs papers pre-filed.",
	},
	{
		title: "Arrival",
		time: "11:46AM",
		summary: "Dock 7 at the Breda warehouse, signature on delivery.",
	},
];

// pathLength counts the ring as 28 units, so the design's 3:1 dash closes in
// seven even dashes instead of leaving a stub at the seam.
function Pending({ spin = false }: { readonly spin?: boolean }): React.JSX.Element {
	return (
		<span className="flex size-4 rounded-full bg-ring/40 text-background">
			<svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={cn("size-4", spin && "motion-safe:animate-spin")}>
				<circle cx="8" cy="8" r="4.5" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3 1" pathLength={28} />
			</svg>
		</span>
	);
}

const indicators: StepIndicators = {
	// The design draws the 10px check with a 1.4px line: 3.36 on a 24-unit grid.
	completed: (
		<span className="flex size-4 items-center justify-center rounded-full bg-foreground text-background">
			<CheckIcon strokeWidth={3.36} className="size-2.5" aria-hidden="true" />
		</span>
	),
	inactive: <Pending />,
	loading: <Pending spin />,
};

export function Stepper27Example(): React.JSX.Element {
	const [current, setCurrent] = useState<number>(INITIAL_STEP);
	const prevRef = useRef<HTMLButtonElement>(null);
	const nextRef = useRef<HTMLButtonElement>(null);
	// One past the last step marks every step complete. No tab is selected
	// then, so the last one keeps the tablist's tab stop.
	const allDone = current > checkpoints.length;

	const goTo = useCallback((step: number): void => {
		setCurrent(step);
		// The pressed button disables itself at either end, so focus moves to
		// its partner.
		if (step === FIRST_STEP) nextRef.current?.focus();
		if (step > checkpoints.length) prevRef.current?.focus();
	}, []);

	const goToPreviousStep = useCallback((): void => {
		goTo(current - STEP_INCREMENT);
	}, [current, goTo]);

	const goToNextStep = useCallback((): void => {
		goTo(current + STEP_INCREMENT);
	}, [current, goTo]);

	return (
		<Stepper value={current} onValueChange={setCurrent} indicators={indicators} className="@container max-w-200" aria-label="Shipment progress">
			{/* Isolated so the ticks can sit at -z-1: the arrow, drawn by the stop
          before the active one, then covers the next stop's ticks too while
          its own done dot still paints over the arrow's start. Positioned
          triggers keep the active one's focus ring above that arrow. */}
			{/* Under 32rem the labels go screen-reader only and the row keeps its
          track, so any number of steps fits; the panel below names the
          current one. */}
			<StepperNav className="isolate">
				{checkpoints.map((checkpoint, index) => {
					const step = index + 1;
					const label = step < current ? checkpoint.time : `${step === checkpoints.length ? "ETA" : "Est."} ${checkpoint.time}`;

					// The primitive shows loading on the active stop only, so every
					// stop carries the flag: the spinner follows the selection and
					// stands in for the active indicator.
					return (
						<StepperItem key={checkpoint.title} step={step} loading className="relative min-w-0 flex-1 items-stretch">
							{/* 2px ticks on a 5.5px tile (the design's 36 per 200px stop),
                  spaced by mask-repeat: space so none is ever clipped. The
                  pending dot is see-through, so an 11px hole cuts them 3px
                  back from it (a page-surface disc showed as a halo on a
                  card); opaque done dots close it. data-state tones the
                  lead-in once this stop is done, the lead-out waits for the
                  next one. top-7.75 is the 16px time row plus the 16px gap,
                  less 1px to center; triggers stretch and stack from the
                  top, so that offset holds when a title wraps. */}
							<StepperSeparator
								className={cn(
									"pointer-events-none absolute inset-x-0 top-7.75 -z-1 m-0 bg-transparent bg-linear-to-r from-ring/30 from-50% to-ring/30 to-50% mask-[linear-gradient(to_right,transparent_calc(50%_-_0.0625rem),#000_0_calc(50%_+_0.0625rem),transparent_0),radial-gradient(circle,transparent_var(--cutout),#000_0)] mask-intersect mask-size-[0.34375rem_100%,100%_100%] mask-repeat-space [--cutout:0.6875rem] group-data-[orientation=horizontal]/stepper-nav:h-1.5 data-[state=completed]:from-ring/40 data-[state=completed]:[--cutout:0rem] @max-lg:-top-px rtl:bg-linear-to-l",
									step + 1 < current && "to-ring/40",
								)}
							/>

							{/* The leg into the active stop, from under this done dot to
                  60% of the way; the surface fill keeps its pale end opaque. */}
							{step + 1 === current && !allDone ? (
								<span
									aria-hidden="true"
									className="pointer-events-none absolute start-1/2 -end-1/10 top-7.75 ms-1.75 h-1.5 bg-background bg-linear-to-r from-info/40 to-info @max-lg:-top-px rtl:bg-linear-to-l">
									<svg viewBox="0 0 14 16" className="absolute -end-1.75 top-1/2 h-4 w-3.5 -translate-y-1/2 fill-info rtl:-scale-x-100">
										<path d="M12.4 5.07C14.53 6.47 14.53 9.53 12.4 10.93L5.6 15.4C3.21 16.97 0 15.29 0 12.47V3.53C0 .71 3.21-.97 5.6.6Z" />
									</svg>
								</span>
							) : null}

							<StepperTrigger tabIndex={allDone && step === checkpoints.length ? TAB_STOP : undefined} className="relative w-full flex-col gap-4">
								<StepperDescription className="text-xs whitespace-nowrap @max-lg:sr-only">{label}</StepperDescription>

								<span className="flex h-1 items-center">
									<StepperIndicator className="size-4 bg-transparent data-[state=active]:bg-transparent data-[state=completed]:bg-transparent" />
								</span>

								<StepperTitle className="mx-1 @max-lg:sr-only">{checkpoint.title}</StepperTitle>
								{step < current ? <span className="sr-only">, completed</span> : null}
							</StepperTrigger>
						</StepperItem>
					);
				})}
			</StepperNav>

			<StepperPanel className="mt-6 text-center">
				{checkpoints.map((checkpoint, index) => (
					<StepperContent key={checkpoint.title} value={index + 1}>
						<p className="text-sm font-medium">{checkpoint.title}</p>
						<p className="text-sm text-muted-foreground">{checkpoint.summary}</p>
					</StepperContent>
				))}
				<StepperContent value={checkpoints.length + 1}>
					<p className="text-sm font-medium">Arrived</p>
					<p className="text-sm text-muted-foreground">Signed for at dock 7 of the Breda warehouse.</p>
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
