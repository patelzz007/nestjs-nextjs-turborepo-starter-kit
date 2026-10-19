// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { ApiPaginatedMetaSchema, epochMs, type ApiPaginatedMeta, type SignupReferralDashboard, type SignupReferralRefereeItem } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { REFEREES_LOADING_LABELS, REFERRAL_CODE_LOADING_LABELS } from "@/components/loading/loading-labels";
import { SignupReferralPageView } from "@/contexts/referrals/components/signup-referral-page-view";
import { countSlots, expectSingleLoadingStatus } from "@/test-support/skeleton";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";

const EXPIRES_AT = 1_800_000_000_000;
const JOINED_AT = 1_799_000_000_000;

interface DashboardQueryStub {
	readonly data: { readonly data: SignupReferralDashboard } | undefined;
}

interface RefereesQueryStub {
	readonly data: { readonly data: readonly SignupReferralRefereeItem[]; readonly meta: ApiPaginatedMeta } | undefined;
	readonly isLoading?: boolean;
}

const { dashboardUseQuery, refereesUseQuery } = vi.hoisted(() => ({
	dashboardUseQuery: vi.fn<() => DashboardQueryStub>(),
	refereesUseQuery: vi.fn<() => RefereesQueryStub>(),
}));

vi.mock("next/navigation", () => ({
	useRouter: (): { readonly push: () => void } => ({ push: () => undefined }),
	useSearchParams: (): URLSearchParams => new URLSearchParams(window.location.search),
}));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({ api: { auth: { signupReferralsDashboard: { useQuery: dashboardUseQuery }, signupReferralsReferees: { useQuery: refereesUseQuery } } } }),
}));

function meta(total: number): ApiPaginatedMeta {
	return ApiPaginatedMetaSchema.parse({
		correlationId: "test",
		timestamp: EXPIRES_AT,
		limit: 10,
		total,
		page: 1,
		totalPages: 1,
		nextCursor: null,
		hasNext: false,
		hasPrevious: false,
	});
}

function showDashboard(dashboard: SignupReferralDashboard): void {
	dashboardUseQuery.mockReturnValue({ data: { data: dashboard } });
}

beforeEach((): void => {
	window.history.replaceState(null, "", "/dashboard/referrals");
	refereesUseQuery.mockReturnValue({ data: { data: [], meta: meta(0) } });
});

afterEach((): void => {
	cleanup();
	vi.clearAllMocks();
});

describe("SignupReferralPageView code panel", () => {
	it("offers the copy control only for an active code", () => {
		showDashboard({ code: "AB23CD45", expiresAt: epochMs(EXPIRES_AT), shareable: true, codeState: "active" });
		render(<SignupReferralPageView />);

		expect(screen.getByText("AB23CD45")).toBeDefined();
		expect(screen.getByRole("button", { name: /copy code/i })).toBeDefined();
		expect(screen.getByText(/valid until/i)).toBeDefined();
	});

	it("labels an expired code and does not let it be copied", () => {
		showDashboard({ code: "AB23CD45", expiresAt: epochMs(EXPIRES_AT), shareable: false, codeState: "expired" });
		render(<SignupReferralPageView />);

		expect(screen.getByText("AB23CD45")).toBeDefined();
		expect(screen.getByText("Code expired")).toBeDefined();
		expect(screen.queryByRole("button", { name: /copy code/i })).toBeNull();
		expect(screen.getByText(/^Expired/)).toBeDefined();
	});

	it("labels a deactivated owner's code as unavailable, not expired", () => {
		showDashboard({ code: "AB23CD45", expiresAt: epochMs(EXPIRES_AT), shareable: false, codeState: "unavailable" });
		render(<SignupReferralPageView />);

		expect(screen.getByText("Code unavailable")).toBeDefined();
		expect(screen.queryByText("Code expired")).toBeNull();
		expect(screen.queryByRole("button", { name: /copy code/i })).toBeNull();
	});

	it("explains a code that is not issued yet without inventing one", () => {
		showDashboard({ code: null, expiresAt: null, shareable: false, codeState: "pending" });
		render(<SignupReferralPageView />);

		expect(screen.getByText("Your code is not ready yet.")).toBeDefined();
		expect(screen.queryByRole("button", { name: /copy code/i })).toBeNull();
	});
});

describe("SignupReferralPageView referee list", () => {
	beforeEach((): void => {
		showDashboard({ code: "AB23CD45", expiresAt: epochMs(EXPIRES_AT), shareable: true, codeState: "active" });
	});

	it("shows each referee's name and status label, never an email", () => {
		refereesUseQuery.mockReturnValue({
			data: {
				data: [
					{ fullName: "Carol Referee", createdAt: epochMs(JOINED_AT), status: "not_redeemed" },
					{ fullName: "Bob Referee", createdAt: epochMs(JOINED_AT - 1), status: "redeemed" },
				],
				meta: meta(2),
			},
		});
		render(<SignupReferralPageView />);

		expect(screen.getByText("Carol Referee")).toBeDefined();
		expect(screen.getByText("Not redeemed")).toBeDefined();
		expect(screen.getByText("Redeemed")).toBeDefined();
		expect(screen.queryByText(/@/)).toBeNull();
	});

	it("shows the empty state when no one has registered with the code", () => {
		render(<SignupReferralPageView />);

		expect(screen.getByText("No one has registered with your code yet.")).toBeDefined();
	});
});

describe("SignupReferralPageView loading", () => {
	it("shows a code-shaped skeleton, announced once, until the code dashboard arrives", () => {
		dashboardUseQuery.mockReturnValue({ data: undefined });
		render(<SignupReferralPageView />, { wrapper: UiKitTestProviders });

		expectSingleLoadingStatus(REFERRAL_CODE_LOADING_LABELS.loading);
		expect(screen.queryByRole("button", { name: /copy code/i })).toBeNull();
	});

	it("shows referee-row skeletons while the list loads, never the empty state", () => {
		showDashboard({ code: "AB23CD45", expiresAt: epochMs(EXPIRES_AT), shareable: true, codeState: "active" });
		refereesUseQuery.mockReturnValue({ data: undefined, isLoading: true });
		const { container } = render(<SignupReferralPageView />, { wrapper: UiKitTestProviders });

		expectSingleLoadingStatus(REFEREES_LOADING_LABELS.loading);
		expect(countSlots(container, "referee-row-skeleton")).toBeGreaterThan(0);
		expect(screen.queryByText("No one has registered with your code yet.")).toBeNull();
	});
});
