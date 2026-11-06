// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { SelectShowcase } from "../select-showcase";

afterEach(() => {
	cleanup();
});

describe("SelectShowcase TanStack Form card", () => {
	it("validates both selects with the schema when saved empty", async () => {
		render(<SelectShowcase />, { wrapper: UiKitTestProviders });

		fireEvent.click(screen.getByRole("button", { name: "Save assignment" }));

		await waitFor((): void => {
			expect(screen.getByText("Pick a language")).toBeTruthy();
			expect(screen.getByText("Pick at least 2 teams")).toBeTruthy();
		});
		expect(screen.getByRole("combobox", { name: "Language" }).getAttribute("aria-invalid")).toBe("true");
	});
});
