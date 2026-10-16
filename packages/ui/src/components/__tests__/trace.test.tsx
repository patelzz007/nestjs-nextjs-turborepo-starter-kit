// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Trace, TraceCollapsible, TraceCollapsibleContent, TraceCollapsibleTrigger, TraceDescription, TraceIcon, TraceLine, TraceTitle, type TraceLineStatus } from "../trace";

afterEach((): void => {
	cleanup();
});

describe("Trace", () => {
	it("renders a line with a decorative icon, title and description", (): void => {
		render(
			<Trace>
				<TraceLine>
					<TraceIcon>i</TraceIcon>
					<TraceTitle>Read 3 files</TraceTitle>
					<TraceDescription>1.2s</TraceDescription>
				</TraceLine>
			</Trace>,
		);
		const title = screen.getByText("Read 3 files");
		expect(title.dataset.slot).toBe("trace-title");
		expect(title.closest('[data-slot="trace"]')).toBeTruthy();
		expect(screen.getByText("i").getAttribute("aria-hidden")).toBe("true");
		expect(screen.getByText("1.2s").className).toContain("tabular-nums");
	});

	it.each<[TraceLineStatus, string]>([
		["running", "shimmer"],
		["error", "text-destructive"],
		["pending", "opacity-60"],
	])("styles the %s status and exposes it as data-status", (status, expected): void => {
		render(<TraceLine status={status}>Step</TraceLine>);
		const line = screen.getByText("Step");
		expect(line.dataset.status).toBe(status);
		expect(line.className).toContain(expected);
	});

	it("has no status attribute for a finished line and merges className last", (): void => {
		render(<TraceLine className="text-xs">Done</TraceLine>);
		const line = screen.getByText("Done");
		expect(line.dataset.status).toBeUndefined();
		expect(line.className).toContain("text-xs");
		expect(line.className).not.toContain("text-sm");
	});

	it("expands and collapses its detail from the trigger (uncontrolled)", (): void => {
		render(
			<Trace>
				<TraceCollapsible>
					<TraceCollapsibleTrigger>
						<TraceLine>
							<TraceTitle>Search</TraceTitle>
						</TraceLine>
					</TraceCollapsibleTrigger>
					<TraceCollapsibleContent className="text-xs">Matched 12 results</TraceCollapsibleContent>
				</TraceCollapsible>
			</Trace>,
		);
		const trigger = screen.getByRole("button", { name: "Search" });
		expect(trigger.getAttribute("aria-expanded")).toBe("false");
		expect(screen.queryByText("Matched 12 results")).toBeNull();

		fireEvent.click(trigger);
		expect(trigger.getAttribute("aria-expanded")).toBe("true");
		const detail = screen.getByText("Matched 12 results");
		expect(detail.dataset.slot).toBe("trace-collapsible-content-inner");
		expect(detail.className).toContain("text-xs");
	});

	it("reports toggles to a controlled owner", (): void => {
		const onOpenChange = vi.fn();
		render(
			<TraceCollapsible open={false} onOpenChange={onOpenChange}>
				<TraceCollapsibleTrigger>Plan</TraceCollapsibleTrigger>
				<TraceCollapsibleContent>Detail</TraceCollapsibleContent>
			</TraceCollapsible>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Plan" }));
		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(onOpenChange.mock.lastCall?.at(0)).toBe(true);
		expect(screen.getByRole("button", { name: "Plan" }).getAttribute("aria-expanded")).toBe("false");
	});

	it("forwards refs", (): void => {
		const traceRef = React.createRef<HTMLDivElement>();
		const lineRef = React.createRef<HTMLSpanElement>();
		const triggerRef = React.createRef<HTMLButtonElement>();
		render(
			<Trace ref={traceRef}>
				<TraceLine ref={lineRef}>Line</TraceLine>
				<TraceCollapsible>
					<TraceCollapsibleTrigger ref={triggerRef}>Toggle</TraceCollapsibleTrigger>
				</TraceCollapsible>
			</Trace>,
		);
		expect(traceRef.current?.dataset.slot).toBe("trace");
		expect(lineRef.current?.dataset.slot).toBe("trace-line");
		expect(triggerRef.current?.tagName).toBe("BUTTON");
	});
});
