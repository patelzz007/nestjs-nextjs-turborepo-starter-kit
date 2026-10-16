// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import MerchantOrgPageError from "@/app/orgs/[orgSlug]/error";

afterEach((): void => {
	cleanup();
});

describe("MerchantOrgPageError", () => {
	it("shows a user-safe message with the support reference, never the error's own text, and retries", () => {
		const retry = vi.fn();
		const error = Object.assign(new Error("organizations.analytics failed during server render: HTTP 503"), { digest: "abc123" });
		render(<MerchantOrgPageError error={error} retry={retry} />);

		expect(screen.getByRole("alert").textContent).toContain("abc123");
		expect(screen.queryByText(/HTTP 503/u)).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Try again" }));
		expect(retry).toHaveBeenCalled();
	});
});
