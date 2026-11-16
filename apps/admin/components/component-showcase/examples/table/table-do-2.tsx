import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import { Badge } from "@workspace/ui/components/badge";
import { CircleCheckIcon } from "lucide-react";

export function TableDo2Example(): React.JSX.Element {
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
						<Badge variant="success-light">
							<CircleCheckIcon aria-hidden="true" />
							Paid
						</Badge>
					</TableCell>
				</TableRow>
			</TableBody>
		</Table>
	);
}
