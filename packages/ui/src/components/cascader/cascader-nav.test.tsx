// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UiKitTestProviders } from "../../testing/ui-kit-test-providers";
import { Cascader } from "./cascader";
import { CascaderBack, CascaderBreadcrumb, CascaderNav, CascaderValue, cascaderInputVariants } from "./cascader-nav";
import { openPicker, pressRow, PRODUCE, ProducePicker, searchField, stubCascaderResizeObserver } from "@workspace/ui/testing/cascader-test-fixtures";
import type { CascaderNodeBase } from "./cascader-types";

beforeEach((): void => {
	stubCascaderResizeObserver();
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("CascaderInput", (): void => {
	it("names the level it searches and describes the level keys", (): void => {
		render(<ProducePicker items={PRODUCE} />, { wrapper: UiKitTestProviders });
		openPicker();
		expect(searchField().getAttribute("placeholder")).toBe("Search…");
		pressRow(/Fruit/);
		expect(searchField().getAttribute("placeholder")).toBe("Search Fruit…");
		const hintId = searchField().getAttribute("aria-describedby") ?? "";
		expect(document.getElementById(hintId)?.textContent).toBe("Use the Right Arrow key to open a branch and the Left Arrow key to go back.");
	});

	it("words the hint for a right-to-left document", (): void => {
		// The popup is portalled to the body, so the document's own direction is what it reads.
		document.documentElement.setAttribute("dir", "rtl");
		try {
			render(<ProducePicker items={PRODUCE} defaultOpen />, { wrapper: UiKitTestProviders });
			const hintId = searchField().getAttribute("aria-describedby") ?? "";
			expect(document.getElementById(hintId)?.textContent).toBe("Use the Left Arrow key to open a branch and the Right Arrow key to go back.");
		} finally {
			document.documentElement.removeAttribute("dir");
		}
	});

	it("carries the invalid state when inline", (): void => {
		render(<ProducePicker items={PRODUCE} inline open invalid />, { wrapper: UiKitTestProviders });
		expect(searchField().getAttribute("aria-invalid")).toBe("true");
		expect(searchField().getAttribute("aria-expanded")).toBe("true");
		expect(cascaderInputVariants({ state: "error" })).toContain("text-destructive");
	});
});

describe("CascaderBack and CascaderBreadcrumb", (): void => {
	it("shows the trail of the open level and goes back to a crumb", (): void => {
		const onPathChange = vi.fn();
		render(<ProducePicker items={PRODUCE} onPathChange={onPathChange} />, { wrapper: UiKitTestProviders });
		openPicker();
		expect(screen.queryByRole("navigation", { name: "Breadcrumb" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Back" })).toBeNull();

		pressRow(/Vegetables/);
		pressRow(/Leafy/);
		const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
		expect(crumbs.textContent).toBe("VegetablesLeafy");
		expect(screen.getByText("Leafy", { selector: "[aria-current=page]" })).toBeTruthy();

		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Vegetables" }));
		});
		expect(onPathChange).toHaveBeenLastCalledWith(["veg"], { reason: "breadcrumb" });

		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Back" }));
		});
		expect(onPathChange).toHaveBeenLastCalledWith([], { reason: "back" });
	});

	it("forwards refs on the nav, back and breadcrumb", (): void => {
		const navRef = React.createRef<HTMLDivElement>();
		const backRef = React.createRef<HTMLButtonElement>();
		const crumbRef = React.createRef<HTMLElement>();
		render(
			<Cascader items={PRODUCE} defaultPath={["veg"]}>
				<CascaderNav ref={navRef} className="custom-nav">
					<CascaderBack ref={backRef} />
				</CascaderNav>
				<CascaderBreadcrumb ref={crumbRef} />
			</Cascader>,
			{ wrapper: UiKitTestProviders },
		);
		expect(navRef.current?.className).toContain("custom-nav");
		expect(backRef.current?.tagName).toBe("BUTTON");
		expect(crumbRef.current?.tagName).toBe("NAV");
	});
});

describe("CascaderValue", (): void => {
	it("renders the placeholder, the path, the leaf or the count", (): void => {
		const { rerender } = render(
			<Cascader items={PRODUCE}>
				<CascaderValue placeholder="Pick" />
			</Cascader>,
			{ wrapper: UiKitTestProviders },
		);
		expect(screen.getByText("Pick")).toBeTruthy();

		rerender(
			<Cascader items={PRODUCE} value="kale">
				<CascaderValue maxSegments={2} />
			</Cascader>,
		);
		expect(screen.getByText("…").getAttribute("title")).toBe("Leafy");

		rerender(
			<Cascader items={PRODUCE} value="kale">
				<CascaderValue display="leaf" />
			</Cascader>,
		);
		expect(document.querySelector('[data-slot="cascader-value"]')?.textContent).toBe("Kale");

		rerender(
			<Cascader items={PRODUCE} multiple value={["kale", "apple"]}>
				<CascaderValue />
			</Cascader>,
		);
		expect(screen.getByText("2 selected")).toBeTruthy();
	});

	it("hands a render function the resolved selection and path", (): void => {
		const ref = React.createRef<HTMLSpanElement>();
		render(
			<Cascader items={PRODUCE} value="apple">
				<CascaderValue ref={ref}>{renderTrail}</CascaderValue>
			</Cascader>,
			{ wrapper: UiKitTestProviders },
		);
		expect(ref.current?.textContent).toBe("apple@fruit>apple");
	});
});

function renderTrail(selected: readonly CascaderNodeBase[], path: readonly CascaderNodeBase[]): React.ReactNode {
	return `${selected.map((node: CascaderNodeBase): string => node.value).join(",")}@${path.map((node: CascaderNodeBase): string => node.value).join(">")}`;
}
