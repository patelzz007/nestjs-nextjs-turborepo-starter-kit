import { DataGrid, DataGridContainer, DataGridTable, type DataGridRowMove } from "@workspace/ui-native/components/data-grid";
import { DataGridRowHandle } from "@workspace/ui-native/components/data-grid-parts";
import type { DataGridTableLayout } from "@workspace/ui-native/lib/data-grid";
import * as React from "react";

import { COLUMN_WIDTH, EmailCell, PersonCell, usePeopleTable, type PersonColumns } from "./data-grid-sample";
import { DATA_GRID_SAMPLE_PEOPLE, type DataGridSamplePerson } from "./data-grid-sample-people";

const HANDLE_WIDTH = 44;
/** Unsorted and unpaged: the order on screen is the order people set. */
const SHOWN = 6;

const COLUMNS: PersonColumns = [
	{ id: "drag", header: "", cell: () => <DataGridRowHandle />, size: HANDLE_WIDTH, enableSorting: false },
	{ accessorKey: "name", header: "Name", cell: PersonCell, size: COLUMN_WIDTH.person },
	{ accessorKey: "email", header: "Email", cell: EmailCell, size: COLUMN_WIDTH.email },
];

const LAYOUT: DataGridTableLayout = { rowsDraggable: true };

/** `rows` with the moved row taken out and put back at its new place. */
export function moveRow<TRow>(rows: readonly TRow[], move: DataGridRowMove): readonly TRow[] {
	const next = [...rows];
	const [moved] = next.splice(move.from, 1);
	if (moved !== undefined) {
		next.splice(move.to, 0, moved);
	}
	return next;
}

// A grip on each row drags it to a new place (or its move actions, for screen readers); the example keeps the order.
export function DataGrid14Example(): React.JSX.Element {
	const [people, setPeople] = React.useState<readonly DataGridSamplePerson[]>(DATA_GRID_SAMPLE_PEOPLE.slice(0, SHOWN));
	const table = usePeopleTable({ columns: COLUMNS, data: people, pageSize: SHOWN, sorting: [] });
	const reorder = React.useCallback((move: DataGridRowMove): void => {
		setPeople((current) => moveRow(current, move));
	}, []);
	return (
		<DataGrid table={table} recordCount={people.length} tableLayout={LAYOUT} onRowReorder={reorder}>
			<DataGridContainer>
				<DataGridTable />
			</DataGridContainer>
		</DataGrid>
	);
}
