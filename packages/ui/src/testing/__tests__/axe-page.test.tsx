// @vitest-environment jsdom
import type { ColumnDef } from "@tanstack/react-table";
import { cleanup, render } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DataTable, type DataTableFeatures } from "../../components/data-table";
import { desktopMediaQueryList } from "../desktop-match-media";
import { UiKitTestProviders } from "../ui-kit-test-providers";
import { BUSY_REGION_SELECTOR, hasNoBusyRegion } from "../axe-page";

interface Row {
	readonly id: string;
	readonly name: string;
}

const COLUMNS: ColumnDef<DataTableFeatures, Row>[] = [{ accessorKey: "name", header: "Name" }];
const ROWS: Row[] = [{ id: "a", name: "Ada" }];

function rowId(row: Row): string {
	return row.id;
}

beforeEach((): void => {
	// The table picks its layout from the viewport (jsdom has no matchMedia).
	vi.stubGlobal("matchMedia", desktopMediaQueryList);
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

// What the browser suites wait for before axe scans (pageAccessibilityViolations): no region still loading.
describe("hasNoBusyRegion", () => {
	it("is false while a data table loads its rows, and true once they are in", () => {
		const { rerender } = render(<DataTable columns={COLUMNS} data={[]} getRowId={rowId} status={{ loading: "initial" }} />, { wrapper: UiKitTestProviders });
		expect(hasNoBusyRegion(BUSY_REGION_SELECTOR)).toBe(false);

		rerender(<DataTable columns={COLUMNS} data={ROWS} getRowId={rowId} />);
		expect(hasNoBusyRegion(BUSY_REGION_SELECTOR)).toBe(true);
	});

	it("is false while a loaded table refreshes", () => {
		render(<DataTable columns={COLUMNS} data={ROWS} getRowId={rowId} status={{ loading: "refreshing" }} />, { wrapper: UiKitTestProviders });

		expect(hasNoBusyRegion(BUSY_REGION_SELECTOR)).toBe(false);
	});

	it("ignores a region that says it is not busy", () => {
		render(<section aria-busy="false" aria-label="Done" />);

		expect(hasNoBusyRegion(BUSY_REGION_SELECTOR)).toBe(true);
	});
});
