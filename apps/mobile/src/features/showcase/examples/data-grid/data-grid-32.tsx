import { useTable, type ColumnDef } from "@tanstack/react-table";
import { DataGrid, DataGridContainer, DataGridTable } from "@workspace/ui-native/components/data-grid";
import { dataGridFeatures, type DataGridFeatures, type DataGridTableLayout } from "@workspace/ui-native/lib/data-grid";
import * as React from "react";

import { METRIC_COLUMN_COUNT, METRIC_ROWS, metricValue, type MetricRow } from "./data-grid-sample-records";

const WIDTH = { row: 72, metric: 84, total: 96 } satisfies Record<string, number>;
const HEIGHT = 420;

const METRIC_COLUMNS: ColumnDef<DataGridFeatures, MetricRow>[] = Array.from({ length: METRIC_COLUMN_COUNT }, (_, column: number): ColumnDef<DataGridFeatures, MetricRow> => ({
	id: `m${String(column + 1)}`,
	header: `M${String(column + 1)}`,
	accessorFn: (row: MetricRow): number => metricValue(row.index, column),
	size: WIDTH.metric,
	meta: { align: "end" },
}));

const COLUMNS: ColumnDef<DataGridFeatures, MetricRow>[] = [
	{ id: "row", header: "Row", accessorFn: (row: MetricRow): number => row.index + 1, size: WIDTH.row },
	...METRIC_COLUMNS,
	{
		id: "total",
		header: "Total",
		accessorFn: (row: MetricRow): number =>
			Array.from({ length: METRIC_COLUMN_COUNT }, (_, column: number): number => metricValue(row.index, column)).reduce(
				(sum: number, value: number): number => sum + value,
				0,
			),
		size: WIDTH.total,
		meta: { align: "end" },
	},
];

const LAYOUT: DataGridTableLayout = { dense: true, cellBorder: true, headerSticky: true, headerBackground: true };
const OPTIONS = { initialState: { columnPinning: { start: ["row"], end: ["total"] } } };

// A thousand rows by thirty-six metrics: rows and columns drawn only as they come into view, Row and Total pinned.
export function DataGrid32Example(): React.JSX.Element {
	const table = useTable({
		features: dataGridFeatures,
		columns: COLUMNS,
		data: METRIC_ROWS,
		getRowId: (row: MetricRow): string => row.id,
		manualPagination: true,
		...OPTIONS,
	});
	return (
		<DataGrid table={table} recordCount={METRIC_ROWS.length} tableLayout={LAYOUT}>
			<DataGridContainer>
				<DataGridTable virtualized virtualizeColumns height={HEIGHT} />
			</DataGridContainer>
		</DataGrid>
	);
}
