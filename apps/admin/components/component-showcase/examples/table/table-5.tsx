import * as React from "react";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";

const items = [
	{ id: "1", name: "Item Alpha", quantity: 1, price: "$10.00" },
	{ id: "2", name: "Item Beta", quantity: 2, price: "$20.00" },
	{ id: "3", name: "Item Gamma", quantity: 1, price: "$30.00" },
];

export function Table5Example(): React.JSX.Element {
	return (
		<div className="mx-auto flex w-full max-w-lg flex-col">
			<Card className="p-0">
				<CardContent className="p-0">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Item</TableHead>
								<TableHead>Quantity</TableHead>
								<TableHead className="text-right">Price</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{items.map((item) => (
								<TableRow key={item.id}>
									<TableCell className="font-medium">{item.name}</TableCell>
									<TableCell>
										<Input type="number" defaultValue={item.quantity} className="h-8 w-20" min="0" aria-label={`Quantity of ${item.name}`} />
									</TableCell>
									<TableCell className="text-right">{item.price}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</div>
	);
}
