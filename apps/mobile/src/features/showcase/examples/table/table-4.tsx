import { Card } from "@workspace/ui-native/components/card";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import { Table, type TableColumn, type TableRow } from "@workspace/ui-native/components/table";
import EllipsisIcon from "lucide-react-native/icons/ellipsis";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

type Column = "product" | "price" | "actions";

interface Product {
	readonly id: string;
	readonly name: string;
	readonly price: string;
}

const PRODUCTS: readonly Product[] = [
	{ id: "1", name: "Wireless Mouse", price: "$29.99" },
	{ id: "2", name: "Mechanical Keyboard", price: "$129.99" },
	{ id: "3", name: "USB-C Hub", price: "$49.99" },
];

const ACTIONS: readonly DropdownMenuItemData<string>[] = [
	{ value: "edit", label: "Edit" },
	{ value: "duplicate", label: "Duplicate" },
	{ value: "delete", label: "Delete", variant: "destructive" },
];

const COLUMNS: readonly TableColumn<Column>[] = [
	{ key: "product", label: "Product" },
	{ key: "price", label: "Price" },
	{ key: "actions", label: "Actions", align: "end", width: "xs" },
];

const ROWS: readonly TableRow<Column>[] = PRODUCTS.map((product: Product): TableRow<Column> => ({
	key: product.id,
	cells: { product: product.name, price: product.price, actions: "" },
	interactive: true,
	content: {
		actions: (
			<View className="items-end">
				<DropdownMenu label={`Actions for ${product.name}`} icon={EllipsisIcon} size="icon" variant="ghost" items={ACTIONS} onSelect={ignorePress} />
			</View>
		),
	},
}));

export function Table4Example(): React.JSX.Element {
	return (
		<Card className="p-2">
			<Table caption="Products" columns={COLUMNS} rows={ROWS} variant="plain" />
		</Card>
	);
}
