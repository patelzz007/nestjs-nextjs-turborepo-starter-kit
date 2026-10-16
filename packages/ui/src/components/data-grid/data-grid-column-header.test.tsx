// @vitest-environment jsdom
import type { DataGridTableInstance, DataGridTableLayout } from "@workspace/ui/components/data-grid/data-grid";
import { DataGridColumnHeader, getDataGridColumnMoveTargets, moveDataGridColumns } from "@workspace/ui/components/data-grid/data-grid-column-header";
import type { DataGridLabelsOverride } from "@workspace/ui/components/data-grid/data-grid-i18n";
import { DataGridTestHarness, type DataGridTestPerson } from "@workspace/ui/testing/data-grid-test-harness";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

afterEach((): void => {
	cleanup();
});

const MENU_LAYOUT: DataGridTableLayout = { columnsPinnable: true, columnsMovable: true, columnsVisibility: true };
const PIN_ONLY_LAYOUT: DataGridTableLayout = { columnsPinnable: true };
const SORT_LABELS: DataGridLabelsOverride = { sortAscending: "Oplopend" };

interface HeaderOfProps {
	readonly table: DataGridTableInstance<DataGridTestPerson>;
	readonly columnId: string;
	readonly title?: string;
	readonly visibility?: boolean;
	readonly className?: string;
	readonly headerRef?: React.Ref<HTMLDivElement>;
}

/** The header for one column of the live table. */
function HeaderOf({ table, columnId, title, visibility, className, headerRef }: HeaderOfProps): React.JSX.Element | null {
	const column = table.getAllLeafColumns().find((candidate) => candidate.id === columnId);
	if (column === undefined) {
		return null;
	}
	return (
		<DataGridColumnHeader
			column={column}
			{...(title === undefined ? {} : { title })}
			{...(visibility === undefined ? {} : { visibility })}
			{...(className === undefined ? {} : { className })}
			{...(headerRef === undefined ? {} : { ref: headerRef })}
		/>
	);
}

/** Captures the latest table so tests can assert on its state. */
function renderHeaders(
	layout: DataGridTableLayout | undefined,
	columnIds: readonly string[],
	extra: Partial<HeaderOfProps> = {},
	labels?: DataGridLabelsOverride,
): { readonly current: () => DataGridTableInstance<DataGridTestPerson> } {
	const tables: DataGridTableInstance<DataGridTestPerson>[] = [];
	render(
		<DataGridTestHarness {...(layout === undefined ? {} : { tableLayout: layout })} {...(labels === undefined ? {} : { labels })}>
			{(table) => {
				tables.push(table);
				return (
					<>
						{columnIds.map((columnId) => (
							<HeaderOf key={columnId} table={table} columnId={columnId} {...extra} />
						))}
					</>
				);
			}}
		</DataGridTestHarness>,
	);
	return {
		current: (): DataGridTableInstance<DataGridTestPerson> => {
			const latest = tables.at(-1);
			if (latest === undefined) {
				throw new Error("no table rendered");
			}
			return latest;
		},
	};
}

function openMenu(name: string): void {
	act((): void => {
		fireEvent.click(screen.getByRole("button", { name }));
	});
}

function clickMenuItem(name: string): void {
	act((): void => {
		fireEvent.click(screen.getByRole("menuitem", { name }));
	});
}

describe("DataGridColumnHeader", () => {
	it("renders a sort button named by its title and cycles asc → desc → none", (): void => {
		const grid = renderHeaders(undefined, ["name"]);
		const button = screen.getByRole("button", { name: "Name" });
		fireEvent.click(button);
		expect(grid.current().atoms.sorting.get()).toEqual([{ id: "name", desc: false }]);
		fireEvent.click(screen.getByRole("button", { name: "Name" }));
		expect(grid.current().atoms.sorting.get()).toEqual([{ id: "name", desc: true }]);
		fireEvent.click(screen.getByRole("button", { name: "Name" }));
		expect(grid.current().atoms.sorting.get()).toEqual([]);
	});

	it("prefers the explicit title, then meta.headerTitle", (): void => {
		renderHeaders(undefined, ["email"]);
		expect(screen.getByRole("button", { name: "Email address" })).toBeDefined();
		cleanup();
		renderHeaders(undefined, ["email"], { title: "Mail" });
		expect(screen.getByRole("button", { name: "Mail" })).toBeDefined();
	});

	it("sorts from the menu and toggles back off", (): void => {
		const grid = renderHeaders(MENU_LAYOUT, ["age"]);
		openMenu("Age");
		clickMenuItem("Desc");
		expect(grid.current().atoms.sorting.get()).toEqual([{ id: "age", desc: true }]);
		openMenu("Age");
		clickMenuItem("Asc");
		expect(grid.current().atoms.sorting.get()).toEqual([{ id: "age", desc: false }]);
		openMenu("Age");
		clickMenuItem("Asc");
		expect(grid.current().atoms.sorting.get()).toEqual([]);
	});

	it("pins from the menu and unpins with the named unpin button", (): void => {
		const grid = renderHeaders(PIN_ONLY_LAYOUT, ["name"]);
		openMenu("Name");
		clickMenuItem("Pin to left");
		expect(grid.current().atoms.columnPinning.get().start).toEqual(["name"]);
		const unpin = screen.getByRole("button", { name: "Unpin Name column" });
		act((): void => {
			fireEvent.click(unpin);
		});
		expect(grid.current().atoms.columnPinning.get().start).toEqual([]);
		openMenu("Name");
		clickMenuItem("Pin to right");
		expect(grid.current().atoms.columnPinning.get().end).toEqual(["name"]);
	});

	it("moves a column one rendered slot each way", (): void => {
		const grid = renderHeaders(MENU_LAYOUT, ["email"]);
		openMenu("Email address");
		clickMenuItem("Move to right");
		expect(grid.current().atoms.columnOrder.get()).toEqual(["name", "age", "email", "role"]);
		openMenu("Email address");
		clickMenuItem("Move to left");
		expect(grid.current().atoms.columnOrder.get()).toEqual(["name", "email", "age", "role"]);
	});

	it("disables moving past the edge", (): void => {
		renderHeaders(MENU_LAYOUT, ["name"]);
		openMenu("Name");
		expect(screen.getByRole("menuitem", { name: "Move to left" }).getAttribute("aria-disabled")).toBe("true");
		expect(screen.getByRole("menuitem", { name: "Move to right" }).getAttribute("aria-disabled")).toBeNull();
	});

	it("toggles column visibility from the Columns submenu", (): void => {
		const grid = renderHeaders(MENU_LAYOUT, ["name"], { visibility: true });
		openMenu("Name");
		act((): void => {
			fireEvent.click(screen.getByRole("menuitem", { name: "Columns" }));
		});
		const ageItem = screen.getByRole("menuitemcheckbox", { name: "Age" });
		expect(ageItem.getAttribute("aria-checked")).toBe("true");
		act((): void => {
			fireEvent.click(ageItem);
		});
		expect(grid.current().atoms.columnVisibility.get()).toEqual({ age: false });
	});

	it("reads its copy from the grid's labels override", (): void => {
		renderHeaders(MENU_LAYOUT, ["name"], {}, SORT_LABELS);
		openMenu("Name");
		expect(screen.getByRole("menuitem", { name: "Oplopend" })).toBeDefined();
	});

	it("renders a plain label for a column that cannot sort", (): void => {
		const tables: DataGridTableInstance<DataGridTestPerson>[] = [];
		render(
			<DataGridTestHarness tableOptions={{ enableSorting: false }}>
				{(table) => {
					tables.push(table);
					return <HeaderOf table={table} columnId="role" />;
				}}
			</DataGridTestHarness>,
		);
		expect(screen.queryByRole("button")).toBeNull();
		expect(screen.getByText("Role").dataset.slot).toBe("data-grid-column-header");
	});

	it("forwards its ref and merges className last", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		renderHeaders(undefined, ["name"], { headerRef: ref, className: "custom-header" });
		expect(ref.current?.dataset.slot).toBe("data-grid-column-header");
		expect(ref.current?.className.endsWith("custom-header")).toBe(true);
	});
});

describe("column move helpers", () => {
	it("re-seats the moving leaves beside the neighbour, completing a partial order", (): void => {
		expect(moveDataGridColumns([], ["a", "b", "c"], ["a"], ["b"], "after")).toEqual(["b", "a", "c"]);
		expect(moveDataGridColumns(["c"], ["a", "b", "c"], ["b"], ["c"], "before")).toEqual(["b", "c", "a"]);
		expect(moveDataGridColumns([], ["a", "b"], ["a"], ["z"], "after")).toBeNull();
	});

	it("finds the rendered neighbours of a column", (): void => {
		const grid = renderHeaders(undefined, []);
		const email = grid
			.current()
			.getAllLeafColumns()
			.find((column) => column.id === "email");
		if (email === undefined) {
			throw new Error("no email column");
		}
		expect(getDataGridColumnMoveTargets(email)).toEqual({ moving: ["email"], before: ["name"], after: ["age"] });
	});
});
