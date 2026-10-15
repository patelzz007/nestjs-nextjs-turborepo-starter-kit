// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
	ApiPaginatedMetaSchema,
	AuditTrailBackgroundEntrySchema,
	AuditTrailRequestEntrySchema,
	type AuditTrailBackgroundEntry,
	type AuditTrailRequestEntry,
} from "@workspace/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AuditLogView from "../audit-log-table";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";

const { listQuery, detailQuery, changeQuery, changesQuery } = vi.hoisted(() => ({ listQuery: vi.fn(), detailQuery: vi.fn(), changeQuery: vi.fn(), changesQuery: vi.fn() }));

// The table reads its state from the address bar, as Next.js's
// `useSearchParams` does once the History API integration has synced it.
vi.mock("next/navigation", () => ({
	useSearchParams: (): URLSearchParams => new URLSearchParams(window.location.search),
}));

// The live stream is its own boundary (lib/notifications/audit-trail-live.test.ts): here it is connected.
vi.mock("@/lib/notifications/audit-trail-live", () => ({
	useAuditTrailLive: (): string => "open",
}));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): object => ({
		api: {
			auditTrail: { list: { useQuery: listQuery } },
			auditLogs: { detail: { useQuery: detailQuery } },
			dataChanges: { detail: { useQuery: changeQuery }, list: { useQuery: changesQuery } },
		},
	}),
}));

const PATH = "/audit-logs";
const ACTOR_ID = "6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const RECORD_ID = "55555555-5555-4555-8555-555555555555";

const META = ApiPaginatedMetaSchema.parse({
	correlationId: "test",
	timestamp: 1_790_000_000_000,
	limit: 50,
	total: 120,
	page: 1,
	totalPages: 3,
	nextCursor: null,
	hasNext: true,
	hasPrevious: false,
});

const ROW: AuditTrailRequestEntry = AuditTrailRequestEntrySchema.parse({
	kind: "REQUEST",
	changeCount: 0,
	changedTables: [],
	id: RECORD_ID,
	correlationId: "corr-1",
	occurredAt: 1_790_000_000_000,
	completedAt: 1_790_000_000_042,
	durationMs: 42,
	method: "PATCH",
	endpoint: "/api/v1/auth/profile",
	path: "/api/v1/auth/profile",
	outcome: "FAILED",
	responseStatus: 403,
	errorCode: "PROFILE_UPDATE_DURING_IMPERSONATION",
	authMethod: "SESSION_COOKIE",
	actor: { id: ACTOR_ID, email: "user@example.com", fullName: "Demo Customer" },
	impersonator: { id: "sa-1", email: "superadmin@example.com", fullName: "Super Admin" },
	apiKeyId: null,
	terminalId: null,
	organization: null,
	storeId: null,
	locationId: null,
	ipAddress: "203.0.113.24",
	userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
	browserName: "Safari",
	browserVersion: "18.0",
	osName: "iOS",
	osVersion: "18.0",
	deviceType: "MOBILE",
	deviceModel: "iPhone",
	ipVersion: 4,
	ipScope: "PUBLIC",
	geoCountry: "MY",
	geoRegion: "Kuala Lumpur",
	geoCity: "Kuala Lumpur",
	geoTimeZone: "Asia/Kuala_Lumpur",
	clientType: "admin",
});

const CHANGE_ID = "88888888-8888-4888-8888-888888888888";

/** A background job's write: no HTTP request made it. */
const BACKGROUND: AuditTrailBackgroundEntry = AuditTrailBackgroundEntrySchema.parse({
	kind: "BACKGROUND",
	id: CHANGE_ID,
	occurredAt: 1_790_000_100_000,
	actorKind: "SYSTEM",
	actor: null,
	organization: null,
	apiKeyId: null,
	systemOperation: "queue.email.send",
	correlationId: "job-1",
	databaseRole: "app_runtime",
	operation: "UPDATE",
	rowId: "email-1",
	changeCount: 3,
	changedTables: ["email_jobs", "outbox_targets"],
});

beforeEach((): void => {
	window.history.replaceState(null, "", PATH);
	listQuery.mockReturnValue({ data: { data: [ROW], meta: META }, isLoading: false, isFetching: false, error: null, refetch: (): Promise<void> => Promise.resolve() });
	detailQuery.mockReturnValue({ data: undefined, isLoading: false });
	changeQuery.mockReturnValue({ data: undefined, isLoading: false });
	changesQuery.mockReturnValue({ data: { data: [] }, isLoading: false, isError: false });
});

afterEach((): void => {
	cleanup();
	listQuery.mockReset();
	detailQuery.mockReset();
	changeQuery.mockReset();
	changesQuery.mockReset();
	vi.restoreAllMocks();
});

describe("AuditLogView", () => {
	it("says the log is live, so new activity needs no refresh", () => {
		render(<AuditLogView />, { wrapper: UiKitTestProviders });

		expect(screen.getByRole("status").textContent).toBe("Live");
	});

	it("renders who did what, when, from which device and where, and how it ended", () => {
		render(<AuditLogView />, { wrapper: UiKitTestProviders });

		expect(screen.getAllByText("/api/v1/auth/profile").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Mobile").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Safari 18 · iOS 18.0").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Public").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Session cookie").length).toBeGreaterThan(0);
		expect(screen.getAllByText(/🇲🇾 Kuala Lumpur/).length).toBeGreaterThan(0);
		expect(screen.getAllByText(/Failed 403/).length).toBeGreaterThan(0);
		expect(screen.getAllByText("PROFILE_UPDATE_DURING_IMPERSONATION").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Demo Customer").length).toBeGreaterThan(0);
		expect(screen.getAllByText(/Impersonated by Super Admin/).length).toBeGreaterThan(0);
		expect(screen.getAllByText("203.0.113.24").length).toBeGreaterThan(0);
		expect(screen.getAllByText(/42 ms/).length).toBeGreaterThan(0);
	});

	it("queries the URL's filters, sort and page with the audit log's page size", () => {
		window.history.replaceState(null, "", `${PATH}?filter[outcome]=FAILED&filter[method]=PATCH&sort=occurredAt&page=2`);
		render(<AuditLogView />, { wrapper: UiKitTestProviders });

		expect(listQuery).toHaveBeenLastCalledWith({ page: 2, limit: 50, sort: "occurredAt", filter: { outcome: { eq: "FAILED" }, method: { eq: "PATCH" } } }, expect.anything());
		expect(screen.getByRole("combobox", { name: "Outcome" }).textContent).toContain("Failed");
	});

	it("shows an id filter from a detail-page link as a chip, and removes it on request", () => {
		window.history.replaceState(null, "", `${PATH}?filter[actorUserId]=${ACTOR_ID}`);
		render(<AuditLogView />, { wrapper: UiKitTestProviders });

		expect(listQuery).toHaveBeenLastCalledWith({ page: 1, limit: 50, filter: { actorUserId: { eq: ACTOR_ID } } }, expect.anything());

		fireEvent.click(screen.getByRole("button", { name: "Remove the Actor filter" }));

		expect(window.location.search).toBe("");
	});

	it("opens the clicked row's record in the drawer, through the URL (?record=)", () => {
		render(<AuditLogView />, { wrapper: UiKitTestProviders });

		const [firstProfileCell] = screen.getAllByText("/api/v1/auth/profile");
		fireEvent.click(firstProfileCell ?? document.body);

		// The mocked useSearchParams does not re-render on history changes; the next test covers the open drawer.
		expect(window.location.search).toBe(`?record=${RECORD_ID}`);
	});

	it("opens the drawer from a shared link, without touching the table's query", () => {
		window.history.replaceState(null, "", `${PATH}?page=2&record=${RECORD_ID}`);
		render(<AuditLogView />, { wrapper: UiKitTestProviders });

		expect(detailQuery).toHaveBeenLastCalledWith({ id: RECORD_ID }, { enabled: true });
		expect(listQuery).toHaveBeenLastCalledWith({ page: 2, limit: 50 }, expect.anything());
		expect(screen.getByRole("dialog")).toBeTruthy();
	});

	it("queries the device and address-class filters", () => {
		window.history.replaceState(null, "", `${PATH}?filter[deviceType]=BOT&filter[ipScope]=PUBLIC`);
		render(<AuditLogView />, { wrapper: UiKitTestProviders });

		expect(listQuery).toHaveBeenLastCalledWith({ page: 1, limit: 50, filter: { deviceType: { eq: "BOT" }, ipScope: { eq: "PUBLIC" } } }, expect.anything());
	});

	it("pushes the next page to the URL", () => {
		const pushState = vi.spyOn(window.history, "pushState");
		render(<AuditLogView />, { wrapper: UiKitTestProviders });

		fireEvent.click(screen.getByRole("button", { name: /next page/i }));

		expect(pushState).toHaveBeenCalledTimes(1);
		expect(window.location.search).toBe("?page=2");
	});

	it("shows the page's table skeleton while the first page loads", () => {
		listQuery.mockReturnValue({ data: undefined, isLoading: true, isFetching: true, error: null, refetch: (): Promise<void> => Promise.resolve() });
		const { container } = render(<AuditLogView />, { wrapper: UiKitTestProviders });

		const status = screen.getByRole("status");
		expect(status.getAttribute("aria-busy")).toBe("true");
		expect(status.textContent).toBe("Loading audit log…");
		expect(container.querySelector('[data-slot="table-skeleton"]')).not.toBeNull();
		expect(screen.queryByRole("heading", { name: "Audit log" })).toBeNull();
	});

	it("shows a background write in the same timeline — attributed to its job, with the rows it changed", () => {
		listQuery.mockReturnValue({
			data: { data: [ROW, BACKGROUND], meta: META },
			isLoading: false,
			isFetching: false,
			error: null,
			refetch: (): Promise<void> => Promise.resolve(),
		});
		render(<AuditLogView />, { wrapper: UiKitTestProviders });

		expect(screen.getAllByText("Database write · 3 rows").length).toBeGreaterThan(0);
		expect(screen.getAllByText("queue.email.send").length).toBeGreaterThan(0);
		expect(screen.getAllByText("email_jobs, outbox_targets").length).toBeGreaterThan(0);
	});

	it("opens a background write's row change in its own drawer (?change=)", () => {
		listQuery.mockReturnValue({ data: { data: [BACKGROUND], meta: META }, isLoading: false, isFetching: false, error: null, refetch: (): Promise<void> => Promise.resolve() });
		render(<AuditLogView />, { wrapper: UiKitTestProviders });

		const [cell] = screen.getAllByText("Database write · 3 rows");
		fireEvent.click(cell ?? document.body);

		expect(window.location.search).toBe(`?change=${CHANGE_ID}`);
	});

	it("says how many rows a request changed, and where — and nothing for a pure read", () => {
		const writing: AuditTrailRequestEntry = { ...ROW, id: "99999999-9999-4999-8999-999999999999", changeCount: 2, changedTables: ["refresh_tokens", "users"] };
		listQuery.mockReturnValue({
			data: { data: [writing, ROW], meta: META },
			isLoading: false,
			isFetching: false,
			error: null,
			refetch: (): Promise<void> => Promise.resolve(),
		});
		render(<AuditLogView />, { wrapper: UiKitTestProviders });

		expect(screen.getAllByText("Changed 2 rows in refresh_tokens, users").length).toBeGreaterThan(0);
		expect(screen.queryByText(/Changed 0 rows/)).toBeNull();
	});

	it("queries the source and attribution filters", () => {
		window.history.replaceState(null, "", `${PATH}?filter[kind]=BACKGROUND&filter[actorKind]=UNATTRIBUTED`);
		render(<AuditLogView />, { wrapper: UiKitTestProviders });

		expect(listQuery).toHaveBeenLastCalledWith({ page: 1, limit: 50, filter: { kind: { eq: "BACKGROUND" }, actorKind: { eq: "UNATTRIBUTED" } } }, expect.anything());
	});

	it("explains a failed load instead of showing an empty table", () => {
		listQuery.mockReturnValue({ data: undefined, isLoading: false, isFetching: false, error: new Error("403"), refetch: (): Promise<void> => Promise.resolve() });
		render(<AuditLogView />, { wrapper: UiKitTestProviders });

		expect(screen.getByText(/Failed to load the audit log/)).toBeTruthy();
	});
});
