// @vitest-environment jsdom
import type { ColumnDef } from "@tanstack/react-table";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Eye, Trash2 } from "lucide-react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UiKitTestProviders } from "../../testing/ui-kit-test-providers";
import { DataTable, type Action, type DataTableFeatures } from "../data-table";

interface Row {
	readonly id: string;
	readonly name: string;
}

const ROWS: readonly Row[] = [{ id: "r-1", name: "Jane" }];
const COLUMNS: ColumnDef<DataTableFeatures, Row>[] = [{ accessorKey: "name", header: "Name" }];

/** Shared no-op for stub listeners. */
function noop(): void {
	// Nothing to do: these tests only check how the menu rows look and what they run.
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

function renderTable(actions: Action<Row>[]): void {
	render(<DataTable data={[...ROWS]} columns={COLUMNS} actions={actions} />, { wrapper: UiKitTestProviders });
	fireEvent.click(screen.getByRole("button", { name: "Open row menu" }));
}

describe("DataTable row actions", () => {
	it("highlights a row with the soft wash, keeping its icon tile and description legible", () => {
		renderTable([{ key: "view", label: "View", description: "Open this record", icon: <Eye className="size-4" />, onClick: noop }]);

		const item = screen.getByRole("menuitem", { name: /View/ });
		fireEvent.mouseMove(item);

		expect(item.getAttribute("data-highlight")).toBe("soft");
		expect(item.className).toContain("bg-foreground/8");
		expect(item.className).not.toContain("bg-invert");
		expect(item.className).not.toContain("hover:bg-info-soft");
	});

	it("washes a destructive row in the destructive colour", () => {
		renderTable([{ key: "delete", label: "Delete", description: "Remove this record", icon: <Trash2 className="size-4" />, onClick: noop, isDestructive: true }]);

		const item = screen.getByRole("menuitem", { name: /Delete/ });
		fireEvent.mouseMove(item);

		expect(item.getAttribute("data-variant")).toBe("destructive");
		expect(item.className).toContain("bg-destructive/10");
	});

	it("runs the chosen action with the row", () => {
		const onView = vi.fn<(row: Row) => void>();
		renderTable([{ key: "view", label: "View", icon: <Eye className="size-4" />, onClick: onView }]);

		fireEvent.click(screen.getByRole("menuitem", { name: /View/ }));

		expect(onView).toHaveBeenCalledWith({ id: "r-1", name: "Jane" });
	});
});
