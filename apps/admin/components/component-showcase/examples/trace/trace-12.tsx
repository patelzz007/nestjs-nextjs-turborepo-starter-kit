import { LightbulbIcon } from "lucide-react";
import type * as React from "react";

import { Badge } from "@workspace/ui/components/badge";
import { CodeBlock } from "@workspace/ui/components/code-block";

import { Trace, TraceCollapsible, TraceCollapsibleContent, TraceCollapsibleTrigger, TraceDescription, TraceIcon, TraceLine, TraceTitle } from "@workspace/ui/components/trace";

interface PlanNode {
	readonly id: string;
	readonly op: string;
	readonly ms: number;
	// Only scans carry numbers here: they are where a plan is read for its cost.
	readonly details?: readonly (readonly [label: string, value: string])[];
	readonly children?: readonly PlanNode[];
}

/** A share of the total, as a whole percentage. */
const PERCENT = 100;

const TOTAL_MS = 798.1;

const PLAN: PlanNode = {
	id: "join",
	op: "Hash Join on customer_id",
	ms: TOTAL_MS,
	children: [
		{
			id: "orders",
			op: "Seq Scan on orders",
			ms: 641.7,
			details: [
				["Filter", "status = 'paid', last 30 days"],
				["Rows", "41,966 of 1,235,368 read"],
				["Estimate", "1,204 rows, off by 35x"],
			],
		},
		{
			id: "hash",
			op: "Hash",
			ms: 21.9,
			children: [
				{
					id: "customers",
					op: "Seq Scan on customers",
					ms: 18.4,
					details: [["Rows", "8,412"]],
				},
			],
		},
	],
};

// The node with the largest self time (its time minus its children's). Fixed
// here; a plan viewer computes it from the parsed plan.
const HOT_ID = "orders";

const INDEX_SQL = `create index concurrently orders_status_created_at_idx
  on orders (status, created_at desc);`;

// The path to the slow node starts open, and keepMounted keeps any node the
// reader opened when its parent folds.
export function Trace12Example(): React.JSX.Element {
	return (
		<div className="flex w-full max-w-lg flex-col gap-4 text-sm">
			<Trace>
				<PlanRow node={PLAN} />
			</Trace>
			<Trace>
				<TraceCollapsible>
					<TraceCollapsibleTrigger>
						<TraceLine>
							<TraceIcon>
								<LightbulbIcon />
							</TraceIcon>
							<TraceTitle>Suggested an index on orders</TraceTitle>
							<TraceDescription>est. 641 to 9 ms</TraceDescription>
						</TraceLine>
					</TraceCollapsibleTrigger>
					<TraceCollapsibleContent>
						<CodeBlock code={INDEX_SQL} language="sql" label="Index to add" />
					</TraceCollapsibleContent>
				</TraceCollapsible>
			</Trace>
		</div>
	);
}

function containsHot(node: PlanNode): boolean {
	return node.id === HOT_ID || (node.children ?? []).some(containsHot);
}

interface PlanRowProps {
	readonly node: PlanNode;
}

function PlanRow({ node }: PlanRowProps): React.JSX.Element {
	const hot = node.id === HOT_ID;
	const share = Math.round((node.ms / TOTAL_MS) * PERCENT);

	return (
		<TraceCollapsible defaultOpen={containsHot(node)}>
			<TraceCollapsibleTrigger>
				{/* No icon: the indent already says which node is a child, and the
            width it frees keeps a deep node's name readable. */}
				<TraceLine>
					<TraceTitle>{node.op}</TraceTitle>
					<TraceDescription>{Math.round(node.ms)} ms</TraceDescription>
					{hot ? (
						<Badge variant="warning-light">
							{share}%<span className="sr-only"> of the query time</span>
						</Badge>
					) : null}
				</TraceLine>
			</TraceCollapsibleTrigger>
			<TraceCollapsibleContent keepMounted>
				<div className="flex flex-col gap-2">
					{node.details ? (
						<dl className="flex flex-col gap-0.5 text-xs">
							{node.details.map(([label, value]: readonly [label: string, value: string]): React.JSX.Element => (
								<div key={label} className="flex gap-3">
									<dt className="w-16 shrink-0">{label}</dt>
									<dd className="min-w-0 text-foreground">{value}</dd>
								</div>
							))}
						</dl>
					) : null}
					{node.children ? (
						<Trace>
							{node.children.map((child: PlanNode): React.JSX.Element => (
								<PlanRow key={child.id} node={child} />
							))}
						</Trace>
					) : null}
				</div>
			</TraceCollapsibleContent>
		</TraceCollapsible>
	);
}
