// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UiKitTestProviders } from "../../../testing/ui-kit-test-providers";
import { Cascader, CascaderChips, CascaderContent, CascaderList, CascaderPanel, CascaderTrigger, useCascaderSelection } from "../cascader";
import { CascaderItems } from "../cascader-item";
import { CascaderInput, CascaderValue } from "../cascader-nav";
import type { CascaderChangeDetails, CascaderNode } from "../cascader-types";
import {
	openPicker,
	optionNames,
	pressKey,
	pressRow,
	PRODUCE,
	type Produce,
	ProducePicker,
	searchField,
	stubCascaderResizeObserver,
} from "@workspace/ui/testing/cascader-test-fixtures";

beforeEach((): void => {
	stubCascaderResizeObserver();
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("Cascader (drill mode)", (): void => {
	it("opens on the root level and closes on Escape", (): void => {
		const onOpenChange = vi.fn();
		render(<ProducePicker items={PRODUCE} onOpenChange={onOpenChange} />, { wrapper: UiKitTestProviders });
		expect(screen.queryByRole("listbox")).toBeNull();

		openPicker();
		expect(optionNames()).toEqual(["Fruit", "Vegetables", "Herbs"]);
		expect(onOpenChange).toHaveBeenLastCalledWith(true, { reason: "trigger-press" });

		pressKey("Escape");
		expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: "escape-key" }));
	});

	it("drills into a branch on press instead of selecting it, and commits a leaf", (): void => {
		const onValueChange = vi.fn<(value: string, details: CascaderChangeDetails<Produce>) => void>();
		render(<ProducePicker items={PRODUCE} onValueChange={onValueChange} />, { wrapper: UiKitTestProviders });
		openPicker();

		pressRow(/Fruit/);
		expect(onValueChange).not.toHaveBeenCalled();
		expect(optionNames()).toEqual(["Apple", "Pear"]);

		pressRow(/Apple/);
		expect(onValueChange).toHaveBeenCalledTimes(1);
		const [value, details] = onValueChange.mock.lastCall ?? ["", null];
		expect(value).toBe("apple");
		expect(details).toMatchObject({ reason: "select", node: { value: "apple", data: { kcal: 52 } } });
		expect(details?.path.map((node: CascaderNode<Produce>): string => node.value)).toEqual(["fruit", "apple"]);
	});

	it("moves across levels with the level keys and Backspace", (): void => {
		const onPathChange = vi.fn();
		render(<ProducePicker items={PRODUCE} onPathChange={onPathChange} />, { wrapper: UiKitTestProviders });
		openPicker();

		pressKey("ArrowDown");
		pressKey("ArrowDown");
		pressKey("ArrowRight");
		expect(optionNames()).toEqual(["Carrot", "Leafy"]);
		expect(onPathChange).toHaveBeenLastCalledWith(["veg"], { reason: "drill" });

		pressKey("ArrowLeft");
		expect(optionNames()).toEqual(["Fruit", "Vegetables", "Herbs"]);
		expect(onPathChange).toHaveBeenLastCalledWith([], { reason: "back" });

		pressKey("ArrowDown");
		pressKey("ArrowRight");
		pressKey("Backspace");
		expect(onPathChange).toHaveBeenLastCalledWith([], { reason: "back" });
	});

	it("never opens a disabled branch", (): void => {
		render(<ProducePicker items={PRODUCE} />, { wrapper: UiKitTestProviders });
		openPicker();
		const herbs = screen.getByRole("option", { name: /Herbs/ });
		expect(herbs.getAttribute("aria-disabled")).toBe("true");
		pressRow(/Herbs/);
		expect(optionNames()).toEqual(["Fruit", "Vegetables", "Herbs"]);
	});

	it("filters the level on screen, by label and keyword", (): void => {
		render(<ProducePicker items={PRODUCE} defaultPath={["fruit"]} revealSelected={false} />, { wrapper: UiKitTestProviders });
		openPicker();
		act((): void => {
			fireEvent.change(searchField(), { target: { value: "pomme" } });
		});
		expect(optionNames()).toEqual(["Apple"]);
	});

	it("searches the whole tree with searchScope='global' and drills to a hit's own trail", (): void => {
		const onPathChange = vi.fn();
		render(<ProducePicker items={PRODUCE} searchScope="global" onPathChange={onPathChange} />, { wrapper: UiKitTestProviders });
		openPicker();
		act((): void => {
			fireEvent.change(searchField(), { target: { value: "leaf" } });
		});
		expect(optionNames()).toEqual(["Leafy"]);
		pressRow(/Leafy/);
		expect(onPathChange).toHaveBeenLastCalledWith(["veg", "leafy"], { reason: "drill" });
		expect(optionNames()).toEqual(["Kale"]);
	});

	it("reveals the selection's level on open and renders its path in the trigger", (): void => {
		render(<ProducePicker items={PRODUCE} value="kale" />, { wrapper: UiKitTestProviders });
		const trigger = screen.getByRole("combobox", { name: "Produce" });
		expect(trigger.textContent).toContain("Vegetables");
		expect(trigger.textContent).toContain("Kale");
		openPicker();
		expect(optionNames()).toEqual(["Kale"]);
	});

	it("is controlled: a declined change leaves the displayed value alone", (): void => {
		const onValueChange = vi.fn();
		render(<ProducePicker items={PRODUCE} value="pear" onValueChange={onValueChange} defaultPath={["fruit"]} revealSelected={false} />, { wrapper: UiKitTestProviders });
		openPicker();
		pressRow(/Apple/);
		expect(onValueChange).toHaveBeenCalledWith("apple", expect.objectContaining({ reason: "select" }));
		expect(screen.getByRole("combobox", { name: "Produce" }).textContent).toContain("Pear");
	});
});

describe("Cascader (multiple)", (): void => {
	it("toggles leaves without closing and caps the selection at max", (): void => {
		const onValueChange = vi.fn();
		render(<ProducePicker items={PRODUCE} multiple max={1} defaultPath={["fruit"]} revealSelected={false} onValueChange={onValueChange} />, { wrapper: UiKitTestProviders });
		openPicker();
		pressRow(/Apple/);
		expect(onValueChange).toHaveBeenLastCalledWith(["apple"], expect.objectContaining({ reason: "select" }));
		pressRow(/Pear/);
		expect(onValueChange).toHaveBeenCalledTimes(1);
		expect(screen.getByRole("status").textContent).toContain("Selection limit of 1 reached");
		pressRow(/Apple/);
		expect(onValueChange).toHaveBeenLastCalledWith([], expect.objectContaining({ reason: "deselect" }));
	});

	it("cascades a branch commit over its known subtree", (): void => {
		const onValueChange = vi.fn<(value: readonly string[], details: CascaderChangeDetails<Produce>) => void>();
		render(<ProducePicker items={PRODUCE} multiple cascade selectable="any" onValueChange={onValueChange} />, { wrapper: UiKitTestProviders });
		openPicker();
		pressRow(/Vegetables/);
		const [values] = onValueChange.mock.lastCall ?? [[]];
		expect([...values].sort()).toEqual(["carrot", "kale", "leafy", "veg"]);
	});

	it("renders one named, removable chip per selection", (): void => {
		const onValueChange = vi.fn();
		render(
			<Cascader items={PRODUCE} multiple value={["apple", "carrot"]} onValueChange={onValueChange}>
				<CascaderChips placeholder="None" />
			</Cascader>,
			{ wrapper: UiKitTestProviders },
		);
		expect(screen.getByRole("toolbar", { name: "Selected items" })).toBeTruthy();
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Remove Apple" }));
		});
		expect(onValueChange).toHaveBeenLastCalledWith(["carrot"], expect.objectContaining({ reason: "deselect" }));
	});
});

describe("Cascader state, refs and labels", (): void => {
	it("resolves the trigger state with disabled before loading before invalid", (): void => {
		const { rerender } = render(<ProducePicker items={PRODUCE} invalid loading disabled />, { wrapper: UiKitTestProviders });
		const trigger = (): HTMLElement => screen.getByRole("combobox", { name: "Produce" });
		expect(trigger().className).toContain("cursor-not-allowed");
		rerender(<ProducePicker items={PRODUCE} invalid loading />);
		expect(trigger().className).toContain("opacity-60");
		expect(trigger().getAttribute("aria-busy")).toBe("true");
		rerender(<ProducePicker items={PRODUCE} invalid />);
		expect(trigger().className).toContain("border-destructive");
		expect(trigger().getAttribute("aria-invalid")).toBe("true");
	});

	it("forwards refs and merges className last", (): void => {
		const triggerRef = React.createRef<HTMLButtonElement>();
		const inputRef = React.createRef<HTMLInputElement>();
		render(
			<Cascader items={PRODUCE} defaultOpen>
				<CascaderTrigger ref={triggerRef} aria-label="Produce" className="h-12">
					<CascaderValue />
				</CascaderTrigger>
				<CascaderContent>
					<CascaderPanel>
						<CascaderInput ref={inputRef} />
						<CascaderList>
							<CascaderItems />
						</CascaderList>
					</CascaderPanel>
				</CascaderContent>
			</Cascader>,
			{ wrapper: UiKitTestProviders },
		);
		expect(triggerRef.current?.tagName).toBe("BUTTON");
		expect(triggerRef.current?.className).toContain("h-12");
		expect(triggerRef.current?.className).not.toContain("h-9");
		expect(inputRef.current?.tagName).toBe("INPUT");
	});

	it("reads its copy from the labels family and lets `labels` override one string", (): void => {
		render(<ProducePicker items={PRODUCE} defaultOpen labels={SEARCH_OVERRIDE} />, { wrapper: UiKitTestProviders });
		expect(searchField().getAttribute("placeholder")).toBe("Find produce");
		expect(screen.getByRole("dialog", { name: "Options" })).toBeTruthy();
	});

	it("hands the typed payload back through useCascaderSelection(items)", (): void => {
		render(
			<Cascader items={PRODUCE} value="pear">
				<SelectionProbe />
			</Cascader>,
			{ wrapper: UiKitTestProviders },
		);
		expect(screen.getByTestId("probe").textContent).toBe("Pear:57:Fruit");
	});

	it("announces the level on screen in the live region", async (): Promise<void> => {
		render(<ProducePicker items={PRODUCE} />, { wrapper: UiKitTestProviders });
		openPicker();
		await waitFor((): void => {
			expect(screen.getByRole("status").textContent).toContain("Top level, 3 items");
		});
		pressRow(/Fruit/);
		await waitFor((): void => {
			expect(screen.getByRole("status").textContent).toContain("Fruit, level 2, 2 items");
		});
	});
});

const SEARCH_OVERRIDE = { search: "Find produce" };

function SelectionProbe(): React.JSX.Element {
	const { first, firstPath } = useCascaderSelection<Produce>(PRODUCE);
	const [root] = firstPath;
	return <span data-testid="probe">{`${first?.label ?? ""}:${String(first?.data?.kcal ?? 0)}:${root?.label ?? ""}`}</span>;
}
