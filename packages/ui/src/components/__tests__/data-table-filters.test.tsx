// @vitest-environment jsdom
import type { ColumnDef } from "@tanstack/react-table";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UiKitTestProviders } from "../../testing/ui-kit-test-providers";
import { DataTable, type DataTableFeatures, type Filter } from "../data-table";
import { accessibilityViolations } from "../../testing/axe";

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
	it("has no serious accessibility problems (enhancement 3.2)", async (): Promise<void> => {
		render(<DataTable data={[...ROWS]} columns={CLIENT_COLUMNS} filters={FILTERS} />, { wrapper: UiKitTestProviders });
		await expect(accessibilityViolations(document.body)).resolves.toStrictEqual([]);
	});

	it('names each filter in front of its choice, so a row of dropdowns never reads as identical "All"s', () => {
		render(<DataTable data={[...ROWS]} columns={CLIENT_COLUMNS} filters={FILTERS} />, { wrapper: UiKitTestProviders });

		expect(screen.getByRole("combobox", { name: /^Source:/u }).textContent).toContain("Source:");
		expect(screen.getByRole("combobox", { name: /^Outcome:/u }).textContent).toContain("Outcome:");
	});

	it("wraps the filters onto further lines when they outgrow the toolbar, instead of scrolling or clipping them", () => {
		render(<DataTable data={[...ROWS]} columns={CLIENT_COLUMNS} filters={FILTERS} />, { wrapper: UiKitTestProviders });

		const strip = screen.getByRole("combobox", { name: /^Source:/u }).closest<HTMLElement>('[data-slot="data-table-filters"]');
		expect(strip).not.toBeNull();
		expect(strip?.contains(screen.getByRole("combobox", { name: /^Outcome:/u }))).toBe(true);
		// Wraps in place (no sideways scroll), never squashes the selects, and is never narrower than its widest one:
		// with `min-w-0`, wide neighbours squeezed it to nothing and the selects spilled over the search.
		expect(strip?.className).toContain("sm:flex-wrap");
		expect(strip?.className).not.toContain("overflow-x-auto");
		expect(strip?.className).toContain("sm:flex-1");
		expect(strip?.className).toContain("sm:min-w-min");
		expect(strip?.className).not.toContain("min-w-0");
		expect(strip?.className).toContain("sm:*:shrink-0");
		// One row with the search and buttons, which stay on its first line while the filters wrap.
		const toolbar = strip?.closest('[data-slot="data-table-toolbar"]');
		expect(toolbar?.className).toContain("sm:items-start");
		expect(toolbar?.className).not.toContain("sm:flex-wrap");
	});

	it("counts the rows on a client-side table, which holds them all", () => {
		render(<DataTable data={[...ROWS]} columns={CLIENT_COLUMNS} filters={FILTERS} />, { wrapper: UiKitTestProviders });

		expect(screen.getByRole("combobox", { name: /^Source:/u }).textContent).toMatch(/^Source:All \(2\)/u);
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

		expect(screen.getByRole("combobox", { name: /^Source:/u }).textContent).toMatch(/^Source:All(?! \()/u);
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

		expect(screen.getByRole("combobox", { name: /^Source:/u }).textContent).toContain("Request");
		expect(warn.mock.calls.map((call) => String(call.at(0)))).not.toContainEqual(expect.stringContaining("does not exist"));
	});

	it("refuses a client-side filter that names no column, which could never filter a row", () => {
		vi.spyOn(console, "error").mockImplementation(noop);
		expect(() => render(<DataTable data={[...ROWS]} columns={[NAME]} filters={FILTERS} />, { wrapper: UiKitTestProviders })).toThrow(
			'DataTable: filter "kind", "outcome" names no column',
		);
	});
});

describe("DataTable toolbar layout", () => {
	const FILTERS: Filter[] = [{ key: "kind", label: "Source", options: [{ value: "REQUEST", label: "Request" }] }];

	function renderTable(layout?: "inline" | "fill"): HTMLElement {
		render(
			<UiKitTestProviders>
				<DataTable columns={CLIENT_COLUMNS} data={ROWS} filters={FILTERS} searchKeys={["name"]} {...(layout === undefined ? {} : { toolbarLayout: layout })} />
			</UiKitTestProviders>,
		);
		const toolbar = document.querySelector<HTMLElement>("[data-slot=data-table-toolbar]");
		if (toolbar === null) {
			throw new Error("no toolbar");
		}
		return toolbar;
	}

	it("should keep the inline layout by default: a fixed-width search, filters sized to their labels", () => {
		const toolbar = renderTable();
		expect(toolbar.dataset.layout).toBe("inline");
		expect(toolbar.querySelector("[data-slot=data-table-filters]")?.className).toContain("sm:flex-wrap");
	});

	it("should give the search and every filter an equal column across the row in the fill layout", () => {
		// jsdom has no layout: this pins the classes that make the search and each filter equal flex columns.
		const toolbar = renderTable("fill");
		expect(toolbar.dataset.layout).toBe("fill");
		expect(toolbar.querySelector("[data-slot=data-table-filters]")?.className).toContain("sm:contents");
		expect(toolbar.className).toContain("sm:grid");
		// One column for the search and one per filter, all equal.
		expect(toolbar.style.gridTemplateColumns).toBe("repeat(2, minmax(0, 1fr))");
		const filter = within(toolbar).getByRole("combobox");
		expect(filter.className).toContain("sm:min-w-0");
		expect(filter.className).not.toContain("sm:min-w-44");
	});

	it("should leave out the empty action area when the table has neither export nor column toggles", () => {
		const toolbar = renderTable("fill");
		expect(toolbar.querySelector(".sm\\:ml-auto")).toBeNull();
	});
});

describe("DataTable filter option icons", () => {
	function openSourceFilter(filters: Filter[]): HTMLElement[] {
		render(<DataTable data={[...ROWS]} columns={CLIENT_COLUMNS} filters={filters} />, { wrapper: UiKitTestProviders });
		fireEvent.click(screen.getByRole("combobox", { name: /^Source:/u }));
		return screen.getAllByRole("option", { hidden: true });
	}

	it("should show each option's icon before its label, and give All one so the labels line up", () => {
		const options = openSourceFilter([{ key: "kind", label: "Source", options: [{ value: "REQUEST", label: "Request", icon: <svg data-testid="request-icon" /> }] }]);
		const [all, request] = options;
		expect(request?.textContent).toBe("Request (2)");
		expect(request?.querySelector("[data-slot=filter-option-icon] [data-testid=request-icon]")).not.toBeNull();
		expect(request?.querySelector("[data-slot=filter-option-icon]")?.getAttribute("aria-hidden")).toBe("true");
		expect(all?.querySelector("[data-slot=filter-option-icon] svg")).not.toBeNull();
	});

	it("should leave a filter without icons as plain labels", () => {
		const options = openSourceFilter(FILTERS);
		expect(options.map((option) => option.textContent)).toEqual(["All (2)", "Request (2)"]);
		expect(document.querySelector("[data-slot=filter-option-icon]")).toBeNull();
	});
});
