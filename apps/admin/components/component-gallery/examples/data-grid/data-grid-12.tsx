"use client";

import * as React from "react";
import { useState } from "react";
import { Badge } from "@workspace/ui/components/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { DataGrid, DataGridContainer, dataGridFeatures, type DataGridFeatures, type DataGridTableLayout } from "@workspace/ui/components/data-grid/data-grid";
import { DataGridColumnHeader } from "@workspace/ui/components/data-grid/data-grid-column-header";
import { DataGridPagination } from "@workspace/ui/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@workspace/ui/components/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@workspace/ui/components/data-grid/data-grid-table";
import { useTable, type CellContext, type ColumnDef, type ColumnOrderState, type HeaderContext, type PaginationState, type SortingState } from "@tanstack/react-table";

import {
	DATA_GRID_SAMPLE_PAGE_SIZE,
	DATA_GRID_SAMPLE_PEOPLE,
	getDataGridSampleInitials,
	getDataGridSamplePersonId,
	type DataGridSamplePerson,
} from "@/components/component-gallery/examples/data-grid/data-grid-sample-people";

type PersonCell = CellContext<DataGridFeatures, DataGridSamplePerson>;
type PersonHeader = HeaderContext<DataGridFeatures, DataGridSamplePerson>;

function StaffHeader({ column }: PersonHeader): React.JSX.Element {
	return <DataGridColumnHeader title="Staff" column={column} />;
}

function CompanyHeader({ column }: PersonHeader): React.JSX.Element {
	return <DataGridColumnHeader title="Company" column={column} />;
}

function OccupationHeader({ column }: PersonHeader): React.JSX.Element {
	return <DataGridColumnHeader title="Occupation" column={column} />;
}

function PersonCellContent({ row }: PersonCell): React.JSX.Element {
	return (
		<div className="flex items-center gap-3">
			<Avatar className="size-8">
				<AvatarImage src={row.original.avatar} alt={row.original.name} />
				<AvatarFallback>{getDataGridSampleInitials(row.original.name)}</AvatarFallback>
			</Avatar>
			<div className="space-y-px">
				<div className="font-medium text-foreground">{row.original.name}</div>
				<div className="text-muted-foreground">{row.original.email}</div>
			</div>
		</div>
	);
}

function CompanyCell({ row }: PersonCell): React.JSX.Element {
	return <span>{row.original.company}</span>;
}

function RoleCell({ row }: PersonCell): React.JSX.Element {
	return <span>{row.original.role}</span>;
}

function StatusCell({ row }: PersonCell): React.JSX.Element {
	return row.original.status === "active" ? <Badge variant="success-light">Approved</Badge> : <Badge variant="warning-light">Pending</Badge>;
}

const COLUMNS: ColumnDef<DataGridFeatures, DataGridSamplePerson>[] = [
	{ accessorKey: "name", id: "name", header: StaffHeader, cell: PersonCellContent, size: 200, enableSorting: true, enableHiding: false },
	{ accessorKey: "company", id: "company", header: CompanyHeader, cell: CompanyCell, size: 125, enableSorting: true, enableHiding: false },
	{ accessorKey: "role", id: "role", header: OccupationHeader, cell: RoleCell, size: 150, enableSorting: true, enableHiding: false },
	{ accessorKey: "status", id: "status", header: "Status", cell: StatusCell, size: 100 },
];

const TABLE_LAYOUT: DataGridTableLayout = { columnsMovable: true };
const INITIAL_COLUMN_ORDER: ColumnOrderState = ["name", "company", "role", "status"];
const INITIAL_PAGINATION: PaginationState = { pageIndex: 0, pageSize: DATA_GRID_SAMPLE_PAGE_SIZE };
const INITIAL_SORTING: SortingState = [{ id: "name", desc: true }];

export function DataGrid12Example(): React.JSX.Element {
	const [pagination, setPagination] = useState<PaginationState>(INITIAL_PAGINATION);
	const [sorting, setSorting] = useState<SortingState>(INITIAL_SORTING);
	const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(INITIAL_COLUMN_ORDER);

	const table = useTable({
		features: dataGridFeatures,
		columns: COLUMNS,
		data: DATA_GRID_SAMPLE_PEOPLE,
		getRowId: getDataGridSamplePersonId,
		state: { pagination, sorting, columnOrder },
		onColumnOrderChange: setColumnOrder,
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
