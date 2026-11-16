"use client";

import { BookOpenIcon, PackageIcon, SearchIcon, SparklesIcon, TruckIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@workspace/ui/components/button";
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

type LookupState = "pending" | "running" | "done";

interface Lookup {
	readonly id: string;
	readonly pending: string;
	readonly running: string;
	readonly done: string;
	readonly finding: string;
	readonly icon: "order" | "truck" | "policy";
}

const LOOKUPS: readonly Lookup[] = [
	{
		id: "order",
		pending: "Look up order #48213",
		running: "Looking up order #48213",
		done: "Looked up order #48213",
		finding: "Shipped Oct 9",
		icon: "order",
	},
	{
		id: "carrier",
		pending: "Check carrier tracking for 1Z84F0",
		running: "Checking carrier tracking for 1Z84F0",
		done: "Checked carrier tracking for 1Z84F0",
		finding: "Held at Louisville hub",
		icon: "truck",
	},
	{
		id: "policy",
		pending: "Read the late delivery policy",
		running: "Reading the late delivery policy",
		done: "Read the late delivery policy",
		finding: "Section 4.2",
		icon: "policy",
	},
];

const DRAFTS: readonly string[] = [
	"Hi Dana, your order is held in Louisville until Friday. I've refunded your $12 shipping.",
	"Hi Dana, a carrier delay holds your order until Friday. Your $12 shipping is refunded.",
];

/** How long the demo copilot spends on each lookup. */
const LOOKUP_DELAY_MS = 700;

const LOOKUP_COUNT = String(LOOKUPS.length);

const LINE_STATUS: Readonly<Record<LookupState, TraceLineStatus | undefined>> = {
	pending: "pending",
	running: "running",
	done: undefined,
};

function lookupState(index: number, finished: number): LookupState {
	if (index < finished) {
		return "done";
	}
	return index === finished ? "running" : "pending";
}

function statusText(busy: boolean, inserted: boolean): string {
	if (busy) {
		return "Drafting a new reply";
	}
	return inserted ? "Added to the composer" : "";
}

// The lookups fold into one row and the draft opens in the row after them.
export function Trace7Example(): React.JSX.Element {
	const [draft, setDraft] = React.useState(0);
	// Lookups finished in the current pass. Equal to LOOKUPS.length when idle.
	const [finished, setFinished] = React.useState(LOOKUPS.length);
	const [stepsOpen, setStepsOpen] = React.useState<boolean | undefined>(undefined);
	const [inserted, setInserted] = React.useState(false);
	const busy = finished < LOOKUPS.length;
	const statusRef = React.useRef<HTMLParagraphElement>(null);

	React.useEffect((): (() => void) | undefined => {
		if (!busy) {
			return undefined;
		}
		const timer = window.setTimeout((): void => {
			setFinished((count: number): number => count + 1);
		}, LOOKUP_DELAY_MS);
		return (): void => {
			window.clearTimeout(timer);
		};
	}, [busy, finished]);

	// Both buttons disable while a pass runs, so focus moves to the status line.
	const regenerate = React.useCallback((): void => {
		statusRef.current?.focus();
		setInserted(false);
		setStepsOpen(undefined);
		setFinished(0);
		setDraft((current: number): number => (current + 1) % DRAFTS.length);
	}, []);

	const insertReply = React.useCallback((): void => {
		setInserted(true);
	}, []);

	return (
		<div className="flex w-full max-w-md flex-col gap-4 text-sm">
			<Trace>
				{/* Open while the copilot works, folded once it is done, and the
				    agent's own click wins either way. */}
				<TraceCollapsible open={stepsOpen ?? busy} onOpenChange={setStepsOpen}>
					<TraceCollapsibleTrigger>
						<TraceLine status={busy ? "running" : undefined}>
							<TraceIcon>
								<SearchIcon />
							</TraceIcon>
							<TraceTitle>{busy ? "Checking the order" : "Checked the order and policy"}</TraceTitle>
							<TraceDescription>{busy ? `${String(finished)} of ${LOOKUP_COUNT}` : `${LOOKUP_COUNT} lookups`}</TraceDescription>
						</TraceLine>
					</TraceCollapsibleTrigger>
					<TraceCollapsibleContent>
						<Trace>
							{LOOKUPS.map((lookup: Lookup, index: number): React.JSX.Element => {
								const state = lookupState(index, finished);
								return (
									<TraceLine key={lookup.id} status={LINE_STATUS[state]}>
										<TraceIcon>
											<LookupGlyph icon={lookup.icon} />
										</TraceIcon>
										<TraceTitle>{lookup[state]}</TraceTitle>
										{state === "done" ? <TraceDescription>{lookup.finding}</TraceDescription> : null}
									</TraceLine>
								);
							})}
						</Trace>
					</TraceCollapsibleContent>
				</TraceCollapsible>
				{busy ? (
					<TraceLine status="pending">
						<TraceIcon>
							<SparklesIcon />
						</TraceIcon>
						<TraceTitle>Draft a reply to Dana</TraceTitle>
					</TraceLine>
				) : (
					<TraceCollapsible key={draft} defaultOpen>
						<TraceCollapsibleTrigger>
							<TraceLine>
								<TraceIcon>
									<SparklesIcon />
								</TraceIcon>
								<TraceTitle>Drafted a reply to Dana</TraceTitle>
							</TraceLine>
						</TraceCollapsibleTrigger>
						<TraceCollapsibleContent>
							{/* The reply is what gets sent, so it reads at full contrast
							    inside the muted panel. */}
							<p className="text-pretty text-foreground">{DRAFTS.at(draft)}</p>
						</TraceCollapsibleContent>
					</TraceCollapsible>
				)}
			</Trace>
			<div className="flex items-center gap-2">
				<Button size="sm" disabled={busy} onClick={insertReply}>
					Insert reply
				</Button>
				<Button size="sm" variant="outline" disabled={busy} onClick={regenerate}>
					Regenerate
				</Button>
				<p ref={statusRef} role="status" tabIndex={-1} className="ml-auto text-xs text-muted-foreground outline-none">
					{statusText(busy, inserted)}
				</p>
			</div>
		</div>
	);
}

interface LookupGlyphProps {
	readonly icon: Lookup["icon"];
}

function LookupGlyph({ icon }: LookupGlyphProps): React.JSX.Element {
	switch (icon) {
		case "order":
			return <PackageIcon />;
		case "truck":
			return <TruckIcon />;
		case "policy":
			return <BookOpenIcon />;
	}
}
