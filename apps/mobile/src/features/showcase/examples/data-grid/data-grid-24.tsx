import type { DataGridFootRow } from "@workspace/ui-native/components/data-grid";
import * as React from "react";

import { FOOTER_EMPLOYEES, FooterGrid } from "./data-grid-footer";
import { formatUsd, summarize } from "./data-grid-sample-records";

const TOTAL = summarize(FOOTER_EMPLOYEES.map((employee) => employee.balance)).sum;
/** The label spans the columns before the balance. */
const LABEL_SPAN = 2;

const FOOTER: readonly DataGridFootRow[] = [
	{
		key: "total",
		cells: [
			{ key: "label", span: LABEL_SPAN, content: "Total balance" },
			{ key: "sum", content: formatUsd(TOTAL), align: "end" },
			{ key: "rest", content: null },
		],
	},
];

// One footer row that sums every balance, its label spanning the columns to the left.
export function DataGrid24Example(): React.JSX.Element {
	return <FooterGrid title="Employee balances" footer={FOOTER} />;
}
