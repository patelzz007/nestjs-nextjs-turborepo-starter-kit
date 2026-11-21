// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import type * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Spreadsheet1Example } from "@/components/component-showcase/examples/spreadsheet/spreadsheet-1";
import { copiedCellCount, Spreadsheet2Example } from "@/components/component-showcase/examples/spreadsheet/spreadsheet-2";
import { markCells, Spreadsheet3Example } from "@/components/component-showcase/examples/spreadsheet/spreadsheet-3";
import { addBudgetLine, Spreadsheet4Example } from "@/components/component-showcase/examples/spreadsheet/spreadsheet-4";
import { applyQuoteChanges, QUOTE_LINES, Spreadsheet5Example } from "@/components/component-showcase/examples/spreadsheet/spreadsheet-5";
import { SpreadsheetDo1Example } from "@/components/component-showcase/examples/spreadsheet/spreadsheet-do-1";
import { SpreadsheetDo2Example } from "@/components/component-showcase/examples/spreadsheet/spreadsheet-do-2";
import { SpreadsheetDont1Example } from "@/components/component-showcase/examples/spreadsheet/spreadsheet-dont-1";
import { SpreadsheetDont2Example } from "@/components/component-showcase/examples/spreadsheet/spreadsheet-dont-2";
import { BUDGET_LINES } from "@/components/component-showcase/examples/spreadsheet/spreadsheet-sample";
import { installJsdomUiShims } from "@/testing/jsdom-ui-shims";

interface NamedExample {
	readonly name: string;
	readonly component: () => React.JSX.Element;
}

const EXAMPLES: readonly NamedExample[] = [
	{ name: "1 overview", component: Spreadsheet1Example },
	{ name: "2 clipboard and fill", component: Spreadsheet2Example },
	{ name: "3 validation and status marks", component: Spreadsheet3Example },
	{ name: "4 draft row", component: Spreadsheet4Example },
	{ name: "5 formulas and A1 headers", component: Spreadsheet5Example },
	{ name: "do 1", component: SpreadsheetDo1Example },
	{ name: "dont 1", component: SpreadsheetDont1Example },
	{ name: "do 2", component: SpreadsheetDo2Example },
	{ name: "dont 2", component: SpreadsheetDont2Example },
];

function firstLine(): (typeof BUDGET_LINES)[number] {
	const [line] = BUDGET_LINES;
	if (line === undefined) {
		throw new Error("the budget sample holds a line");
	}
	return line;
}

function cell(rowId: string, columnId: string): HTMLElement {
	const found = document.querySelector<HTMLElement>(`tr[data-row-id="${rowId}"] td[data-col-id="${columnId}"]`);
	if (found === null) {
		throw new Error(`no cell ${rowId} / ${columnId}`);
	}
	return found;
}

/** Focuses a cell, opens its editor with Enter, types `text` and commits with Enter. */
function editCell(rowId: string, columnId: string, columnTitle: string, text: string): void {
	fireEvent.mouseDown(cell(rowId, columnId), { button: 0 });
	fireEvent.mouseUp(document);
	fireEvent.keyDown(screen.getByRole("grid"), { key: "Enter" });
	const editor = screen.getByRole("textbox", { name: columnTitle });
	fireEvent.change(editor, { target: { value: text } });
	fireEvent.keyDown(editor, { key: "Enter" });
}

describe("Spreadsheet example helpers", () => {
	it("counts the cells a copy held", () => {
		expect(
			copiedCellCount({
				text: "a\tb\nc\td",
				grid: [
					["a", "b"],
					["c", "d"],
				],
				cut: false,
			}),
		).toBe(4);
		expect(copiedCellCount({ text: "", grid: [], cut: true })).toBe(0);
	});

	it("marks written cells dirty and refused values invalid, but not read-only refusals", () => {
		const line = firstLine();
		const marks = markCells(
			{},
			{
				source: "paste",
				changes: [{ rowId: line.id, columnId: "item", row: line, previousValue: line.item, value: "Desks" }],
				rejected: [
					{ rowId: line.id, columnId: "quantity", raw: "many", reason: "invalid" },
					{ rowId: line.id, columnId: "total", raw: "9", reason: "readonly" },
				],
			},
		);
		expect(marks).toEqual({ [`${line.id}:item`]: "dirty", [`${line.id}:quantity`]: "invalid" });
	});

	it("adds an empty line under an id of its own", () => {
		const next = addBudgetLine(BUDGET_LINES);
		expect(next).toHaveLength(BUDGET_LINES.length + 1);
		expect(next.at(-1)).toEqual({ id: `new-${String(BUDGET_LINES.length + 1)}`, item: "", category: "", quantity: 0, unitPrice: 0 });
	});
});

describe("Spreadsheet examples", () => {
	installJsdomUiShims();

	afterEach((): void => {
		vi.restoreAllMocks();
	});

	it.each(EXAMPLES)("renders example $name without a console error", ({ component: Example }) => {
		const consoleError = vi.spyOn(console, "error");
		render(<Example />, { wrapper: UiKitTestProviders });
		expect(consoleError).not.toHaveBeenCalled();
	});

	it("writes an edit and works the total out again", () => {
		render(<Spreadsheet1Example />, { wrapper: UiKitTestProviders });
		const line = firstLine();
		expect(cell(line.id, "total").textContent).toBe("$5,800");

		editCell(line.id, "quantity", "Quantity", "2");

		expect(cell(line.id, "quantity").textContent).toBe("2");
		expect(cell(line.id, "total").textContent).toBe("$2,900");
	});

	it("reports the selection and each write under the grid", () => {
		render(<Spreadsheet2Example />, { wrapper: UiKitTestProviders });
		const line = firstLine();
		expect(screen.getByText(/Nothing copied yet/u)).toBeTruthy();

		editCell(line.id, "item", "Item", "Workstations");

		expect(screen.getByText(/edit: 1 written, 0 refused/u)).toBeTruthy();
	});

	it("marks a refused value invalid, a good edit dirty, and clears both on save", () => {
		render(<Spreadsheet3Example />, { wrapper: UiKitTestProviders });
		const line = firstLine();
		expect(screen.getByText("Everything is saved.")).toBeTruthy();

		editCell(line.id, "quantity", "Quantity", "many");
		expect(cell(line.id, "quantity").textContent).toBe(String(line.quantity));
		expect(screen.getByText("1 marked cell")).toBeTruthy();

		editCell(line.id, "item", "Item", "Workstations");
		expect(screen.getByText("2 marked cells")).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Save" }));
		expect(screen.getByText("Everything is saved.")).toBeTruthy();
	});

	it("works the quote out with formulas, and follows a changed quantity", () => {
		render(<Spreadsheet5Example />, { wrapper: UiKitTestProviders });
		// Subtotal 4×1450 + 8×320 + 4×210 = 9200; tax 6% = 552; grand total 9752.
		expect(cell("q-5", "total").textContent).toBe("9200");
		expect(cell("q-6", "total").textContent).toBe("552");
		expect(cell("q-7", "total").textContent).toBe("9752");

		editCell("q-1", "quantity", "Quantity", "5");

		expect(cell("q-1", "total").textContent).toBe("7250");
		expect(cell("q-7", "total").textContent).toBe("11289");
	});

	it("keeps a formula as text in the quote, and refuses a value a line cannot hold", () => {
		const [first] = QUOTE_LINES;
		if (first === undefined) {
			throw new Error("the quote has lines");
		}
		const next = applyQuoteChanges(QUOTE_LINES, {
			source: "fill",
			changes: [
				{ rowId: first.id, columnId: "total", row: first, previousValue: first.total, value: "=B1*C1*2" },
				{ rowId: first.id, columnId: "quantity", row: first, previousValue: first.quantity, value: { nested: true } },
			],
			rejected: [],
		});
		expect(next.at(0)).toEqual({ ...first, total: "=B1*C1*2" });
	});

	it("adds a line from the draft row", () => {
		render(<Spreadsheet4Example />, { wrapper: UiKitTestProviders });
		const before = screen.getAllByRole("row").length;

		fireEvent.click(screen.getByRole("button", { name: "Add budget line" }));

		expect(screen.getAllByRole("row").length).toBe(before + 1);
	});
});
