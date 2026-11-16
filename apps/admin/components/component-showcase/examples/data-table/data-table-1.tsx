"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type * as React from "react";
import { DataTable, type DataTableFeatures, type Filter } from "@workspace/ui/components/data-table";

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
const COLUMNS: ColumnDef<DataTableFeatures, Invoice>[] = [
	{ accessorKey: "id", header: "Invoice" },
	{ accessorKey: "merchant", header: "Merchant" },
	{ accessorKey: "status", header: "Status" },
	{ accessorKey: "amount", header: "Amount" },
];

const FILTERS: Filter[] = [
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

const SEARCH_KEYS: string[] = ["id", "merchant"];
const PAGE_SIZE = 5;

export function DataTable1Example(): React.JSX.Element {
	return (
		<DataTable
			data={INVOICES}
			columns={COLUMNS}
			filters={FILTERS}
			searchKeys={SEARCH_KEYS}
			pageSize={PAGE_SIZE}
			title="Invoices"
			description="Search, filter and page through rows."
		/>
	);
}
