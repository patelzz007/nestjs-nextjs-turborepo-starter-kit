// @vitest-environment jsdom
import { DataGridCellSelection } from "@workspace/ui/components/data-grid/data-grid-cell-selection";
import { positionDataGridOutline } from "../data-grid-cell-selection-fill";
import { DataGridContainer, type DataGridCellsChangeDetails, type DataGridFeatures, type DataGridTableLayout } from "@workspace/ui/components/data-grid/data-grid";
import { DataGridTable } from "@workspace/ui/components/data-grid/data-grid-table";
import { DataGridTestHarness, type DataGridTestPerson } from "@workspace/ui/testing/data-grid-test-harness";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { CellData, ColumnDef, RowData } from "@tanstack/react-table";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const LOCKED_ROW_ID = "p-2";

function parseAge(raw: string): CellData {
	const parsed = Number(raw);
	return raw.trim() === "" || Number.isNaN(parsed) ? undefined : parsed;
}

function isUnlocked(row: RowData): boolean {
	return !("id" in row) || row.id !== LOCKED_ROW_ID;
}

const COLUMNS: ColumnDef<DataGridFeatures, DataGridTestPerson>[] = [
	{ accessorKey: "name", header: "Name", meta: { cellEdit: { control: "text" } } },
	{ accessorKey: "email", header: "Email", meta: { cellEdit: { editable: isUnlocked } } },
	{ accessorKey: "age", header: "Age", meta: { cellEdit: { parse: parseAge } } },
	{ accessorKey: "role", header: "Role", meta: { cellEdit: { control: "text" } } },
];

const SELECTION_LAYOUT: DataGridTableLayout = { cellSelection: true, cellFillHandle: true };

class ResizeObserverStub {
	public observe(): void {
		// jsdom: nothing to observe.
	}

	public disconnect(): void {
		// jsdom: nothing to observe.
	}
}

type ChangeHandler = (details: DataGridCellsChangeDetails<DataGridTestPerson>) => void;

beforeEach((): void => {
	vi.stubGlobal("ResizeObserver", ResizeObserverStub);
	Element.prototype.scrollIntoView = vi.fn();
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

function renderGrid(onCellsChange: ChangeHandler): void {
	render(
		<DataGridTestHarness columns={COLUMNS} tableLayout={SELECTION_LAYOUT} onCellsChange={onCellsChange}>
			{() => (
				<DataGridContainer>
					<DataGridTable />
					<DataGridCellSelection />
				</DataGridContainer>
			)}
		</DataGridTestHarness>,
	);
}

function cellElement(rowId: string, columnId: string): HTMLElement {
	const cell = document.querySelector<HTMLElement>(`tbody tr[data-row-id="${rowId}"] td[data-col-id="${columnId}"]`);
	if (cell === null) {
		throw new Error(`no cell ${rowId}/${columnId}`);
	}
	return cell;
}

function fillHandle(): HTMLElement {
	const handle = document.querySelector<HTMLElement>('[data-slot="data-grid-cell-fill-handle"]');
	if (handle === null) {
		throw new Error("no fill handle");
	}
	return handle;
}

/** Picks a cell, then drags its fill handle over `to` (the pointer lands on that cell). */
function dragFill(from: readonly [string, string], to: readonly [string, string]): void {
	fireEvent.mouseDown(cellElement(...from), { button: 0 });
	fireEvent.mouseUp(document);
	fireEvent.mouseDown(fillHandle(), { button: 0 });
	// jsdom has no layout: the pointer is wherever the test says it is.
	const target = cellElement(...to);
	document.elementFromPoint = (): Element => target;
	fireEvent.mouseMove(document, { clientX: 1, clientY: 1 });
}

describe("the fill handle", () => {
	it("fills down by repeating the source value, skipping the locked cell, and grows the selection", (): void => {
		const onCellsChange = vi.fn<ChangeHandler>();
		renderGrid(onCellsChange);
		dragFill(["p-1", "email"], ["p-3", "email"]);
		expect(document.querySelectorAll('[data-cell-fill-target="true"]')).toHaveLength(1);
		fireEvent.mouseUp(document);

		const [details] = onCellsChange.mock.lastCall ?? [];
		expect(details?.source).toBe("fill");
		expect(details?.changes.map((change) => [change.rowId, change.value])).toStrictEqual([["p-3", "alex@example.com"]]);
		expect(document.querySelectorAll('td[aria-selected="true"]').length).toBe(3);
	});

	it("fills right across columns through the target's parse, rejecting what it cannot read", (): void => {
		const onCellsChange = vi.fn<ChangeHandler>();
		renderGrid(onCellsChange);
		dragFill(["p-1", "email"], ["p-1", "age"]);
		fireEvent.mouseUp(document);

		const [details] = onCellsChange.mock.lastCall ?? [];
		expect(details?.changes).toHaveLength(0);
		expect(details?.rejected.map((rejection) => [rejection.columnId, rejection.reason])).toStrictEqual([["age", "invalid"]]);
	});

	it("fills right into a column of the same kind as is", (): void => {
		const onCellsChange = vi.fn<ChangeHandler>();
		renderGrid(onCellsChange);
		dragFill(["p-1", "age"], ["p-1", "role"]);
		fireEvent.mouseUp(document);

		const [details] = onCellsChange.mock.lastCall ?? [];
		expect(details?.changes.map((change) => [change.columnId, change.value])).toStrictEqual([["role", 34]]);
	});

	it("is cancelled by Escape, and does nothing for a drag that never leaves the source", (): void => {
		const onCellsChange = vi.fn<ChangeHandler>();
		renderGrid(onCellsChange);
		dragFill(["p-1", "name"], ["p-4", "name"]);
		fireEvent.keyDown(document, { key: "Enter" });
		fireEvent.keyDown(document, { key: "Escape" });
		fireEvent.mouseUp(document);
		expect(onCellsChange).not.toHaveBeenCalled();
		expect(document.querySelector('[data-slot="data-grid-cell-fill-preview"]')).toBeNull();

		dragFill(["p-1", "name"], ["p-1", "name"]);
		fireEvent.mouseUp(document);
		expect(onCellsChange).not.toHaveBeenCalled();
	});
});

describe("positionDataGridOutline", () => {
	it("hides without both corners, and spans them inside the scrolled viewport", (): void => {
		const outline = document.createElement("div");
		const viewport = document.createElement("div");
		const first = document.createElement("div");
		const far = document.createElement("div");
		vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue(new DOMRect(10, 10, 500, 500));
		vi.spyOn(first, "getBoundingClientRect").mockReturnValue(new DOMRect(20, 30, 40, 20));
		vi.spyOn(far, "getBoundingClientRect").mockReturnValue(new DOMRect(100, 90, 40, 20));

		positionDataGridOutline(outline, viewport, first, null);
		expect(outline.style.display).toBe("none");

		positionDataGridOutline(outline, viewport, first, far);
		expect([outline.style.display, outline.style.left, outline.style.top, outline.style.width, outline.style.height]).toStrictEqual([
			"block",
			"10px",
			"20px",
			"120px",
			"80px",
		]);
	});
});
