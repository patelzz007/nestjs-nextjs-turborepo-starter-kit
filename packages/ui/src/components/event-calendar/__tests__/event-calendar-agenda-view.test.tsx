// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EventCalendarAgendaView } from "../event-calendar-agenda-view";
import { CalendarHarness, ResizeObserverStub } from "@workspace/ui/testing/event-calendar-test-harness";
import type { EventCalendarOccurrence } from "../event-calendar-types";

beforeEach((): void => {
	vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

function renderDetails(occurrence: EventCalendarOccurrence): React.ReactNode {
	return occurrence.eventId === "standup" ? <p>Daily sync notes</p> : null;
}

function renderEmpty(): React.ReactNode {
	return <p>Nothing planned</p>;
}

describe("EventCalendarAgendaView", () => {
	it("groups events per day under headings with per-day time text", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(
			<CalendarHarness view="agenda">
				<EventCalendarAgendaView ref={ref} className="custom-agenda" />
			</CalendarHarness>,
		);
		const region = screen.getByRole("group", { name: "Mar 15 – Apr 13" });
		expect(region).toBe(ref.current);
		expect(region.className.split(" ").at(-1)).toBe("custom-agenda");
		expect(screen.getAllByRole("heading", { level: 3 }).map((heading: HTMLElement): string => heading.textContent)).toEqual([
			"MondayMarch 16, 2026",
			"TuesdayMarch 17, 2026",
			"WednesdayMarch 18, 2026",
			"ThursdayMarch 19, 2026",
		]);
		const monday = screen.getByRole("group", { name: "Monday, March 16, 2026, 2 events" });
		expect(within(monday).getByRole("button", { name: /^Standup/ }).textContent).toContain("9:00 AM – 9:30 AM");
		expect(within(screen.getByRole("group", { name: /^Wednesday/ })).getByRole("button", { name: /^Offsite/ }).textContent).toContain("All day");
	});

	it("never selects rows and moves focus between them with the arrow keys", (): void => {
		render(
			<CalendarHarness view="agenda">
				<EventCalendarAgendaView />
			</CalendarHarness>,
		);
		const standup = screen.getByRole("button", { name: /^Standup/ });
		expect(standup.getAttribute("aria-pressed")).toBeNull();
		act((): void => {
			standup.focus();
		});
		fireEvent.keyDown(standup, { key: "ArrowDown" });
		expect(document.activeElement).toBe(screen.getByRole("button", { name: /^Design review/ }));
		fireEvent.keyDown(document.activeElement ?? standup, { key: "End" });
		expect(document.activeElement).toBe(screen.getAllByRole("button", { name: /^Offsite/ }).at(-1));
		fireEvent.keyDown(document.activeElement ?? standup, { key: "Home" });
		expect(document.activeElement).toBe(standup);
	});

	it("adds a details disclosure when renderAgendaEventDetails returns content", (): void => {
		render(
			<CalendarHarness view="agenda" renderAgendaEventDetails={renderDetails}>
				<EventCalendarAgendaView />
			</CalendarHarness>,
		);
		const toggle = screen.getByRole("button", { name: "Standup details" });
		expect(toggle.getAttribute("aria-expanded")).toBe("false");
		expect(screen.queryByText("Daily sync notes")).toBeNull();
		fireEvent.click(toggle);
		expect(toggle.getAttribute("aria-expanded")).toBe("true");
		expect(screen.getByText("Daily sync notes")).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Design review details" })).toBeNull();
	});

	it("renders the empty state, or the consumer's", (): void => {
		const { unmount } = render(
			<CalendarHarness view="agenda" events={[]}>
				<EventCalendarAgendaView />
			</CalendarHarness>,
		);
		expect(screen.getByText("No events")).toBeTruthy();
		unmount();
		render(
			<CalendarHarness view="agenda" events={[]} renderNoEvents={renderEmpty}>
				<EventCalendarAgendaView />
			</CalendarHarness>,
		);
		expect(screen.getByText("Nothing planned")).toBeTruthy();
	});
});
