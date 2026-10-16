"use client";

import * as React from "react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { DataGrid, DataGridContainer, dataGridFeatures, type DataGridFeatures, type DataGridTableLayout } from "@workspace/ui/components/data-grid/data-grid";
import { DataGridPagination } from "@workspace/ui/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@workspace/ui/components/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@workspace/ui/components/data-grid/data-grid-table";
import { useTable, type CellContext, type ColumnDef, type PaginationState, type SortingState } from "@tanstack/react-table";

import {
	DATA_GRID_SAMPLE_FLAGS,
	DATA_GRID_SAMPLE_PAGE_SIZE,
	DATA_GRID_SAMPLE_PEOPLE,
	formatDataGridSampleBalance,
	getDataGridSampleInitials,
	getDataGridSamplePersonId,
	type DataGridSamplePerson,
} from "@/components/component-gallery/examples/data-grid/data-grid-sample-people";

type PersonCell = CellContext<DataGridFeatures, DataGridSamplePerson>;

function NameCell({ row }: PersonCell): React.JSX.Element {
	return (
		<div className="flex items-center gap-2">
			<Avatar className="size-6">
				<AvatarImage src={row.original.avatar} alt={row.original.name} />
				<AvatarFallback>{getDataGridSampleInitials(row.original.name)}</AvatarFallback>
			</Avatar>
			<a href={`mailto:${row.original.email}`} className="font-medium text-foreground hover:text-primary">
				{row.original.name}
			</a>
		</div>
	);
}

function EmailCell({ row }: PersonCell): React.JSX.Element {
	return (
		<a href={`mailto:${row.original.email}`} className="hover:text-primary hover:underline">
			{row.original.email}
		</a>
	);
}

function LocationCell({ row }: PersonCell): React.JSX.Element {
	return (
		<div className="flex items-center gap-1.5">
			<span role="img" aria-label={row.original.location}>
				{DATA_GRID_SAMPLE_FLAGS[row.original.flag]}
			</span>
			<div className="font-medium text-foreground">{row.original.location}</div>
		</div>
	);
}

function BalanceCell({ row }: PersonCell): React.JSX.Element {
	return <span className="font-semibold">{formatDataGridSampleBalance(row.original.balance)}</span>;
}

const COLUMNS: ColumnDef<DataGridFeatures, DataGridSamplePerson>[] = [
	{ accessorKey: "name", id: "name", header: "Name", cell: NameCell, size: 175, enableSorting: true, enableHiding: false },
	{ accessorKey: "email", header: "Email", cell: EmailCell, size: 180 },
	{ accessorKey: "location", header: "Location", cell: LocationCell, size: 170 },
	{
		accessorKey: "balance",
		header: "Balance ($)",
		cell: BalanceCell,
		size: 120,
		meta: { headerClassName: "text-end", cellClassName: "text-end" },
	},
];

const TABLE_LAYOUT: DataGridTableLayout = { stripped: true, rowRounded: true };
const INITIAL_PAGINATION: PaginationState = { pageIndex: 0, pageSize: DATA_GRID_SAMPLE_PAGE_SIZE };
const INITIAL_SORTING: SortingState = [{ id: "name", desc: true }];

export function DataGrid5Example(): React.JSX.Element {
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
		<DataGrid table={table} recordCount={DATA_GRID_SAMPLE_PEOPLE.length} tableLayout={TABLE_LAYOUT}>
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
