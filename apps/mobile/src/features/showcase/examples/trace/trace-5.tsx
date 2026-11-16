import { Button } from "@workspace/ui-native/components/button";
import type { LucideIcon } from "@workspace/ui-native/components/icon";
import { Trace, TraceLine, TraceStep, type TraceLineStatus } from "@workspace/ui-native/components/trace";
import ListChecksIcon from "lucide-react-native/icons/list-checks";
import PencilIcon from "lucide-react-native/icons/pencil";
import PlusIcon from "lucide-react-native/icons/plus";
import RefreshCwIcon from "lucide-react-native/icons/refresh-cw";
import Trash2Icon from "lucide-react-native/icons/trash-2";
import * as React from "react";
import { Text, View } from "react-native";

type Action = "create" | "update" | "destroy";

/** Every action, in the order terraform reports them. */
const ACTIONS: readonly Action[] = ["create", "update", "destroy"];

interface Change {
	readonly action: Action;
	readonly address: string;
	readonly detail?: string | undefined;
}

const CHANGES: readonly Change[] = [
	{ action: "create", address: "aws_sqs_queue.invoices" },
	{ action: "update", address: "aws_lambda_function.invoices", detail: "+512 MB" },
	{ action: "destroy", address: "aws_sqs_queue.invoices_v1" },
];

/** How long the demo apply spends on each resource. */
const APPLY_STEP_DELAY_MS = 900;

type Tense = "plan" | "done";

const COUNT_WORDS: Readonly<Record<Action, Readonly<Record<Tense, string>>>> = {
	create: { plan: "to add", done: "added" },
	update: { plan: "to change", done: "changed" },
	destroy: { plan: "to destroy", done: "destroyed" },
};

/** The symbols terraform prints beside each resource. */
const ACTION_SYMBOLS: Readonly<Record<Action, string>> = { create: "+", update: "~", destroy: "-" };

interface ActionWords {
	readonly icon: LucideIcon;
	readonly plan: string;
	readonly running: string;
	readonly done: string;
}

const VERBS: Readonly<Record<Action, ActionWords>> = {
	create: { icon: PlusIcon, plan: "Create", running: "Creating", done: "Created" },
	update: { icon: PencilIcon, plan: "Update", running: "Updating", done: "Updated" },
	destroy: { icon: Trash2Icon, plan: "Destroy", running: "Destroying", done: "Destroyed" },
};

function countOf(action: Action): number {
	return CHANGES.filter((change: Change): boolean => change.action === action).length;
}

/** The actions this plan actually contains. */
const PRESENT_ACTIONS: readonly Action[] = ACTIONS.filter((action: Action): boolean => countOf(action) > 0);

/** "1 to add, 1 to change, 1 to destroy", the summary terraform itself prints. */
function countLine(tense: Tense): string {
	return PRESENT_ACTIONS.map((action: Action): string => `${String(countOf(action))} ${COUNT_WORDS[action][tense]}`).join(", ");
}

/** "+1 ~1 -1", the symbols terraform prints beside each resource. */
const COUNT_SYMBOLS = PRESENT_ACTIONS.map((action: Action): string => `${ACTION_SYMBOLS[action]}${String(countOf(action))}`).join(" ");

type Phase = "review" | "applying" | "applied" | "denied";

const CHANGE_COUNT = String(CHANGES.length);

const SUMMARIES: Readonly<Record<Phase, string>> = {
	review: `Planned ${CHANGE_COUNT} changes`,
	applying: `Applying ${CHANGE_COUNT} changes`,
	applied: `Applied ${CHANGE_COUNT} changes`,
	denied: `Planned ${CHANGE_COUNT} changes, apply denied`,
};

const DESTROYED_ADDRESSES = CHANGES.filter((change: Change): boolean => change.action === "destroy")
	.map((change: Change): string => change.address)
	.join(", ");

function statusText(phase: Phase, applied: number): string {
	if (phase === "applying") {
		return `Applied ${String(applied)} of ${CHANGE_COUNT}`;
	}
	if (phase === "applied") {
		return `Apply complete: ${countLine("done")}.`;
	}
	return "Apply denied. Nothing was changed.";
}

function changeStatus(isDone: boolean, isRunning: boolean): TraceLineStatus | undefined {
	if (isRunning) {
		return "running";
	}
	return isDone ? undefined : "pending";
}

function ChangeLine({ change, isDone, isRunning }: { readonly change: Change; readonly isDone: boolean; readonly isRunning: boolean }): React.JSX.Element {
	const words = VERBS[change.action];
	const verb = isDone ? words.done : isRunning ? words.running : words.plan;
	return <TraceLine icon={words.icon} title={`${verb} ${change.address}`} description={change.detail} status={changeStatus(isDone, isRunning)} />;
}

// The planned rows are the rows that apply: each moves from pending to running to done in place.
export function Trace5Example(): React.JSX.Element {
	const [phase, setPhase] = React.useState<Phase>("review");
	const [applied, setApplied] = React.useState(0);

	React.useEffect((): (() => void) | undefined => {
		if (phase !== "applying") {
			return undefined;
		}
		const timer = setTimeout((): void => {
			const next = applied + 1;
			setApplied(next);
			if (next === CHANGES.length) {
				setPhase("applied");
			}
		}, APPLY_STEP_DELAY_MS);
		return (): void => {
			clearTimeout(timer);
		};
	}, [phase, applied]);

	const deny = React.useCallback((): void => {
		setPhase("denied");
	}, []);
	const apply = React.useCallback((): void => {
		setPhase("applying");
	}, []);
	const planAgain = React.useCallback((): void => {
		setApplied(0);
		setPhase("review");
	}, []);

	return (
		<View className="gap-4">
			<Trace>
				<TraceLine icon={RefreshCwIcon} title="Refreshed state for 42 resources" description="11s" />
				{/* Terraform's own symbols keep the row short; the words are what a screen reader hears. */}
				<TraceStep
					icon={ListChecksIcon}
					title={SUMMARIES[phase]}
					description={COUNT_SYMBOLS}
					accessibilityLabel={`${SUMMARIES[phase]}, ${countLine(phase === "applied" ? "done" : "plan")}`}
					status={phase === "applying" ? "running" : undefined}
					defaultOpen>
					<Trace>
						{CHANGES.map((change: Change, index: number): React.JSX.Element => (
							<ChangeLine key={change.address} change={change} isDone={index < applied} isRunning={phase === "applying" ? index === applied : false} />
						))}
					</Trace>
				</TraceStep>
			</Trace>
			{/* A pending approval is a question for the reader, not activity: a card outside the trace. */}
			{phase === "review" ? (
				<View className="rounded-card gap-3 border border-border p-3">
					<View className="gap-1">
						<Text className="text-label font-sans-medium text-foreground">{`Apply ${CHANGE_COUNT} changes to production?`}</Text>
						<Text className="text-caption font-sans text-muted-foreground">{`Destroys ${DESTROYED_ADDRESSES}.`}</Text>
					</View>
					<View className="flex-row justify-end gap-2">
						<Button label="Deny" size="sm" variant="outline" onPress={deny} />
						<Button label="Apply" size="sm" onPress={apply} />
					</View>
				</View>
			) : (
				<View className="flex-row items-center gap-3">
					{phase === "applying" ? null : <Button label="Plan again" size="sm" variant="outline" onPress={planAgain} />}
					<Text accessibilityLiveRegion="polite" className="text-caption shrink font-sans text-muted-foreground">
						{statusText(phase, applied)}
					</Text>
				</View>
			)}
		</View>
	);
}
