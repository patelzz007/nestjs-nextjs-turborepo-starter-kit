// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AnalyticsRangeControls, useAnalyticsRange } from "./analytics-range-controls";

// `useSearchParams` reads the address bar, as Next.js does once the History API integration has synced it.
vi.mock("next/navigation", () => ({
	useSearchParams: (): URLSearchParams => new URLSearchParams(window.location.search),
}));

const PATH = "/analytics";
/** 5 Oct 2026 12:00 UTC. */
const NOW = Date.UTC(2026, 9, 5, 12);

function setUrl(url: string): void {
	window.history.replaceState(null, "", url);
}

function currentQuery(): string {
	return decodeURIComponent(window.location.search);
}

function Controls(): React.JSX.Element {
	const controller = useAnalyticsRange(NOW, "UTC");
	return <AnalyticsRangeControls controller={controller} />;
}

/** The URL changed through the History API; re-render so `useSearchParams` reads it (Next does this itself). */
function renderControls(): () => void {
	const { rerender } = render(<Controls />);
	return (): void => {
		rerender(<Controls />);
	};
}

beforeEach((): void => {
	setUrl(PATH);
});

afterEach((): void => {
	cleanup();
});

describe("useAnalyticsRange", () => {
	it("resolves a shared link's range against the request time", (): void => {
		setUrl(`${PATH}?range=lastMonth&interval=week`);

		const { result } = renderHook(() => useAnalyticsRange(NOW, "UTC"));

		expect(result.current.range.days).toEqual({ fromDate: "2026-09-01", toDate: "2026-09-30" });
		expect(result.current.range.interval).toBe("week");
	});

	it("writes a preset, a custom range and an interval to the URL", (): void => {
		const { result } = renderHook(() => useAnalyticsRange(NOW, "UTC"));

		act((): void => {
			result.current.selectPreset("last7Days");
		});
		expect(currentQuery()).toBe("?range=last7Days");

		act((): void => {
			result.current.selectInterval("week");
		});
		expect(currentQuery()).toBe("?range=last7Days&interval=week");

		act((): void => {
			result.current.applyCustomRange({ fromDate: "2026-01-01", toDate: "2026-03-31" });
		});
		// A new range drops the chosen interval: the length's default applies again.
		expect(currentQuery()).toBe("?range=custom&from=2026-01-01&to=2026-03-31");

		act((): void => {
			result.current.selectPreset("last30Days");
		});
		expect(currentQuery()).toBe("");
	});
});

/** A labelled menu trigger: named by its visible label and its current choice. */
function menuTrigger(label: string): HTMLElement {
	return screen.getByRole("button", { name: new RegExp(`^${label} `) });
}

async function choose(label: string, option: string): Promise<void> {
	fireEvent.click(menuTrigger(label));
	fireEvent.click(await screen.findByRole("menuitemradio", { name: option }));
}

describe("AnalyticsRangeControls", () => {
	it("shows the range in effect and the derived interval", (): void => {
		renderControls();

		expect(menuTrigger("Date range").textContent).toBe("Last 30 days");
		expect(menuTrigger("Group by").textContent).toBe("Day");
		expect(screen.getByRole("status").textContent.replace(/\s/g, " ")).toBe("6 Sept – 5 Oct 2026 · UTC");
	});

	it("puts a picked preset in the URL", async (): Promise<void> => {
		const refresh = renderControls();

		await choose("Date range", "Year to date");
		refresh();

		expect(currentQuery()).toBe("?range=yearToDate");
		expect(menuTrigger("Group by").textContent).toBe("Month");
	});

	it("picks custom days in the calendar, refuses an incomplete pick, and applies a valid range", async (): Promise<void> => {
		const refresh = renderControls();

		await choose("Date range", "Custom range");
		// The URL does not change until Apply; the calendar starts at the days in effect.
		expect(currentQuery()).toBe("");
		const days = screen.getByRole("button", { name: /^Days / });
		expect(days.textContent.replace(/\s/g, " ")).toBe("6 Sept – 5 Oct 2026");

		fireEvent.click(days);
		// A new pick starts over: the first click sets the first day only.
		fireEvent.click(await screen.findByRole("button", { name: /September 14th, 2026/ }));
		expect(screen.getByRole("alert").textContent).toBe("Choose both a start and an end date");
		expect(screen.getByRole<HTMLButtonElement>("button", { name: "Apply" }).disabled).toBe(true);
		fireEvent.click(screen.getByRole("button", { name: /September 20th, 2026/ }));
		fireEvent.click(screen.getByRole("button", { name: /next month/i }));
		// Days after today (5 Oct, UTC) cannot be picked.
		expect(screen.getByRole("button", { name: /October 6th, 2026/ }).hasAttribute("disabled")).toBe(true);
		fireEvent.click(screen.getByRole("button", { name: "Apply" }));
		refresh();

		expect(currentQuery()).toBe("?range=custom&from=2026-09-14&to=2026-09-20");
		expect(menuTrigger("Date range").textContent).toBe("Custom range");
	});

	it("puts a picked interval in the URL, by keyboard", async (): Promise<void> => {
		renderControls();

		const trigger = menuTrigger("Group by");
		trigger.focus();
		fireEvent.keyDown(trigger, { key: "ArrowDown" });
		fireEvent.click(await screen.findByRole("menuitemradio", { name: "Week" }));

		expect(currentQuery()).toBe("?interval=week");
	});
});
