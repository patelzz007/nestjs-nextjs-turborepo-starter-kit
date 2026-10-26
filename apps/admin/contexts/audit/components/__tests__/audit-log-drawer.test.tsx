// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HttpAuditLogDetailSchema, type HttpAuditLogDetail } from "@workspace/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuditLogDrawer } from "../audit-log-drawer";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";

const { detailQuery, changesQuery } = vi.hoisted(() => ({ detailQuery: vi.fn(), changesQuery: vi.fn() }));

// The record's "Database changes" panel lists the rows the request changed (GET /admin/data-changes).
vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({ api: { auditLogs: { detail: { useQuery: detailQuery } }, dataChanges: { list: { useQuery: changesQuery } } } }),
}));

const RECORD_ID = "55555555-5555-4555-8555-555555555555";

const RECORD: HttpAuditLogDetail = HttpAuditLogDetailSchema.parse({
	id: RECORD_ID,
	correlationId: "corr-drawer",
	occurredAt: 1_790_000_000_000,
	completedAt: 1_790_000_000_012,
	durationMs: 12,
	method: "DELETE",
	endpoint: "/api/v1/geo/cities/:id",
	path: "/api/v1/geo/cities/42",
	outcome: "SUCCEEDED",
	responseStatus: 200,
	errorCode: null,
	authMethod: "SESSION_COOKIE",
	actor: { id: "6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b", email: "superadmin@example.com", fullName: "Super Admin" },
	impersonator: null,
	apiKeyId: null,
	terminalId: null,
	tenant: null,
	locationId: null,
	ipAddress: "203.0.113.24",
	userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/129.0.0.0 Safari/537.36",
	browserName: "Chrome",
	browserVersion: "129.0.0.0",
	osName: "macOS",
	osVersion: "10.15.7",
	deviceType: "DESKTOP",
	deviceModel: null,
	ipVersion: 4,
	ipScope: "DOCUMENTATION",
	geoCountry: null,
	geoRegion: null,
	geoCity: null,
	geoTimeZone: null,
	clientType: "admin",
	traceId: "corr-drawer",
	impersonationSessionId: null,
	supportAccessGrantId: null,
	sessionId: null,
	claimedTenantId: null,
	claimedLocationId: null,
	requestHeaders: null,
	errorDetail: null,
	httpVersion: "1.1",
	host: "api.example.com",
	origin: "https://admin.example.com",
	referer: null,
	acceptLanguage: null,
	requestContentType: null,
	requestBytes: null,
	idempotencyKey: null,
	requestParams: { params: { id: "42" }, query: {} },
	requestBody: null,
	responseBody: { message: "City #42 deleted" },
	systemOperations: ["platform.superadmin", "geo.reference_data.write"],
	createdAt: 1_790_000_000_013,
});

beforeEach((): void => {
	changesQuery.mockReturnValue({ data: { data: [] }, isLoading: false, isError: false });
	detailQuery.mockReturnValue({ data: { data: RECORD }, isLoading: false });
});

afterEach((): void => {
	cleanup();
	detailQuery.mockReset();
});

describe("AuditLogDrawer", () => {
	it("is closed — and fetches nothing — without a selected record", () => {
		render(<AuditLogDrawer recordId={undefined} onClose={vi.fn()} />, { wrapper: UiKitTestProviders });

		expect(screen.queryByRole("dialog")).toBeNull();
		expect(detailQuery).toHaveBeenLastCalledWith({ id: "" }, { enabled: false });
	});

	it("fetches and shows the selected record, with a link to its own page", () => {
		render(<AuditLogDrawer recordId={RECORD_ID} onClose={vi.fn()} />, { wrapper: UiKitTestProviders });

		expect(detailQuery).toHaveBeenLastCalledWith({ id: RECORD_ID }, { enabled: true });
		expect(screen.getByRole("dialog")).toBeTruthy();
		expect(screen.getByRole("heading", { name: "/api/v1/geo/cities/:id" })).toBeTruthy();
		expect(screen.getByText("Desktop")).toBeTruthy();
		expect(screen.getByText("Chrome 129 · macOS 10.15.7")).toBeTruthy();
		expect(screen.getByRole("link", { name: /Open full page/ }).getAttribute("href")).toBe(`/audit-logs/${RECORD_ID}`);
	});

	it("shows the record's skeleton while it loads", () => {
		detailQuery.mockReturnValue({ data: undefined, isLoading: true });
		render(<AuditLogDrawer recordId={RECORD_ID} onClose={vi.fn()} />, { wrapper: UiKitTestProviders });

		const status = screen.getByRole("status");
		expect(status.getAttribute("aria-busy")).toBe("true");
		expect(status.textContent).toBe("Loading audit record…");
		expect(status.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
		expect(screen.queryByRole("heading", { name: "/api/v1/geo/cities/:id" })).toBeNull();
	});

	it("says so when the record cannot be loaded", () => {
		detailQuery.mockReturnValue({ data: undefined, isLoading: false });
		render(<AuditLogDrawer recordId={RECORD_ID} onClose={vi.fn()} />, { wrapper: UiKitTestProviders });

		expect(screen.getByText("Could not load this audit record.")).toBeTruthy();
	});

	it("closes through its close button", () => {
		const onClose = vi.fn();
		render(<AuditLogDrawer recordId={RECORD_ID} onClose={onClose} />, { wrapper: UiKitTestProviders });

		fireEvent.click(screen.getByRole("button", { name: "Close audit record" }));

		expect(onClose).toHaveBeenCalledTimes(1);
	});
});
