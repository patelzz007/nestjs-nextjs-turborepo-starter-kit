// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useEventCalendarView } from "../event-calendar";
import { DEFAULT_VIEW_COMPONENTS, EventCalendarContent } from "../event-calendar-content";
import { EventCalendarMonthView } from "../event-calendar-month-view";
import { CalendarHarness, ResizeObserverStub } from "@workspace/ui/testing/event-calendar-test-harness";
import type { CalendarView } from "../event-calendar-types";

beforeEach((): void => {
	vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

function CustomMonth(): React.JSX.Element {
	return <p>Custom month</p>;
}

const CUSTOM_COMPONENTS: Partial<Record<CalendarView, React.ComponentType>> = { month: CustomMonth };

function ViewName(): React.JSX.Element {
	return <p>{useEventCalendarView().viewName}</p>;
}

const VIEW_SLOTS: Readonly<Record<CalendarView, string>> = {
	month: "event-calendar-month-view",
	week: "event-calendar-time-grid",
	day: "event-calendar-time-grid",
	days: "event-calendar-time-grid",
	agenda: "event-calendar-agenda-view",
	resource: "event-calendar-resource-view",
};

describe("EventCalendarContent", () => {
	it("maps every view to its default component", (): void => {
		expect(DEFAULT_VIEW_COMPONENTS.month).toBe(EventCalendarMonthView);
		for (const view of ["month", "week", "day", "days", "agenda", "resource"] satisfies CalendarView[]) {
			const { unmount } = render(
				<CalendarHarness view={view} resources={[{ id: "r", title: "Room" }]}>
					<EventCalendarContent />
				</CalendarHarness>,
			);
			expect(document.querySelector(`[data-slot=${VIEW_SLOTS[view]}]`)?.getAttribute("data-view")).toBe(view);
			unmount();
		}
	});

	it("forwards its ref, merges className last and swaps views through components", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(
			<CalendarHarness>
				<EventCalendarContent ref={ref} className="custom-content" components={CUSTOM_COMPONENTS} />
			</CalendarHarness>,
		);
		expect(ref.current?.dataset.view).toBe("month");
		expect(ref.current?.className.split(" ").at(-1)).toBe("custom-content");
		expect(screen.getByText("Custom month")).toBeTruthy();
	});

	it("accepts the root components prop and replaces the switchboard with children", (): void => {
		const { unmount } = render(
			<CalendarHarness components={CUSTOM_COMPONENTS}>
				<EventCalendarContent />
			</CalendarHarness>,
		);
		expect(screen.getByText("Custom month")).toBeTruthy();
		unmount();
		render(
			<CalendarHarness>
				<EventCalendarContent>
					<ViewName />
				</EventCalendarContent>
			</CalendarHarness>,
		);
		expect(screen.getByText("Month")).toBeTruthy();
	});

	it("marks the loading state for assistive technology", (): void => {
		render(
			<CalendarHarness loading>
				<EventCalendarContent />
			</CalendarHarness>,
		);
		const content = document.querySelector<HTMLElement>("[data-slot=event-calendar-content]");
		expect(content?.getAttribute("aria-busy")).toBe("true");
		expect(content?.className).toContain("opacity-60");
		expect(screen.getByText("Loading events")).toBeTruthy();
	});

	it("applies per-usage i18n overrides over the label pack", (): void => {
		render(
			<CalendarHarness view="agenda" events={[]} i18n={{ labels: { noEvents: "Nada" } }}>
				<EventCalendarContent />
			</CalendarHarness>,
		);
		expect(screen.getByText("Nada")).toBeTruthy();
	});
});
