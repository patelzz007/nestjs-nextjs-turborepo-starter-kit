import { useTable, type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@workspace/ui-native/components/badge";
import { DataGrid, DataGridContainer, DataGridTable } from "@workspace/ui-native/components/data-grid";
import {
	dataGridFeatures,
	dataGridValueText,
	type DataGridCellsChangeDetails,
	type DataGridCopyDetails,
	type DataGridFeatures,
	type DataGridTableLayout,
} from "@workspace/ui-native/lib/data-grid";
import * as Clipboard from "expo-clipboard";
import * as React from "react";
import { Text, View } from "react-native";

import { formatUsd, parseCount, PRODUCT_SHEET, productStatus, type Product, type ProductStatus } from "./data-grid-sample-records";

const WIDTH = { sku: 96, name: 180, stock: 90, price: 110, status: 120 } satisfies Record<string, number>;
const STATUS_TONES: Readonly<Record<ProductStatus, "success" | "warning" | "destructive">> = { "In stock": "success", "Low stock": "warning", "Sold out": "destructive" };

/** The product with the changed cells written; stock moves its status with it. */
export function applyProductChanges(product: Product, details: DataGridCellsChangeDetails<Product>): Product {
	return details.changes
		.filter((change): boolean => change.rowId === product.id)
		.reduce((next: Product, change): Product => {
			if (change.columnId === "name") {
				return { ...next, name: dataGridValueText(change.value) };
			}
			const value = parseCount(dataGridValueText(change.value)) ?? 0;
			return change.columnId === "stock" ? { ...next, stock: value, status: productStatus(value) } : { ...next, price: value };
		}, product);
}

const COLUMNS: ColumnDef<DataGridFeatures, Product>[] = [
	{ accessorKey: "sku", header: "SKU", size: WIDTH.sku, meta: { cellEdit: { editable: false } } },
	{
		accessorKey: "name",
		header: "Product",
		size: WIDTH.name,
		meta: { cellEdit: { parse: (raw: string): string | undefined => (raw.trim() === "" ? undefined : raw.trim()) } },
	},
	{ accessorKey: "stock", header: "Stock", size: WIDTH.stock, meta: { align: "end", cellEdit: { parse: parseCount, clearValue: 0, control: "number" } } },
	{
		accessorKey: "price",
		header: "Price",
		cell: ({ row }) => <Text className="text-label font-sans text-foreground tabular-nums">{formatUsd(row.original.price)}</Text>,
		size: WIDTH.price,
		meta: { align: "end", cellEdit: { parse: parseCount, clearValue: 0, control: "number" } },
	},
	{
		accessorKey: "status",
		header: "Status",
		cell: ({ row }) => <Badge label={row.original.status} tone={STATUS_TONES[row.original.status]} variant="light" size="sm" />,
		size: WIDTH.status,
	},
];

const LAYOUT: DataGridTableLayout = { cellSelection: true, cellBorder: true, dense: true };

function readClipboard(): Promise<string> {
	return Clipboard.getStringAsync();
}

// A product sheet: tap a cell, long-press another to select the block, then copy, paste, fill, clear or edit it.
export function DataGrid31Example(): React.JSX.Element {
	const [products, setProducts] = React.useState<readonly Product[]>(PRODUCT_SHEET);
	const [log, setLog] = React.useState("Tap a cell to start.");
	const table = useTable({ features: dataGridFeatures, columns: COLUMNS, data: products, getRowId: (product: Product): string => product.id, manualPagination: true });
	const change = React.useCallback((details: DataGridCellsChangeDetails<Product>): void => {
		setProducts((current) => current.map((product: Product): Product => applyProductChanges(product, details)));
		setLog(`${details.source}: ${String(details.changes.length)} written${details.rejected.length === 0 ? "" : `, ${String(details.rejected.length)} refused`}`);
	}, []);
	const copy = React.useCallback((details: DataGridCopyDetails): void => {
		Clipboard.setStringAsync(details.text)
			.then((): void => {
				setLog(`Copied ${String(details.rowCount * details.columnCount)} cells`);
			})
			// A refused copy changes nothing on screen; the log keeps its last line.
			.catch((): void => undefined);
	}, []);
	return (
		<DataGrid table={table} recordCount={products.length} tableLayout={LAYOUT} onCellsChange={change} onCellsCopy={copy} readClipboard={readClipboard}>
			<View className="w-full gap-2">
				<DataGridContainer>
					<DataGridTable />
				</DataGridContainer>
				<Text accessibilityLiveRegion="polite" className="text-caption font-sans text-muted-foreground">
					{log}
				</Text>
			</View>
		</DataGrid>
	);
}
