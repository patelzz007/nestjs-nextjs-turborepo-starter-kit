import { useTable, type ColumnDef } from "@tanstack/react-table";
import { DataGrid, DataGridContainer, DataGridTable } from "@workspace/ui-native/components/data-grid";
import { dataGridFeatures, type DataGridFeatures, type DataGridTableLayout } from "@workspace/ui-native/lib/data-grid";
import * as React from "react";
import { Text } from "react-native";

import { FEED_TOTAL, feedPage, formatUsd, logRowId, type LogRow } from "./data-grid-sample-records";

const WIDTH = { index: 64, name: 160, email: 230, balance: 120 } satisfies Record<string, number>;
const PAGE_SIZE = 15;
const LATENCY_MS = 600;
const HEIGHT = 420;

const COLUMNS: ColumnDef<DataGridFeatures, LogRow>[] = [
	{ accessorKey: "index", header: "#", size: WIDTH.index, meta: { align: "end" } },
	{ accessorKey: "name", header: "Name", size: WIDTH.name },
	{ accessorKey: "email", header: "Email", size: WIDTH.email },
	{
		accessorKey: "balance",
		header: "Balance",
		cell: ({ row }) => <Text className="text-label font-sans text-foreground tabular-nums">{formatUsd(row.original.balance)}</Text>,
		size: WIDTH.balance,
		meta: { align: "end" },
	},
];

const LAYOUT: DataGridTableLayout = { headerSticky: true, headerBackground: true, dense: true };

// A feed: the next server page is fetched and appended as the reader reaches the end, until there are no more.
export function DataGrid28Example(): React.JSX.Element {
	const [rows, setRows] = React.useState<readonly LogRow[]>(() => feedPage(0, PAGE_SIZE).rows);
	const [cursor, setCursor] = React.useState<number | null>(PAGE_SIZE);
	const [fetching, setFetching] = React.useState(false);
	const fetchMore = React.useCallback((): void => {
		if (cursor === null) {
			return;
		}
		setFetching(true);
		setTimeout((): void => {
			const page = feedPage(cursor, PAGE_SIZE);
			setRows((current) => [...current, ...page.rows]);
			setCursor(page.next);
			setFetching(false);
		}, LATENCY_MS);
	}, [cursor]);
	const table = useTable({ features: dataGridFeatures, columns: COLUMNS, data: rows, getRowId: logRowId, manualPagination: true });
	return (
		<DataGrid table={table} recordCount={FEED_TOTAL} tableLayout={LAYOUT}>
			<DataGridContainer>
				<DataGridTable virtualized height={HEIGHT} onFetchMore={fetchMore} isFetchingMore={fetching} hasMore={cursor !== null} />
			</DataGridContainer>
		</DataGrid>
	);
}
