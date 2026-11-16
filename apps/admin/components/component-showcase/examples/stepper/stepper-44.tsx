"use client";

import type * as React from "react";
import { CheckIcon, CircleDashedIcon } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
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
	useStepItem,
	type StepIndicators,
} from "@workspace/ui/components/stepper";
import { cn } from "@workspace/ui/lib/core/utils";

import { Button } from "@workspace/ui/components/button";
import { Collapsible, CollapsibleContent } from "@workspace/ui/components/collapsible";
import { Separator } from "@workspace/ui/components/separator";

/** The step the example opens on. */
const INITIAL_STEP = 3;
/** The roving tab stop the last trigger keeps once every step is done. */
const TAB_STOP = 0;
const FIRST_STEP = 1;
/** How far one Previous / Next click moves. */
const STEP_INCREMENT = 1;
/** The task the opening phase starts on. */
const INITIAL_TASK = 3;

interface Phase {
	readonly title: string;
	readonly tasks: readonly string[];
}

/** One stop on the Previous / Next walk: a 1-based phase and task. */
interface SequenceStop {
	readonly phase: number;
	readonly task: number;
}

const phases: readonly Phase[] = [
	{
		title: "Resolution Planning",
		tasks: ["Review Ticket", "Find Root Cause", "Draft Plan"],
	},
	{
		title: "Scope Alignment",
		tasks: ["Confirm Impact", "Agree on Scope", "Assign Owners"],
	},
	{
		title: "Implementation",
		tasks: ["Configure Solution", "Connect Systems", "Apply Changes", "Run Workflow", "Prepare Output"],
	},
	{
		title: "Outcome Verification",
		tasks: ["Run Tests", "Validate Results", "Confirm with Customer"],
	},
	{
		title: "Final Summary",
		tasks: ["Write Summary", "Share Report", "Close Ticket"],
	},
];

// Every task in reading order, so Previous and Next walk straight across
// phase boundaries, then one stop past the final phase, where every phase
// and task reads complete.
const sequence: readonly SequenceStop[] = [
	...phases.flatMap((phase: Phase, index: number): SequenceStop[] =>
		phase.tasks.map((_task: string, taskIndex: number): SequenceStop => ({
			phase: index + FIRST_STEP,
			task: taskIndex + FIRST_STEP,
		})),
	),
	{ phase: phases.length + FIRST_STEP, task: FIRST_STEP },
];
const FIRST_POSITION = 0;
const LAST_POSITION = sequence.length - STEP_INCREMENT;

// The design draws its icons with a 1.2px line: 2.88 on the 24-unit grid of
// the 10px check, 1.44 on the 20px dashed circle. The *:stroke class repeats
// it on the paths, so the weight holds where a wrapper drops the prop.
function Completed({ className }: { readonly className: string }): React.JSX.Element {
	return (
		<span className={cn("flex items-center justify-center rounded-full border border-success bg-success/10 text-success", className)}>
			<CheckIcon strokeWidth={2.88} className="size-2.5 *:stroke-[2.88]" aria-hidden="true" />
		</span>
	);
}

function Pending({ className, strokeWidth }: { readonly className: string; readonly strokeWidth?: number | undefined }): React.JSX.Element {
	return <CircleDashedIcon strokeWidth={strokeWidth} className={cn("text-ring/60", className)} aria-hidden="true" />;
}

// A repeating conic mask cuts the track into dashes at the drawn 3:1 rhythm,
// and a primary arc spins over it.
function Running({ className, track, arc }: { readonly className: string; readonly track: string; readonly arc: string }): React.JSX.Element {
	return (
		<span className={cn("relative block", className)}>
			<span className={cn("absolute inset-0 rounded-full border-[1.2px] border-ring/60", track)} />
			<span className={cn("absolute inset-0 rounded-full border-[1.2px] border-primary motion-safe:animate-spin", arc)} />
		</span>
	);
}

// 16 dashes fit the 22px phase ring and 9 the 13px task ring, and each arc
// keeps its drawn sweep.
const phaseIndicators: StepIndicators = {
	completed: <Completed className="size-5" />,
	inactive: <Pending className="size-5 *:stroke-[1.44]" strokeWidth={1.44} />,
	loading: (
		<Running
			className="size-5.5"
			track="mask-[repeating-conic-gradient(#000_0_16.875deg,transparent_0_22.5deg)]"
			arc="mask-[conic-gradient(from_-17deg,#000_152deg,transparent_0)]"
		/>
	),
};

const taskIndicators: StepIndicators = {
	completed: <Completed className="size-3.5" />,
	inactive: <Pending className="size-3.5" />,
	loading: (
		<Running
			className="size-3.25"
			track="mask-[repeating-conic-gradient(#000_0_30deg,transparent_0_40deg)]"
			arc="mask-[conic-gradient(from_-28deg,#000_140deg,transparent_0)]"
		/>
	),
};

// The rails are drawn in pieces that stop 2px short of each indicator, the
// gap the design cuts with a white ring. A painted ring would show as a halo
// on any surface that is not exactly the page background. The pieces cross
// the corners of each trigger's box, so they let clicks through.
const phaseSegment = "bg-input pointer-events-none absolute end-3 w-[1.2px] translate-x-1/2 rounded-full rtl:-translate-x-1/2";

const taskSegment = "bg-input pointer-events-none absolute end-2.25 w-px translate-x-1/2 rounded-full rtl:-translate-x-1/2";

const indicator = "bg-transparent data-[state=active]:bg-transparent data-[state=completed]:bg-transparent";

const stepTitle = "data-[state=inactive]:text-muted-foreground whitespace-nowrap";

// Reads the enclosing item's state, so what is announced cannot drift from
// the data-state the trigger is styled by.
function StepStatus(): React.JSX.Element | null {
	const { state } = useStepItem();
	if (state === "inactive") return null;

	return <span className="sr-only">{state === "completed" ? ", completed" : ", in progress"}</span>;
}

export function Stepper44Example(): React.JSX.Element {
	const id = useId();
	const [current, setCurrent] = useState<number>(INITIAL_STEP);
	const [task, setTask] = useState<number>(INITIAL_TASK);
	const prevRef = useRef<HTMLButtonElement>(null);
	const nextRef = useRef<HTMLButtonElement>(null);
	const panelId = `${id}-panel`;
	const position = sequence.findIndex((stop: SequenceStop): boolean => stop.phase === current && stop.task === task);
	// No tab is selected once every phase is done, so the last phase keeps
	// the tablist's tab stop.
	const allDone = current > phases.length;

	// Reselecting the current phase keeps its progress; a newly chosen one
	// starts on its first task.
	const selectPhase = useCallback(
		(next: number): void => {
			if (next === current) return;
			setCurrent(next);
			setTask(FIRST_STEP);
		},
		[current],
	);

	// Crossing into a neighboring phase opens it on its first or last task.
	const goTo = useCallback((next: number): void => {
		const stop = sequence[next];
		if (stop === undefined) return;
		setCurrent(stop.phase);
		setTask(stop.task);
		// The pressed button disables itself at either end, so focus moves to
		// its partner.
		if (next === FIRST_POSITION) nextRef.current?.focus();
		if (next === LAST_POSITION) prevRef.current?.focus();
	}, []);

	const goToPreviousStep = useCallback((): void => {
		goTo(position - STEP_INCREMENT);
	}, [goTo, position]);

	const goToNextStep = useCallback((): void => {
		goTo(position + STEP_INCREMENT);
	}, [goTo, position]);

	// Side by side from 28rem, which leaves 11rem beside the 15rem stepper for
	// the text and the Previous and Next row. Below that the content stacks
	// under the stepper, end-aligned with its phase titles.
	return (
		<Stepper
			value={current}
			onValueChange={selectPhase}
			orientation="vertical"
			indicators={phaseIndicators}
			className="@container mx-auto max-w-lg"
			aria-label="Ticket resolution">
			<div className="mx-auto flex max-w-60 flex-col gap-6 @md:max-w-none @md:flex-row @md:items-start">
				{/* Both steppers number their tabs from 1 and the primitive derives
            ids from that number alone, so every trigger takes its own id and
            an aria-controls that names the one content panel. */}
				<StepperNav className="flex @md:w-60 @md:shrink-0">
					{phases.map((phase, index) => {
						const step = index + 1;
						const active = step === current;
						// A phase folding away shows its tasks all done or all pending,
						// never the live one, and ignores clicks on them.
						const progress = active ? task : step < current ? phase.tasks.length + 1 : 0;

						// The primitive shows loading on the active step only, so every
						// step carries the flag and the spinner follows the selection. A
						// min height rather than padding holds the drawn 61px pitch, so an
						// opening phase grows out of it without a jump.
						return (
							<StepperItem key={phase.title} step={step} loading className="relative min-h-15.25 items-end justify-start last:min-h-0">
								{/* The running ring is 2px wider than the others, so its
                    gaps start 1px further out. */}
								<span aria-hidden="true" className={cn(phaseSegment, "top-0", active ? "h-1.25" : "h-1.5")} />
								<span aria-hidden="true" className={cn(phaseSegment, "bottom-0", active ? "top-7.75" : "top-7.5")} />
								{/* leading-5 restores text-sm's 20px line over the 16px caption,
                    so the indicator centers 18px down. */}
								<StepperTrigger
									tabIndex={allDone && step === phases.length ? TAB_STOP : undefined}
									id={`${id}-phase-${String(step)}`}
									aria-controls={panelId}
									className="gap-2 text-end">
									<span className="flex flex-col">
										<StepperTitle className={cn(stepTitle, "leading-5")}>{phase.title}</StepperTitle>
										<StepperDescription className="text-xs">Step {step}</StepperDescription>
									</span>
									<StepStatus />
									<StepperIndicator className={indicator} />
								</StepperTrigger>

								<Collapsible open={active}>
									<CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
										<Stepper
											value={progress}
											onValueChange={active ? setTask : undefined}
											orientation="vertical"
											indicators={taskIndicators}
											aria-label={`${phase.title} tasks`}>
											{/* me-7.5 sets the task rail 27px in from the phase
                          rail, and mt-2 with mb-2.5 land the open phase on its
                          drawn 204px. ms-1 keeps the widest task's focus ring
                          inside the clipped panel. */}
											<StepperNav className="ms-1 me-7.5 mt-2 mb-2.5">
												{phase.tasks.map((label, taskIndex) => {
													const taskStep = taskIndex + 1;

													return (
														<StepperItem key={label} step={taskStep} loading className="relative items-end">
															{taskIndex > 0 ? <span aria-hidden="true" className={cn(taskSegment, "top-0 h-1.5")} /> : null}
															{taskStep < phase.tasks.length ? <span aria-hidden="true" className={cn(taskSegment, "top-6 bottom-0")} /> : null}
															<StepperTrigger id={`${id}-task-${String(step)}-${String(taskStep)}`} aria-controls={panelId} className="min-h-7.5 gap-1.5 text-end">
																<StepperTitle className={cn(stepTitle, "font-normal")}>{label}</StepperTitle>
																<StepStatus />
																<StepperIndicator className={cn(indicator, "size-4.5")} />
															</StepperTrigger>
														</StepperItem>
													);
												})}
											</StepperNav>
										</Stepper>
									</CollapsibleContent>
								</Collapsible>
							</StepperItem>
						);
					})}
				</StepperNav>

				{/* pe-8 lines the stacked content up with the phase titles. */}
				{/* Decorative, so hidden from assistive tech: a line across while the
            columns stack, a line between them once they sit side by side. */}
				<Separator aria-hidden="true" className="@md:hidden" />
				<Separator aria-hidden="true" orientation="vertical" className="hidden @md:block" />
				<div className="flex min-w-0 flex-1 flex-col gap-3 pe-8 text-end @md:pe-0 @md:text-start">
					<StepperPanel>
						{phases.map((phase, index) => (
							<StepperContent key={phase.title} value={index + 1}>
								<div id={panelId}>
									<p className="text-xs text-muted-foreground">
										Task {task} of {phase.tasks.length}
									</p>
									<p className="text-sm font-medium">{phase.tasks[task - FIRST_STEP]}</p>
									<p className="text-sm text-muted-foreground">{phase.title}</p>
								</div>
							</StepperContent>
						))}
						<StepperContent value={phases.length + 1}>
							<div id={panelId}>
								<p className="text-xs text-muted-foreground">All {phases.length} phases done</p>
								<p className="text-sm font-medium">Ticket resolved</p>
								<p className="text-sm text-muted-foreground">Every task is complete.</p>
							</div>
						</StepperContent>
					</StepperPanel>
					<div className="flex justify-end gap-2 @md:justify-start">
						<Button ref={prevRef} variant="outline" size="sm" disabled={position === FIRST_POSITION} onClick={goToPreviousStep}>
							Previous
						</Button>
						<Button ref={nextRef} variant="outline" size="sm" disabled={position === LAST_POSITION} onClick={goToNextStep}>
							Next
						</Button>
					</div>
				</div>
			</div>
		</Stepper>
	);
}
