// @vitest-environment jsdom
import type { DataGridTableInstance } from "@workspace/ui/components/data-grid/data-grid";
import type { DataGridLabelsOverride } from "@workspace/ui/components/data-grid/data-grid-i18n";
import {
	DataGridPagination,
	formatDataGridPaginationInfo,
	getDataGridPaginationItems,
	type DataGridPaginationItem,
	type DataGridPaginationProps,
} from "@workspace/ui/components/data-grid/data-grid-pagination";
import { DataGridResizeObserverStub, DataGridTestHarness, type DataGridTestPerson } from "@workspace/ui/testing/data-grid-test-harness";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

const PEOPLE: readonly DataGridTestPerson[] = Array.from({ length: 23 }, (_, index) => ({
	id: `p-${String(index)}`,
	name: `Person ${String(index)}`,
	email: `person${String(index)}@example.com`,
	age: 20 + index,
	role: "Engineer",
}));

const PAGE_OF_TWO = { initialState: { pagination: { pageIndex: 0, pageSize: 2 } } };
const PAGE_OF_FIVE = { initialState: { pagination: { pageIndex: 0, pageSize: 5 } } };
const PAGINATION_LABELS: DataGridLabelsOverride = { rowsPerPage: "Rijen per pagina", goToPage: (page: number): string => `Pagina ${String(page)}` };

interface RenderOptions {
	readonly paginationProps?: DataGridPaginationProps;
	readonly labels?: DataGridLabelsOverride;
	readonly isLoading?: boolean;
	readonly pageSize?: "two" | "five";
	readonly paginationRef?: React.Ref<HTMLDivElement>;
}

function renderPagination({ paginationProps = {}, labels, isLoading = false, pageSize = "five", paginationRef }: RenderOptions = {}): {
	readonly current: () => DataGridTableInstance<DataGridTestPerson>;
} {
	const tables: DataGridTableInstance<DataGridTestPerson>[] = [];
	render(
		<DataGridTestHarness data={PEOPLE} tableOptions={pageSize === "two" ? PAGE_OF_TWO : PAGE_OF_FIVE} isLoading={isLoading} {...(labels === undefined ? {} : { labels })}>
			{(table) => {
				tables.push(table);
				return <DataGridPagination {...paginationProps} {...(paginationRef === undefined ? {} : { ref: paginationRef })} />;
			}}
		</DataGridTestHarness>,
	);
	return {
		current: (): DataGridTableInstance<DataGridTestPerson> => {
			const latest = tables.at(-1);
			if (latest === undefined) {
				throw new Error("no table");
			}
			return latest;
		},
	};
}

function describeItems(items: readonly DataGridPaginationItem[]): string[] {
	return items.map((item) => (item.type === "page" ? String(item.index + 1) : `…${String(item.target + 1)}`));
}

describe("getDataGridPaginationItems", () => {
	it("shows every page when they fit", (): void => {
		expect(describeItems(getDataGridPaginationItems(0, 7, 5))).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
	});

	it("collapses the tail, the head, or both around the current page", (): void => {
		expect(describeItems(getDataGridPaginationItems(0, 20, 5))).toEqual(["1", "2", "3", "4", "5", "…6", "20"]);
		expect(describeItems(getDataGridPaginationItems(19, 20, 5))).toEqual(["1", "…15", "16", "17", "18", "19", "20"]);
		expect(describeItems(getDataGridPaginationItems(9, 20, 5))).toEqual(["1", "…8", "9", "10", "11", "…12", "20"]);
	});

	it("keeps the run odd and at least three pages", (): void => {
		expect(describeItems(getDataGridPaginationItems(9, 20, 4))).toEqual(["1", "…9", "10", "…11", "20"]);
		expect(describeItems(getDataGridPaginationItems(9, 20, 1))).toEqual(["1", "…9", "10", "…11", "20"]);
	});
});

describe("formatDataGridPaginationInfo", () => {
	it("fills every placeholder", (): void => {
		expect(formatDataGridPaginationInfo("{from}-{to} / {count} ({from})", 1, 5, 23)).toBe("1-5 / 23 (1)");
	});
});

describe("DataGridPagination", () => {
	it("shows the info text and a navigation landmark of named page buttons", (): void => {
		renderPagination();
		expect(screen.getByText("1 - 5 of 23")).toBeDefined();
		const nav = screen.getByRole("navigation");
		expect(nav.getAttribute("aria-label")).not.toBe("");
		expect(screen.getByRole("button", { name: "Go to page 1" }).getAttribute("aria-current")).toBe("page");
		expect(screen.getByRole("button", { name: "Go to page 5" })).toBeDefined();
	});

	it("navigates with the arrows and page buttons, disabling the arrows at the ends", (): void => {
		const grid = renderPagination();
		expect(screen.getByRole("button", { name: "Go to previous page" }).hasAttribute("disabled")).toBe(true);
		fireEvent.click(screen.getByRole("button", { name: "Go to next page" }));
		expect(grid.current().atoms.pagination.get().pageIndex).toBe(1);
		expect(screen.getByText("6 - 10 of 23")).toBeDefined();
		fireEvent.click(screen.getByRole("button", { name: "Go to page 5" }));
		expect(grid.current().atoms.pagination.get().pageIndex).toBe(4);
		expect(screen.getByText("21 - 23 of 23")).toBeDefined();
		expect(screen.getByRole("button", { name: "Go to next page" }).hasAttribute("disabled")).toBe(true);
	});

	it("jumps over hidden pages with the ellipsis button", (): void => {
		const grid = renderPagination({ pageSize: "two" });
		const ellipsis = screen.getByRole("button", { name: "Go to page 6" });
		expect(ellipsis.textContent).toBe("…");
		fireEvent.click(ellipsis);
		expect(grid.current().atoms.pagination.get().pageIndex).toBe(5);
	});

	it("changes the page size through the rows-per-page select", (): void => {
		vi.stubGlobal("ResizeObserver", DataGridResizeObserverStub);
		const grid = renderPagination();
		act((): void => {
			fireEvent.click(screen.getByRole("combobox", { name: "Rows per page" }));
		});
		// A real mouse press: base-ui only commits a click that started on the item.
		const option = screen.getByRole("option", { name: "10" });
		act((): void => {
			fireEvent.pointerDown(option, { pointerType: "mouse" });
			fireEvent.click(option);
		});
		expect(grid.current().atoms.pagination.get().pageSize).toBe(10);
	});

	it("renders skeletons instead of controls while loading", (): void => {
		renderPagination({ isLoading: true });
		expect(screen.queryByRole("navigation")).toBeNull();
		expect(screen.queryByText("Rows per page")).toBeNull();
		expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
	});

	it("lets the labels override and the per-component props replace the copy", (): void => {
		renderPagination({ labels: PAGINATION_LABELS, paginationProps: { info: "{from} tot {to} van {count}", previousPageLabel: "Vorige" } });
		expect(screen.getByText("Rijen per pagina")).toBeDefined();
		expect(screen.getByText("1 tot 5 van 23")).toBeDefined();
		expect(screen.getByRole("button", { name: "Pagina 2" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Vorige" })).toBeDefined();
	});

	it("forwards its ref and merges className last", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		renderPagination({ paginationRef: ref, paginationProps: { className: "custom-pagination" } });
		expect(ref.current?.dataset.slot).toBe("data-grid-pagination");
		expect(ref.current?.className.endsWith("custom-pagination")).toBe(true);
	});
});
