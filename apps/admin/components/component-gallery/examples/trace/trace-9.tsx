"use client";

import { CircleCheckIcon, CircleDashedIcon, CircleXIcon, LoaderCircleIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@workspace/ui/components/button";
import { CodeBlock, type CodeBlockLevelSpec } from "@workspace/ui/components/code-block";
import {
	Trace,
	TraceCollapsible,
	TraceCollapsibleContent,
	TraceCollapsibleTrigger,
	TraceDescription,
	TraceIcon,
	TraceLine,
	TraceTitle,
	type TraceLineStatus,
} from "@workspace/ui/components/trace";

type JobState = "done" | "failed" | "running" | "pending";

interface Step {
	readonly title: string;
	readonly duration: string;
	readonly failed?: boolean;
	readonly log?: string;
}

interface Job {
	readonly id: string;
	readonly title: Readonly<Record<JobState, string>>;
	readonly duration?: string;
	readonly initial: JobState;
	readonly steps?: Readonly<Partial<Record<JobState, readonly Step[]>>>;
}

/** How long each re-run job takes in the demo. */
const RERUN_JOB_MS = 1800;

const FAILURE_LOG = `FAIL search-input.test.tsx
  × debounces keystrokes
    onSearch ran 3 times, expected 1
  × cancels the timer on unmount
    onSearch ran after unmount`;

/** The two failing assertions, by log line. */
const FAILURE_LEVELS: CodeBlockLevelSpec = { error: [2, 4] };

const JOBS: readonly Job[] = [
	{
		id: "install",
		title: {
			done: "Installed dependencies",
			failed: "Failed to install dependencies",
			running: "Installing dependencies",
			pending: "Install dependencies",
		},
		duration: "38s",
		initial: "done",
		steps: {
			done: [
				{ title: "Restored the pnpm store from cache", duration: "4s" },
				{ title: "Ran pnpm install --frozen-lockfile", duration: "31s" },
			],
		},
	},
	{
		id: "test",
		title: {
			done: "Ran 418 tests",
			failed: "Tests failed, 2 of 418",
			running: "Running 418 tests",
			pending: "Run tests",
		},
		duration: "1m 12s",
		initial: "failed",
		steps: {
			done: [
				{ title: "Ran unit tests", duration: "48s" },
				{ title: "Ran component tests", duration: "24s" },
			],
			failed: [
				{ title: "Ran unit tests", duration: "48s" },
				{
					title: "Component tests failed",
					duration: "24s",
					failed: true,
					log: FAILURE_LOG,
				},
			],
		},
	},
	{
		id: "build",
		title: {
			done: "Built the app",
			failed: "Build failed",
			running: "Building the app",
			pending: "Build the app",
		},
		duration: "1m 3s",
		initial: "pending",
	},
	{
		id: "deploy",
		title: {
			done: "Deployed a preview",
			failed: "Preview deploy failed",
			running: "Deploying a preview",
			pending: "Deploy a preview",
		},
		duration: "18s",
		initial: "pending",
	},
];

// Jobs a re-run repeats, in order. Everything before the failure keeps its
// result, which is what re-running only the failed jobs means.
const RERUN: readonly string[] = ["test", "build", "deploy"];

function stateOf(job: Job, rerun: number | null): JobState {
	const index = RERUN.indexOf(job.id);
	if (rerun === null || index === -1) {
		return job.initial;
	}
	if (index < rerun) {
		return "done";
	}
	return index === rerun ? "running" : "pending";
}

function jobLineStatus(state: JobState): TraceLineStatus | undefined {
	if (state === "failed") {
		return "error";
	}
	return state === "done" ? undefined : state;
}

function statusText(failed: boolean, running: boolean): string {
	if (failed) {
		return "Build and deploy wait on the tests";
	}
	return running ? `Re-running ${String(RERUN.length)} jobs` : "All jobs passed";
}

export function Trace9Example(): React.JSX.Element {
	// null until the reader re-runs; then how many re-run jobs have finished.
	const [rerun, setRerun] = React.useState<number | null>(null);
	const statusRef = React.useRef<HTMLParagraphElement>(null);

	const states = JOBS.map((job: Job): JobState => stateOf(job, rerun));
	const running = states.includes("running");
	const failed = states.includes("failed");

	React.useEffect((): (() => void) | undefined => {
		if (rerun === null || rerun >= RERUN.length) {
			return undefined;
		}
		const timer = window.setTimeout((): void => {
			setRerun(rerun + 1);
		}, RERUN_JOB_MS);
		return (): void => {
			window.clearTimeout(timer);
		};
	}, [rerun]);

	// The button disables itself on click, so focus moves to the line that
	// reports the re-run instead of falling back to the page.
	const handleRerun = React.useCallback((): void => {
		setRerun(0);
		statusRef.current?.focus();
	}, []);

	return (
		<div className="flex w-full max-w-md flex-col gap-4 text-sm">
			<Trace>
				{JOBS.map((job: Job): React.JSX.Element => (
					<JobRow key={job.id} job={job} state={stateOf(job, rerun)} />
				))}
			</Trace>
			<div className="flex items-center gap-3">
				<Button size="sm" variant="outline" disabled={!failed} onClick={handleRerun}>
					Re-run failed jobs
				</Button>
				<p ref={statusRef} role="status" tabIndex={-1} className="text-xs text-muted-foreground outline-none">
					{statusText(failed, running)}
				</p>
			</div>
		</div>
	);
}

interface JobRowProps {
	readonly job: Job;
	readonly state: JobState;
}

function JobRow({ job, state }: JobRowProps): React.JSX.Element {
	const steps = job.steps?.[state];
	const line = (
		<TraceLine status={jobLineStatus(state)}>
			<TraceIcon>
				<JobGlyph state={state} />
			</TraceIcon>
			<TraceTitle>{job.title[state]}</TraceTitle>
			{state === "done" || state === "failed" ? <TraceDescription>{job.duration}</TraceDescription> : null}
		</TraceLine>
	);
	if (steps === undefined) {
		return line;
	}
	return (
		<TraceCollapsible defaultOpen={state === "failed"}>
			<TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
			<TraceCollapsibleContent>
				<Trace>
					{steps.map((step: Step): React.JSX.Element =>
						step.log === undefined ? (
							<TraceLine key={step.title}>
								<TraceTitle>{step.title}</TraceTitle>
								<TraceDescription>{step.duration}</TraceDescription>
							</TraceLine>
						) : (
							<TraceCollapsible key={step.title} defaultOpen>
								<TraceCollapsibleTrigger>
									<TraceLine status="error">
										<TraceTitle>{step.title}</TraceTitle>
										<TraceDescription>{step.duration}</TraceDescription>
									</TraceLine>
								</TraceCollapsibleTrigger>
								<TraceCollapsibleContent>
									<CodeBlock code={step.log} language="bash" lineLevels={FAILURE_LEVELS} label="Failing test output" />
								</TraceCollapsibleContent>
							</TraceCollapsible>
						),
					)}
				</Trace>
			</TraceCollapsibleContent>
		</TraceCollapsible>
	);
}

interface JobGlyphProps {
	readonly state: JobState;
}

function JobGlyph({ state }: JobGlyphProps): React.JSX.Element {
	if (state === "failed") {
		return <CircleXIcon />;
	}
	if (state === "pending") {
		return <CircleDashedIcon />;
	}
	if (state === "running") {
		return <LoaderCircleIcon className="motion-safe:animate-spin" />;
	}
	return <CircleCheckIcon />;
}
