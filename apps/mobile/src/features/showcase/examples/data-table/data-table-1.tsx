import type { DataTableClientPagination } from "@workspace/ui-kit-logic";
import { DataTable, type DataTableColumn, type DataTableFilter } from "@workspace/ui-native/components/data-table";
import * as React from "react";

interface Invoice {
	readonly id: string;
	readonly merchant: string;
	readonly status: "paid" | "pending" | "overdue";
	readonly amount: string;
}

const INVOICES: readonly Invoice[] = [
	{ id: "INV-001", merchant: "Acme Coffee", status: "paid", amount: "RM 250.00" },
	{ id: "INV-002", merchant: "Bayview Books", status: "pending", amount: "RM 150.00" },
	{ id: "INV-003", merchant: "Corner Bakery", status: "overdue", amount: "RM 350.00" },
	{ id: "INV-004", merchant: "Delta Fitness", status: "paid", amount: "RM 420.00" },
];

// Module constants: a new array per render would reset the table's state.
const COLUMNS: readonly DataTableColumn<Invoice>[] = [
	{ id: "id", header: "Invoice", width: "sm", value: (row: Invoice): string => row.id },
	{ id: "merchant", header: "Merchant", value: (row: Invoice): string => row.merchant },
	{ id: "status", header: "Status", width: "sm", value: (row: Invoice): string => row.status },
	{ id: "amount", header: "Amount", align: "end", value: (row: Invoice): string => row.amount },
];

const FILTERS: readonly DataTableFilter[] = [
	{
		key: "status",
		label: "Status",
		options: [
			{ value: "paid", label: "Paid" },
			{ value: "pending", label: "Pending" },
			{ value: "overdue", label: "Overdue" },
		],
	},
];

const SEARCH_KEYS: readonly string[] = ["id", "merchant"];
const PAGE_SIZE = 5;
const PAGINATION: DataTableClientPagination<Invoice> = { mode: "client", getRowId: (row: Invoice): string => row.id };

export function DataTable1Example(): React.JSX.Element {
	return (
		<DataTable
			data={INVOICES}
			columns={COLUMNS}
			filters={FILTERS}
			searchKeys={SEARCH_KEYS}
			pageSize={PAGE_SIZE}
			pagination={PAGINATION}
			title="Invoices"
			description="Search, filter and page through rows."
		/>
	);
}
