import type { DataGridFootRow } from "@workspace/ui-native/components/data-grid";
import * as React from "react";

import { FOOTER_EMPLOYEES, FooterGrid } from "./data-grid-footer";
import { formatUsd, summarize } from "./data-grid-sample-records";

const BALANCES = summarize(FOOTER_EMPLOYEES.map((employee) => employee.balance));
const ACTIVE = FOOTER_EMPLOYEES.filter((employee) => employee.status === "Active").length;
const SPAN = 2;

const FOOTER: readonly DataGridFootRow[] = [
	{
		key: "range",
		cells: [
			{ key: "low", span: SPAN, content: `Lowest ${formatUsd(BALANCES.min)}` },
			{ key: "high", span: SPAN, content: `Highest ${formatUsd(BALANCES.max)}`, align: "end" },
		],
	},
	{
		key: "averages",
		cells: [
			{ key: "average", span: SPAN, content: `Average ${formatUsd(BALANCES.average)}` },
			{ key: "active", span: SPAN, content: `${String(ACTIVE)} active of ${String(FOOTER_EMPLOYEES.length)}`, align: "end" },
		],
	},
];

// Two footer rows of statistics: the lowest and highest balance, then the average and how many are active.
export function DataGrid25Example(): React.JSX.Element {
	return <FooterGrid title="Balance statistics" footer={FOOTER} />;
}
