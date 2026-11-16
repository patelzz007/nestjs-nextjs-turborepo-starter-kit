import type { DataGridFootRow } from "@workspace/ui-native/components/data-grid";
import * as React from "react";
import { Text, View } from "react-native";

import { FOOTER_EMPLOYEES, FooterGrid } from "./data-grid-footer";
import { formatUsd, summarize, type Summary } from "./data-grid-sample-records";

const BALANCES = summarize(FOOTER_EMPLOYEES.map((employee) => employee.balance));
const TRANSACTIONS = summarize(FOOTER_EMPLOYEES.map((employee) => employee.transactions));
const LABEL_SPAN = 2;

/** An aggregate under its column: the average, and the range it sits in. */
function Aggregate({ summary, format }: { readonly summary: Summary; readonly format: (value: number) => string }): React.JSX.Element {
	return (
		<View className="items-end">
			<Text className="text-label font-sans-semibold text-foreground tabular-nums">{format(summary.average)}</Text>
			<Text className="text-caption font-sans text-muted-foreground tabular-nums">{`${format(summary.min)} – ${format(summary.max)}`}</Text>
		</View>
	);
}

function wholeNumber(value: number): string {
	return String(Math.round(value));
}

const FOOTER: readonly DataGridFootRow[] = [
	{
		key: "aggregate",
		cells: [
			{ key: "label", span: LABEL_SPAN, content: "Average (range)" },
			{ key: "balance", content: <Aggregate summary={BALANCES} format={formatUsd} />, align: "end" },
			{ key: "transactions", content: <Aggregate summary={TRANSACTIONS} format={wholeNumber} />, align: "end" },
		],
	},
];

// Under Balance and Transactions, each column's average over its lowest-to-highest range.
export function DataGrid26Example(): React.JSX.Element {
	return <FooterGrid title="Per-column aggregates" footer={FOOTER} />;
}
