// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { describeGalleryExamples, installGalleryExampleShims } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";
import { CALENDAR_EXAMPLES } from "@/components/component-gallery/examples/calendar";
import { Calendar12Example } from "@/components/component-gallery/examples/calendar/calendar-12";
import { Calendar13Example } from "@/components/component-gallery/examples/calendar/calendar-13";
import { Calendar24Example } from "@/components/component-gallery/examples/calendar/calendar-24";

describeGalleryExamples("Calendar", CALENDAR_EXAMPLES);

/** The examples are relative to today: pin it to Monday 15 June 2026 (`Date` months are 0-based). */
const JUNE = 5;
const PINNED_TODAY = new Date(2026, JUNE, 15, 9, 30);

/** react-day-picker names each day button by its full date ("Monday, June 15th, 2026", plus ", selected" / "Today, …"). */
function dayButton(namePart: RegExp): HTMLElement {
	return screen.getByRole("button", { name: namePart });
}

describe("Calendar example interactions", (): void => {
	installGalleryExampleShims();

	beforeEach((): void => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(PINNED_TODAY);
	});

	afterEach((): void => {
		vi.useRealTimers();
	});

	it("jumps back to and selects today from the Today button", (): void => {
		render(<Calendar12Example />, { wrapper: UiKitTestProviders });
		// The sample selection is four weeks back, on 18 May.
		expect(dayButton(/May 18th, 2026/).getAttribute("data-selected-single")).toBe("true");

		fireEvent.click(screen.getByRole("button", { name: "Today" }));

		expect(dayButton(/June 15th, 2026/).getAttribute("data-selected-single")).toBe("true");
		expect(screen.queryByRole("button", { name: /May 18th, 2026/ })).toBeNull();
	});

	it("moves to the month picked in the year view", (): void => {
		render(<Calendar13Example />, { wrapper: UiKitTestProviders });

		fireEvent.click(screen.getByRole("button", { name: /June 2026/ }));
		fireEvent.click(screen.getByRole("button", { name: "2030" }));
		fireEvent.click(screen.getByRole("button", { name: "Mar" }));

		expect(screen.getByRole("button", { name: /March 2030/ }).getAttribute("aria-expanded")).toBe("false");
		expect(screen.queryByRole("button", { name: "2030" })).toBeNull();
		expect(dayButton(/March 20th, 2030/)).toBeTruthy();
	});

	it("shows the date picked in the popover on the trigger", (): void => {
		render(<Calendar24Example />, { wrapper: UiKitTestProviders });
		const trigger = screen.getByRole("button", { name: /Pick a date/ });

		fireEvent.click(trigger);
		const popover = screen.getByRole("dialog");
		fireEvent.click(within(popover).getByRole("button", { name: /June 20th, 2026/ }));

		expect(trigger.textContent).toContain("June 20th, 2026");
	});
});
