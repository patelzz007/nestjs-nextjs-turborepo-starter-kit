import { epochMs, KanbanItemTypeSchema, KanbanTeamSchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import {
	childCountOf,
	formatRelativeTime,
	describeActivity,
	effectiveSchedule,
	formatDateRange,
	formatDueDate,
	initialsOf,
	isOverdue,
	itemCountLabel,
	KANBAN_TEAM_DISPLAY,
	KANBAN_TONES,
	KANBAN_TYPE_DISPLAY,
	percentOf,
	pointsLabel,
	toneForPerson,
	visibleInsights,
} from "../kanban-display";
import { ancestor, STORY_ID, task } from "./kanban-fixtures";

describe("kanban display", () => {
	it("gives every team its own tone", () => {
		const tones = KanbanTeamSchema.options.map((team) => KANBAN_TEAM_DISPLAY[team].tone);
		expect(new Set(tones).size).toBe(KanbanTeamSchema.options.length);
	});

	it("keeps a person's tone stable and within the palette", () => {
		const id = "0199d0c0-0000-7000-8000-000000000001";
		expect(toneForPerson(id)).toBe(toneForPerson(id));
		expect(KANBAN_TONES).toContain(toneForPerson(id));
	});

	it("takes up to two initials", () => {
		expect(initialsOf("Admin User")).toBe("AU");
		expect(initialsOf("  carol   ann white ")).toBe("CA");
		expect(initialsOf("Eve")).toBe("E");
	});

	it("words due dates, item counts and points", () => {
		expect(formatDueDate(null)).toBe("No due date");
		expect(formatDueDate(new Date(2026, 5, 14, 12).getTime())).toBe("Jun 14");
		expect(itemCountLabel(1)).toBe("1 item");
		expect(itemCountLabel(3)).toBe("3 items");
		expect(pointsLabel(1)).toBe("1 pt");
		expect(pointsLabel(8)).toBe("8 pts");
		expect(percentOf(1, 3)).toBe(33);
		expect(percentOf(0, 0)).toBe(0);
	});

	it("gives every level its own tone", () => {
		expect(new Set(KanbanItemTypeSchema.options.map((type) => KANBAN_TYPE_DISPLAY[type].tone)).size).toBe(KanbanItemTypeSchema.options.length);
	});

	it("words a date range, and knows when an open item is overdue", () => {
		const start = new Date(2026, 5, 2, 12).getTime();
		const due = new Date(2026, 5, 14, 12).getTime();
		expect(formatDateRange(start, due)).toBe("Jun 2 – Jun 14");
		expect(formatDateRange(null, due)).toBe("Due Jun 14");
		expect(formatDateRange(start, null)).toBe("From Jun 2");
		expect(formatDateRange(null, null)).toBe("No dates");
		expect(isOverdue(start, false, due)).toBe(true);
		expect(isOverdue(start, true, due)).toBe(false);
		expect(isOverdue(null, false, due)).toBe(false);
	});

	it("gives a task its story's dates, and every other item its own", () => {
		const story = ancestor({ id: STORY_ID, type: "STORY", title: "Refund a card", startAt: epochMs(1_000), dueAt: epochMs(9_000) });
		expect(effectiveSchedule(task({ id: "t", type: "TASK", ancestors: [story] }))).toEqual({ startAt: 1_000, dueAt: 9_000, inheritedFrom: story });
		expect(effectiveSchedule(task({ id: "s", dueAt: epochMs(4_000) }))).toEqual({ startAt: null, dueAt: 4_000, inheritedFrom: null });
	});

	it("words each kind of history entry", () => {
		expect(describeActivity({ kind: "CREATED", field: null, from: null, to: "To Do" })).toBe("created this in To Do");
		expect(describeActivity({ kind: "MOVED", field: null, from: "To Do", to: "Review" })).toBe("moved this from To Do to Review");
		expect(describeActivity({ kind: "UPDATED", field: "PRIORITY", from: "LOW", to: "HIGH" })).toBe("changed the priority from Low to High");
		expect(describeActivity({ kind: "UPDATED", field: "STORY_POINTS", from: null, to: "5" })).toBe("changed the estimate from none to 5 pts");
		expect(describeActivity({ kind: "UPDATED", field: "DESCRIPTION", from: null, to: null })).toBe("updated the description");
		expect(describeActivity({ kind: "LINKED", field: null, from: "BLOCKED_BY", to: "Schema" })).toBe("linked this as blocked by Schema");
		expect(describeActivity({ kind: "CHECKED", field: "SUBTASKS", from: null, to: "Design" })).toBe("ticked off “Design”");
		expect(describeActivity({ kind: "COMMENTED", field: null, from: null, to: null })).toBe("commented");
	});

	it("shows only the counts above zero", () => {
		expect(visibleInsights({ comments: 0, attachments: 0, documents: 0 })).toEqual([]);
		expect(visibleInsights({ comments: 1, attachments: 0, documents: 0 }).map((insight) => insight.key)).toEqual(["comments"]);
		expect(visibleInsights({ comments: 2, attachments: 1, documents: 3 }).map((insight) => insight.key)).toEqual(["attachments", "comments", "documents"]);
	});

	it("names what opens below an item: its child items, or a subtask's steps", () => {
		const tally = (total: number): { readonly done: number; readonly total: number } => ({ done: 0, total });
		expect(childCountOf(task({ id: "s", rollup: { children: tally(3), points: tally(0) } }))).toEqual({ count: 3, label: "3 tasks" });
		expect(childCountOf(task({ id: "e", type: "EPIC", rollup: { children: tally(1), points: tally(0) } }))).toEqual({ count: 1, label: "1 feature" });
		expect(childCountOf(task({ id: "t", type: "TASK", rollup: { children: tally(1), points: tally(0) } }))).toEqual({ count: 1, label: "1 subtask" });
		expect(childCountOf(task({ id: "u", type: "SUBTASK", steps: tally(2) }))).toEqual({ count: 2, label: "2 steps" });
		expect(childCountOf(task({ id: "n" }))).toBeNull();
	});

	it("says how long ago something happened, in the coarsest unit that fits", () => {
		const now = new Date(2026, 9, 24, 12).getTime();
		const minute = 60 * 1000;
		expect(formatRelativeTime(now - 30 * 1000, now)).toBe("now");
		expect(formatRelativeTime(now - 5 * minute, now)).toBe("5 minutes ago");
		expect(formatRelativeTime(now - 3 * 60 * minute, now)).toBe("3 hours ago");
		expect(formatRelativeTime(now - 24 * 60 * minute, now)).toBe("yesterday");
		expect(formatRelativeTime(now - 400 * 24 * 60 * minute, now)).toBe("last year");
	});
});
