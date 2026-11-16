import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import { CircleCheckIcon } from "lucide-react";

export function TableDont2Example(): React.JSX.Element {
	return (
		<Table className="max-w-xs">
			<TableHeader>
				<TableRow>
					<TableHead>Invoice</TableHead>
					<TableHead>Status</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				<TableRow>
					<TableCell>INV-001</TableCell>
					<TableCell>
						<CircleCheckIcon className="size-4 text-success" />
					</TableCell>
				</TableRow>
			</TableBody>
		</Table>
	);
}
