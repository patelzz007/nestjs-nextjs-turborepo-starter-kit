import { Badge } from "@workspace/ui-native/components/badge";
import { CodeBlock } from "@workspace/ui-native/components/code-block";
import { Trace, TraceStep } from "@workspace/ui-native/components/trace";
import LightbulbIcon from "lucide-react-native/icons/lightbulb";
import * as React from "react";
import { Text, View } from "react-native";

interface PlanDetail {
	readonly label: string;
	readonly value: string;
}

interface PlanNode {
	readonly id: string;
	readonly op: string;
	readonly ms: number;
	/** Only scans carry numbers here: they are where a plan is read for its cost. */
	readonly details?: readonly PlanDetail[] | undefined;
	readonly children?: readonly PlanNode[] | undefined;
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
				{ label: "Filter", value: "status = 'paid', last 30 days" },
				{ label: "Rows", value: "41,966 of 1,235,368 read" },
				{ label: "Estimate", value: "1,204 rows, off by 35x" },
			],
		},
		{ id: "hash", op: "Hash", ms: 21.9, children: [{ id: "customers", op: "Seq Scan on customers", ms: 18.4, details: [{ label: "Rows", value: "8,412" }] }] },
	],
};

/** The node with the largest self time. Fixed here; a plan viewer computes it from the parsed plan. */
const HOT_ID = "orders";

const INDEX_SQL = `create index concurrently orders_status_created_at_idx
  on orders (status, created_at desc);`;

function containsHot(node: PlanNode): boolean {
	return node.id === HOT_ID || (node.children ?? []).some(containsHot);
}

function PlanRow({ node }: { readonly node: PlanNode }): React.JSX.Element {
	const hot = node.id === HOT_ID;
	const share = Math.round((node.ms / TOTAL_MS) * PERCENT);
	const ms = `${String(Math.round(node.ms))} ms`;
	// No glyph: the indent already says which node is a child, and the width it frees keeps a deep node's name readable.
	return (
		<TraceStep
			title={node.op}
			description={ms}
			trailing={hot ? <Badge label={`${String(share)}%`} tone="warning" variant="light" size="sm" /> : undefined}
			accessibilityLabel={`${node.op}, ${ms}${hot ? `, ${String(share)}% of the query time` : ""}`}
			defaultOpen={containsHot(node)}>
			{node.details === undefined ? null : (
				<View className="gap-0.5">
					{node.details.map((detail: PlanDetail): React.JSX.Element => (
						<View key={detail.label} className="flex-row gap-3">
							<Text className="text-caption w-16 font-sans text-muted-foreground">{detail.label}</Text>
							<Text className="text-caption flex-1 font-sans text-foreground">{detail.value}</Text>
						</View>
					))}
				</View>
			)}
			{node.children === undefined ? null : (
				<Trace>
					{node.children.map((child: PlanNode): React.JSX.Element => (
						<PlanRow key={child.id} node={child} />
					))}
				</Trace>
			)}
		</TraceStep>
	);
}

// The path to the slow node starts open.
export function Trace12Example(): React.JSX.Element {
	return (
		<View className="gap-4">
			<Trace accessibilityLabel="Query plan">
				<PlanRow node={PLAN} />
			</Trace>
			<Trace>
				<TraceStep icon={LightbulbIcon} title="Suggested an index on orders" description="est. 641 to 9 ms">
					<CodeBlock code={INDEX_SQL} language="sql" caption="Index to add" />
				</TraceStep>
			</Trace>
		</View>
	);
}
