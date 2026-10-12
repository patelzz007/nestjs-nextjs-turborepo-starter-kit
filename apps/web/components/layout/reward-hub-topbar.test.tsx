// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { SidebarProvider } from "@workspace/ui/components/sidebar";
import { createNoopSidebarStorage } from "@workspace/ui/lib/sidebar/storage";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RewardHubTopbar } from "@/components/layout/reward-hub-topbar";

/** The trail and the bell read app state; the header only places them. */
vi.mock("@/components/layout/web-shell-breadcrumb", () => ({
	WebShellBreadcrumb: (): React.JSX.Element => <nav aria-label="Breadcrumb">Rewards</nav>,
}));

vi.mock("@/components/layout/web-notifications-dropdown", () => ({
	WebNotificationsDropdown: (): React.JSX.Element => <button type="button">Notifications</button>,
}));

afterEach(() => {
	cleanup();
});

describe("RewardHubTopbar", () => {
	it("is the shared page header: the breadcrumb trail, notifications and search", () => {
		render(
			<SidebarProvider storage={createNoopSidebarStorage()}>
				<RewardHubTopbar />
			</SidebarProvider>,
			{ wrapper: UiKitTestProviders },
		);

		const header = screen.getByRole("banner");
		expect(header.getAttribute("data-slot")).toBe("app-shell-header");
		expect(screen.getByRole("navigation", { name: "Breadcrumb" }).textContent).toBe("Rewards");
		expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Search pages" })).toBeTruthy();
	});
});
