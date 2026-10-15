// @vitest-environment jsdom
import type { ColumnDef } from "@tanstack/react-table";
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UiKitTestProviders } from "../testing/ui-kit-test-providers";
import { DataTable, type DataTableFeatures, type Filter } from "./data-table";

interface Row {
	readonly id: string;
	readonly name: string;
}

const ROWS: readonly Row[] = [
	{ id: "r-1", name: "Jane" },
	{ id: "r-2", name: "Bob" },
];
const NAME: ColumnDef<DataTableFeatures, Row> = { accessorKey: "name", header: "Name" };
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
		render(<DataTable data={[...ROWS]} columns={[NAME]} filters={FILTERS} />, { wrapper: UiKitTestProviders });

		expect(screen.getByRole("combobox", { name: "Source" }).textContent).toContain("Source:");
		expect(screen.getByRole("combobox", { name: "Outcome" }).textContent).toContain("Outcome:");
	});

	it("counts the rows on a client-side table, which holds them all", () => {
		render(<DataTable data={[...ROWS]} columns={[NAME]} filters={FILTERS} />, { wrapper: UiKitTestProviders });

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
});
