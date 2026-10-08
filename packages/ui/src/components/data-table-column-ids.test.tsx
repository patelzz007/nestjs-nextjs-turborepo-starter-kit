// @vitest-environment jsdom
import type { ColumnDef } from "@tanstack/react-table";
import { cleanup, render } from "@testing-library/react";
import { Eye } from "lucide-react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UiKitTestProviders } from "../testing/ui-kit-test-providers";
import { DataTable, type Action, type DataTableFeatures } from "./data-table";

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
	// Nothing to do: these tests only check which columns render.
}

const ROW_ACTIONS: Action<Row>[] = [{ key: "view", label: "View", icon: <Eye className="size-4" />, onClick: noop }];

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
	// React reports the render error itself; keep the expected throws out of the test output.
	vi.spyOn(console, "error").mockImplementation(noop);
});

afterEach((): void => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

function renderTable(columns: ColumnDef<DataTableFeatures, Row>[], actions: Action<Row>[] = []): void {
	render(<DataTable data={[...ROWS]} columns={columns} actions={actions} />, { wrapper: UiKitTestProviders });
}

describe("DataTable column ids", () => {
	it("refuses a caller column named after the row-actions column when `actions` is passed", () => {
		expect(() => {
			renderTable([NAME, { id: "actions", header: "", cell: (): string => "View user" }], ROW_ACTIONS);
		}).toThrow('"actions" is reserved for the row-actions menu column (`actions`)');
	});

	it("refuses two caller columns with the same id", () => {
		expect(() => {
			renderTable([NAME, { id: "name", header: "Name again" }]);
		}).toThrow('"name" is used by more than one column');
	});

	it("renders unique columns, with its own actions column, without complaint", () => {
		expect(() => {
			renderTable([NAME], ROW_ACTIONS);
		}).not.toThrow();
	});
});
