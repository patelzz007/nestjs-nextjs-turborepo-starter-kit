import { Table, type TableColumn, type TableRow } from "@workspace/ui-native/components/table";
import * as React from "react";

type Column = "invoice" | "status" | "method" | "amount";

const COLUMNS: readonly TableColumn<Column>[] = [
	{ key: "invoice", label: "Invoice" },
	{ key: "status", label: "Status" },
	{ key: "method", label: "Method", width: "md" },
	{ key: "amount", label: "Amount", align: "end" },
];

const ROWS: readonly TableRow<Column>[] = [
	{ key: "INV001", cells: { invoice: "INV001", status: "Paid", method: "Credit Card", amount: "$250.00" } },
	{ key: "INV002", cells: { invoice: "INV002", status: "Pending", method: "PayPal", amount: "$150.00" } },
	{ key: "INV003", cells: { invoice: "INV003", status: "Unpaid", method: "Bank Transfer", amount: "$350.00" } },
];

export function Table1Example(): React.JSX.Element {
	return <Table caption="A list of your recent invoices." columns={COLUMNS} rows={ROWS} showCaption scrollable />;
}
