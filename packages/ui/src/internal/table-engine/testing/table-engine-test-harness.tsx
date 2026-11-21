"use client";

// Test-only scaffolding shared by the table-engine family's colocated tests: a
// small typed data set, its column defs, a harness component that builds a
// real `useTable` over `tableEngineFeatures` and mounts `<TableEngine>` around the
// parts under test, and stubs for the browser APIs jsdom does not implement.

import { TableEngine, tableEngineFeatures, type TableEngineFeatures, type TableEngineProps, type TableEngineTableInstance } from "../table-engine";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { useTable, type ColumnDef, type TableOptions } from "@tanstack/react-table";
import * as React from "react";

export interface TableEngineTestPerson {
	readonly id: string;
	readonly name: string;
	readonly email: string;
	readonly age: number;
	readonly role: string;
}

export const TABLE_ENGINE_TEST_PEOPLE: readonly TableEngineTestPerson[] = [
	{ id: "p-1", name: "Alex Johnson", email: "alex@example.com", age: 34, role: "Engineer" },
	{ id: "p-2", name: "Sarah Chen", email: "sarah@example.com", age: 28, role: "Designer" },
	{ id: "p-3", name: "Michael Rodriguez", email: "michael@example.com", age: 45, role: "Engineer" },
	{ id: "p-4", name: "Emma Wilson", email: "emma@example.com", age: 31, role: "Manager" },
	{ id: "p-5", name: "David Kim", email: "david@example.com", age: 39, role: "Designer" },
];

export const TABLE_ENGINE_TEST_COLUMNS: ColumnDef<TableEngineFeatures, TableEngineTestPerson>[] = [
	{ accessorKey: "name", header: "Name", size: 160 },
	{ accessorKey: "email", header: "Email", size: 200, meta: { headerTitle: "Email address" } },
	{ accessorKey: "age", header: "Age", size: 80 },
	{ accessorKey: "role", header: "Role", size: 120 },
];

function getTestPersonId(person: TableEngineTestPerson): string {
	return person.id;
}

/** Extra `useTable` options a test layers over the harness defaults. */
export type TableEngineTestTableOptions = Partial<Omit<TableOptions<TableEngineFeatures, TableEngineTestPerson>, "features" | "columns" | "data">>;

export interface TableEngineTestHarnessProps extends Partial<Omit<TableEngineProps<TableEngineTestPerson>, "table" | "children">> {
	readonly data?: readonly TableEngineTestPerson[];
	readonly columns?: ColumnDef<TableEngineFeatures, TableEngineTestPerson>[];
	readonly tableOptions?: TableEngineTestTableOptions;
	/** The grid parts under test; a function receives the live table. */
	readonly children?: React.ReactNode | ((table: TableEngineTableInstance<TableEngineTestPerson>) => React.ReactNode);
}

/** A real grid over the test data set, wrapped in the English label pack. */
export function TableEngineTestHarness({
	data = TABLE_ENGINE_TEST_PEOPLE,
	columns = TABLE_ENGINE_TEST_COLUMNS,
	tableOptions,
	children,
	recordCount,
	...gridProps
}: TableEngineTestHarnessProps): React.JSX.Element {
	const mutableData = React.useMemo((): TableEngineTestPerson[] => [...data], [data]);
	const table = useTable({
		getRowId: getTestPersonId,
		...tableOptions,
		features: tableEngineFeatures,
		columns,
		data: mutableData,
	});
	const content = children instanceof Function ? children(table) : children;
	return (
		<UiKitTestProviders>
			<TableEngine table={table} recordCount={recordCount ?? mutableData.length} {...gridProps}>
				{content}
			</TableEngine>
		</UiKitTestProviders>
	);
}

function noop(): void {
	// Stubbed browser API: nothing to observe in jsdom.
}

/** jsdom has no ResizeObserver; the grid's viewports observe their containers with one. */
export class TableEngineResizeObserverStub {
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
