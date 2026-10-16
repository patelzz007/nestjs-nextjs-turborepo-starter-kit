// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UiKitTestProviders } from "../../testing/ui-kit-test-providers";
import { CascaderList } from "./cascader";
import { CascaderColumns } from "./cascader-columns";
import type { CascaderColumn } from "./cascader-context";
import { type Produce, ProducePicker, stubCascaderResizeObserver } from "@workspace/ui/testing/cascader-test-fixtures";
import type { CascaderNode } from "./cascader-types";
import { CascaderVirtualColumn, CascaderVirtualItems } from "./cascader-virtual";

/** Rows in the long level: far more than one viewport holds. */
const ROW_COUNT = 500;
/** The viewport height jsdom reports, in pixels. */
const VIEWPORT_PX = 320;

const MANY: readonly CascaderNode<Produce>[] = Array.from({ length: ROW_COUNT }, (_unused: undefined, position: number): CascaderNode<Produce> => ({
	value: `item-${String(position)}`,
	label: `Item ${String(position)}`,
}));

beforeEach((): void => {
	stubCascaderResizeObserver();
	// jsdom lays nothing out: give every element the viewport's height, so the virtualizer has a window to fill.
	vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(VIEWPORT_PX);
	vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(VIEWPORT_PX);
});

afterEach((): void => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

const VIRTUAL_LIST = (
	<CascaderList>
		<CascaderVirtualItems />
	</CascaderList>
);

function renderVirtualColumn(column: CascaderColumn): React.ReactNode {
	return <CascaderVirtualColumn column={column} />;
}

const VIRTUAL_COLUMNS = <CascaderColumns>{renderVirtualColumn}</CascaderColumns>;

describe("CascaderVirtualItems", (): void => {
	it("windows a long level: a fraction of the rows mount, each with its explicit position", (): void => {
		render(<ProducePicker items={MANY} defaultOpen panelChildren={VIRTUAL_LIST} />, { wrapper: UiKitTestProviders });
		const rows = screen.getAllByRole("option");
		expect(rows.length).toBeGreaterThan(0);
		expect(rows.length).toBeLessThan(ROW_COUNT);
		expect(screen.getByRole("listbox").getAttribute("data-virtualized")).toBe("");
		const [first] = rows;
		expect(first?.getAttribute("aria-setsize")).toBe(String(ROW_COUNT));
		expect(first?.getAttribute("data-index")).toBe("0");
		expect(document.querySelector('[data-slot="cascader-virtual-spacer"]')).toBeTruthy();
	});

	it("renders every row below the threshold", (): void => {
		render(<ProducePicker items={MANY.slice(0, 5)} defaultOpen panelChildren={VIRTUAL_LIST} />, { wrapper: UiKitTestProviders });
		expect(screen.getAllByRole("option")).toHaveLength(5);
		expect(screen.getByRole("listbox").hasAttribute("data-virtualized")).toBe(false);
	});
});

describe("CascaderVirtualColumn", (): void => {
	it("windows the active Miller column", (): void => {
		render(<ProducePicker items={MANY} mode="columns" defaultOpen panelChildren={VIRTUAL_COLUMNS} />, { wrapper: UiKitTestProviders });
		const rows = screen.getAllByRole("option");
		expect(rows.length).toBeGreaterThan(0);
		expect(rows.length).toBeLessThan(ROW_COUNT);
	});
});
