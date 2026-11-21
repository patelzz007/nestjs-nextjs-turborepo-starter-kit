// @vitest-environment jsdom
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { accessibilityViolations } from "../../testing/axe";
import { UiKitTestProviders } from "../../testing/ui-kit-test-providers";
import { Spreadsheet, type SpreadsheetApi, type SpreadsheetCellsChange, type SpreadsheetColumns, type SpreadsheetProps, type SpreadsheetSelection } from "../spreadsheet";

interface Line {
	readonly id: string;
	readonly item: string;
	readonly quantity: number;
}

const LINES: readonly Line[] = [
	{ id: "l-1", item: "Paper", quantity: 4 },
	{ id: "l-2", item: "Ink", quantity: 2 },
];

function parseQuantity(raw: string): number | undefined {
	const parsed = Number(raw);
	return Number.isFinite(parsed) && raw.trim() !== "" ? parsed : undefined;
}

const COLUMNS: SpreadsheetColumns<Line> = [
	{ accessorKey: "item", header: "Item", meta: { cellEdit: {} } },
	{ accessorKey: "quantity", header: "Quantity", meta: { cellEdit: { parse: parseQuantity } } },
	{ accessorKey: "id", header: "Reference" },
];

function getRowId(line: Line): string {
	return line.id;
}

function noop(): void {
	// Nothing to do: a stub listener.
}

/** jsdom has no ResizeObserver; the grid measures its scroller with one. */
class ResizeObserverStub {
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

/** jsdom has no Web Animations API; the scroll area under the grid waits on `getAnimations()`. */
function noAnimations(): Animation[] {
	return [];
}

beforeEach((): void => {
	vi.stubGlobal("ResizeObserver", ResizeObserverStub);
	Object.defineProperty(HTMLElement.prototype, "getAnimations", { configurable: true, value: noAnimations });
	// jsdom has no scrollIntoView; the grid scrolls the focused cell into view.
	Element.prototype.scrollIntoView = vi.fn();
});

afterEach((): void => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	Reflect.deleteProperty(HTMLElement.prototype, "getAnimations");
});

function renderSheet(overrides: Partial<SpreadsheetProps<Line>> = {}): void {
	render(<Spreadsheet data={LINES} columns={COLUMNS} getRowId={getRowId} {...overrides} />, { wrapper: UiKitTestProviders });
}

function cell(rowId: string, columnId: string): HTMLElement {
	const found = document.querySelector<HTMLElement>(`tr[data-row-id="${rowId}"] td[data-col-id="${columnId}"]`);
	if (found === null) {
		throw new Error(`no cell ${rowId} / ${columnId}`);
	}
	return found;
}

function pressCell(rowId: string, columnId: string, init: MouseEventInit = {}): void {
	fireEvent.mouseDown(cell(rowId, columnId), { button: 0, ...init });
	fireEvent.mouseUp(document);
}

function grid(): HTMLElement {
	return screen.getByRole("grid");
}

describe("Spreadsheet", () => {
	it("is a grid of selectable cells", () => {
		renderSheet();
		expect(grid().getAttribute("aria-multiselectable")).toBe("true");
		expect(screen.getAllByRole("gridcell")).toHaveLength(LINES.length * COLUMNS.length);
	});

	it("has no serious accessibility problems", async (): Promise<void> => {
		renderSheet();
		await expect(accessibilityViolations(document.body)).resolves.toStrictEqual([]);
	});

	it("selects one cell only in single mode", () => {
		renderSheet({ selectionMode: "single" });
		expect(grid().hasAttribute("aria-multiselectable")).toBe(false);
	});

	it("reports the selection as it changes", () => {
		const onSelectionChange = vi.fn<(selection: SpreadsheetSelection) => void>();
		renderSheet({ onSelectionChange });

		pressCell("l-2", "item");

		expect(onSelectionChange).toHaveBeenLastCalledWith(expect.objectContaining({ focused: { rowId: "l-2", columnId: "item" } }));
		expect(cell("l-2", "item").getAttribute("aria-selected")).toBe("true");
	});

	it("commits an edit as one batch, parsed by the column", () => {
		const onCellsChange = vi.fn<(change: SpreadsheetCellsChange<Line>) => void>();
		renderSheet({ onCellsChange });
		pressCell("l-1", "quantity");
		fireEvent.keyDown(grid(), { key: "Enter" });

		const editor = screen.getByRole("textbox", { name: "Quantity" });
		fireEvent.change(editor, { target: { value: "9" } });
		fireEvent.keyDown(editor, { key: "Enter" });

		expect(onCellsChange).toHaveBeenCalledWith({
			source: "edit",
			changes: [{ rowId: "l-1", columnId: "quantity", row: LINES.at(LIST_SLOT_INDEX.first), previousValue: 4, value: 9 }],
			rejected: [],
		});
	});

	it("rejects a value the column cannot parse instead of writing it", () => {
		const onCellsChange = vi.fn<(change: SpreadsheetCellsChange<Line>) => void>();
		renderSheet({ onCellsChange });
		pressCell("l-1", "quantity");
		fireEvent.keyDown(grid(), { key: "Enter" });

		const editor = screen.getByRole("textbox", { name: "Quantity" });
		fireEvent.change(editor, { target: { value: "many" } });
		fireEvent.keyDown(editor, { key: "Enter" });

		expect(onCellsChange).toHaveBeenCalledWith({ source: "edit", changes: [], rejected: [{ rowId: "l-1", columnId: "quantity", raw: "many", reason: "invalid" }] });
	});

	it("clears a writable cell with Delete, and leaves a read-only one alone", () => {
		const onCellsChange = vi.fn<(change: SpreadsheetCellsChange<Line>) => void>();
		renderSheet({ onCellsChange });

		pressCell("l-1", "item");
		fireEvent.keyDown(grid(), { key: "Delete" });
		expect(onCellsChange).toHaveBeenLastCalledWith(
			expect.objectContaining({ source: "clear", changes: [expect.objectContaining({ rowId: "l-1", columnId: "item", value: null })] }),
		);

		pressCell("l-1", "id");
		fireEvent.keyDown(grid(), { key: "Delete" });
		// The "Reference" column declares no `meta.cellEdit`: no batch ever writes it.
		const writtenColumns = onCellsChange.mock.calls.flatMap(([change]) => change.changes.map((entry) => entry.columnId));
		expect(writtenColumns).toEqual(["item"]);
	});

	it("draws the fill handle on the selection's corner only when asked", () => {
		renderSheet({ fillHandle: { variant: "square" } });
		pressCell("l-1", "item");
		expect(document.querySelector("[data-slot=table-engine-cell-fill-handle]")).not.toBeNull();
		cleanup();

		renderSheet();
		pressCell("l-1", "item");
		expect(document.querySelector("[data-slot=table-engine-cell-fill-handle]")).toBeNull();
	});

	it("offers an add-row button that tells the caller to create one", () => {
		const onCreate = vi.fn<() => void>();
		renderSheet({ draftRow: { onCreate, label: "Add line" } });

		fireEvent.click(screen.getByRole("button", { name: "Add line" }));

		expect(onCreate).toHaveBeenCalledTimes(1);
	});

	it("marks rows and cells with the status the caller gives", () => {
		renderSheet({
			rowStatus: (line) => (line.id === "l-2" ? "new" : undefined),
			cellStatus: (line, columnId) => (line.id === "l-1" && columnId === "quantity" ? "invalid" : undefined),
		});
		expect(cell("l-2", "item").closest("tr")?.getAttribute("data-row-status")).toBe("new");
		expect(cell("l-1", "quantity").getAttribute("data-cell-status")).toBe("invalid");
		expect(cell("l-1", "item").hasAttribute("data-cell-status")).toBe(false);
	});

	it("exposes the selection API through its ref", () => {
		const apiRef = React.createRef<SpreadsheetApi>();
		renderSheet({ ref: apiRef });
		pressCell("l-1", "item");

		act((): void => {
			apiRef.current?.clearSelection();
		});

		expect(document.querySelector('td[aria-selected="true"]')).toBeNull();
	});

	it("takes label overrides", () => {
		renderSheet({ draftRow: { onCreate: noop }, labels: { rowCreate: "New line" } });
		expect(screen.getByRole("button", { name: "New line" })).toBeTruthy();
	});
});
