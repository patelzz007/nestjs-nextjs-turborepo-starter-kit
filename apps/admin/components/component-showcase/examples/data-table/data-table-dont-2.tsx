import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, type DataTableFeatures } from "@workspace/ui/components/data-table";

interface WideInvoice {
	readonly id: string;
	readonly merchant: string;
	readonly contact: string;
	readonly email: string;
	readonly issued: string;
	readonly due: string;
	readonly currency: string;
	readonly amount: string;
	readonly tax: string;
}

const WIDE_INVOICES: readonly WideInvoice[] = [
	{
		id: "INV-001",
		merchant: "Acme Coffee",
		contact: "Ada Lovelace",
		email: "ada@acme.example",
		issued: "2 Jun",
		due: "2 Jul",
		currency: "MYR",
		amount: "250.00",
		tax: "20.00",
	},
	{
		id: "INV-002",
		merchant: "Bayview Books",
		contact: "Alan Turing",
		email: "alan@bayview.example",
		issued: "4 Jun",
		due: "4 Jul",
		currency: "MYR",
		amount: "150.00",
		tax: "12.00",
	},
];

const WIDE_COLUMNS: ColumnDef<DataTableFeatures, WideInvoice>[] = [
	{ accessorKey: "id", header: "Invoice" },
	{ accessorKey: "merchant", header: "Merchant" },
	{ accessorKey: "contact", header: "Contact" },
	{ accessorKey: "email", header: "Email" },
	{ accessorKey: "issued", header: "Issued" },
	{ accessorKey: "due", header: "Due" },
	{ accessorKey: "currency", header: "Currency" },
	{ accessorKey: "amount", header: "Amount" },
	{ accessorKey: "tax", header: "Tax" },
];

export function DataTableDont2Example(): React.JSX.Element {
	return (
		<div className="w-full max-w-sm">
			<DataTable data={WIDE_INVOICES} columns={WIDE_COLUMNS} title="Invoices" />
		</div>
	);
}
