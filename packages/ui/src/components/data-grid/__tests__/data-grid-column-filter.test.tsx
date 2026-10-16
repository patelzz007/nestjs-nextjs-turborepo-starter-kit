// @vitest-environment jsdom
import type { DataGridFeatures, DataGridTableInstance } from "@workspace/ui/components/data-grid/data-grid";
import {
	DataGridColumnFilter,
	dataGridColumnFilterFn,
	filterDataGridColumnFilterOptions,
	readDataGridColumnFilterValues,
	toggleDataGridColumnFilterValue,
	type DataGridColumnFilterOption,
} from "@workspace/ui/components/data-grid/data-grid-column-filter";
import type { DataGridLabelsOverride } from "@workspace/ui/components/data-grid/data-grid-i18n";
import { DATA_GRID_TEST_COLUMNS, DataGridTestHarness, type DataGridTestPerson } from "@workspace/ui/testing/data-grid-test-harness";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

afterEach((): void => {
	cleanup();
});

const ROLE_OPTIONS: readonly DataGridColumnFilterOption[] = [
	{ label: "Engineer", value: "Engineer" },
	{ label: "Designer", value: "Designer" },
	{ label: "Manager", value: "Manager" },
];

const FILTER_COLUMNS: ColumnDef<DataGridFeatures, DataGridTestPerson>[] = [
	...DATA_GRID_TEST_COLUMNS.filter((column) => column.id !== "role" && !("accessorKey" in column && column.accessorKey === "role")),
	{ accessorKey: "role", header: "Role", filterFn: dataGridColumnFilterFn },
];

const FILTER_LABELS: DataGridLabelsOverride = { filterNoResults: "Niets gevonden", filterClear: "Wissen" };

function renderFilter(labels?: DataGridLabelsOverride, filterRef?: React.Ref<HTMLButtonElement>): { readonly current: () => DataGridTableInstance<DataGridTestPerson> } {
	const tables: DataGridTableInstance<DataGridTestPerson>[] = [];
	render(
		<DataGridTestHarness columns={FILTER_COLUMNS} {...(labels === undefined ? {} : { labels })}>
			{(table) => {
				tables.push(table);
				const column = table.getAllLeafColumns().find((candidate) => candidate.id === "role");
				return <DataGridColumnFilter column={column} title="Role" options={ROLE_OPTIONS} {...(filterRef === undefined ? {} : { ref: filterRef })} />;
			}}
		</DataGridTestHarness>,
	);
	return {
		current: (): DataGridTableInstance<DataGridTestPerson> => {
			const latest = tables.at(-1);
			if (latest === undefined) {
				throw new Error("no table");
			}
			return latest;
		},
	};
}

function openFilter(): void {
	act((): void => {
		fireEvent.click(screen.getByRole("button", { name: "Role" }));
	});
}

describe("DataGridColumnFilter", () => {
	it("lists every option with its faceted count", (): void => {
		renderFilter();
		openFilter();
		const engineer = screen.getByRole("button", { name: "Engineer 2" });
		expect(engineer.getAttribute("aria-pressed")).toBe("false");
		expect(screen.getByRole("button", { name: "Manager 1" })).toBeDefined();
	});

	it("selects options into the column filter and filters the rows", (): void => {
		const grid = renderFilter();
		openFilter();
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Engineer 2" }));
		});
		expect(grid.current().getColumn("role")?.getFilterValue()).toEqual(["Engineer"]);
		expect(
			grid
				.current()
				.getRowModel()
				.rows.map((row) => row.id),
		).toEqual(["p-1", "p-3"]);
		expect(screen.getByRole("button", { name: "Engineer 2" }).getAttribute("aria-pressed")).toBe("true");
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Manager 1" }));
		});
		expect(grid.current().getColumn("role")?.getFilterValue()).toEqual(["Engineer", "Manager"]);
	});

	it("clears the filter with the clear action", (): void => {
		const grid = renderFilter(FILTER_LABELS);
		openFilter();
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Designer 2" }));
		});
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Wissen" }));
		});
		expect(grid.current().getColumn("role")?.getFilterValue()).toBeUndefined();
		expect(screen.queryByRole("button", { name: "Wissen" })).toBeNull();
	});

	it("searches the options and shows the no-results label", (): void => {
		renderFilter(FILTER_LABELS);
		openFilter();
		const search = screen.getByRole("textbox", { name: "Role" });
		fireEvent.change(search, { target: { value: "des" } });
		expect(screen.getByRole("button", { name: "Designer 2" })).toBeDefined();
		expect(screen.queryByRole("button", { name: "Engineer 2" })).toBeNull();
		fireEvent.change(search, { target: { value: "zzz" } });
		expect(screen.getByText("Niets gevonden")).toBeDefined();
	});

	it("forwards its ref to the trigger button", (): void => {
		const ref = React.createRef<HTMLButtonElement>();
		renderFilter(undefined, ref);
		expect(ref.current?.textContent).toContain("Role");
	});
});

describe("column filter helpers", () => {
	it("reads only a string array as the selection", (): void => {
		expect(readDataGridColumnFilterValues(["a", "b"])).toEqual(["a", "b"]);
		expect(readDataGridColumnFilterValues("a")).toEqual([]);
		expect(readDataGridColumnFilterValues(undefined)).toEqual([]);
	});

	it("toggles a value in and out, clearing an empty selection", (): void => {
		expect(toggleDataGridColumnFilterValue([], "a")).toEqual(["a"]);
		expect(toggleDataGridColumnFilterValue(["a", "b"], "a")).toEqual(["b"]);
		expect(toggleDataGridColumnFilterValue(["a"], "a")).toBeUndefined();
	});

	it("matches option labels case-insensitively", (): void => {
		expect(filterDataGridColumnFilterOptions(ROLE_OPTIONS, "MAN").map((option) => option.value)).toEqual(["Manager"]);
		expect(filterDataGridColumnFilterOptions(ROLE_OPTIONS, "")).toBe(ROLE_OPTIONS);
	});
});
