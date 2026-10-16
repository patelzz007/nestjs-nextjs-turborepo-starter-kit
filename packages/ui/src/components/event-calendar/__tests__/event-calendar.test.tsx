// @vitest-environment jsdom
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	EventCalendar,
	useEventCalendar,
	useEventCalendarInteractions,
	useEventCalendarNavigation,
	useEventCalendarOccurrences,
	useEventCalendarSelection,
	useEventCalendarView,
	useEventCalendarViewSettings,
	type EventCalendarApi,
} from "../event-calendar";
import { CalendarHarness, ResizeObserverStub, TEST_EVENTS, TEST_NOW, TEST_TIME_ZONE, type TestEventData } from "@workspace/ui/testing/event-calendar-test-harness";
import type { EventCalendarOccurrence, EventCalendarRangeInfo } from "../event-calendar-types";

beforeEach((): void => {
	vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

interface ApiHolder {
	api: EventCalendarApi | null;
}

/** Captures the api of the calendar it renders inside. */
function ApiProbe({ onApi }: { readonly onApi: (api: EventCalendarApi) => void }): React.JSX.Element {
	const { api } = useEventCalendar();
	React.useEffect((): void => {
		onApi(api);
	}, [api, onApi]);
	return <span />;
}

function NavigationProbe(): React.JSX.Element {
	const { title, isToday } = useEventCalendarNavigation();
	const { viewName, availableViews } = useEventCalendarView();
	const occurrences = useEventCalendarOccurrences();
	const { selection } = useEventCalendarSelection();
	const { interactions } = useEventCalendarInteractions();
	const { effective } = useEventCalendarViewSettings();
	return (
		<output data-testid="probe">
			{[
				title,
				String(isToday),
				viewName,
				availableViews.join(","),
				String(occurrences.length),
				selection.eventKeys.join(","),
				String(interactions.drag),
				String(effective.weekends),
			].join("|")}
		</output>
	);
}

describe("EventCalendar root", () => {
	it("renders the host with CVA classes, the caller className last and a forwarded ref", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(
			<CalendarHarness ref={ref} className="custom-root" size="md" variant="plain">
				<span>child</span>
			</CalendarHarness>,
		);
		const root = screen.getByText("child").parentElement;
		expect(root).toBe(ref.current);
		expect(root?.dataset.slot).toBe("event-calendar");
		expect(root?.className).toContain("text-sm");
		expect(root?.className.split(" ").at(-1)).toBe("custom-root");
		expect(root?.querySelector("[data-slot=event-calendar-announcer]")?.getAttribute("aria-live")).toBe("polite");
	});

	it("exposes navigation, view, occurrences and settings through the hooks", (): void => {
		render(
			<CalendarHarness>
				<NavigationProbe />
			</CalendarHarness>,
		);
		expect(screen.getByTestId("probe").textContent).toBe("March 2026|true|Month|month,week,day,days,agenda|4||true|true");
	});

	it("offers the resource view when resources are configured", (): void => {
		render(
			<CalendarHarness resources={[{ id: "room", title: "Room" }]}>
				<NavigationProbe />
			</CalendarHarness>,
		);
		expect(screen.getByTestId("probe").textContent).toContain("month,week,day,days,agenda,resource");
	});

	it("emits onRangeChange for the initial range and after navigation", (): void => {
		const onRangeChange = vi.fn<(info: EventCalendarRangeInfo) => void>();
		const holder: ApiHolder = { api: null };
		const capture = vi.fn((value: EventCalendarApi): void => {
			holder.api = value;
		});
		render(
			<CalendarHarness onRangeChange={onRangeChange}>
				<ApiProbe onApi={capture} />
			</CalendarHarness>,
		);
		expect(onRangeChange).toHaveBeenCalledTimes(1);
		expect(onRangeChange.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.first]).toMatchObject({ view: "month", timeZone: TEST_TIME_ZONE });
		act((): void => {
			holder.api?.next();
		});
		expect(onRangeChange).toHaveBeenCalledTimes(2);
		expect(onRangeChange.mock.calls.at(-1)?.[LIST_SLOT_INDEX.first]?.activeRange.start.getTime()).toBe(Date.UTC(2026, 3, 1));
	});

	it("routes every api action through the change callbacks", (): void => {
		const onDateChange = vi.fn<(date: Date) => void>();
		const onViewChange = vi.fn<(view: string) => void>();
		const onDayCountChange = vi.fn<(count: number) => void>();
		const onSelectionChange = vi.fn();
		const onInteractionsChange = vi.fn();
		const onViewSettingsChange = vi.fn();
		const holder: ApiHolder = { api: null };
		const capture = vi.fn((value: EventCalendarApi): void => {
			holder.api = value;
		});
		render(
			<CalendarHarness
				onDateChange={onDateChange}
				onViewChange={onViewChange}
				onDayCountChange={onDayCountChange}
				onSelectionChange={onSelectionChange}
				onInteractionsChange={onInteractionsChange}
				onViewSettingsChange={onViewSettingsChange}>
				<ApiProbe onApi={capture} />
			</CalendarHarness>,
		);
		act((): void => {
			holder.api?.today();
		});
		expect(onDateChange).toHaveBeenLastCalledWith(TEST_NOW);
		act((): void => {
			holder.api?.setView("days", { dayCount: 4 });
		});
		expect(onDayCountChange).toHaveBeenLastCalledWith(4);
		expect(onViewChange).toHaveBeenLastCalledWith("days");
		act((): void => {
			holder.api?.setView("resource");
		});
		expect(onViewChange).toHaveBeenCalledTimes(1);
		act((): void => {
			holder.api?.selectEvent("a");
		});
		act((): void => {
			holder.api?.selectEvent("b", { additive: true });
		});
		expect(onSelectionChange).toHaveBeenLastCalledWith({ eventKeys: ["a", "b"], slot: null });
		act((): void => {
			holder.api?.clearSelection();
		});
		expect(onSelectionChange).toHaveBeenLastCalledWith({ eventKeys: [], slot: null });
		act((): void => {
			holder.api?.setInteractions({ drag: false });
		});
		expect(onInteractionsChange).toHaveBeenLastCalledWith({ drag: false, resize: true, selectSlot: true });
		act((): void => {
			holder.api?.setViewSettings({ weekends: false });
		});
		expect(onViewSettingsChange).toHaveBeenLastCalledWith({ weekends: false });
	});

	it("answers occurrence queries in the display zone", (): void => {
		const holder: ApiHolder = { api: null };
		const capture = vi.fn((value: EventCalendarApi): void => {
			holder.api = value;
		});
		render(
			<CalendarHarness>
				<ApiProbe onApi={capture} />
			</CalendarHarness>,
		);
		const resolved = holder.api;
		expect(resolved).not.toBeNull();
		const day = resolved === null ? [] : resolved.getOccurrencesForDay(new Date("2026-03-16T12:00:00Z"));
		expect(day.map((occurrence: EventCalendarOccurrence): string => occurrence.eventId)).toEqual(["standup", "review"]);
		const overlapping =
			resolved === null ? [] : resolved.findOverlapping({ start: new Date("2026-03-16T09:20:00Z"), end: new Date("2026-03-16T09:25:00Z"), excludeEventId: "review" });
		expect(overlapping.map((occurrence: EventCalendarOccurrence): string => occurrence.eventId)).toEqual(["standup"]);
	});

	it("switches views with single-key shortcuts unless typing", (): void => {
		const onViewChange = vi.fn();
		render(
			<CalendarHarness onViewChange={onViewChange}>
				<button type="button">focus</button>
				<input aria-label="search" />
			</CalendarHarness>,
		);
		fireEvent.keyDown(screen.getByRole("button", { name: "focus" }), { key: "w" });
		expect(onViewChange).toHaveBeenLastCalledWith("week");
		fireEvent.keyDown(screen.getByRole("textbox", { name: "search" }), { key: "d" });
		expect(onViewChange).toHaveBeenCalledTimes(1);
	});

	it("hands typed events back through the TData-carrying callbacks", (): void => {
		const priorities: string[] = [];
		const priority = vi.fn((event: { readonly data?: TestEventData }): number => {
			priorities.push(event.data?.owner ?? "");
			return 0;
		});
		render(
			<UiKitTestProviders>
				<EventCalendar<TestEventData> events={TEST_EVENTS} view="month" date={TEST_NOW} now={TEST_NOW} timeZone={TEST_TIME_ZONE} getEventPriority={priority}>
					<span />
				</EventCalendar>
			</UiKitTestProviders>,
		);
		expect(priorities).toContain("ana");
	});

	it("throws a helpful error outside a calendar", (): void => {
		const spy = vi.spyOn(console, "error").mockImplementation((): void => undefined);
		expect((): void => {
			render(<NavigationProbe />);
		}).toThrow("useEventCalendar must be used within <EventCalendar>");
		spy.mockRestore();
	});
});
