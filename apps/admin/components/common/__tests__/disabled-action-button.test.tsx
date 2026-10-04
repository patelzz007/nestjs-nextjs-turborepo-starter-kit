// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AccessRestrictedNotice } from "@/components/common/access-restricted-notice";
import { DisabledActionButton } from "@/components/common/disabled-action-button";

afterEach(() => {
	cleanup();
});

describe("DisabledActionButton", () => {
	it("renders a focusable, aria-disabled button described by the reason", () => {
		render(<DisabledActionButton reason="Creating requires the create permission.">New Product</DisabledActionButton>);

		const button = screen.getByRole("button", { name: "New Product" });
		// Focusable (not `disabled`) so keyboard users reach the explanation; announced as unavailable.
		expect(button.getAttribute("aria-disabled")).toBe("true");
		expect(button.hasAttribute("disabled")).toBe(false);
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

const onSubmitSpy = vi.fn<(event: React.SubmitEvent<HTMLFormElement>) => void>();

describe("DisabledActionButton click", () => {
	it("swallows the click", () => {
		render(
			<form onSubmit={onSubmitSpy}>
				<DisabledActionButton reason="Not allowed.">Submit</DisabledActionButton>
			</form>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Submit" }));
		expect(onSubmitSpy).not.toHaveBeenCalled();
	});
});
