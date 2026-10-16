// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UiKitTestProviders } from "../../testing/ui-kit-test-providers";
import { CascaderColumns, toCascaderCssLength } from "./cascader-columns";
import { openPicker, pressKey, pressRow, PRODUCE, ProducePicker, stubCascaderResizeObserver } from "@workspace/ui/testing/cascader-test-fixtures";

beforeEach((): void => {
	stubCascaderResizeObserver();
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

const COLUMNS = <CascaderColumns columnWidth={180} className="custom-columns" />;

describe("CascaderColumns", (): void => {
	it("renders one column per open level; only the deepest is a listbox", (): void => {
		render(<ProducePicker items={PRODUCE} mode="columns" panelChildren={COLUMNS} />, { wrapper: UiKitTestProviders });
		openPicker();
		const group = screen.getByRole("group", { name: "Levels" });
		expect(group.className).toContain("custom-columns");
		expect(group.style.getPropertyValue("--cascader-column-width")).toBe("180px");

		pressRow(/Vegetables/);
		const listbox = screen.getByRole("listbox", { name: "Vegetables" });
		expect(listbox.textContent).toContain("Carrot");
		// The trail behind is a named group of plain buttons, the open one pointing at the next column.
		const trailRow = screen.getByRole("button", { name: /Vegetables/ });
		expect(trailRow.getAttribute("aria-expanded")).toBe("true");
		expect(trailRow.getAttribute("aria-controls")).toBe(listbox.id);
		expect(screen.getByRole("group", { name: "Top level" })).toBeTruthy();
	});

	it("moves across columns with the level keys", (): void => {
		const onPathChange = vi.fn();
		render(<ProducePicker items={PRODUCE} mode="columns" panelChildren={COLUMNS} onPathChange={onPathChange} />, { wrapper: UiKitTestProviders });
		openPicker();
		pressKey("ArrowDown");
		pressKey("ArrowDown");
		pressKey("ArrowRight");
		expect(onPathChange).toHaveBeenLastCalledWith(["veg"], { reason: "drill" });
		pressKey("ArrowLeft");
		expect(onPathChange).toHaveBeenLastCalledWith([], { reason: "back" });
	});

	it("re-roots the trail from a pressed ancestor-column row", (): void => {
		const onPathChange = vi.fn();
		render(<ProducePicker items={PRODUCE} mode="columns" panelChildren={COLUMNS} onPathChange={onPathChange} />, { wrapper: UiKitTestProviders });
		openPicker();
		pressRow(/Vegetables/);
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: /Fruit/ }));
		});
		expect(onPathChange).toHaveBeenLastCalledWith(["fruit"], { reason: "drill" });
	});

	it("forwards its ref and renders nothing outside columns mode", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		const columns = <CascaderColumns ref={ref} />;
		const { unmount } = render(<ProducePicker items={PRODUCE} mode="columns" defaultOpen panelChildren={columns} />, { wrapper: UiKitTestProviders });
		expect(ref.current?.getAttribute("data-slot")).toBe("cascader-columns");
		unmount();
		render(<ProducePicker items={PRODUCE} defaultOpen panelChildren={columns} />, { wrapper: UiKitTestProviders });
		expect(screen.queryByRole("group", { name: "Levels" })).toBeNull();
	});
});

describe("toCascaderCssLength", (): void => {
	it("reads a number as pixels and passes a CSS length through", (): void => {
		expect(toCascaderCssLength(240)).toBe("240px");
		expect(toCascaderCssLength("20rem")).toBe("20rem");
	});
});
