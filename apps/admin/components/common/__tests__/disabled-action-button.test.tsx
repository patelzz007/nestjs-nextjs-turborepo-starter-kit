// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { AccessRestrictedNotice } from "@/components/common/access-restricted-notice";
import { DisabledActionButton } from "@/components/common/disabled-action-button";

afterEach(() => {
	cleanup();
});

describe("DisabledActionButton", () => {
	it("renders a disabled button described by the reason", () => {
		render(<DisabledActionButton reason="Creating requires the create permission.">New Product</DisabledActionButton>);

		const button = screen.getByRole("button", { name: "New Product" });
		expect(button.hasAttribute("disabled")).toBe(true);
		expect(button.getAttribute("aria-describedby")).not.toBeNull();
		expect(screen.getByText("Creating requires the create permission.")).toBeDefined();
	});
});

describe("AccessRestrictedNotice", () => {
	it("renders the default title with the description", () => {
		render(<AccessRestrictedNotice description="Needs update access." />);

		expect(screen.getByRole("note")).toBeDefined();
		expect(screen.getByText("Read-only access")).toBeDefined();
		expect(screen.getByText("Needs update access.")).toBeDefined();
	});
});
