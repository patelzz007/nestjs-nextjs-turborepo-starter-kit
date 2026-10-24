// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { afterEach, describe, expect, it, vi } from "vitest";

import ComponentsLayout from "../layout";
import ComponentsPage from "../page";

vi.mock("next/navigation", () => ({
	usePathname: (): string => "/components",
}));

const cookieValue = vi.hoisted(() => ({ current: "false" }));

vi.mock("next/headers", () => ({
	cookies: (): Promise<{ get: (name: string) => { value: string } | undefined }> =>
		Promise.resolve({ get: (name: string) => (name === "admin-components-nav-open" ? { value: cookieValue.current } : undefined) }),
}));

afterEach(() => {
	cleanup();
});

describe("/components", () => {
	it("renders the gallery overview beside the gallery navigation", async () => {
		cookieValue.current = "true";
		render(await ComponentsLayout({ children: <ComponentsPage /> }), { wrapper: UiKitTestProviders });
		expect(screen.getByRole("heading", { level: 1, name: "Components" })).toBeTruthy();
		expect(screen.getByRole("navigation", { name: "Components" })).toBeTruthy();
		const actions = screen.getByRole("region", { name: "Actions" });
		expect(
			within(actions)
				.getByRole("link", { name: /^Button\b/u })
				.getAttribute("href"),
		).toBe("/components/button");
	});

	it("renders the navigation collapsed when its cookie says so", async () => {
		cookieValue.current = "false";
		render(await ComponentsLayout({ children: <ComponentsPage /> }), { wrapper: UiKitTestProviders });
		expect(screen.queryByRole("navigation", { name: "Components" })).toBeNull();
		expect(screen.getByRole("button", { name: "Show the components list" })).toBeTruthy();
	});
});
