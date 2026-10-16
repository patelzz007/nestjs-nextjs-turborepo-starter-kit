"use client";

import * as React from "react";
import { MailIcon, MapPinCheckInsideIcon, UserIcon } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { DataGrid, DataGridContainer, dataGridFeatures, type DataGridFeatures } from "@workspace/ui/components/data-grid/data-grid";
import { DataGridColumnHeader } from "@workspace/ui/components/data-grid/data-grid-column-header";
import { DataGridPagination } from "@workspace/ui/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@workspace/ui/components/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@workspace/ui/components/data-grid/data-grid-table";
import { useTable, type CellContext, type ColumnDef, type HeaderContext, type PaginationState, type SortingState } from "@tanstack/react-table";

import {
	DATA_GRID_SAMPLE_FLAGS,
	DATA_GRID_SAMPLE_PAGE_SIZE,
	DATA_GRID_SAMPLE_PEOPLE,
	getDataGridSampleInitials,
	getDataGridSamplePersonId,
	type DataGridSamplePerson,
} from "@/components/component-gallery/examples/data-grid/data-grid-sample-people";

type PersonCell = CellContext<DataGridFeatures, DataGridSamplePerson>;
type PersonHeader = HeaderContext<DataGridFeatures, DataGridSamplePerson>;

const USER_ICON: React.ReactNode = <UserIcon aria-hidden="true" />;
const MAIL_ICON: React.ReactNode = <MailIcon aria-hidden="true" />;
const LOCATION_ICON: React.ReactNode = <MapPinCheckInsideIcon aria-hidden="true" />;

function UserHeader({ column }: PersonHeader): React.JSX.Element {
	return <DataGridColumnHeader title="User" icon={USER_ICON} column={column} />;
}

function EmailHeader({ column }: PersonHeader): React.JSX.Element {
	return <DataGridColumnHeader title="Email" icon={MAIL_ICON} column={column} />;
}

function LocationHeader({ column }: PersonHeader): React.JSX.Element {
	return <DataGridColumnHeader title="Location" icon={LOCATION_ICON} column={column} />;
}

function PersonCellContent({ row }: PersonCell): React.JSX.Element {
	return (
		<div className="flex items-center gap-3">
			<Avatar className="size-8">
				<AvatarImage src={row.original.avatar} alt={row.original.name} />
				<AvatarFallback>{getDataGridSampleInitials(row.original.name)}</AvatarFallback>
			</Avatar>
			<div>
				<div className="font-medium text-foreground">{row.original.name}</div>
				<div className="text-muted-foreground">{row.original.email}</div>
			</div>
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

const COLUMNS: ColumnDef<DataGridFeatures, DataGridSamplePerson>[] = [
	{ accessorKey: "name", id: "name", header: UserHeader, cell: PersonCellContent, size: 250, enableSorting: false, enableHiding: false },
	{ accessorKey: "email", header: EmailHeader, cell: EmailCell, size: 150, enableSorting: false },
	{ accessorKey: "location", header: LocationHeader, cell: LocationCell, size: 150, enableSorting: false },
];

const INITIAL_PAGINATION: PaginationState = { pageIndex: 0, pageSize: DATA_GRID_SAMPLE_PAGE_SIZE };
const INITIAL_SORTING: SortingState = [{ id: "name", desc: true }];

export function DataGrid10Example(): React.JSX.Element {
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
