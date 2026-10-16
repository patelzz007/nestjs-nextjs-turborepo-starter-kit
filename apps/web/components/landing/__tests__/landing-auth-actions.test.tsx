// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { AuthUser } from "@workspace/client/lib/auth";
import type { OwnAvatarImage } from "@workspace/client/lib/auth/profile/use-own-avatar";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WebSessionTestProvider, type WebSessionState } from "@/components/auth/web-authorization-provider";
import { LandingAuthActions } from "@/components/landing/landing-auth-actions";
import { GUEST_SESSION_STATE, signedInSession } from "@/test-support/session";

/** The profile the auth facade returns in each test (`null` until a session is verified). */
let currentUser: AuthUser | null;

vi.mock("@workspace/client/lib/auth", () => ({
	useAuthUser: (): AuthUser | null => currentUser,
	useAuthCommands: (): { readonly logout: () => Promise<void> } => ({ logout: (): Promise<void> => Promise.resolve() }),
}));

vi.mock("next/navigation", () => ({
	useRouter: (): { readonly push: () => void } => ({ push: (): void => undefined }),
}));

vi.mock("@workspace/ui/components/shell-theme-toggle", () => ({
	ShellThemeToggle: (): null => null,
}));

/** The member's profile picture as the own-profile query returns it (`null`: initials). */
let currentAvatar: OwnAvatarImage | null;

vi.mock("@workspace/client/lib/auth/profile/use-own-avatar", () => ({
	useOwnAvatar: (): OwnAvatarImage | null => currentAvatar,
}));

vi.mock("@workspace/ui/components/app-shell-profile-dropdown", () => ({
	AppShellProfileDropdown: ({ name, avatar }: { readonly name: string; readonly avatar: OwnAvatarImage | null }): React.JSX.Element => (
		<button type="button" data-avatar={avatar?.url ?? "initials"}>
			{name}
		</button>
	),
}));

const MEMBER: AuthUser = {
	id: "user-1",
	email: "ada@example.com",
	fullName: "Ada Member",
	isSuperAdmin: false,
	hasAdminAccess: false,
	isEmailVerified: true,
	sessionScope: "full",
	enrollmentReason: null,
	roles: [],
};

/** A member whose session the client has not verified yet: the server saw the cookie, the check has no verdict. */
const UNVERIFIED_MEMBER: WebSessionState = { ...GUEST_SESSION_STATE, isAuthenticated: true, isResolved: false };

function renderActions(session: WebSessionState): void {
	render(
		<WebSessionTestProvider session={session}>
			<LandingAuthActions />
		</WebSessionTestProvider>,
	);
}

beforeEach((): void => {
	currentUser = null;
	currentAvatar = null;
});

afterEach((): void => {
	cleanup();
});

describe("LandingAuthActions", () => {
	it("offers Sign in to a guest", () => {
		renderActions(GUEST_SESSION_STATE);

		expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toContain("/auth/login");
	});

	it("shows the member's profile menu once the session is verified", () => {
		currentUser = MEMBER;
		renderActions(signedInSession());

		expect(screen.getByRole("button", { name: "Ada Member" })).toBeDefined();
		expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
	});

	it("shows the member's profile picture on the menu's trigger", () => {
		currentUser = MEMBER;
		currentAvatar = { url: "https://cdn.example.com/users/ada/avatar.webp", sources: [{ width: 128, url: "https://cdn.example.com/users/ada/thumbnail.webp" }] };
		renderActions(signedInSession());

		expect(screen.getByRole("button", { name: "Ada Member" }).getAttribute("data-avatar")).toBe("https://cdn.example.com/users/ada/avatar.webp");
	});

	it("never shows Sign in to a member whose session is not verified yet (check running, or the API unreachable)", () => {
		renderActions(UNVERIFIED_MEMBER);

		expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Ada Member" })).toBeNull();
	});
});
