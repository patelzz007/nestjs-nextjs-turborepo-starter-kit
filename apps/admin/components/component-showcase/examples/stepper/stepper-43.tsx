"use client";

import type * as React from "react";
import { CheckIcon, ChevronRightIcon, CircleDashedIcon } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
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
import { Collapsible, CollapsibleContent } from "@workspace/ui/components/collapsible";
import { Separator } from "@workspace/ui/components/separator";

/** The roving tab stop the last trigger keeps once every step is done. */
const TAB_STOP = 0;
const FIRST_STEP = 1;
/** How far one Previous / Next click moves. */
const STEP_INCREMENT = 1;
/** The task count of a phase that does not exist. */
const NO_TASKS = 0;
/** The opening phase and task. */
const INITIAL_PHASE = 3;
const INITIAL_TASK = 3;

interface Phase {
	readonly title: string;
	readonly tasks: readonly string[];
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

// The indicator's own border draws the ring, so one check serves the 18px
// phase ring and the 14px task ring. The drawn 1.2px line is 2.88 on the
// 24-unit grid; *:stroke-[2.88] repeats it where a wrapper drops the prop.
const completed = <CheckIcon strokeWidth={2.88} className="size-2.5 *:stroke-[2.88]" aria-hidden="true" />;

const pending = <CircleDashedIcon className="size-3.5" aria-hidden="true" />;

// The drawn ring: r=6 at a 1.2px stroke, a 3:1 dashed track and a 140deg
// arc from -118deg. The track is evened out to ten dashes so no long seam
// dash shows as the arc spins past, and the arc starts through its dash
// offset because the spin's transform would replace a rotate() attribute.
const running = (
	<svg viewBox="0 0 14 14" fill="none" strokeWidth={1.2} className="size-3.5" aria-hidden="true">
		<circle cx="7" cy="7" r="6" pathLength={40} strokeDasharray="3 1" transform="rotate(-54 7 7)" className="stroke-ring/80" />
		<circle cx="7" cy="7" r="6" pathLength={360} strokeDasharray="140 220" strokeDashoffset={118} className="origin-center stroke-primary motion-safe:animate-spin" />
	</svg>
);

const taskIndicators: StepIndicators = { completed, inactive: pending, loading: running };
const phaseIndicators: StepIndicators = { completed };

/** How many tasks the (1-based) phase `step` holds; none past either end. */
function taskCountOf(step: number): number {
	return phases[step - FIRST_STEP]?.tasks.length ?? NO_TASKS;
}

function toggled(value: boolean): boolean {
	return !value;
}

/** Firefox still clicks on a Space keyup the primitive already handled, so one press would act twice. */
function preventSpaceKeyUp(event: React.KeyboardEvent<HTMLButtonElement>): void {
	if (event.key === " ") event.preventDefault();
}

export function Stepper43Example(): React.JSX.Element {
	const id = useId();
	const [phase, setPhase] = useState<number>(INITIAL_PHASE);
	const [task, setTask] = useState<number>(INITIAL_TASK);
	const [open, setOpen] = useState(true);
	const panelId = `${id}-panel`;
	const prevRef = useRef<HTMLButtonElement>(null);
	const nextRef = useRef<HTMLButtonElement>(null);
	const atStart = phase === FIRST_STEP && task === FIRST_STEP;
	// One past the last phase marks every phase and task complete. No tab
	// is selected then, so the last phase keeps the tablist's tab stop.
	const allDone = phase > phases.length;

	// The primitive reports the current step again when it is chosen, so
	// that choice folds or unfolds the phase instead of selecting it.
	const selectPhase = useCallback(
		(next: number): void => {
			if (next === phase) {
				setOpen(toggled);
				return;
			}
			setPhase(next);
			setTask(FIRST_STEP);
			setOpen(true);
		},
		[phase],
	);

	// Previous and Next walk every task in order and open the phase they
	// land in. The pressed button disables itself at either end, so focus
	// moves to its partner.
	const goTo = useCallback((toPhase: number, toTask: number): void => {
		setPhase(toPhase);
		setTask(toTask);
		setOpen(true);
		if (toPhase === FIRST_STEP && toTask === FIRST_STEP) nextRef.current?.focus();
		if (toPhase > phases.length) prevRef.current?.focus();
	}, []);

	const goPrevious = useCallback((): void => {
		if (task > FIRST_STEP) goTo(phase, task - STEP_INCREMENT);
		else goTo(phase - STEP_INCREMENT, taskCountOf(phase - STEP_INCREMENT));
	}, [goTo, phase, task]);

	const goNext = useCallback((): void => {
		if (task < taskCountOf(phase)) goTo(phase, task + STEP_INCREMENT);
		else goTo(phase + STEP_INCREMENT, FIRST_STEP);
	}, [goTo, phase, task]);

	return (
		<Stepper
			value={phase}
			onValueChange={selectPhase}
			orientation="vertical"
			indicators={phaseIndicators}
			className="@container mx-auto w-full max-w-lg"
			aria-label="Ticket resolution">
			{/* The phases keep their 240px beside the content. Under 28rem the
          content would get less than 176px, so it stacks below. */}
			<div className="flex flex-col gap-6 @md:flex-row @md:items-start">
				{/* Both steppers number their tabs from 1 and the primitive derives
            ids from that number alone, so every trigger takes its own id, and
            an aria-controls only while the element it names is on the page. */}
				<StepperNav className="w-full max-w-60 shrink-0 gap-2">
					{phases.map((item, index) => {
						const step = index + 1;
						const expanded = open && step === phase;
						const tasksId = `${id}-tasks-${String(step)}`;
						// A phase folding away after another became current reads as all
						// done or all pending, never as the live task, and ignores clicks.
						const progress = step === phase ? task : step < phase ? item.tasks.length + 1 : 0;

						return (
							<StepperItem key={item.title} step={step} className="items-stretch">
								{/* A closed phase keeps its Frame with the chrome made
                    transparent: swapping elements would remount the trigger,
                    which the primitive never unregisters. -m-px pushes the
                    unseen border outside the row, landing the drawn 8px inset
                    and 36px row height. */}
								<Collapsible open={expanded}>
									<Frame className={cn("gap-0 overflow-hidden p-2 transition-colors duration-200", !expanded && "-m-px border-transparent bg-transparent")}>
										{/* Titles take text-sm's own leading-5, as the primitive's
                        leading-none clips descenders under truncate, so the
                        trigger is 20px tall and the after element spreads it
                        over the row without growing its focus ring. Firefox
                        still clicks on a Space keyup the primitive already
                        handled, so one press would act twice. */}
										<StepperTrigger
											tabIndex={allDone && step === phases.length ? TAB_STOP : undefined}
											id={`${id}-phase-${String(step)}`}
											aria-controls={expanded ? tasksId : undefined}
											aria-expanded={expanded}
											onKeyUp={preventSpaceKeyUp}
											className="relative gap-2 text-start after:absolute after:-inset-2">
											<StepperIndicator className="size-4.5 border border-border bg-muted/50 leading-none font-medium text-muted-foreground data-[state=active]:border-ring/50 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=completed]:border-success data-[state=completed]:bg-success/10 data-[state=completed]:text-success">
												{step}
											</StepperIndicator>
											<StepperTitle className="min-w-0 flex-1 truncate leading-5 data-[state=inactive]:text-muted-foreground">{item.title}</StepperTitle>
											{step < phase ? <span className="sr-only">, completed</span> : null}
											<ChevronRightIcon
												className={cn("size-3.5 shrink-0 transition-transform", expanded ? "rotate-90 text-foreground" : "text-ring rtl:rotate-180")}
												aria-hidden="true"
											/>
										</StepperTrigger>

										{/* -mx-2 runs the task rows to the frame's edges, so the
                        active band and its bar meet the border. */}
										<CollapsibleContent
											id={tasksId}
											className="-mx-2 h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
											<Stepper
												value={progress}
												onValueChange={step === phase ? setTask : undefined}
												orientation="vertical"
												indicators={taskIndicators}
												className="mt-2.5"
												aria-label={`${item.title} tasks`}>
												<StepperNav className="w-full">
													{/* The primitive shows loading on the active task
                              only, so every task carries the flag and the
                              spinner follows the selection. */}
													{item.tasks.map((label, taskIndex) => {
														const taskStep = taskIndex + 1;
														const status = taskStep < progress ? ", completed" : taskStep === progress ? ", in progress" : null;

														return (
															<StepperItem key={label} step={taskStep} loading className="items-stretch">
																{/* Full-bleed rows sit in a clipped panel, so
                                    the focus ring is drawn inset. */}
																<StepperTrigger
																	id={`${id}-task-${String(step)}-${String(taskStep)}`}
																	aria-controls={panelId}
																	className="relative h-7 gap-2 rounded-none ps-7.5 pe-2 text-start before:absolute before:inset-y-1.25 before:start-0 before:w-0.75 before:rounded-e-full focus-visible:ring-inset data-[state=active]:bg-background data-[state=active]:before:bg-primary">
																	<StepperIndicator className="size-3.5 bg-transparent text-ring/60 data-[state=active]:bg-transparent data-[state=completed]:border data-[state=completed]:border-success data-[state=completed]:bg-success/10 data-[state=completed]:text-success" />
																	<StepperTitle className="min-w-0 flex-1 truncate leading-5 data-[state=inactive]:text-muted-foreground">{label}</StepperTitle>
																	{status ? <span className="sr-only">{status}</span> : null}
																</StepperTrigger>
															</StepperItem>
														);
													})}
												</StepperNav>
											</Stepper>
										</CollapsibleContent>
									</Frame>
								</Collapsible>
							</StepperItem>
						);
					})}
				</StepperNav>

				{/* Stacked, px-2 lines the copy up with the phase numbers above it.
            Beside them, pt-2 lines it up with the first phase title. */}
				{/* Decorative, so hidden from assistive tech: a line across while the
            columns stack, a line between them once they sit side by side. */}
				<Separator aria-hidden="true" className="@md:hidden" />
				<Separator aria-hidden="true" orientation="vertical" className="hidden @md:block" />
				<div className="flex min-w-0 flex-1 flex-col gap-3 px-2 text-start @md:px-0 @md:pt-2">
					<StepperPanel>
						{phases.map((item, index) => (
							<StepperContent key={item.title} value={index + 1}>
								<div id={panelId}>
									<p className="text-xs text-muted-foreground">
										{item.title}, task {task} of {item.tasks.length}
									</p>
									<p className="text-sm font-medium">{item.tasks[task - FIRST_STEP]}</p>
								</div>
							</StepperContent>
						))}
						<StepperContent value={phases.length + 1}>
							<div id={panelId}>
								<p className="text-xs text-muted-foreground">All {phases.length} phases done</p>
								<p className="text-sm font-medium">Ticket resolved</p>
							</div>
						</StepperContent>
					</StepperPanel>
					<div className="flex justify-start gap-2">
						<Button ref={prevRef} variant="outline" size="sm" disabled={atStart} onClick={goPrevious}>
							Previous
						</Button>
						<Button ref={nextRef} variant="outline" size="sm" disabled={allDone} onClick={goNext}>
							Next
						</Button>
					</div>
				</div>
			</div>
		</Stepper>
	);
}
