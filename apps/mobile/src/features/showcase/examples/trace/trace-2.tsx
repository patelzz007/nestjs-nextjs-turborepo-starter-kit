import { Button } from "@workspace/ui-native/components/button";
import { CodeBlock, type CodeBlockLineMark } from "@workspace/ui-native/components/code-block";
import type { LucideIcon } from "@workspace/ui-native/components/icon";
import { Trace, TraceLine, TraceStep } from "@workspace/ui-native/components/trace";
import BrainIcon from "lucide-react-native/icons/brain";
import CircleStopIcon from "lucide-react-native/icons/circle-stop";
import PencilIcon from "lucide-react-native/icons/pencil";
import ScrollTextIcon from "lucide-react-native/icons/scroll-text";
import TerminalIcon from "lucide-react-native/icons/terminal";
import * as React from "react";
import { Text, View } from "react-native";

interface TextDetail {
	readonly type: "text";
	readonly text: string;
}

interface CodeDetail {
	readonly type: "code";
	readonly code: string;
	readonly language: string;
	readonly marks?: readonly CodeBlockLineMark[] | undefined;
}

interface Step {
	readonly id: string;
	readonly icon: LucideIcon;
	readonly running: string;
	readonly done: string;
	readonly stopped: string;
	readonly description?: string | undefined;
	/** How long the demo spends on the step once its output is ready. */
	readonly ms: number;
	readonly detail?: TextDetail | CodeDetail | undefined;
}

/** Reasoning streams in this many characters at a time; tool steps resolve whole. */
const REASONING_CHARS_PER_TICK = 3;
/** Delay between streamed reasoning chunks. */
const REASONING_TICK_MS = 24;

const REASONING = "A 502 means the function crashed or timed out. The logs will say which.";

const STEPS: readonly Step[] = [
	{ id: "think", icon: BrainIcon, running: "Thinking", done: "Thought for 4s", stopped: "Stopped while thinking", ms: 600, detail: { type: "text", text: REASONING } },
	{
		id: "logs",
		icon: ScrollTextIcon,
		running: "Searching logs for POST /api/checkout",
		done: "Searched logs for POST /api/checkout",
		stopped: "Stopped searching logs",
		description: "38 errors",
		ms: 1600,
		detail: {
			type: "code",
			language: "bash",
			marks: [
				{ line: 2, kind: "error" },
				{ line: 3, kind: "error" },
			],
			code: `14:02:11 POST /api/checkout 200 412ms
14:02:19 POST /api/checkout 502 10.0s
14:02:19 Task timed out after 10s`,
		},
	},
	{
		id: "edit",
		icon: PencilIcon,
		running: "Editing app/api/checkout/route.ts",
		done: "Edited app/api/checkout/route.ts",
		stopped: "Stopped editing app/api/checkout/route.ts",
		description: "+3 -1",
		ms: 1800,
		detail: {
			type: "code",
			language: "typescript",
			marks: [
				{ line: 1, kind: "removed" },
				{ line: 2, kind: "added" },
				{ line: 3, kind: "added" },
				{ line: 4, kind: "added" },
			],
			code: `const rates = await shipping.quote(cart)
const rates = await shipping.quote(cart, {
  signal: AbortSignal.timeout(3000),
})`,
		},
	},
	{
		id: "test",
		icon: TerminalIcon,
		running: "Running pnpm test checkout",
		done: "Ran pnpm test checkout",
		stopped: "Stopped pnpm test checkout",
		description: "9 passed",
		ms: 2200,
		detail: { type: "code", language: "bash", code: "✓ checkout/route.test.ts (9 tests)\nTests  9 passed" },
	},
];

type RunState = "running" | "stopped" | "done";

function statusText(state: RunState): string {
	if (state === "done") {
		return `Finished in ${String(STEPS.length)} steps`;
	}
	return state === "stopped" ? "Stopped by you" : "Working";
}

function StepDetail({
	step,
	detail,
	isLive,
	chars,
}: {
	readonly step: Step;
	readonly detail: TextDetail | CodeDetail;
	readonly isLive: boolean;
	readonly chars: number;
}): React.JSX.Element {
	if (detail.type === "text") {
		return <Text className="text-label font-sans text-muted-foreground">{isLive ? detail.text.slice(0, chars) : detail.text}</Text>;
	}
	return <CodeBlock code={detail.code} language={detail.language} lineMarks={detail.marks} caption={`Output of ${step.done}`} />;
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
	const isLive = isCurrent && runState === "running";
	const wasStopped = isCurrent && runState === "stopped";
	const toggle = React.useCallback(
		(open: boolean): void => {
			onToggle(step.id, open);
		},
		[onToggle, step.id],
	);
	const title = isLive ? step.running : wasStopped ? step.stopped : step.done;
	const icon = wasStopped ? CircleStopIcon : step.icon;
	const description = isLive || wasStopped ? undefined : step.description;
	const status = isLive ? "running" : undefined;
	const { detail } = step;
	const hasDetail = detail !== undefined && (isFinished || (isLive && detail.type === "text"));
	if (!hasDetail || wasStopped) {
		return <TraceLine icon={icon} title={title} description={description} status={status} />;
	}
	// A live step opens itself; once the reader toggles it, their choice wins.
	return (
		<TraceStep icon={icon} title={title} description={description} status={status} open={toggledOpen ?? isLive} onOpenChange={toggle}>
			<StepDetail step={step} detail={detail} isLive={isLive} chars={chars} />
		</TraceStep>
	);
}

export function Trace2Example(): React.JSX.Element {
	const [state, setState] = React.useState<RunState>("running");
	const [finished, setFinished] = React.useState(0);
	const [chars, setChars] = React.useState(0);
	const [openById, setOpenById] = React.useState<Readonly<Record<string, boolean>>>({});

	const live = state === "running" ? STEPS.at(finished) : undefined;

	React.useEffect((): (() => void) | undefined => {
		if (live === undefined) {
			return undefined;
		}
		const { detail } = live;
		if (detail?.type === "text" && chars < detail.text.length) {
			const tick = setTimeout((): void => {
				setChars((value: number): number => value + REASONING_CHARS_PER_TICK);
			}, REASONING_TICK_MS);
			return (): void => {
				clearTimeout(tick);
			};
		}
		const timer = setTimeout((): void => {
			const next = finished + 1;
			setFinished(next);
			if (next === STEPS.length) {
				setState("done");
			}
		}, live.ms);
		return (): void => {
			clearTimeout(timer);
		};
	}, [live, chars, finished]);

	const toggle = React.useCallback((id: string, open: boolean): void => {
		setOpenById((current: Readonly<Record<string, boolean>>): Readonly<Record<string, boolean>> => ({ ...current, [id]: open }));
	}, []);

	const stopOrRestart = React.useCallback((): void => {
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
		<View className="gap-4">
			<Trace accessibilityLabel="Agent run">
				{shown.map((step: Step, index: number): React.JSX.Element => (
					<StepRow
						key={step.id}
						step={step}
						runState={state}
						isCurrent={index === finished}
						isFinished={index < finished}
						chars={chars}
						toggledOpen={openById[step.id]}
						onToggle={toggle}
					/>
				))}
			</Trace>
			<View className="flex-row items-center gap-3">
				<Button label={state === "running" ? "Stop" : "Run again"} size="sm" variant="outline" onPress={stopOrRestart} />
				<Text accessibilityLiveRegion="polite" className="text-caption font-sans text-muted-foreground">
					{statusText(state)}
				</Text>
			</View>
		</View>
	);
}
