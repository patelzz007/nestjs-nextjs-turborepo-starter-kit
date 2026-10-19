// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, useMutation, type UseMutationResult } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
	epochMs,
	type Envelope,
	type MarkRewardNotificationsReadInput,
	type OkResponse,
	type ApiPaginatedMeta,
	type RewardNotificationListQuery,
	type RewardNotificationResponse,
} from "@workspace/shared";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import type { JSX, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { envelopeFixture, META_FIXTURE } from "../../../../test/auth-fixtures";
import { NOTIFICATIONS_DROPDOWN_LABELS } from "../notifications-dropdown-labels";
import { NotificationsDropdown } from "../notifications-dropdown";

/** What the stubbed `api.rewardNotifications.list.useQuery` answers. */
interface ListQueryState {
	readonly data: Envelope<RewardNotificationResponse[]> | undefined;
	readonly isPending: boolean;
	readonly isError: boolean;
}

const mocks = vi.hoisted(() => ({
	listState: vi.fn<() => ListQueryState>(),
	/** How many unread notifications the unread-filtered list reports in `meta.total`. */
	unreadTotal: vi.fn<() => number>(),
	markRead: vi.fn<(input: MarkRewardNotificationsReadInput) => Promise<Envelope<OkResponse>>>(),
}));

vi.mock("../../../contexts/identity", () => {
	const api = {
		rewardNotifications: {
			// The preview page, or — asked with the unread filter — the smallest page whose `meta.total` is the badge.
			list: {
				useQuery: (input: RewardNotificationListQuery): ListQueryState =>
					input.filter?.readAt?.isNull === true ? { data: pageOf([], mocks.unreadTotal()), isPending: false, isError: false } : mocks.listState(),
			},
			read: {
				// A real TanStack mutation over the stubbed request, so its lifecycle runs like the app's.
				useMutation: (): UseMutationResult<Envelope<OkResponse>, Error, MarkRewardNotificationsReadInput> =>
					useMutation({ mutationFn: (input: MarkRewardNotificationsReadInput): Promise<Envelope<OkResponse>> => mocks.markRead(input) }),
			},
		},
	};
	return { useAuth: (): { readonly api: typeof api } => ({ api }) };
});

const CREATED_AT = epochMs(1_790_000_000_000);

function notice(id: string, title: string, readAt: number | null): RewardNotificationResponse {
	return {
		id,
		type: "reward_approved",
		title,
		body: `${title} body`,
		readAt: readAt === null ? null : epochMs(readAt),
		metadata: null,
		createdAt: CREATED_AT,
		updatedAt: CREATED_AT,
		isDeleted: false,
		deletedAt: null,
	};
}

/** A page of the inbox with its pagination `meta`. */
function pageOf(items: RewardNotificationResponse[], total = items.length): Envelope<RewardNotificationResponse[]> {
	const meta: ApiPaginatedMeta = { ...META_FIXTURE, limit: Math.max(items.length, 1), total, page: 1, totalPages: 1, nextCursor: null, hasNext: false, hasPrevious: false };
	return envelopeFixture(items, meta);
}

const UNREAD_ID = "6c1b2f0e-3d4a-4b5c-8d6e-7f8091a2b3c4";
const READ_ID = "7d2c3f1e-4e5b-4c6d-9e7f-8091a2b3c4d5";

let queryClient: QueryClient;

function Providers({ children }: { readonly children: ReactNode }): JSX.Element {
	return (
		<QueryClientProvider client={queryClient}>
			<UiKitTestProviders>{children}</UiKitTestProviders>
		</QueryClientProvider>
	);
}

function openDropdown(): void {
	fireEvent.click(screen.getByRole("button", { name: /Notifications/u }));
}

beforeEach(() => {
	queryClient = new QueryClient();
	mocks.listState.mockReturnValue({
		data: pageOf([notice(UNREAD_ID, "Reward approved", null), notice(READ_ID, "Weekly summary", CREATED_AT + 1)]),
		isPending: false,
		isError: false,
	});
	mocks.unreadTotal.mockReturnValue(1);
	mocks.markRead.mockResolvedValue(envelopeFixture({ ok: true }));
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("NotificationsDropdown", () => {
	it("counts every unread notification from meta, not the preview's rows", () => {
		mocks.unreadTotal.mockReturnValue(12);
		render(<NotificationsDropdown />, { wrapper: Providers });

		expect(screen.getByRole("button", { name: "Notifications, 12 unread" })).toBeDefined();
	});

	it("names the unread count on the trigger and lists the newest notifications from the inbox", async () => {
		render(<NotificationsDropdown />, { wrapper: Providers });

		expect(screen.getByRole("button", { name: "Notifications, 1 unread" })).toBeDefined();
		openDropdown();

		expect(await screen.findByText("Reward approved")).toBeDefined();
		expect(screen.getByText("Weekly summary")).toBeDefined();
		expect(screen.getByText("1 new")).toBeDefined();
		expect(screen.queryByText(NOTIFICATIONS_DROPDOWN_LABELS.viewAll)).toBeNull();
	});

	it("marks an unread notification read when it is opened, and leaves a read one alone", async () => {
		render(<NotificationsDropdown />, { wrapper: Providers });
		openDropdown();

		fireEvent.click(await screen.findByText("Weekly summary"));
		fireEvent.click(screen.getByText("Reward approved"));

		await waitFor(() => {
			expect(mocks.markRead).toHaveBeenCalledTimes(1);
		});
		expect(mocks.markRead).toHaveBeenCalledWith({ notificationIds: [UNREAD_ID] });
	});

	it("says when there is nothing to show, and when the inbox could not be loaded", async () => {
		mocks.listState.mockReturnValue({ data: pageOf([]), isPending: false, isError: false });
		mocks.unreadTotal.mockReturnValue(0);
		const { unmount } = render(<NotificationsDropdown />, { wrapper: Providers });
		expect(screen.getByRole("button", { name: "Notifications" })).toBeDefined();
		openDropdown();
		expect(await screen.findByText(NOTIFICATIONS_DROPDOWN_LABELS.empty)).toBeDefined();
		unmount();

		mocks.listState.mockReturnValue({ data: undefined, isPending: false, isError: true });
		render(<NotificationsDropdown />, { wrapper: Providers });
		openDropdown();
		expect(await screen.findByText(NOTIFICATIONS_DROPDOWN_LABELS.loadError)).toBeDefined();
	});

	it("links to the full inbox only when the app has one", async () => {
		render(<NotificationsDropdown viewAllHref="/notifications" />, { wrapper: Providers });
		openDropdown();

		expect((await screen.findByText(NOTIFICATIONS_DROPDOWN_LABELS.viewAll)).closest("a")?.getAttribute("href")).toBe("/notifications");
	});
});
