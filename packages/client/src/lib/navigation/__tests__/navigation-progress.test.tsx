// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NAVIGATION_PROGRESS_SHOW_DELAY_MS, NavigationProgressProvider, useNavigationProgress } from "@workspace/ui/components/navigation-progress";

import { AppNavigationProgress, NavigationProgressSync } from "../navigation-progress";

const location = vi.hoisted((): { pathname: string; search: string } => ({ pathname: "/reports", search: "" }));

vi.mock("next/navigation", () => ({
	usePathname: (): string => location.pathname,
	useSearchParams: (): URLSearchParams => new URLSearchParams(location.search),
}));

function phase(): string | undefined {
	return document.querySelector<HTMLElement>("[data-slot=navigation-progress]")?.getAttribute("data-phase") ?? undefined;
}

/** Starts a navigation the way app code does, through the provider's controls. */
function Navigate(): React.JSX.Element {
	const { start } = useNavigationProgress();
	const goToSettings = React.useCallback((): void => {
		start("/settings");
	}, [start]);
	return (
		<button type="button" onClick={goToSettings}>
			Settings
		</button>
	);
}

function App(): React.JSX.Element {
	return (
		<NavigationProgressProvider>
			<Navigate />
			<NavigationProgressSync />
		</NavigationProgressProvider>
	);
}

// This package's test setup does not unmount between tests.
afterEach((): void => {
	cleanup();
});

describe("NavigationProgressSync", () => {
	beforeEach((): void => {
		vi.useFakeTimers();
		window.history.replaceState(null, "", "/reports");
		location.pathname = "/reports";
		location.search = "";
	});

	afterEach((): void => {
		vi.useRealTimers();
	});

	function startLoading(): void {
		fireEvent.click(screen.getByText("Settings"));
		act((): void => {
			vi.advanceTimersByTime(NAVIGATION_PROGRESS_SHOW_DELAY_MS);
		});
		expect(phase()).toBe("loading");
	}

	it("renders nothing on the server, not even an empty Suspense boundary", (): void => {
		// An empty boundary stayed dehydrated on the client, which React DevTools' Suspense tracking throws on.
		expect(renderToString(<NavigationProgressSync />)).toBe("");
	});

	it("completes the bar when the App Router commits a new path", (): void => {
		const { rerender } = render(<App />);
		startLoading();
		location.pathname = "/settings";
		rerender(<App />);
		expect(phase()).toBe("finishing");
	});

	it("completes the bar when only the query string changes", (): void => {
		const { rerender } = render(<App />);
		startLoading();
		location.search = "tab=security";
		rerender(<App />);
		expect(phase()).toBe("finishing");
	});

	it("leaves a running bar alone while the page has not changed", (): void => {
		const { rerender } = render(<App />);
		startLoading();
		rerender(<App />);
		expect(phase()).toBe("loading");
	});
});

describe("AppNavigationProgress", () => {
	it("renders the page with the bar beside it, idle until a navigation starts", (): void => {
		render(
			<AppNavigationProgress>
				<p>Page</p>
			</AppNavigationProgress>,
		);
		expect(screen.getByText("Page")).toBeDefined();
		expect(phase()).toBe("idle");
	});
});
