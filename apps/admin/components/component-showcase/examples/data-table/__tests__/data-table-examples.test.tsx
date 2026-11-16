// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DataTable11Example } from "@/components/component-showcase/examples/data-table/data-table-11";
import { DataTable12Example } from "@/components/component-showcase/examples/data-table/data-table-12";
import { answerSectionsQuery, DataTable13Example } from "@/components/component-showcase/examples/data-table/data-table-13";
import { DataTable2Example } from "@/components/component-showcase/examples/data-table/data-table-2";
import { DataTable4Example } from "@/components/component-showcase/examples/data-table/data-table-4";
import { reorderSections } from "@/components/component-showcase/examples/data-table/data-table-7";
import { DOCUMENT_SECTIONS, type DocumentSection } from "@/components/component-showcase/examples/data-table/data-table-sample";
import { UI_KIT_LABELS_EN } from "@workspace/ui/lib/labels/en";
import { installJsdomUiShims } from "@/testing/jsdom-ui-shims";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";

/** Longer than the examples' search debounce and the pretend server's latency. */
const SETTLE_MS = 1000;

function section(id: number): DocumentSection {
	const found = DOCUMENT_SECTIONS.find((row) => row.id === id);
	if (found === undefined) {
		throw new Error(`section ${String(id)} is in the sample`);
	}
	return found;
}

describe("DataTable example helpers", () => {
	it("moves the row shown at one position to where another shown row sits, by id", () => {
		const rows = [section(1), section(2), section(3), section(4)];
		expect(reorderSections(rows, rows, 0, 2).map(({ id }) => id)).toEqual([2, 3, 1, 4]);
		// A filtered view: the visible rows are a subset, in their own order.
		expect(reorderSections(rows, [section(4), section(2)], 0, 1).map(({ id }) => id)).toEqual([1, 4, 2, 3]);
		expect(reorderSections(rows, [], 0, 1)).toBe(rows);
	});

	it("answers a query like a server: filter, sort, then one page with the matching total", () => {
		const done = answerSectionsQuery({ pageIndex: 0, pageSize: 3, sorting: [{ id: "target", desc: true }], status: "Done" });
		expect(done.totalCount).toBe(DOCUMENT_SECTIONS.filter((row) => row.status === "Done").length);
		expect(done.rows.map(({ target }) => Number(target))).toEqual([30, 29, 27]);
		const second = answerSectionsQuery({ pageIndex: 1, pageSize: 5, sorting: [], status: null });
		expect(second.rows.map(({ id }) => id)).toEqual([6, 7, 8, 9, 10]);
		expect(answerSectionsQuery({ pageIndex: 0, pageSize: 5, sorting: [{ id: "unknown", desc: false }], status: null }).rows.at(0)?.id).toBe(1);
	});
});

describe("DataTable examples", () => {
	installJsdomUiShims();

	afterEach((): void => {
		vi.useRealTimers();
	});

	it("searches across the section and reviewer columns", () => {
		vi.useFakeTimers();
		render(<DataTable2Example />, { wrapper: UiKitTestProviders });
		fireEvent.change(screen.getByPlaceholderText(UI_KIT_LABELS_EN.dataTable.searchPlaceholder), { target: { value: "Maya" } });
		act((): void => {
			vi.advanceTimersByTime(SETTLE_MS);
		});
		expect(screen.getAllByText("System architecture").length).toBeGreaterThan(0);
		expect(screen.queryAllByText("Cover page")).toHaveLength(0);
	});

	it("marks the selected sections as done in bulk", () => {
		render(<DataTable4Example />, { wrapper: UiKitTestProviders });
		const table = screen.getAllByRole("table").at(0);
		if (table === undefined) {
			throw new Error("the example renders a table");
		}
		const designRow = within(table).getByText("Design").closest("tr");
		const checkbox = designRow === null ? null : within(designRow).getByRole("checkbox");
		if (checkbox === null) {
			throw new Error("each row has a checkbox");
		}
		fireEvent.click(checkbox);
		fireEvent.click(screen.getByRole("button", { name: /Mark as done/u }));
		expect(within(table).getByText("Design").closest("tr")?.textContent).toContain("Done");
	});

	it("switches between loading, empty and error states", () => {
		render(<DataTable11Example />, { wrapper: UiKitTestProviders });
		fireEvent.click(screen.getByRole("tab", { name: "Error" }));
		expect(screen.getByText("The sections could not be loaded. Try again in a moment.")).toBeTruthy();
		fireEvent.click(screen.getByRole("tab", { name: "Empty" }));
		expect(screen.getByText("No sections yet")).toBeTruthy();
	});

	it("draws only the rows in view of two thousand", () => {
		render(<DataTable12Example />, { wrapper: UiKitTestProviders });
		expect(screen.getAllByRole("row").length).toBeLessThan(200);
	});

	it("fetches the next page from the pretend server when the reader pages on", () => {
		vi.useFakeTimers();
		render(<DataTable13Example />, { wrapper: UiKitTestProviders });
		act((): void => {
			vi.advanceTimersByTime(SETTLE_MS);
		});
		expect(screen.getAllByText("Cover page").length).toBeGreaterThan(0);
		fireEvent.click(screen.getAllByRole("button", { name: /next page/iu }).at(0) ?? document.body);
		act((): void => {
			vi.advanceTimersByTime(SETTLE_MS);
		});
		expect(screen.getAllByText("Capabilities").length).toBeGreaterThan(0);
		expect(screen.queryAllByText("Cover page")).toHaveLength(0);
	});
});
