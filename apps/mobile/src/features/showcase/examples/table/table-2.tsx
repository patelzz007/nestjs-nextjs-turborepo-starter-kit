import { Table, type TableColumn, type TableRow } from "@workspace/ui-native/components/table";
import * as React from "react";

type Column = "invoice" | "status" | "amount";

const COLUMNS: readonly TableColumn<Column>[] = [
	{ key: "invoice", label: "Invoice" },
	{ key: "status", label: "Status" },
	{ key: "amount", label: "Amount", align: "end" },
];

const ROWS: readonly TableRow<Column>[] = [
	{ key: "INV001", cells: { invoice: "INV001", status: "Paid", amount: "$250.00" } },
	{ key: "INV002", cells: { invoice: "INV002", status: "Pending", amount: "$150.00" } },
	{ key: "INV003", cells: { invoice: "INV003", status: "Unpaid", amount: "$350.00" } },
];

/** The total: its label reads across the first two columns. */
const TOTAL: TableRow<Column> = { key: "total", cells: { invoice: "Total", status: "", amount: "$750.00" } };

export function Table2Example(): React.JSX.Element {
	return <Table caption="Invoices" columns={COLUMNS} rows={ROWS} footer={TOTAL} />;
}
