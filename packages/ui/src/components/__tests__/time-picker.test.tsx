// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { stubResizeObserverForCalendarDropdowns } from "@workspace/ui/testing/calendar-dropdowns";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	DEFAULT_TIME_PICKER_FUNCTIONS,
	mergeTimePickerI18n,
	TimePicker,
	TimePickerInput,
	TimePickerPanel,
	useTimePicker,
	type TimePickerApi,
	type TimePickerLabels,
} from "../time-picker";

beforeEach((): void => {
	stubResizeObserverForCalendarDropdowns();
});

afterEach((): void => {
	cleanup();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

function renderWithLabels(ui: React.ReactElement): ReturnType<typeof render> {
	return render(ui, { wrapper: UiKitTestProviders });
}

function openTrigger(name: RegExp): void {
	act((): void => {
		fireEvent.click(screen.getByRole("button", { name }));
	});
}

function pressKey(element: HTMLElement, key: string): void {
	act((): void => {
		fireEvent.keyDown(element, { key });
	});
}

describe("TimePicker", () => {
	it("renders a trigger named by its placeholder, forwards its ref there and merges className", (): void => {
		const ref = React.createRef<HTMLElement>();
		renderWithLabels(<TimePicker ref={ref} className="custom-trigger" />);
		const trigger = screen.getByRole("button", { name: "Select time" });
		expect(ref.current).toBe(trigger);
		expect(trigger.dataset.slot).toBe("time-picker-trigger");
		expect(trigger.className).toContain("custom-trigger");
		expect(trigger.className).toContain("justify-between");
	});

	it("shows a controlled value in 24-hour and 12-hour time", (): void => {
		const { rerender } = renderWithLabels(<TimePicker value="14:30" />);
		expect(screen.getByRole("button").textContent).toContain("14:30");
		rerender(<TimePicker value="14:30" hourCycle={12} />);
		expect(screen.getByRole("button").textContent).toContain("02:30 PM");
		rerender(<TimePicker value="14:30" hourCycle={12} periodPosition="start" />);
		expect(screen.getByRole("button").textContent).toContain("PM 02:30");
	});

	it("opens the popover with one listbox per unit and emits a picked time", (): void => {
		const onValueChange = vi.fn<(value: string | null) => void>();
		renderWithLabels(<TimePicker onValueChange={onValueChange} />);
		openTrigger(/select time/iu);
		expect(screen.getByRole("dialog", { name: "Choose time" })).toBeTruthy();
		const hours = screen.getByRole("listbox", { name: "Hour" });
		expect(screen.getByRole("listbox", { name: "Minute" })).toBeTruthy();
		expect(screen.queryByRole("listbox", { name: "Second" })).toBeNull();
		act((): void => {
			fireEvent.click(screen.getAllByRole("option", { name: "09" }).at(0) ?? hours);
		});
		expect(onValueChange).toHaveBeenLastCalledWith("09:00");
	});

	it("keeps uncontrolled state and closes on OK", (): void => {
		const onOpenChange = vi.fn<(open: boolean) => void>();
		renderWithLabels(<TimePicker defaultValue="08:15" onOpenChange={onOpenChange} />);
		openTrigger(/08:15/u);
		pressKey(screen.getByRole("listbox", { name: "Hour" }), "ArrowDown");
		expect(screen.getByRole("button", { name: /09:15/u })).toBeTruthy();
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "OK" }));
		});
		expect(onOpenChange).toHaveBeenLastCalledWith(false);
	});

	it("holds picks as a draft under requireConfirm until OK", (): void => {
		const onValueChange = vi.fn<(value: string | null) => void>();
		renderWithLabels(<TimePicker defaultValue="10:00" requireConfirm onValueChange={onValueChange} />);
		openTrigger(/10:00/u);
		pressKey(screen.getByRole("listbox", { name: "Hour" }), "ArrowDown");
		expect(onValueChange).not.toHaveBeenCalled();
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "OK" }));
		});
		expect(onValueChange).toHaveBeenCalledWith("11:00");
	});

	it("disables the trigger and reflects the disabled and error states", (): void => {
		const { rerender } = renderWithLabels(<TimePicker disabled />);
		const trigger = screen.getByRole("button");
		expect(trigger.hasAttribute("disabled")).toBe(true);
		expect(trigger.className).toContain("cursor-not-allowed");
		rerender(<TimePicker invalid />);
		expect(screen.getByRole("button").getAttribute("aria-invalid")).toBe("true");
		expect(screen.getByRole("button").className).toContain("border-destructive");
	});

	it("submits the value through a hidden field and takes label overrides", (): void => {
		const { container } = renderWithLabels(<TimePicker name="startsAt" value="07:45" i18n={{ labels: { placeholder: "Pick a start" } }} />);
		const field = container.querySelector<HTMLInputElement>('input[name="startsAt"]');
		expect(field?.value).toBe("07:45");
		cleanup();
		renderWithLabels(<TimePicker i18n={{ labels: { placeholder: "Pick a start" } }} />);
		expect(screen.getByRole("button", { name: "Pick a start" })).toBeTruthy();
	});

	it("fires onFocus and onBlur from the default trigger", (): void => {
		const onFocus = vi.fn<() => void>();
		const onBlur = vi.fn<() => void>();
		renderWithLabels(<TimePicker onFocus={onFocus} onBlur={onBlur} />);
		const trigger = screen.getByRole("button");
		fireEvent.focus(trigger);
		fireEvent.blur(trigger);
		expect(onFocus).toHaveBeenCalledTimes(1);
		expect(onBlur).toHaveBeenCalledTimes(1);
	});
});

describe("TimePickerInput", () => {
	it("reads typed text on blur, snapping it to the steps", (): void => {
		const onValueChange = vi.fn<(value: string | null) => void>();
		const ref = React.createRef<HTMLInputElement>();
		renderWithLabels(
			<TimePicker minuteStep={15} onValueChange={onValueChange} aria-label="Start">
				<TimePickerInput ref={ref} className="custom-input" />
			</TimePicker>,
		);
		const input = screen.getByRole("textbox", { name: "Start" });
		expect(ref.current).toBe(input);
		expect(input.closest('[data-slot="time-picker-input"]')?.className).toContain("custom-input");
		fireEvent.change(input, { target: { value: "938" } });
		fireEvent.blur(input);
		expect(onValueChange).toHaveBeenLastCalledWith("09:45");
	});

	it("steps with the arrow keys and clears on empty text", (): void => {
		const onValueChange = vi.fn<(value: string | null) => void>();
		renderWithLabels(
			<TimePicker defaultValue="09:00" minuteStep={30} onValueChange={onValueChange} aria-label="Start">
				<TimePickerInput />
			</TimePicker>,
		);
		const input = screen.getByRole("textbox", { name: "Start" });
		pressKey(input, "ArrowUp");
		expect(onValueChange).toHaveBeenLastCalledWith("09:30");
		fireEvent.change(input, { target: { value: "" } });
		fireEvent.blur(input);
		expect(onValueChange).toHaveBeenLastCalledWith(null);
	});

	it("names its clock button from the labels", (): void => {
		renderWithLabels(
			<TimePicker aria-label="Start">
				<TimePickerInput />
			</TimePicker>,
		);
		expect(screen.getByRole("button", { name: "Open time picker" })).toBeTruthy();
	});
});

describe("TimePickerPanel", () => {
	it("renders inline as a named group whose bounds disable rows", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		renderWithLabels(
			<TimePicker granularity="hour" min="09:00" max="17:00">
				<TimePickerPanel ref={ref} className="custom-panel" />
			</TimePicker>,
		);
		const panel = screen.getByRole("group", { name: "Choose time" });
		expect(ref.current).toBe(panel);
		expect(panel.className).toContain("custom-panel");
		expect(screen.getByRole("option", { name: "08" }).getAttribute("aria-disabled")).toBe("true");
		expect(screen.getByRole("option", { name: "09" }).getAttribute("aria-disabled")).toBeNull();
	});

	it("moves with Home and End and types two digits as one hour", (): void => {
		const onValueChange = vi.fn<(value: string | null) => void>();
		renderWithLabels(
			<TimePicker granularity="hour" onValueChange={onValueChange}>
				<TimePickerPanel />
			</TimePicker>,
		);
		const hours = screen.getByRole("listbox", { name: "Hour" });
		pressKey(hours, "End");
		expect(onValueChange).toHaveBeenLastCalledWith("23:00");
		pressKey(hours, "Home");
		expect(onValueChange).toHaveBeenLastCalledWith("00:00");
		act((): void => {
			fireEvent.keyDown(hours, { key: "1", timeStamp: 10 });
			fireEvent.keyDown(hours, { key: "4", timeStamp: 20 });
		});
		expect(onValueChange).toHaveBeenLastCalledWith("14:00");
	});

	it("sets the current time with Now and empties it with Clear", (): void => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date(2026, 9, 16, 14, 38, 0));
		const onValueChange = vi.fn<(value: string | null) => void>();
		renderWithLabels(
			<TimePicker defaultValue="10:00" minuteStep={15} onValueChange={onValueChange}>
				<TimePickerPanel />
			</TimePicker>,
		);
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Now" }));
		});
		expect(onValueChange).toHaveBeenLastCalledWith("14:30");
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Clear" }));
		});
		expect(onValueChange).toHaveBeenLastCalledWith(null);
	});

	it("disables the panel's actions while disabled", (): void => {
		renderWithLabels(
			<TimePicker disabled>
				<TimePickerPanel />
			</TimePicker>,
		);
		expect(screen.getByRole("group").className).toContain("opacity-50");
		expect(screen.getByRole("button", { name: "Now" }).hasAttribute("disabled")).toBe(true);
	});
});

describe("useTimePicker", () => {
	it("exposes the value and actions inside a TimePicker", (): void => {
		const api: { current: TimePickerApi | null } = { current: null };
		function Probe(): null {
			api.current = useTimePicker();
			return null;
		}
		const onValueChange = vi.fn<(value: string | null) => void>();
		renderWithLabels(
			<TimePicker defaultValue="06:00" onValueChange={onValueChange}>
				<Probe />
			</TimePicker>,
		);
		expect(api.current?.value).toBe("06:00");
		act((): void => {
			api.current?.setValue("07:05");
		});
		expect(onValueChange).toHaveBeenLastCalledWith("07:05");
		expect(api.current?.value).toBe("07:05");
	});

	it("throws outside a TimePicker", (): void => {
		function Orphan(): null {
			useTimePicker();
			return null;
		}
		vi.spyOn(console, "error").mockImplementation((): void => undefined);
		expect((): void => {
			render(<Orphan />);
		}).toThrow("useTimePicker must be used within a TimePicker");
	});
});

describe("mergeTimePickerI18n", () => {
	const labels: TimePickerLabels = {
		placeholder: "Select time",
		hour: "Hour",
		minute: "Minute",
		second: "Second",
		period: "AM/PM",
		am: "AM",
		pm: "PM",
		now: "Now",
		clear: "Clear",
		confirm: "OK",
		panelLabel: "Choose time",
		openPicker: "Open time picker",
	};
	const base = { labels, functions: DEFAULT_TIME_PICKER_FUNCTIONS };

	it("returns the base untouched without overrides and merges one key per section", (): void => {
		expect(mergeTimePickerI18n(base)).toBe(base);
		const merged = mergeTimePickerI18n(base, { labels: { now: "Maintenant" } });
		expect(merged.labels.now).toBe("Maintenant");
		expect(merged.labels.clear).toBe("Clear");
		expect(merged.functions.formatSegment(5, "minute")).toBe("05");
	});

	it("formats with an overridden segment formatter", (): void => {
		const merged = mergeTimePickerI18n(base, { functions: { formatSegment: (value: number): string => `[${String(value)}]` } });
		const text = merged.functions.formatValue(
			{ hour: 9, minute: 5, second: 0 },
			{ hourCycle: 24, granularity: "minute", periodPosition: "end", labels, formatSegment: merged.functions.formatSegment },
		);
		expect(text).toBe("[9]:[5]");
	});
});
