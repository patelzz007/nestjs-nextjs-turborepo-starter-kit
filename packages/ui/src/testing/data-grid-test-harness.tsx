"use client";

// Test-only scaffolding shared by the data-grid family's colocated tests: a
// small typed data set, its column defs, a harness component that builds a
// real `useTable` over `dataGridFeatures` and mounts `<DataGrid>` around the
// parts under test, and stubs for the browser APIs jsdom does not implement.

import { DataGrid, dataGridFeatures, type DataGridFeatures, type DataGridProps, type DataGridTableInstance } from "@workspace/ui/components/data-grid/data-grid";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { useTable, type ColumnDef, type TableOptions } from "@tanstack/react-table";
import * as React from "react";

export interface DataGridTestPerson {
	readonly id: string;
	readonly name: string;
	readonly email: string;
	readonly age: number;
	readonly role: string;
}

export const DATA_GRID_TEST_PEOPLE: readonly DataGridTestPerson[] = [
	{ id: "p-1", name: "Alex Johnson", email: "alex@example.com", age: 34, role: "Engineer" },
	{ id: "p-2", name: "Sarah Chen", email: "sarah@example.com", age: 28, role: "Designer" },
	{ id: "p-3", name: "Michael Rodriguez", email: "michael@example.com", age: 45, role: "Engineer" },
	{ id: "p-4", name: "Emma Wilson", email: "emma@example.com", age: 31, role: "Manager" },
	{ id: "p-5", name: "David Kim", email: "david@example.com", age: 39, role: "Designer" },
];

export const DATA_GRID_TEST_COLUMNS: ColumnDef<DataGridFeatures, DataGridTestPerson>[] = [
	{ accessorKey: "name", header: "Name", size: 160 },
	{ accessorKey: "email", header: "Email", size: 200, meta: { headerTitle: "Email address" } },
	{ accessorKey: "age", header: "Age", size: 80 },
	{ accessorKey: "role", header: "Role", size: 120 },
];

function getTestPersonId(person: DataGridTestPerson): string {
	return person.id;
}

/** Extra `useTable` options a test layers over the harness defaults. */
export type DataGridTestTableOptions = Partial<Omit<TableOptions<DataGridFeatures, DataGridTestPerson>, "features" | "columns" | "data">>;

export interface DataGridTestHarnessProps extends Partial<Omit<DataGridProps<DataGridTestPerson>, "table" | "children">> {
	readonly data?: readonly DataGridTestPerson[];
	readonly columns?: ColumnDef<DataGridFeatures, DataGridTestPerson>[];
	readonly tableOptions?: DataGridTestTableOptions;
	/** The grid parts under test; a function receives the live table. */
	readonly children?: React.ReactNode | ((table: DataGridTableInstance<DataGridTestPerson>) => React.ReactNode);
}

/** A real grid over the test data set, wrapped in the English label pack. */
export function DataGridTestHarness({
	data = DATA_GRID_TEST_PEOPLE,
	columns = DATA_GRID_TEST_COLUMNS,
	tableOptions,
	children,
	recordCount,
	...gridProps
}: DataGridTestHarnessProps): React.JSX.Element {
	const mutableData = React.useMemo((): DataGridTestPerson[] => [...data], [data]);
	const table = useTable({
		getRowId: getTestPersonId,
		...tableOptions,
		features: dataGridFeatures,
		columns,
		data: mutableData,
	});
	const content = children instanceof Function ? children(table) : children;
	return (
		<UiKitTestProviders>
			<DataGrid table={table} recordCount={recordCount ?? mutableData.length} {...gridProps}>
				{content}
			</DataGrid>
		</UiKitTestProviders>
	);
}

function noop(): void {
	// Stubbed browser API: nothing to observe in jsdom.
}

/** jsdom has no ResizeObserver; the grid's viewports observe their containers with one. */
export class DataGridResizeObserverStub {
	public observe(): void {
		noop();
	}

	public unobserve(): void {
		noop();
	}

	public disconnect(): void {
		noop();
	}
}
