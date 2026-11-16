"use client";

import { BrainIcon, CircleStopIcon, PencilIcon, ScrollTextIcon, TerminalIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@workspace/ui/components/button";
import { CodeBlock, type CodeBlockDiffSpec, type CodeBlockLevelSpec } from "@workspace/ui/components/code-block";
import { Trace, TraceCollapsible, TraceCollapsibleContent, TraceCollapsibleTrigger, TraceDescription, TraceIcon, TraceLine, TraceTitle } from "@workspace/ui/components/trace";

type StepKind = "reasoning" | "logs" | "edit" | "test";

interface TextDetail {
	readonly type: "text";
	readonly text: string;
}

interface CodeDetail {
	readonly type: "code";
	readonly code: string;
	readonly language: string;
	readonly diff?: CodeBlockDiffSpec;
	readonly levels?: CodeBlockLevelSpec;
}

interface Step {
	readonly id: string;
	readonly kind: StepKind;
	readonly running: string;
	readonly done: string;
	readonly stopped: string;
	readonly description?: string;
	/** How long the demo spends on the step once its output is ready. */
	readonly ms: number;
	readonly detail?: TextDetail | CodeDetail;
}

/** Reasoning streams in this many characters at a time; tool steps resolve whole. */
const REASONING_CHARS_PER_TICK = 3;
/** Delay between streamed reasoning chunks. */
const REASONING_TICK_MS = 24;

const REASONING = "A 502 means the function crashed or timed out. The logs will say which.";

const STEPS: readonly Step[] = [
	{
		id: "think",
		kind: "reasoning",
		running: "Thinking",
		done: "Thought for 4s",
		stopped: "Stopped while thinking",
		ms: 600,
		detail: { type: "text", text: REASONING },
	},
	{
		id: "logs",
		kind: "logs",
		running: "Searching logs for POST /api/checkout",
		done: "Searched logs for POST /api/checkout",
		stopped: "Stopped searching logs",
		description: "38 errors",
		ms: 1600,
		detail: {
			type: "code",
			language: "bash",
			levels: { error: [2, 3] },
			code: `14:02:11 POST /api/checkout 200 412ms
14:02:19 POST /api/checkout 502 10.0s
14:02:19 Task timed out after 10s`,
		},
	},
	{
		id: "edit",
		kind: "edit",
		running: "Editing app/api/checkout/route.ts",
		done: "Edited app/api/checkout/route.ts",
		stopped: "Stopped editing app/api/checkout/route.ts",
		description: "+3 -1",
		ms: 1800,
		detail: {
			type: "code",
			language: "typescript",
			diff: { added: [2, 3, 4], removed: [1] },
			code: `const rates = await shipping.quote(cart)
const rates = await shipping.quote(cart, {
  signal: AbortSignal.timeout(3000),
})`,
		},
	},
	{
		id: "test",
		kind: "test",
		running: "Running pnpm test checkout",
		done: "Ran pnpm test checkout",
		stopped: "Stopped pnpm test checkout",
		description: "9 passed",
		ms: 2200,
		detail: {
			type: "code",
			language: "bash",
			code: `✓ checkout/route.test.ts (9 tests)
Tests  9 passed`,
		},
	},
];

type RunState = "running" | "stopped" | "done";

function statusText(state: RunState): string {
	if (state === "done") {
		return `Finished in ${String(STEPS.length)} steps`;
	}
	return state === "stopped" ? "Stopped by you" : "Working";
}

function StepGlyph({ kind }: { readonly kind: StepKind }): React.JSX.Element {
	switch (kind) {
		case "reasoning":
			return <BrainIcon />;
		case "logs":
			return <ScrollTextIcon />;
		case "edit":
			return <PencilIcon />;
		case "test":
			return <TerminalIcon />;
	}
}

interface StepDetailProps {
	readonly step: Step;
	readonly detail: TextDetail | CodeDetail;
	readonly isLive: boolean;
	readonly chars: number;
}

function StepDetail({ step, detail, isLive, chars }: StepDetailProps): React.JSX.Element {
	if (detail.type === "text") {
		return <p className="text-pretty">{isLive ? detail.text.slice(0, chars) : detail.text}</p>;
	}
	return <CodeBlock code={detail.code} language={detail.language} diff={detail.diff} lineLevels={detail.levels} label={`Output of ${step.done}`} />;
}

interface StepRowProps {
	readonly step: Step;
	readonly runState: RunState;
	/** The step the run is on (live while running, the stopped one after Stop). */
	readonly isCurrent: boolean;
	readonly isFinished: boolean;
	readonly chars: number;
	/** The reader's own toggle, when they made one. */
	readonly toggledOpen: boolean | undefined;
	readonly onToggle: (id: string, open: boolean) => void;
}

function StepRow({ step, runState, isCurrent, isFinished, chars, toggledOpen, onToggle }: StepRowProps): React.JSX.Element {
	const isLive = isCurrent ? runState === "running" : false;
	const wasStopped = isCurrent ? runState === "stopped" : false;
	const handleOpenChange = React.useCallback(
		(open: boolean): void => {
			onToggle(step.id, open);
		},
		[onToggle, step.id],
	);

	const title = isLive ? step.running : wasStopped ? step.stopped : step.done;
	const line = (
		<TraceLine status={isLive ? "running" : undefined}>
			<TraceIcon>{wasStopped ? <CircleStopIcon /> : <StepGlyph kind={step.kind} />}</TraceIcon>
			<TraceTitle>{title}</TraceTitle>
			{!isLive && !wasStopped && step.description !== undefined ? <TraceDescription>{step.description}</TraceDescription> : null}
		</TraceLine>
	);

	// A step with nothing to show, or one that never produced its output,
	// stays a plain line rather than a trigger that opens empty.
	const { detail } = step;
	const hasDetail = detail !== undefined && (isFinished || (isLive && detail.type === "text"));
	if (!hasDetail || wasStopped) {
		return line;
	}

	return (
		<TraceCollapsible open={toggledOpen ?? isLive} onOpenChange={handleOpenChange}>
			<TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
			<TraceCollapsibleContent>
				<StepDetail step={step} detail={detail} isLive={isLive} chars={chars} />
			</TraceCollapsibleContent>
		</TraceCollapsible>
	);
}

export function Trace2Example(): React.JSX.Element {
	const [state, setState] = React.useState<RunState>("running");
	// Steps finished so far. The step at this index is the live one.
	const [finished, setFinished] = React.useState(0);
	const [chars, setChars] = React.useState(0);
	// Only rows the reader has toggled are stored, so `open ?? running` lets a
	// live row open itself and still lets a click win in either direction.
	const [openById, setOpenById] = React.useState<Readonly<Record<string, boolean>>>({});

	const live = state === "running" ? STEPS[finished] : undefined;

	React.useEffect((): (() => void) | undefined => {
		if (live === undefined) {
			return undefined;
		}
		const { detail } = live;
		if (detail?.type === "text" && chars < detail.text.length) {
			const id = window.setTimeout((): void => {
				setChars((value: number): number => value + REASONING_CHARS_PER_TICK);
			}, REASONING_TICK_MS);
			return (): void => {
				window.clearTimeout(id);
			};
		}
		const id = window.setTimeout((): void => {
			const next = finished + 1;
			setFinished(next);
			if (next === STEPS.length) {
				setState("done");
			}
		}, live.ms);
		return (): void => {
			window.clearTimeout(id);
		};
	}, [live, chars, finished]);

	const handleToggle = React.useCallback((id: string, open: boolean): void => {
		setOpenById((current: Readonly<Record<string, boolean>>): Readonly<Record<string, boolean>> => ({ ...current, [id]: open }));
	}, []);

	// One button that swaps its label keeps focus where the reader left it,
	// instead of unmounting under the cursor.
	const handleStopOrRestart = React.useCallback((): void => {
		if (state === "running") {
			setState("stopped");
			return;
		}
		setFinished(0);
		setChars(0);
		setOpenById({});
		setState("running");
	}, [state]);

	const shown = STEPS.slice(0, Math.min(finished + 1, STEPS.length));

	return (
		<div className="flex w-full max-w-md flex-col gap-4 text-sm">
			<Trace>
				{shown.map((step: Step, index: number): React.JSX.Element => (
					<StepRow
						key={step.id}
						step={step}
						runState={state}
						isCurrent={index === finished}
						isFinished={index < finished}
						chars={chars}
						toggledOpen={openById[step.id]}
						onToggle={handleToggle}
					/>
				))}
			</Trace>
			<div className="flex items-center gap-3">
				<Button size="sm" variant="outline" onClick={handleStopOrRestart}>
					{state === "running" ? "Stop" : "Run again"}
				</Button>
				<p role="status" className="text-xs text-muted-foreground">
					{statusText(state)}
				</p>
			</div>
		</div>
	);
}
