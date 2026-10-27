// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { UI_KIT_LABELS_EN } from "@workspace/ui/lib/labels/en";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ClientTestProviders } from "../../../../testing/client-test-providers";
import { flushUrlUpdates } from "../../../../testing/flush-url-updates";
import { useAnalyticsRange } from "../analytics-range-controller";
import { AnalyticsRangeControls } from "../analytics-range-controls";

const PATH = "/analytics";
/** The picker's chrome comes from the UI kit's English pack (`ClientTestProviders`). */
const PICKER_LABELS = UI_KIT_LABELS_EN.analyticsRangePicker;
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

function renderControls(): void {
	render(<Controls />, { wrapper: ClientTestProviders });
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

		const { result } = renderHook(() => useAnalyticsRange(NOW, "UTC"), { wrapper: ClientTestProviders });

		expect(result.current.range.days).toEqual({ fromDate: "2026-09-01", toDate: "2026-09-30" });
		expect(result.current.range.interval).toBe("week");
	});

	it("writes a preset, a custom range and an interval to the URL", async (): Promise<void> => {
		const { result } = renderHook(() => useAnalyticsRange(NOW, "UTC"), { wrapper: ClientTestProviders });

		act((): void => {
			result.current.selectPreset("last7Days");
		});
		await flushUrlUpdates();
		expect(currentQuery()).toBe("?range=last7Days");

		act((): void => {
			result.current.selectInterval("week");
		});
		await flushUrlUpdates();
		expect(currentQuery()).toBe("?range=last7Days&interval=week");

		act((): void => {
			result.current.applyCustomRange({ fromDate: "2026-01-01", toDate: "2026-03-31" });
		});
		await flushUrlUpdates();
		// A new range drops the chosen interval: the length's default applies again.
		expect(currentQuery()).toBe("?range=custom&from=2026-01-01&to=2026-03-31");

		act((): void => {
			result.current.selectPreset("last30Days");
		});
		await flushUrlUpdates();
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

		expect(menuTrigger(PICKER_LABELS.range).textContent).toBe("Last 30 days");
		expect(menuTrigger(PICKER_LABELS.interval).textContent).toBe("Day");
		expect(screen.getByRole("status").textContent.replace(/\s/g, " ")).toBe("6 Sept – 5 Oct 2026 · UTC");
	});

	it("puts a picked preset in the URL", async (): Promise<void> => {
		renderControls();

		await choose(PICKER_LABELS.range, "Year to date");
		await flushUrlUpdates();

		expect(currentQuery()).toBe("?range=yearToDate");
		expect(menuTrigger(PICKER_LABELS.interval).textContent).toBe("Month");
	});

	it("keeps a custom range out of the URL until Apply commits the days already in effect", async (): Promise<void> => {
		// Incomplete picks and disabled days are covered by the picker and checkCustomRange tests.
		// This test only checks that Apply is what writes the URL.
		renderControls();

		await choose(PICKER_LABELS.range, "Custom range");
		// Choosing custom only opens a draft. The URL changes on Apply.
		expect(currentQuery()).toBe("");
		expect(screen.getByRole("button", { name: new RegExp(`^${PICKER_LABELS.customDays} `) }).textContent.replace(/\s/g, " ")).toBe("6 Sept – 5 Oct 2026");

		fireEvent.click(screen.getByRole("button", { name: PICKER_LABELS.apply }));
		await flushUrlUpdates();

		expect(currentQuery()).toBe("?range=custom&from=2026-09-06&to=2026-10-05");
		expect(menuTrigger(PICKER_LABELS.range).textContent).toBe("Custom range");
	});

	it("puts a picked interval in the URL, by keyboard", async (): Promise<void> => {
		renderControls();

		const trigger = menuTrigger(PICKER_LABELS.interval);
		trigger.focus();
		fireEvent.keyDown(trigger, { key: "ArrowDown" });
		fireEvent.click(await screen.findByRole("menuitemradio", { name: "Week" }));

		await flushUrlUpdates();
		expect(currentQuery()).toBe("?interval=week");
	});
});
