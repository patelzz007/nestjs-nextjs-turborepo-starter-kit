import { Badge } from "@workspace/ui-native/components/badge";
import { Table, type TableColumn, type TableRow } from "@workspace/ui-native/components/table";
import * as React from "react";

type Column = "order" | "status";

const COLUMNS: readonly TableColumn<Column>[] = [
	{ key: "order", label: "Order no." },
	{ key: "status", label: "Status", width: "md" },
];

const ROWS: readonly TableRow<Column>[] = [
	{ key: "3210", cells: { order: "3210", status: "Paid" }, content: { status: <Badge label="Paid" tone="success" variant="light" size="sm" /> } },
];

export function TableDo2Example(): React.JSX.Element {
	return <Table caption="Orders" columns={COLUMNS} rows={ROWS} />;
}
