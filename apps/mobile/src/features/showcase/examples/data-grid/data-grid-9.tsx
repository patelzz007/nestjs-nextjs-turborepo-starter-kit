import { useTable, type ColumnDef, type PaginationState, type SortingState } from "@tanstack/react-table";
import { Badge } from "@workspace/ui-native/components/badge";
import { DataGrid, DataGridContainer, DataGridTable } from "@workspace/ui-native/components/data-grid";
import { DataGridColumnHeader, DataGridPagination, DataGridRowExpand } from "@workspace/ui-native/components/data-grid-parts";
import { dataGridFeatures, type DataGridFeatures } from "@workspace/ui-native/lib/data-grid";
import * as React from "react";
import { Text, View } from "react-native";

import { formatUsd, orderTotal, ORDERS, type Order, type OrderItem, type OrderStatus } from "./data-grid-sample-records";

const STATUS_TONES: Readonly<Record<OrderStatus, "success" | "info" | "warning" | "neutral">> = { Paid: "success", Shipped: "info", Pending: "warning", Refunded: "neutral" };
const ITEMS_PAGE_SIZE = 3;
const ORDERS_PAGE_SIZE = 5;
const WIDTH = { expand: 44, number: 100, customer: 160, items: 80, total: 110, status: 110, product: 170, category: 120, price: 90, quantity: 64 } satisfies Record<
	string,
	number
>;

const ITEM_COLUMNS: ColumnDef<DataGridFeatures, OrderItem>[] = [
	{ accessorKey: "product", header: ({ column }) => <DataGridColumnHeader column={column} title="Product" />, size: WIDTH.product },
	{ accessorKey: "category", header: ({ column }) => <DataGridColumnHeader column={column} title="Category" />, size: WIDTH.category },
	{
		accessorKey: "price",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Price" />,
		cell: ({ row }) => <Text className="text-label font-sans text-foreground tabular-nums">{formatUsd(row.original.price)}</Text>,
		size: WIDTH.price,
		meta: { align: "end" },
	},
	{ accessorKey: "quantity", header: ({ column }) => <DataGridColumnHeader column={column} title="Qty" />, size: WIDTH.quantity, meta: { align: "end" } },
];

/** An order's line items: a grid of its own, sorted and paged on its own. */
function ItemsGrid({ order }: { readonly order: Order }): React.JSX.Element {
	const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: ITEMS_PAGE_SIZE });
	const [sorting, setSorting] = React.useState<SortingState>([]);
	const table = useTable({
		features: dataGridFeatures,
		columns: ITEM_COLUMNS,
		data: order.items,
		getRowId: (item: OrderItem): string => item.id,
		state: { pagination, sorting },
		onPaginationChange: setPagination,
		onSortingChange: setSorting,
	});
	return (
		<DataGrid table={table} recordCount={order.items.length} tableLayout={{ dense: true }}>
			<View className="gap-2 p-3">
				<DataGridContainer>
					<DataGridTable />
				</DataGridContainer>
				<DataGridPagination hideSizes />
			</View>
		</DataGrid>
	);
}

const COLUMNS: ColumnDef<DataGridFeatures, Order>[] = [
	{
		id: "expand",
		header: "",
		cell: ({ row }) => <DataGridRowExpand row={row} />,
		size: WIDTH.expand,
		enableSorting: false,
		meta: { expandedContent: (order: Order): React.JSX.Element => <ItemsGrid order={order} /> },
	},
	{ accessorKey: "number", header: ({ column }) => <DataGridColumnHeader column={column} title="Order" />, size: WIDTH.number },
	{ accessorKey: "customer", header: ({ column }) => <DataGridColumnHeader column={column} title="Customer" />, size: WIDTH.customer },
	{ id: "items", accessorFn: (order: Order): number => order.items.length, header: "Items", size: WIDTH.items, meta: { align: "end" } },
	{
		id: "total",
		accessorFn: orderTotal,
		header: ({ column }) => <DataGridColumnHeader column={column} title="Total" />,
		cell: ({ row }) => <Text className="text-label font-sans-medium text-foreground tabular-nums">{formatUsd(orderTotal(row.original))}</Text>,
		size: WIDTH.total,
		meta: { align: "end" },
	},
	{
		accessorKey: "status",
		header: "Status",
		cell: ({ row }) => <Badge label={row.original.status} tone={STATUS_TONES[row.original.status]} variant="light" size="sm" />,
		size: WIDTH.status,
	},
];

// Each order opens into a grid of its line items, with its own sorting and paging.
export function DataGrid9Example(): React.JSX.Element {
	const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: ORDERS_PAGE_SIZE });
	const table = useTable({
		features: dataGridFeatures,
		columns: COLUMNS,
		data: ORDERS,
		getRowId: (order: Order): string => order.id,
		getRowCanExpand: (): boolean => true,
		state: { pagination },
		onPaginationChange: setPagination,
	});
	return (
		<DataGrid table={table} recordCount={ORDERS.length}>
			<View className="w-full gap-2.5">
				<DataGridContainer>
					<DataGridTable />
				</DataGridContainer>
				<DataGridPagination />
			</View>
		</DataGrid>
	);
}
