// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ApiPaginatedMetaSchema, HttpAuditLogSummarySchema, type HttpAuditLogSummary } from "@workspace/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AuditLogView from "../audit-log-table";

const { listQuery, detailQuery } = vi.hoisted(() => ({ listQuery: vi.fn(), detailQuery: vi.fn() }));

// The table reads its state from the address bar, as Next.js's
// `useSearchParams` does once the History API integration has synced it.
vi.mock("next/navigation", () => ({
	useSearchParams: (): URLSearchParams => new URLSearchParams(window.location.search),
}));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): object => ({ api: { auditLogs: { list: { useQuery: listQuery }, detail: { useQuery: detailQuery } } } }),
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

const ROW: HttpAuditLogSummary = HttpAuditLogSummarySchema.parse({
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

beforeEach((): void => {
	window.history.replaceState(null, "", PATH);
	listQuery.mockReturnValue({ data: { data: [ROW], meta: META }, isLoading: false, isFetching: false, error: null, refetch: (): Promise<void> => Promise.resolve() });
	detailQuery.mockReturnValue({ data: undefined, isLoading: false });
});

afterEach((): void => {
	cleanup();
	listQuery.mockReset();
	detailQuery.mockReset();
	vi.restoreAllMocks();
});

describe("AuditLogView", () => {
	it("renders who did what, when, from which device and where, and how it ended", () => {
		render(<AuditLogView />);

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
		window.history.replaceState(null, "", `${PATH}?filter[outcome]=FAILED&filter[method]=PATCH&sort=-responseStatus&page=2`);
		render(<AuditLogView />);

		expect(listQuery).toHaveBeenLastCalledWith(
			{ page: 2, limit: 50, sort: "-responseStatus", filter: { outcome: { eq: "FAILED" }, method: { eq: "PATCH" } } },
			expect.anything(),
		);
		expect(screen.getByRole("combobox", { name: "Outcome" }).textContent).toContain("Failed");
	});

	it("shows an id filter from a detail-page link as a chip, and removes it on request", () => {
		window.history.replaceState(null, "", `${PATH}?filter[actorUserId]=${ACTOR_ID}`);
		render(<AuditLogView />);

		expect(listQuery).toHaveBeenLastCalledWith({ page: 1, limit: 50, filter: { actorUserId: { eq: ACTOR_ID } } }, expect.anything());

		fireEvent.click(screen.getByRole("button", { name: "Remove the Actor filter" }));

		expect(window.location.search).toBe("");
	});

	it("opens the clicked row's record in the drawer, through the URL (?record=)", () => {
		render(<AuditLogView />);

		fireEvent.click(screen.getAllByText("/api/v1/auth/profile")[0] ?? document.body);

		// The mocked useSearchParams does not re-render on history changes; the next test covers the open drawer.
		expect(window.location.search).toBe(`?record=${RECORD_ID}`);
	});

	it("opens the drawer from a shared link, without touching the table's query", () => {
		window.history.replaceState(null, "", `${PATH}?page=2&record=${RECORD_ID}`);
		render(<AuditLogView />);

		expect(detailQuery).toHaveBeenLastCalledWith({ id: RECORD_ID }, { enabled: true });
		expect(listQuery).toHaveBeenLastCalledWith({ page: 2, limit: 50 }, expect.anything());
		expect(screen.getByRole("dialog")).toBeTruthy();
	});

	it("queries the device and address-class filters", () => {
		window.history.replaceState(null, "", `${PATH}?filter[deviceType]=BOT&filter[ipScope]=PUBLIC`);
		render(<AuditLogView />);

		expect(listQuery).toHaveBeenLastCalledWith({ page: 1, limit: 50, filter: { deviceType: { eq: "BOT" }, ipScope: { eq: "PUBLIC" } } }, expect.anything());
	});

	it("pushes the next page to the URL", () => {
		const pushState = vi.spyOn(window.history, "pushState");
		render(<AuditLogView />);

		fireEvent.click(screen.getByRole("button", { name: /next page/i }));

		expect(pushState).toHaveBeenCalledTimes(1);
		expect(window.location.search).toBe("?page=2");
	});

	it("explains a failed load instead of showing an empty table", () => {
		listQuery.mockReturnValue({ data: undefined, isLoading: false, isFetching: false, error: new Error("403"), refetch: (): Promise<void> => Promise.resolve() });
		render(<AuditLogView />);

		expect(screen.getByText(/Failed to load the audit log/)).toBeTruthy();
	});
});
