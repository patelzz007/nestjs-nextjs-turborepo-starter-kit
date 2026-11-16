// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { describe, expect, it } from "vitest";

import { installJsdomUiShims } from "@/testing/jsdom-ui-shims";
import { Gantt2Example } from "@/components/component-showcase/examples/gantt/gantt-2";

describe("Gantt example interactions", (): void => {
	installJsdomUiShims();

	it("steps the month timeline to the next period", (): void => {
		render(<Gantt2Example />, { wrapper: UiKitTestProviders });
		// Every example pins its clock to 17 June 2026.
		expect(screen.getByText("June 2026")).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Next" }));

		expect(screen.getByText("July 2026")).toBeTruthy();
		expect(screen.queryByText("June 2026")).toBeNull();
	});
});
