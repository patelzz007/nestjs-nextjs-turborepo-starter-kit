// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WebSessionTestProvider, type WebSessionState } from "@/components/auth/web-authorization-provider";
import { RewardHubTopbar } from "@/components/layout/reward-hub-topbar";
import { GUEST_SESSION_STATE, signedInSession } from "@/test-support/session";

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): { readonly user: null; readonly logout: () => Promise<void> } => ({ user: null, logout: (): Promise<void> => Promise.resolve() }),
}));

vi.mock("next/navigation", () => ({
	usePathname: (): string => "/rewardhub",
	useRouter: (): { readonly push: () => void } => ({ push: (): void => undefined }),
}));

/** Keep the chrome out of the way — the test only cares about gated children. */
vi.mock("@workspace/ui/components/navigation/app-shell-topbar", () => ({
	AppShellTopbar: ({ children }: { readonly children: React.ReactNode }): React.JSX.Element => <header>{children}</header>,
	useCommandPaletteShortcut: (): void => undefined,
}));

vi.mock("@/components/layout/web-notifications-dropdown", () => ({
	WebNotificationsDropdown: (): null => null,
}));

vi.mock("@workspace/ui/components/navigation/shell-theme-toggle", () => ({
	ShellThemeToggle: (): null => null,
}));

function renderTopbar(session: WebSessionState): void {
	render(
		<WebSessionTestProvider session={session}>
			<RewardHubTopbar />
		</WebSessionTestProvider>,
	);
}

afterEach(() => {
	cleanup();
});

describe("RewardHubTopbar", () => {
	it("links to account settings for signed-in users", () => {
		renderTopbar(signedInSession());

		expect(screen.getByRole("link", { name: "Settings" }).getAttribute("href")).toBe("/rewardhub/settings");
	});

	it("hides the settings link from anonymous visitors", () => {
		renderTopbar(GUEST_SESSION_STATE);

		expect(screen.queryByRole("link", { name: "Settings" })).toBeNull();
	});
});
