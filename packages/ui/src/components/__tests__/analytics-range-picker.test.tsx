import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UI_KIT_LABELS_EN } from "../lib/labels/en";
import { UiKitTestProviders } from "../testing/ui-kit-test-providers";
import { AnalyticsRangePicker, type AnalyticsRangePickerProps, type CustomDays, type PickerOption } from "./analytics-range-picker";

type Preset = "last30Days" | "last7Days" | "custom";
type Interval = "day" | "week";

const PRESETS: readonly PickerOption<Preset>[] = [
	{ value: "last7Days", label: "Last 7 days" },
	{ value: "last30Days", label: "Last 30 days" },
	{ value: "custom", label: "Custom" },
];
const INTERVALS: readonly PickerOption<Interval>[] = [
	{ value: "day", label: "Day" },
	{ value: "week", label: "Week" },
];
const LABELS = UI_KIT_LABELS_EN.analyticsRangePicker;
/** The custom-days trigger: named by its visible label, then the picked days. */
const DAYS_TRIGGER_NAME = new RegExp(`^${LABELS.customDays} `);
const SEPTEMBER: CustomDays = { from: "2026-09-01", to: "2026-09-30" };

function noop(): void {
	// a handler the test does not observe
}

function formatDays(days: CustomDays): string {
	return `${days.from} → ${days.to}`;
}

function renderPicker(overrides: Partial<AnalyticsRangePickerProps<Preset, Interval>> = {}): void {
	render(
		<AnalyticsRangePicker<Preset, Interval>
			presets={PRESETS}
			preset="last30Days"
			customPreset="custom"
			onPresetChange={noop}
			customDays={SEPTEMBER}
			onCustomDaysChange={noop}
			onCustomApply={noop}
			formatCustomDays={formatDays}
			intervals={INTERVALS}
			interval="day"
			onIntervalChange={noop}
			rangeLabel="6 Sep – 5 Oct 2026 · UTC"
			{...overrides}
		/>,
		{ wrapper: UiKitTestProviders },
	);
}

/** The trigger of a labelled menu: named by its visible label and its current choice. */
function menuTrigger(label: string): HTMLElement {
	return screen.getByRole("button", { name: new RegExp(`^${label} `) });
}

afterEach((): void => {
	cleanup();
});

describe("AnalyticsRangePicker", () => {
	it("names each menu by its label and current choice, and announces the range in effect", (): void => {
		renderPicker();

		expect(menuTrigger(LABELS.range).textContent).toBe("Last 30 days");
		expect(menuTrigger(LABELS.interval).textContent).toBe("Day");
		expect(menuTrigger(LABELS.range).getAttribute("aria-haspopup")).toBe("menu");
		expect(screen.getByRole("status").textContent).toBe("6 Sep – 5 Oct 2026 · UTC");
	});

	it("picks a preset with the pointer from a menu of radio items", async (): Promise<void> => {
		const onPresetChange = vi.fn<(preset: Preset) => void>();
		renderPicker({ onPresetChange });

		fireEvent.click(menuTrigger(LABELS.range));
		const menu = await screen.findByRole("menu");
		expect(within(menu).getByRole("menuitemradio", { name: "Last 30 days" }).getAttribute("aria-checked")).toBe("true");
		fireEvent.click(within(menu).getByRole("menuitemradio", { name: "Last 7 days" }));

		expect(onPresetChange).toHaveBeenCalledWith("last7Days");
	});

	it("picks an interval with the keyboard", async (): Promise<void> => {
		const onIntervalChange = vi.fn<(interval: Interval) => void>();
		renderPicker({ onIntervalChange });

		const trigger = menuTrigger(LABELS.interval);
		trigger.focus();
		fireEvent.keyDown(trigger, { key: "ArrowDown" });
		const week = await screen.findByRole("menuitemradio", { name: "Week" });
		fireEvent.keyDown(week, { key: "Enter" });
		fireEvent.click(week);

		expect(onIntervalChange).toHaveBeenCalledWith("week");
	});

	it("keeps the menus closed and inert while disabled", (): void => {
		renderPicker({ disabled: true });

		expect(menuTrigger(LABELS.range).hasAttribute("disabled") || menuTrigger(LABELS.range).getAttribute("aria-disabled") === "true").toBe(true);
	});

	it("shows the custom days only for the custom preset", (): void => {
		renderPicker();
		expect(screen.queryByRole("button", { name: DAYS_TRIGGER_NAME })).toBeNull();
		cleanup();

		renderPicker({ preset: "custom" });
		expect(screen.getByRole("button", { name: DAYS_TRIGGER_NAME }).textContent).toBe("2026-09-01 → 2026-09-30");
	});

	it("selects a range of days in the calendar", async (): Promise<void> => {
		const onCustomDaysChange = vi.fn<(days: CustomDays) => void>();
		renderPicker({ preset: "custom", customDays: { from: "2026-09-01", to: "" }, onCustomDaysChange, customMax: "2026-10-05" });

		fireEvent.click(screen.getByRole("button", { name: DAYS_TRIGGER_NAME }));
		const tenth = await screen.findByRole("button", { name: /September 10th, 2026/ });
		fireEvent.click(tenth);

		expect(onCustomDaysChange).toHaveBeenLastCalledWith({ from: "2026-09-01", to: "2026-09-10" });
	});

	it("disables days after the latest selectable day and beyond the longest span", async (): Promise<void> => {
		renderPicker({ preset: "custom", customDays: { from: "2026-09-28", to: "" }, customMax: "2026-10-05", customMaxDays: 7 });

		fireEvent.click(screen.getByRole("button", { name: DAYS_TRIGGER_NAME }));
		await screen.findByRole("grid");
		fireEvent.click(screen.getByRole("button", { name: /next month/i }));

		expect(screen.getByRole("button", { name: /October 4th, 2026/ }).hasAttribute("disabled")).toBe(false);
		// 28 Sep + 7 days (both ends counted) ends on 4 Oct; 5 Oct would make 8.
		expect(screen.getByRole("button", { name: /October 5th, 2026/ }).hasAttribute("disabled")).toBe(true);
		expect(screen.getByRole("button", { name: /October 6th, 2026/ }).hasAttribute("disabled")).toBe(true);
	});

	it("applies valid custom days on submit", (): void => {
		const onCustomApply = vi.fn<() => void>();
		renderPicker({ preset: "custom", onCustomApply });

		fireEvent.click(screen.getByRole("button", { name: LABELS.apply }));

		expect(onCustomApply).toHaveBeenCalledTimes(1);
	});

	it("blocks Apply and ties the error to the calendar trigger when the custom days are invalid", (): void => {
		const onCustomApply = vi.fn<() => void>();
		renderPicker({ preset: "custom", onCustomApply, customError: "The date range may cover at most 366 days" });

		const error = screen.getByRole("alert");
		expect(error.textContent).toBe("The date range may cover at most 366 days");
		const trigger = screen.getByRole("button", { name: DAYS_TRIGGER_NAME });
		expect(trigger.getAttribute("aria-describedby")).toBe(error.id);
		expect(trigger.getAttribute("aria-invalid")).toBe("true");
		expect(screen.getByRole<HTMLButtonElement>("button", { name: LABELS.apply }).disabled).toBe(true);

		const form = trigger.closest("form");
		if (form === null) throw new Error("the custom days are not in a form");
		fireEvent.submit(form);
		expect(onCustomApply).not.toHaveBeenCalled();
	});

	it("opens the calendar from the parent when calendarOpen is controlled", async (): Promise<void> => {
		renderPicker({ preset: "custom", calendarOpen: true });

		expect(await screen.findByRole("grid")).toBeTruthy();
	});

	it("reports open requests through onCalendarOpenChange and stays closed until the parent opens it", (): void => {
		const onCalendarOpenChange = vi.fn<(open: boolean) => void>();
		renderPicker({ preset: "custom", calendarOpen: false, onCalendarOpenChange });

		fireEvent.click(screen.getByRole("button", { name: DAYS_TRIGGER_NAME }));

		expect(onCalendarOpenChange).toHaveBeenCalledWith(true);
		expect(screen.queryByRole("grid")).toBeNull();
	});

	it("asks the parent to close the calendar after a successful Apply", (): void => {
		const onCalendarOpenChange = vi.fn<(open: boolean) => void>();
		renderPicker({ preset: "custom", calendarOpen: true, onCalendarOpenChange });

		fireEvent.click(screen.getByRole("button", { name: LABELS.apply }));

		expect(onCalendarOpenChange).toHaveBeenLastCalledWith(false);
	});

	it("forwards its ref to the root", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		renderPicker({ ref, "aria-label": "Filters" });

		expect(ref.current?.getAttribute("aria-label")).toBe("Filters");
	});
});
