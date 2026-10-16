// @vitest-environment jsdom
import { Button } from "@workspace/ui/components/button";
import type { DataGridTableInstance } from "@workspace/ui/components/data-grid/data-grid";
import { DataGridColumnVisibility } from "@workspace/ui/components/data-grid/data-grid-column-visibility";
import type { DataGridLabelsOverride } from "@workspace/ui/components/data-grid/data-grid-i18n";
import { DataGridTestHarness, type DataGridTestPerson } from "@workspace/ui/testing/data-grid-test-harness";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

afterEach((): void => {
	cleanup();
});

const TRIGGER: React.JSX.Element = <Button variant="outline">Columns</Button>;
const VISIBILITY_LABELS: DataGridLabelsOverride = { toggleColumns: "Kolommen tonen" };

function renderVisibility(labels?: DataGridLabelsOverride, triggerRef?: React.Ref<HTMLButtonElement>): { readonly current: () => DataGridTableInstance<DataGridTestPerson> } {
	const tables: DataGridTableInstance<DataGridTestPerson>[] = [];
	render(
		<DataGridTestHarness {...(labels === undefined ? {} : { labels })}>
			{(table) => {
				tables.push(table);
				return <DataGridColumnVisibility table={table} trigger={TRIGGER} {...(triggerRef === undefined ? {} : { ref: triggerRef })} />;
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

function openMenu(): void {
	act((): void => {
		fireEvent.click(screen.getByRole("button", { name: "Columns" }));
	});
}

describe("DataGridColumnVisibility", () => {
	it("lists every hideable column by its header label, checked while visible", (): void => {
		renderVisibility();
		openMenu();
		expect(screen.getByText("Toggle columns")).toBeDefined();
		const items = screen.getAllByRole("menuitemcheckbox");
		expect(items.map((item) => item.textContent)).toEqual(["Name", "Email address", "Age", "Role"]);
		expect(items.every((item) => item.getAttribute("aria-checked") === "true")).toBe(true);
	});

	it("toggles a column's visibility and keeps the menu open", (): void => {
		const grid = renderVisibility();
		openMenu();
		act((): void => {
			fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Age" }));
		});
		expect(grid.current().atoms.columnVisibility.get()).toEqual({ age: false });
		const age = screen.getByRole("menuitemcheckbox", { name: "Age" });
		expect(age.getAttribute("aria-checked")).toBe("false");
		act((): void => {
			fireEvent.click(age);
		});
		expect(grid.current().atoms.columnVisibility.get()).toEqual({ age: true });
	});

	it("reads its heading from the labels override", (): void => {
		renderVisibility(VISIBILITY_LABELS);
		openMenu();
		expect(screen.getByText("Kolommen tonen")).toBeDefined();
	});

	it("forwards its ref to the rendered trigger", (): void => {
		const ref = React.createRef<HTMLButtonElement>();
		renderVisibility(undefined, ref);
		expect(ref.current?.textContent).toBe("Columns");
	});
});
