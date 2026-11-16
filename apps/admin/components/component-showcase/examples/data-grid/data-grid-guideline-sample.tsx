"use client";

// The grid the Do / Don't pairs show: the sample people, the name column pinned or not, balances formatted and
// aligned to the end or raw and ragged.

import { DataGrid, DataGridContainer, dataGridFeatures, type DataGridFeatures, type DataGridTableLayout } from "@workspace/ui/components/data-grid/data-grid";
import { DataGridScrollArea } from "@workspace/ui/components/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@workspace/ui/components/data-grid/data-grid-table";
import { useTable, type CellContext, type ColumnDef, type ColumnPinningState } from "@tanstack/react-table";
import type * as React from "react";

import {
	DATA_GRID_SAMPLE_PEOPLE,
	formatDataGridSampleBalance,
	getDataGridSamplePersonId,
	type DataGridSamplePerson,
} from "@/components/component-showcase/examples/data-grid/data-grid-sample-people";

type PersonCell = CellContext<DataGridFeatures, DataGridSamplePerson>;

function FormattedBalance({ row }: PersonCell): React.JSX.Element {
	return <>{formatDataGridSampleBalance(row.original.balance)}</>;
}

function RawBalance({ row }: PersonCell): React.JSX.Element {
	return <>{String(row.original.balance)}</>;
}

/** The columns before the balance: wide enough that the grid scrolls sideways. */
const LEADING: ColumnDef<DataGridFeatures, DataGridSamplePerson>[] = [
	{ accessorKey: "name", header: "Name", size: 150 },
	{ accessorKey: "email", header: "Email", size: 220 },
	{ accessorKey: "location", header: "Location", size: 180 },
];

const FORMATTED: ColumnDef<DataGridFeatures, DataGridSamplePerson>[] = [
	...LEADING,
	{ accessorKey: "balance", header: "Balance", cell: FormattedBalance, size: 120, meta: { headerClassName: "text-end", cellClassName: "text-end tabular-nums" } },
];

const RAW: ColumnDef<DataGridFeatures, DataGridSamplePerson>[] = [...LEADING, { accessorKey: "balance", header: "Balance", cell: RawBalance, size: 120 }];

const PINNED_NAME: ColumnPinningState = { start: ["name"], end: [] };
const NOTHING_PINNED: ColumnPinningState = { start: [], end: [] };
const PINNABLE: DataGridTableLayout = { columnsPinnable: true };

/** The grid's first five people. */
const PEOPLE: readonly DataGridSamplePerson[] = DATA_GRID_SAMPLE_PEOPLE.slice(0, 5);

export interface GuidelineGridProps {
	/** The name column stays put while the rest scrolls. */
	readonly pinName: boolean;
	/** Balances formatted with their currency and aligned to the end. */
	readonly formatted: boolean;
}

export function GuidelineGrid({ pinName, formatted }: GuidelineGridProps): React.JSX.Element {
	const table = useTable({
		features: dataGridFeatures,
		columns: formatted ? FORMATTED : RAW,
		data: PEOPLE,
		getRowId: getDataGridSamplePersonId,
		initialState: { columnPinning: pinName ? PINNED_NAME : NOTHING_PINNED },
	});
	return (
		<div className="w-full max-w-sm">
			<DataGrid table={table} recordCount={PEOPLE.length} tableLayout={PINNABLE}>
				<DataGridContainer>
					<DataGridScrollArea>
						<DataGridTable />
					</DataGridScrollArea>
				</DataGridContainer>
			</DataGrid>
		</div>
	);
}
