import { Badge, type BadgeTone } from "@workspace/ui-native/components/badge";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import { IconTile } from "@workspace/ui-native/components/icon-tile";
import { Table, type TableColumn, type TableRow } from "@workspace/ui-native/components/table";
import EllipsisIcon from "lucide-react-native/icons/ellipsis";
import PackageIcon from "lucide-react-native/icons/package";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

type Column = "product" | "category" | "stock" | "price" | "actions";

interface Product {
	readonly name: string;
	readonly sku: string;
	readonly category: string;
	readonly price: string;
	readonly stock: number;
	readonly stockStatus: string;
	readonly tone: BadgeTone;
}

const PRODUCTS: readonly Product[] = [
	{ name: "Ergonomic Desk Chair", sku: "FRN-001", category: "Furniture", price: "$549.00", stock: 124, stockStatus: "In Stock", tone: "success" },
	{ name: "Wireless Noise-Canceling Headphones", sku: "AUD-042", category: "Audio", price: "$349.99", stock: 8, stockStatus: "Low Stock", tone: "warning" },
	{ name: '4K Ultra HD Monitor 32"', sku: "DSP-019", category: "Displays", price: "$799.00", stock: 0, stockStatus: "Out of Stock", tone: "destructive" },
	{ name: "Mechanical Keyboard RGB", sku: "INP-087", category: "Input", price: "$179.99", stock: 56, stockStatus: "In Stock", tone: "success" },
	{ name: "USB-C Docking Station", sku: "ACC-033", category: "Accessories", price: "$249.00", stock: 3, stockStatus: "Low Stock", tone: "warning" },
];

const ACTIONS: readonly DropdownMenuItemData<string>[] = [
	{ value: "edit", label: "Edit" },
	{ value: "restock", label: "Restock" },
	{ value: "archive", label: "Archive", variant: "destructive" },
];

const COLUMNS: readonly TableColumn<Column>[] = [
	{ key: "product", label: "Product" },
	{ key: "category", label: "Category" },
	{ key: "stock", label: "Stock", width: "md" },
	{ key: "price", label: "Price", align: "end" },
	{ key: "actions", label: "", align: "end", width: "xs" },
];

const ROWS: readonly TableRow<Column>[] = PRODUCTS.map((product: Product): TableRow<Column> => ({
	key: product.sku,
	cells: {
		product: `${product.name}, ${product.sku}`,
		category: product.category,
		stock: `${product.stockStatus}, ${String(product.stock)} units`,
		price: product.price,
		actions: "",
	},
	interactive: true,
	content: {
		product: (
			<View className="flex-row items-center gap-3">
				<IconTile icon={PackageIcon} size="sm" />
				<View className="shrink">
					<Text numberOfLines={1} className="text-label font-sans-medium text-foreground">
						{product.name}
					</Text>
					<Text className="text-caption font-code text-muted-foreground">{product.sku}</Text>
				</View>
			</View>
		),
		stock: (
			<View className="flex-row items-center gap-1.5">
				<Badge label={product.stockStatus} tone={product.tone} variant="light" size="sm" />
				<Text className="text-caption font-sans text-muted-foreground tabular-nums">{String(product.stock)}</Text>
			</View>
		),
		actions: (
			<View className="items-end">
				<DropdownMenu label={`Actions for ${product.name}`} icon={EllipsisIcon} size="icon" variant="ghost" items={ACTIONS} onSelect={ignorePress} />
			</View>
		),
	},
}));

export function Table11Example(): React.JSX.Element {
	return <Table caption="Inventory" columns={COLUMNS} rows={ROWS} scrollable />;
}
