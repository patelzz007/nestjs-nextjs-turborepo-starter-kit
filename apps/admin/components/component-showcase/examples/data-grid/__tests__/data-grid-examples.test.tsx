// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { describe, expect, it } from "vitest";

import { installJsdomUiShims } from "@/testing/jsdom-ui-shims";
import { DataGrid1Example } from "@/components/component-showcase/examples/data-grid/data-grid-1";

describe("DataGrid example interactions", (): void => {
	installJsdomUiShims();

	it("pages forward through the name-sorted people", (): void => {
		render(<DataGrid1Example />, { wrapper: UiKitTestProviders });
		// Sorted by name, descending, five per page: Nick Johnson is on page 1, Liam Thompson on page 2.
		expect(screen.getByText("Nick Johnson")).toBeTruthy();
		expect(screen.queryByText("Liam Thompson")).toBeNull();
		expect(screen.getByRole("button", { name: "Go to previous page" }).hasAttribute("disabled")).toBe(true);

		fireEvent.click(screen.getByRole("button", { name: "Go to next page" }));

		expect(screen.getByText("Liam Thompson")).toBeTruthy();
		expect(screen.queryByText("Nick Johnson")).toBeNull();
		expect(screen.getByRole("button", { name: "Go to page 2" }).getAttribute("aria-current")).toBe("page");
	});
});
