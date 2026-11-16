// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AlertShowcase } from "../alert-showcase";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";

afterEach(() => {
	cleanup();
});

function gallery(): HTMLElement {
	return screen.getByRole("region", { name: "Alert" });
}

describe("AlertShowcase", () => {
	it("renders one alert per status variant, interrupting only for the destructive one", () => {
		render(<AlertShowcase />, { wrapper: UiKitTestProviders });
		expect(within(gallery()).getByRole("alert").textContent).toContain("Refresh failed");
		expect(within(gallery()).getByText("Heads up")).toBeTruthy();
		expect(within(gallery()).getByText("Deploy complete")).toBeTruthy();
		expect(within(gallery()).getByText("Storage at 82%")).toBeTruthy();
	});

	it("dismisses an alert by dropping it from page state and lists what was dismissed", () => {
		render(<AlertShowcase />, { wrapper: UiKitTestProviders });
		const headsUp = within(gallery()).getByText("Heads up").closest('[data-slot="alert"]');
		expect(headsUp).toBeTruthy();
		if (headsUp instanceof HTMLElement) {
			fireEvent.click(within(headsUp).getByRole("button", { name: "Dismiss" }));
		}
		expect(within(gallery()).queryByText("Heads up")).toBeNull();
		expect(within(gallery()).getByText("info")).toBeTruthy();
	});
});
