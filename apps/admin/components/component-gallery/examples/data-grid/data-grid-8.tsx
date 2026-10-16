"use client";

import * as React from "react";
import { useState } from "react";
import { Badge } from "@workspace/ui/components/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { DataGrid, DataGridContainer, dataGridFeatures, type DataGridFeatures, type DataGridTableLayout } from "@workspace/ui/components/data-grid/data-grid";
import { DataGridPagination } from "@workspace/ui/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@workspace/ui/components/data-grid/data-grid-scroll-area";
import { DataGridTable, DataGridTableRowExpand } from "@workspace/ui/components/data-grid/data-grid-table";
import { useTable, type CellContext, type ColumnDef, type PaginationState, type Row, type SortingState } from "@tanstack/react-table";

import {
	DATA_GRID_SAMPLE_FLAGS,
	DATA_GRID_SAMPLE_PAGE_SIZE,
	DATA_GRID_SAMPLE_PEOPLE,
	getDataGridSampleInitials,
	getDataGridSamplePersonId,
	type DataGridSamplePerson,
} from "@/components/component-gallery/examples/data-grid/data-grid-sample-people";

type PersonCell = CellContext<DataGridFeatures, DataGridSamplePerson>;

function ExpandCell({ row }: PersonCell): React.JSX.Element {
	return <DataGridTableRowExpand row={row} />;
}

function renderPersonDetails(person: DataGridSamplePerson): React.ReactNode {
	return <div className="ms-12 py-3 text-sm text-muted-foreground">{person.details}</div>;
}

function hasPersonDetails(row: Row<DataGridFeatures, DataGridSamplePerson>): boolean {
	return row.original.details.length > 0;
}

function EmptyHeader(): null {
	return null;
}

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

function StatusCell({ row }: PersonCell): React.JSX.Element {
	return row.original.status === "active" ? <Badge variant="success-outline">Approved</Badge> : <Badge variant="warning-outline">Pending</Badge>;
}

const COLUMNS: ColumnDef<DataGridFeatures, DataGridSamplePerson>[] = [
	{ id: "expand", header: EmptyHeader, cell: ExpandCell, size: 25, meta: { expandedContent: renderPersonDetails } },
	{ accessorKey: "name", id: "name", header: "Name", cell: NameCell, size: 150, enableSorting: true, enableHiding: false },
	{ accessorKey: "email", header: "Email", cell: EmailCell, size: 150 },
	{ accessorKey: "location", header: "Location", cell: LocationCell, size: 175, meta: { cellClassName: "text-start" } },
	{ accessorKey: "status", id: "status", header: "Status", cell: StatusCell, size: 100 },
];

const TABLE_LAYOUT: DataGridTableLayout = { headerBackground: false };
const INITIAL_PAGINATION: PaginationState = { pageIndex: 0, pageSize: DATA_GRID_SAMPLE_PAGE_SIZE };
const INITIAL_SORTING: SortingState = [{ id: "name", desc: true }];

export function DataGrid8Example(): React.JSX.Element {
	const [pagination, setPagination] = useState<PaginationState>(INITIAL_PAGINATION);
	const [sorting, setSorting] = useState<SortingState>(INITIAL_SORTING);

	const table = useTable({
		features: dataGridFeatures,
		columns: COLUMNS,
		data: DATA_GRID_SAMPLE_PEOPLE,
		getRowId: getDataGridSamplePersonId,
		getRowCanExpand: hasPersonDetails,
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
