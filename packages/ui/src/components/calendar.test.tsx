// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { Calendar } from "./calendar";

afterEach((): void => {
	cleanup();
});

describe("Calendar", () => {
	it("forwards its ref to the calendar root", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(<Calendar ref={ref} mode="single" defaultMonth={new Date(2026, 3, 1)} />);
		expect(ref.current?.dataset.slot).toBe("calendar");
	});

	it("sizes the weekday header through the calendar caption token", (): void => {
		const { container } = render(<Calendar mode="single" defaultMonth={new Date(2026, 3, 1)} />);
		const weekday = container.querySelector(".rdp-weekday");
		expect(weekday?.className).toContain("text-[length:var(--text-calendar-caption)]");
	});

	it("moves DOM focus to the day react-day-picker marks as focused during keyboard navigation", (): void => {
		const { container } = render(<Calendar mode="single" defaultMonth={new Date(2026, 3, 1)} />);
		const firstDay = container.querySelector<HTMLButtonElement>("button[data-day]");
		expect(firstDay).not.toBeNull();
		act((): void => {
			firstDay?.focus();
		});
		fireEvent.keyDown(document.activeElement ?? container, { key: "ArrowRight" });
		const focused = document.activeElement;
		expect(focused).not.toBe(firstDay);
		expect(focused?.hasAttribute("data-day")).toBe(true);
	});
});
