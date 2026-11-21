// @vitest-environment jsdom
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatDateRangeSummary } from "../../internal/data-table/filter-date-range";
import { readFilteredColumns } from "../../internal/data-table/use-table-state";
import { UiKitTestProviders } from "../../testing/ui-kit-test-providers";
import {
	DataTable,
	createDataTableQuery,
	type DataTableColumns,
	type DataTableFilter,
	type DataTableProps,
	type DataTableQuery,
	type DataTableQueryChange,
} from "../data-table";

interface Shipment {
	readonly id: string;
	readonly destination: string;
	/** Epoch milliseconds. */
	readonly shippedAt: number;
}

/** Noon, so the day is the same in every time zone the tests may run in. */
function noonOn(dayOfNovember: number): number {
	return new Date(2026, 10, dayOfNovember, 12).getTime();
}

const SHIPMENTS: readonly Shipment[] = [
	{ id: "s-1", destination: "Ipoh", shippedAt: noonOn(8) },
	{ id: "s-2", destination: "Johor", shippedAt: noonOn(10) },
	{ id: "s-3", destination: "Kuching", shippedAt: noonOn(12) },
	{ id: "s-4", destination: "Melaka", shippedAt: noonOn(20) },
];

const COLUMNS: DataTableColumns<Shipment> = [
	{ accessorKey: "destination", header: "Destination" },
	{ accessorKey: "shippedAt", header: "Shipped" },
];

/** Named differently from the column header, so the two buttons are told apart by name. */
const SHIPPED_FILTER: DataTableFilter = { kind: "date-range", column: "shippedAt", label: "Ship date" };
const FILTERS: readonly DataTableFilter[] = [SHIPPED_FILTER];

function getRowId(shipment: Shipment): string {
	return shipment.id;
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
	vi.stubGlobal("matchMedia", (query: string): Pick<MediaQueryList, "matches" | "media" | "addEventListener" | "removeEventListener"> => ({
		// A desktop screen: every query matches except `print`.
		matches: query !== "print",
		media: query,
		addEventListener: noop,
		removeEventListener: noop,
	}));
	Object.defineProperty(HTMLElement.prototype, "getAnimations", { configurable: true, value: noAnimations });
	// Only the clock is faked: the calendar opens on "today's" month, and timers stay real for the popover.
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(new Date(2026, 10, 15, 9));
});

afterEach((): void => {
	cleanup();
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	Reflect.deleteProperty(HTMLElement.prototype, "getAnimations");
});

function renderTable(overrides: Partial<DataTableProps<Shipment>> = {}): void {
	render(<DataTable data={SHIPMENTS} columns={COLUMNS} getRowId={getRowId} filters={FILTERS} {...overrides} />, { wrapper: UiKitTestProviders });
}

function shownDestinations(): string[] {
	return screen
		.getAllByRole("row")
		.map((row) => within(row).queryAllByRole("cell").at(LIST_SLOT_INDEX.first)?.textContent ?? "")
		.filter((text) => text !== "");
}

function filterTrigger(): HTMLElement {
	return screen.getByRole("button", { name: /^Ship date/u });
}

async function openCalendar(): Promise<void> {
	fireEvent.click(filterTrigger());
	await waitFor((): void => {
		expect(document.querySelector("[data-day]")).not.toBeNull();
	});
}

/** The popover's own clear button: it removes this filter's range only. */
function clickClearRange(): void {
	fireEvent.click(screen.getByRole("button", { name: "Clear dates" }));
}

function clickDay(day: string): void {
	// The day's cell carries the same attribute, so the button is asked for by tag.
	const button = document.querySelector<HTMLElement>(`button[data-day="${day}"]`);
	if (button === null) {
		throw new Error(`the calendar shows ${day}`);
	}
	fireEvent.click(button);
}

describe("DataTable: date-range filter", () => {
	it("shows every row and only the filter's name until a range is picked", () => {
		renderTable();
		expect(shownDestinations()).toEqual(["Ipoh", "Johor", "Kuching", "Melaka"]);
		expect(filterTrigger().textContent).toBe("Ship date");
	});

	it("keeps the rows whose day is inside the picked range, both ends included", async (): Promise<void> => {
		renderTable();
		await openCalendar();

		clickDay("2026-11-10");
		clickDay("2026-11-12");

		expect(shownDestinations()).toEqual(["Johor", "Kuching"]);
		expect(filterTrigger().textContent).toContain("Nov 10, 2026 – Nov 12, 2026");
	});

	it("clears the range from the popover", async (): Promise<void> => {
		renderTable();
		await openCalendar();
		clickDay("2026-11-10");
		clickDay("2026-11-12");

		clickClearRange();

		expect(shownDestinations()).toEqual(["Ipoh", "Johor", "Kuching", "Melaka"]);
		expect(filterTrigger().textContent).toBe("Ship date");
	});

	it("counts as a filter: nothing in range reads as no results, and clearing the filters brings the rows back", async (): Promise<void> => {
		renderTable();
		await openCalendar();
		clickDay("2026-11-01");
		clickDay("2026-11-02");
		expect(screen.getByText("No results found")).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

		expect(shownDestinations()).toHaveLength(SHIPMENTS.length);
	});

	it("reads its value from the query on a server table and reports a new range as a filter change", async (): Promise<void> => {
		const onQueryChange = vi.fn<(query: DataTableQuery, change: DataTableQueryChange) => void>();
		const query: DataTableQuery = { ...createDataTableQuery(10), filters: { shippedAt: { from: "2026-11-10", to: null } } };
		renderTable({ source: { mode: "server", totalCount: SHIPMENTS.length, query, onQueryChange } });
		expect(filterTrigger().textContent).toContain("Nov 10, 2026 – …");

		await openCalendar();
		clickDay("2026-11-12");

		expect(onQueryChange).toHaveBeenCalledWith(expect.objectContaining({ pageIndex: 0, filters: { shippedAt: { from: "2026-11-10", to: "2026-11-12" } } }), {
			kind: "filter",
			column: "shippedAt",
			value: { from: "2026-11-10", to: "2026-11-12" },
		});
	});

	it("removes the filter from the query when the range is cleared on a server table", async (): Promise<void> => {
		const onQueryChange = vi.fn<(query: DataTableQuery, change: DataTableQueryChange) => void>();
		const query: DataTableQuery = { ...createDataTableQuery(10), filters: { shippedAt: { from: "2026-11-10", to: "2026-11-12" } } };
		renderTable({ source: { mode: "server", totalCount: SHIPMENTS.length, query, onQueryChange } });
		await openCalendar();

		clickClearRange();

		expect(onQueryChange).toHaveBeenCalledWith(expect.objectContaining({ filters: {} }), { kind: "filter", column: "shippedAt", value: null });
	});
});

describe("date-range filter helpers", () => {
	it("writes a range as two days, with an open end as an ellipsis", () => {
		expect(formatDateRangeSummary({ from: "2026-11-01", to: "2026-11-19" })).toBe("Nov 1, 2026 – Nov 19, 2026");
		expect(formatDateRangeSummary({ from: null, to: "2026-11-19" })).toBe("… – Nov 19, 2026");
		expect(formatDateRangeSummary({ from: "not a day", to: null })).toBe("… – …");
	});

	it("gives a filter function to multi-select and date-range columns, by the zone asked for", () => {
		const filtered = readFilteredColumns([
			{ kind: "select", column: "status", label: "Status", options: [] },
			{ kind: "multi-select", column: "type", label: "Type", options: [] },
			{ kind: "date-range", column: "shippedAt", label: "Shipped" },
			{ kind: "date-range", column: "dueOn", label: "Due", zone: "utc" },
		]);
		expect([...filtered]).toEqual([
			["type", "multi-select"],
			["shippedAt", "date-range-local"],
			["dueOn", "date-range-utc"],
		]);
	});
});
