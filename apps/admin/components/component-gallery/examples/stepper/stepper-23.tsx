"use client";

import type * as React from "react";
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
import { cn } from "@workspace/ui/lib/core/utils";

import { Button } from "@workspace/ui/components/button";

/** The step the example opens on. */
const INITIAL_STEP = 2;
/** How far one Previous / Next click moves. */
const STEP_INCREMENT = 1;
const FIRST_STEP = 1;
/** The roving tab stop the last trigger keeps once every step is done. */
const TAB_STOP = 0;

// Each step owns a color. Its column sets it as the text color, and the bar
// and indicator inherit it through currentColor. The design's blue
// step 3 is the primary token here.
const steps = [
	{ color: "text-info", caption: "Enter the card number and expiry" },
	{ color: "text-warning", caption: "Add the billing address" },
	{ color: "text-primary", caption: "Confirm the card with your bank" },
	{ color: "text-success", caption: "Review and save the card" },
];

// The design's 3:1 dashed ring on a 12px box, its 1.4 stroke overflowing the
// box. pathLength 36 closes the dashes in nine even segments, turned to start
// at 1 o'clock. Loading dims the track under a 38.5% arc that rests at 11 to
// 4 o'clock when motion is reduced.
function Ring({ spin = false }: { readonly spin?: boolean }): React.JSX.Element {
	return (
		<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true" className="size-3 overflow-visible">
			<circle cx="6" cy="6" r="6" strokeDasharray="3 1" pathLength={36} transform="rotate(-54 6 6)" strokeOpacity={spin ? 0.4 : 1} />
			{spin ? <circle cx="6" cy="6" r="6" strokeDasharray="38.5 61.5" strokeDashoffset={32.7} pathLength={100} className="origin-center motion-safe:animate-spin" /> : null}
		</svg>
	);
}

// Off the active step the indicator sits at 40% opacity, which dims these
// too. Completed and loading are spelled out for screen readers as well.
const indicators: StepIndicators = {
	completed: (
		<>
			<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-3.5">
				<circle cx="7" cy="7" r="6.3" strokeWidth="1.4" />
				<path d="m4.33 7.15 1.67 1.54 3.67-3.38" strokeWidth="1.5" />
			</svg>
			<span className="sr-only">Completed</span>
		</>
	),
	inactive: <Ring />,
	loading: (
		<>
			<Ring spin />
			<span className="sr-only">In progress</span>
		</>
	),
};

function CardIllustration(): React.JSX.Element {
	return (
		<svg width="200" height="130" viewBox="0 0 200 130" fill="none" aria-hidden="true">
			<rect x="48" y="12" width="120" height="78" rx="10" transform="rotate(6 108 51)" className="fill-muted/50 dark:fill-muted/25" />
			<rect x="36" y="18" width="128" height="82" rx="10" strokeWidth="1.5" className="fill-background stroke-border" />
			<rect x="52" y="38" width="22" height="16" rx="3" className="fill-muted-foreground/15 stroke-muted-foreground/20" />
			<path d="M52 46H74M63 38V54" strokeWidth="0.8" className="stroke-muted-foreground/15" />
			<path d="M84 42Q87 46 84 50M88 40Q92 46 88 52M92 38Q97 46 92 54" strokeWidth="1.5" strokeLinecap="round" className="stroke-muted-foreground/20" />
			{[56, 64, 72, 80, 94, 102, 110, 118].map((cx) => (
				<circle key={cx} cx={cx} cy="68" r="2" className={cx < 90 ? "fill-muted-foreground/20" : "fill-muted-foreground/15"} />
			))}
			<rect x="52" y="80" width="40" height="3" rx="1.5" className="fill-muted-foreground/12" />
			<rect x="120" y="80" width="28" height="3" rx="1.5" className="fill-muted-foreground/12" />
			<circle cx="140" cy="88" r="6" className="fill-muted-foreground/8" />
			<circle cx="150" cy="88" r="6" className="fill-muted-foreground/12" />
			<circle cx="26" cy="50" r="3" className="fill-primary/10" />
			<circle cx="180" cy="40" r="2" className="fill-primary/10" />
			<path d="M174 70L178 66V74Z" className="fill-muted-foreground/10" />
		</svg>
	);
}

export function Stepper23Example(): React.JSX.Element {
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
		<Stepper value={current} onValueChange={setCurrent} indicators={indicators} className="@container max-w-175" aria-label="Add a card">
			<Frame className="w-full" variant="ghost">
				<FramePanel>
					{/* The nav bleeds over the panel's top and side padding, so the bars
              sit flush with its edges and the panel's overflow-hidden rounds
              their ends. Only a block, auto-width nav stretches into those
              margins, and the tabs' focus ring is inset so the clip spares it. */}
					<StepperNav className="-mx-(--frame-panel-px) -mt-(--frame-panel-py) flex data-[orientation=horizontal]:w-auto">
						{steps.map((item, index) => {
							const step = index + 1;

							// The primitive shows loading on the active step only, so every
							// step carries the flag and the spinner follows the selection.
							return (
								<StepperItem key={item.caption} step={step} loading className="min-w-0 flex-1">
									<StepperTrigger tabIndex={allDone && step === steps.length ? TAB_STOP : undefined} className="w-full min-w-0 rounded-none focus-visible:ring-inset">
										{/* 30px: the 4px bar, a 12px gap and the 14px label row,
                        so the active bar grows into the gap and the row
                        never moves. */}
										<span className={cn("flex h-7.5 min-w-0 flex-1 flex-col justify-between", item.color)}>
											{/* The active bar's corners stop at the panel radius,
                          so the square styles stay square. */}
											<span
												aria-hidden="true"
												className="h-1 bg-current group-data-[state=active]/step:h-2 group-data-[state=active]/step:rounded-b-[min(var(--radius-sm)_-_2px,var(--frame-panel-radius))]"
											/>
											<span className="flex items-center justify-between gap-1 px-3 whitespace-nowrap">
												{/* Under 28rem a quarter row only fits the number, so
                            the word moves to sr-only and the tab keeps its
                            name. */}
												<StepperTitle className="text-current/60 data-[state=active]:text-current">
													<span className="@max-md:sr-only">Step </span>
													{step}
												</StepperTitle>
												{/* The primitive fills each state with its own color,
                            so each is cleared for the icon to take the step's. */}
												<StepperIndicator className="size-3 overflow-visible bg-transparent text-current opacity-40 data-[state=active]:bg-transparent data-[state=active]:text-current data-[state=active]:opacity-100 data-[state=completed]:size-3.5 data-[state=completed]:bg-transparent data-[state=completed]:text-current" />
											</span>
										</span>
									</StepperTrigger>
								</StepperItem>
							);
						})}
					</StepperNav>

					{/* The card art is a static empty state; only the caption under
              it follows the active step. */}
					<StepperPanel className="mt-6 flex flex-col items-center">
						<CardIllustration />
						{steps.map((item, index) => (
							<StepperContent key={item.caption} value={index + 1}>
								<p className="text-center text-sm text-muted-foreground">{item.caption}</p>
							</StepperContent>
						))}
						<StepperContent value={steps.length + 1}>
							<p className="text-center text-sm text-muted-foreground">Card saved and ready to use</p>
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
