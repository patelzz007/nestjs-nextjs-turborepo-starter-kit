import * as React from "react";
import { MoreHorizontalIcon, PackageIcon } from "lucide-react";
import { Badge, type BadgeVariant } from "@workspace/ui/components/badge";

import { Button } from "@workspace/ui/components/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";

interface Product {
	readonly name: string;
	readonly sku: string;
	readonly category: string;
	readonly price: string;
	readonly stock: number;
	readonly stockStatus: string;
	readonly stockVariant: BadgeVariant;
}

const products: readonly Product[] = [
	{
		name: "Ergonomic Desk Chair",
		sku: "FRN-001",
		category: "Furniture",
		price: "$549.00",
		stock: 124,
		stockStatus: "In Stock",
		stockVariant: "success-light",
	},
	{
		name: "Wireless Noise-Canceling Headphones",
		sku: "AUD-042",
		category: "Audio",
		price: "$349.99",
		stock: 8,
		stockStatus: "Low Stock",
		stockVariant: "warning-light",
	},
	{
		name: '4K Ultra HD Monitor 32"',
		sku: "DSP-019",
		category: "Displays",
		price: "$799.00",
		stock: 0,
		stockStatus: "Out of Stock",
		stockVariant: "destructive-light",
	},
	{
		name: "Mechanical Keyboard RGB",
		sku: "INP-087",
		category: "Input",
		price: "$179.99",
		stock: 56,
		stockStatus: "In Stock",
		stockVariant: "success-light",
	},
	{
		name: "USB-C Docking Station",
		sku: "ACC-033",
		category: "Accessories",
		price: "$249.00",
		stock: 3,
		stockStatus: "Low Stock",
		stockVariant: "warning-light",
	},
];

export function Table11Example(): React.JSX.Element {
	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Product</TableHead>
						<TableHead>Category</TableHead>
						<TableHead>Stock</TableHead>
						<TableHead className="text-right">Price</TableHead>
						<TableHead className="w-10" />
					</TableRow>
				</TableHeader>
				<TableBody>
					{products.map((product) => (
						<TableRow key={product.sku}>
							<TableCell>
								<div className="flex items-center gap-3">
									<div className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-muted">
										<PackageIcon className="size-4 text-muted-foreground" aria-hidden="true" />
									</div>
									<div className="flex flex-col">
										<span className="text-sm font-medium">{product.name}</span>
										<span className="truncate font-mono text-xs text-muted-foreground">{product.sku}</span>
									</div>
								</div>
							</TableCell>
							<TableCell className="text-sm text-muted-foreground">{product.category}</TableCell>
							<TableCell>
								<div className="flex items-center gap-2">
									<Badge variant={product.stockVariant} size="sm">
										{product.stockStatus}
									</Badge>
									<span className="text-xs text-muted-foreground">({product.stock})</span>
								</div>
							</TableCell>
							<TableCell className="text-right text-sm font-medium">{product.price}</TableCell>
							<TableCell>
								<DropdownMenu>
									<DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-8" />}>
										<MoreHorizontalIcon />
										<span className="sr-only">Open menu</span>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem>Edit</DropdownMenuItem>
										<DropdownMenuItem>Restock</DropdownMenuItem>
										<DropdownMenuSeparator />
										<DropdownMenuItem variant="destructive">Archive</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
