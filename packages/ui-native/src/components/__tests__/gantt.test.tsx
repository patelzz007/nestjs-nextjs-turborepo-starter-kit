import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { GanttClock, GanttEvent, GanttProposedUpdate, GanttResource, GanttResourceReorder } from "@workspace/ui-kit-logic";
import * as React from "react";
import { AccessibilityInfo, Text, type ViewInstance } from "react-native";

import { SHEET_MOTION } from "../../lib/motion";
import { Gantt, type GanttProps } from "../gantt";

const ZONE = "UTC";

function utc(iso: string): Date {
	return new Date(`${iso}Z`);
}

/** Wednesday 17 June 2026, 09:30 UTC. */
const CLOCK: GanttClock = { nowEpochMs: (): number => utc("2026-06-17T09:30:00").getTime() };

const RESOURCES: readonly GanttResource[] = [
	{
		id: "build",
		title: "Build",
		children: [
			{ id: "api", title: "API" },
			{ id: "screens", title: "Screens" },
		],
	},
	{ id: "launch", title: "Launch" },
];

const EVENTS: readonly GanttEvent[] = [
	{
		id: "e-api",
		title: "API endpoints",
		start: utc("2026-06-08T00:00:00"),
		end: utc("2026-06-12T00:00:00"),
		allDay: true,
		resourceId: "api",
		color: "violet",
		progress: 60,
		baselineStart: utc("2026-06-08T00:00:00"),
		baselineEnd: utc("2026-06-10T00:00:00"),
	},
	{
		id: "e-screens",
		title: "Screens",
		start: utc("2026-06-12T00:00:00"),
		end: utc("2026-06-13T00:00:00"),
		allDay: true,
		resourceId: "screens",
		color: "teal",
		dependencies: ["e-api"],
	},
	{ id: "e-go", title: "Go live", start: utc("2026-06-20T00:00:00"), end: utc("2026-06-20T00:00:00"), allDay: true, resourceId: "launch", readOnly: true },
];

function gantt(overrides: Partial<GanttProps> = {}): React.JSX.Element {
	return <Gantt resources={RESOURCES} defaultEvents={EVENTS} clock={CLOCK} timeZone={ZONE} defaultScale="month" testID="gantt" {...overrides} />;
}

/** A touch at `x` points, as the responder system records it. */
function touchAt(x: number, timestamp: number): object {
	const touch = {
		touchActive: true,
		startPageX: 0,
		startPageY: 0,
		startTimeStamp: 0,
		currentPageX: x,
		currentPageY: 0,
		currentTimeStamp: timestamp,
		previousPageX: 0,
		previousPageY: 0,
		previousTimeStamp: 0,
	};
	return {
		nativeEvent: { touches: [{ pageX: x, pageY: 0 }], changedTouches: [{ pageX: x, pageY: 0 }], timestamp, pageX: x, pageY: 0 },
		touchHistory: { indexOfSingleActiveTouch: 0, mostRecentTimeStamp: timestamp, numberActiveTouches: 1, touchBank: [touch] },
	};
}

/** The events the last change reported. */
function latestEvents(onEventsChange: jest.Mock<undefined, [readonly GanttEvent[]]>): readonly GanttEvent[] {
	const [events = []] = onEventsChange.mock.lastCall ?? [];
	return events;
}

/** A finger's tap on a bar: down and up in place. */
async function tap(bar: ReturnType<typeof screen.getByRole>): Promise<void> {
	await fireEvent(bar, "responderGrant", touchAt(0, 1));
	await fireEvent(bar, "responderRelease", touchAt(0, 2));
}

/** Lets a menu's sheet finish leaving. */
async function finishLeaving(): Promise<void> {
	await act((): void => {
		jest.advanceTimersByTime(SHEET_MOTION.exit.duration);
	});
}

/** What the gantt announced to screen readers. */
let announce: jest.SpyInstance<void, [string]>;

beforeEach((): void => {
	jest.useFakeTimers();
	announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation((): void => undefined);
});

afterEach((): void => {
	jest.useRealTimers();
	jest.restoreAllMocks();
});

describe("Gantt", () => {
	it("shows the period, the rows and a button per bar that reads its dates, row and progress", async () => {
		await render(gantt());

		expect(screen.getByRole("header", { name: "June 2026" })).toBeOnTheScreen();
		expect(screen.getByText("Build")).toBeOnTheScreen();
		expect(screen.getByText("Launch")).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: /^API endpoints/u })).toHaveProp("accessibilityLabel", expect.stringContaining("Jun 8 – Jun 11"));
		expect(screen.getByRole("button", { name: /^API endpoints/u })).toHaveProp("accessibilityLabel", expect.stringContaining("60% complete"));
		expect(screen.getByRole("button", { name: /^Go live/u })).toHaveProp("accessibilityLabel", expect.stringContaining("milestone"));
	});

	it("steps the period back and forth, back to today, and changes the scale", async () => {
		const onDateChange = jest.fn();
		const onScaleChange = jest.fn();
		await render(gantt({ onDateChange, onScaleChange }));

		await fireEvent.press(screen.getByRole("button", { name: "Next" }));
		expect(screen.getByRole("header", { name: "July 2026" })).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Previous" }));
		await fireEvent.press(screen.getByRole("button", { name: "Previous" }));
		expect(screen.getByRole("header", { name: "May 2026" })).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Today" }));
		expect(screen.getByRole("header", { name: "June 2026" })).toBeOnTheScreen();
		expect(onDateChange).toHaveBeenCalledTimes(4);

		await fireEvent.press(screen.getByRole("button", { name: "Month" }));
		await fireEvent.press(screen.getByRole("radio", { name: "Week" }));
		await finishLeaving();
		expect(onScaleChange).toHaveBeenCalledWith("week");
		expect(screen.getByRole("header", { name: /^June 14/u })).toBeOnTheScreen();
	});

	it("selects a bar on a tap, and its readout moves it and changes its length", async () => {
		const onEventsChange = jest.fn<undefined, [readonly GanttEvent[]]>();
		const onEventPress = jest.fn();
		await render(gantt({ onEventsChange, onEventPress }));

		await tap(screen.getByRole("button", { name: /^Screens, /u }));
		expect(onEventPress).toHaveBeenCalledWith(expect.objectContaining({ id: "e-screens" }));
		expect(screen.getByText("Jun 12")).toBeOnTheScreen();

		await fireEvent.press(screen.getByRole("button", { name: "Move later" }));
		expect(latestEvents(onEventsChange).find((event) => event.id === "e-screens")?.start).toEqual(utc("2026-06-13T00:00:00"));
		await fireEvent.press(screen.getByRole("button", { name: "Lengthen" }));
		await fireEvent.press(screen.getByRole("button", { name: "Shorten" }));
		await fireEvent.press(screen.getByRole("button", { name: "Move earlier" }));
		expect(onEventsChange).toHaveBeenCalledTimes(4);
		expect(announce).toHaveBeenCalledWith("Screens, Jun 12");

		await fireEvent.press(screen.getByRole("button", { name: "Done" }));
		expect(screen.queryByRole("button", { name: "Move later" })).toBeNull();
	});

	it("lets the commit gate refuse a change or adjust it", async () => {
		const onEventsChange = jest.fn<undefined, [readonly GanttEvent[]]>();
		const refuse = jest.fn((): false => false);
		const { rerender } = await render(gantt({ onEventsChange, onEventUpdate: refuse }));
		await fireEvent(screen.getByRole("button", { name: /^Screens, /u }), "accessibilityAction", { nativeEvent: { actionName: "later" } });
		expect(refuse).toHaveBeenCalledWith(expect.objectContaining({ source: "keyboard" }));
		expect(onEventsChange).not.toHaveBeenCalled();

		const snapToMonday = jest.fn((update: GanttProposedUpdate) => ({ start: utc("2026-06-15T00:00:00"), end: utc("2026-06-16T00:00:00"), allDay: update.allDay }));
		await rerender(gantt({ onEventsChange, onEventUpdate: snapToMonday }));
		await fireEvent(screen.getByRole("button", { name: /^Screens, /u }), "accessibilityAction", { nativeEvent: { actionName: "longer" } });
		expect(snapToMonday).toHaveBeenCalledWith(expect.objectContaining({ source: "resize-end" }));
		expect(latestEvents(onEventsChange).find((event) => event.id === "e-screens")?.start).toEqual(utc("2026-06-15T00:00:00"));
	});

	it("moves a bar with a screen reader's actions, and ignores unknown ones and read-only bars", async () => {
		const onEventsChange = jest.fn<undefined, [readonly GanttEvent[]]>();
		await render(gantt({ onEventsChange, onEventUpdate: (): true => true }));

		await fireEvent(screen.getByRole("button", { name: /^API endpoints/u }), "accessibilityAction", { nativeEvent: { actionName: "earlier" } });
		await fireEvent(screen.getByRole("button", { name: /^API endpoints/u }), "accessibilityAction", { nativeEvent: { actionName: "shorter" } });
		await fireEvent(screen.getByRole("button", { name: /^API endpoints/u }), "accessibilityAction", { nativeEvent: { actionName: "magic" } });
		expect(onEventsChange).toHaveBeenCalledTimes(2);
		expect(screen.getByRole("button", { name: /^Go live/u })).toHaveProp("accessibilityActions", [{ name: "activate" }]);
	});

	it("drags a selected bar along the timeline by whole days", async () => {
		const onEventsChange = jest.fn<undefined, [readonly GanttEvent[]]>();
		await render(gantt({ onEventsChange, defaultScale: "week", defaultDate: utc("2026-06-12T00:00:00") }));
		const bar = screen.getByRole("button", { name: /^Screens, /u });
		await fireEvent(bar, "accessibilityAction", { nativeEvent: { actionName: "activate" } });
		expect(screen.getByRole("button", { name: "Move later" })).toBeOnTheScreen();

		await fireEvent(bar, "responderGrant", touchAt(0, 1));
		await fireEvent(bar, "responderMove", touchAt(400, 2));
		await fireEvent(bar, "responderRelease", touchAt(400, 3));

		const moved = latestEvents(onEventsChange).find((event) => event.id === "e-screens");
		expect(moved?.start.getTime()).toBeGreaterThan(utc("2026-06-12T00:00:00").getTime());
	});

	it("folds a group, and reorders rows through their menu", async () => {
		const onResourceReorder = jest.fn<false | undefined, [GanttResourceReorder]>((): undefined => undefined);
		await render(gantt({ onResourceReorder }));

		await fireEvent.press(screen.getByRole("button", { name: "Collapse Build" }));
		expect(screen.queryByText("API")).toBeNull();
		await fireEvent.press(screen.getByRole("button", { name: "Expand Build" }));
		expect(screen.getByText("API")).toBeOnTheScreen();

		await fireEvent.press(screen.getByRole("button", { name: "Reorder Launch" }));
		await fireEvent.press(screen.getByRole("menuitem", { name: "Move up" }));
		await finishLeaving();
		expect(onResourceReorder).toHaveBeenCalledWith(expect.objectContaining({ resourceId: "launch", parentId: null, index: 0 }));
		expect(announce).toHaveBeenCalledWith("Launch moved");

		await fireEvent.press(screen.getByRole("button", { name: "Reorder Launch" }));
		await fireEvent.press(screen.getByRole("menuitem", { name: "Move down" }));
		await finishLeaving();
		expect(onResourceReorder).toHaveBeenCalledTimes(1);
	});

	it("draws a row's own content, more toolbar, and can leave out the nav, arrows, plans and today", async () => {
		const renderResource = (resource: GanttResource): React.JSX.Element => <Text>{`Row ${resource.title}`}</Text>;
		const { rerender } = await render(gantt({ renderResource, toolbarContent: <Text>Extra</Text>, offDays: { weekendDays: [0, 6], dates: [utc("2026-06-19T00:00:00")] } }));
		expect(screen.getByText("Row API")).toBeOnTheScreen();
		expect(screen.getByText("Extra")).toBeOnTheScreen();

		await rerender(gantt({ showNav: false, dependencies: false, baselineBars: false, summaryBars: false, showToday: false, offDays: false, treeWidth: "sm" }));
		expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
	});

	it("takes controlled events, scale and date", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(
			<Gantt
				ref={ref}
				resources={RESOURCES}
				events={EVENTS}
				scale="quarter"
				date={utc("2026-05-01T00:00:00")}
				clock={CLOCK}
				timeZone={ZONE}
				className="mt-2"
				testID="gantt"
			/>,
		);

		expect(screen.getByRole("header", { name: "Q2 2026" })).toBeOnTheScreen();
		expect(ref.current).not.toBeNull();
		expect(screen.getByTestId("gantt")).toHaveProp("className", expect.stringContaining("mt-2"));
	});

	it("leaves an unselected bar in place when it is swiped, and a too-short drag changes nothing", async () => {
		const onEventsChange = jest.fn<undefined, [readonly GanttEvent[]]>();
		await render(gantt({ onEventsChange, defaultScale: "week", defaultDate: utc("2026-06-12T00:00:00") }));
		const bar = screen.getByRole("button", { name: /^Screens, /u });

		await fireEvent(bar, "responderGrant", touchAt(0, 1));
		await fireEvent(bar, "responderMove", touchAt(300, 2));
		await fireEvent(bar, "responderRelease", touchAt(300, 3));
		expect(onEventsChange).not.toHaveBeenCalled();

		await tap(bar);
		await fireEvent(bar, "responderGrant", touchAt(0, 4));
		await fireEvent(bar, "responderMove", touchAt(8, 5));
		await fireEvent(bar, "responderRelease", touchAt(8, 6));
		await fireEvent(bar, "responderTerminate", touchAt(0, 7));
		expect(onEventsChange).not.toHaveBeenCalled();

		await tap(bar);
		expect(screen.queryByRole("button", { name: "Move later" })).toBeNull();
	});

	it("keeps the proposed end when an adjustment changes only the start", async () => {
		const onEventsChange = jest.fn<undefined, [readonly GanttEvent[]]>();
		await render(gantt({ onEventsChange, onEventUpdate: () => ({ start: utc("2026-06-11T00:00:00") }) }));

		await fireEvent(screen.getByRole("button", { name: /^Screens, /u }), "accessibilityAction", { nativeEvent: { actionName: "later" } });

		expect(latestEvents(onEventsChange).find((event) => event.id === "e-screens")).toEqual(
			expect.objectContaining({ start: utc("2026-06-11T00:00:00"), end: utc("2026-06-14T00:00:00"), allDay: true }),
		);
	});

	it("shows a read-only bar's readout without buttons, and a fixed-length bar without resizing", async () => {
		const events: readonly GanttEvent[] = [
			{ id: "fixed", title: "Fixed", start: utc("2026-06-08T00:00:00"), end: utc("2026-06-10T00:00:00"), allDay: true, resourceId: "api", resizable: false },
			{ id: "locked", title: "Locked", start: utc("2026-06-15T00:00:00"), end: utc("2026-06-16T00:00:00"), allDay: true, resourceId: "screens", readOnly: true, progress: 50 },
		];
		await render(gantt({ defaultEvents: events }));

		await tap(screen.getByRole("button", { name: /^Fixed, /u }));
		expect(screen.getByRole("button", { name: "Move later" })).toBeOnTheScreen();
		expect(screen.queryByRole("button", { name: "Lengthen" })).toBeNull();

		await fireEvent(screen.getByRole("button", { name: /^Locked, /u }), "accessibilityAction", { nativeEvent: { actionName: "activate" } });
		expect(screen.getByText("Jun 15 · 50% complete")).toBeOnTheScreen();
		expect(screen.queryByRole("button", { name: "Move later" })).toBeNull();
	});

	it("draws a group's own planned window and a selected milestone", async () => {
		const resources: readonly GanttResource[] = [
			{
				id: "build",
				title: "Build",
				baselineStart: utc("2026-06-05T00:00:00"),
				baselineEnd: utc("2026-06-15T00:00:00"),
				children: [
					{ id: "api", title: "API" },
					{ id: "screens", title: "Screens" },
				],
			},
			{ id: "launch", title: "Launch" },
		];
		await render(gantt({ resources }));

		await fireEvent(screen.getByRole("button", { name: /^Go live/u }), "accessibilityAction", { nativeEvent: { actionName: "activate" } });
		expect(screen.getByRole("button", { name: /^Go live/u })).toHaveProp("accessibilityState", { selected: true });
	});

	it("refuses a row move past either end, and stays quiet when the parent refuses one", async () => {
		const onResourceReorder = jest.fn<false | undefined, [GanttResourceReorder]>((): false => false);
		await render(gantt({ onResourceReorder }));

		await fireEvent.press(screen.getByRole("button", { name: "Reorder Build" }));
		await fireEvent.press(screen.getByRole("menuitem", { name: "Move up" }));
		await finishLeaving();
		expect(onResourceReorder).not.toHaveBeenCalled();

		await fireEvent.press(screen.getByRole("button", { name: "Reorder Build" }));
		await fireEvent.press(screen.getByRole("menuitem", { name: "Move down" }));
		await finishLeaving();
		expect(onResourceReorder).toHaveBeenCalledTimes(1);
		expect(announce).not.toHaveBeenCalledWith("Build moved");
	});

	it("reads the device's zone and the system clock when given neither", async () => {
		await render(<Gantt resources={RESOURCES} defaultEvents={EVENTS} testID="gantt" />);
		expect(screen.getByTestId("gantt")).toBeOnTheScreen();
	});
});
