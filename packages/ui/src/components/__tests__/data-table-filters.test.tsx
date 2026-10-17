// @vitest-environment jsdom
import type { ColumnDef } from "@tanstack/react-table";
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UiKitTestProviders } from "../../testing/ui-kit-test-providers";
import { DataTable, type DataTableFeatures, type Filter } from "../data-table";

interface Row {
	readonly id: string;
	readonly name: string;
	readonly kind: string;
	readonly outcome: string;
}

const ROWS: readonly Row[] = [
	{ id: "r-1", name: "Jane", kind: "REQUEST", outcome: "SUCCESS" },
	{ id: "r-2", name: "Bob", kind: "REQUEST", outcome: "SUCCESS" },
];
const NAME: ColumnDef<DataTableFeatures, Row> = { accessorKey: "name", header: "Name" };
/** The columns the client-side filters filter: a client filter's key is a column id. */
const KIND: ColumnDef<DataTableFeatures, Row> = { accessorKey: "kind", header: "Source" };
const OUTCOME: ColumnDef<DataTableFeatures, Row> = { accessorKey: "outcome", header: "Outcome" };
const CLIENT_COLUMNS: ColumnDef<DataTableFeatures, Row>[] = [NAME, KIND, OUTCOME];
/** Shared no-op for stub listeners and the row action. */
function noop(): void {
	// Nothing to do: these tests only read what the filter dropdowns show.
}

/** jsdom has no ResizeObserver; the table observes its scroller with one. */
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

beforeEach((): void => {
	vi.stubGlobal("ResizeObserver", ResizeObserverStub);
	// jsdom has no matchMedia; the table reads the desktop media query through it (desktop: the real table renders).
	vi.stubGlobal("matchMedia", (query: string): Pick<MediaQueryList, "matches" | "media" | "addEventListener" | "removeEventListener"> => ({
		matches: true,
		media: query,
		addEventListener: noop,
		removeEventListener: noop,
	}));
});

afterEach((): void => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

const FILTERS: Filter[] = [
	{ key: "kind", label: "Source", options: [{ value: "REQUEST", label: "Request" }] },
	{ key: "outcome", label: "Outcome", options: [{ value: "SUCCESS", label: "Success" }] },
];

function getRowId(row: Row): string {
	return row.id;
}

describe("DataTable column filters", () => {
	it('names each filter in front of its choice, so a row of dropdowns never reads as identical "All"s', () => {
		render(<DataTable data={[...ROWS]} columns={CLIENT_COLUMNS} filters={FILTERS} />, { wrapper: UiKitTestProviders });

		expect(screen.getByRole("combobox", { name: "Source" }).textContent).toContain("Source:");
		expect(screen.getByRole("combobox", { name: "Outcome" }).textContent).toContain("Outcome:");
	});

	it("lays the filters out in one strip that scrolls sideways when they outgrow the toolbar, instead of being clipped", () => {
		render(<DataTable data={[...ROWS]} columns={CLIENT_COLUMNS} filters={FILTERS} />, { wrapper: UiKitTestProviders });

		const strip = screen.getByRole("combobox", { name: "Source" }).closest<HTMLElement>('[data-slot="data-table-filters"]');
		expect(strip).not.toBeNull();
		expect(strip?.contains(screen.getByRole("combobox", { name: "Outcome" }))).toBe(true);
		// Scrolls, may shrink below its content, and never squashes the selects themselves.
		expect(strip?.className).toContain("sm:overflow-x-auto");
		expect(strip?.className).toContain("sm:min-w-0");
		expect(strip?.className).toContain("sm:*:shrink-0");
	});

	it("counts the rows on a client-side table, which holds them all", () => {
		render(<DataTable data={[...ROWS]} columns={CLIENT_COLUMNS} filters={FILTERS} />, { wrapper: UiKitTestProviders });

		expect(screen.getByRole("combobox", { name: "Source" }).textContent).toMatch(/^Source:All \(2\)/u);
	});

	it('shows plain "All" on a server-paged table, whose rows are one page, not every match', () => {
		render(
			<DataTable
				data={[...ROWS]}
				columns={[NAME]}
				filters={FILTERS}
				manualColumnFilters={{ kind: "all", outcome: "all" }}
				onManualColumnFilterChange={noop}
				pagination={{ mode: "server", totalCount: 120, pageIndex: 0, pageSize: 50, onPageChange: noop, getRowId }}
			/>,
			{ wrapper: UiKitTestProviders },
		);

		expect(screen.getByRole("combobox", { name: "Source" }).textContent).toMatch(/^Source:All(?! \()/u);
	});

	it("never looks a server-side filter up as a column, so TanStack never warns about a missing one", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(noop);
		// The filters are server query parameters: no column is called "kind" or "outcome".
		render(
			<DataTable
				data={[...ROWS]}
				columns={[NAME]}
				filters={FILTERS}
				manualColumnFilters={{ kind: "REQUEST", outcome: "all" }}
				onManualColumnFilterChange={noop}
				pagination={{ mode: "server", totalCount: 120, pageIndex: 0, pageSize: 50, onPageChange: noop, getRowId }}
			/>,
			{ wrapper: UiKitTestProviders },
		);

		expect(screen.getByRole("combobox", { name: "Source" }).textContent).toContain("Request");
		expect(warn.mock.calls.map((call) => String(call.at(0)))).not.toContainEqual(expect.stringContaining("does not exist"));
	});

	it("refuses a client-side filter that names no column, which could never filter a row", () => {
		vi.spyOn(console, "error").mockImplementation(noop);
		expect(() => render(<DataTable data={[...ROWS]} columns={[NAME]} filters={FILTERS} />, { wrapper: UiKitTestProviders })).toThrow(
			'DataTable: filter "kind", "outcome" names no column',
		);
	});
});
