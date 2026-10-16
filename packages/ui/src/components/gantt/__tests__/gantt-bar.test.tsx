// @vitest-environment jsdom
import { cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Gantt, type GanttRenderEventProps } from "../gantt";
import { GANTT_COLORS, GanttBar, ganttBarVariants, useGanttBarContext, type GanttBarContextValue, type GanttColorOption } from "../gantt-bar";
import type { GanttEvent, GanttOccurrence, GanttSegment } from "../gantt-types";
import { GanttTestProviders, stubGanttBrowserApis, TEST_CLOCK, TEST_TIME_ZONE, utc } from "@workspace/ui/testing/gantt-testing";

const PAST_EVENT: GanttEvent = {
	id: "p",
	title: "Planning",
	start: utc(2026, 2, 2),
	end: utc(2026, 2, 4),
	allDay: true,
	progress: 100,
	color: "var(--tone-green)",
	resourceId: "r",
	baselineStart: utc(2026, 2, 2),
	baselineEnd: utc(2026, 2, 3),
};

function segmentOf(event: GanttEvent): GanttSegment {
	const occurrence: GanttOccurrence = {
		key: `${event.id}::k`,
		eventId: event.id,
		event,
		start: event.start,
		end: event.end,
		allDay: event.allDay ?? false,
		isRecurring: false,
	};
	return { occurrence, day: event.start, isStart: true, isEnd: true, continuesBefore: false, continuesAfter: true, startMin: 0, endMin: 60 };
}

interface HarnessProps {
	readonly event?: GanttEvent;
	readonly children?: React.ReactNode;
	readonly barRef?: React.Ref<HTMLButtonElement>;
	readonly onEventClick?: (occurrence: GanttOccurrence) => void;
	readonly renderEvent?: (props: GanttRenderEventProps) => React.ReactNode;
	readonly readOnly?: boolean;
}

function Harness({ event = PAST_EVENT, children, barRef, onEventClick, renderEvent }: HarnessProps): React.JSX.Element {
	return (
		<Gantt events={[event]} resources={[{ id: "r", title: "Row" }]} timeZone={TEST_TIME_ZONE} clock={TEST_CLOCK} onEventClick={onEventClick} renderEvent={renderEvent}>
			<GanttBar ref={barRef} segment={segmentOf(event)} className="extra-bar">
				{children}
			</GanttBar>
		</Gantt>
	);
}

beforeEach((): void => {
	stubGanttBrowserApis();
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

function ContextProbe(): React.JSX.Element {
	const context: GanttBarContextValue = useGanttBarContext();
	return <span data-testid="probe">{context.occurrence.event.title}</span>;
}

function renderCustom({ occurrence }: GanttRenderEventProps): React.ReactNode {
	return <em>custom {occurrence.event.title}</em>;
}

describe("GanttBar", (): void => {
	it("names itself from title, time, row, progress, plan and clipping", (): void => {
		render(<Harness />, { wrapper: GanttTestProviders });
		const bar = screen.getByRole("button", { name: "Planning, Mar 2 – Mar 3, 2026, Row, 100% complete, Planned Mar 2, 2026, continues" });
		expect(bar.getAttribute("data-completed")).toBe("");
		expect(bar.getAttribute("data-past")).toBe("");
		expect(bar.getAttribute("data-baseline-variance")).toBe("late");
		expect(bar.getAttribute("data-slot")).toBe("gantt-bar");
		expect(bar.className).toContain("rounded-e-none");
		expect(bar.style.getPropertyValue("--gantt-event-color")).toBe("var(--tone-green)");
	});

	it("describes its keyboard contract", (): void => {
		render(<Harness />, { wrapper: GanttTestProviders });
		const bar = screen.getByRole("button", { name: /Planning/ });
		const description = document.getElementById(bar.getAttribute("aria-describedby") ?? "");
		expect(description?.textContent).toContain("Arrow keys move it");
	});

	it("selects and reports clicks", (): void => {
		const onEventClick = vi.fn();
		render(<Harness onEventClick={onEventClick} />, { wrapper: GanttTestProviders });
		const bar = screen.getByRole("button", { name: /Planning/ });
		fireEvent.click(bar);
		expect(onEventClick).toHaveBeenCalledTimes(1);
		expect(bar.getAttribute("aria-pressed")).toBe("true");
		expect(bar.getAttribute("data-selected")).toBe("");
	});

	it("renders children or renderEvent content and provides its context", (): void => {
		render(
			<Harness>
				<ContextProbe />
			</Harness>,
			{ wrapper: GanttTestProviders },
		);
		expect(screen.getByTestId("probe").textContent).toBe("Planning");
		cleanup();
		render(<Harness renderEvent={renderCustom} />, { wrapper: GanttTestProviders });
		expect(screen.getByText("custom Planning")).toBeTruthy();
	});

	it("draws a milestone diamond and hides edges a milestone does not have", (): void => {
		const milestone: GanttEvent = { id: "m", title: "Launch", start: utc(2026, 2, 20), end: utc(2026, 2, 20), resourceId: "r" };
		render(<Harness event={milestone} />, { wrapper: GanttTestProviders });
		const bar = screen.getByRole("button", { name: /Launch, Mar 20, 12:00 AM, milestone/ });
		expect(bar.querySelector("[data-slot=gantt-bar-milestone]")).not.toBeNull();
		expect(bar.querySelector("[data-slot=gantt-resize-handle]")).toBeNull();
	});

	it("drops movement chrome on a read-only event", (): void => {
		render(<Harness event={{ ...PAST_EVENT, readOnly: true }} />, { wrapper: GanttTestProviders });
		const bar = screen.getByRole("button", { name: /Planning/ });
		expect(bar.getAttribute("aria-describedby")).toBeNull();
		expect(bar.querySelector("[data-slot=gantt-resize-handle]")).toBeNull();
	});

	it("forwards its ref and merges className last", (): void => {
		const barRef = React.createRef<HTMLButtonElement>();
		render(<Harness barRef={barRef} />, { wrapper: GanttTestProviders });
		expect(barRef.current?.tagName).toBe("BUTTON");
		expect(barRef.current?.className.endsWith("extra-bar")).toBe(true);
	});

	it("throws for the context outside a bar", (): void => {
		vi.spyOn(console, "error").mockImplementation((): void => undefined);
		expect((): void => {
			renderHook((): GanttBarContextValue => useGanttBarContext());
		}).toThrow("useGanttBarContext must be used within <GanttBar>");
	});

	it("offers tone-token colour presets and CVA variants", (): void => {
		expect(GANTT_COLORS.every((option: GanttColorOption): boolean => option.value.startsWith("var(--tone-"))).toBe(true);
		expect(ganttBarVariants({ variant: "outline", size: "sm", state: "selected" })).toContain("border");
	});
});
