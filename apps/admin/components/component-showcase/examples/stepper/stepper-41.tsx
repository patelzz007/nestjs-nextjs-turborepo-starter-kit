"use client";

import type * as React from "react";
import { CheckIcon, CircleDashedIcon } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
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

import { Button } from "@workspace/ui/components/button";
import { Separator } from "@workspace/ui/components/separator";

/** The step the example opens on. */
const INITIAL_STEP = 3;
/** How far one Previous / Next click moves. */
const STEP_INCREMENT = 1;
const FIRST_STEP = 1;
/** The roving tab stop the last trigger keeps once every step is done. */
const TAB_STOP = 0;

const steps = [
	{ title: "Resolution", detail: "Weighing a rollback against a hotfix." },
	{ title: "Scoping", detail: "Confirming only 6 pods in eu-west-1 are hit." },
	{ title: "Execution", detail: "Rolling api-gateway back to v2.14.1." },
	{ title: "Verification", detail: "Watching error rate and p95 latency." },
	{ title: "Approval", detail: "Waiting on the incident lead to sign off." },
	{ title: "Summary", detail: "Writing up the root cause and follow-ups." },
];

// The design draws the 10px check with a 1.2px line: 2.88 on a 24-unit grid.
// *:stroke-[2.88] repeats it on the paths, so the weight holds where a
// wrapper drops the prop.
const completed = (
	<span className="flex size-3.5 items-center justify-center rounded-full border border-success bg-success/10 text-success">
		<CheckIcon strokeWidth={2.88} className="size-2.5 *:stroke-[2.88]" aria-hidden="true" />
	</span>
);

const pending = <CircleDashedIcon className="size-3.5 text-ring/60" aria-hidden="true" />;

// The drawn ring: r=6 at a 1.2px stroke, a 3:1 dashed track and a 140deg
// arc from -118deg. The track is evened out to ten dashes, so no long seam
// dash shows as the arc spins past. The arc starts through its dash offset
// because the spin's CSS transform would replace a rotate() attribute.
const loading = (
	<svg viewBox="0 0 14 14" fill="none" strokeWidth={1.2} className="size-3.5" aria-hidden="true">
		<circle cx="7" cy="7" r="6" pathLength={40} strokeDasharray="3 1" transform="rotate(-54 7 7)" className="stroke-ring/80" />
		<circle cx="7" cy="7" r="6" pathLength={360} strokeDasharray="140 220" strokeDashoffset={118} className="origin-center stroke-primary motion-safe:animate-spin" />
	</svg>
);

const indicators: StepIndicators = { completed, inactive: pending, loading };

export function Stepper41Example(): React.JSX.Element {
	// The primitive derives tab ids from the step number alone and points
	// aria-controls at a panel nothing renders, so both are scoped here.
	const id = useId();
	const panelId = `${id}-panel`;
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
		<Stepper value={current} onValueChange={setCurrent} orientation="vertical" indicators={indicators} className="@container mx-auto max-w-lg" aria-label="Incident response">
			{/* The list keeps its 180px design width. Under 28rem the content
          beside it would get less than 236px, so it stacks below. */}
			<div className="flex flex-col gap-6 @md:flex-row @md:items-start">
				{/* The frame paints nothing: it only lends each row its per-style
            radius, border color and padding. 3px under the ghost panel radius
            lands on the drawn 8px, and 6px of block padding around the 20px
            text-sm line keeps the drawn 34px row. */}
				<Frame variant="ghost" spacing="xs" className="w-45 shrink-0 bg-transparent p-0 [--frame-panel-py-base:--spacing(1.5)]">
					<StepperNav className="gap-1.5">
						{steps.map((item, index) => {
							const step = index + 1;
							const status = step < current ? "completed" : step === current ? "in progress" : "upcoming";

							// The primitive shows loading on the active step only, so every
							// step carries the flag and the spinner follows the selection.
							return (
								<StepperItem key={item.title} step={step} loading>
									{/* Every row keeps a transparent border, so selecting one
                      never shifts the list: gap-1.5 absorbs it vertically to
                      hold the drawn 40px pitch, and 1px less padding keeps
                      the icons 8px in. The design's blue accent is the
                      primary token here. leading-5 is text-sm's own
                      line height, since truncate clips descenders at
                      leading-none. */}
									<StepperTrigger
										tabIndex={allDone && step === steps.length ? TAB_STOP : undefined}
										id={`${id}-tab-${String(step)}`}
										aria-controls={panelId}
										render={<FramePanel />}
										className="w-full gap-2 rounded-[calc(var(--frame-panel-radius)-3px)] border-transparent bg-transparent px-[calc(var(--frame-panel-px)-1px)] shadow-none hover:bg-muted/50 data-[state=active]:border-(--frame-panel-border-color) data-[state=active]:bg-muted/50">
										<StepperIndicator className="size-3.5 overflow-visible bg-transparent data-[state=active]:bg-transparent data-[state=completed]:bg-transparent" />
										<StepperTitle className="min-w-0 flex-1 truncate leading-5 data-[state=active]:text-primary data-[state=inactive]:text-muted-foreground">
											{item.title}
										</StepperTitle>
										<span className="sr-only">, {status}</span>
										{step === current ? (
											<span aria-hidden="true" className="pointer-events-none absolute start-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-e-full bg-primary" />
										) : null}
									</StepperTrigger>
								</StepperItem>
							);
						})}
					</StepperNav>
				</Frame>

				{/* Stacked, px-2 lines the text up with the row icons 8px in. */}
				{/* Decorative, so hidden from assistive tech: a line across while the
            columns stack, a line between them once they sit side by side. */}
				<Separator aria-hidden="true" className="@md:hidden" />
				<Separator aria-hidden="true" orientation="vertical" className="hidden @md:block" />
				<div className="flex min-w-0 flex-1 flex-col gap-3 px-2 text-start @md:px-0">
					<StepperPanel>
						{steps.map((item, index) => (
							<StepperContent key={item.title} value={index + 1}>
								<div id={panelId}>
									<p className="text-xs text-muted-foreground">
										Step {index + 1} of {steps.length}
									</p>
									<p className="text-sm font-medium">{item.title}</p>
									<p className="text-sm text-pretty text-muted-foreground">{item.detail}</p>
								</div>
							</StepperContent>
						))}
						<StepperContent value={steps.length + 1}>
							<div id={panelId}>
								<p className="text-xs text-muted-foreground">All {steps.length} steps done</p>
								<p className="text-sm font-medium">Response complete</p>
								<p className="text-sm text-pretty text-muted-foreground">The incident is approved, summarized and closed.</p>
							</div>
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
