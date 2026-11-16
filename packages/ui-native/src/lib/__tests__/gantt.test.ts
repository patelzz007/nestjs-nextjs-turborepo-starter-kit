import { DEFAULT_GANTT_LABELS, ganttDateRangeLabel, ganttSiblingPosition, ganttStepMinutes, ganttToneClass, stepGanttEvent } from "../gantt";

const ZONE = "UTC";

function utc(iso: string): Date {
	return new Date(`${iso}Z`);
}

const ALL_DAY = { start: utc("2026-06-15T00:00:00"), end: utc("2026-06-18T00:00:00"), allDay: true };
const TIMED = { start: utc("2026-06-15T09:00:00"), end: utc("2026-06-15T11:00:00"), allDay: false };

describe("stepGanttEvent", () => {
	it("moves an all-day bar by whole days, keeping its length", () => {
		expect(stepGanttEvent(ALL_DAY, "move", 2, "month", ZONE)).toEqual({ start: utc("2026-06-17T00:00:00"), end: utc("2026-06-20T00:00:00") });
		expect(stepGanttEvent(ALL_DAY, "move", -1, "week", ZONE)).toEqual({ start: utc("2026-06-14T00:00:00"), end: utc("2026-06-17T00:00:00") });
	});

	it("changes the end, never below one step", () => {
		expect(stepGanttEvent(ALL_DAY, "end", 1, "month", ZONE).end).toEqual(utc("2026-06-19T00:00:00"));
		expect(stepGanttEvent(ALL_DAY, "end", -3, "month", ZONE).end).toEqual(ALL_DAY.end);
	});

	it("steps a timed bar by the hour on the day scale", () => {
		expect(stepGanttEvent(TIMED, "move", 1, "day", ZONE)).toEqual({ start: utc("2026-06-15T10:00:00"), end: utc("2026-06-15T12:00:00") });
		expect(stepGanttEvent(TIMED, "end", -1, "day", ZONE).end).toEqual(utc("2026-06-15T10:00:00"));
	});

	it("steps a timed bar by days on the wider scales", () => {
		expect(stepGanttEvent(TIMED, "move", 1, "month", ZONE).start).toEqual(utc("2026-06-16T00:00:00"));
	});
});

describe("ganttStepMinutes", () => {
	it("is a day, or an hour for a timed bar on the day scale", () => {
		expect(ganttStepMinutes({ allDay: true }, "day")).toBe(1440);
		expect(ganttStepMinutes({ allDay: false }, "day")).toBe(60);
		expect(ganttStepMinutes({}, "week")).toBe(1440);
	});
});

describe("ganttDateRangeLabel", () => {
	const labels = { formats: DEFAULT_GANTT_LABELS.formats, rangeSeparator: " – " };

	it("reads an all-day bar from its first day to its last", () => {
		expect(ganttDateRangeLabel(ALL_DAY, labels, ZONE)).toBe("Jun 15 – Jun 17");
		expect(ganttDateRangeLabel({ ...ALL_DAY, end: utc("2026-06-16T00:00:00") }, labels, ZONE)).toBe("Jun 15");
	});

	it("reads a timed bar with its times, and a milestone as one instant", () => {
		expect(ganttDateRangeLabel(TIMED, labels, ZONE)).toBe("Jun 15, 9:00 AM – Jun 15, 11:00 AM");
		expect(ganttDateRangeLabel({ start: TIMED.start, end: TIMED.start, allDay: true }, labels, ZONE)).toBe("Jun 15");
	});
});

describe("ganttToneClass", () => {
	it("maps a tone name to its fill, anything else to the primary colour", () => {
		expect(ganttToneClass("teal")).toBe("bg-tone-teal");
		expect(ganttToneClass("var(--chart-1)")).toBe("bg-primary");
		expect(ganttToneClass(undefined)).toBe("bg-primary");
	});
});

describe("ganttSiblingPosition", () => {
	const TREE = [
		{
			id: "a",
			title: "A",
			children: [
				{ id: "a1", title: "A1" },
				{ id: "a2", title: "A2" },
			],
		},
		{ id: "b", title: "B" },
	];

	it("finds a row's parent and its place among its siblings", () => {
		expect(ganttSiblingPosition(TREE, "b")).toEqual({ parentId: null, index: 1, count: 2 });
		expect(ganttSiblingPosition(TREE, "a2")).toEqual({ parentId: "a", index: 1, count: 2 });
		expect(ganttSiblingPosition(TREE, "zz")).toBeNull();
	});
});

describe("DEFAULT_GANTT_LABELS", () => {
	it("pluralises and fills in its messages", () => {
		expect(DEFAULT_GANTT_LABELS.events(1)).toBe("1 event");
		expect(DEFAULT_GANTT_LABELS.events(3)).toBe("3 events");
		expect(DEFAULT_GANTT_LABELS.durationDays(1)).toBe("1 day");
		expect(DEFAULT_GANTT_LABELS.durationDays(4)).toBe("4 days");
		expect(DEFAULT_GANTT_LABELS.week(25)).toBe("W25");
		expect(DEFAULT_GANTT_LABELS.jumpToBar("QA")).toBe('Scroll to "QA"');
		expect(DEFAULT_GANTT_LABELS.summaryProgress(40)).toBe("40%");
		expect(DEFAULT_GANTT_LABELS.planned("Jun 1")).toBe("Planned Jun 1");
		expect(DEFAULT_GANTT_LABELS.announceReorder("QA")).toBe("QA moved");
		expect(DEFAULT_GANTT_LABELS.weekGroup("W1", "Jun 1 – 7")).toBe("W1 Jun 1 – 7");
		expect(DEFAULT_GANTT_LABELS.collapse("Build")).toBe("Collapse Build");
		expect(DEFAULT_GANTT_LABELS.expand("Build")).toBe("Expand Build");
	});
});
