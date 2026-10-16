"use client";

/**
 * Test-only fixtures for the gantt family: a pinned clock, a fixed zone, a
 * small resource tree, and stubs for the browser APIs jsdom lacks
 * (ResizeObserver, pointer capture). Never imported by kit components.
 */
import { UiKitLanguageProvider } from "@workspace/ui/components/ui-kit-labels-provider";
import type * as React from "react";
import { vi } from "vitest";

import type { GanttClock, GanttEvent, GanttResource } from "@workspace/ui/components/gantt/gantt-types";

/** 2026-03-10T12:00:00Z — a Tuesday. */
export const TEST_NOW_MS = Date.UTC(2026, 2, 10, 12);
export const TEST_TIME_ZONE = "UTC";

export const TEST_CLOCK: GanttClock = {
	nowEpochMs(): number {
		return TEST_NOW_MS;
	},
};

export function utc(year: number, monthIndex: number, day: number, hour = 0, minute = 0): Date {
	return new Date(Date.UTC(year, monthIndex, day, hour, minute));
}

export const TEST_RESOURCES: readonly GanttResource[] = [
	{
		id: "design",
		title: "Design",
		children: [
			{ id: "wireframes", title: "Wireframes" },
			{ id: "visuals", title: "Visuals" },
		],
	},
	{ id: "build", title: "Build" },
];

export const TEST_EVENTS: readonly GanttEvent[] = [
	{ id: "e1", title: "Sketch flows", start: utc(2026, 2, 9), end: utc(2026, 2, 11), resourceId: "wireframes", allDay: true, progress: 50 },
	{ id: "e2", title: "Palette", start: utc(2026, 2, 11), end: utc(2026, 2, 13), resourceId: "visuals", allDay: true, dependencies: ["e1"] },
	{ id: "e3", title: "Ship", start: utc(2026, 2, 12), end: utc(2026, 2, 12), resourceId: "build" },
];

class ResizeObserverStub {
	public observe(): void {
		return;
	}
	public unobserve(): void {
		return;
	}
	public disconnect(): void {
		return;
	}
}

/** Stubs only the browser APIs jsdom lacks. Undo with `vi.unstubAllGlobals()`. */
export function stubGanttBrowserApis(): void {
	vi.stubGlobal("ResizeObserver", ResizeObserverStub);
	HTMLElement.prototype.setPointerCapture = vi.fn();
	HTMLElement.prototype.releasePointerCapture = vi.fn();
	HTMLElement.prototype.hasPointerCapture = vi.fn((): boolean => false);
}

export interface GanttTestProvidersProps {
	readonly children: React.ReactNode;
}

/** The English label pack, as a Testing Library wrapper. */
export function GanttTestProviders({ children }: GanttTestProvidersProps): React.JSX.Element {
	return <UiKitLanguageProvider language="en">{children}</UiKitLanguageProvider>;
}
