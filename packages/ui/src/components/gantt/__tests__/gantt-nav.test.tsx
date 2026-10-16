// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Gantt } from "../gantt";
import type { GanttI18nOverrides } from "../gantt-i18n";
import {
	GANTT_SCALES,
	GanttDatePicker,
	GanttNav,
	GanttNavNext,
	GanttNavPrev,
	GanttNavToday,
	ganttNavVariants,
	GanttScaleSwitcher,
	GanttTitle,
	GanttToolbar,
} from "../gantt-nav";
import type { GanttScale } from "../gantt-types";
import { GanttTestProviders, stubGanttBrowserApis, TEST_CLOCK, TEST_TIME_ZONE, utc } from "@workspace/ui/testing/gantt-testing";

const GERMAN: GanttI18nOverrides = { labels: { today: "Heute", next: "Weiter", previous: "Zurück", scales: { week: "Woche", month: "Monat" } } };

interface HarnessProps {
	readonly children: React.ReactNode;
	readonly onScaleChange?: (scale: GanttScale) => void;
	readonly i18n?: GanttI18nOverrides;
}

function Harness({ children, onScaleChange, i18n }: HarnessProps): React.JSX.Element {
	return (
		<Gantt defaultScale="week" defaultDate={utc(2026, 2, 10)} timeZone={TEST_TIME_ZONE} clock={TEST_CLOCK} onScaleChange={onScaleChange} i18n={i18n}>
			{children}
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

describe("GanttNav", (): void => {
	it("composes Today, the scale switcher, prev/next and the title", (): void => {
		render(
			<Harness>
				<GanttNav />
			</Harness>,
			{ wrapper: GanttTestProviders },
		);
		expect(screen.getByRole("button", { name: "Today" }).getAttribute("data-active")).toBe("");
		expect(screen.getByRole("button", { name: "Previous" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Select view" }).textContent).toContain("Week");
		expect(document.querySelector("[data-slot=gantt-title]")?.textContent).toBe("March 8 – 14, 2026");
	});

	it("navigates with prev / next / today", (): void => {
		render(
			<Harness>
				<GanttNavPrev />
				<GanttNavNext />
				<GanttNavToday />
				<GanttTitle />
			</Harness>,
			{ wrapper: GanttTestProviders },
		);
		fireEvent.click(screen.getByRole("button", { name: "Next" }));
		expect(document.querySelector("[data-slot=gantt-title]")?.textContent).toBe("March 15 – 21, 2026");
		fireEvent.click(screen.getByRole("button", { name: "Previous" }));
		fireEvent.click(screen.getByRole("button", { name: "Previous" }));
		expect(document.querySelector("[data-slot=gantt-title]")?.textContent).toBe("March 1 – 7, 2026");
		fireEvent.click(screen.getByRole("button", { name: "Today" }));
		expect(document.querySelector("[data-slot=gantt-title]")?.textContent).toBe("March 8 – 14, 2026");
	});

	it("switches the scale from the menu", (): void => {
		const onScaleChange = vi.fn();
		render(
			<Harness onScaleChange={onScaleChange}>
				<GanttScaleSwitcher scales={GANTT_SCALES} />
			</Harness>,
			{ wrapper: GanttTestProviders },
		);
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Select view" }));
		});
		act((): void => {
			fireEvent.click(screen.getByRole("menuitem", { name: "Month" }));
		});
		expect(onScaleChange).toHaveBeenCalledWith("month");
		expect(screen.getByRole("button", { name: "Select view" }).textContent).toContain("Month");
	});

	it("reads overrides from the i18n prop", (): void => {
		render(
			<Harness i18n={GERMAN}>
				<GanttNav />
			</Harness>,
			{ wrapper: GanttTestProviders },
		);
		expect(screen.getByRole("button", { name: "Heute" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Weiter" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Select view" }).textContent).toContain("Woche");
	});

	it("opens the go-to-date picker", (): void => {
		render(
			<Harness>
				<GanttDatePicker />
			</Harness>,
			{ wrapper: GanttTestProviders },
		);
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Go to date" }));
		});
		expect(screen.getByRole("grid")).toBeTruthy();
	});

	it("forwards refs, merges className and formats the title", (): void => {
		const navRef = React.createRef<HTMLDivElement>();
		const toolbarRef = React.createRef<HTMLDivElement>();
		const titleRef = React.createRef<HTMLDivElement>();
		const todayRef = React.createRef<HTMLElement>();
		render(
			<Harness>
				<GanttNav ref={navRef} className="nav-x">
					<GanttTitle ref={titleRef} format={formatUpper} />
					<GanttNavToday ref={todayRef} tooltip={null} />
				</GanttNav>
				<GanttToolbar ref={toolbarRef} className="tb-x" />
			</Harness>,
			{ wrapper: GanttTestProviders },
		);
		expect(navRef.current?.className).toContain("nav-x");
		expect(toolbarRef.current?.getAttribute("data-slot")).toBe("gantt-toolbar");
		expect(toolbarRef.current?.className).toContain("tb-x");
		expect(titleRef.current?.textContent).toBe("MARCH 8 – 14, 2026");
		expect(todayRef.current?.textContent).toBe("Today");
		expect(ganttNavVariants({ state: "sticky" })).toContain("sticky");
	});
});

function formatUpper({ title }: { readonly title: string }): string {
	return title.toUpperCase();
}
