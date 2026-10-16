// @vitest-environment jsdom
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EventCalendarDatePicker, EventCalendarNav, EventCalendarNavNext, EventCalendarTitle, EventCalendarToolbar } from "../event-calendar-nav";
import { CalendarHarness, ResizeObserverStub } from "@workspace/ui/testing/event-calendar-test-harness";
import type { CalendarView } from "../event-calendar-types";

beforeEach((): void => {
	vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

function wrapTitle({ title }: { readonly title: string }): React.ReactNode {
	return <strong>{title}!</strong>;
}

describe("EventCalendarNav", () => {
	it("composes Today, the view switcher, prev/next and the title", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(
			<CalendarHarness>
				<EventCalendarNav ref={ref} className="custom-nav" />
			</CalendarHarness>,
		);
		expect(ref.current?.dataset.slot).toBe("event-calendar-nav");
		expect(ref.current?.className.split(" ").at(-1)).toBe("custom-nav");
		expect(screen.getByRole("button", { name: "Today" }).dataset.active).toBe("");
		expect(screen.getByRole("button", { name: "Previous" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Select view" }).textContent).toBe("Month");
		expect(screen.getByText("March 2026").getAttribute("aria-live")).toBe("polite");
	});

	it("navigates with prev, next and today", (): void => {
		const onDateChange = vi.fn<(date: Date) => void>();
		render(
			<CalendarHarness onDateChange={onDateChange} date={new Date("2026-05-10T00:00:00Z")}>
				<EventCalendarNav />
			</CalendarHarness>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Next" }));
		expect(screen.getByText("June 2026")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Previous" }));
		fireEvent.click(screen.getByRole("button", { name: "Previous" }));
		expect(screen.getByText("April 2026")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Today" }));
		expect(onDateChange.mock.calls.at(-1)?.[LIST_SLOT_INDEX.first]?.toISOString()).toBe("2026-03-15T10:00:00.000Z");
		expect(screen.getByText("March 2026")).toBeTruthy();
	});

	it("switches views and N-day presets from the view switcher", (): void => {
		const onViewChange = vi.fn<(view: CalendarView) => void>();
		const onDayCountChange = vi.fn<(count: number) => void>();
		render(
			<CalendarHarness onViewChange={onViewChange} onDayCountChange={onDayCountChange} dayCountPresets={[4, 7]}>
				<EventCalendarNav />
			</CalendarHarness>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Select view" }));
		fireEvent.click(screen.getByRole("menuitem", { name: /^Week/ }));
		expect(onViewChange).toHaveBeenLastCalledWith("week");
		expect(screen.getByText("March 15 – 21, 2026")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Select view" }));
		fireEvent.click(screen.getByRole("menuitem", { name: /^4 days/ }));
		expect(onDayCountChange).toHaveBeenLastCalledWith(4);
		expect(onViewChange).toHaveBeenLastCalledWith("days");
		expect(screen.getByRole("button", { name: "Select view" }).textContent).toBe("4 days");
	});

	it("hides the switcher on request and lays out custom children", (): void => {
		render(
			<CalendarHarness>
				<EventCalendarNav showViewSwitcher={false} />
				<EventCalendarNav>
					<EventCalendarTitle format={wrapTitle} />
					<EventCalendarNavNext>later</EventCalendarNavNext>
				</EventCalendarNav>
				<EventCalendarToolbar>
					<span>tools</span>
				</EventCalendarToolbar>
			</CalendarHarness>,
		);
		expect(screen.queryByRole("button", { name: "Select view" })).toBeNull();
		expect(screen.getByText("March 2026!")).toBeTruthy();
		expect(screen.getAllByRole("button", { name: "Next" }).map((button: HTMLElement): string => button.textContent)).toContain("later");
		expect(screen.getByText("tools").parentElement?.dataset.slot).toBe("event-calendar-toolbar");
	});

	it("jumps to a picked date", (): void => {
		const onDateChange = vi.fn<(date: Date) => void>();
		render(
			<CalendarHarness onDateChange={onDateChange}>
				<EventCalendarDatePicker />
			</CalendarHarness>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Go to date" }));
		const [day] = screen.getAllByRole("button", { name: /March 20th, 2026/ });
		if (day !== undefined) {
			fireEvent.click(day);
		}
		expect(onDateChange.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.first]?.getUTCDate()).toBe(20);
	});
});
