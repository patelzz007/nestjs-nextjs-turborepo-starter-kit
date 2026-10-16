// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	findScheduleConflicts,
	Gantt,
	resolveTimelineLines,
	useGantt,
	useGanttInteractions,
	useGanttNavigation,
	useGanttNodeSchedules,
	useGanttOccurrences,
	useGanttScale,
	useGanttSelection,
	useGanttSelector,
	useGanttState,
	useGanttViewConfig,
	type GanttApi,
	type GanttInstance,
} from "./gantt";
import type { GanttOccurrence, GanttState } from "./gantt-types";
import { GanttTestProviders, stubGanttBrowserApis, TEST_CLOCK, TEST_EVENTS, TEST_RESOURCES, TEST_TIME_ZONE, utc } from "@workspace/ui/testing/gantt-testing";

const ANCHOR = utc(2026, 2, 10);

beforeEach((): void => {
	stubGanttBrowserApis();
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

interface WrapperProps {
	readonly children: React.ReactNode;
}

function GanttWrapper({ children }: WrapperProps): React.JSX.Element {
	return (
		<GanttTestProviders>
			<Gantt
				defaultEvents={TEST_EVENTS}
				resources={TEST_RESOURCES}
				defaultScale="week"
				defaultDate={ANCHOR}
				timeZone={TEST_TIME_ZONE}
				clock={TEST_CLOCK}
				scheduleMode="single">
				{children}
			</Gantt>
		</GanttTestProviders>
	);
}

describe("Gantt root", (): void => {
	it("renders data-slot, the live region, merges className last and forwards its ref", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(
			<Gantt ref={ref} className="h-96" variant="outline" size="lg" events={TEST_EVENTS} clock={TEST_CLOCK}>
				<span>child</span>
			</Gantt>,
			{ wrapper: GanttTestProviders },
		);
		expect(ref.current?.getAttribute("data-slot")).toBe("gantt");
		expect(ref.current?.className).toContain("h-96");
		expect(ref.current?.className).toContain("text-sm");
		expect(ref.current?.querySelector("[data-slot=gantt-announcer]")?.getAttribute("aria-live")).toBe("polite");
		expect(screen.getByText("child")).toBeTruthy();
	});

	it("exposes the api through apiRef", (): void => {
		const apiRef = React.createRef<GanttApi>();
		render(<Gantt apiRef={apiRef} defaultEvents={TEST_EVENTS} clock={TEST_CLOCK} />, { wrapper: GanttTestProviders });
		expect(apiRef.current?.getEvents()).toHaveLength(TEST_EVENTS.length);
	});

	it("throws a clear error without a labels provider", (): void => {
		vi.spyOn(console, "error").mockImplementation((): void => undefined);
		expect((): void => {
			render(<Gantt />);
		}).toThrow(/UiKitLabelsProvider/);
	});

	it("adopts a hoisted instance", (): void => {
		const { result } = renderHook((): GanttInstance => useGanttState({ defaultEvents: TEST_EVENTS, clock: TEST_CLOCK }), { wrapper: GanttTestProviders });
		const instance = result.current;
		function Probe(): React.JSX.Element {
			return <span>{String(useGantt() === instance)}</span>;
		}
		render(
			<Gantt calendar={instance}>
				<Probe />
			</Gantt>,
			{ wrapper: GanttTestProviders },
		);
		expect(screen.getByText("true")).toBeTruthy();
	});
});

describe("hooks", (): void => {
	it("throws outside <Gantt>", (): void => {
		vi.spyOn(console, "error").mockImplementation((): void => undefined);
		expect((): void => {
			renderHook((): GanttInstance => useGantt());
		}).toThrow("useGantt must be used within <Gantt>");
		expect((): void => {
			renderHook((): number => useGanttSelector((state: GanttState): number => state.events.length));
		}).toThrow(/useGanttSelector/);
	});

	it("navigates and titles the period", (): void => {
		const { result } = renderHook((): ReturnType<typeof useGanttNavigation> => useGanttNavigation(), { wrapper: GanttWrapper });
		expect(result.current.title).toBe("March 8 – 14, 2026");
		expect(result.current.isToday).toBe(true);
		act((): void => {
			result.current.next();
		});
		expect(result.current.title).toBe("March 15 – 21, 2026");
		expect(result.current.isToday).toBe(false);
		act((): void => {
			result.current.today();
		});
		expect(result.current.date.getTime()).toBe(TEST_CLOCK.nowEpochMs());
	});

	it("switches scale, selection and interactions", (): void => {
		const { result } = renderHook(
			(): {
				readonly scale: ReturnType<typeof useGanttScale>;
				readonly selection: ReturnType<typeof useGanttSelection>;
				readonly interactions: ReturnType<typeof useGanttInteractions>;
			} => ({
				scale: useGanttScale(),
				selection: useGanttSelection(),
				interactions: useGanttInteractions(),
			}),
			{ wrapper: GanttWrapper },
		);
		act((): void => {
			result.current.scale.setScale("month");
			result.current.selection.selectEvent("k");
			result.current.interactions.setInteractions({ resize: false });
		});
		expect(result.current.scale.scale).toBe("month");
		expect(result.current.selection.selection.eventKeys).toEqual(["k"]);
		expect(result.current.interactions.interactions.resize).toBe(false);
		act((): void => {
			result.current.selection.clearSelection();
		});
		expect(result.current.selection.selection.eventKeys).toEqual([]);
	});

	it("keeps occurrence identity across unrelated renders and reports node schedules", (): void => {
		const { result, rerender } = renderHook(
			(): { readonly occurrences: readonly GanttOccurrence[]; readonly node: ReturnType<typeof useGanttNodeSchedules>; readonly mode: string } => ({
				occurrences: useGanttOccurrences(),
				node: useGanttNodeSchedules("visuals"),
				mode: useGanttViewConfig().scheduleMode,
			}),
			{ wrapper: GanttWrapper },
		);
		const first = result.current.occurrences;
		rerender();
		expect(result.current.occurrences).toBe(first);
		expect(result.current.node.node?.title).toBe("Visuals");
		expect(result.current.node.schedules).toHaveLength(1);
		expect(result.current.node.scheduleMode).toBe("single");
		expect(result.current.mode).toBe("single");
	});
});

describe("pure helpers", (): void => {
	it("resolves timeline lines from every shorthand", (): void => {
		expect(resolveTimelineLines(undefined)).toEqual({ vertical: "solid", horizontal: "solid" });
		expect(resolveTimelineLines("none")).toEqual({ vertical: null, horizontal: null });
		expect(resolveTimelineLines("vertical")).toEqual({ vertical: "solid", horizontal: null });
		expect(resolveTimelineLines({ vertical: "dashed", horizontal: false })).toEqual({ vertical: "dashed", horizontal: null });
		expect(resolveTimelineLines({ horizontal: true })).toEqual({ vertical: "solid", horizontal: "solid" });
	});

	it("pairs overlapping schedules", (): void => {
		const event = TEST_EVENTS.at(0);
		if (event === undefined) {
			throw new Error("fixture missing");
		}
		const make = (key: string, start: Date, end: Date): GanttOccurrence => ({ key, eventId: key, event, start, end, allDay: false, isRecurring: false });
		const a = make("a", utc(2026, 2, 1), utc(2026, 2, 3));
		const b = make("b", utc(2026, 2, 2), utc(2026, 2, 4));
		const c = make("c", utc(2026, 2, 5), utc(2026, 2, 6));
		expect(findScheduleConflicts([a, b, c])).toEqual([[a, b]]);
	});
});
