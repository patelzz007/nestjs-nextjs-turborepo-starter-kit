// @vitest-environment jsdom
import { Button } from "@workspace/ui/components/button";
import type { TableEngineTableInstance } from "../table-engine";
import { TableEngineColumnVisibility } from "../table-engine-column-visibility";
import type { TableEngineLabelsOverride } from "../table-engine-i18n";
import { TableEngineTestHarness, type TableEngineTestPerson } from "../testing/table-engine-test-harness";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

afterEach((): void => {
	cleanup();
});

const TRIGGER: React.JSX.Element = <Button variant="outline">Columns</Button>;
const VISIBILITY_LABELS: TableEngineLabelsOverride = { toggleColumns: "Kolommen tonen" };

function renderVisibility(
	labels?: TableEngineLabelsOverride,
	triggerRef?: React.Ref<HTMLButtonElement>,
): { readonly current: () => TableEngineTableInstance<TableEngineTestPerson> } {
	const tables: TableEngineTableInstance<TableEngineTestPerson>[] = [];
	render(
		<TableEngineTestHarness {...(labels === undefined ? {} : { labels })}>
			{(table) => {
				tables.push(table);
				return <TableEngineColumnVisibility table={table} trigger={TRIGGER} {...(triggerRef === undefined ? {} : { ref: triggerRef })} />;
			}}
		</TableEngineTestHarness>,
	);
	return {
		current: (): TableEngineTableInstance<TableEngineTestPerson> => {
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

describe("TableEngineColumnVisibility", () => {
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
