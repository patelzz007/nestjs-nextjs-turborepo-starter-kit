import { Button } from "@workspace/ui-native/components/button";
import { CodeBlock, type CodeBlockLineMark } from "@workspace/ui-native/components/code-block";
import type { LucideIcon } from "@workspace/ui-native/components/icon";
import { Spinner } from "@workspace/ui-native/components/spinner";
import { Trace, TraceLine, TraceStep, type TraceLineStatus } from "@workspace/ui-native/components/trace";
import CircleCheckIcon from "lucide-react-native/icons/circle-check";
import CircleDashedIcon from "lucide-react-native/icons/circle-dashed";
import CircleXIcon from "lucide-react-native/icons/circle-x";
import * as React from "react";
import { Text, View } from "react-native";

type JobState = "done" | "failed" | "running" | "pending";

interface Step {
	readonly title: string;
	readonly duration: string;
	readonly log?: string | undefined;
}

interface Job {
	readonly id: string;
	readonly title: Readonly<Record<JobState, string>>;
	readonly duration: string;
	readonly initial: JobState;
	readonly steps?: Readonly<Partial<Record<JobState, readonly Step[]>>> | undefined;
}

/** How long each re-run job takes in the demo. */
const RERUN_JOB_MS = 1_800;

const FAILURE_LOG = `FAIL search-input.test.tsx
  × debounces keystrokes
    onSearch ran 3 times, expected 1
  × cancels the timer on unmount
    onSearch ran after unmount`;

/** The two failing assertions, by log line. */
const FAILURE_MARKS: readonly CodeBlockLineMark[] = [
	{ line: 2, kind: "error" },
	{ line: 4, kind: "error" },
];

const JOBS: readonly Job[] = [
	{
		id: "install",
		title: { done: "Installed dependencies", failed: "Failed to install dependencies", running: "Installing dependencies", pending: "Install dependencies" },
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
		title: { done: "Ran 418 tests", failed: "Tests failed, 2 of 418", running: "Running 418 tests", pending: "Run tests" },
		duration: "1m 12s",
		initial: "failed",
		steps: {
			done: [
				{ title: "Ran unit tests", duration: "48s" },
				{ title: "Ran component tests", duration: "24s" },
			],
			failed: [
				{ title: "Ran unit tests", duration: "48s" },
				{ title: "Component tests failed", duration: "24s", log: FAILURE_LOG },
			],
		},
	},
	{ id: "build", title: { done: "Built the app", failed: "Build failed", running: "Building the app", pending: "Build the app" }, duration: "1m 3s", initial: "pending" },
	{
		id: "deploy",
		title: { done: "Deployed a preview", failed: "Preview deploy failed", running: "Deploying a preview", pending: "Deploy a preview" },
		duration: "18s",
		initial: "pending",
	},
];

/** Jobs a re-run repeats, in order. Everything before the failure keeps its result. */
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

const JOB_GLYPHS: Readonly<Record<Exclude<JobState, "running">, LucideIcon>> = { done: CircleCheckIcon, failed: CircleXIcon, pending: CircleDashedIcon };

/** A running job spins; the others show their state's glyph. */
const RUNNING = <Spinner variant="muted" />;

function statusText(failed: boolean, running: boolean): string {
	if (failed) {
		return "Build and deploy wait on the tests";
	}
	return running ? `Re-running ${String(RERUN.length)} jobs` : "All jobs passed";
}

function StepRow({ step }: { readonly step: Step }): React.JSX.Element {
	if (step.log === undefined) {
		return <TraceLine title={step.title} description={step.duration} />;
	}
	return (
		<TraceStep title={step.title} description={step.duration} status="error" defaultOpen>
			<CodeBlock code={step.log} language="bash" lineMarks={FAILURE_MARKS} caption="Failing test output" />
		</TraceStep>
	);
}

function JobRow({ job, state }: { readonly job: Job; readonly state: JobState }): React.JSX.Element {
	const steps = job.steps?.[state];
	const icon = state === "running" ? undefined : JOB_GLYPHS[state];
	const leading = state === "running" ? RUNNING : undefined;
	const description = state === "done" || state === "failed" ? job.duration : undefined;
	if (steps === undefined) {
		return <TraceLine icon={icon} leading={leading} title={job.title[state]} description={description} status={jobLineStatus(state)} />;
	}
	return (
		<TraceStep icon={icon} leading={leading} title={job.title[state]} description={description} status={jobLineStatus(state)} defaultOpen={state === "failed"}>
			<Trace>
				{steps.map((step: Step): React.JSX.Element => (
					<StepRow key={step.title} step={step} />
				))}
			</Trace>
		</TraceStep>
	);
}

export function Trace9Example(): React.JSX.Element {
	// null until the reader re-runs; then how many re-run jobs have finished.
	const [rerun, setRerun] = React.useState<number | null>(null);
	const states = JOBS.map((job: Job): JobState => stateOf(job, rerun));
	const running = states.includes("running");
	const failed = states.includes("failed");

	React.useEffect((): (() => void) | undefined => {
		if (rerun === null || rerun >= RERUN.length) {
			return undefined;
		}
		const timer = setTimeout((): void => {
			setRerun(rerun + 1);
		}, RERUN_JOB_MS);
		return (): void => {
			clearTimeout(timer);
		};
	}, [rerun]);

	const startRerun = React.useCallback((): void => {
		setRerun(0);
	}, []);

	return (
		<View className="gap-4">
			<Trace accessibilityLabel="Workflow run">
				{JOBS.map((job: Job): React.JSX.Element => (
					<JobRow key={job.id} job={job} state={stateOf(job, rerun)} />
				))}
			</Trace>
			<View className="flex-row items-center gap-3">
				<Button label="Re-run failed jobs" size="sm" variant="outline" disabled={!failed} onPress={startRerun} />
				<Text accessibilityLiveRegion="polite" className="text-caption shrink font-sans text-muted-foreground">
					{statusText(failed, running)}
				</Text>
			</View>
		</View>
	);
}
