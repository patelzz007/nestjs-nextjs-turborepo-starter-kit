// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { describe, expect, it } from "vitest";

import { installJsdomUiShims } from "@/testing/jsdom-ui-shims";
import { EventCalendar3Example } from "@/components/component-showcase/examples/event-calendar/event-calendar-3";
import { EventCalendar4Example } from "@/components/component-showcase/examples/event-calendar/event-calendar-4";

describe("EventCalendar example interactions", (): void => {
	installJsdomUiShims();

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
