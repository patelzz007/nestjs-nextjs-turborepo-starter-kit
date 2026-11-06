// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, useMutation, type UseMutationResult } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
	epochMs,
	type ApiPaginatedMeta,
	type AuthClientType,
	type Envelope,
	type InAppNotificationListQuery,
	type InAppNotificationResponse,
	type MarkNotificationsReadInput,
	type NotificationUnreadCountQuery,
	type NotificationUnreadCountResponse,
	type OkResponse,
} from "@workspace/shared";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import type { JSX, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { envelopeFixture, META_FIXTURE } from "../../../../testing/auth-fixtures";
import type { LiveState } from "../../live-updates/reconnecting-event-stream";
import { NOTIFICATIONS_DROPDOWN_LABELS } from "../notifications-dropdown-labels";
import { NOTIFICATIONS_PREVIEW_LIMIT, NotificationsDropdown } from "../notifications-dropdown";
import { NOTIFICATIONS_POLL_INTERVAL_MS } from "../use-notifications-live";

/** What the stubbed `api.notifications.inbox.useQuery` answers. */
interface ListQueryState {
	readonly data: Envelope<InAppNotificationResponse[]> | undefined;
	readonly isPending: boolean;
	readonly isError: boolean;
}

interface UnreadQueryState {
	readonly data: Envelope<NotificationUnreadCountResponse> | undefined;
}

interface UnreadQueryOptions {
	readonly refetchInterval: number | false;
}

const mocks = vi.hoisted(() => ({
	clientType: vi.fn<() => AuthClientType>(),
	liveState: vi.fn<() => LiveState>(),
	listState: vi.fn<() => ListQueryState>(),
	listInputs: vi.fn<(input: InAppNotificationListQuery) => void>(),
	unread: vi.fn<() => number>(),
	unreadCalls: vi.fn<(input: NotificationUnreadCountQuery, options: UnreadQueryOptions) => void>(),
	markRead: vi.fn<(input: MarkNotificationsReadInput) => Promise<Envelope<OkResponse>>>(),
	push: vi.fn<(href: string) => void>(),
}));

vi.mock("next/navigation", () => ({ useRouter: (): { readonly push: (href: string) => void } => ({ push: mocks.push }) }));

vi.mock("../use-notifications-live", async (importOriginal: () => Promise<typeof import("../use-notifications-live")>) => ({
	...(await importOriginal()),
	useNotificationsLive: (): LiveState => mocks.liveState(),
}));

vi.mock("../../../contexts/identity", () => {
	const api = {
		notifications: {
			inbox: {
				useQuery: (input: InAppNotificationListQuery): ListQueryState => {
					mocks.listInputs(input);
					return mocks.listState();
				},
			},
			unreadCount: {
				useQuery: (input: NotificationUnreadCountQuery, options: UnreadQueryOptions): UnreadQueryState => {
					mocks.unreadCalls(input, options);
					return { data: envelopeFixture({ unread: mocks.unread() }) };
				},
			},
			read: {
				// A real TanStack mutation over the stubbed request, so its lifecycle runs like the app's.
				useMutation: (): UseMutationResult<Envelope<OkResponse>, Error, MarkNotificationsReadInput> =>
					useMutation({ mutationFn: (input: MarkNotificationsReadInput): Promise<Envelope<OkResponse>> => mocks.markRead(input) }),
			},
		},
	};
	return {
		useAuth: (): { readonly api: typeof api } => ({ api }),
		useAuthClientType: (): AuthClientType => mocks.clientType(),
	};
});

const CREATED_AT = epochMs(1_790_000_000_000);

function notice(id: string, title: string, readAt: number | null, link: string | null = null): InAppNotificationResponse {
	return {
		id,
		typeKey: "rewards.reward-approved",
		category: "ACCOUNT",
		surface: "MERCHANT",
		title,
		body: `${title} body`,
		richBody: null,
		link,
		icon: null,
		senderName: null,
		senderLogoUrl: null,
		attachment: null,
		groupCount: 1,
		broadcastId: null,
		readAt: readAt === null ? null : epochMs(readAt),
		archivedAt: null,
		createdAt: CREATED_AT,
		updatedAt: CREATED_AT,
		isDeleted: false,
		deletedAt: null,
	};
}

/** A page of the inbox with its pagination `meta`. */
function pageOf(items: InAppNotificationResponse[]): Envelope<InAppNotificationResponse[]> {
	const meta: ApiPaginatedMeta = {
		...META_FIXTURE,
		limit: Math.max(items.length, 1),
		total: items.length,
		page: 1,
		totalPages: 1,
		nextCursor: null,
		hasNext: false,
		hasPrevious: false,
	};
	return envelopeFixture(items, meta);
}

const UNREAD_ID = "6c1b2f0e-3d4a-4b5c-8d6e-7f8091a2b3c4";
const READ_ID = "7d2c3f1e-4e5b-4c6d-9e7f-8091a2b3c4d5";
const REWARD_PATH = "/t/sunrise-cafe/rewards/0193f2c4-0000-7000-8000-000000000002";

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
	mocks.clientType.mockReturnValue("merchant");
	mocks.liveState.mockReturnValue("open");
	mocks.listState.mockReturnValue({
		data: pageOf([notice(UNREAD_ID, "Reward approved", null, REWARD_PATH), notice(READ_ID, "Weekly summary", CREATED_AT + 1)]),
		isPending: false,
		isError: false,
	});
	mocks.unread.mockReturnValue(1);
	mocks.markRead.mockResolvedValue(envelopeFixture({ ok: true }));
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("NotificationsDropdown", () => {
	it("reads this app's inbox: the merchant app asks for the MERCHANT surface, archived ones left out", () => {
		render(<NotificationsDropdown />, { wrapper: Providers });

		expect(mocks.listInputs).toHaveBeenCalledWith(
			expect.objectContaining({ surface: "MERCHANT", limit: NOTIFICATIONS_PREVIEW_LIMIT, filter: { archivedAt: { isNull: true } } }),
		);
		expect(mocks.unreadCalls).toHaveBeenCalledWith({ surface: "MERCHANT" }, { refetchInterval: false });
	});

	it("asks the customer inbox from the web app", () => {
		mocks.clientType.mockReturnValue("web");
		render(<NotificationsDropdown />, { wrapper: Providers });

		expect(mocks.listInputs).toHaveBeenCalledWith(expect.objectContaining({ surface: "CUSTOMER" }));
	});

	it("polls the unread count every minute while the live stream is down", () => {
		mocks.liveState.mockReturnValue("connecting");
		render(<NotificationsDropdown />, { wrapper: Providers });

		expect(mocks.unreadCalls).toHaveBeenCalledWith({ surface: "MERCHANT" }, { refetchInterval: NOTIFICATIONS_POLL_INTERVAL_MS });
	});

	it("names the server's unread count on the trigger and lists the newest notifications", async () => {
		mocks.unread.mockReturnValue(12);
		render(<NotificationsDropdown />, { wrapper: Providers });

		expect(screen.getByRole("button", { name: "Notifications, 12 unread" })).toBeDefined();
		openDropdown();

		expect(await screen.findByText("Reward approved")).toBeDefined();
		expect(screen.getByText("Weekly summary")).toBeDefined();
		expect(screen.getByText("12 new")).toBeDefined();
		expect(screen.queryByText(NOTIFICATIONS_DROPDOWN_LABELS.viewAll)).toBeNull();
	});

	it("wraps a long title inside the menu instead of widening it (clamped to two lines)", async () => {
		const longTitle = "Alert: Instance api on Bishens-MacBook-Pro.local (pid 81183) stopped reporting 21 minutes ago";
		mocks.listState.mockReturnValue({ data: pageOf([notice(UNREAD_ID, longTitle, null)]), isPending: false, isError: false });
		render(<NotificationsDropdown />, { wrapper: Providers });
		openDropdown();

		const title = await screen.findByText(longTitle);
		expect(title.className).toContain("line-clamp-2");
		expect(title.className).toContain("wrap-anywhere");
		const row = title.closest("[data-notification-id]");
		expect(row?.className).toContain("whitespace-normal");
		expect(row?.className).toContain("min-w-0");
		expect(row?.parentElement?.className).toContain("overflow-x-hidden");
	});

	it("marks an unread notification read and follows its link; a read one without a link does nothing", async () => {
		render(<NotificationsDropdown />, { wrapper: Providers });
		openDropdown();

		fireEvent.click(await screen.findByText("Weekly summary"));
		fireEvent.click(screen.getByText("Reward approved"));

		await waitFor(() => {
			expect(mocks.markRead).toHaveBeenCalledTimes(1);
		});
		expect(mocks.markRead).toHaveBeenCalledWith({ surface: "MERCHANT", notificationIds: [UNREAD_ID] });
		expect(mocks.push).toHaveBeenCalledTimes(1);
		expect(mocks.push).toHaveBeenCalledWith(REWARD_PATH);
	});

	it("says when there is nothing to show, and when the inbox could not be loaded", async () => {
		mocks.listState.mockReturnValue({ data: pageOf([]), isPending: false, isError: false });
		mocks.unread.mockReturnValue(0);
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
