// @vitest-environment jsdom
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import * as React from "react";
import { stubResizeObserverForCalendarDropdowns } from "@workspace/ui/testing/calendar-dropdowns";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DateSelector, type DateSelectorLabels, type DateSelectorValue } from "../date-selector";

function noop(): void {
	return;
}

beforeEach((): void => {
	stubResizeObserverForCalendarDropdowns();
	// jsdom has no matchMedia; the selector reads the mobile media query through it (desktop: two months).
	vi.stubGlobal("matchMedia", (query: string): Pick<MediaQueryList, "matches" | "media" | "addEventListener" | "removeEventListener"> => ({
		matches: false,
		media: query,
		addEventListener: noop,
		removeEventListener: noop,
	}));
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

const MARCH_14: DateSelectorValue = { period: "day", operator: "is", startDate: new Date(2026, 2, 14) };

function dayButton(container: HTMLElement, date: Date): HTMLButtonElement {
	const button = container.querySelector<HTMLButtonElement>(`button[data-day="${date.toLocaleDateString()}"]`);
	if (button === null) {
		throw new Error(`No day button for ${date.toDateString()}`);
	}
	return button;
}

function lastCallValue(onChange: ReturnType<typeof vi.fn<(value: DateSelectorValue) => void>>): DateSelectorValue | undefined {
	return onChange.mock.calls.at(-1)?.[LIST_SLOT_INDEX.first];
}

function selectTab(name: string): void {
	act((): void => {
		fireEvent.click(screen.getByRole("tab", { name }));
	});
}

describe("DateSelector", () => {
	it("renders a named group, forwards its ref to the root and merges className last", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(<DateSelector ref={ref} className="w-full sm:w-80" defaultValue={MARCH_14} />, { wrapper: UiKitTestProviders });
		const group = screen.getByRole("group", { name: "Select date" });
		expect(ref.current).toBe(group);
		expect(group.dataset.slot).toBe("date-selector");
		expect(group.className).toContain("sm:w-80");
		expect(group.className).not.toContain("sm:w-120");
	});

	it("names the group after its label heading", (): void => {
		render(<DateSelector label="Created" defaultValue={MARCH_14} />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("group", { name: "Created" })).toBeTruthy();
		expect(screen.getByRole("heading", { name: "Created" })).toBeTruthy();
	});

	it("shows the uncontrolled value and picks a day", (): void => {
		const onChange = vi.fn<(value: DateSelectorValue) => void>();
		const { container } = render(<DateSelector defaultValue={MARCH_14} onChange={onChange} />, { wrapper: UiKitTestProviders });
		const input = screen.getByRole<HTMLInputElement>("textbox", { name: "Select date" });
		expect(input.value).toBe("03/14/2026");
		expect(onChange).not.toHaveBeenCalled();

		fireEvent.click(dayButton(container, new Date(2026, 2, 20)));
		expect(lastCallValue(onChange)?.startDate).toStrictEqual(new Date(2026, 2, 20));
		expect(input.value).toBe("03/20/2026");
	});

	it("stays on the controlled value until the parent changes it", (): void => {
		const onChange = vi.fn<(value: DateSelectorValue) => void>();
		const { container, rerender } = render(<DateSelector value={MARCH_14} onChange={onChange} />, { wrapper: UiKitTestProviders });
		fireEvent.click(dayButton(container, new Date(2026, 2, 21)));
		const picked = lastCallValue(onChange);
		expect(picked?.startDate).toStrictEqual(new Date(2026, 2, 21));
		expect(screen.getByRole<HTMLInputElement>("textbox").value).toBe("03/14/2026");

		if (picked !== undefined) {
			rerender(<DateSelector value={picked} onChange={onChange} />);
		}
		expect(screen.getByRole<HTMLInputElement>("textbox").value).toBe("03/21/2026");
	});

	it("builds a day range with the between filter, swapping ends picked backwards", (): void => {
		const onChange = vi.fn<(value: DateSelectorValue) => void>();
		const { container } = render(<DateSelector defaultValue={{ period: "day", operator: "between", startDate: new Date(2026, 2, 10) }} onChange={onChange} />, {
			wrapper: UiKitTestProviders,
		});
		fireEvent.click(dayButton(container, new Date(2026, 2, 5)));
		expect(lastCallValue(onChange)).toMatchObject({ operator: "between", startDate: new Date(2026, 2, 5), endDate: new Date(2026, 2, 10) });
		expect(screen.getByRole<HTMLInputElement>("textbox").value).toBe("03/05/2026 - 03/10/2026");
	});

	it("switching the filter clears the selection but keeps the period", (): void => {
		const onChange = vi.fn<(value: DateSelectorValue) => void>();
		render(<DateSelector defaultValue={MARCH_14} onChange={onChange} />, { wrapper: UiKitTestProviders });
		selectTab("before");
		expect(lastCallValue(onChange)).toStrictEqual({ period: "day", operator: "before" });
	});

	it("hides the between filter when ranges are not allowed, and locks the filter with presetMode", (): void => {
		const { rerender } = render(<DateSelector allowRange={false} defaultValue={MARCH_14} />, { wrapper: UiKitTestProviders });
		expect(screen.queryByRole("tab", { name: "between" })).toBeNull();

		rerender(<DateSelector presetMode="after" defaultValue={MARCH_14} />);
		const filters = within(screen.getByRole("tablist", { name: "Filter" }));
		expect(filters.getByRole("tab", { name: "after" }).getAttribute("aria-selected")).toBe("true");
		expect(filters.getByRole("tab", { name: "is" }).hasAttribute("disabled") || filters.getByRole("tab", { name: "is" }).getAttribute("aria-disabled") === "true").toBe(true);
	});

	it("picks a month, a quarter and a year from the period grids", (): void => {
		const onChange = vi.fn<(value: DateSelectorValue) => void>();
		render(<DateSelector minYear={2024} maxYear={2025} defaultValue={MARCH_14} onChange={onChange} />, { wrapper: UiKitTestProviders });

		selectTab("Month");
		const year2025 = within(screen.getByRole("group", { name: "2025" }));
		fireEvent.click(year2025.getByRole("button", { name: "Apr" }));
		expect(lastCallValue(onChange)).toMatchObject({ period: "month", year: 2025, month: 3 });
		expect(year2025.getByRole("button", { name: "Apr" }).getAttribute("aria-pressed")).toBe("true");
		expect(screen.getByRole<HTMLInputElement>("textbox").value).toBe("Apr 2025");

		selectTab("Quarter");
		fireEvent.click(within(screen.getByRole("group", { name: "2024" })).getByRole("button", { name: "Q2" }));
		expect(lastCallValue(onChange)).toMatchObject({ period: "quarter", year: 2024, quarter: 1 });

		selectTab("Year");
		expect(screen.getAllByRole("button", { name: /^20\d\d$/u }).map((button: HTMLElement): string => button.textContent)).toStrictEqual(["2024", "2025"]);
		fireEvent.click(screen.getByRole("button", { name: "2025" }));
		expect(screen.getByRole<HTMLInputElement>("textbox").value).toBe("2025");
	});

	it("builds a period range across years", (): void => {
		const onChange = vi.fn<(value: DateSelectorValue) => void>();
		render(<DateSelector minYear={2024} maxYear={2025} defaultValue={{ period: "half-year", operator: "between" }} onChange={onChange} />, { wrapper: UiKitTestProviders });
		fireEvent.click(within(screen.getByRole("group", { name: "2025" })).getByRole("button", { name: "H1" }));
		fireEvent.click(within(screen.getByRole("group", { name: "2024" })).getByRole("button", { name: "H2" }));
		expect(lastCallValue(onChange)).toMatchObject({ rangeStart: { year: 2024, value: 1 }, rangeEnd: { year: 2025, value: 0 } });
		expect(screen.getByRole<HTMLInputElement>("textbox").value).toBe("H2 2024 - H1 2025");
	});

	it("offers only the requested period tabs", (): void => {
		render(<DateSelector periodTypes={["month", "year"]} defaultPeriodType="day" />, { wrapper: UiKitTestProviders });
		const periods = within(screen.getByRole("tablist", { name: "Period" }));
		expect(periods.getAllByRole("tab").map((tab: HTMLElement): string => tab.textContent)).toStrictEqual(["Month", "Year"]);
		expect(periods.getByRole("tab", { name: "Month" }).getAttribute("aria-selected")).toBe("true");
	});

	it("clears the selection from the clear button", (): void => {
		const onChange = vi.fn<(value: DateSelectorValue) => void>();
		render(<DateSelector defaultValue={MARCH_14} onChange={onChange} />, { wrapper: UiKitTestProviders });
		fireEvent.click(screen.getByRole("button", { name: "Clear" }));
		expect(lastCallValue(onChange)).toStrictEqual({ period: "day", operator: "is" });
		expect(screen.getByRole<HTMLInputElement>("textbox").value).toBe("");
		expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
	});

	it("is read-only without an input hint, and parses typed values with one", (): void => {
		const onChange = vi.fn<(value: DateSelectorValue) => void>();
		const { rerender } = render(<DateSelector defaultValue={MARCH_14} onChange={onChange} />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole<HTMLInputElement>("textbox").readOnly).toBe(true);

		rerender(<DateSelector inputHint="MM/DD/YYYY, Q1 2025 or 2025" defaultValue={MARCH_14} onChange={onChange} />);
		const input = screen.getByRole<HTMLInputElement>("textbox");
		fireEvent.focus(input);
		expect(input.placeholder).toBe("MM/DD/YYYY, Q1 2025 or 2025");
		fireEvent.change(input, { target: { value: "Q2 2025" } });
		expect(lastCallValue(onChange)).toMatchObject({ period: "quarter", year: 2025, quarter: 1 });

		fireEvent.change(input, { target: { value: "not a date" } });
		expect(input.value).toBe("not a date");
		fireEvent.blur(input);
		expect(input.value).toBe("Q2 2025");
	});

	it("disables and marks busy through the state axis", (): void => {
		const { rerender } = render(<DateSelector disabled defaultValue={MARCH_14} />, { wrapper: UiKitTestProviders });
		const group = screen.getByRole("group", { name: "Select date" });
		expect(group.hasAttribute("inert")).toBe(true);
		expect(group.getAttribute("aria-disabled")).toBe("true");
		expect(group.className).toContain("opacity-50");

		rerender(<DateSelector loading defaultValue={MARCH_14} />);
		expect(group.getAttribute("aria-busy")).toBe("true");
		expect(group.className).toContain("cursor-wait");

		rerender(<DateSelector aria-invalid defaultValue={MARCH_14} />);
		expect(group.hasAttribute("inert")).toBe(false);
		expect(screen.getByRole("textbox").getAttribute("aria-invalid")).toBe("true");
	});

	it("passes onFocus and onBlur through from the root", (): void => {
		const onFocus = vi.fn<() => void>();
		const onBlur = vi.fn<() => void>();
		render(<DateSelector onFocus={onFocus} onBlur={onBlur} defaultValue={MARCH_14} />, { wrapper: UiKitTestProviders });
		const input = screen.getByRole("textbox");
		fireEvent.focus(input);
		fireEvent.blur(input);
		expect(onFocus).toHaveBeenCalledTimes(1);
		expect(onBlur).toHaveBeenCalledTimes(1);
	});

	it("moves the month with its navigation buttons and lays its own copy over the kit labels", (): void => {
		const i18n: Partial<DateSelectorLabels> = {
			nextMonth: "Mois suivant",
			months: ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"],
		};
		render(<DateSelector i18n={i18n} showTwoMonths={false} defaultValue={MARCH_14} />, { wrapper: UiKitTestProviders });
		expect(screen.getByText("Mars 2026")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Mois suivant" }));
		expect(screen.getByText("Avril 2026")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
		expect(screen.getByText("Mars 2026")).toBeTruthy();
	});
});
