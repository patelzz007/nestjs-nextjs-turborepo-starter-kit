// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	isNewPageLocation,
	NAVIGATION_PROGRESS_CEILING_PERCENT,
	NAVIGATION_PROGRESS_FINISH_MS,
	NAVIGATION_PROGRESS_SHOW_DELAY_MS,
	NAVIGATION_PROGRESS_START_PERCENT,
	NAVIGATION_PROGRESS_TRICKLE_INTERVAL_MS,
	NavigationProgressProvider,
	navigationTargetOfClick,
	trickleNavigationProgress,
	useNavigationProgress,
} from "../navigation-progress";

const ORIGIN = "http://localhost:3000";
const HERE = `${ORIGIN}/reports?page=2`;
/** The bar's width is a percentage; its transform is a 0–1 scale. */
const PERCENT_SCALE = 100;
/** Enough trickle steps to prove the bar never passes its ceiling on its own. */
const MANY_TRICKLE_STEPS = 200;

function bar(): HTMLElement {
	const element = document.querySelector<HTMLElement>("[data-slot=navigation-progress]");
	if (element === null) throw new Error("The navigation progress bar is not rendered.");
	return element;
}

/** Exposes the provider's controls as buttons, as navigation in code would call them. */
function Controls(): React.JSX.Element {
	const { start, done } = useNavigationProgress();
	const goInCode = React.useCallback((): void => {
		start("/settings");
	}, [start]);
	const samePageInCode = React.useCallback((): void => {
		start("/reports?page=2#totals");
	}, [start]);
	return (
		<>
			<button type="button" onClick={goInCode}>
				Go in code
			</button>
			<button type="button" onClick={samePageInCode}>
				Same page in code
			</button>
			<button type="button" onClick={done}>
				Arrive
			</button>
		</>
	);
}

/** Cancels the browser's own navigation, as a router's link does (jsdom cannot load another document). */
function cancelNavigation(event: React.MouseEvent): void {
	event.preventDefault();
}

function renderProvider(): void {
	render(
		<NavigationProgressProvider>
			<div onClickCapture={cancelNavigation}>
				<a href="/settings">Settings</a>
				<a href="/reports?page=2#totals">Totals</a>
				<a href="/reports?page=3">Next page</a>
				<a href="https://example.com/elsewhere">Elsewhere</a>
				<a href="/report.pdf" download>
					Download
				</a>
				<a href="/settings" target="_blank">
					New tab
				</a>
			</div>
			<Controls />
		</NavigationProgressProvider>,
	);
}

function advance(ms: number): void {
	act((): void => {
		vi.advanceTimersByTime(ms);
	});
}

// This package's test setup does not unmount between tests.
afterEach((): void => {
	cleanup();
});

describe("navigation progress helpers", () => {
	it("trickles towards the ceiling, slowing down, and never passes it", (): void => {
		const first = trickleNavigationProgress(NAVIGATION_PROGRESS_START_PERCENT);
		const second = trickleNavigationProgress(first);
		expect(first).toBeGreaterThan(NAVIGATION_PROGRESS_START_PERCENT);
		expect(second - first).toBeLessThan(first - NAVIGATION_PROGRESS_START_PERCENT);
		let percent = NAVIGATION_PROGRESS_START_PERCENT;
		for (let step = 0; step < MANY_TRICKLE_STEPS; step += 1) percent = trickleNavigationProgress(percent);
		expect(percent).toBeLessThanOrEqual(NAVIGATION_PROGRESS_CEILING_PERCENT);
		expect(trickleNavigationProgress(NAVIGATION_PROGRESS_CEILING_PERCENT)).toBe(NAVIGATION_PROGRESS_CEILING_PERCENT);
	});

	it("counts a new path or query on the same origin as a new page, and nothing else", (): void => {
		const current = new URL(HERE);
		expect(isNewPageLocation(new URL("/settings", current), current)).toBe(true);
		expect(isNewPageLocation(new URL("/reports?page=3", current), current)).toBe(true);
		expect(isNewPageLocation(new URL("/reports?page=2#totals", current), current)).toBe(false);
		expect(isNewPageLocation(new URL(HERE), current)).toBe(false);
		expect(isNewPageLocation(new URL("https://example.com/settings"), current)).toBe(false);
	});

	it("reads the target of a plain click on a link inside the anchor", (): void => {
		const anchor = document.createElement("a");
		anchor.href = "/settings";
		const label = document.createElement("span");
		anchor.append(label);
		anchor.addEventListener("click", (event: MouseEvent): void => {
			event.preventDefault();
		});
		document.body.append(anchor);
		const click = new MouseEvent("click", { bubbles: true, button: 0 });
		label.dispatchEvent(click);
		expect(navigationTargetOfClick(click, new URL(HERE))?.pathname).toBe("/settings");
		const modified = new MouseEvent("click", { bubbles: true, button: 0, metaKey: true });
		label.dispatchEvent(modified);
		expect(navigationTargetOfClick(modified, new URL(HERE))).toBeNull();
		const middle = new MouseEvent("click", { bubbles: true, button: 1 });
		label.dispatchEvent(middle);
		expect(navigationTargetOfClick(middle, new URL(HERE))).toBeNull();
		anchor.remove();
	});
});

describe("NavigationProgressProvider", () => {
	beforeEach((): void => {
		vi.useFakeTimers();
		window.history.replaceState(null, "", HERE);
	});

	afterEach((): void => {
		vi.useRealTimers();
	});

	it("waits out the show delay before the bar appears after a link click, then trickles", (): void => {
		renderProvider();
		expect(bar().getAttribute("data-phase")).toBe("idle");
		fireEvent.click(screen.getByText("Settings"));
		expect(bar().getAttribute("data-phase")).toBe("waiting");
		expect(bar().className).toContain("opacity-0");
		advance(NAVIGATION_PROGRESS_SHOW_DELAY_MS);
		expect(bar().getAttribute("data-phase")).toBe("loading");
		expect(bar().className).toContain("opacity-100");
		expect(bar().style.transform).toBe(`scaleX(${String(NAVIGATION_PROGRESS_START_PERCENT / PERCENT_SCALE)})`);
		advance(NAVIGATION_PROGRESS_TRICKLE_INTERVAL_MS);
		expect(bar().style.transform).toBe(`scaleX(${String(trickleNavigationProgress(NAVIGATION_PROGRESS_START_PERCENT) / PERCENT_SCALE)})`);
		expect(bar().getAttribute("aria-hidden")).toBe("true");
	});

	it("fills and fades when the page arrives, then resets", (): void => {
		renderProvider();
		fireEvent.click(screen.getByText("Settings"));
		advance(NAVIGATION_PROGRESS_SHOW_DELAY_MS);
		fireEvent.click(screen.getByText("Arrive"));
		expect(bar().getAttribute("data-phase")).toBe("finishing");
		expect(bar().style.transform).toBe("scaleX(1)");
		expect(bar().className).toContain("opacity-0");
		advance(NAVIGATION_PROGRESS_FINISH_MS);
		expect(bar().getAttribute("data-phase")).toBe("idle");
		expect(bar().style.transform).toBe("scaleX(0)");
	});

	it("never shows the bar for a page that arrives inside the show delay", (): void => {
		renderProvider();
		fireEvent.click(screen.getByText("Settings"));
		fireEvent.click(screen.getByText("Arrive"));
		expect(bar().getAttribute("data-phase")).toBe("idle");
		advance(NAVIGATION_PROGRESS_SHOW_DELAY_MS);
		expect(bar().getAttribute("data-phase")).toBe("idle");
	});

	it("starts for a new query string on the same path", (): void => {
		renderProvider();
		fireEvent.click(screen.getByText("Next page"));
		expect(bar().getAttribute("data-phase")).toBe("waiting");
	});

	it("ignores clicks that do not move this tab to another page", (): void => {
		renderProvider();
		fireEvent.click(screen.getByText("Totals"));
		fireEvent.click(screen.getByText("Elsewhere"));
		fireEvent.click(screen.getByText("Download"));
		fireEvent.click(screen.getByText("New tab"));
		fireEvent.click(screen.getByText("Settings"), { ctrlKey: true });
		expect(bar().getAttribute("data-phase")).toBe("idle");
	});

	it("starts from code for another page only", (): void => {
		renderProvider();
		fireEvent.click(screen.getByText("Same page in code"));
		expect(bar().getAttribute("data-phase")).toBe("idle");
		fireEvent.click(screen.getByText("Go in code"));
		expect(bar().getAttribute("data-phase")).toBe("waiting");
	});

	it("starts on back/forward to another page, and not for a history entry of the same page", (): void => {
		renderProvider();
		window.history.replaceState(null, "", `${HERE}#totals`);
		act((): void => {
			window.dispatchEvent(new PopStateEvent("popstate"));
		});
		expect(bar().getAttribute("data-phase")).toBe("idle");
		window.history.replaceState(null, "", `${ORIGIN}/settings`);
		act((): void => {
			window.dispatchEvent(new PopStateEvent("popstate"));
		});
		expect(bar().getAttribute("data-phase")).toBe("waiting");
	});

	it("restarts when another navigation begins while the last one is finishing", (): void => {
		renderProvider();
		fireEvent.click(screen.getByText("Settings"));
		advance(NAVIGATION_PROGRESS_SHOW_DELAY_MS);
		fireEvent.click(screen.getByText("Arrive"));
		fireEvent.click(screen.getByText("Next page"));
		expect(bar().getAttribute("data-phase")).toBe("waiting");
		advance(NAVIGATION_PROGRESS_FINISH_MS);
		expect(bar().getAttribute("data-phase")).toBe("loading");
	});

	it("removes its click and history listeners once unmounted", (): void => {
		const removeDocumentListener = vi.spyOn(document, "removeEventListener");
		const removeWindowListener = vi.spyOn(window, "removeEventListener");
		const { unmount } = render(<NavigationProgressProvider>{null}</NavigationProgressProvider>);
		unmount();
		expect(removeDocumentListener).toHaveBeenCalledWith("click", expect.any(Function), { capture: true });
		expect(removeWindowListener).toHaveBeenCalledWith("popstate", expect.any(Function));
		removeDocumentListener.mockRestore();
		removeWindowListener.mockRestore();
	});
});

describe("useNavigationProgress outside a provider", () => {
	it("gives no-op controls, so a component that navigates renders on its own", (): void => {
		render(<Controls />);
		fireEvent.click(screen.getByText("Go in code"));
		fireEvent.click(screen.getByText("Arrive"));
		expect(document.querySelector("[data-slot=navigation-progress]")).toBeNull();
	});
});
