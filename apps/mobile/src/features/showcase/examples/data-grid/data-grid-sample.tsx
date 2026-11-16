// What the DataGrid examples share: the sample people's cells (a person with an avatar and a presence dot, an email,
// a flag and a country, a balance, a status badge), a hook that builds a paged, sorted table over them, and a grid in
// its frame with a pager below (most of the basic examples are only a column set and a layout).

import { useTable, type CellContext, type ColumnDef, type PaginationState, type SortingState, type TableOptions } from "@tanstack/react-table";
import { Avatar } from "@workspace/ui-native/components/avatar";
import { Badge } from "@workspace/ui-native/components/badge";
import { DataGrid, DataGridContainer, DataGridTable, type DataGridTableProps } from "@workspace/ui-native/components/data-grid";
import { DataGridPagination } from "@workspace/ui-native/components/data-grid-parts";
import { dataGridFeatures, type DataGridFeatures, type DataGridTableInstance, type DataGridTableLayout } from "@workspace/ui-native/lib/data-grid";
import * as React from "react";
import { Text, View } from "react-native";

import {
	DATA_GRID_SAMPLE_AVAILABILITY_CLASS_NAMES,
	DATA_GRID_SAMPLE_FLAGS,
	DATA_GRID_SAMPLE_PAGE_SIZE,
	DATA_GRID_SAMPLE_PEOPLE,
	formatDataGridSampleBalance,
	getDataGridSamplePersonId,
	type DataGridSamplePerson,
} from "./data-grid-sample-people";
import { formatUsd, type Employee, type EmployeeStatus } from "./data-grid-sample-records";

export type PersonCellProps = CellContext<DataGridFeatures, DataGridSamplePerson>;
export type PersonColumns = ColumnDef<DataGridFeatures, DataGridSamplePerson>[];

/** A person: their avatar with a presence dot, their name, and (with `withEmail`) their email under it. */
export function PersonSummary({ person, withEmail = false }: { readonly person: DataGridSamplePerson; readonly withEmail?: boolean }): React.JSX.Element {
	return (
		<View className="flex-row items-center gap-2.5">
			<View>
				<Avatar name={person.name} imageUrl={person.avatar} size="sm" />
				<View
					className={`absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-background ${DATA_GRID_SAMPLE_AVAILABILITY_CLASS_NAMES[person.availability]}`}
				/>
			</View>
			<View className="min-w-0 flex-1">
				<Text numberOfLines={1} className="text-label font-sans-medium text-foreground">
					{person.name}
				</Text>
				{withEmail ? (
					<Text numberOfLines={1} className="text-caption font-sans text-muted-foreground">
						{person.email}
					</Text>
				) : null}
			</View>
		</View>
	);
}

export function PersonCell({ row }: PersonCellProps): React.JSX.Element {
	return <PersonSummary person={row.original} withEmail />;
}

export function NameCell({ row }: PersonCellProps): React.JSX.Element {
	return (
		<Text numberOfLines={1} className="text-label font-sans-medium text-foreground">
			{row.original.name}
		</Text>
	);
}

export function EmailCell({ row }: PersonCellProps): React.JSX.Element {
	return (
		<Text numberOfLines={1} className="text-label font-sans text-muted-foreground">
			{row.original.email}
		</Text>
	);
}

export function LocationCell({ row }: PersonCellProps): React.JSX.Element {
	return (
		<View className="flex-row items-center gap-1.5">
			<Text accessibilityLabel={row.original.location}>{DATA_GRID_SAMPLE_FLAGS[row.original.flag]}</Text>
			<Text numberOfLines={1} className="text-label font-sans text-foreground">
				{row.original.location}
			</Text>
		</View>
	);
}

export function BalanceCell({ row }: PersonCellProps): React.JSX.Element {
	return <Text className="text-label font-sans-medium text-foreground tabular-nums">{formatDataGridSampleBalance(row.original.balance)}</Text>;
}

export function StatusCell({ row }: PersonCellProps): React.JSX.Element {
	return row.original.status === "active" ? (
		<Badge label="Active" tone="success" variant="light" size="sm" />
	) : (
		<Badge label="Inactive" tone="neutral" variant="light" size="sm" />
	);
}

/** Widths every basic example gives its columns, in points. */
export const COLUMN_WIDTH = { person: 200, name: 150, email: 190, location: 170, balance: 120, status: 110, short: 130 } satisfies Record<string, number>;

/** The name column every basic example sorts by, newest first as on the web. */
export const INITIAL_SORTING: SortingState = [{ id: "name", desc: true }];

export interface PeopleTableOptions {
	readonly columns: PersonColumns;
	readonly data?: readonly DataGridSamplePerson[] | undefined;
	readonly pageSize?: number | undefined;
	readonly sorting?: SortingState | undefined;
	readonly options?: Partial<TableOptions<DataGridFeatures, DataGridSamplePerson>> | undefined;
}

/** A table over the sample people, paged and sorted in its own state. */
export function usePeopleTable({
	columns,
	data = DATA_GRID_SAMPLE_PEOPLE,
	pageSize = DATA_GRID_SAMPLE_PAGE_SIZE,
	sorting: initialSorting = INITIAL_SORTING,
	options,
}: PeopleTableOptions): DataGridTableInstance<DataGridSamplePerson> {
	const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize });
	const [sorting, setSorting] = React.useState<SortingState>(initialSorting);
	return useTable({
		features: dataGridFeatures,
		columns,
		data,
		getRowId: getDataGridSamplePersonId,
		state: { pagination, sorting },
		onPaginationChange: setPagination,
		onSortingChange: setSorting,
		...options,
	});
}

export interface PeopleGridProps extends PeopleTableOptions {
	readonly layout?: DataGridTableLayout | undefined;
	readonly tableProps?: DataGridTableProps | undefined;
	/** The grid's frame (a rounded border). Default `true`. */
	readonly border?: boolean | undefined;
}

/** The basic examples' grid: the people in a frame, with the pager below. */
export function PeopleGrid({ layout, tableProps, border, ...table }: PeopleGridProps): React.JSX.Element {
	const grid = usePeopleTable(table);
	return (
		<DataGrid table={grid} recordCount={table.data?.length ?? DATA_GRID_SAMPLE_PEOPLE.length} tableLayout={layout}>
			<View className="w-full gap-2.5">
				<DataGridContainer border={border}>
					<DataGridTable {...tableProps} />
				</DataGridContainer>
				<DataGridPagination />
			</View>
		</DataGrid>
	);
}

// ── Employees ──────────────────────────────────────────────────────────────

export type EmployeeCellProps = CellContext<DataGridFeatures, Employee>;
export type EmployeeColumns = ColumnDef<DataGridFeatures, Employee>[];

const EMPLOYEE_TONES: Readonly<Record<EmployeeStatus, "success" | "neutral" | "warning" | "destructive">> = {
	Active: "success",
	Inactive: "neutral",
	Pending: "warning",
	Blocked: "destructive",
};

export function EmployeeStatusBadge({ status }: { readonly status: EmployeeStatus }): React.JSX.Element {
	return <Badge label={status} tone={EMPLOYEE_TONES[status]} variant="outline" size="sm" />;
}

export function EmployeeCell({ row }: EmployeeCellProps): React.JSX.Element {
	return (
		<View className="flex-row items-center gap-2.5">
			<Avatar name={row.original.name} imageUrl={null} size="sm" />
			<View className="min-w-0 flex-1">
				<Text numberOfLines={1} className="text-label font-sans-medium text-foreground">
					{row.original.name}
				</Text>
				<Text numberOfLines={1} className="text-caption font-sans text-muted-foreground">
					{row.original.role}
				</Text>
			</View>
		</View>
	);
}

export function EmployeeStatusCell({ row }: EmployeeCellProps): React.JSX.Element {
	return <EmployeeStatusBadge status={row.original.status} />;
}

export function EmployeeBalanceCell({ row }: EmployeeCellProps): React.JSX.Element {
	return <Text className="text-label font-sans-medium text-foreground tabular-nums">{formatUsd(row.original.balance)}</Text>;
}
