"use client";

import * as React from "react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { DataGrid, DataGridContainer, dataGridFeatures, type DataGridFeatures } from "@workspace/ui/components/data-grid/data-grid";
import { DataGridColumnHeader } from "@workspace/ui/components/data-grid/data-grid-column-header";
import { DataGridPagination } from "@workspace/ui/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@workspace/ui/components/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@workspace/ui/components/data-grid/data-grid-table";
import { useTable, type CellContext, type ColumnDef, type HeaderContext, type PaginationState, type SortingState } from "@tanstack/react-table";

import {
	DATA_GRID_SAMPLE_PAGE_SIZE,
	DATA_GRID_SAMPLE_PEOPLE,
	formatDataGridSampleBalance,
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

function DividendHeader({ column }: PersonHeader): React.JSX.Element {
	return <DataGridColumnHeader title="Dividend" column={column} />;
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

function DividendCell({ row }: PersonCell): React.JSX.Element {
	return <span>{formatDataGridSampleBalance(row.original.balance)}</span>;
}

const COLUMNS: ColumnDef<DataGridFeatures, DataGridSamplePerson>[] = [
	{ accessorKey: "name", id: "name", header: StaffHeader, cell: PersonCellContent, size: 200, enableSorting: true, enableHiding: false },
	{ accessorKey: "company", header: CompanyHeader, cell: CompanyCell, size: 100, enableSorting: true, enableHiding: false },
	{ accessorKey: "role", header: OccupationHeader, cell: RoleCell, size: 150, enableSorting: true, enableHiding: false },
	{
		accessorKey: "balance",
		header: DividendHeader,
		cell: DividendCell,
		size: 120,
		meta: { cellClassName: "font-semibold" },
		enableSorting: true,
		enableHiding: false,
	},
];

const INITIAL_PAGINATION: PaginationState = { pageIndex: 0, pageSize: DATA_GRID_SAMPLE_PAGE_SIZE };
const INITIAL_SORTING: SortingState = [{ id: "name", desc: true }];

export function DataGrid11Example(): React.JSX.Element {
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
