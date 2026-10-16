// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UiKitTestProviders } from "../../testing/ui-kit-test-providers";
import { CascaderAction, CascaderFooter, groupCascaderActionRuns } from "./cascader-footer";
import { CascaderItems } from "./cascader-item";
import { CascaderList } from "./cascader";
import { openPicker, pressKey, PRODUCE, ProducePicker, searchField, stubCascaderResizeObserver } from "@workspace/ui/testing/cascader-test-fixtures";
import type { CascaderActionItem } from "./cascader-types";

beforeEach((): void => {
	stubCascaderResizeObserver();
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

function panelWithFooter(footer: React.ReactNode): React.JSX.Element {
	return (
		<>
			<CascaderList>
				<CascaderItems />
			</CascaderList>
			{footer}
		</>
	);
}

describe("CascaderFooter", (): void => {
	it("renders the root's actions as named commands and runs them", (): void => {
		const create = vi.fn();
		const actions: readonly CascaderActionItem[] = [{ value: "create", label: "Create produce", onSelect: create }];
		render(<ProducePicker items={PRODUCE} actions={actions} panelChildren={panelWithFooter(<CascaderFooter />)} />, { wrapper: UiKitTestProviders });
		openPicker();
		expect(screen.getByRole("toolbar", { name: "Actions" })).toBeTruthy();
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Create produce" }));
		});
		expect(create).toHaveBeenCalledTimes(1);
	});

	it("hands focus from the last row to the footer and back to the field", (): void => {
		const footer = (
			<CascaderFooter>
				<CascaderAction>Manage</CascaderAction>
			</CascaderFooter>
		);
		render(<ProducePicker items={PRODUCE} panelChildren={panelWithFooter(footer)} />, { wrapper: UiKitTestProviders });
		openPicker();
		pressKey("ArrowDown");
		pressKey("ArrowDown");
		pressKey("ArrowDown");
		pressKey("ArrowDown");
		const manage = screen.getByRole("button", { name: "Manage" });
		expect(document.activeElement).toBe(manage);
		act((): void => {
			fireEvent.keyDown(manage, { key: "ArrowDown" });
		});
		expect(document.activeElement).toBe(searchField());
	});

	it("keeps a disabled command focusable and inert", (): void => {
		const onSelect = vi.fn();
		const ref = React.createRef<HTMLButtonElement>();
		render(
			<ProducePicker
				items={PRODUCE}
				defaultOpen
				panelChildren={
					<CascaderFooter>
						<CascaderAction ref={ref} disabled onSelect={onSelect} className="custom-action">
							Locked
						</CascaderAction>
					</CascaderFooter>
				}
			/>,
			{ wrapper: UiKitTestProviders },
		);
		expect(ref.current?.getAttribute("aria-disabled")).toBe("true");
		expect(ref.current?.hasAttribute("disabled")).toBe(false);
		expect(ref.current?.className).toContain("custom-action");
		act((): void => {
			ref.current?.click();
		});
		expect(onSelect).not.toHaveBeenCalled();
	});

	it("opens a submenu with the opening arrow, and one Escape closes only the flyout", (): void => {
		const onOpenChange = vi.fn();
		const importCsv = vi.fn();
		const actions: readonly CascaderActionItem[] = [{ value: "import", label: "Import", items: [{ value: "csv", label: "From CSV", onSelect: importCsv }] }];
		render(<ProducePicker items={PRODUCE} actions={actions} onOpenChange={onOpenChange} panelChildren={panelWithFooter(<CascaderFooter />)} />, {
			wrapper: UiKitTestProviders,
		});
		openPicker();
		const trigger = screen.getByRole("button", { name: /Import/ });
		expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
		act((): void => {
			fireEvent.keyDown(trigger, { key: "ArrowRight" });
		});
		const menu = screen.getByRole("menu", { name: /Import/ });
		expect(screen.getByRole("menuitem", { name: "From CSV" })).toBeTruthy();

		onOpenChange.mockClear();
		act((): void => {
			fireEvent.keyDown(menu, { key: "Escape" });
		});
		expect(onOpenChange).not.toHaveBeenCalledWith(false, expect.anything());
	});
});

describe("groupCascaderActionRuns", (): void => {
	it("groups consecutive entries by heading and keeps separated runs apart", (): void => {
		const items: readonly CascaderActionItem[] = [{ label: "A", group: "One" }, { label: "B", group: "One" }, { label: "C" }, { label: "D", group: "One" }];
		expect(groupCascaderActionRuns(items).map((run): string => `${run.group ?? "-"}:${String(run.items.length)}`)).toEqual(["One:2", "-:1", "One:1"]);
	});
});
