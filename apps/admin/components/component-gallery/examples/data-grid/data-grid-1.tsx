"use client";

import * as React from "react";
import { useState } from "react";
import { DataGrid, DataGridContainer, dataGridFeatures, type DataGridFeatures } from "@workspace/ui/components/data-grid/data-grid";
import { DataGridPagination } from "@workspace/ui/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@workspace/ui/components/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@workspace/ui/components/data-grid/data-grid-table";
import { useTable, type CellContext, type ColumnDef, type PaginationState, type SortingState } from "@tanstack/react-table";

import {
	DATA_GRID_SAMPLE_FLAGS,
	DATA_GRID_SAMPLE_PAGE_SIZE,
	DATA_GRID_SAMPLE_PEOPLE,
	formatDataGridSampleBalance,
	getDataGridSamplePersonId,
	type DataGridSamplePerson,
} from "@/components/component-gallery/examples/data-grid/data-grid-sample-people";

type PersonCell = CellContext<DataGridFeatures, DataGridSamplePerson>;

function NameCell({ row }: PersonCell): React.JSX.Element {
	return <>{row.original.name}</>;
}

function EmailCell({ row }: PersonCell): React.JSX.Element {
	return (
		<div className="truncate">
			<a href={`mailto:${row.original.email}`} className="truncate hover:text-primary hover:underline">
				{row.original.email}
			</a>
		</div>
	);
}

function LocationCell({ row }: PersonCell): React.JSX.Element {
	return (
		<div className="flex items-center gap-1.5">
			<span role="img" aria-label={row.original.location}>
				{DATA_GRID_SAMPLE_FLAGS[row.original.flag]}
			</span>
			<div className="text-foreground">{row.original.location}</div>
		</div>
	);
}

function BalanceCell({ row }: PersonCell): React.JSX.Element {
	return <>{formatDataGridSampleBalance(row.original.balance)}</>;
}

const COLUMNS: ColumnDef<DataGridFeatures, DataGridSamplePerson>[] = [
	{ accessorKey: "name", header: "Name", cell: NameCell, size: 150 },
	{ accessorKey: "email", header: "Email", cell: EmailCell, size: 150 },
	{ accessorKey: "location", header: "Location", cell: LocationCell, size: 175 },
	{
		accessorKey: "balance",
		header: "Balance ($)",
		cell: BalanceCell,
		size: 100,
		meta: { headerClassName: "text-end", cellClassName: "text-end" },
	},
];

const INITIAL_PAGINATION: PaginationState = { pageIndex: 0, pageSize: DATA_GRID_SAMPLE_PAGE_SIZE };
const INITIAL_SORTING: SortingState = [{ id: "name", desc: true }];

export function DataGrid1Example(): React.JSX.Element {
	const [pagination, setPagination] = useState<PaginationState>(INITIAL_PAGINATION);
	const [sorting, setSorting] = useState<SortingState>(INITIAL_SORTING);

	const table = useTable({
		features: dataGridFeatures,
		columns: COLUMNS,
		data: DATA_GRID_SAMPLE_PEOPLE,
		getRowId: getDataGridSamplePersonId,
		state: { pagination, sorting },
		onPaginationChange: setPagination,
		onSortingChange: setSorting,
	});

	return (
		<DataGrid table={table} recordCount={DATA_GRID_SAMPLE_PEOPLE.length}>
			<div className="w-full space-y-2.5">
				<DataGridContainer>
					<DataGridScrollArea>
						<DataGridTable />
					</DataGridScrollArea>
				</DataGridContainer>
				<DataGridPagination />
			</div>
		</DataGrid>
	);
}
