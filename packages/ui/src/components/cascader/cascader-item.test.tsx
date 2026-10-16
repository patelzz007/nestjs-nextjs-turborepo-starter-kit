// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UiKitTestProviders } from "../../testing/ui-kit-test-providers";
import { Cascader, CascaderContent, CascaderList, CascaderPanel } from "./cascader";
import type { CascaderItemState } from "./cascader-context";
import { cascaderItemVariants, CascaderGroup, CascaderItem, CascaderItems, CascaderLabel, CascaderSeparator, getCascaderMoreProps } from "./cascader-item";
import { createCascaderMoreNode } from "./cascader-lib";
import { CascaderInput } from "./cascader-nav";
import { openPicker, optionNames, pressKey, pressRow, PRODUCE, type Produce, ProducePicker, stubCascaderResizeObserver } from "@workspace/ui/testing/cascader-test-fixtures";
import type { CascaderNode } from "./cascader-types";

beforeEach((): void => {
	stubCascaderResizeObserver();
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("CascaderItem rows", (): void => {
	it("names a branch's count and that it opens another list", (): void => {
		render(<ProducePicker items={PRODUCE} />, { wrapper: UiKitTestProviders });
		openPicker();
		const fruit = screen.getByRole("option", { name: /Fruit/ });
		expect(fruit.getAttribute("aria-haspopup")).toBe("listbox");
		expect(fruit.textContent).toContain("2 items");
		expect(fruit.textContent).toContain("submenu");
		expect(fruit.getAttribute("aria-setsize")).toBe("3");
		expect(fruit.getAttribute("aria-posinset")).toBe("1");
	});

	it("marks the selected leaf and partially selected branches", (): void => {
		render(<ProducePicker items={PRODUCE} multiple cascade selectable="any" value={["kale"]} revealSelected={false} />, { wrapper: UiKitTestProviders });
		openPicker();
		const veg = screen.getByRole("option", { name: /Vegetables/ });
		expect(veg.getAttribute("aria-checked")).toBe("mixed");
		expect(veg.querySelector("[data-selected-count]")?.textContent).toBe("1");
	});

	it("lets renderLabel replace the label with the typed node", (): void => {
		render(<ProducePicker items={PRODUCE} defaultPath={["fruit"]} revealSelected={false} renderLabel={renderKcal} />, { wrapper: UiKitTestProviders });
		openPicker();
		expect(screen.getByRole("option", { name: /Apple 52/ })).toBeTruthy();
	});

	it("forwards refs and merges className last", (): void => {
		const ref = React.createRef<HTMLElement>();
		render(
			<Cascader items={PRODUCE} defaultOpen>
				<CascaderContent>
					<CascaderPanel>
						<CascaderInput />
						<CascaderList>
							<CascaderItem ref={ref} node={APPLE} className="py-4" />
						</CascaderList>
					</CascaderPanel>
				</CascaderContent>
			</Cascader>,
			{ wrapper: UiKitTestProviders },
		);
		expect(ref.current?.getAttribute("role")).toBe("option");
		expect(ref.current?.className).toContain("py-4");
		expect(ref.current?.className).not.toContain("py-1.5");
	});
});

describe("tree mode", (): void => {
	it("expands and collapses in place with the level keys", (): void => {
		const onExpandedChange = vi.fn();
		render(<ProducePicker items={PRODUCE} mode="tree" onExpandedChange={onExpandedChange} />, { wrapper: UiKitTestProviders });
		openPicker();
		expect(screen.getByRole("tree")).toBeTruthy();
		const fruit = screen.getByRole("treeitem", { name: /Fruit/ });
		expect(fruit.getAttribute("aria-expanded")).toBe("false");
		expect(fruit.getAttribute("aria-level")).toBe("1");

		pressKey("ArrowDown");
		pressKey("ArrowRight");
		expect(onExpandedChange).toHaveBeenLastCalledWith(["fruit"]);
		expect(screen.getAllByRole("treeitem")).toHaveLength(5);
		expect(screen.getByRole("treeitem", { name: /Apple/ }).getAttribute("aria-level")).toBe("2");

		pressKey("ArrowLeft");
		expect(onExpandedChange).toHaveBeenLastCalledWith([]);
	});

	it("keeps the ancestors of every hit while a query filters the tree", (): void => {
		render(<ProducePicker items={PRODUCE} mode="tree" defaultInputValue="kale" defaultOpen />, { wrapper: UiKitTestProviders });
		expect(screen.getAllByRole("treeitem").map((row: HTMLElement): string => row.getAttribute("data-depth") ?? "")).toEqual(["0", "1", "2"]);
	});
});

describe("CascaderGroup, CascaderLabel and CascaderSeparator", (): void => {
	it("names a run of rows and draws a decorative rule", (): void => {
		const groupRef = React.createRef<HTMLDivElement>();
		const separatorRef = React.createRef<HTMLDivElement>();
		render(
			<Cascader items={PRODUCE} defaultOpen>
				<CascaderContent>
					<CascaderPanel>
						<CascaderInput />
						<CascaderList>
							<CascaderGroup ref={groupRef} className="custom-group">
								<CascaderLabel>Popular</CascaderLabel>
								<CascaderItems />
							</CascaderGroup>
							<CascaderSeparator ref={separatorRef} />
						</CascaderList>
					</CascaderPanel>
				</CascaderContent>
			</Cascader>,
			{ wrapper: UiKitTestProviders },
		);
		expect(screen.getByRole("group", { name: "Popular" })).toBe(groupRef.current);
		expect(groupRef.current?.className).toContain("custom-group");
		expect(separatorRef.current?.getAttribute("aria-hidden")).toBe("true");
	});

	it("renders a plain heading outside a group", (): void => {
		render(<ProducePicker items={PRODUCE} defaultOpen panelChildren={<CascaderLabel className="custom-label">Loose</CascaderLabel>} />, { wrapper: UiKitTestProviders });
		expect(screen.getByText("Loose").className).toContain("custom-label");
	});
});

describe("getCascaderMoreProps and variants", (): void => {
	it("reports a paging row's level and a branch's own children", (): void => {
		const states = new Map([
			["veg", { loading: true, error: false, hasMore: true }],
			["fruit", { loading: false, error: true, hasMore: false }],
		]);
		expect(getCascaderMoreProps(createCascaderMoreNode("veg"), states)).toEqual({ loading: true, error: false, childrenLoading: false, childrenError: false });
		expect(getCascaderMoreProps({ value: "fruit", label: "Fruit" }, states)).toEqual({ loading: false, error: false, childrenLoading: false, childrenError: true });
	});

	it("resolves a disabled row ahead of every other state", (): void => {
		expect(cascaderItemVariants({ state: "disabled" })).toContain("opacity-50");
		expect(cascaderItemVariants({ variant: "more", state: "error" })).toContain("text-destructive");
	});

	it("commits a committable branch from the row, and drills from its chevron", (): void => {
		const onValueChange = vi.fn();
		render(<ProducePicker items={PRODUCE} selectable="any" closeOnSelect={false} onValueChange={onValueChange} />, { wrapper: UiKitTestProviders });
		openPicker();
		const chevron = screen.getByRole("option", { name: /Vegetables/ }).querySelector('[data-slot="cascader-item-chevron"]');
		if (chevron === null) {
			throw new Error("chevron not rendered");
		}
		act((): void => {
			fireEvent.click(chevron);
		});
		expect(onValueChange).not.toHaveBeenCalled();
		expect(optionNames()).toEqual(["Carrot", "Leafy"]);

		pressRow(/Leafy/);
		expect(onValueChange).toHaveBeenCalledWith("leafy", expect.objectContaining({ reason: "select" }));
	});
});

const APPLE: CascaderNode<Produce> = { value: "apple", label: "Apple" };

function renderKcal(node: CascaderNode<Produce>, state: CascaderItemState<CascaderNode<Produce>>): React.ReactNode {
	return <span>{`${node.label} ${String(node.data?.kcal ?? 0)}${state.selected ? " ✓" : ""}`}</span>;
}
