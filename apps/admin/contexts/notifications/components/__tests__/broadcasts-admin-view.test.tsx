// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SessionAbilityProvider } from "@workspace/client/lib/contexts/authorization";
import { epochMs, PERMISSION, type BroadcastResponse, type CapabilitySlug } from "@workspace/shared";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BroadcastsAdminView } from "@/contexts/notifications/components/broadcasts-admin-view";

const { broadcastsQuery, reportsQuery, approveMutate, cancelMutate, reviewMutate } = vi.hoisted(() => ({
	broadcastsQuery: vi.fn(),
	reportsQuery: vi.fn(),
	approveMutate: vi.fn(),
	cancelMutate: vi.fn(),
	reviewMutate: vi.fn(),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => ({ ...(await importOriginal<object>()), useQueryClient: (): object => ({ invalidateQueries: vi.fn() }) }));
vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({
		api: {
			notificationsAdmin: {
				broadcasts: { useQuery: broadcastsQuery },
				broadcastReports: { useQuery: reportsQuery },
				approveBroadcast: { useMutation: (): object => ({ mutate: approveMutate, isPending: false }) },
				cancelBroadcast: { useMutation: (): object => ({ mutate: cancelMutate, isPending: false }) },
				reviewBroadcastReport: { useMutation: (): object => ({ mutate: reviewMutate, isPending: false }) },
			},
		},
	}),
}));

/** Every permission the page checks: create, approve and cancel broadcasts; list and review reports. */
const BROADCAST_GRANTS: readonly CapabilitySlug[] = [
	PERMISSION.BROADCAST.CREATE,
	PERMISSION.BROADCAST.APPROVE,
	PERMISSION.BROADCAST.DELETE,
	PERMISSION.BROADCAST_REPORT.LIST,
	PERMISSION.BROADCAST_REPORT.UPDATE,
];

function Providers({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
	return (
		<UiKitTestProviders>
			<SessionAbilityProvider capabilities={BROADCAST_GRANTS} namespace="platform">
				{children}
			</SessionAbilityProvider>
		</UiKitTestProviders>
	);
}

const ID = "0193f2c4-0000-7000-8000-0000000000b1";
const NOTICE: BroadcastResponse = {
	id: ID,
	tenantId: null,
	status: "PENDING_APPROVAL",
	title: "Planned maintenance",
	body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Down for 10 minutes on Sunday." }] }] },
	audience: { kind: "platform-users", surfaces: ["CUSTOMER"], signedUpAfter: null, tenantStates: null },
	channels: ["IN_APP"],
	category: "PRODUCT",
	sendMode: "INSTANT",
	sendAt: null,
	localSendAt: null,
	audienceCount: 1200,
	authorUserId: ID,
	approverUserId: null,
	sendingStartedAt: null,
	completedAt: null,
	cancelledAt: null,
	pausedAt: null,
	pauseReason: null,
	results: [],
	openReports: 0,
	createdAt: epochMs(0),
	updatedAt: epochMs(0),
	isDeleted: false,
	deletedAt: null,
};

beforeEach((): void => {
	broadcastsQuery.mockReturnValue({ data: { data: [NOTICE] } });
	reportsQuery.mockReturnValue({
		data: {
			data: [
				{
					id: "0193f2c4-0000-7000-8000-0000000000f1",
					broadcastId: ID,
					broadcastTitle: "Flash sale",
					tenantId: ID,
					tenantName: "Sunrise Cafe",
					reason: "SPAM",
					note: null,
					status: "OPEN",
					reviewedAt: null,
					tenantStrikesInWindow: 1,
					createdAt: epochMs(0),
					updatedAt: epochMs(0),
					isDeleted: false,
					deletedAt: null,
				},
			],
		},
	});
});

afterEach((): void => {
	cleanup();
	vi.clearAllMocks();
});

describe("BroadcastsAdminView", () => {
	it("approves a notice waiting for a second person, and can still cancel it", () => {
		render(<BroadcastsAdminView />, { wrapper: Providers });
		expect(screen.getByText("Waiting for approval")).toBeTruthy();
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Approve" }));
			fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
		});

		expect(approveMutate).toHaveBeenCalledWith({ broadcastId: ID });
		expect(cancelMutate).toHaveBeenCalledWith({ broadcastId: ID });
	});

	it("reads the message on demand", () => {
		render(<BroadcastsAdminView />, { wrapper: Providers });
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Read message" }));
		});

		expect(screen.getByText("Down for 10 minutes on Sunday.")).toBeTruthy();
	});

	it("reviews an open report", () => {
		render(<BroadcastsAdminView />, { wrapper: Providers });
		expect(screen.getByText("Spam · Flash sale")).toBeTruthy();
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Uphold" }));
		});

		expect(reviewMutate).toHaveBeenCalledWith(expect.objectContaining({ reportId: "0193f2c4-0000-7000-8000-0000000000f1", decision: "uphold" }));
	});
});
