"use client";

import * as React from "react";
import { useState } from "react";
import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Badge } from "@workspace/ui/components/badge";
import { DataGrid, DataGridContainer, dataGridFeatures, type DataGridFeatures, type DataGridTableLayout } from "@workspace/ui/components/data-grid/data-grid";
import { DataGridPagination } from "@workspace/ui/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@workspace/ui/components/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@workspace/ui/components/data-grid/data-grid-table";
import { cn } from "@workspace/ui/lib/core/utils";
import { useTable, type CellContext, type ColumnDef, type PaginationState, type SortingState } from "@tanstack/react-table";

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

function StatusCell({ row }: PersonCell): React.JSX.Element {
	return row.original.status === "active" ? <Badge variant="success-outline">Approved</Badge> : <Badge variant="warning-outline">Pending</Badge>;
}

const COLUMNS: ColumnDef<DataGridFeatures, DataGridSamplePerson>[] = [
	{ accessorKey: "name", id: "name", header: "Name", cell: PersonCellContent, size: 225, enableSorting: true, enableHiding: false },
	{ accessorKey: "location", header: "Location", cell: LocationCell, size: 160, meta: { cellClassName: "text-start" } },
	{ accessorKey: "status", id: "status", header: "Status", cell: StatusCell, size: 100 },
];

const TABLE_LAYOUT: DataGridTableLayout = { headerBackground: false, rowBorder: false, rowRounded: true };
const INITIAL_PAGINATION: PaginationState = { pageIndex: 0, pageSize: DATA_GRID_SAMPLE_PAGE_SIZE };
const INITIAL_SORTING: SortingState = [{ id: "name", desc: true }];

export function DataGrid4Example(): React.JSX.Element {
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
