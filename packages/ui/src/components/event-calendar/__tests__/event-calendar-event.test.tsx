// @vitest-environment jsdom
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EventCalendarViewContext, useEventCalendar, type EventCalendarRenderEventProps, type EventCalendarViewContextValue } from "../event-calendar";
import {
	EVENT_CALENDAR_COLORS,
	EVENT_CALENDAR_TONE_COLORS,
	EventCalendarEvent,
	eventCalendarEventVariants,
	getEventToneStyle,
	useEventCalendarEventChip,
} from "../event-calendar-event";
import { CalendarHarness, ResizeObserverStub, type TestEventData } from "@workspace/ui/testing/event-calendar-test-harness";
import type { EventCalendarOccurrence, EventCalendarSegment } from "../event-calendar-types";

const MONTH_CONTEXT: EventCalendarViewContextValue = { view: "month" };

beforeEach((): void => {
	vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

/** Renders the chip of the first segment of `eventId` on 16 March. */
function FirstChip({
	eventId,
	preview = false,
	chipRef,
}: {
	readonly eventId: string;
	readonly preview?: boolean;
	readonly chipRef?: React.Ref<HTMLButtonElement>;
}): React.JSX.Element | null {
	const { index } = useEventCalendar();
	const segment = [...(index.byDay.get("2026-03-16")?.timed ?? []), ...(index.byDay.get("2026-03-18")?.allDay ?? [])].find(
		(candidate: EventCalendarSegment): boolean => candidate.occurrence.eventId === eventId,
	);
	if (segment === undefined) {
		return null;
	}
	return (
		<EventCalendarViewContext.Provider value={MONTH_CONTEXT}>
			<EventCalendarEvent ref={chipRef} segment={segment} preview={preview} className="custom-chip" />
		</EventCalendarViewContext.Provider>
	);
}

function renderOwner(props: EventCalendarRenderEventProps<TestEventData>): React.ReactNode {
	return <span>owner:{props.occurrence.event.data?.owner}</span>;
}

function ChipProbe(): React.JSX.Element {
	const { occurrence } = useEventCalendarEventChip();
	return <span>probe:{occurrence.eventId}</span>;
}

describe("EventCalendarEvent", () => {
	it("is a named toggle button with tone, data attributes, className last and a forwarded ref", (): void => {
		const ref = React.createRef<HTMLButtonElement>();
		render(
			<CalendarHarness>
				<FirstChip eventId="standup" chipRef={ref} />
			</CalendarHarness>,
		);
		const chip = screen.getByRole("button", { name: "Standup, 9:00 AM – 9:30 AM" });
		expect(chip).toBe(ref.current);
		expect(chip.getAttribute("title")).toBe("Standup, 9:00 AM – 9:30 AM");
		expect(chip.getAttribute("aria-pressed")).toBe("false");
		expect(chip.dataset.variant).toBe("chip");
		expect(chip.className.split(" ").at(-1)).toBe("custom-chip");
		expect(chip.getAttribute("style")).toContain(EVENT_CALENDAR_TONE_COLORS.blue);
	});

	it("names continuing slices and marks past events against the injected clock", (): void => {
		render(
			<CalendarHarness now={new Date("2026-04-01T00:00:00Z")}>
				<FirstChip eventId="offsite" />
			</CalendarHarness>,
		);
		const chip = screen.getByRole("button", { name: "Offsite, All day, continues" });
		expect(chip.dataset.past).toBe("");
		expect(chip.dataset.allDay).toBe("");
	});

	it("reports clicks and double clicks with the typed occurrence and selects on click", (): void => {
		const onEventClick = vi.fn<(occurrence: EventCalendarOccurrence<TestEventData>) => void>();
		const onEventDoubleClick = vi.fn<(occurrence: EventCalendarOccurrence<TestEventData>) => void>();
		const onSelectionChange = vi.fn();
		render(
			<CalendarHarness onEventClick={onEventClick} onEventDoubleClick={onEventDoubleClick} onSelectionChange={onSelectionChange}>
				<FirstChip eventId="standup" />
			</CalendarHarness>,
		);
		const chip = screen.getByRole("button", { name: /^Standup/ });
		fireEvent.click(chip);
		expect(onEventClick.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.first]?.event.data?.owner).toBe("ana");
		expect(onSelectionChange).toHaveBeenLastCalledWith({ eventKeys: ["standup::2026-03-16T09:00:00.000Z"], slot: null });
		expect(screen.getByRole("button", { name: /^Standup/ }).getAttribute("aria-pressed")).toBe("true");
		fireEvent.doubleClick(chip);
		expect(onEventDoubleClick.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.first]?.eventId).toBe("standup");
	});

	it("skips built-in selection when the click handler prevents default", (): void => {
		const prevent = vi.fn((_occurrence: EventCalendarOccurrence<TestEventData>, event: React.MouseEvent<HTMLElement>): void => {
			event.preventDefault();
		});
		const onSelectionChange = vi.fn();
		render(
			<CalendarHarness onEventClick={prevent} onSelectionChange={onSelectionChange}>
				<FirstChip eventId="standup" />
			</CalendarHarness>,
		);
		fireEvent.click(screen.getByRole("button", { name: /^Standup/ }));
		expect(onSelectionChange).not.toHaveBeenCalled();
	});

	it("renders consumer content through renderEvent with typed data", (): void => {
		render(
			<CalendarHarness renderEvent={renderOwner}>
				<FirstChip eventId="review" />
			</CalendarHarness>,
		);
		expect(screen.getByText("owner:ben")).toBeTruthy();
	});

	it("is inert as a preview clone", (): void => {
		render(
			<CalendarHarness>
				<FirstChip eventId="standup" preview />
			</CalendarHarness>,
		);
		const chip = document.querySelector<HTMLElement>("[data-slot=event-calendar-event]");
		expect(chip?.tabIndex).toBe(-1);
		expect(chip?.getAttribute("aria-hidden")).toBe("true");
		expect(chip?.getAttribute("aria-pressed")).toBeNull();
		expect(chip?.querySelector("[data-slot=event-calendar-resize-handle]")).toBeNull();
	});

	it("shows resize handles only where resizing is allowed", (): void => {
		const { unmount } = render(
			<CalendarHarness>
				<FirstChip eventId="standup" />
			</CalendarHarness>,
		);
		expect(document.querySelectorAll("[data-slot=event-calendar-resize-handle]")).toHaveLength(2);
		unmount();
		render(
			<CalendarHarness interactions={{ resize: false }}>
				<FirstChip eventId="standup" />
			</CalendarHarness>,
		);
		expect(document.querySelectorAll("[data-slot=event-calendar-resize-handle]")).toHaveLength(0);
	});

	it("exposes its subject to children through useEventCalendarEventChip", (): void => {
		function ChildChip(): React.JSX.Element | null {
			const { index } = useEventCalendar();
			const segment = index.byDay.get("2026-03-16")?.timed.at(0);
			return segment === undefined ? null : (
				<EventCalendarViewContext.Provider value={MONTH_CONTEXT}>
					<EventCalendarEvent segment={segment}>
						<ChipProbe />
					</EventCalendarEvent>
				</EventCalendarViewContext.Provider>
			);
		}
		render(
			<CalendarHarness>
				<ChildChip />
			</CalendarHarness>,
		);
		expect(screen.getByText("probe:standup")).toBeTruthy();
	});

	it("exports token-only tone colours and CVA variants", (): void => {
		expect(EVENT_CALENDAR_COLORS.map((option): string => option.value).every((value: string): boolean => value.startsWith("var(--"))).toBe(true);
		expect(getEventToneStyle(undefined)).toEqual({ "--ec-event-color": "var(--primary)" });
		expect(eventCalendarEventVariants({ variant: "agenda", state: "selected" })).toContain("rounded-none");
	});
});
