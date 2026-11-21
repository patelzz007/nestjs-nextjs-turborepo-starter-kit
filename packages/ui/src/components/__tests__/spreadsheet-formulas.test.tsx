// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { CellData } from "@tanstack/react-table";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SPREADSHEET_ROW_NUMBER_COLUMN_ID, toSpreadsheetCellInput, withSpreadsheetFormulas } from "../../internal/spreadsheet/formulas";
import { UiKitTestProviders } from "../../testing/ui-kit-test-providers";
import { Spreadsheet, type SpreadsheetColumns, type SpreadsheetProps } from "../spreadsheet";

/** A small budget: a quantity, a price, and a total that is a formula over them. */
interface Line {
	readonly id: string;
	readonly item: string;
	readonly quantity: number | string;
	readonly price: number | string;
	readonly total: string;
}

const LINES: readonly Line[] = [
	{ id: "l-1", item: "Paper", quantity: 4, price: 5, total: "=B1*C1" },
	{ id: "l-2", item: "Ink", quantity: 2, price: 30, total: "=B2*C2" },
	{ id: "l-3", item: "Sum", quantity: "=SUM(B1:B2)", price: "=C2/0", total: "=D1+D2" },
];

const COLUMNS: SpreadsheetColumns<Line> = [
	{ accessorKey: "item", header: "Item", meta: { cellEdit: {} } },
	{ accessorKey: "quantity", header: "Quantity", meta: { cellEdit: {} } },
	{ accessorKey: "price", header: "Price", meta: { cellEdit: {} } },
	{ accessorKey: "total", header: "Total", meta: { cellEdit: {} } },
];

function getRowId(line: Line): string {
	return line.id;
}

function noop(): void {
	// Nothing to do: a stub listener.
}

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

function noAnimations(): Animation[] {
	return [];
}

beforeEach((): void => {
	vi.stubGlobal("ResizeObserver", ResizeObserverStub);
	Object.defineProperty(HTMLElement.prototype, "getAnimations", { configurable: true, value: noAnimations });
	Element.prototype.scrollIntoView = vi.fn();
});

afterEach((): void => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	Reflect.deleteProperty(HTMLElement.prototype, "getAnimations");
});

function renderSheet(overrides: Partial<SpreadsheetProps<Line>> = {}): void {
	render(<Spreadsheet data={LINES} columns={COLUMNS} getRowId={getRowId} formulas {...overrides} />, { wrapper: UiKitTestProviders });
}

function cell(rowId: string, columnId: string): HTMLElement {
	const found = document.querySelector<HTMLElement>(`tr[data-row-id="${rowId}"] td[data-col-id="${columnId}"]`);
	if (found === null) {
		throw new Error(`no cell ${rowId} / ${columnId}`);
	}
	return found;
}

function pressCell(rowId: string, columnId: string): void {
	fireEvent.mouseDown(cell(rowId, columnId), { button: 0 });
	fireEvent.mouseUp(document);
}

describe("Spreadsheet: formulas", () => {
	it("shows each formula's result, worked out over other formulas", () => {
		renderSheet();
		expect(cell("l-1", "total").textContent).toBe("20");
		expect(cell("l-2", "total").textContent).toBe("60");
		expect(cell("l-3", "quantity").textContent).toBe("6");
		expect(cell("l-3", "total").textContent).toBe("80");
	});

	it("shows an error code, marked as an error", () => {
		renderSheet();
		const failing = cell("l-3", "price");
		expect(failing.textContent).toBe("#DIV/0!");
		expect(failing.querySelector("[data-error]")).not.toBeNull();
	});

	it("shows the formula itself in the editor", () => {
		renderSheet();
		pressCell("l-1", "total");
		fireEvent.keyDown(screen.getByRole("grid"), { key: "Enter" });

		expect(screen.getByRole("textbox", { name: "Total" })).toHaveProperty("value", "=B1*C1");
	});

	it("shows formula text as it is when formulas are off", () => {
		renderSheet({ formulas: false });
		expect(cell("l-1", "total").textContent).toBe("=B1*C1");
	});

	it("works the results out again when the data changes", () => {
		const { rerender } = render(<Spreadsheet data={LINES} columns={COLUMNS} getRowId={getRowId} formulas />, { wrapper: UiKitTestProviders });
		const changed = LINES.map((line) => (line.id === "l-1" ? { ...line, quantity: 10 } : line));

		rerender(<Spreadsheet data={changed} columns={COLUMNS} getRowId={getRowId} formulas />);

		expect(cell("l-1", "total").textContent).toBe("50");
		expect(cell("l-3", "total").textContent).toBe("110");
	});
});

describe("Spreadsheet: A1 headers", () => {
	it("titles the columns by letter and numbers the rows", () => {
		renderSheet({ headers: "a1" });
		expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["", "A", "B", "C", "D"]);
		expect(cell("l-2", SPREADSHEET_ROW_NUMBER_COLUMN_ID).textContent).toBe("2");
	});

	it("shows the focused cell's address and what it holds above the grid", () => {
		renderSheet({ headers: "a1" });

		pressCell("l-2", "total");

		const bar = document.querySelector<HTMLElement>("[data-slot=spreadsheet-formula-bar]");
		expect(screen.getByRole("status", { name: "Cell" }).textContent).toBe("D2");
		expect(bar?.textContent).toContain("=B2*C2");
	});

	it("keeps each column's own title for the editor", () => {
		renderSheet({ headers: "a1" });
		pressCell("l-1", "quantity");
		fireEvent.keyDown(screen.getByRole("grid"), { key: "Enter" });

		expect(screen.getByRole("textbox", { name: "Quantity" })).toBeTruthy();
	});
});

describe("spreadsheet formula helpers", () => {
	it("moves a filled formula's references, and copies anything else as it is", () => {
		const [quantity] = withSpreadsheetFormulas(COLUMNS);
		const carry = quantity?.meta?.cellEdit?.carry;
		if (carry === undefined) {
			throw new Error("a writable column carries formulas");
		}
		expect(carry("=B1*$C$1", 2, 1)).toBe("=C3*$C$1");
		expect(carry(7, 2, 1)).toBe(7);
	});

	it("keeps a column's own carrier", () => {
		const own = vi.fn<(value: CellData, rows: number, columns: number) => CellData>(() => "own");
		const [column] = withSpreadsheetFormulas<Line>([{ accessorKey: "item", meta: { cellEdit: { carry: own } } }]);
		expect(column?.meta?.cellEdit?.carry).toBe(own);
	});

	it("reads only numbers, text and booleans as cell input", () => {
		expect(toSpreadsheetCellInput(3)).toBe(3);
		expect(toSpreadsheetCellInput("=A1")).toBe("=A1");
		expect(toSpreadsheetCellInput(false)).toBe(false);
		expect(toSpreadsheetCellInput(null)).toBeNull();
		expect(toSpreadsheetCellInput({ nested: true })).toBeNull();
	});
});
