"use client";

import { BotIcon, TerminalIcon, WorkflowIcon } from "lucide-react";
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

type AgentState = "running" | "done" | "failed";

type AgentId = "explorer" | "implementer" | "tests";

const AGENT_IDS: readonly AgentId[] = ["explorer", "implementer", "tests"];

type AgentStates = Readonly<Record<AgentId, AgentState>>;

const INITIAL_STATES: AgentStates = {
	explorer: "done",
	implementer: "running",
	tests: "failed",
};

/** Stands in for how long a running subagent takes to report back. */
const SUBAGENT_RUN_MS = 3200;

interface Call {
	readonly title: string;
	readonly description?: string;
	readonly status?: "running" | "error";
	readonly output?: string;
}

interface Subagent {
	readonly id: AgentId;
	readonly name: string;
	readonly title: Readonly<Record<AgentState, string>>;
	readonly calls: Readonly<Record<AgentState, readonly Call[]>>;
	readonly result?: string;
}

/** The failing output's error line. */
const OUTPUT_LEVELS: CodeBlockLevelSpec = { error: [2] };

const EXPLORER_CALLS: readonly Call[] = [{ title: "Searched for seatPrice", description: "9 results" }, { title: "Read lib/billing/plans.ts" }];

const AGENTS: readonly Subagent[] = [
	{
		id: "explorer",
		name: "Explorer",
		title: {
			running: "Explorer is mapping the billing code",
			done: "Explorer mapped the billing code",
			failed: "Explorer failed",
		},
		calls: { running: EXPLORER_CALLS, done: EXPLORER_CALLS, failed: [] },
		result: "Found 3 fixed seat prices: plans.ts, the webhook and the invoice preview.",
	},
	{
		id: "implementer",
		name: "Implementer",
		title: {
			running: "Implementer is editing 2 files",
			done: "Implementer edited 2 files",
			failed: "Implementer failed",
		},
		calls: {
			running: [
				{ title: "Edited lib/billing/plans.ts", description: "+38 -12" },
				{ title: "Creating lib/billing/meter.ts", status: "running" },
			],
			done: [
				{ title: "Edited lib/billing/plans.ts", description: "+38 -12" },
				{ title: "Created lib/billing/meter.ts", description: "+64" },
			],
			failed: [],
		},
	},
	{
		id: "tests",
		name: "Test writer",
		title: {
			running: "Test writer is running the billing suite",
			done: "Test writer added 6 passing tests",
			failed: "Test writer's suite did not compile",
		},
		calls: {
			running: [
				{ title: "Wrote tests/billing/meter.test.ts", description: "+92" },
				{ title: "Running pnpm test billing", status: "running" },
			],
			done: [
				{ title: "Wrote tests/billing/meter.test.ts", description: "+92" },
				{ title: "Ran pnpm test billing", description: "6 passed" },
			],
			failed: [
				{ title: "Wrote tests/billing/meter.test.ts", description: "+92" },
				{
					title: "Failed to run pnpm test billing",
					status: "error",
					output: `FAIL tests/billing/meter.test.ts
Error: Cannot find module '@/lib/billing/meter'`,
				},
			],
		},
	},
];

function countIn(states: AgentStates, state: AgentState): number {
	return AGENT_IDS.filter((id: AgentId): boolean => states[id] === state).length;
}

function lineStatus(state: AgentState): TraceLineStatus | undefined {
	if (state === "running") {
		return "running";
	}
	return state === "failed" ? "error" : undefined;
}

function summaryOf(running: number, failed: number): string {
	const parts = [`${running > 0 ? "Running" : "Ran"} ${String(AGENTS.length)} subagents`];
	if (running > 0) {
		parts.push(`${String(running)} still working`);
	}
	if (failed > 0) {
		parts.push(`${String(failed)} failed`);
	}
	return parts.join(", ");
}

function statusText(states: AgentStates): string {
	if (states.implementer === "running") {
		return "Retry opens once Implementer finishes";
	}
	if (states.tests === "failed") {
		return "lib/billing/meter.ts exists now";
	}
	return states.tests === "running" ? "Retrying test writer" : "All subagents finished";
}

// The parent status is derived from the children on every render, so it can
// never disagree with them.
export function Trace4Example(): React.JSX.Element {
	const [states, setStates] = React.useState<AgentStates>(INITIAL_STATES);

	const statusRef = React.useRef<HTMLParagraphElement>(null);
	const canRetry = states.tests === "failed" && states.implementer === "done";
	const running = countIn(states, "running");
	const failed = countIn(states, "failed");

	React.useEffect((): (() => void) | undefined => {
		const ids = AGENT_IDS.filter((id: AgentId): boolean => states[id] === "running");
		if (ids.length === 0) {
			return undefined;
		}
		// Stands in for the subagent's own completion event.
		const timer = window.setTimeout((): void => {
			setStates((current: AgentStates): AgentStates => {
				const next: Record<AgentId, AgentState> = { ...current };
				for (const id of ids) {
					next[id] = "done";
				}
				return next;
			});
		}, SUBAGENT_RUN_MS);
		return (): void => {
			window.clearTimeout(timer);
		};
	}, [states]);

	// The button disables itself, so focus moves to the status line.
	const handleRetry = React.useCallback((): void => {
		setStates((current: AgentStates): AgentStates => ({ ...current, tests: "running" }));
		statusRef.current?.focus();
	}, []);

	return (
		<div className="flex w-full max-w-md flex-col gap-3 text-sm">
			<Trace>
				<TraceCollapsible defaultOpen>
					<TraceCollapsibleTrigger>
						<TraceLine status={running > 0 ? "running" : failed > 0 ? "error" : undefined}>
							<TraceIcon>
								<WorkflowIcon />
							</TraceIcon>
							<TraceTitle>{summaryOf(running, failed)}</TraceTitle>
						</TraceLine>
					</TraceCollapsibleTrigger>
					<TraceCollapsibleContent keepMounted>
						<Trace>
							{AGENTS.map((agent: Subagent): React.JSX.Element => (
								<AgentRow key={agent.id} agent={agent} state={states[agent.id]} />
							))}
						</Trace>
					</TraceCollapsibleContent>
				</TraceCollapsible>
			</Trace>
			<div className="flex items-center gap-3">
				<Button size="sm" variant="outline" disabled={!canRetry} onClick={handleRetry}>
					Retry test writer
				</Button>
				<p ref={statusRef} role="status" tabIndex={-1} className="min-w-0 text-xs text-muted-foreground outline-none">
					{statusText(states)}
				</p>
			</div>
		</div>
	);
}

interface AgentRowProps {
	readonly agent: Subagent;
	readonly state: AgentState;
}

function AgentRow({ agent, state }: AgentRowProps): React.JSX.Element {
	const calls = agent.calls[state];
	return (
		<TraceCollapsible>
			<TraceCollapsibleTrigger>
				<TraceLine status={lineStatus(state)}>
					<TraceIcon>
						<BotIcon />
					</TraceIcon>
					<TraceTitle>{agent.title[state]}</TraceTitle>
					<TraceDescription>{calls.length} calls</TraceDescription>
				</TraceLine>
			</TraceCollapsibleTrigger>
			<TraceCollapsibleContent keepMounted>
				<div className="flex flex-col gap-2">
					<Trace>
						{calls.map((call: Call): React.JSX.Element =>
							call.output === undefined ? (
								<CallLine key={call.title} call={call} />
							) : (
								<TraceCollapsible key={call.title} defaultOpen>
									<TraceCollapsibleTrigger>
										<CallLine call={call} />
									</TraceCollapsibleTrigger>
									<TraceCollapsibleContent>
										<CodeBlock code={call.output} language="bash" lineLevels={OUTPUT_LEVELS} label={call.title} wrap />
									</TraceCollapsibleContent>
								</TraceCollapsible>
							),
						)}
					</Trace>
					{state === "done" && agent.result !== undefined ? <p className="text-pretty">{agent.result}</p> : null}
				</div>
			</TraceCollapsibleContent>
		</TraceCollapsible>
	);
}

interface CallLineProps {
	readonly call: Call;
}

function CallLine({ call }: CallLineProps): React.JSX.Element {
	return (
		<TraceLine status={call.status}>
			<TraceIcon>
				<TerminalIcon />
			</TraceIcon>
			<TraceTitle>{call.title}</TraceTitle>
			{call.description === undefined ? null : <TraceDescription>{call.description}</TraceDescription>}
		</TraceLine>
	);
}
