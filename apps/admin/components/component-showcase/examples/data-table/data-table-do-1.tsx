import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, type DataTableFeatures, type DataTablePagination } from "@workspace/ui/components/data-table";

interface Invoice {
	readonly id: string;
	readonly merchant: string;
	readonly amount: string;
}

const INVOICES: readonly Invoice[] = [
	{ id: "INV-001", merchant: "Acme Coffee", amount: "RM 250.00" },
	{ id: "INV-002", merchant: "Bayview Books", amount: "RM 150.00" },
	{ id: "INV-003", merchant: "Corner Bakery", amount: "RM 350.00" },
];

const COLUMNS: ColumnDef<DataTableFeatures, Invoice>[] = [
	{ accessorKey: "id", header: "Invoice" },
	{ accessorKey: "merchant", header: "Merchant" },
	{ accessorKey: "amount", header: "Amount" },
];

function invoiceId(invoice: Invoice): string {
	return invoice.id;
}

/** Rows tracked by their invoice number, not by where they sit. */
const BY_ID: DataTablePagination<Invoice> = { mode: "client", getRowId: invoiceId };

export function DataTableDo1Example(): React.JSX.Element {
	return <DataTable data={INVOICES} columns={COLUMNS} pagination={BY_ID} checkbox title="Invoices" />;
}
