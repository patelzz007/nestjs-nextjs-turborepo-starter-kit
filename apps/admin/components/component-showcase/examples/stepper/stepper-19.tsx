"use client";

import type * as React from "react";
import { CheckIcon, MoveRightIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Frame, FrameHeader, FramePanel } from "@workspace/ui/components/frame";
import { IconTile } from "@workspace/ui/components/icon-tile";
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
import { Empty, EmptyDescription, EmptyHeader } from "@workspace/ui/components/empty";

/** The step the example opens on. */
const INITIAL_STEP = 2;
/** How far one Previous / Next click moves. */
const STEP_INCREMENT = 1;
const FIRST_STEP = 1;
/** The roving tab stop the last trigger keeps once every step is done. */
const TAB_STOP = 0;

const steps = [
	{
		title: "Choose Resolution",
		description: "Pick one of the resolution options",
		empty: "Resolution options appear here",
	},
	{
		title: "Execute Resolution",
		description: "Verify details and proceed",
		empty: "Details to verify appear here",
	},
	{
		title: "Resolution Summary",
		description: "View actions taken",
		empty: "Actions taken appear here",
	},
];

// The frame tile's 1px border, made transparent, plus its 2px inset form the
// 3px ring around a 28px card. The tile also takes the focus ring from the
// pill-shaped trigger, so the ring follows its corners in every style. The
// indicator goes overflow-visible so that ring is not clipped.
const completed = (
	<IconTile
		variant="frame"
		size="sm"
		className="border-transparent bg-success/20 text-success-foreground [--icon-tile-size:--spacing(8.5)] after:border-success-foreground/8 after:bg-success after:shadow-sm in-focus-visible:ring-3 in-focus-visible:ring-ring/50"
		aria-hidden="true">
		<CheckIcon />
	</IconTile>
);

// r=7 gives a circumference of 44: the track is eleven 3+1 dashes and the
// arc is 17 long (139 degrees), starting at 11 o'clock as drawn. Only the arc
// spins, so the dashed track holds still.
function Ring({ spin = false }: { readonly spin?: boolean }): React.JSX.Element {
	return (
		<IconTile
			variant="frame"
			size="sm"
			className="border-transparent bg-input/50 [--icon-tile-size:--spacing(8.5)] after:border-ring/30 after:bg-background after:shadow-sm in-focus-visible:ring-3 in-focus-visible:ring-ring/50"
			aria-hidden="true">
			<svg viewBox="0 0 16 16" fill="none" strokeWidth="1.6">
				<circle cx="8" cy="8" r="7" pathLength={44} strokeDasharray="3 1" className="stroke-ring/50" />
				{spin ? (
					<circle cx="8" cy="8" r="7" pathLength={44} strokeDasharray="17 27" strokeDashoffset="14.4" className="origin-center stroke-success motion-safe:animate-spin" />
				) : null}
			</svg>
		</IconTile>
	);
}

const indicators: StepIndicators = { completed, inactive: <Ring />, loading: <Ring spin /> };

export function Stepper19Example(): React.JSX.Element {
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
		<Stepper value={current} onValueChange={setCurrent} indicators={indicators} className="@container max-w-175" aria-label="Resolution steps">
			<Frame variant="ghost" spacing="sm" className="bg-muted dark:bg-input/50">
				{/* The title keeps text-sm's own 20px line, since truncate clips to
            the line box, and the text-xs subtitle its 16px: py-1 around that
            36px column keeps the drawn 44px bar. The drawn 48px end padding
            is left out so the labels fit the 700px cap; below about 43rem
            they truncate, and under 36rem only the tiles remain, with sr-only
            keeping each label as the tab's name. */}
				<FrameHeader className="px-2.75 py-1">
					<StepperNav>
						{steps.map((item, index) => {
							const step = index + 1;

							// The primitive shows loading on the active step only, so every
							// step carries the flag and the spinner follows the selection.
							// flex-auto shares the free width equally, so every arrow keeps
							// the same gap on both sides.
							return (
								<StepperItem key={item.title} step={step} loading className="min-w-0 not-last:flex-auto">
									<StepperTrigger tabIndex={allDone && step === steps.length ? TAB_STOP : undefined} className="min-w-0 gap-2 focus-visible:ring-0">
										<StepperIndicator className="size-8.5 overflow-visible bg-transparent data-[state=active]:bg-transparent data-[state=completed]:bg-transparent" />

										<div className="flex min-w-0 flex-col text-start @max-xl:sr-only">
											<StepperTitle className="truncate leading-5">{item.title}</StepperTitle>
											<StepperDescription className="truncate text-xs">{item.description}</StepperDescription>
											{step < current ? <span className="sr-only">, completed</span> : null}
											{step === current ? <span className="sr-only">, in progress</span> : null}
										</div>
									</StepperTrigger>

									{step < steps.length ? (
										<span className="flex flex-1 justify-center px-1.5">
											<MoveRightIcon className="size-3.5 shrink-0 text-ring/80 rtl:rotate-180" aria-hidden="true" />
										</span>
									) : null}
								</StepperItem>
							);
						})}
					</StepperNav>
				</FrameHeader>

				{/* Empty's padding and description size differ per style, so the
            panel owns the 44px and the description pins text-sm. */}
				<FramePanel className="py-11 shadow-none">
					<StepperPanel>
						{steps.map((item, index) => (
							<StepperContent key={item.title} value={index + 1}>
								<Empty className="p-0">
									<EmptyHeader>
										<EmptyDescription className="text-sm">{item.empty}</EmptyDescription>
									</EmptyHeader>
								</Empty>
							</StepperContent>
						))}
						<StepperContent value={steps.length + 1}>
							<Empty className="p-0">
								<EmptyHeader>
									<EmptyDescription className="text-sm">Resolution complete</EmptyDescription>
								</EmptyHeader>
							</Empty>
						</StepperContent>
					</StepperPanel>

					<div className="mt-3 flex justify-center gap-2">
						<Button ref={prevRef} variant="outline" size="sm" disabled={current === FIRST_STEP} onClick={goToPreviousStep}>
							Previous
						</Button>
						<Button ref={nextRef} variant="outline" size="sm" disabled={allDone} onClick={goToNextStep}>
							Next
						</Button>
					</div>
				</FramePanel>
			</Frame>
		</Stepper>
	);
}
