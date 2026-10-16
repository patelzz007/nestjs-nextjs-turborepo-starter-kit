// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RouteErrorState } from "@/components/web-ui/route-error-state";

afterEach((): void => {
	cleanup();
});

describe("RouteErrorState", () => {
	it("offers a retry that calls back", () => {
		const onRetry = vi.fn<() => void>();
		render(<RouteErrorState onRetry={onRetry} />);

		expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Try again" }));
		expect(onRetry).toHaveBeenCalledTimes(1);
	});

	it("quotes the server error digest as a support reference", () => {
		render(<RouteErrorState digest="3141592653" onRetry={vi.fn<() => void>()} />);

		expect(screen.getByText(/quote reference 3141592653/)).toBeTruthy();
	});
});
