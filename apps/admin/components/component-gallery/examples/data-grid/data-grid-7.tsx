"use client";

import * as React from "react";
import { useState } from "react";
import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { DataGrid, DataGridContainer, dataGridFeatures, type DataGridFeatures } from "@workspace/ui/components/data-grid/data-grid";
import { DataGridPagination } from "@workspace/ui/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@workspace/ui/components/data-grid/data-grid-scroll-area";
import { DataGridTable, DataGridTableRowSelect, DataGridTableRowSelectAll } from "@workspace/ui/components/data-grid/data-grid-table";
import { cn } from "@workspace/ui/lib/core/utils";
import { useTable, type CellContext, type ColumnDef, type PaginationState, type RowSelectionState, type SortingState } from "@tanstack/react-table";

import {
	DATA_GRID_SAMPLE_AVAILABILITY_CLASS_NAMES,
	DATA_GRID_SAMPLE_FLAGS,
	DATA_GRID_SAMPLE_PAGE_SIZE,
	DATA_GRID_SAMPLE_PEOPLE,
	getDataGridSampleInitials,
	getDataGridSamplePersonId,
	type DataGridSamplePerson,
} from "@/components/component-gallery/examples/data-grid/data-grid-sample-people";

type PersonCell = CellContext<DataGridFeatures, DataGridSamplePerson>;

function SelectAllHeader(): React.JSX.Element {
	return <DataGridTableRowSelectAll />;
}

function SelectCell({ row }: PersonCell): React.JSX.Element {
	return <DataGridTableRowSelect row={row} />;
}

function PersonCellContent({ row }: PersonCell): React.JSX.Element {
	return (
		<div className="flex items-center gap-3">
			<Avatar className="size-8">
				<AvatarImage src={row.original.avatar} alt={row.original.name} />
				<AvatarFallback>{getDataGridSampleInitials(row.original.name)}</AvatarFallback>
				<AvatarBadge className={cn("size-1.5! p-0", DATA_GRID_SAMPLE_AVAILABILITY_CLASS_NAMES[row.original.availability])} />
			</Avatar>
			<div className="space-y-px">
				<div className="font-medium text-foreground">{row.original.name}</div>
				<div className="text-muted-foreground">{row.original.email}</div>
			</div>
		</div>
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

function JoinedCell({ row }: PersonCell): React.JSX.Element {
	return <>{row.original.joined}</>;
}

const COLUMNS: ColumnDef<DataGridFeatures, DataGridSamplePerson>[] = [
	{ id: "select", header: SelectAllHeader, cell: SelectCell, enableSorting: false, size: 20 },
	{ accessorKey: "name", id: "name", header: "Name", cell: PersonCellContent, size: 200, enableSorting: true, enableHiding: false },
	{ accessorKey: "location", header: "Location", cell: LocationCell, size: 180, meta: { cellClassName: "text-start" } },
	{ accessorKey: "joined", header: "Joined", cell: JoinedCell, size: 120, meta: { cellClassName: "font-medium" } },
];

const INITIAL_PAGINATION: PaginationState = { pageIndex: 0, pageSize: DATA_GRID_SAMPLE_PAGE_SIZE };
const INITIAL_SORTING: SortingState = [{ id: "name", desc: true }];
const INITIAL_ROW_SELECTION: RowSelectionState = {};

export function DataGrid7Example(): React.JSX.Element {
	const [pagination, setPagination] = useState<PaginationState>(INITIAL_PAGINATION);
	const [sorting, setSorting] = useState<SortingState>(INITIAL_SORTING);
	const [rowSelection, setRowSelection] = useState<RowSelectionState>(INITIAL_ROW_SELECTION);

	const table = useTable({
		features: dataGridFeatures,
		columns: COLUMNS,
		data: DATA_GRID_SAMPLE_PEOPLE,
		getRowId: getDataGridSamplePersonId,
		state: { pagination, sorting, rowSelection },
		enableRowSelection: true,
		onRowSelectionChange: setRowSelection,
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
