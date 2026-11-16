import { Button } from "@workspace/ui-native/components/button";
import { CodeBlock, type CodeBlockLineMark } from "@workspace/ui-native/components/code-block";
import { Trace, TraceLine, TraceStep, type TraceLineStatus } from "@workspace/ui-native/components/trace";
import BotIcon from "lucide-react-native/icons/bot";
import TerminalIcon from "lucide-react-native/icons/terminal";
import WorkflowIcon from "lucide-react-native/icons/workflow";
import * as React from "react";
import { Text, View } from "react-native";

type AgentState = "running" | "done" | "failed";
type AgentId = "explorer" | "implementer" | "tests";

const AGENT_IDS: readonly AgentId[] = ["explorer", "implementer", "tests"];

type AgentStates = Readonly<Record<AgentId, AgentState>>;

const INITIAL_STATES: AgentStates = { explorer: "done", implementer: "running", tests: "failed" };

/** Stands in for how long a running subagent takes to report back. */
const SUBAGENT_RUN_MS = 3_200;

interface Call {
	readonly title: string;
	readonly description?: string | undefined;
	readonly status?: "running" | "error" | undefined;
	readonly output?: string | undefined;
}

interface Subagent {
	readonly id: AgentId;
	readonly title: Readonly<Record<AgentState, string>>;
	readonly calls: Readonly<Record<AgentState, readonly Call[]>>;
	readonly result?: string | undefined;
}

/** The failing output's error line. */
const OUTPUT_MARKS: readonly CodeBlockLineMark[] = [{ line: 2, kind: "error" }];

const EXPLORER_CALLS: readonly Call[] = [{ title: "Searched for seatPrice", description: "9 results" }, { title: "Read lib/billing/plans.ts" }];

const AGENTS: readonly Subagent[] = [
	{
		id: "explorer",
		title: { running: "Explorer is mapping the billing code", done: "Explorer mapped the billing code", failed: "Explorer failed" },
		calls: { running: EXPLORER_CALLS, done: EXPLORER_CALLS, failed: [] },
		result: "Found 3 fixed seat prices: plans.ts, the webhook and the invoice preview.",
	},
	{
		id: "implementer",
		title: { running: "Implementer is editing 2 files", done: "Implementer edited 2 files", failed: "Implementer failed" },
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
		title: { running: "Test writer is running the billing suite", done: "Test writer added 6 passing tests", failed: "Test writer's suite did not compile" },
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
				{ title: "Failed to run pnpm test billing", status: "error", output: "FAIL tests/billing/meter.test.ts\nError: Cannot find module '@/lib/billing/meter'" },
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

function CallRow({ call }: { readonly call: Call }): React.JSX.Element {
	if (call.output === undefined) {
		return <TraceLine icon={TerminalIcon} title={call.title} description={call.description} status={call.status} />;
	}
	return (
		<TraceStep icon={TerminalIcon} title={call.title} description={call.description} status={call.status} defaultOpen>
			<CodeBlock code={call.output} language="bash" lineMarks={OUTPUT_MARKS} caption={call.title} wrap />
		</TraceStep>
	);
}

function AgentRow({ agent, state }: { readonly agent: Subagent; readonly state: AgentState }): React.JSX.Element {
	const calls = agent.calls[state];
	return (
		<TraceStep icon={BotIcon} title={agent.title[state]} description={`${String(calls.length)} calls`} status={lineStatus(state)}>
			<Trace>
				{calls.map((call: Call): React.JSX.Element => (
					<CallRow key={call.title} call={call} />
				))}
			</Trace>
			{state === "done" && agent.result !== undefined ? <Text className="text-label font-sans text-muted-foreground">{agent.result}</Text> : null}
		</TraceStep>
	);
}

// The parent's status is derived from its children on every render, so it can never disagree with them.
export function Trace4Example(): React.JSX.Element {
	const [states, setStates] = React.useState<AgentStates>(INITIAL_STATES);
	const canRetry = states.tests === "failed" && states.implementer === "done";
	const running = countIn(states, "running");
	const failed = countIn(states, "failed");

	React.useEffect((): (() => void) | undefined => {
		const ids = AGENT_IDS.filter((id: AgentId): boolean => states[id] === "running");
		if (ids.length === 0) {
			return undefined;
		}
		// Stands in for the subagent's own completion event.
		const timer = setTimeout((): void => {
			setStates((current: AgentStates): AgentStates => {
				const next: Record<AgentId, AgentState> = { ...current };
				for (const id of ids) {
					next[id] = "done";
				}
				return next;
			});
		}, SUBAGENT_RUN_MS);
		return (): void => {
			clearTimeout(timer);
		};
	}, [states]);

	const retry = React.useCallback((): void => {
		setStates((current: AgentStates): AgentStates => ({ ...current, tests: "running" }));
	}, []);

	return (
		<View className="gap-3">
			<Trace>
				<TraceStep icon={WorkflowIcon} title={summaryOf(running, failed)} status={running > 0 ? "running" : failed > 0 ? "error" : undefined} defaultOpen>
					<Trace>
						{AGENTS.map((agent: Subagent): React.JSX.Element => (
							<AgentRow key={agent.id} agent={agent} state={states[agent.id]} />
						))}
					</Trace>
				</TraceStep>
			</Trace>
			<View className="flex-row items-center gap-3">
				<Button label="Retry test writer" size="sm" variant="outline" disabled={!canRetry} onPress={retry} />
				<Text accessibilityLiveRegion="polite" className="text-caption shrink font-sans text-muted-foreground">
					{statusText(states)}
				</Text>
			</View>
		</View>
	);
}
