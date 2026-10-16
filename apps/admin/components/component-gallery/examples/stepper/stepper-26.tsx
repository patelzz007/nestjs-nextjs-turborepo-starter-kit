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
	StepperTitle,
	StepperTrigger,
	type StepIndicators,
} from "@workspace/ui/components/stepper";
import { cn } from "@workspace/ui/lib/core/utils";

import { Button } from "@workspace/ui/components/button";

/** The step the example opens on. */
const INITIAL_STEP = 2;
/** How far one Previous / Next click moves. */
const STEP_INCREMENT = 1;
const FIRST_STEP = 1;
/** The roving tab stop the last trigger keeps once every step is done. */
const TAB_STOP = 0;

const checkpoints = [
	{
		title: "Goods Loaded",
		time: "10:52AM",
		summary: "18 pallets scanned and sealed at the Rotterdam depot.",
	},
	{
		title: "Checkpoint 1",
		time: "11:09AM",
		summary: "Cleared the A15 weigh station, running on schedule.",
	},
	{
		title: "Checkpoint 2",
		time: "1:06PM",
		summary: "Crossed into Germany at Venlo, about an hour out.",
	},
	{
		title: "Delivery",
		time: "2:15PM",
		summary: "Dock 4 at the Duisburg warehouse, signature required.",
	},
];

// The design draws the 10px check with a 1.4px line: 3.36 on a 24-unit grid.
const completed = <CheckIcon strokeWidth={3.36} className="size-2.5" aria-hidden="true" />;

// pathLength counts the ring as 28 units, so the 3:1 dash pattern closes in
// seven even dashes instead of leaving a stub at the seam.
function DashedRing({ spin = false }: { readonly spin?: boolean }): React.JSX.Element {
	return (
		<svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={cn("size-4", spin && "motion-safe:animate-spin")}>
			<circle cx="8" cy="8" r="4.45" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3 1" pathLength={28} />
		</svg>
	);
}

const indicators: StepIndicators = {
	completed,
	inactive: <DashedRing />,
	loading: <DashedRing spin />,
};

export function Stepper26Example(): React.JSX.Element {
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
		<Stepper value={current} onValueChange={setCurrent} indicators={indicators} className="@container max-w-200" aria-label="Shipment tracking">
			{/* Under 32rem the labels go screen-reader only and the row keeps its
          track, so any number of steps fits; the panel below names the
          current one. */}
			<StepperNav>
				{checkpoints.map((checkpoint, index) => {
					const step = index + 1;

					// The primitive shows loading on the active checkpoint only, so
					// every checkpoint carries the flag and the spinner follows the
					// selection.
					return (
						<StepperItem key={checkpoint.title} step={step} loading className="min-w-0 flex-1 items-stretch">
							{/* Triggers stretch to the tallest column and stack from the
                  top, so the track stays one line when a title wraps. */}
							<StepperTrigger tabIndex={allDone && step === checkpoints.length ? TAB_STOP : undefined} className="w-full flex-col gap-4">
								{/* A checkpoint not reached yet has no time: the dashes are
                    hidden so its tab reads as the title alone. */}
								<StepperDescription className="text-xs whitespace-nowrap @max-lg:sr-only">
									{step <= current ? checkpoint.time : <span aria-hidden="true">--</span>}
								</StepperDescription>

								{/* The track stops 3px short of the dot on each side, so the
                    cut shows whatever surface is behind it. The active slice
                    fills out to the column edges, so the first and last reach
                    the track's ends. */}
								<span className="flex h-1 w-full items-center gap-0.75">
									<span className="flex h-full flex-1 bg-ring/20 group-first/step:rounded-s-full">
										<span className="flex-1 rounded-s-full group-data-[state=active]/step:bg-foreground" />
									</span>
									<StepperIndicator className="size-4 bg-ring/20 text-ring data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=completed]:bg-ring/20 data-[state=completed]:text-ring" />
									<span className="flex h-full flex-1 bg-ring/20 group-last/step:rounded-e-full">
										<span className="flex-1 rounded-e-full group-data-[state=active]/step:bg-foreground" />
									</span>
								</span>

								<StepperTitle className="mx-1 data-[state=active]:font-semibold @max-lg:sr-only">{checkpoint.title}</StepperTitle>
								{step < current ? <span className="sr-only">, completed</span> : null}
								{step === current ? <span className="sr-only">, in progress</span> : null}
							</StepperTrigger>
						</StepperItem>
					);
				})}
			</StepperNav>

			<div className="mt-6 flex flex-col gap-3 text-center">
				<StepperPanel>
					{checkpoints.map((checkpoint, index) => (
						<StepperContent key={checkpoint.title} value={index + 1}>
							<p className="text-sm font-medium">{checkpoint.title}</p>
							<p className="text-sm text-muted-foreground">{checkpoint.summary}</p>
						</StepperContent>
					))}
					<StepperContent value={checkpoints.length + 1}>
						<p className="text-sm font-medium">Delivered</p>
						<p className="text-sm text-muted-foreground">Signed for at dock 4 of the Duisburg warehouse.</p>
					</StepperContent>
				</StepperPanel>
				<div className="flex justify-center gap-2">
					<Button ref={prevRef} variant="outline" size="sm" disabled={current === FIRST_STEP} onClick={goToPreviousStep}>
						Previous
					</Button>
					<Button ref={nextRef} variant="outline" size="sm" disabled={allDone} onClick={goToNextStep}>
						Next
					</Button>
				</div>
			</div>
		</Stepper>
	);
}
