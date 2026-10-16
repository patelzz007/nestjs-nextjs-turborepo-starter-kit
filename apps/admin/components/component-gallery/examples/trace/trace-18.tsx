"use client";

import { CircleCheckIcon, CircleXIcon } from "lucide-react";
import * as React from "react";

import { Label } from "@workspace/ui/components/label";
import { Switch } from "@workspace/ui/components/switch";
import { Trace, TraceCollapsible, TraceCollapsibleContent, TraceCollapsibleTrigger, TraceDescription, TraceIcon, TraceLine, TraceTitle } from "@workspace/ui/components/trace";

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
	readonly review?: CaseReview;
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
		review: {
			expected: "A new jug or a 40% refund",
			got: "A full refund once returned",
			judge: "Policy 3.1 keeps full refunds for items that do not work.",
		},
	},
	{ id: "c04", name: "Refund request in German", score: 0.92 },
	{
		id: "c07",
		name: "Chargeback already opened",
		score: 0.18,
		review: {
			expected: "Hand off to billing",
			got: "Refunded on top of the dispute",
			judge: "Refunding during a chargeback pays the customer twice.",
		},
	},
];

const FAILED = CASES.filter((item: Case): boolean => item.score < PASS_MARK);
const [FIRST_FAILURE] = FAILED;
const HIDDEN_PASSES = TOTAL - CASES.length;

// A failure opens to a compact expected, got and judge list.
export function Trace18Example(): React.JSX.Element {
	const [failuresOnly, setFailuresOnly] = React.useState(false);
	const shown = failuresOnly ? FAILED : CASES;

	return (
		<div className="flex w-full max-w-md flex-col gap-4 text-sm">
			<div className="flex items-center gap-2">
				<Switch id="failures-only" size="sm" checked={failuresOnly} onCheckedChange={setFailuresOnly} />
				<Label htmlFor="failures-only">Failures only</Label>
			</div>
			<Trace>
				{shown.map((item: Case): React.JSX.Element => (
					<CaseRow key={item.id} item={item} />
				))}
				{failuresOnly ? null : (
					<TraceLine>
						<TraceTitle>{HIDDEN_PASSES} more cases passed</TraceTitle>
					</TraceLine>
				)}
			</Trace>
		</div>
	);
}

interface CaseRowProps {
	readonly item: Case;
}

function CaseRow({ item }: CaseRowProps): React.JSX.Element {
	const score = item.score.toFixed(SCORE_DECIMALS);
	if (item.score >= PASS_MARK) {
		return (
			<TraceLine>
				<TraceIcon>
					<CircleCheckIcon />
				</TraceIcon>
				<TraceTitle>{item.name}</TraceTitle>
				<TraceDescription>{score}</TraceDescription>
			</TraceLine>
		);
	}
	const { review } = item;
	return (
		<TraceCollapsible defaultOpen={item.id === FIRST_FAILURE?.id}>
			<TraceCollapsibleTrigger>
				<TraceLine status="error">
					<TraceIcon>
						<CircleXIcon />
					</TraceIcon>
					<TraceTitle>Failed: {item.name}</TraceTitle>
					<TraceDescription>{score}</TraceDescription>
				</TraceLine>
			</TraceCollapsibleTrigger>
			<TraceCollapsibleContent>
				{review === undefined ? null : (
					<dl className="flex flex-col gap-1 text-xs">
						{REVIEW_FIELDS.map((field: ReviewField): React.JSX.Element => (
							<div key={field.key} className="flex gap-3">
								<dt className="w-14 shrink-0">{field.label}</dt>
								<dd className="min-w-0 text-foreground">{review[field.key]}</dd>
							</div>
						))}
					</dl>
				)}
			</TraceCollapsibleContent>
		</TraceCollapsible>
	);
}
