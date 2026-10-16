// @vitest-environment jsdom
import type { DataGridFeatures, DataGridTableInstance, DataGridTableLayout } from "@workspace/ui/components/data-grid/data-grid";
import {
	DataGridTableDnd,
	getDataGridDropBesideSpans,
	getDataGridRenderedColumnIds,
	type DataGridTableDndProps,
} from "@workspace/ui/components/data-grid/data-grid-table-dnd";
import { DATA_GRID_TEST_PEOPLE, DataGridResizeObserverStub, DataGridTestHarness, type DataGridTestPerson } from "@workspace/ui/testing/data-grid-test-harness";
import type { DragEndEvent } from "@dnd-kit/core";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** dnd-kit's keyboard sensor attaches its key listeners on a timeout, and re-measures in effects. */
async function nextTask(): Promise<void> {
	await new Promise<void>((resolve): void => {
		setTimeout(resolve, 0);
	});
}

const COLUMN_ORDER: readonly string[] = ["name", "email", "age", "role"];
/** jsdom lays nothing out; each column gets its own 100px slot so dnd-kit can find neighbours. */
const COLUMN_WIDTH_PX = 100;
const ROW_HEIGHT_PX = 40;

function fakeRect(element: Element): DOMRect {
	if (element instanceof HTMLTableCellElement) {
		// Head and body cells of one column share a slot (cellIndex is the column position here).
		return new DOMRect(element.cellIndex * COLUMN_WIDTH_PX, 0, COLUMN_WIDTH_PX, ROW_HEIGHT_PX);
	}
	// Containers (the viewport the drag is clamped to) span every column.
	return new DOMRect(0, 0, COLUMN_WIDTH_PX * COLUMN_ORDER.length, ROW_HEIGHT_PX);
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

const PINNED_NAME = { initialState: { columnPinning: { start: ["name"], end: [] } } };
const PINNABLE_LAYOUT: DataGridTableLayout = { columnsPinnable: true };

interface RenderOptions {
	readonly dndProps?: Partial<DataGridTableDndProps>;
	readonly pinned?: boolean;
	readonly data?: readonly DataGridTestPerson[];
	readonly isLoading?: boolean;
	readonly tableRef?: React.Ref<HTMLDivElement>;
}

function renderDnd({ dndProps = {}, pinned = false, data, isLoading = false, tableRef }: RenderOptions = {}): void {
	const handleDragEnd = dndProps.handleDragEnd ?? vi.fn();
	render(
		<DataGridTestHarness isLoading={isLoading} {...(data === undefined ? {} : { data })} {...(pinned ? { tableOptions: PINNED_NAME, tableLayout: PINNABLE_LAYOUT } : {})}>
			<DataGridTableDnd {...dndProps} handleDragEnd={handleDragEnd} {...(tableRef === undefined ? {} : { ref: tableRef })} />
		</DataGridTestHarness>,
	);
}

describe("DataGridTableDnd", () => {
	it("renders the header and body with one labelled grip per leaf column", (): void => {
		renderDnd();
		expect(screen.getAllByRole("columnheader")).toHaveLength(COLUMN_ORDER.length);
		expect(screen.getAllByRole("button", { name: "Drag to reorder" })).toHaveLength(COLUMN_ORDER.length);
		expect(screen.getByText("Alex Johnson")).toBeDefined();
	});

	it("gives a pinned column no grip", (): void => {
		renderDnd({ pinned: true });
		expect(screen.getAllByRole("button", { name: "Drag to reorder" })).toHaveLength(COLUMN_ORDER.length - 1);
	});

	it("reorders with the keyboard sensor and reports the drop", async (): Promise<void> => {
		const handleDragEnd = vi.fn<(event: DragEndEvent) => void>();
		renderDnd({ dndProps: { handleDragEnd } });
		const [nameHandle] = screen.getAllByRole("button", { name: "Drag to reorder" });
		if (nameHandle === undefined) {
			throw new Error("no handle");
		}
		nameHandle.focus();
		await act(async (): Promise<void> => {
			fireEvent.keyDown(nameHandle, { code: "Space" });
			await nextTask();
		});
		await act(async (): Promise<void> => {
			fireEvent.keyDown(document, { code: "ArrowRight" });
			await nextTask();
		});
		await act(async (): Promise<void> => {
			fireEvent.keyDown(document, { code: "Space" });
			await nextTask();
		});
		expect(handleDragEnd).toHaveBeenCalledTimes(1);
		const [event] = handleDragEnd.mock.calls.at(0) ?? [];
		expect(event?.active.id).toBe("name");
		expect(event?.over?.id).toBe("email");
	});

	it("renders the empty state without rows", (): void => {
		renderDnd({ data: [] });
		expect(screen.getByText("No data available")).toBeDefined();
	});

	it("renders skeleton rows while loading", (): void => {
		renderDnd({ isLoading: true });
		expect(screen.queryByText("Alex Johnson")).toBeNull();
	});

	it("forwards its ref to the viewport and merges className last", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		renderDnd({ tableRef: ref, dndProps: { className: "custom-dnd" } });
		expect(ref.current?.dataset.slot).toBe("data-grid-table-viewport");
		expect(ref.current?.className).toContain("custom-dnd");
	});
});

describe("drop helpers", () => {
	const SPAN_COLUMNS: ColumnDef<DataGridFeatures, DataGridTestPerson>[] = [
		{ accessorKey: "name", header: "Name" },
		{ accessorKey: "email", header: "Email", meta: { headerColSpan: 2 } },
		{ accessorKey: "age", header: "Age" },
		{ accessorKey: "role", header: "Role" },
	];

	function withTable(inspect: (table: DataGridTableInstance<DataGridTestPerson>) => void): void {
		render(
			<DataGridTestHarness columns={SPAN_COLUMNS} data={DATA_GRID_TEST_PEOPLE}>
				{(table) => {
					inspect(table);
					return null;
				}}
			</DataGridTestHarness>,
		);
	}

	function dropEvent(activeId: string, overId: string): DragEndEvent {
		const rect = { current: { initial: null, translated: null } };
		return {
			active: { id: activeId, data: { current: undefined }, rect },
			over: { id: overId, data: { current: undefined }, rect: new DOMRect(), disabled: false },
			activatorEvent: new Event("keydown"),
			collisions: null,
			delta: { x: 0, y: 0 },
		};
	}

	it("lists the rendered leaf ids in order", (): void => {
		withTable((table): void => {
			expect(getDataGridRenderedColumnIds(table)).toEqual(COLUMN_ORDER);
		});
	});

	it("moves a drop on a span's leaves to its far edge", (): void => {
		withTable((table): void => {
			// name → into the email+age span moving forward: lands after its last leaf.
			expect(getDataGridDropBesideSpans(table, dropEvent("name", "email")).over?.id).toBe("age");
			// role → into the span moving back: lands before its owner.
			expect(getDataGridDropBesideSpans(table, dropEvent("role", "age")).over?.id).toBe("email");
			// No span involved: unchanged.
			const plain = dropEvent("name", "role");
			expect(getDataGridDropBesideSpans(table, plain)).toBe(plain);
		});
	});
});
