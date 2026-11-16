"use client";

import type * as React from "react";
import { Building2Icon, CheckIcon, CircleCheckIcon, ClipboardCheckIcon, CreditCardIcon, MailIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Frame, FramePanel } from "@workspace/ui/components/frame";
import { IconStack } from "@workspace/ui/components/icon-stack";
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

const steps = [
	{
		title: "Company details",
		description: "Legal name and tax ID for your invoices.",
		color: "text-info",
		icon: <Building2Icon className="size-4" />,
	},
	{
		title: "Payment method",
		description: "The card charged at each renewal.",
		color: "text-warning",
		icon: <CreditCardIcon className="size-4" />,
	},
	{
		title: "Billing contact",
		description: "Who receives invoices and receipts.",
		// The design's blue accent is the primary token here.
		color: "text-primary",
		icon: <MailIcon className="size-4" />,
	},
	{
		title: "Review",
		description: "Confirm the plan and start billing.",
		color: "text-success",
		icon: <ClipboardCheckIcon className="size-4" />,
	},
];

// The design's 3:1 dashed ring. pathLength counts the circle as 36 units, so
// the dashes close in nine even segments with no stub at the seam. Loading
// dims the track and lays a 39% arc over it, resting at the design's angle
// (11 to 4 o'clock) when motion is reduced.
function Ring({ spin = false }: { readonly spin?: boolean }): React.JSX.Element {
	return (
		<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true" className="size-3.5">
			<circle cx="7" cy="7" r="6" strokeDasharray="3 1" pathLength={36} strokeOpacity={spin ? 0.4 : 1} />
			{spin ? <circle cx="7" cy="7" r="6" strokeDasharray="39 61" strokeDashoffset={33} pathLength={100} className="origin-center motion-safe:animate-spin" /> : null}
		</svg>
	);
}

const indicators: StepIndicators = {
	// The design draws the 14px ring with a 1.4px line: 2.4 on a 24-unit grid.
	completed: <CircleCheckIcon strokeWidth={2.4} className="size-3.5" aria-hidden="true" />,
	inactive: <Ring />,
	loading: <Ring spin />,
};

export function Stepper22Example(): React.JSX.Element {
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
		<Stepper value={current} onValueChange={setCurrent} indicators={indicators} className="@container max-w-175" aria-label="Billing setup">
			<Frame className="w-full" variant="ghost">
				<FramePanel>
					<StepperPanel className="pt-3">
						{steps.map((item, index) => (
							<StepperContent key={item.title} value={index + 1}>
								<div className="flex flex-col items-center text-center">
									<IconStack aria-hidden="true" className="mb-2">
										{item.icon}
									</IconStack>
									<p className="text-sm font-medium">{item.title}</p>
									<p className="mt-0.5 text-sm text-balance text-muted-foreground">{item.description}</p>
								</div>
							</StepperContent>
						))}
						<StepperContent value={steps.length + 1}>
							<div className="flex flex-col items-center text-center">
								<IconStack aria-hidden="true" className="mb-2">
									<CheckIcon className="size-4" />
								</IconStack>
								<p className="text-sm font-medium">Billing ready</p>
								<p className="mt-0.5 text-sm text-balance text-muted-foreground">Invoices start with your next renewal.</p>
							</div>
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

					{/* Bleeds over the panel's side and bottom padding, so the bars sit
              flush with its edges and its overflow-hidden rounds the outer
              ends to its radius. */}
					<div className="-mx-(--frame-panel-px) mt-4 -mb-(--frame-panel-py) flex">
						<StepperNav>
							{steps.map((item, index) => {
								const step = index + 1;
								const status = step < current ? ", completed" : step === current ? ", in progress" : "";

								// Each step owns a color, which the bar and indicator take
								// through currentColor. Off the active step the title turns
								// muted and the indicator dims to 40%. Every step carries the
								// loading flag so the spinner follows the selection.
								return (
									<StepperItem key={item.title} step={step} loading className="min-w-0 flex-1">
										{/* The panel clips anything drawn past its edges, so the
                        focus ring is inset. */}
										<StepperTrigger
											tabIndex={allDone && step === steps.length ? TAB_STOP : undefined}
											aria-label={`Step ${String(step)}: ${item.title}${status}`}
											className="min-w-0 flex-1 rounded-none focus-visible:ring-inset">
											{/* 38px: 8px that keeps the ring off the label, the 14px
                          label row, a 12px gap and the 4px bar, so the active
                          bar grows into the gap and the row never moves. */}
											<span className={cn("flex h-9.5 min-w-0 flex-1 flex-col justify-between pt-2", item.color)}>
												<span className="flex items-center justify-between gap-1 px-3 whitespace-nowrap">
													{/* Under 28rem a quarter row only fits the number;
                              the trigger's aria-label keeps the full name. */}
													<StepperTitle className="text-current/60 data-[state=active]:text-current">
														<span className="@max-md:hidden">Step </span>
														{step}
													</StepperTitle>
													<StepperIndicator className="size-3.5 bg-transparent text-current opacity-40 data-[state=active]:bg-transparent data-[state=active]:text-current data-[state=active]:opacity-100 data-[state=completed]:bg-transparent data-[state=completed]:text-current" />
												</span>

												{/* The active bar doubles to 8px with rounded top
                            corners, capped at the panel radius so square
                            styles stay square. */}
												<span
													aria-hidden="true"
													className="h-1 bg-current transition-all group-data-[state=active]/step:h-2 group-data-[state=active]/step:rounded-t-[min(calc(var(--radius-sm)-2px),var(--frame-panel-radius))]"
												/>
											</span>
										</StepperTrigger>
									</StepperItem>
								);
							})}
						</StepperNav>
					</div>
				</FramePanel>
			</Frame>
		</Stepper>
	);
}
