// @vitest-environment jsdom
import type { DataGridFeatures } from "@workspace/ui/components/data-grid/data-grid";
import {
	DataGridTableDndRowHandle,
	DataGridTableDndRows,
	getDataGridDndRowDropEdge,
	holdRowsInPlaceStrategy,
	measureDataGridDndRow,
	type DataGridTableDndRowDecorationContext,
	type DataGridTableDndRowsProps,
} from "@workspace/ui/components/data-grid/data-grid-table-dnd-rows";
import {
	DATA_GRID_TEST_COLUMNS,
	DATA_GRID_TEST_PEOPLE,
	DataGridResizeObserverStub,
	DataGridTestHarness,
	type DataGridTestPerson,
} from "@workspace/ui/testing/data-grid-test-harness";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ROW_HEIGHT_PX = 40;
const GRID_WIDTH_PX = 400;
const GRID_HEIGHT_PX = 1000;

/** jsdom lays nothing out; each body row gets its own 40px band so dnd-kit can find neighbours. */
function fakeRect(element: Element): DOMRect {
	if (element instanceof HTMLTableRowElement && element.dataset.rowId !== undefined) {
		return new DOMRect(0, (element.sectionRowIndex + 1) * ROW_HEIGHT_PX, GRID_WIDTH_PX, ROW_HEIGHT_PX);
	}
	if (element instanceof HTMLElement && element.dataset.slot === "data-grid-table-viewport") {
		// The container the drag is clamped to.
		return new DOMRect(0, 0, GRID_WIDTH_PX, GRID_HEIGHT_PX);
	}
	// Anything else (the drag overlay clone) sits where the first row was lifted from.
	return new DOMRect(0, ROW_HEIGHT_PX, GRID_WIDTH_PX, ROW_HEIGHT_PX);
}

/** dnd-kit's keyboard sensor attaches its key listeners on a timeout, and re-measures in effects. */
async function nextTask(): Promise<void> {
	await new Promise<void>((resolve): void => {
		setTimeout(resolve, 0);
	});
}

async function press(target: Element | Document, code: string): Promise<void> {
	await act(async (): Promise<void> => {
		fireEvent.keyDown(target, { code });
		await nextTask();
	});
}

beforeEach((): void => {
	vi.stubGlobal("ResizeObserver", DataGridResizeObserverStub);
	vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function getBoundingClientRect(this: Element): DOMRect {
		return fakeRect(this);
	});
});

afterEach((): void => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

function RowHandleCell(): React.JSX.Element {
	return <DataGridTableDndRowHandle />;
}

const DND_COLUMNS: ColumnDef<DataGridFeatures, DataGridTestPerson>[] = [{ id: "drag", header: "", cell: RowHandleCell, size: 40 }, ...DATA_GRID_TEST_COLUMNS];
const DATA_IDS: readonly string[] = DATA_GRID_TEST_PEOPLE.map((person) => person.id);

interface RenderOptions {
	readonly rowsProps?: Partial<DataGridTableDndRowsProps>;
	readonly tableRef?: React.Ref<HTMLDivElement>;
}

function renderRows({ rowsProps = {}, tableRef }: RenderOptions = {}): void {
	const handleDragEnd = rowsProps.handleDragEnd ?? vi.fn();
	render(
		<DataGridTestHarness columns={DND_COLUMNS}>
			<DataGridTableDndRows dataIds={DATA_IDS} {...rowsProps} handleDragEnd={handleDragEnd} {...(tableRef === undefined ? {} : { ref: tableRef })} />
		</DataGridTestHarness>,
	);
}

function firstHandle(): HTMLElement {
	const [handle] = screen.getAllByRole("button", { name: "Drag to reorder row" });
	if (handle === undefined) {
		throw new Error("no row handle");
	}
	return handle;
}

describe("DataGridTableDndRows", () => {
	it("renders every row with a labelled, enabled grip", (): void => {
		renderRows();
		const handles = screen.getAllByRole("button", { name: "Drag to reorder row" });
		expect(handles).toHaveLength(DATA_GRID_TEST_PEOPLE.length);
		expect(handles.every((handle) => !handle.hasAttribute("disabled"))).toBe(true);
		expect(screen.getByText("Alex Johnson")).toBeDefined();
	});

	it("reorders a row with the keyboard sensor and reports the drop", async (): Promise<void> => {
		const handleDragEnd = vi.fn<(event: DragEndEvent) => void>();
		const onDragStart = vi.fn<(event: DragStartEvent) => void>();
		renderRows({ rowsProps: { handleDragEnd, onDragStart } });
		const handle = firstHandle();
		handle.focus();
		await press(handle, "Space");
		expect(onDragStart).toHaveBeenCalledTimes(1);
		await press(document, "ArrowDown");
		await press(document, "Space");
		expect(handleDragEnd).toHaveBeenCalledTimes(1);
		const [event] = handleDragEnd.mock.calls.at(0) ?? [];
		expect(event?.active.id).toBe("p-1");
		expect(event?.over?.id).toBe("p-2");
		expect(event?.active.data.current).toMatchObject({ type: "data-grid-row", depth: 0, index: 0, parentId: null });
	});

	it("cancels a keyboard drag with Escape without dropping", async (): Promise<void> => {
		const handleDragEnd = vi.fn<(event: DragEndEvent) => void>();
		const onDragCancel = vi.fn();
		renderRows({ rowsProps: { handleDragEnd, onDragCancel } });
		const handle = firstHandle();
		handle.focus();
		await press(handle, "Space");
		await press(document, "Escape");
		expect(onDragCancel).toHaveBeenCalledTimes(1);
		expect(handleDragEnd).not.toHaveBeenCalled();
	});

	it("renders a decoration over each row from its id and drag state", (): void => {
		const contexts: DataGridTableDndRowDecorationContext[] = [];
		function decorate(context: DataGridTableDndRowDecorationContext): React.ReactNode {
			contexts.push(context);
			return <span>{`decoration ${context.rowId}`}</span>;
		}
		renderRows({ rowsProps: { renderRowDecoration: decorate } });
		expect(screen.getByText("decoration p-3")).toBeDefined();
		expect(contexts.find((context) => context.rowId === "p-3")).toMatchObject({ rowId: "p-3", depth: 0, index: 2, isDragging: false, isOver: false });
	});

	it("forwards its ref to the viewport and merges className last", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		renderRows({ tableRef: ref, rowsProps: { className: "custom-rows" } });
		expect(ref.current?.dataset.slot).toBe("data-grid-table-viewport");
		expect(ref.current?.className).toContain("custom-rows");
	});
});

describe("DataGridTableDndRowHandle", () => {
	it("renders inert outside a draggable row", (): void => {
		render(
			<DataGridTestHarness>
				<DataGridTableDndRowHandle />
			</DataGridTestHarness>,
		);
		expect(screen.getByRole("button", { name: "Drag to reorder row" }).hasAttribute("disabled")).toBe(true);
	});

	it("announces reordering as unavailable while disabled, with an overridable label", (): void => {
		render(
			<DataGridTestHarness>
				<DataGridTableDndRowHandle disabled />
				<DataGridTableDndRowHandle disabled disabledLabel="Sorted by name" className="custom-handle" />
			</DataGridTestHarness>,
		);
		const unavailable = screen.getByRole("button", { name: "Reordering unavailable" });
		expect(unavailable.getAttribute("title")).toBe("Reordering unavailable");
		const custom = screen.getByRole("button", { name: "Sorted by name" });
		expect(custom.className).toContain("custom-handle");
		expect(custom.className).toContain("cursor-not-allowed");
	});

	it("forwards its ref", (): void => {
		const ref = React.createRef<HTMLButtonElement>();
		render(
			<DataGridTestHarness>
				<DataGridTableDndRowHandle ref={ref} />
			</DataGridTestHarness>,
		);
		expect(ref.current?.dataset.slot).toBe("data-grid-table-dnd-row-handle");
	});
});

describe("row dnd helpers", () => {
	it("marks the landing edge in the direction of travel", (): void => {
		expect(getDataGridDndRowDropEdge(true, 0, 2, 2, false)).toBe("bottom");
		expect(getDataGridDndRowDropEdge(true, 3, 1, 1, false)).toBe("top");
		expect(getDataGridDndRowDropEdge(true, 0, 1, 2, false)).toBeNull();
		expect(getDataGridDndRowDropEdge(true, -1, 2, 2, false)).toBeNull();
		expect(getDataGridDndRowDropEdge(false, 0, 2, 2, false)).toBeNull();
		expect(getDataGridDndRowDropEdge(true, 0, 2, 2, true)).toBeNull();
	});

	it("holds every row in place", (): void => {
		const rect = { width: 1, height: 1, top: 0, left: 0, right: 1, bottom: 1 };
		expect(holdRowsInPlaceStrategy({ rects: [rect], activeNodeRect: rect, activeIndex: 0, overIndex: 0, index: 0 })).toBeNull();
	});

	it("measures the carried row's cells without the fill strip", (): void => {
		const container = document.createElement("div");
		container.innerHTML =
			'<table><thead><tr><th>a</th></tr></thead><tbody><tr data-row-id="r-1"><td>a</td><td>b</td><td data-slot="data-grid-table-fill-body-cell"></td></tr></tbody></table>';
		document.body.append(container);
		const carried = measureDataGridDndRow(container, "r-1");
		expect(carried?.columns).toHaveLength(2);
		expect(carried?.padding).toHaveLength(2);
		expect(carried?.height).toBe(ROW_HEIGHT_PX);
		expect(carried?.width).toBe(GRID_WIDTH_PX * (carried?.columns.length ?? 0));
		container.remove();
		expect(measureDataGridDndRow(document.createElement("div"), "r-1")).toBeNull();
	});
});
