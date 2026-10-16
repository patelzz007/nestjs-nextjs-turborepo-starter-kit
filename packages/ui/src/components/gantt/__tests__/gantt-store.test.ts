// @vitest-environment node
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UI_KIT_LABELS_EN } from "../../../lib/labels/en";
import { getRangeKey } from "../gantt-lib";
import { createGanttStore, resolveScheduleMode, resolveSettings, resolveVisibleRange, type GanttStoreOptions } from "../gantt-store";
import type { GanttClock, GanttEvent, GanttProposedUpdate, GanttRangeInfo, GanttUpdateResult } from "../gantt-types";

const UTC = "UTC";

function at(year: number, monthIndex: number, day: number, hour = 0): Date {
	return new Date(Date.UTC(year, monthIndex, day, hour));
}

const CLOCK: GanttClock = {
	nowEpochMs(): number {
		return at(2026, 2, 10, 12).getTime();
	},
};

const EVENTS: readonly GanttEvent[] = [
	{ id: "a", title: "A", start: at(2026, 2, 9), end: at(2026, 2, 11), resourceId: "r1" },
	{ id: "b", title: "B", start: at(2026, 2, 10), end: at(2026, 2, 12), resourceId: "r1", priority: 5 },
];

function options(extra: Partial<GanttStoreOptions> = {}): GanttStoreOptions {
	return { labels: UI_KIT_LABELS_EN.gantt, timeZone: UTC, clock: CLOCK, defaultScale: "week", defaultDate: at(2026, 2, 10), defaultEvents: EVENTS, ...extra };
}

afterEach((): void => {
	vi.useRealTimers();
});

describe("resolveSettings", (): void => {
	it("applies defaults and the locale's week start", (): void => {
		const settings = resolveSettings(options());
		expect(settings.slotDuration).toBe(30);
		expect(settings.snapDuration).toBe(15);
		expect(settings.weekStartsOn).toBe(0);
		expect(settings.overlap).toBe("allow");
		expect(settings.i18n.labels.today).toBe("Today");
	});

	it("orders higher priority first", (): void => {
		const store = createGanttStore(options());
		expect(store.instance.api.getOccurrences().map((occurrence: { readonly eventId: string }): string => occurrence.eventId)).toEqual(["b", "a"]);
	});

	it("resolves a node's schedule mode over the view default", (): void => {
		expect(resolveScheduleMode({ id: "n", title: "N", scheduleMode: "single" }, "multiple")).toBe("single");
		expect(resolveScheduleMode(null, undefined)).toBe("multiple");
	});
});

describe("navigation", (): void => {
	it("steps, jumps to today from the clock, and clamps to bounds", (): void => {
		const onDateChange = vi.fn();
		const store = createGanttStore(options({ onDateChange, rangeBounds: { max: at(2026, 2, 20) } }));
		store.instance.api.next();
		expect(store.instance.getState().date.getTime()).toBe(at(2026, 2, 17).getTime());
		store.instance.api.next();
		expect(store.instance.getState().date.getTime()).toBe(at(2026, 2, 20).getTime());
		store.instance.api.today();
		expect(store.instance.getState().date.getTime()).toBe(CLOCK.nowEpochMs());
		expect(onDateChange).toHaveBeenCalledTimes(3);
	});

	it("only proposes changes while controlled", (): void => {
		const onScaleChange = vi.fn();
		const store = createGanttStore(options({ scale: "week", onScaleChange }));
		store.instance.api.setScale("month");
		expect(onScaleChange).toHaveBeenCalledWith("month");
		expect(store.instance.getState().scale).toBe("week");
	});

	it("emits the visible range once per change", (): void => {
		const infos: GanttRangeInfo[] = [];
		const store = createGanttStore(options({ onRangeChange: (info: GanttRangeInfo): void => void infos.push(info) }));
		store.emitRangeIfChanged();
		store.emitRangeIfChanged();
		store.instance.api.setScale("month");
		expect(infos.map((info: GanttRangeInfo): string => info.scale)).toEqual(["week", "month"]);
	});

	it("grows the window, then slides the anchor at the cap", (): void => {
		const store = createGanttStore(options({ maxRangeWindow: 1 }));
		const before = store.instance.getState().visibleRange;
		expect(store.instance.internals.extendRange("after")).toBe(true);
		expect(store.instance.getState().visibleRange.end.getTime()).toBeGreaterThan(before.end.getTime());
		expect(store.instance.internals.extendRange("after")).toBe(true);
		expect(store.instance.internals.didAnchorSlide()).toBe(true);
		expect(createGanttStore(options({ rangeBounds: { min: at(2030, 0, 1) } })).instance.internals.extendRange("before")).toBe(false);
	});

	it("widens a range by whole periods", (): void => {
		const range = resolveVisibleRange("day", at(2026, 2, 10), { before: 1, after: 1 }, { timeZone: UTC, weekStartsOn: 0 });
		expect(getRangeKey(range)).toBe(getRangeKey({ start: at(2026, 2, 9), end: at(2026, 2, 12) }));
	});
});

describe("CRUD and the commit funnel", (): void => {
	it("adds, updates and removes events (uncontrolled)", (): void => {
		const onEventsChange = vi.fn();
		const store = createGanttStore(options({ onEventsChange }));
		const { api } = store.instance;
		api.addEvent({ id: "c", title: "C", start: at(2026, 2, 13), end: at(2026, 2, 14) });
		api.updateEvent("c", { title: "C2" });
		expect(api.getEvent("c")?.title).toBe("C2");
		api.removeEvent("c");
		expect(api.getEvent("c")).toBeUndefined();
		api.updateEvent("missing", { title: "x" });
		expect(onEventsChange).toHaveBeenCalledTimes(3);
	});

	it("routes timing changes through onEventUpdate, honouring rejection and adjustment", (): void => {
		const onEventUpdate = vi.fn((update: GanttProposedUpdate): GanttUpdateResult => (update.event.id === "a" ? false : { end: at(2026, 2, 20) }));
		const store = createGanttStore(options({ onEventUpdate }));
		const { api } = store.instance;
		api.updateEvent("a", { start: at(2026, 2, 1), title: "nope" });
		expect(api.getEvent("a")?.title).toBe("A");
		api.updateEvent("b", { start: at(2026, 2, 11), title: "moved" });
		expect(api.getEvent("b")?.title).toBe("moved");
		expect(api.getEvent("b")?.end.getTime()).toBe(at(2026, 2, 20).getTime());
		expect(onEventUpdate.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.first].source).toBe("api");
	});

	it("selects, toggles additively and clears", (): void => {
		const store = createGanttStore(options());
		const { api } = store.instance;
		api.selectEvent("x");
		api.selectEvent("y", { additive: true });
		expect(store.instance.getState().selection.eventKeys).toEqual(["x", "y"]);
		api.selectEvent("x", { additive: true });
		expect(store.instance.getState().selection.eventKeys).toEqual(["y"]);
		api.select({ slot: { start: at(2026, 2, 1), end: at(2026, 2, 2), allDay: true } });
		expect(store.instance.getState().selection.slot?.allDay).toBe(true);
		api.clearSelection();
		expect(store.instance.getState().selection).toEqual({ eventKeys: [], slot: null });
		api.setInteractions({ drag: false });
		expect(store.instance.getState().interactions).toEqual({ drag: false, resize: true, selectSlot: true });
	});

	it("finds overlapping occurrences, inside or outside the visible range", (): void => {
		const store = createGanttStore(options());
		expect(
			store.instance.api
				.findOverlapping({ start: at(2026, 2, 10, 12), end: at(2026, 2, 10, 13), excludeEventId: "a" })
				.map((item: { readonly eventId: string }): string => item.eventId),
		).toEqual(["b"]);
		expect(store.instance.api.getOccurrences({ start: at(2025, 0, 1), end: at(2025, 1, 1) })).toEqual([]);
	});
});

describe("options and subscriptions", (): void => {
	it("notifies once per options change through the flush", (): void => {
		const store = createGanttStore(options());
		const listener = vi.fn();
		const unsubscribe = store.instance.subscribe(listener);
		expect(store.setOptions(options({ loading: true }))).toBe(true);
		store.flushPendingNotify();
		store.flushPendingNotify();
		expect(listener).toHaveBeenCalledTimes(1);
		expect(store.instance.getState().loading).toBe(true);
		unsubscribe();
		const version = store.instance.internals.getSettingsVersion();
		store.setOptions(options({ loading: true, timeZone: "Asia/Singapore" }));
		expect(store.instance.internals.getSettingsVersion()).toBe(version + 1);
	});

	it("ticks the clock only while subscribed", (): void => {
		vi.useFakeTimers();
		let now = at(2026, 2, 10).getTime();
		const clock: GanttClock = {
			nowEpochMs(): number {
				return now;
			},
		};
		const store = createGanttStore(options({ clock }));
		const listener = vi.fn();
		const unsubscribe = store.instance.internals.subscribeNow(listener);
		expect(store.instance.internals.getNowMs()).toBe(now);
		now += 60_000;
		vi.advanceTimersByTime(30_000);
		expect(listener).toHaveBeenCalledTimes(1);
		expect(store.instance.internals.getNowMs()).toBe(now);
		unsubscribe();
	});

	it("tracks drag state, slot drafts and the viewport centre", (): void => {
		const store = createGanttStore(options());
		const { internals } = store.instance;
		internals.setSlotDraft({ start: at(2026, 2, 1), end: at(2026, 2, 2), allDay: false });
		expect(store.instance.getState().slotDraft).not.toBeNull();
		internals.setViewportCenter(at(2026, 2, 12));
		expect(store.instance.getState().viewportCenter?.getTime()).toBe(at(2026, 2, 12).getTime());
		internals.setDrag(null);
		expect(store.instance.getState().drag).toBeNull();
	});
});
