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
const NAME: ColumnDef<DataTableFeatures, Row> = { accessorKey: "name", header: "Name" };

/** Shared no-op for stub listeners. */
function noop(): void {
	// Nothing to do: these tests only check how the menu rows are styled.
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
	vi.unstubAllGlobals();
});

function openRowMenu(actions: Action<Row>[]): void {
	render(<DataTable data={[...ROWS]} columns={[NAME]} actions={actions} />, { wrapper: UiKitTestProviders });
	fireEvent.click(screen.getByRole("button", { name: "Open row menu" }));
}

describe("DataTable row actions menu", () => {
	it("highlights a row softly, so its icon tile and description keep their colours", async () => {
		openRowMenu([{ key: "view", label: "View", description: "Open this record", icon: <Eye className="size-4" />, onClick: noop }]);
		const item = await screen.findByRole("menuitem", { name: /view/iu });

		fireEvent.mouseMove(item);

		expect(item.getAttribute("data-highlight")).toBe("soft");
		expect(item.className).not.toContain("text-invert-foreground");
		expect(item.className).not.toContain("hover:bg-info-soft");
	});

	it("renders a destructive action as the destructive variant with a destructive icon tile", async () => {
		openRowMenu([{ key: "delete", label: "Delete", description: "Remove this record", icon: <Trash2 className="size-4" />, onClick: noop, isDestructive: true }]);
		const item = await screen.findByRole("menuitem", { name: /delete/iu });

		expect(item.getAttribute("data-variant")).toBe("destructive");
		expect(item.querySelector(".bg-destructive-soft")).not.toBeNull();
	});
});
