"use client";

import { ListChecksIcon, PencilIcon, PlusIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";
import * as React from "react";

import { Button } from "@workspace/ui/components/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@workspace/ui/components/item";
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

type Action = "create" | "update" | "destroy";

/** Every action, in the order terraform reports them. */
const ACTIONS: readonly Action[] = ["create", "update", "destroy"];

interface Change {
	readonly action: Action;
	readonly address: string;
	readonly detail?: string;
}

const CHANGES: readonly Change[] = [
	{ action: "create", address: "aws_sqs_queue.invoices" },
	{ action: "update", address: "aws_lambda_function.invoices", detail: "+512 MB" },
	{ action: "destroy", address: "aws_sqs_queue.invoices_v1" },
];

/** How long the demo "apply" spends on each resource. */
const APPLY_STEP_DELAY_MS = 900;

type Tense = "plan" | "done";

const COUNT_WORDS: Readonly<Record<Action, Readonly<Record<Tense, string>>>> = {
	create: { plan: "to add", done: "added" },
	update: { plan: "to change", done: "changed" },
	destroy: { plan: "to destroy", done: "destroyed" },
};

/** The symbols terraform prints beside each resource. */
const ACTION_SYMBOLS: Readonly<Record<Action, string>> = {
	create: "+",
	update: "~",
	destroy: "-",
};

function countOf(action: Action): number {
	return CHANGES.filter((change: Change): boolean => change.action === action).length;
}

/** The actions this plan actually contains. */
function presentActions(): readonly Action[] {
	return ACTIONS.filter((action: Action): boolean => countOf(action) > 0);
}

// "1 to add, 1 to change, 1 to destroy", the summary terraform itself prints.
function countLine(tense: Tense): string {
	return presentActions()
		.map((action: Action): string => `${String(countOf(action))} ${COUNT_WORDS[action][tense]}`)
		.join(", ");
}

// "+1 ~1 -1", the symbols terraform prints beside each resource.
function countSymbols(): string {
	return presentActions()
		.map((action: Action): string => `${ACTION_SYMBOLS[action]}${String(countOf(action))}`)
		.join(" ");
}

const VERBS: Readonly<Record<Action, [plan: string, running: string, done: string]>> = {
	create: ["Create", "Creating", "Created"],
	update: ["Update", "Updating", "Updated"],
	destroy: ["Destroy", "Destroying", "Destroyed"],
};

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

// The planned rows are the rows that apply: each moves from pending to running
// to done in place.
export function Trace5Example(): React.JSX.Element {
	const [phase, setPhase] = React.useState<Phase>("review");
	const [applied, setApplied] = React.useState(0);
	const statusRef = React.useRef<HTMLParagraphElement>(null);
	const applyRef = React.useRef<HTMLButtonElement>(null);

	React.useEffect((): (() => void) | undefined => {
		if (phase !== "applying") {
			return undefined;
		}
		const timer = window.setTimeout((): void => {
			const next = applied + 1;
			setApplied(next);
			if (next === CHANGES.length) {
				setPhase("applied");
			}
		}, APPLY_STEP_DELAY_MS);
		return (): void => {
			window.clearTimeout(timer);
		};
	}, [phase, applied]);

	// The prompt unmounts on either answer, so focus moves to the line that
	// reports what the answer did.
	const answer = React.useCallback((next: Phase): void => {
		setPhase(next);
		window.requestAnimationFrame((): void => {
			statusRef.current?.focus();
		});
	}, []);

	const handleDeny = React.useCallback((): void => {
		answer("denied");
	}, [answer]);

	const handleApply = React.useCallback((): void => {
		answer("applying");
	}, [answer]);

	const handlePlanAgain = React.useCallback((): void => {
		setApplied(0);
		setPhase("review");
		// This button unmounts with the phase it belongs to, so focus moves to
		// Apply on the prompt that replaces it.
		window.requestAnimationFrame((): void => {
			applyRef.current?.focus();
		});
	}, []);

	return (
		<div className="flex w-full max-w-md flex-col gap-4 text-sm">
			<Trace>
				<TraceLine>
					<TraceIcon>
						<RefreshCwIcon />
					</TraceIcon>
					<TraceTitle>Refreshed state for 42 resources</TraceTitle>
					<TraceDescription>11s</TraceDescription>
				</TraceLine>
				<TraceCollapsible defaultOpen>
					<TraceCollapsibleTrigger>
						<TraceLine status={phase === "applying" ? "running" : undefined}>
							<TraceIcon>
								<ListChecksIcon />
							</TraceIcon>
							<TraceTitle>{SUMMARIES[phase]}</TraceTitle>
							{/* Terraform's own change symbols keep the row short; the
							    words are what a screen reader hears. */}
							<TraceDescription>
								<span aria-hidden="true">{countSymbols()}</span>
								<span className="sr-only">{countLine(phase === "applied" ? "done" : "plan")}</span>
							</TraceDescription>
						</TraceLine>
					</TraceCollapsibleTrigger>
					<TraceCollapsibleContent>
						<Trace>
							{CHANGES.map((change: Change, index: number): React.JSX.Element => {
								const isRunning = phase === "applying" && index === applied;
								return <ChangeLine key={change.address} change={change} isDone={index < applied} isRunning={isRunning} />;
							})}
						</Trace>
					</TraceCollapsibleContent>
				</TraceCollapsible>
			</Trace>
			{/* A pending approval is a question for the reader, not activity, so
			    it is an Item outside the trace rather than one more row. */}
			{phase === "review" ? (
				<Item variant="outline" size="sm">
					<ItemContent>
						<ItemTitle>Apply {CHANGE_COUNT} changes to production?</ItemTitle>
						<ItemDescription>Destroys {DESTROYED_ADDRESSES}.</ItemDescription>
					</ItemContent>
					<ItemActions>
						<Button size="sm" variant="outline" onClick={handleDeny}>
							Deny
						</Button>
						<Button ref={applyRef} size="sm" onClick={handleApply}>
							Apply
						</Button>
					</ItemActions>
				</Item>
			) : null}
			{phase === "review" ? null : (
				<div className="flex items-center gap-3">
					{phase === "applying" ? null : (
						<Button size="sm" variant="outline" onClick={handlePlanAgain}>
							Plan again
						</Button>
					)}
					<p ref={statusRef} role="status" tabIndex={-1} className="text-xs text-muted-foreground outline-none">
						{statusText(phase, applied)}
					</p>
				</div>
			)}
		</div>
	);
}

interface ChangeLineProps {
	readonly change: Change;
	readonly isDone: boolean;
	readonly isRunning: boolean;
}

function changeStatus(isDone: boolean, isRunning: boolean): TraceLineStatus | undefined {
	if (isRunning) {
		return "running";
	}
	return isDone ? undefined : "pending";
}

function ChangeLine({ change, isDone, isRunning }: ChangeLineProps): React.JSX.Element {
	const [plan, running, done] = VERBS[change.action];
	const verb = isDone ? done : isRunning ? running : plan;
	return (
		<TraceLine status={changeStatus(isDone, isRunning)}>
			<TraceIcon>
				<ActionGlyph action={change.action} />
			</TraceIcon>
			<TraceTitle>
				{verb} <span className="font-mono">{change.address}</span>
			</TraceTitle>
			{change.detail === undefined ? null : <TraceDescription>{change.detail}</TraceDescription>}
		</TraceLine>
	);
}

interface ActionGlyphProps {
	readonly action: Action;
}

function ActionGlyph({ action }: ActionGlyphProps): React.JSX.Element {
	if (action === "create") {
		return <PlusIcon />;
	}
	if (action === "update") {
		return <PencilIcon />;
	}
	return <Trash2Icon />;
}
