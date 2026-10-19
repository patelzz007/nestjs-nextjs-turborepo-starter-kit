// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { Envelope, OrganizationTeamInvitePreview } from "@workspace/shared";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TeamInvitePage from "@/app/team-invite/page";
import { TEAM_INVITE_LOADING_LABELS } from "@/contexts/organizations/components/team-invite/team-invite-skeletons";
import { TestQueryClientProvider } from "@/test/query-client";
import { busyRegionAnnouncements } from "@/test/skeleton";

let token: string | null = null;

const mocks = vi.hoisted(() => ({
	/** The invitation preview request — left pending, so the page stays on its loading state. */
	validateTeamInvite: vi.fn<() => Promise<Envelope<OrganizationTeamInvitePreview>>>(),
}));

vi.mock("next/navigation", () => ({
	useRouter: (): { readonly replace: () => void; readonly refresh: () => void } => ({ replace: vi.fn(), refresh: vi.fn() }),
	useSearchParams: (): { readonly get: (key: string) => string | null } => ({ get: (key: string): string | null => (key === "token" ? token : null) }),
}));

vi.mock("@workspace/client/lib/contexts/identity", () => {
	const idleMutation = (): { readonly mutate: () => void; readonly isPending: boolean } => ({ mutate: vi.fn(), isPending: false });
	const api = {
		organizations: {
			validateTeamInvite: { mutate: mocks.validateTeamInvite },
			acceptTeamInvite: { useMutation: idleMutation },
			registerAndAcceptTeamInvite: { useMutation: idleMutation },
		},
		auth: { verifyLogin: { useMutation: idleMutation } },
	};
	return {
		useAuth: (): object => ({ api, isAuthenticated: false, isLoading: false, user: null, login: vi.fn() }),
	};
});

function Providers({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
	return (
		<UiKitTestProviders>
			<TestQueryClientProvider>{children}</TestQueryClientProvider>
		</UiKitTestProviders>
	);
}

beforeEach((): void => {
	mocks.validateTeamInvite.mockReturnValue(new Promise<Envelope<OrganizationTeamInvitePreview>>((): void => undefined));
});

afterEach((): void => {
	cleanup();
	token = null;
	vi.clearAllMocks();
});

describe("TeamInvitePage loading", () => {
	it("draws the invitation's preview shape in one busy region while the link is checked", () => {
		token = "invite-token";
		render(<TeamInvitePage />, { wrapper: Providers });

		expect(busyRegionAnnouncements()).toEqual([TEAM_INVITE_LOADING_LABELS.loading]);
		expect(document.querySelectorAll('[data-slot="team-invite-detail-skeleton"]').length).toBeGreaterThan(0);
		// The card's own chrome is real while its contents load.
		expect(screen.getByText("Team invitation", { selector: "span, div" })).toBeTruthy();
		expect(screen.getByRole("link", { name: "Back home" })).toBeTruthy();
	});

	it("explains a missing token instead of loading anything", () => {
		render(<TeamInvitePage />, { wrapper: Providers });

		expect(screen.getByRole("heading", { name: "Invalid invitation link" })).toBeTruthy();
		expect(busyRegionAnnouncements()).toEqual([]);
		expect(mocks.validateTeamInvite).not.toHaveBeenCalled();
	});
});
