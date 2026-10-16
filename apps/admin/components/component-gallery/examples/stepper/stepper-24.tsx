"use client";

import type * as React from "react";
import { CheckIcon, ClipboardCheckIcon, ListChecksIcon, ScrollTextIcon, WorkflowIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Frame, FramePanel } from "@workspace/ui/components/frame";
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
		detail: "Comparing 3 fixes by risk and time to recover.",
		icon: <ListChecksIcon />,
	},
	{
		title: "Execute Resolution",
		description: "Verify details and proceed",
		detail: "Rolling back api-gateway to v2.14.1 on 6 pods.",
		icon: <WorkflowIcon />,
	},
	{
		title: "Verify Outcome",
		description: "Confirm the issue is resolved",
		detail: "Watching error rate and latency for 10 minutes.",
		icon: <ClipboardCheckIcon />,
	},
	{
		title: "Resolution Summary",
		description: "View actions taken",
		detail: "Writing up the timeline and every action taken.",
		icon: <ScrollTextIcon />,
	},
];

const completed = (
	<span className="flex size-4 items-center justify-center rounded-full border border-success bg-success/10 text-success">
		<CheckIcon className="size-3" aria-hidden="true" />
		<span className="sr-only">Completed</span>
	</span>
);

// A repeating conic mask cuts the ring into eleven dashes at the design's 3:1
// rhythm. The stroke overhangs the 14px box by half its width, so it centers
// on the box as the design's does. The spinner is a 139deg arc over it that
// holds still under reduced motion, where it reads as the design's static arc.
function Ring({ spin = false }: { readonly spin?: boolean }): React.JSX.Element {
	return (
		<span className="relative block size-3.5">
			<span className="absolute -inset-[0.8px] rounded-full border-[1.6px] border-ring/50 mask-[repeating-conic-gradient(from_36deg,#000_0_calc(270deg/11),transparent_0_calc(360deg/11))]" />
			{spin ? (
				<>
					<span className="absolute -inset-[0.8px] rounded-full border-[1.6px] border-primary mask-[conic-gradient(from_-28deg,#000_139deg,transparent_0)] motion-safe:animate-spin" />
					<span className="sr-only">In progress</span>
				</>
			) : null}
		</span>
	);
}

const indicators: StepIndicators = { completed, inactive: <Ring />, loading: <Ring spin /> };

export function Stepper24Example(): React.JSX.Element {
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
		<Stepper value={current} onValueChange={setCurrent} orientation="vertical" indicators={indicators} className="max-w-115" aria-label="Incident resolution">
			<div className="flex flex-col gap-6">
				<StepperNav className="w-full">
					{/* Each row is its own panel: stacked joins them into one list, ghost
              drops the outer border and xs spacing is the design's 8px row
              padding. */}
					<Frame variant="ghost" spacing="xs" stacked>
						{steps.map((item, index) => (
							// The trigger sits inside the padding, so the panel paints the
							// hover, selected and focus states for the whole row.
							<FramePanel
								key={item.title}
								className="hover:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring/50 has-focus-visible:ring-inset has-data-[state=active]:bg-muted">
								{/* The primitive shows loading on the active step only, so every
                    step carries the flag and the spinner follows the selection. */}
								<StepperItem step={index + 1} loading>
									{/* Its after layer stretches over the panel, so the padding
                      takes the click too. */}
									<StepperTrigger
										tabIndex={allDone && index + 1 === steps.length ? TAB_STOP : undefined}
										className="w-full gap-2 text-start after:absolute after:inset-0 focus-visible:ring-0">
										{/* The frame tile's 1px border plus its 2px inset form the
                        3px ring. The border goes transparent so the ring reads
                        as one fill; the item's data-state picks the tone. */}
										<IconTile
											variant="frame"
											size="sm"
											className="border-transparent bg-input/50 text-muted-foreground [--icon-tile-icon-size:--spacing(3.5)] [--icon-tile-size:--spacing(8.5)] group-data-[state=active]/step:bg-input group-data-[state=active]/step:text-primary group-data-[state=completed]/step:bg-success/20 group-data-[state=completed]/step:text-success-foreground after:border-ring/30 after:bg-background after:shadow-sm group-data-[state=completed]/step:after:border-success-foreground/8 group-data-[state=completed]/step:after:bg-success"
											aria-hidden="true">
											{item.icon}
										</IconTile>

										{/* The 14px title, 4px gap and 16px subtitle add up to the
                        34px tile, so the text adds no height to the row. */}
										<div className="flex min-w-0 flex-1 flex-col gap-1">
											<StepperTitle>{item.title}</StepperTitle>
											<StepperDescription className="text-xs">{item.description}</StepperDescription>
										</div>

										{/* 16px for the check and 14px for the rings, whose stroke
                        overhangs the box, so the indicator stops clipping. */}
										<StepperIndicator className="size-3.5 overflow-visible bg-transparent data-[state=active]:bg-transparent data-[state=completed]:size-4 data-[state=completed]:bg-transparent" />
									</StepperTrigger>
								</StepperItem>
							</FramePanel>
						))}
					</Frame>
				</StepperNav>

				<div className="flex flex-col gap-3 text-start">
					<StepperPanel>
						{steps.map((item, index) => (
							<StepperContent key={item.title} value={index + 1}>
								<p className="text-xs text-muted-foreground">
									Step {index + 1} of {steps.length}
								</p>
								<p className="text-sm font-medium">{item.title}</p>
								<p className="text-sm text-muted-foreground">{item.detail}</p>
							</StepperContent>
						))}
						<StepperContent value={steps.length + 1}>
							<p className="text-xs text-muted-foreground">All {steps.length} steps done</p>
							<p className="text-sm font-medium">Incident resolved</p>
							<p className="text-sm text-muted-foreground">Every step is complete and the case can close.</p>
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
