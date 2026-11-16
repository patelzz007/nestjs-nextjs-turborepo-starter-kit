import { Button } from "@workspace/ui-native/components/button";
import type { LucideIcon } from "@workspace/ui-native/components/icon";
import { Trace, TraceLine, TraceStep, type TraceLineStatus } from "@workspace/ui-native/components/trace";
import BookOpenIcon from "lucide-react-native/icons/book-open";
import PackageIcon from "lucide-react-native/icons/package";
import SearchIcon from "lucide-react-native/icons/search";
import SparklesIcon from "lucide-react-native/icons/sparkles";
import TruckIcon from "lucide-react-native/icons/truck";
import * as React from "react";
import { Text, View } from "react-native";

type LookupState = "pending" | "running" | "done";

interface Lookup {
	readonly id: string;
	readonly pending: string;
	readonly running: string;
	readonly done: string;
	readonly finding: string;
	readonly icon: LucideIcon;
}

const LOOKUPS: readonly Lookup[] = [
	{ id: "order", pending: "Look up order #48213", running: "Looking up order #48213", done: "Looked up order #48213", finding: "Shipped Oct 9", icon: PackageIcon },
	{
		id: "carrier",
		pending: "Check carrier tracking for 1Z84F0",
		running: "Checking carrier tracking for 1Z84F0",
		done: "Checked carrier tracking for 1Z84F0",
		finding: "Held at Louisville hub",
		icon: TruckIcon,
	},
	{
		id: "policy",
		pending: "Read the late delivery policy",
		running: "Reading the late delivery policy",
		done: "Read the late delivery policy",
		finding: "Section 4.2",
		icon: BookOpenIcon,
	},
];

const DRAFTS: readonly string[] = [
	"Hi Dana, your order is held in Louisville until Friday. I've refunded your $12 shipping.",
	"Hi Dana, a carrier delay holds your order until Friday. Your $12 shipping is refunded.",
];

/** How long the demo copilot spends on each lookup. */
const LOOKUP_DELAY_MS = 700;

const LOOKUP_COUNT = String(LOOKUPS.length);

const LINE_STATUS: Readonly<Record<LookupState, TraceLineStatus | undefined>> = { pending: "pending", running: "running", done: undefined };

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

// The lookups fold into one row, and the draft opens in the row after them.
export function Trace7Example(): React.JSX.Element {
	const [draft, setDraft] = React.useState(0);
	// Lookups finished in the current pass: all of them when idle.
	const [finished, setFinished] = React.useState(LOOKUPS.length);
	const [stepsOpen, setStepsOpen] = React.useState<boolean | undefined>(undefined);
	const [inserted, setInserted] = React.useState(false);
	const busy = finished < LOOKUPS.length;

	React.useEffect((): (() => void) | undefined => {
		if (!busy) {
			return undefined;
		}
		const timer = setTimeout((): void => {
			setFinished((count: number): number => count + 1);
		}, LOOKUP_DELAY_MS);
		return (): void => {
			clearTimeout(timer);
		};
	}, [busy, finished]);

	const regenerate = React.useCallback((): void => {
		setInserted(false);
		setStepsOpen(undefined);
		setFinished(0);
		setDraft((current: number): number => (current + 1) % DRAFTS.length);
	}, []);
	const insertReply = React.useCallback((): void => {
		setInserted(true);
	}, []);

	return (
		<View className="gap-4">
			<Trace>
				{/* Open while the copilot works, folded once it is done; the agent's own tap wins either way. */}
				<TraceStep
					icon={SearchIcon}
					title={busy ? "Checking the order" : "Checked the order and policy"}
					description={busy ? `${String(finished)} of ${LOOKUP_COUNT}` : `${LOOKUP_COUNT} lookups`}
					status={busy ? "running" : undefined}
					open={stepsOpen ?? busy}
					onOpenChange={setStepsOpen}>
					<Trace>
						{LOOKUPS.map((lookup: Lookup, index: number): React.JSX.Element => {
							const state = lookupState(index, finished);
							return (
								<TraceLine key={lookup.id} icon={lookup.icon} title={lookup[state]} description={state === "done" ? lookup.finding : undefined} status={LINE_STATUS[state]} />
							);
						})}
					</Trace>
				</TraceStep>
				{busy ? (
					<TraceLine icon={SparklesIcon} title="Draft a reply to Dana" status="pending" />
				) : (
					<TraceStep key={draft} icon={SparklesIcon} title="Drafted a reply to Dana" defaultOpen>
						{/* The reply is what gets sent, so it reads at full contrast. */}
						<Text className="text-label font-sans text-foreground">{DRAFTS.at(draft)}</Text>
					</TraceStep>
				)}
			</Trace>
			<View className="flex-row flex-wrap items-center gap-2">
				<Button label="Insert reply" size="sm" disabled={busy} onPress={insertReply} />
				<Button label="Regenerate" size="sm" variant="outline" disabled={busy} onPress={regenerate} />
				<Text accessibilityLiveRegion="polite" className="text-caption ml-auto font-sans text-muted-foreground">
					{statusText(busy, inserted)}
				</Text>
			</View>
		</View>
	);
}
