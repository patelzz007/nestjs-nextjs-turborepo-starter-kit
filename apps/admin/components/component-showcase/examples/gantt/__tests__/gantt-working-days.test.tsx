// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { toZoned } from "@workspace/ui/components/gantt/gantt-lib";
import { addWorkdays, countWorkdays, Gantt8Example, nextWorkday, OFF_DAYS, shiftDays } from "@/components/component-showcase/examples/gantt/gantt-8";
import { installJsdomUiShims } from "@/testing/jsdom-ui-shims";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";

/** Wednesday 17 June 2026 at midnight in the example's zone; the holiday is Friday the 19th. */
const WEDNESDAY = shiftDays(new Date("2026-06-17T12:00:00-04:00"), 0);

function dayOfMonth(day: Date): number {
	return toZoned(day, "America/New_York").getDate();
}

describe("the working-days example", () => {
	installJsdomUiShims();

	it("counts working days, skipping the weekend and the Friday holiday", () => {
		// Wednesday to the next Wednesday: Wed, Thu, (Fri holiday), (Sat), (Sun), Mon, Tue.
		expect(countWorkdays(WEDNESDAY, shiftDays(WEDNESDAY, 7), OFF_DAYS)).toBe(4);
	});

	it("ends a span after its working days, and moves an off-day start to the next working day", () => {
		expect(dayOfMonth(addWorkdays(WEDNESDAY, 4, OFF_DAYS))).toBe(24);
		expect(dayOfMonth(nextWorkday(shiftDays(WEDNESDAY, 2), OFF_DAYS))).toBe(22);
		expect(nextWorkday(WEDNESDAY, OFF_DAYS).getTime()).toBe(WEDNESDAY.getTime());
	});

	it("explains the rule before anything moves", () => {
		render(<Gantt8Example />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("status").textContent).toBe("Drop a bar on a weekend or the holiday: it starts on the next working day.");
	});
});
