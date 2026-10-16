"use client";

import * as React from "react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Card } from "@workspace/ui/components/card";
import { DataGrid, DataGridContainer, dataGridFeatures, type DataGridFeatures, type DataGridTableLayout } from "@workspace/ui/components/data-grid/data-grid";
import { DataGridPagination } from "@workspace/ui/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@workspace/ui/components/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@workspace/ui/components/data-grid/data-grid-table";
import { useTable, type CellContext, type ColumnDef, type ColumnOrderState, type PaginationState, type SortingState } from "@tanstack/react-table";

import {
	DATA_GRID_SAMPLE_PAGE_SIZE,
	DATA_GRID_SAMPLE_PEOPLE,
	formatDataGridSampleBalance,
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

function SalaryCell({ row }: PersonCell): React.JSX.Element {
	return <span className="font-semibold">{formatDataGridSampleBalance(row.original.balance)}</span>;
}

const COLUMNS: ColumnDef<DataGridFeatures, DataGridSamplePerson>[] = [
	{ accessorKey: "name", id: "name", header: "Name", cell: PersonCellContent, size: 250, enableSorting: true, enableHiding: false },
	{ accessorKey: "company", header: "Company", cell: CompanyCell, size: 100 },
	{ accessorKey: "role", header: "Occupation", cell: RoleCell, size: 100 },
	{ accessorKey: "balance", header: "Salary", cell: SalaryCell, size: 100 },
];

const TABLE_LAYOUT: DataGridTableLayout = { cellBorder: true };
const INITIAL_PAGINATION: PaginationState = { pageIndex: 0, pageSize: DATA_GRID_SAMPLE_PAGE_SIZE };
const INITIAL_SORTING: SortingState = [{ id: "name", desc: true }];
const INITIAL_COLUMN_ORDER: ColumnOrderState = [];

export function DataGrid2Example(): React.JSX.Element {
	const [pagination, setPagination] = useState<PaginationState>(INITIAL_PAGINATION);
	const [sorting, setSorting] = useState<SortingState>(INITIAL_SORTING);
	const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(INITIAL_COLUMN_ORDER);

	const table = useTable({
		features: dataGridFeatures,
		columns: COLUMNS,
		data: DATA_GRID_SAMPLE_PEOPLE,
		getRowId: getDataGridSamplePersonId,
		state: { pagination, sorting, columnOrder },
		onPaginationChange: setPagination,
		onSortingChange: setSorting,
		onColumnOrderChange: setColumnOrder,
	});

	return (
		<DataGrid table={table} recordCount={DATA_GRID_SAMPLE_PEOPLE.length} tableLayout={TABLE_LAYOUT}>
			<div className="w-full space-y-2.5">
				<Card className="p-0">
					<DataGridContainer>
						<DataGridScrollArea>
							<DataGridTable />
						</DataGridScrollArea>
					</DataGridContainer>
				</Card>
				<DataGridPagination />
			</div>
		</DataGrid>
	);
}
