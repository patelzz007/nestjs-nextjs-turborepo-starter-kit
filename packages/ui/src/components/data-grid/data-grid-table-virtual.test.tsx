// @vitest-environment jsdom
import { LIST_SLOT_INDEX } from "@workspace/shared";
import type { DataGridLabelsOverride } from "@workspace/ui/components/data-grid/data-grid-i18n";
import { DataGridTableLayoutSchema, type DataGridFeatures } from "@workspace/ui/components/data-grid/data-grid";
import {
	DataGridTableVirtual,
	getDataGridTableCenterColumnWindow,
	getDataGridTableHeaderOffset,
	getDataGridTableScrollTarget,
	getDataGridTableVirtualSpacers,
	isDataGridTableColumnVirtualizable,
	isSameDataGridTableColumnScrollRequest,
	isSameDataGridTableScrollRequest,
	scrollDataGridTableRowIntoView,
	scrollDataGridTableToOffset,
	shouldDataGridTableFetchMore,
	type DataGridTableColumnScrollRequest,
	type DataGridTableVirtualizerOptions,
	type DataGridTableVirtualScrollRequest,
} from "@workspace/ui/components/data-grid/data-grid-table-virtual";
import { getDataGridTableMergedHeaderGroups } from "@workspace/ui/components/data-grid/data-grid-table";
import { DataGridResizeObserverStub, DataGridTestHarness, type DataGridTestPerson } from "@workspace/ui/testing/data-grid-test-harness";
import { cleanup, render, screen } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";
import type { Rect, VirtualItem, Virtualizer } from "@tanstack/react-virtual";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach((): void => {
	vi.stubGlobal("ResizeObserver", DataGridResizeObserverStub);
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

function makePeople(count: number): DataGridTestPerson[] {
	return Array.from({ length: count }, (_, index): DataGridTestPerson => ({
		id: `p-${String(index)}`,
		name: `Person ${String(index)}`,
		email: `person${String(index)}@example.com`,
		age: index,
		role: "Engineer",
	}));
}

const MANY_PEOPLE = makePeople(MANY_ROWS);
const FEW_PEOPLE = makePeople(3);
const NO_PEOPLE: DataGridTestPerson[] = [];

/** Reports a fixed viewport size instead of jsdom's zero-size layout. */
function observeFixedRect(_instance: Virtualizer<HTMLElement, HTMLTableRowElement>, callback: (rect: Rect) => void): void {
	callback({ width: 800, height: VIEWPORT_PX });
}

function estimateRow(): number {
	return ROW_PX;
}

const FIXED_VIRTUALIZER: DataGridTableVirtualizerOptions = { observeElementRect: observeFixedRect, estimateSize: estimateRow, overscan: 2 };
const DISABLED_VIRTUALIZER: DataGridTableVirtualizerOptions = { enabled: false };

function countBodyRows(): number {
	return document.querySelectorAll('tbody[data-slot="data-grid-table-body"] > tr[data-row-id]').length;
}

describe("DataGridTableVirtual", () => {
	it("mounts only the rows inside the window, with spacers for the rest", (): void => {
		render(
			<DataGridTestHarness data={MANY_PEOPLE}>
				<DataGridTableVirtual height={VIEWPORT_PX} virtualizerOptions={FIXED_VIRTUALIZER} />
			</DataGridTestHarness>,
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
			<DataGridTestHarness data={FEW_PEOPLE}>
				<DataGridTableVirtual virtualizerOptions={DISABLED_VIRTUALIZER} />
			</DataGridTestHarness>,
		);
		expect(countBodyRows()).toBe(FEW_PEOPLE.length);
	});

	it("renders the header row with sort semantics, and can omit it", (): void => {
		const { unmount } = render(
			<DataGridTestHarness data={FEW_PEOPLE}>
				<DataGridTableVirtual virtualizerOptions={FIXED_VIRTUALIZER} />
			</DataGridTestHarness>,
		);
		expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Name", "Email", "Age", "Role"]);
		unmount();
		render(
			<DataGridTestHarness data={FEW_PEOPLE}>
				<DataGridTableVirtual renderHeader={false} virtualizerOptions={FIXED_VIRTUALIZER} />
			</DataGridTestHarness>,
		);
		expect(screen.queryAllByRole("columnheader")).toHaveLength(0);
	});

	it("shows the empty state, and the loading row on an initial load", (): void => {
		const { unmount } = render(
			<DataGridTestHarness data={NO_PEOPLE}>
				<DataGridTableVirtual virtualizerOptions={FIXED_VIRTUALIZER} />
			</DataGridTestHarness>,
		);
		expect(screen.getByText("No data available")).toBeDefined();
		unmount();
		render(
			<DataGridTestHarness data={NO_PEOPLE} isLoading>
				<DataGridTableVirtual virtualizerOptions={FIXED_VIRTUALIZER} />
			</DataGridTestHarness>,
		);
		expect(screen.getByRole("status").textContent).toBe("Loading…");
	});

	it("asks for more rows once the window nears the end, once per row count", (): void => {
		const onFetchMore = vi.fn();
		const { rerender } = render(
			<DataGridTestHarness data={FEW_PEOPLE}>
				<DataGridTableVirtual onFetchMore={onFetchMore} virtualizerOptions={FIXED_VIRTUALIZER} />
			</DataGridTestHarness>,
		);
		expect(onFetchMore).toHaveBeenCalledTimes(1);
		rerender(
			<DataGridTestHarness data={FEW_PEOPLE}>
				<DataGridTableVirtual onFetchMore={onFetchMore} virtualizerOptions={FIXED_VIRTUALIZER} />
			</DataGridTestHarness>,
		);
		expect(onFetchMore).toHaveBeenCalledTimes(1);
	});

	it("does not fetch while far from the end, while fetching, or once everything is loaded", (): void => {
		const onFetchMore = vi.fn();
		const { unmount } = render(
			<DataGridTestHarness data={MANY_PEOPLE}>
				<DataGridTableVirtual onFetchMore={onFetchMore} virtualizerOptions={FIXED_VIRTUALIZER} />
			</DataGridTestHarness>,
		);
		unmount();
		const second = render(
			<DataGridTestHarness data={FEW_PEOPLE}>
				<DataGridTableVirtual onFetchMore={onFetchMore} isFetchingMore virtualizerOptions={FIXED_VIRTUALIZER} />
			</DataGridTestHarness>,
		);
		second.unmount();
		render(
			<DataGridTestHarness data={FEW_PEOPLE}>
				<DataGridTableVirtual onFetchMore={onFetchMore} hasMore={false} virtualizerOptions={FIXED_VIRTUALIZER} />
			</DataGridTestHarness>,
		);
		expect(onFetchMore).not.toHaveBeenCalled();
	});

	it("shows the fetching-more and all-rows-loaded rows with their labels", (): void => {
		const onFetchMore = vi.fn();
		const { unmount } = render(
			<DataGridTestHarness data={FEW_PEOPLE}>
				<DataGridTableVirtual onFetchMore={onFetchMore} isFetchingMore virtualizerOptions={FIXED_VIRTUALIZER} />
			</DataGridTestHarness>,
		);
		expect(screen.getByRole("status").textContent).toBe("Loading more…");
		unmount();
		render(
			<DataGridTestHarness data={FEW_PEOPLE}>
				<DataGridTableVirtual onFetchMore={onFetchMore} hasMore={false} virtualizerOptions={FIXED_VIRTUALIZER} />
			</DataGridTestHarness>,
		);
		expect(screen.getByText("All records loaded")).toBeDefined();
	});

	it("lets the grid's labels and message props override the defaults", (): void => {
		const onFetchMore = vi.fn();
		const labels: DataGridLabelsOverride = { allRowsLoaded: "That is everything" };
		const { unmount } = render(
			<DataGridTestHarness data={FEW_PEOPLE} labels={labels}>
				<DataGridTableVirtual onFetchMore={onFetchMore} hasMore={false} virtualizerOptions={FIXED_VIRTUALIZER} />
			</DataGridTestHarness>,
		);
		expect(screen.getByText("That is everything")).toBeDefined();
		unmount();
		render(
			<DataGridTestHarness data={FEW_PEOPLE} fetchingMoreMessage="Fetching page 2" allRowsLoadedMessage="unused">
				<DataGridTableVirtual onFetchMore={onFetchMore} isFetchingMore virtualizerOptions={FIXED_VIRTUALIZER} />
			</DataGridTestHarness>,
		);
		expect(screen.getByRole("status").textContent).toBe("Fetching page 2");
	});

	it("forwards its ref to the viewport and merges className last", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(
			<DataGridTestHarness data={FEW_PEOPLE}>
				<DataGridTableVirtual ref={ref} className="custom-virtual" virtualizerOptions={FIXED_VIRTUALIZER} />
			</DataGridTestHarness>,
		);
		expect(ref.current?.dataset.slot).toBe("data-grid-table-viewport");
		expect(ref.current?.className.endsWith("custom-virtual")).toBe(true);
		expect(ref.current?.style.overflow).toBe("auto");
	});

	it("passes the row's data to a custom estimator and key getter", (): void => {
		const seen: string[] = [];
		function estimate(_index: number, row: DataGridTestPerson): number {
			seen.push(row.name);
			return ROW_PX;
		}
		function key(_index: number, row: DataGridTestPerson): string {
			return `key-${row.id}`;
		}
		const options: DataGridTableVirtualizerOptions = { observeElementRect: observeFixedRect, estimateSize: estimate, getItemKey: key };
		render(
			<DataGridTestHarness data={FEW_PEOPLE}>
				<DataGridTableVirtual virtualizerOptions={options} />
			</DataGridTestHarness>,
		);
		expect(seen).toContain("Person 0");
		expect(countBodyRows()).toBe(FEW_PEOPLE.length);
	});
});

function item(index: number, start: number, size: number): VirtualItem {
	return { index, start, size, end: start + size, key: index, lane: 0 };
}

describe("pure helpers", () => {
	it("getDataGridTableScrollTarget aligns rows and clamps to the scroll range", (): void => {
		const base = { clientHeight: 100, rowHeight: 20, scrollHeight: 1000, scrollTop: 200 };
		expect(getDataGridTableScrollTarget({ ...base, align: "auto", rowTop: 250, rowBottom: 270 })).toBeNull();
		expect(getDataGridTableScrollTarget({ ...base, align: "auto", rowTop: 100, rowBottom: 120 })).toBe(100);
		expect(getDataGridTableScrollTarget({ ...base, align: "auto", rowTop: 400, rowBottom: 420 })).toBe(320);
		expect(getDataGridTableScrollTarget({ ...base, align: "start", rowTop: 400, rowBottom: 420 })).toBe(400);
		expect(getDataGridTableScrollTarget({ ...base, align: "end", rowTop: 400, rowBottom: 420 })).toBe(320);
		expect(getDataGridTableScrollTarget({ ...base, align: "center", rowTop: 400, rowBottom: 420 })).toBe(360);
		expect(getDataGridTableScrollTarget({ ...base, align: "start", rowTop: 990, rowBottom: 1010 })).toBe(900);
		expect(getDataGridTableScrollTarget({ ...base, align: "start", rowTop: 400, rowBottom: 420, viewportTopOffset: 30 })).toBe(370);
	});

	it("compares scroll requests by every field", (): void => {
		const scrollElement = document.createElement("div");
		const containerElement = document.createElement("div");
		const column: DataGridTableColumnScrollRequest = { align: "auto", behavior: "auto", columnId: "name", columnIndex: 0, scrollElement };
		expect(isSameDataGridTableColumnScrollRequest(null, column)).toBe(false);
		expect(isSameDataGridTableColumnScrollRequest({ ...column }, column)).toBe(true);
		expect(isSameDataGridTableColumnScrollRequest({ ...column, columnIndex: 1 }, column)).toBe(false);
		const row: DataGridTableVirtualScrollRequest = {
			align: "auto",
			behavior: "auto",
			containerElement,
			headerSticky: false,
			isVirtualizationEnabled: true,
			rowId: "p-1",
			rowIndex: 1,
			scrollElement,
		};
		expect(isSameDataGridTableScrollRequest(null, row)).toBe(false);
		expect(isSameDataGridTableScrollRequest({ ...row }, row)).toBe(true);
		expect(isSameDataGridTableScrollRequest({ ...row, headerSticky: true }, row)).toBe(false);
	});

	it("getDataGridTableHeaderOffset is zero without a sticky header", (): void => {
		const containerElement = document.createElement("div");
		const scrollElement = document.createElement("div");
		expect(getDataGridTableHeaderOffset({ containerElement, headerSticky: false, scrollElement })).toBe(0);
		expect(getDataGridTableHeaderOffset({ containerElement, headerSticky: true, scrollElement })).toBe(0);
	});

	it("scrollDataGridTableToOffset prefers the virtualizer, then the element", (): void => {
		const scrollElement = document.createElement("div");
		scrollDataGridTableToOffset({ behavior: "auto", scrollElement, targetTop: 120 });
		expect(scrollElement.scrollTop).toBe(120);
	});

	it("scrollDataGridTableRowIntoView reports an unmounted row as unhandled", (): void => {
		const containerElement = document.createElement("div");
		const scrollElement = document.createElement("div");
		expect(scrollDataGridTableRowIntoView({ align: "auto", behavior: "auto", containerElement, headerSticky: false, rowIndex: 3, scrollElement })).toBe(false);
		expect(scrollDataGridTableRowIntoView({ align: "auto", behavior: "auto", containerElement: null, headerSticky: false, rowIndex: 3, scrollElement })).toBe(false);
	});

	it("scrollDataGridTableRowIntoView handles a mounted, already visible row", (): void => {
		const containerElement = document.createElement("div");
		containerElement.innerHTML = '<table data-slot="data-grid-table"><tbody><tr data-index="2"></tr></tbody></table>';
		const scrollElement = document.createElement("div");
		expect(scrollDataGridTableRowIntoView({ align: "auto", behavior: "auto", containerElement, headerSticky: false, rowIndex: 2, scrollElement })).toBe(true);
	});

	it("getDataGridTableCenterColumnWindow spans the first to the last virtual column", (): void => {
		expect(getDataGridTableCenterColumnWindow([])).toBeUndefined();
		expect(getDataGridTableCenterColumnWindow([item(2, 0, 10), item(3, 10, 10), item(5, 20, 10)])).toEqual({ start: 2, end: 5 });
	});

	it("getDataGridTableVirtualSpacers fills the space around the window", (): void => {
		expect(getDataGridTableVirtualSpacers([], 500)).toEqual({ leading: 0, trailing: 0 });
		expect(getDataGridTableVirtualSpacers([item(5, 200, 40), item(6, 240, 40)], 1000)).toEqual({ leading: 200, trailing: 720 });
	});

	it("shouldDataGridTableFetchMore triggers within the offset of the last row", (): void => {
		expect(shouldDataGridTableFetchMore([], 10, 0)).toBe(false);
		expect(shouldDataGridTableFetchMore([item(9, 0, 40)], 10, 0)).toBe(true);
		expect(shouldDataGridTableFetchMore([item(7, 0, 40)], 10, 0)).toBe(false);
		expect(shouldDataGridTableFetchMore([item(7, 0, 40)], 10, 2)).toBe(true);
		expect(shouldDataGridTableFetchMore([item(7, 0, 40)], 10, -5)).toBe(false);
	});

	it("isDataGridTableColumnVirtualizable needs a fixed layout and one ungrouped header row", (): void => {
		const groupedColumns: ColumnDef<DataGridFeatures, DataGridTestPerson>[] = [{ id: "group", header: "Group", columns: [{ accessorKey: "name", header: "Name" }] }];
		const flatLayout = DataGridTableLayoutSchema.parse({});
		const autoLayout = DataGridTableLayoutSchema.parse({ width: "auto" });
		const results: boolean[][] = [];
		render(
			<DataGridTestHarness>
				{(table) => {
					const groups = getDataGridTableMergedHeaderGroups(table);
					results.push([
						isDataGridTableColumnVirtualizable(true, flatLayout, groups),
						isDataGridTableColumnVirtualizable(false, flatLayout, groups),
						isDataGridTableColumnVirtualizable(true, autoLayout, groups),
					]);
					return null;
				}}
			</DataGridTestHarness>,
		);
		render(
			<DataGridTestHarness columns={groupedColumns}>
				{(table) => {
					results.push([isDataGridTableColumnVirtualizable(true, flatLayout, getDataGridTableMergedHeaderGroups(table))]);
					return null;
				}}
			</DataGridTestHarness>,
		);
		expect(results.at(LIST_SLOT_INDEX.first)).toEqual([true, false, false]);
		expect(results.at(-1)).toEqual([false]);
	});
});
