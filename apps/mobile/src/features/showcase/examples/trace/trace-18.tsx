import { Switch } from "@workspace/ui-native/components/switch";
import { Trace, TraceLine, TraceStep } from "@workspace/ui-native/components/trace";
import CircleCheckIcon from "lucide-react-native/icons/circle-check";
import CircleXIcon from "lucide-react-native/icons/circle-x";
import * as React from "react";
import { Text, View } from "react-native";

/** What the grader recorded for a failed case. */
interface CaseReview {
	readonly expected: string;
	readonly got: string;
	readonly judge: string;
}

interface Case {
	readonly id: string;
	readonly name: string;
	readonly score: number;
	readonly review?: CaseReview | undefined;
}

interface ReviewField {
	readonly label: string;
	readonly key: keyof CaseReview;
}

const REVIEW_FIELDS: readonly ReviewField[] = [
	{ label: "Expected", key: "expected" },
	{ label: "Got", key: "got" },
	{ label: "Judge", key: "judge" },
];

const PASS_MARK = 0.7;
const TOTAL = 48;
/** Scores print with two decimals, the way the eval harness reports them. */
const SCORE_DECIMALS = 2;

const CASES: readonly Case[] = [
	{ id: "c01", name: "Unopened item within 30 days", score: 0.98 },
	{
		id: "c03",
		name: "Damaged item refund",
		score: 0.31,
		review: { expected: "A new jug or a 40% refund", got: "A full refund once returned", judge: "Policy 3.1 keeps full refunds for items that do not work." },
	},
	{ id: "c04", name: "Refund request in German", score: 0.92 },
	{
		id: "c07",
		name: "Chargeback already opened",
		score: 0.18,
		review: { expected: "Hand off to billing", got: "Refunded on top of the dispute", judge: "Refunding during a chargeback pays the customer twice." },
	},
];

const FAILED = CASES.filter((item: Case): boolean => item.score < PASS_MARK);
const FIRST_FAILURE_ID = FAILED.at(0)?.id;
const HIDDEN_PASSES = TOTAL - CASES.length;

function CaseRow({ item }: { readonly item: Case }): React.JSX.Element {
	const score = item.score.toFixed(SCORE_DECIMALS);
	if (item.score >= PASS_MARK) {
		return <TraceLine icon={CircleCheckIcon} title={item.name} description={score} />;
	}
	const { review } = item;
	return (
		<TraceStep icon={CircleXIcon} title={`Failed: ${item.name}`} description={score} status="error" defaultOpen={item.id === FIRST_FAILURE_ID}>
			{review === undefined ? null : (
				<View className="gap-1">
					{REVIEW_FIELDS.map((field: ReviewField): React.JSX.Element => (
						<View key={field.key} className="flex-row gap-3">
							<Text className="text-caption w-14 font-sans text-muted-foreground">{field.label}</Text>
							<Text className="text-caption flex-1 font-sans text-foreground">{review[field.key]}</Text>
						</View>
					))}
				</View>
			)}
		</TraceStep>
	);
}

// A failure opens to a compact expected, got and judge list.
export function Trace18Example(): React.JSX.Element {
	const [failuresOnly, setFailuresOnly] = React.useState(false);
	const shown = failuresOnly ? FAILED : CASES;
	return (
		<View className="gap-4">
			<Switch label="Failures only" controlPosition="start" checked={failuresOnly} onChange={setFailuresOnly} />
			<Trace accessibilityLabel="Eval results">
				{shown.map((item: Case): React.JSX.Element => (
					<CaseRow key={item.id} item={item} />
				))}
				{failuresOnly ? null : <TraceLine title={`${String(HIDDEN_PASSES)} more cases passed`} />}
			</Trace>
		</View>
	);
}
