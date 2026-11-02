// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { epochMs, type BroadcastResponse } from "@workspace/shared";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { audienceSummaryOf, PlatformBroadcastDetailView, sendTimeOf } from "@/contexts/notifications/components/platform-broadcast-pages";

const { broadcastData, scheduleMutate, approveMutate, cancelMutate } = vi.hoisted(() => ({
	broadcastData: vi.fn<() => BroadcastResponse>(),
	scheduleMutate: vi.fn(),
	approveMutate: vi.fn(),
	cancelMutate: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: (): object => ({ push: vi.fn() }) }));
vi.mock("@workspace/client/lib/contexts/authorization", () => ({ useAuthorization: (): object => ({ can: (): boolean => true }) }));
vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({
		api: {
			notificationsAdmin: {
				broadcast: { useQuery: (): object => ({ data: { data: broadcastData() } }) },
				scheduleBroadcast: { useMutation: (): object => ({ mutate: scheduleMutate, isPending: false }) },
				approveBroadcast: { useMutation: (): object => ({ mutate: approveMutate, isPending: false }) },
				cancelBroadcast: { useMutation: (): object => ({ mutate: cancelMutate, isPending: false }) },
			},
		},
	}),
}));

const NOW = Date.UTC(2026, 10, 1, 0, 0);
const ID = "0193f2c4-0000-7000-8000-0000000000b1";

function broadcast(overrides: Partial<BroadcastResponse> = {}): BroadcastResponse {
	return {
		id: ID,
		tenantId: null,
		status: "DRAFT",
		title: "Maintenance",
		body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Planned maintenance on Sunday." }] }] },
		audience: { kind: "platform-users", surfaces: ["CUSTOMER", "MERCHANT"], signedUpAfter: null, tenantStates: ["ACTIVE"] },
		channels: ["IN_APP", "EMAIL"],
		category: "PRODUCT",
		sendMode: "INSTANT",
		sendAt: null,
		localSendAt: null,
		audienceCount: null,
		authorUserId: "0193f2c4-0000-7000-8000-0000000000d1",
		approverUserId: null,
		sendingStartedAt: null,
		completedAt: null,
		cancelledAt: null,
		pausedAt: null,
		pauseReason: null,
		results: [],
		openReports: 0,
		createdAt: epochMs(NOW),
		updatedAt: epochMs(NOW),
		isDeleted: false,
		deletedAt: null,
		...overrides,
	};
}

function renderDetail(): void {
	render(
		<QueryClientProvider client={new QueryClient()}>
			<PlatformBroadcastDetailView broadcastId={ID} />
		</QueryClientProvider>,
		{ wrapper: UiKitTestProviders },
	);
}

afterEach((): void => {
	cleanup();
	vi.clearAllMocks();
});

describe("audienceSummaryOf and sendTimeOf", () => {
	it("say who a notice goes to and when, in words", () => {
		expect(audienceSummaryOf(broadcast())).toBe("Customers, Merchant staff; only active stores");
		expect(audienceSummaryOf(broadcast({ audience: { kind: "tenant-customers", claimedWithinDays: 60, redeemed: "any", locationId: null, customerIds: null } }))).toBe(
			"A tenant's own customers",
		);
		expect(
			audienceSummaryOf(broadcast({ audience: { kind: "platform-users", surfaces: ["ADMIN"], signedUpAfter: epochMs(Date.UTC(2026, 9, 1, 12)), tenantStates: null } })),
		).toBe("Platform staff; signed up since 1 Oct 2026");
		expect(sendTimeOf(broadcast())).toBe("As soon as it is sent");
		expect(sendTimeOf(broadcast({ sendMode: "RECIPIENT_LOCAL_TIME", localSendAt: epochMs(Date.UTC(2026, 10, 3, 9, 0)) }))).toBe(
			"3 Nov 2026, 09:00, in each person's own time",
		);
	});
});

describe("PlatformBroadcastDetailView", () => {
	it("shows a draft's message and details, and sends it", () => {
		broadcastData.mockReturnValue(broadcast());
		renderDetail();

		expect(screen.getByRole("heading", { name: "Maintenance" })).toBeTruthy();
		expect(screen.getByText("Planned maintenance on Sunday.")).toBeTruthy();
		expect(screen.getByText("In the app, Email")).toBeTruthy();
		expect(screen.getByRole("link", { name: "Edit" }).getAttribute("href")).toBe(`/emails/broadcasts/${ID}/edit`);
		fireEvent.click(screen.getByRole("button", { name: "Send" }));
		expect(scheduleMutate).toHaveBeenCalledWith({ broadcastId: ID });
	});

	it("offers approval while it waits for a second person, and cancelling until it finishes", () => {
		broadcastData.mockReturnValue(broadcast({ status: "PENDING_APPROVAL" }));
		renderDetail();

		expect(screen.queryByRole("link", { name: "Edit" })).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Approve" }));
		expect(approveMutate).toHaveBeenCalledWith({ broadcastId: ID });
		fireEvent.click(screen.getByRole("button", { name: "Cancel broadcast" }));
		expect(cancelMutate).toHaveBeenCalledWith({ broadcastId: ID });
	});

	it("totals the results of a sent notice, with nothing left to do", () => {
		broadcastData.mockReturnValue(
			broadcast({
				status: "SENT",
				audienceCount: 40,
				results: [{ channel: "EMAIL", targeted: 40, delivered: 37, failed: 1, suppressed: [{ reason: "no-consent", count: 2 }], engaged: null }],
			}),
		);
		renderDetail();

		expect(screen.getByText("37 delivered, 2 held back, 1 failed")).toBeTruthy();
		expect(screen.getByText("40 recipients.")).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Cancel broadcast" })).toBeNull();
	});
});
