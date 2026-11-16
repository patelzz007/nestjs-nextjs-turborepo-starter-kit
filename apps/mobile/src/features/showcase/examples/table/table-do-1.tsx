import { Table, type TableColumn, type TableRow } from "@workspace/ui-native/components/table";
import * as React from "react";

type Column = "item" | "amount";

const COLUMNS: readonly TableColumn<Column>[] = [
	{ key: "item", label: "Item" },
	{ key: "amount", label: "Amount", align: "end" },
];

const ROWS: readonly TableRow<Column>[] = [
	{ key: "coffee", cells: { item: "Coffee", amount: "RM 9.00" } },
	{ key: "bagel", cells: { item: "Bagel", amount: "RM 12.50" } },
];

export function TableDo1Example(): React.JSX.Element {
	return <Table caption="Receipt" columns={COLUMNS} rows={ROWS} />;
}
