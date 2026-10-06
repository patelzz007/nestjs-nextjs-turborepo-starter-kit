// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UI_KIT_LABELS_EN } from "../lib/labels/en";
import type { UiKitLabels } from "../lib/labels/ui-kit-labels";
import { UiKitTestProviders } from "../testing/ui-kit-test-providers";
import { ScrollToTop } from "./scroll-to-top";
import { UiKitLabelsProvider } from "./ui-kit-labels-provider";

/** An app-shell-like scroller: the button must find it by walking up from itself. */
const SCROLLER_STYLE: React.CSSProperties = { overflowY: "auto" };

/** A label set whose `scrollToTop` family differs from English — proves the provider supplies the copy. */
const GERMAN_LABELS: UiKitLabels = { ...UI_KIT_LABELS_EN, scrollToTop: { label: "Nach oben scrollen" } };

afterEach((): void => {
	cleanup();
	vi.restoreAllMocks();
});

describe("ScrollToTop", () => {
	it("is hidden (and out of the tab order) until the page scrolls past the threshold", (): void => {
		render(<ScrollToTop />, { wrapper: UiKitTestProviders });
		const button = screen.getByRole("button", { hidden: true });
		expect(button.getAttribute("aria-hidden")).toBe("true");
		expect(button.getAttribute("tabindex")).toBe("-1");
		expect(button.getAttribute("aria-label")).toBe(UI_KIT_LABELS_EN.scrollToTop.label);
	});

	it("follows its scroll container's position when uncontrolled, and reports each crossing", (): void => {
		const onVisibleChange = vi.fn();
		render(
			<div data-testid="scroller" style={SCROLLER_STYLE}>
				<ScrollToTop threshold={100} onVisibleChange={onVisibleChange} />
			</div>,
			{ wrapper: UiKitTestProviders },
		);
		const scroller = screen.getByTestId("scroller");

		Object.defineProperty(scroller, "scrollTop", { value: 200, configurable: true });
		fireEvent.scroll(scroller);

		expect(screen.getByRole("button").dataset.visible).toBe("");
		expect(onVisibleChange).toHaveBeenLastCalledWith(true);
	});

	it("lets a parent control visibility", (): void => {
		render(<ScrollToTop visible label="Back to top" />, { wrapper: UiKitTestProviders });
		const button = screen.getByRole("button", { name: "Back to top" });
		expect(button.dataset.visible).toBe("");
	});

	it("runs a caller's onClick and scrolls the detected container to the top", (): void => {
		const onClick = vi.fn();
		const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation((): void => undefined);
		render(<ScrollToTop visible onClick={onClick} behavior="auto" />, { wrapper: UiKitTestProviders });

		fireEvent.click(screen.getByRole("button"));

		expect(onClick).toHaveBeenCalledTimes(1);
		expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
	});

	it("forwards its ref to the button", (): void => {
		const ref = React.createRef<HTMLElement>();
		render(<ScrollToTop ref={ref} />, { wrapper: UiKitTestProviders });
		expect(ref.current?.dataset.slot).toBe("scroll-to-top");
	});

	it("reads its name from the scrollToTop family of the nearest UiKitLabelsProvider", (): void => {
		render(
			<UiKitLabelsProvider labels={GERMAN_LABELS}>
				<ScrollToTop visible />
			</UiKitLabelsProvider>,
		);
		expect(screen.getByRole("button", { name: GERMAN_LABELS.scrollToTop.label })).toBeTruthy();
	});

	it("throws without a UiKitLabelsProvider", (): void => {
		expect(() => render(<ScrollToTop />)).toThrow('"scrollToTop" labels');
	});
});
