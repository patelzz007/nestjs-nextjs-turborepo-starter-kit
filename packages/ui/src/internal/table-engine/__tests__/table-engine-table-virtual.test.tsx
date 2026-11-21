// @vitest-environment jsdom
import { LIST_SLOT_INDEX } from "@workspace/shared";
import type { TableEngineLabelsOverride } from "../table-engine-i18n";
import { TableEngineTableLayoutSchema, type TableEngineFeatures } from "../table-engine";
import {
	TableEngineTableVirtual,
	getTableEngineTableCenterColumnWindow,
	getTableEngineTableHeaderOffset,
	getTableEngineTableScrollTarget,
	getTableEngineTableVirtualSpacers,
	isTableEngineTableColumnVirtualizable,
	isSameTableEngineTableColumnScrollRequest,
	isSameTableEngineTableScrollRequest,
	scrollTableEngineTableRowIntoView,
	scrollTableEngineTableToOffset,
	shouldTableEngineTableFetchMore,
	type TableEngineTableColumnScrollRequest,
	type TableEngineTableVirtualizerOptions,
	type TableEngineTableVirtualScrollRequest,
} from "../table-engine-table-virtual";
import { getTableEngineTableMergedHeaderGroups } from "../table-engine-table";
import { TableEngineResizeObserverStub, TableEngineTestHarness, type TableEngineTestPerson } from "../testing/table-engine-test-harness";
import { cleanup, render, screen } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";
import type { Rect, VirtualItem, Virtualizer } from "@tanstack/react-virtual";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach((): void => {
	vi.stubGlobal("ResizeObserver", TableEngineResizeObserverStub);
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

/** Row height the tests' virtualizer works with. */
const ROW_PX = 40;
/** The viewport height the tests' virtualizer is told about: five rows. */
const VIEWPORT_PX = 200;
const MANY_ROWS = 200;

function makePeople(count: number): TableEngineTestPerson[] {
	return Array.from({ length: count }, (_, index): TableEngineTestPerson => ({
		id: `p-${String(index)}`,
		name: `Person ${String(index)}`,
		email: `person${String(index)}@example.com`,
		age: index,
		role: "Engineer",
	}));
}

const MANY_PEOPLE = makePeople(MANY_ROWS);
const FEW_PEOPLE = makePeople(3);
const NO_PEOPLE: TableEngineTestPerson[] = [];

/** Reports a fixed viewport size instead of jsdom's zero-size layout. */
function observeFixedRect(_instance: Virtualizer<HTMLElement, HTMLTableRowElement>, callback: (rect: Rect) => void): void {
	callback({ width: 800, height: VIEWPORT_PX });
}

function estimateRow(): number {
	return ROW_PX;
}

const FIXED_VIRTUALIZER: TableEngineTableVirtualizerOptions = { observeElementRect: observeFixedRect, estimateSize: estimateRow, overscan: 2 };
const DISABLED_VIRTUALIZER: TableEngineTableVirtualizerOptions = { enabled: false };

function countBodyRows(): number {
	return document.querySelectorAll('tbody[data-slot="table-engine-table-body"] > tr[data-row-id]').length;
}

describe("TableEngineTableVirtual", () => {
	it("mounts only the rows inside the window, with spacers for the rest", (): void => {
		render(
			<TableEngineTestHarness data={MANY_PEOPLE}>
				<TableEngineTableVirtual height={VIEWPORT_PX} virtualizerOptions={FIXED_VIRTUALIZER} />
			</TableEngineTestHarness>,
		);
		const rendered = countBodyRows();
		expect(rendered).toBeGreaterThan(0);
		expect(rendered).toBeLessThan(MANY_ROWS);
		expect(screen.getByText("Person 0")).toBeDefined();
		expect(screen.queryByText(`Person ${String(MANY_ROWS - 1)}`)).toBeNull();
		expect(document.querySelectorAll('tr[aria-hidden="true"]').length).toBeGreaterThan(0);
	});

	it("renders every row when virtualization is disabled", (): void => {
		render(
			<TableEngineTestHarness data={FEW_PEOPLE}>
				<TableEngineTableVirtual virtualizerOptions={DISABLED_VIRTUALIZER} />
			</TableEngineTestHarness>,
		);
		expect(countBodyRows()).toBe(FEW_PEOPLE.length);
	});

	it("renders the header row with sort semantics, and can omit it", (): void => {
		const { unmount } = render(
			<TableEngineTestHarness data={FEW_PEOPLE}>
				<TableEngineTableVirtual virtualizerOptions={FIXED_VIRTUALIZER} />
			</TableEngineTestHarness>,
		);
		expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Name", "Email", "Age", "Role"]);
		unmount();
		render(
			<TableEngineTestHarness data={FEW_PEOPLE}>
				<TableEngineTableVirtual renderHeader={false} virtualizerOptions={FIXED_VIRTUALIZER} />
			</TableEngineTestHarness>,
		);
		expect(screen.queryAllByRole("columnheader")).toHaveLength(0);
	});

	it("shows the empty state, and the loading row on an initial load", (): void => {
		const { unmount } = render(
			<TableEngineTestHarness data={NO_PEOPLE}>
				<TableEngineTableVirtual virtualizerOptions={FIXED_VIRTUALIZER} />
			</TableEngineTestHarness>,
		);
		expect(screen.getByText("No data available")).toBeDefined();
		unmount();
		render(
			<TableEngineTestHarness data={NO_PEOPLE} isLoading>
				<TableEngineTableVirtual virtualizerOptions={FIXED_VIRTUALIZER} />
			</TableEngineTestHarness>,
		);
		expect(screen.getByRole("status").textContent).toBe("Loading…");
	});

	it("asks for more rows once the window nears the end, once per row count", (): void => {
		const onFetchMore = vi.fn();
		const { rerender } = render(
			<TableEngineTestHarness data={FEW_PEOPLE}>
				<TableEngineTableVirtual onFetchMore={onFetchMore} virtualizerOptions={FIXED_VIRTUALIZER} />
			</TableEngineTestHarness>,
		);
		expect(onFetchMore).toHaveBeenCalledTimes(1);
		rerender(
			<TableEngineTestHarness data={FEW_PEOPLE}>
				<TableEngineTableVirtual onFetchMore={onFetchMore} virtualizerOptions={FIXED_VIRTUALIZER} />
			</TableEngineTestHarness>,
		);
		expect(onFetchMore).toHaveBeenCalledTimes(1);
	});

	it("does not fetch while far from the end, while fetching, or once everything is loaded", (): void => {
		const onFetchMore = vi.fn();
		const { unmount } = render(
			<TableEngineTestHarness data={MANY_PEOPLE}>
				<TableEngineTableVirtual onFetchMore={onFetchMore} virtualizerOptions={FIXED_VIRTUALIZER} />
			</TableEngineTestHarness>,
		);
		unmount();
		const second = render(
			<TableEngineTestHarness data={FEW_PEOPLE}>
				<TableEngineTableVirtual onFetchMore={onFetchMore} isFetchingMore virtualizerOptions={FIXED_VIRTUALIZER} />
			</TableEngineTestHarness>,
		);
		second.unmount();
		render(
			<TableEngineTestHarness data={FEW_PEOPLE}>
				<TableEngineTableVirtual onFetchMore={onFetchMore} hasMore={false} virtualizerOptions={FIXED_VIRTUALIZER} />
			</TableEngineTestHarness>,
		);
		expect(onFetchMore).not.toHaveBeenCalled();
	});

	it("shows the fetching-more and all-rows-loaded rows with their labels", (): void => {
		const onFetchMore = vi.fn();
		const { unmount } = render(
			<TableEngineTestHarness data={FEW_PEOPLE}>
				<TableEngineTableVirtual onFetchMore={onFetchMore} isFetchingMore virtualizerOptions={FIXED_VIRTUALIZER} />
			</TableEngineTestHarness>,
		);
		expect(screen.getByRole("status").textContent).toBe("Loading more…");
		unmount();
		render(
			<TableEngineTestHarness data={FEW_PEOPLE}>
				<TableEngineTableVirtual onFetchMore={onFetchMore} hasMore={false} virtualizerOptions={FIXED_VIRTUALIZER} />
			</TableEngineTestHarness>,
		);
		expect(screen.getByText("All records loaded")).toBeDefined();
	});

	it("lets the grid's labels and message props override the defaults", (): void => {
		const onFetchMore = vi.fn();
		const labels: TableEngineLabelsOverride = { allRowsLoaded: "That is everything" };
		const { unmount } = render(
			<TableEngineTestHarness data={FEW_PEOPLE} labels={labels}>
				<TableEngineTableVirtual onFetchMore={onFetchMore} hasMore={false} virtualizerOptions={FIXED_VIRTUALIZER} />
			</TableEngineTestHarness>,
		);
		expect(screen.getByText("That is everything")).toBeDefined();
		unmount();
		render(
			<TableEngineTestHarness data={FEW_PEOPLE} fetchingMoreMessage="Fetching page 2" allRowsLoadedMessage="unused">
				<TableEngineTableVirtual onFetchMore={onFetchMore} isFetchingMore virtualizerOptions={FIXED_VIRTUALIZER} />
			</TableEngineTestHarness>,
		);
		expect(screen.getByRole("status").textContent).toBe("Fetching page 2");
	});

	it("forwards its ref to the viewport and merges className last", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(
			<TableEngineTestHarness data={FEW_PEOPLE}>
				<TableEngineTableVirtual ref={ref} className="custom-virtual" virtualizerOptions={FIXED_VIRTUALIZER} />
			</TableEngineTestHarness>,
		);
		expect(ref.current?.dataset.slot).toBe("table-engine-table-viewport");
		expect(ref.current?.className.endsWith("custom-virtual")).toBe(true);
		expect(ref.current?.style.overflow).toBe("auto");
	});

	it("passes the row's data to a custom estimator and key getter", (): void => {
		const seen: string[] = [];
		function estimate(_index: number, row: TableEngineTestPerson): number {
			seen.push(row.name);
			return ROW_PX;
		}
		function key(_index: number, row: TableEngineTestPerson): string {
			return `key-${row.id}`;
		}
		const options: TableEngineTableVirtualizerOptions = { observeElementRect: observeFixedRect, estimateSize: estimate, getItemKey: key };
		render(
			<TableEngineTestHarness data={FEW_PEOPLE}>
				<TableEngineTableVirtual virtualizerOptions={options} />
			</TableEngineTestHarness>,
		);
		expect(seen).toContain("Person 0");
		expect(countBodyRows()).toBe(FEW_PEOPLE.length);
	});
});

function item(index: number, start: number, size: number): VirtualItem {
	return { index, start, size, end: start + size, key: index, lane: 0 };
}

describe("pure helpers", () => {
	it("getTableEngineTableScrollTarget aligns rows and clamps to the scroll range", (): void => {
		const base = { clientHeight: 100, rowHeight: 20, scrollHeight: 1000, scrollTop: 200 };
		expect(getTableEngineTableScrollTarget({ ...base, align: "auto", rowTop: 250, rowBottom: 270 })).toBeNull();
		expect(getTableEngineTableScrollTarget({ ...base, align: "auto", rowTop: 100, rowBottom: 120 })).toBe(100);
		expect(getTableEngineTableScrollTarget({ ...base, align: "auto", rowTop: 400, rowBottom: 420 })).toBe(320);
		expect(getTableEngineTableScrollTarget({ ...base, align: "start", rowTop: 400, rowBottom: 420 })).toBe(400);
		expect(getTableEngineTableScrollTarget({ ...base, align: "end", rowTop: 400, rowBottom: 420 })).toBe(320);
		expect(getTableEngineTableScrollTarget({ ...base, align: "center", rowTop: 400, rowBottom: 420 })).toBe(360);
		expect(getTableEngineTableScrollTarget({ ...base, align: "start", rowTop: 990, rowBottom: 1010 })).toBe(900);
		expect(getTableEngineTableScrollTarget({ ...base, align: "start", rowTop: 400, rowBottom: 420, viewportTopOffset: 30 })).toBe(370);
	});

	it("compares scroll requests by every field", (): void => {
		const scrollElement = document.createElement("div");
		const containerElement = document.createElement("div");
		const column: TableEngineTableColumnScrollRequest = { align: "auto", behavior: "auto", columnId: "name", columnIndex: 0, scrollElement };
		expect(isSameTableEngineTableColumnScrollRequest(null, column)).toBe(false);
		expect(isSameTableEngineTableColumnScrollRequest({ ...column }, column)).toBe(true);
		expect(isSameTableEngineTableColumnScrollRequest({ ...column, columnIndex: 1 }, column)).toBe(false);
		const row: TableEngineTableVirtualScrollRequest = {
			align: "auto",
			behavior: "auto",
			containerElement,
			headerSticky: false,
			isVirtualizationEnabled: true,
			rowId: "p-1",
			rowIndex: 1,
			scrollElement,
		};
		expect(isSameTableEngineTableScrollRequest(null, row)).toBe(false);
		expect(isSameTableEngineTableScrollRequest({ ...row }, row)).toBe(true);
		expect(isSameTableEngineTableScrollRequest({ ...row, headerSticky: true }, row)).toBe(false);
	});

	it("getTableEngineTableHeaderOffset is zero without a sticky header", (): void => {
		const containerElement = document.createElement("div");
		const scrollElement = document.createElement("div");
		expect(getTableEngineTableHeaderOffset({ containerElement, headerSticky: false, scrollElement })).toBe(0);
		expect(getTableEngineTableHeaderOffset({ containerElement, headerSticky: true, scrollElement })).toBe(0);
	});

	it("scrollTableEngineTableToOffset prefers the virtualizer, then the element", (): void => {
		const scrollElement = document.createElement("div");
		scrollTableEngineTableToOffset({ behavior: "auto", scrollElement, targetTop: 120 });
		expect(scrollElement.scrollTop).toBe(120);
	});

	it("scrollTableEngineTableRowIntoView reports an unmounted row as unhandled", (): void => {
		const containerElement = document.createElement("div");
		const scrollElement = document.createElement("div");
		expect(scrollTableEngineTableRowIntoView({ align: "auto", behavior: "auto", containerElement, headerSticky: false, rowIndex: 3, scrollElement })).toBe(false);
		expect(scrollTableEngineTableRowIntoView({ align: "auto", behavior: "auto", containerElement: null, headerSticky: false, rowIndex: 3, scrollElement })).toBe(false);
	});

	it("scrollTableEngineTableRowIntoView handles a mounted, already visible row", (): void => {
		const containerElement = document.createElement("div");
		containerElement.innerHTML = '<table data-slot="table-engine-table"><tbody><tr data-index="2"></tr></tbody></table>';
		const scrollElement = document.createElement("div");
		expect(scrollTableEngineTableRowIntoView({ align: "auto", behavior: "auto", containerElement, headerSticky: false, rowIndex: 2, scrollElement })).toBe(true);
	});

	it("getTableEngineTableCenterColumnWindow spans the first to the last virtual column", (): void => {
		expect(getTableEngineTableCenterColumnWindow([])).toBeUndefined();
		expect(getTableEngineTableCenterColumnWindow([item(2, 0, 10), item(3, 10, 10), item(5, 20, 10)])).toEqual({ start: 2, end: 5 });
	});

	it("getTableEngineTableVirtualSpacers fills the space around the window", (): void => {
		expect(getTableEngineTableVirtualSpacers([], 500)).toEqual({ leading: 0, trailing: 0 });
		expect(getTableEngineTableVirtualSpacers([item(5, 200, 40), item(6, 240, 40)], 1000)).toEqual({ leading: 200, trailing: 720 });
	});

	it("shouldTableEngineTableFetchMore triggers within the offset of the last row", (): void => {
		expect(shouldTableEngineTableFetchMore([], 10, 0)).toBe(false);
		expect(shouldTableEngineTableFetchMore([item(9, 0, 40)], 10, 0)).toBe(true);
		expect(shouldTableEngineTableFetchMore([item(7, 0, 40)], 10, 0)).toBe(false);
		expect(shouldTableEngineTableFetchMore([item(7, 0, 40)], 10, 2)).toBe(true);
		expect(shouldTableEngineTableFetchMore([item(7, 0, 40)], 10, -5)).toBe(false);
	});

	it("isTableEngineTableColumnVirtualizable needs a fixed layout and one ungrouped header row", (): void => {
		const groupedColumns: ColumnDef<TableEngineFeatures, TableEngineTestPerson>[] = [{ id: "group", header: "Group", columns: [{ accessorKey: "name", header: "Name" }] }];
		const flatLayout = TableEngineTableLayoutSchema.parse({});
		const autoLayout = TableEngineTableLayoutSchema.parse({ width: "auto" });
		const results: boolean[][] = [];
		render(
			<TableEngineTestHarness>
				{(table) => {
					const groups = getTableEngineTableMergedHeaderGroups(table);
					results.push([
						isTableEngineTableColumnVirtualizable(true, flatLayout, groups),
						isTableEngineTableColumnVirtualizable(false, flatLayout, groups),
						isTableEngineTableColumnVirtualizable(true, autoLayout, groups),
					]);
					return null;
				}}
			</TableEngineTestHarness>,
		);
		render(
			<TableEngineTestHarness columns={groupedColumns}>
				{(table) => {
					results.push([isTableEngineTableColumnVirtualizable(true, flatLayout, getTableEngineTableMergedHeaderGroups(table))]);
					return null;
				}}
			</TableEngineTestHarness>,
		);
		expect(results.at(LIST_SLOT_INDEX.first)).toEqual([true, false, false]);
		expect(results.at(-1)).toEqual([false]);
	});
});
