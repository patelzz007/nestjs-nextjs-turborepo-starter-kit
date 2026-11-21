"use client";

import type * as React from "react";

import { DataTable, type DataTableColumns, type DataTableLayout, type DataTableVirtualize } from "@workspace/ui/components/data-table";

import { NUMERIC_COLUMN_META } from "./data-table-sample";

/** One store's sales for a year, week by week. */
interface StoreSales {
	readonly id: string;
	readonly store: string;
	readonly weeks: readonly number[];
}

const WEEK_COUNT = 52;
const STORE_COUNT = 40;
/** Sample figures: a base that grows with the store and the week, so every cell differs and the data stays the same on every render. */
const BASE_SALES = 1200;
const STORE_STEP = 37;
const WEEK_STEP = 11;

const STORES: readonly StoreSales[] = Array.from({ length: STORE_COUNT }, (_store, store) => ({
	id: `store-${String(store + 1)}`,
	store: `Store ${String(store + 1)}`,
	weeks: Array.from({ length: WEEK_COUNT }, (_week, week) => BASE_SALES + store * STORE_STEP + week * WEEK_STEP),
}));

function getStoreId(row: StoreSales): string {
	return row.id;
}

const sales = new Intl.NumberFormat("en-US");

const COLUMNS: DataTableColumns<StoreSales> = [
	{ accessorKey: "store", header: "Store", size: 140, enableHiding: false },
	...Array.from({ length: WEEK_COUNT }, (_week, week): DataTableColumns<StoreSales>[number] => ({
		id: `week-${String(week + 1)}`,
		header: `W${String(week + 1)}`,
		accessorFn: (row: StoreSales): number => row.weeks.at(week) ?? 0,
		cell: ({ getValue }): string => sales.format(Number(getValue())),
		size: 96,
		meta: NUMERIC_COLUMN_META,
	})),
];

const MAX_BODY_HEIGHT = 420;
const LAYOUT: DataTableLayout = { maxHeight: MAX_BODY_HEIGHT, stickyHeader: true, density: "compact", cellBorders: true };

/** Rows and columns are both drawn only while in view: 53 columns by 40 rows, with a few dozen cells in the page. */
const VIRTUALIZE: DataTableVirtualize = { rows: true, columns: true };

export function DataTable17Example(): React.JSX.Element {
	return <DataTable data={STORES} columns={COLUMNS} getRowId={getStoreId} layout={LAYOUT} virtualize={VIRTUALIZE} />;
}
