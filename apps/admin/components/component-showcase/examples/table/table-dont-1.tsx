import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";

const INVOICES: readonly (readonly [string, string])[] = [
	["INV-001", "$250.00"],
	["INV-002", "$1,150.00"],
	["INV-003", "$75.50"],
];

export function TableDont1Example(): React.JSX.Element {
	return (
		<Table className="max-w-xs">
			<TableHeader>
				<TableRow>
					<TableHead>Invoice</TableHead>
					<TableHead>Amount</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{INVOICES.map(([invoice, amount]: readonly [string, string]): React.JSX.Element => (
					<TableRow key={invoice}>
						<TableCell>{invoice}</TableCell>
						<TableCell>{amount}</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}
