// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { describe, expect, it } from "vitest";

import { describeGalleryExamples, installGalleryExampleShims } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";
import { EVENT_CALENDAR_EXAMPLES } from "@/components/component-gallery/examples/event-calendar";
import { EventCalendar3Example } from "@/components/component-gallery/examples/event-calendar/event-calendar-3";
import { EventCalendar4Example } from "@/components/component-gallery/examples/event-calendar/event-calendar-4";

describeGalleryExamples("EventCalendar", EVENT_CALENDAR_EXAMPLES);

describe("EventCalendar example interactions", (): void => {
	installGalleryExampleShims();

	it("steps the month view to the next period", (): void => {
		render(<EventCalendar4Example />, { wrapper: UiKitTestProviders });
		// Every example pins its clock to 17 June 2026.
		expect(screen.getByText("June 2026")).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Next" }));

		expect(screen.getByText("July 2026")).toBeTruthy();
		expect(screen.queryByText("June 2026")).toBeNull();
	});

	it("adds a project from the toolbar and shows it on the calendar", (): void => {
		render(<EventCalendar4Example />, { wrapper: UiKitTestProviders });
		expect(screen.queryAllByText("New project")).toHaveLength(1);

		fireEvent.click(screen.getByRole("button", { name: "New project" }));

		expect(screen.queryAllByText("New project").length).toBeGreaterThan(1);
	});

	it("opens the create dialog from the Add event button", (): void => {
		render(<EventCalendar3Example />, { wrapper: UiKitTestProviders });

		fireEvent.click(screen.getByRole("button", { name: "Add event" }));

		expect(screen.getByRole("dialog", { name: "New event" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Create event" }).hasAttribute("disabled")).toBe(true);
	});
});
