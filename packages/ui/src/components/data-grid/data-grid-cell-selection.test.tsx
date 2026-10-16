// @vitest-environment jsdom
import { LIST_SLOT_INDEX } from "@workspace/shared";
import {
	buildDataGridClearDetails,
	buildDataGridPasteDetails,
	DataGridCellSelection,
	DataGridSelectionBar,
	getDataGridActiveRegionGrid,
	getDataGridVisibleSelectedCellCount,
	invertDataGridCellsChange,
	parseDataGridClipboardText,
	serializeDataGridClipboardText,
	stringifyDataGridCellValue,
	tileDataGridClipboardBlock,
	type DataGridCellSelectionApi,
} from "@workspace/ui/components/data-grid/data-grid-cell-selection";
import {
	DataGridContainer,
	type DataGridCellsChangeDetails,
	type DataGridFeatures,
	type DataGridTableInstance,
	type DataGridTableLayout,
} from "@workspace/ui/components/data-grid/data-grid";
import { DataGridTable } from "@workspace/ui/components/data-grid/data-grid-table";
import { DATA_GRID_TEST_PEOPLE, DataGridTestHarness, type DataGridTestPerson } from "@workspace/ui/testing/data-grid-test-harness";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CellData, ColumnDef, RowData } from "@tanstack/react-table";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Fixtures ───────────────────────────────────────────────────────────────

const LOCKED_ROW_ID = "p-2";

function parseAge(raw: string): CellData {
	const parsed = Number(raw);
	return raw.trim() === "" || Number.isNaN(parsed) ? undefined : parsed;
}

function formatAge(value: CellData): string {
	return `${String(value)}y`;
}

function isUnlocked(row: RowData): boolean {
	return !("id" in row) || row.id !== LOCKED_ROW_ID;
}

const COLUMNS: ColumnDef<DataGridFeatures, DataGridTestPerson>[] = [
	{ accessorKey: "name", header: "Name", meta: { cellEdit: { control: "text" } } },
	{ accessorKey: "email", header: "Email", meta: { cellEdit: { editable: isUnlocked, clearValue: "" } } },
	{ accessorKey: "age", header: "Age", meta: { cellEdit: { parse: parseAge, format: formatAge } } },
	{ accessorKey: "role", header: "Role" },
];

const SELECTION_LAYOUT: DataGridTableLayout = { cellSelection: true };

class ResizeObserverStub {
	public observe(): void {
		// jsdom: nothing to observe.
	}

	public disconnect(): void {
		// jsdom: nothing to observe.
	}
}

beforeEach((): void => {
	vi.stubGlobal("ResizeObserver", ResizeObserverStub);
	// jsdom has no scrollIntoView; the controller scrolls the focused cell into view.
	Element.prototype.scrollIntoView = vi.fn();
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

interface RenderOptions {
	readonly onCellsChange?: (details: DataGridCellsChangeDetails<DataGridTestPerson>) => void;
	readonly onCellEditRequest?: React.ComponentProps<typeof DataGridTestHarness>["onCellEditRequest"];
	readonly onCellsCopy?: React.ComponentProps<typeof DataGridTestHarness>["onCellsCopy"];
	readonly onCellSelectionChange?: React.ComponentProps<typeof DataGridTestHarness>["onCellSelectionChange"];
	readonly apiRef?: React.Ref<DataGridCellSelectionApi>;
	readonly columns?: ColumnDef<DataGridFeatures, DataGridTestPerson>[];
}

interface Rendered {
	readonly table: () => DataGridTableInstance<DataGridTestPerson>;
}

function renderGrid(options: RenderOptions = {}): Rendered {
	const tables: DataGridTableInstance<DataGridTestPerson>[] = [];
	render(
		<DataGridTestHarness
			columns={options.columns ?? COLUMNS}
			tableLayout={SELECTION_LAYOUT}
			{...(options.onCellsChange === undefined ? {} : { onCellsChange: options.onCellsChange })}
			{...(options.onCellEditRequest === undefined ? {} : { onCellEditRequest: options.onCellEditRequest })}
			{...(options.onCellsCopy === undefined ? {} : { onCellsCopy: options.onCellsCopy })}
			{...(options.onCellSelectionChange === undefined ? {} : { onCellSelectionChange: options.onCellSelectionChange })}>
			{(table) => {
				tables.push(table);
				return (
					<DataGridContainer>
						<DataGridTable />
						<DataGridCellSelection {...(options.apiRef === undefined ? {} : { apiRef: options.apiRef })} />
					</DataGridContainer>
				);
			}}
		</DataGridTestHarness>,
	);
	return {
		table: (): DataGridTableInstance<DataGridTestPerson> => {
			const latest = tables.at(-1);
			if (latest === undefined) {
				throw new Error("grid never rendered");
			}
			return latest;
		},
	};
}

/** The real table's `<td>` of a cell: rows carry `data-row-id`, cells `data-col-id`. */
function cellElement(rowId: string, columnId: string): HTMLElement {
	const row = [...document.querySelectorAll<HTMLElement>("tbody tr[data-row-id]")].find((candidate) => candidate.dataset.rowId === rowId);
	const cell = [...(row?.querySelectorAll<HTMLElement>("td[data-col-id]") ?? [])].find((candidate) => candidate.dataset.colId === columnId);
	if (cell === undefined) {
		throw new Error(`no cell ${rowId}/${columnId}`);
	}
	return cell;
}

/** Cells as `rowId/columnId` addresses, in DOM order. */
function addressOf(cell: Element): string {
	return `${cell.closest("tr")?.getAttribute("data-row-id") ?? ""}/${cell.getAttribute("data-col-id") ?? ""}`;
}

function pressCell(rowId: string, columnId: string, init: MouseEventInit = {}): void {
	fireEvent.mouseDown(cellElement(rowId, columnId), { button: 0, ...init });
	fireEvent.mouseUp(document);
}

function grid(): HTMLElement {
	return screen.getByRole("grid");
}

function selectedCellIds(): string[] {
	return [...document.querySelectorAll('td[aria-selected="true"]')].map(addressOf);
}

// ── Pure helpers ───────────────────────────────────────────────────────────

describe("clipboard text", () => {
	it("serializes rows as TSV with CRLF and Excel quoting", (): void => {
		expect(
			serializeDataGridClipboardText([
				["a", "b"],
				['say "hi"', "tab\there"],
				["line\nbreak", ""],
			]),
		).toBe('a\tb\r\n"say ""hi"""\t"tab\there"\r\n"line\nbreak"\t');
	});

	it("parses quoted fields with tabs, quotes and both newline flavours", (): void => {
		expect(parseDataGridClipboardText('a\t"b\tc"\r\n"multi\r\nline"\t"q""uote"')).toEqual([
			["a", "b\tc"],
			["multi\r\nline", 'q"uote'],
		]);
		expect(parseDataGridClipboardText("x\ny\rz")).toEqual([["x"], ["y"], ["z"]]);
	});

	it("drops the trailing newline Excel appends, but keeps a lone empty field", (): void => {
		expect(parseDataGridClipboardText("a\tb\r\n")).toEqual([["a", "b"]]);
		expect(parseDataGridClipboardText("")).toEqual([[""]]);
	});

	it("round-trips a serialized grid", (): void => {
		const block = [
			["1", 'x"y'],
			["two\nlines", "3"],
		];
		expect(parseDataGridClipboardText(serializeDataGridClipboardText(block))).toEqual(block);
	});

	it("tiles a block cyclically over a larger region", (): void => {
		expect(
			tileDataGridClipboardBlock(
				[
					["a", "b"],
					["c", "d"],
				],
				3,
				3,
			),
		).toEqual([
			["a", "b", "a"],
			["c", "d", "c"],
			["a", "b", "a"],
		]);
		expect(tileDataGridClipboardBlock([], 1, 2)).toEqual([["", ""]]);
	});

	it("stringifies values without a format", (): void => {
		expect(stringifyDataGridCellValue(null)).toBe("");
		expect(stringifyDataGridCellValue(undefined)).toBe("");
		expect(stringifyDataGridCellValue("x")).toBe("x");
		expect(stringifyDataGridCellValue(42)).toBe("42");
		expect(stringifyDataGridCellValue(true)).toBe("true");
		expect(stringifyDataGridCellValue(new Date(Date.UTC(2024, 0, 2)))).toBe("2024-01-02T00:00:00.000Z");
		expect(stringifyDataGridCellValue({ a: 1 })).toBe('{"a":1}');
	});
});

describe("invertDataGridCellsChange", () => {
	it("swaps value and previousValue and drops rejections", (): void => {
		const [person] = DATA_GRID_TEST_PEOPLE;
		if (person === undefined) {
			throw new Error("no fixture");
		}
		const details: DataGridCellsChangeDetails<DataGridTestPerson> = {
			source: "paste",
			changes: [{ rowId: person.id, columnId: "age", row: person, previousValue: 34, value: 40 }],
			rejected: [{ rowId: person.id, columnId: "role", raw: "x", reason: "readonly" }],
		};
		const inverted = invertDataGridCellsChange(details);
		expect(inverted).toEqual({ source: "paste", changes: [{ rowId: person.id, columnId: "age", row: person, previousValue: 40, value: 34 }], rejected: [] });
		expect(invertDataGridCellsChange(inverted).changes).toEqual(details.changes);
	});
});

describe("selection-driven builders", () => {
	function selectRange(table: DataGridTableInstance<DataGridTestPerson>, from: readonly [string, string], to: readonly [string, string]): void {
		const [anchorRowId, anchorColumnId] = from;
		const [focusRowId, focusColumnId] = to;
		act((): void => {
			table.selectCellRange({ anchorRowId, anchorColumnId, focusRowId, focusColumnId }, { mode: "replace" });
		});
	}

	it("returns nothing without a selection", (): void => {
		const { table } = renderGrid();
		expect(getDataGridActiveRegionGrid(table())).toBeNull();
		expect(buildDataGridClearDetails(table(), "clear", false)).toBeNull();
		expect(buildDataGridPasteDetails(table(), [["1"]])).toBeNull();
		expect(getDataGridVisibleSelectedCellCount(table(), null)).toBe(0);
	});

	it("formats the active region row-major, through each column's format", (): void => {
		const { table } = renderGrid();
		selectRange(table(), ["p-1", "email"], ["p-2", "age"]);
		expect(getDataGridActiveRegionGrid(table())).toEqual([
			["alex@example.com", "34y"],
			["sarah@example.com", "28y"],
		]);
		expect(getDataGridVisibleSelectedCellCount(table(), null)).toBe(4);
	});

	it("clears only writable cells, with each column's clearValue", (): void => {
		const { table } = renderGrid();
		selectRange(table(), ["p-1", "email"], ["p-2", "role"]);
		const details = buildDataGridClearDetails(table(), "clear", false);
		expect(details?.source).toBe("clear");
		expect(details?.changes.map(({ rowId, columnId, value, previousValue }) => ({ rowId, columnId, value, previousValue }))).toEqual([
			{ rowId: "p-1", columnId: "email", value: "", previousValue: "alex@example.com" },
			{ rowId: "p-1", columnId: "age", value: null, previousValue: 34 },
			{ rowId: "p-2", columnId: "age", value: null, previousValue: 28 },
		]);
	});

	it("pastes a block from the region's top-left, rejecting read-only and invalid cells", (): void => {
		const { table } = renderGrid();
		selectRange(table(), ["p-2", "email"], ["p-2", "email"]);
		const result = buildDataGridPasteDetails(table(), [
			["new@example.com", "50", "Lead"],
			["other@example.com", "abc", "Lead"],
		]);
		expect(result?.details.changes.map(({ rowId, columnId, value }) => ({ rowId, columnId, value }))).toEqual([
			{ rowId: "p-2", columnId: "age", value: 50 },
			{ rowId: "p-3", columnId: "email", value: "other@example.com" },
		]);
		expect(result?.details.rejected).toEqual([
			{ rowId: "p-2", columnId: "email", raw: "new@example.com", reason: "readonly" },
			{ rowId: "p-2", columnId: "role", raw: "Lead", reason: "readonly" },
			{ rowId: "p-3", columnId: "age", raw: "abc", reason: "invalid" },
			{ rowId: "p-3", columnId: "role", raw: "Lead", reason: "readonly" },
		]);
		expect(result?.target).toEqual({ startRowIndex: 1, endRowIndex: 2, rowCount: 2, startColumnIndex: 1, endColumnIndex: 3 });
	});

	it("fills the whole region from a 1×1 block", (): void => {
		const { table } = renderGrid();
		selectRange(table(), ["p-3", "age"], ["p-5", "age"]);
		const result = buildDataGridPasteDetails(table(), [["21"]]);
		expect(result?.details.changes.map(({ rowId, value }) => ({ rowId, value }))).toEqual([
			{ rowId: "p-3", value: 21 },
			{ rowId: "p-4", value: 21 },
			{ rowId: "p-5", value: 21 },
		]);
	});
});

// ── Behaviour ──────────────────────────────────────────────────────────────

describe("DataGridCellSelection", () => {
	it("focuses the grid's table and selects a pressed cell", (): void => {
		renderGrid();
		expect(grid().tabIndex).toBe(0);
		pressCell("p-1", "name");
		expect(selectedCellIds()).toEqual(["p-1/name"]);
		expect(cellElement("p-1", "name").hasAttribute("data-cell-focused")).toBe(true);
	});

	it("extends the range with a shift-press", (): void => {
		renderGrid();
		pressCell("p-1", "name");
		pressCell("p-2", "email", { shiftKey: true });
		expect(selectedCellIds()).toEqual(["p-1/name", "p-1/email", "p-2/name", "p-2/email"]);
	});

	it("moves the focused cell with the arrow keys and points aria-activedescendant at it", async (): Promise<void> => {
		renderGrid();
		pressCell("p-1", "name");
		fireEvent.keyDown(grid(), { key: "ArrowDown" });
		fireEvent.keyDown(grid(), { key: "ArrowRight" });
		expect(cellElement("p-2", "email").hasAttribute("data-cell-focused")).toBe(true);
		await waitFor((): void => {
			const focusedId = cellElement("p-2", "email").id;
			expect(focusedId).not.toBe("");
			expect(grid().getAttribute("aria-activedescendant")).toBe(focusedId);
		});
	});

	it("grows the range with Shift+Arrow and selects everything with Ctrl+A", (): void => {
		renderGrid();
		pressCell("p-1", "name");
		fireEvent.keyDown(grid(), { key: "ArrowRight", shiftKey: true });
		expect(selectedCellIds()).toEqual(["p-1/name", "p-1/email"]);
		fireEvent.keyDown(grid(), { key: "a", ctrlKey: true });
		expect(selectedCellIds()).toHaveLength(DATA_GRID_TEST_PEOPLE.length * COLUMNS.length);
	});

	it("clears the selection with Escape", (): void => {
		renderGrid();
		pressCell("p-1", "name");
		fireEvent.keyDown(grid(), { key: "Escape" });
		expect(selectedCellIds()).toEqual([]);
	});

	it("copies the active region to the clipboard as TSV with Ctrl+C", async (): Promise<void> => {
		const writeText = vi.fn((): Promise<void> => Promise.resolve());
		Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
		const onCellsCopy = vi.fn();
		renderGrid({ onCellsCopy });
		pressCell("p-1", "email");
		pressCell("p-2", "age", { shiftKey: true });
		fireEvent.keyDown(grid(), { key: "c", ctrlKey: true });
		await waitFor((): void => {
			expect(onCellsCopy).toHaveBeenCalledWith({
				text: "alex@example.com\t34y\r\nsarah@example.com\t28y",
				grid: [
					["alex@example.com", "34y"],
					["sarah@example.com", "28y"],
				],
				cut: false,
			});
		});
		expect(writeText).toHaveBeenCalledWith("alex@example.com\t34y\r\nsarah@example.com\t28y");
		Reflect.deleteProperty(navigator, "clipboard");
	});

	it("writes both flavours on a native copy event", (): void => {
		const onCellsCopy = vi.fn();
		renderGrid({ onCellsCopy });
		pressCell("p-1", "name");
		const setData = vi.fn();
		fireEvent.copy(grid(), { clipboardData: { setData } });
		expect(setData).toHaveBeenCalledWith("text/plain", "Alex Johnson");
		expect(setData).toHaveBeenCalledWith("text/html", "<table><tbody><tr><td>Alex Johnson</td></tr></tbody></table>");
		expect(onCellsCopy).toHaveBeenCalledWith({ text: "Alex Johnson", grid: [["Alex Johnson"]], cut: false });
	});

	it("dispatches one paste batch and selects the pasted region", (): void => {
		const onCellsChange = vi.fn<(details: DataGridCellsChangeDetails<DataGridTestPerson>) => void>();
		renderGrid({ onCellsChange });
		pressCell("p-3", "age");
		fireEvent.paste(grid(), { clipboardData: { getData: (): string => "41\r\nnope\r\n" } });
		expect(onCellsChange).toHaveBeenCalledTimes(1);
		const [details] = onCellsChange.mock.lastCall ?? [];
		expect(details).toMatchObject({
			source: "paste",
			changes: [{ rowId: "p-3", columnId: "age", previousValue: 45, value: 41 }],
			rejected: [{ rowId: "p-4", columnId: "age", raw: "nope", reason: "invalid" }],
		});
		expect(selectedCellIds()).toEqual(["p-3/age", "p-4/age"]);
	});

	it("clears the selection's writable cells with Delete", (): void => {
		const onCellsChange = vi.fn();
		renderGrid({ onCellsChange });
		pressCell("p-1", "age");
		fireEvent.keyDown(grid(), { key: "Delete" });
		expect(onCellsChange).toHaveBeenCalledWith({
			source: "clear",
			changes: [{ rowId: "p-1", columnId: "age", row: DATA_GRID_TEST_PEOPLE.at(LIST_SLOT_INDEX.first), previousValue: 34, value: null }],
			rejected: [],
		});
	});

	it("opens the built-in editor with Enter, commits an edit and refocuses the grid", (): void => {
		const onCellsChange = vi.fn();
		renderGrid({ onCellsChange });
		pressCell("p-1", "name");
		fireEvent.keyDown(grid(), { key: "Enter" });
		const editor = screen.getByRole("textbox", { name: "Name" });
		expect(editor).toHaveProperty("value", "Alex Johnson");
		expect(document.activeElement).toBe(editor);
		fireEvent.change(editor, { target: { value: "Alexa" } });
		fireEvent.keyDown(editor, { key: "Enter" });
		expect(onCellsChange).toHaveBeenCalledWith({
			source: "edit",
			changes: [{ rowId: "p-1", columnId: "name", row: DATA_GRID_TEST_PEOPLE.at(LIST_SLOT_INDEX.first), previousValue: "Alex Johnson", value: "Alexa" }],
			rejected: [],
		});
		expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
	});

	it("seeds the editor with a typed character and cancels on Escape without writing", (): void => {
		const onCellsChange = vi.fn();
		renderGrid({ onCellsChange });
		pressCell("p-1", "name");
		fireEvent.keyDown(grid(), { key: "Z" });
		const editor = screen.getByRole("textbox", { name: "Name" });
		expect(editor).toHaveProperty("value", "Z");
		fireEvent.keyDown(editor, { key: "Escape" });
		expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
		expect(onCellsChange).not.toHaveBeenCalled();
	});

	it("asks the consumer to edit a writable cell without a built-in control", (): void => {
		const onCellEditRequest = vi.fn();
		renderGrid({ onCellEditRequest });
		pressCell("p-1", "age");
		fireEvent.keyDown(grid(), { key: "F2" });
		expect(onCellEditRequest).toHaveBeenLastCalledWith({ rowId: "p-1", columnId: "age", row: DATA_GRID_TEST_PEOPLE.at(LIST_SLOT_INDEX.first), previousValue: 34 });
		fireEvent.keyDown(grid(), { key: "7" });
		expect(onCellEditRequest).toHaveBeenLastCalledWith({
			rowId: "p-1",
			columnId: "age",
			row: DATA_GRID_TEST_PEOPLE.at(LIST_SLOT_INDEX.first),
			previousValue: 34,
			initialText: "7",
		});
	});

	it("moves down on Enter when the cell has no editor", (): void => {
		renderGrid();
		pressCell("p-1", "role");
		fireEvent.keyDown(grid(), { key: "Enter" });
		expect(cellElement("p-2", "role").hasAttribute("data-cell-focused")).toBe(true);
	});

	it("reports selection changes with a resolved snapshot", (): void => {
		const onCellSelectionChange = vi.fn();
		renderGrid({ onCellSelectionChange });
		pressCell("p-1", "name");
		expect(onCellSelectionChange).toHaveBeenLastCalledWith({
			focused: { rowId: "p-1", columnId: "name" },
			bounds: [{ minRowIndex: 0, maxRowIndex: 0, minColumnIndex: 0, maxColumnIndex: 0 }],
			activeBound: { minRowIndex: 0, maxRowIndex: 0, minColumnIndex: 0, maxColumnIndex: 0 },
			visibleCellCount: 1,
		});
	});

	it("exposes the imperative API through apiRef", (): void => {
		const apiRef = React.createRef<DataGridCellSelectionApi>();
		renderGrid({ apiRef });
		act((): void => {
			apiRef.current?.focusCell("p-3", "email");
		});
		expect(cellElement("p-3", "email").hasAttribute("data-cell-focused")).toBe(true);
		expect(document.activeElement).toBe(grid());
		act((): void => {
			apiRef.current?.clearSelection();
		});
		expect(cellElement("p-3", "email").hasAttribute("data-cell-focused")).toBe(false);
	});
});

function peopleCount(count: number): string {
	return `${String(count)} people`;
}

describe("DataGridSelectionBar", () => {
	function renderBar(bar: React.ReactNode): () => DataGridTableInstance<DataGridTestPerson> {
		const tables: DataGridTableInstance<DataGridTestPerson>[] = [];
		render(
			<DataGridTestHarness>
				{(table) => {
					tables.push(table);
					return bar;
				}}
			</DataGridTestHarness>,
		);
		return (): DataGridTableInstance<DataGridTestPerson> => {
			const latest = tables.at(-1);
			if (latest === undefined) {
				throw new Error("grid never rendered");
			}
			return latest;
		};
	}

	it("stays hidden until rows are selected, then shows the count and clears", (): void => {
		const onClear = vi.fn();
		const table = renderBar(
			<DataGridSelectionBar onClear={onClear}>
				<button type="button">Archive</button>
			</DataGridSelectionBar>,
		);
		expect(screen.queryByRole("button", { name: "Archive" })).toBeNull();
		act((): void => {
			table().toggleAllRowsSelected(true);
		});
		expect(screen.getByText("5 selected")).toBeDefined();
		fireEvent.click(screen.getByRole("button", { name: "Clear" }));
		expect(onClear).toHaveBeenCalledTimes(1);
		expect(screen.queryByText("5 selected")).toBeNull();
	});

	it("takes label overrides, merges className last and forwards its ref", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		const table = renderBar(<DataGridSelectionBar ref={ref} className="custom-bar" label={peopleCount} clearLabel="Reset" />);
		act((): void => {
			table().toggleAllRowsSelected(true);
		});
		expect(screen.getByText("5 people")).toBeDefined();
		expect(screen.getByRole("button", { name: "Reset" })).toBeDefined();
		expect(ref.current?.dataset.slot).toBe("data-grid-selection-bar");
		expect(ref.current?.className.endsWith("custom-bar")).toBe(true);
	});
});
