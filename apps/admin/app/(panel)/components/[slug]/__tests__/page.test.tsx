// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminBreadcrumbProvider } from "@/components/common/admin-breadcrumb";

import ComponentRoute from "../page";

const NOT_FOUND = "NEXT_NOT_FOUND";

vi.mock("next/navigation", () => ({
	notFound: (): void => {
		throw new Error(NOT_FOUND);
	},
}));

beforeEach(() => {
	vi.stubGlobal(
		"IntersectionObserver",
		vi.fn(function OffscreenObserver() {
			return { observe: vi.fn(), disconnect: vi.fn() };
		}),
	);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("/components/[slug]", () => {
	it("renders the page of the component the slug names", async () => {
		const page = await ComponentRoute({ params: Promise.resolve({ slug: "toggle-group" }) });
		render(<AdminBreadcrumbProvider pathname="/components/toggle-group">{page}</AdminBreadcrumbProvider>, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("heading", { level: 1, name: "ToggleGroup" })).toBeTruthy();
	});

	it("is a 404 for a slug the gallery does not have", async () => {
		await expect(ComponentRoute({ params: Promise.resolve({ slug: "not-a-component" }) })).rejects.toThrow(NOT_FOUND);
	});
});
