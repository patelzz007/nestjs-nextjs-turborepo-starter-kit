// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, useMutation, type UseMutationResult } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
	epochMs,
	type ApiPaginatedMeta,
	type ArchiveNotificationsInput,
	type Envelope,
	type InAppNotificationListQuery,
	type InAppNotificationResponse,
	type MarkNotificationsReadInput,
	type NotificationUnreadCountResponse,
	type OkResponse,
	type ReportBroadcastInput,
} from "@workspace/shared";
import type { JSX, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { envelopeFixture, META_FIXTURE } from "../../../../test/auth-fixtures";
import { ClientTestProviders } from "../../../../testing/client-test-providers";
import type { LiveState } from "../../live-updates/reconnecting-event-stream";
import { NOTIFICATIONS_INBOX_LABELS } from "../notifications-inbox-labels";
import { kindOptionsOf, NotificationsInbox } from "../notifications-inbox";

interface ListQueryState {
	readonly data: Envelope<InAppNotificationResponse[]> | undefined;
	readonly isPending: boolean;
	readonly isError: boolean;
	readonly isFetching: boolean;
}

const mocks = vi.hoisted(() => ({
	liveState: vi.fn<() => LiveState>(),
	listState: vi.fn<() => ListQueryState>(),
	listInputs: vi.fn<(input: InAppNotificationListQuery) => void>(),
	unread: vi.fn<() => number>(),
	markRead: vi.fn<(input: MarkNotificationsReadInput) => Promise<Envelope<OkResponse>>>(),
	archive: vi.fn<(input: ArchiveNotificationsInput) => Promise<Envelope<OkResponse>>>(),
	report: vi.fn<(input: ReportBroadcastInput & { readonly broadcastId: string }) => Promise<Envelope<OkResponse>>>(),
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
			unreadCount: { useQuery: (): { readonly data: Envelope<NotificationUnreadCountResponse> } => ({ data: envelopeFixture({ unread: mocks.unread() }) }) },
			read: {
				useMutation: (): UseMutationResult<Envelope<OkResponse>, Error, MarkNotificationsReadInput> =>
					useMutation({ mutationFn: (input: MarkNotificationsReadInput): Promise<Envelope<OkResponse>> => mocks.markRead(input) }),
			},
			archive: {
				useMutation: (): UseMutationResult<Envelope<OkResponse>, Error, ArchiveNotificationsInput> =>
					useMutation({ mutationFn: (input: ArchiveNotificationsInput): Promise<Envelope<OkResponse>> => mocks.archive(input) }),
			},
			reportBroadcast: {
				useMutation: (): UseMutationResult<Envelope<OkResponse>, Error, ReportBroadcastInput & { readonly broadcastId: string }> =>
					useMutation({ mutationFn: (input: ReportBroadcastInput & { readonly broadcastId: string }): Promise<Envelope<OkResponse>> => mocks.report(input) }),
			},
		},
	};
	return { useAuth: (): { readonly api: typeof api } => ({ api }), useAuthClientType: (): "web" => "web" };
});

const CREATED_AT = epochMs(1_790_000_000_000);
const UNREAD_ID = "6c1b2f0e-3d4a-4b5c-8d6e-7f8091a2b3c4";
const GROUPED_ID = "7d2c3f1e-4e5b-4c6d-9e7f-8091a2b3c4d5";

function notice(id: string, title: string, overrides: Partial<InAppNotificationResponse> = {}): InAppNotificationResponse {
	return {
		id,
		typeKey: "rewards.referrer-credited",
		category: "TRANSACTIONAL",
		surface: "CUSTOMER",
		title,
		body: `${title} body`,
		richBody: null,
		link: null,
		icon: null,
		senderName: null,
		senderLogoUrl: null,
		groupCount: 1,
		broadcastId: null,
		readAt: null,
		archivedAt: null,
		createdAt: CREATED_AT,
		updatedAt: CREATED_AT,
		isDeleted: false,
		deletedAt: null,
		...overrides,
	};
}

function pageOf(items: InAppNotificationResponse[], hasNext = false): Envelope<InAppNotificationResponse[]> {
	const meta: ApiPaginatedMeta = { ...META_FIXTURE, limit: 20, total: items.length, page: 1, totalPages: hasNext ? 2 : 1, nextCursor: null, hasNext, hasPrevious: false };
	return envelopeFixture(items, meta);
}

let queryClient: QueryClient;

function Providers({ children }: { readonly children: ReactNode }): JSX.Element {
	return (
		<QueryClientProvider client={queryClient}>
			<ClientTestProviders>{children}</ClientTestProviders>
		</QueryClientProvider>
	);
}

beforeEach(() => {
	window.history.replaceState(null, "", "/notifications");
	queryClient = new QueryClient();
	mocks.liveState.mockReturnValue("open");
	mocks.listState.mockReturnValue({
		data: pageOf(
			[
				notice(UNREAD_ID, "You earned a referrer reward!"),
				notice(GROUPED_ID, "Sunrise Cafe sent an update", { groupCount: 3, senderName: "Sunrise Cafe", readAt: epochMs(CREATED_AT + 1) }),
			],
			true,
		),
		isPending: false,
		isError: false,
		isFetching: false,
	});
	mocks.unread.mockReturnValue(1);
	mocks.markRead.mockResolvedValue(envelopeFixture({ ok: true }));
	mocks.archive.mockResolvedValue(envelopeFixture({ ok: true }));
	mocks.report.mockResolvedValue(envelopeFixture({ ok: true }));
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

const BROADCAST_ID = "8e3d4f2a-5f6c-4d7e-8f90-a1b2c3d4e5f6";

describe("NotificationsInbox broadcasts", () => {
	beforeEach(() => {
		mocks.listState.mockReturnValue({
			data: pageOf([
				notice(UNREAD_ID, "Weekend specials", {
					broadcastId: BROADCAST_ID,
					senderName: "Sunrise Cafe",
					body: "Half price lattes",
					richBody: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Half price lattes all Saturday", marks: [{ type: "bold" }] }] }] },
				}),
			]),
			isPending: false,
			isError: false,
			isFetching: false,
		});
	});

	it("unfolds a broadcast's full message", () => {
		render(<NotificationsInbox />, { wrapper: Providers });
		expect(screen.queryByText("Half price lattes all Saturday")).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: NOTIFICATIONS_INBOX_LABELS.readMore }));

		expect(screen.getByText("Half price lattes all Saturday").tagName).toBe("STRONG");
	});

	it("reports a broadcast with the reason picked", async () => {
		render(<NotificationsInbox />, { wrapper: Providers });

		fireEvent.click(screen.getByRole("button", { name: NOTIFICATIONS_INBOX_LABELS.report }));
		fireEvent.click(await screen.findByRole("button", { name: NOTIFICATIONS_INBOX_LABELS.reportReasons.SCAM }));

		await waitFor(() => {
			expect(mocks.report).toHaveBeenCalledWith({ broadcastId: BROADCAST_ID, reason: "SCAM", note: null });
		});
	});

	it("offers no report on an ordinary notification", () => {
		mocks.listState.mockReturnValue({ data: pageOf([notice(UNREAD_ID, "You earned a referrer reward!")]), isPending: false, isError: false, isFetching: false });
		render(<NotificationsInbox />, { wrapper: Providers });

		expect(screen.queryByRole("button", { name: NOTIFICATIONS_INBOX_LABELS.report })).toBeNull();
	});
});

describe("NotificationsInbox", () => {
	it("lists the customer inbox with its sender and grouping, and says it is live", () => {
		render(<NotificationsInbox />, { wrapper: Providers });

		expect(mocks.listInputs).toHaveBeenCalledWith(expect.objectContaining({ surface: "CUSTOMER", page: 1, filter: { archivedAt: { isNull: true } } }));
		expect(screen.getByText("You earned a referrer reward!")).toBeDefined();
		expect(screen.getByText("Sunrise Cafe")).toBeDefined();
		expect(screen.getByText(NOTIFICATIONS_INBOX_LABELS.grouped(3))).toBeDefined();
		expect(screen.getByText(NOTIFICATIONS_INBOX_LABELS.live)).toBeDefined();
	});

	it("lets a long title wrap in its row instead of running past it", () => {
		render(<NotificationsInbox />, { wrapper: Providers });

		const title = screen.getByRole("button", { name: "You earned a referrer reward!" });
		expect(title.className).toContain("whitespace-normal");
		expect(title.className).toContain("wrap-anywhere");
	});

	it("links to this app's notification settings when given", () => {
		render(<NotificationsInbox settingsHref="/dashboard/notifications/settings" />, { wrapper: Providers });

		expect(screen.getByRole("link", { name: NOTIFICATIONS_INBOX_LABELS.settings }).getAttribute("href")).toBe("/dashboard/notifications/settings");
	});

	it("says it polls while the stream is down", () => {
		mocks.liveState.mockReturnValue("connecting");
		render(<NotificationsInbox />, { wrapper: Providers });

		expect(screen.getByText(NOTIFICATIONS_INBOX_LABELS.polling)).toBeDefined();
	});

	it("marks one read, all read, and archives one", async () => {
		render(<NotificationsInbox />, { wrapper: Providers });

		fireEvent.click(screen.getByRole("button", { name: NOTIFICATIONS_INBOX_LABELS.markRead }));
		await waitFor(() => {
			expect(mocks.markRead).toHaveBeenCalledWith({ surface: "CUSTOMER", notificationIds: [UNREAD_ID] });
		});

		fireEvent.click(screen.getByRole("button", { name: NOTIFICATIONS_INBOX_LABELS.markAllRead }));
		await waitFor(() => {
			expect(mocks.markRead).toHaveBeenCalledWith({ surface: "CUSTOMER", markAll: true });
		});

		const [firstArchive] = screen.getAllByRole("button", { name: NOTIFICATIONS_INBOX_LABELS.archive });
		if (firstArchive === undefined) {
			throw new Error("Expected an archive button");
		}
		fireEvent.click(firstArchive);
		await waitFor(() => {
			expect(mocks.archive).toHaveBeenCalledWith({ notificationIds: [UNREAD_ID] });
		});
	});

	it("turns the page and switches views through the URL", async () => {
		render(<NotificationsInbox />, { wrapper: Providers });

		fireEvent.click(screen.getByRole("button", { name: /Next/u }));
		await waitFor(() => {
			expect(mocks.listInputs).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
		});
		expect(window.location.search).toContain("page=2");

		fireEvent.click(screen.getByRole("tab", { name: NOTIFICATIONS_INBOX_LABELS.views.archived }));
		await waitFor(() => {
			expect(mocks.listInputs).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, filter: { archivedAt: { isNull: false } } }));
		});
	});

	it("shows the view's empty message, and a retry when the inbox could not be loaded", () => {
		mocks.listState.mockReturnValue({ data: pageOf([]), isPending: false, isError: false, isFetching: false });
		mocks.unread.mockReturnValue(0);
		const { unmount } = render(<NotificationsInbox />, { wrapper: Providers });
		expect(screen.getByText(NOTIFICATIONS_INBOX_LABELS.empty.all)).toBeDefined();
		expect(screen.getByRole("button", { name: NOTIFICATIONS_INBOX_LABELS.markAllRead }).hasAttribute("disabled")).toBe(true);
		unmount();

		mocks.listState.mockReturnValue({ data: undefined, isPending: false, isError: true, isFetching: false });
		render(<NotificationsInbox />, { wrapper: Providers });
		expect(screen.getByText(NOTIFICATIONS_INBOX_LABELS.loadError)).toBeDefined();
		expect(screen.getByRole("button", { name: NOTIFICATIONS_INBOX_LABELS.retry })).toBeDefined();
	});
});

const ALERT_ID = "9f4e5a3b-6a7d-4e8f-9a01-b2c3d4e5f607";

describe("NotificationsInbox rows in full", () => {
	beforeEach(() => {
		mocks.listState.mockReturnValue({
			data: pageOf([
				notice(ALERT_ID, "High CPU on web-01", {
					typeKey: "operations.alert",
					category: "OPERATIONS",
					surface: "ADMIN",
					body: "web-01 CPU has been above 80% for 5 minutes.\nLimit 80%, now 93.5%.",
					link: "/operations/alerts",
				}),
			]),
			isPending: false,
			isError: false,
			isFetching: false,
		});
	});

	it("says what kind it is, keeps every line of its text, and marks it unread", () => {
		const { container } = render(<NotificationsInbox />, { wrapper: Providers });

		expect(screen.getByText(NOTIFICATIONS_INBOX_LABELS.kinds.OPERATIONS)).toBeDefined();
		expect(screen.getByText(/Limit 80%, now 93\.5%\./u).className).toContain("whitespace-pre-line");
		expect(screen.getByRole("img", { name: NOTIFICATIONS_INBOX_LABELS.unread })).toBeDefined();
		expect(container.querySelector('[data-slot="icon-tile"]')).not.toBeNull();
		expect(container.querySelector("time")?.getAttribute("title")).not.toBeNull();
	});

	it("opens what it is about from its Open button", async () => {
		render(<NotificationsInbox />, { wrapper: Providers });

		fireEvent.click(screen.getByRole("button", { name: NOTIFICATIONS_INBOX_LABELS.open }));

		await waitFor(() => {
			expect(mocks.push).toHaveBeenCalledWith("/operations/alerts");
		});
		expect(mocks.markRead).toHaveBeenCalledWith({ surface: "CUSTOMER", notificationIds: [ALERT_ID] });
	});

	it("offers no Open button for a notice that leads nowhere, and shows a store's initials", () => {
		mocks.listState.mockReturnValue({
			data: pageOf([notice(UNREAD_ID, "Weekend specials", { senderName: "Sunrise Cafe", category: "MARKETING" })]),
			isPending: false,
			isError: false,
			isFetching: false,
		});
		render(<NotificationsInbox />, { wrapper: Providers });

		expect(screen.queryByRole("button", { name: NOTIFICATIONS_INBOX_LABELS.open })).toBeNull();
		expect(screen.getByText("SC")).toBeDefined();
	});

	it("lists one kind through the URL, and says when none of that kind is here", async () => {
		window.history.replaceState(null, "", "/notifications?kind=OPERATIONS");
		mocks.listState.mockReturnValue({ data: pageOf([]), isPending: false, isError: false, isFetching: false });
		render(<NotificationsInbox />, { wrapper: Providers });

		await waitFor(() => {
			expect(mocks.listInputs).toHaveBeenLastCalledWith(expect.objectContaining({ filter: { archivedAt: { isNull: true }, category: { eq: "OPERATIONS" } } }));
		});
		expect(screen.getByText(NOTIFICATIONS_INBOX_LABELS.emptyKind)).toBeDefined();
	});
});

describe("kindOptionsOf", () => {
	it("offers every kind first, then each kind of message", () => {
		const options = kindOptionsOf(NOTIFICATIONS_INBOX_LABELS);
		expect(options.at(0)).toEqual({ value: "any", label: "Every kind" });
		expect(options.map((option) => option.value)).toEqual(["any", "SECURITY", "ACCOUNT", "TRANSACTIONAL", "PRODUCT", "MARKETING", "OPERATIONS"]);
	});
});
