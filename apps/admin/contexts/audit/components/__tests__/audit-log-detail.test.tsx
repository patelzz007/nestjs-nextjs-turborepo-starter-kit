// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { DataChangeLogSummarySchema, HttpAuditLogDetailSchema, type HttpAuditLogDetail } from "@workspace/shared";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AuditLogDetailView from "../audit-log-detail";

const { detailQuery, changesQuery } = vi.hoisted(() => ({ detailQuery: vi.fn(), changesQuery: vi.fn() }));

// The record's "Database changes" panel lists the rows the request changed (GET /admin/data-changes).
vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({ api: { auditLogs: { detail: { useQuery: detailQuery } }, dataChanges: { list: { useQuery: changesQuery } } } }),
}));

const RECORD_ID = "55555555-5555-4555-8555-555555555555";
const ACTOR_ID = "6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const TENANT_ID = "7a2d3b63-0b4f-4e49-8b66-1e2f3a4b5c6d";

const RECORD: HttpAuditLogDetail = HttpAuditLogDetailSchema.parse({
	id: RECORD_ID,
	correlationId: "corr-1",
	occurredAt: 1_790_000_000_000,
	completedAt: 1_790_000_000_042,
	durationMs: 42,
	method: "POST",
	endpoint: "/api/v1/product",
	path: "/api/v1/product",
	outcome: "SUCCEEDED",
	responseStatus: 201,
	errorCode: null,
	authMethod: "BEARER_TOKEN",
	actor: { id: ACTOR_ID, email: "admin@example.com", fullName: "Admin User" },
	impersonator: null,
	apiKeyId: null,
	terminalId: null,
	tenant: { id: TENANT_ID, name: "Kopi Corner" },
	locationId: null,
	ipAddress: "203.0.113.24",
	userAgent: "curl/8.7.1",
	browserName: "curl",
	browserVersion: "8.7.1",
	osName: null,
	osVersion: null,
	deviceType: "UNKNOWN",
	deviceModel: null,
	ipVersion: 4,
	ipScope: "DOCUMENTATION",
	geoCountry: "MY",
	geoRegion: "Selangor",
	geoCity: "Shah Alam",
	geoTimeZone: "Asia/Kuala_Lumpur",
	clientType: null,
	traceId: "corr-1",
	impersonationSessionId: null,
	supportAccessGrantId: null,
	sessionId: null,
	claimedTenantId: null,
	claimedLocationId: null,
	requestHeaders: null,
	errorDetail: null,
	httpVersion: "1.1",
	host: "api.example.com",
	origin: null,
	referer: null,
	acceptLanguage: null,
	requestContentType: "application/json",
	requestBytes: 48,
	idempotencyKey: "create-mug-0001",
	requestParams: { params: {}, query: {} },
	requestBody: { name: "Mug", password: "[REDACTED]" },
	responseBody: null,
	systemOperations: ["http.idempotency"],
	createdAt: 1_790_000_000_043,
});

beforeEach((): void => {
	changesQuery.mockReturnValue({ data: { data: [] }, isLoading: false, isError: false });
	detailQuery.mockReturnValue({ data: { data: RECORD }, isLoading: false, isError: false });
});

afterEach((): void => {
	cleanup();
	detailQuery.mockReset();
});

describe("AuditLogDetailView", () => {
	it("shows every captured fact of the request", () => {
		render(<AuditLogDetailView id={RECORD_ID} />);

		expect(screen.getByRole("heading", { name: "/api/v1/product" })).toBeTruthy();
		expect(screen.getByText("Bearer token")).toBeTruthy();
		expect(screen.getByText("curl/8.7.1")).toBeTruthy();
		expect(screen.getByText("api.example.com")).toBeTruthy();
		expect(screen.getByText("create-mug-0001")).toBeTruthy();
		expect(screen.getByText("48 bytes")).toBeTruthy();
		expect(screen.getByText("42 ms")).toBeTruthy();
		expect(screen.getByText("http.idempotency")).toBeTruthy();
	});

	it("shows the device, the address class and the CDN location", () => {
		render(<AuditLogDetailView id={RECORD_ID} />);

		expect(screen.getByText("Unknown / script")).toBeTruthy();
		expect(screen.getByText("curl 8")).toBeTruthy();
		expect(screen.getByText("Documentation range")).toBeTruthy();
		expect(screen.getByText("IPv4")).toBeTruthy();
		expect(screen.getByText("🇲🇾 Malaysia · Shah Alam, Selangor")).toBeTruthy();
		expect(screen.getByText("Asia/Kuala_Lumpur")).toBeTruthy();
	});

	it("pretty-prints the stored (redacted) payloads and says when nothing was stored", () => {
		render(<AuditLogDetailView id={RECORD_ID} />);

		expect(screen.getByText(/"password": "\[REDACTED\]"/)).toBeTruthy();
		expect(screen.getByText("Nothing recorded.")).toBeTruthy();
	});

	it("says why a failed request failed — the server's reason, causes and stack — not only the code the caller saw", () => {
		detailQuery.mockReturnValue({
			data: {
				data: {
					...RECORD,
					outcome: "FAILED",
					responseStatus: 500,
					errorCode: "INTERNAL_ERROR",
					errorDetail: {
						type: "PrismaClientKnownRequestError",
						message: "Record to update not found.",
						code: "P2025",
						causes: [{ type: "Error", message: "connection reset", code: "ECONNRESET" }],
						stack: ["at RewardsRepository.update (src/rewards.repository.ts:42:13)"],
					},
				},
			},
			isLoading: false,
			isError: false,
		});
		render(<AuditLogDetailView id={RECORD_ID} />);

		const reason = screen.getByRole("region", { name: "Why it failed" });
		expect(reason.textContent).toContain("The caller was only told INTERNAL_ERROR");
		expect(reason.textContent).toContain("PrismaClientKnownRequestError [P2025]");
		expect(reason.textContent).toContain("Record to update not found.");
		expect(reason.textContent).toContain("Caused by Error [ECONNRESET]");
		expect(reason.textContent).toContain("at RewardsRepository.update (src/rewards.repository.ts:42:13)");
	});

	it("says when a failed request's reason was not recorded, and shows no reason for a success", () => {
		render(<AuditLogDetailView id={RECORD_ID} />);
		expect(screen.queryByRole("region", { name: "Why it failed" })).toBeNull();
		cleanup();

		detailQuery.mockReturnValue({ data: { data: { ...RECORD, outcome: "FAILED", responseStatus: 403, errorCode: "FORBIDDEN" } }, isLoading: false, isError: false });
		render(<AuditLogDetailView id={RECORD_ID} />);
		expect(screen.getByRole("region", { name: "Why it failed" }).textContent).toContain("Not recorded: this record was written before failure reasons were kept.");
	});

	it("shows the device session, the X-Tenant-Id the client claimed against the verified tenant, and every header sent", () => {
		detailQuery.mockReturnValue({
			data: {
				data: {
					...RECORD,
					sessionId: "device-session-1",
					claimedTenantId: "forged-tenant",
					claimedLocationId: null,
					requestHeaders: { accept: "application/json", cookie: "[REDACTED] (admin_access_token)", "x-tenant-id": "forged-tenant" },
				},
			},
			isLoading: false,
			isError: false,
		});
		render(<AuditLogDetailView id={RECORD_ID} />);

		expect(screen.getByText("device-session-1")).toBeTruthy();
		expect(screen.getAllByText("forged-tenant").length).toBeGreaterThan(0);
		expect(screen.getByText("differs from the verified tenant")).toBeTruthy();
		expect(screen.getByText("Not sent")).toBeTruthy();
		expect(screen.getByText("[REDACTED] (admin_access_token)")).toBeTruthy();
		expect(screen.getByText("x-tenant-id")).toBeTruthy();
	});

	it("says when a record kept no headers", () => {
		render(<AuditLogDetailView id={RECORD_ID} />);

		expect(screen.getByText("Not recorded: this record was written before headers were kept.")).toBeTruthy();
	});

	it("links the actor, tenant and correlation id back to the filtered table", () => {
		render(<AuditLogDetailView id={RECORD_ID} />);

		expect(screen.getByRole("link", { name: ACTOR_ID }).getAttribute("href")).toBe(`/audit-logs?filter[actorUserId]=${ACTOR_ID}`);
		expect(screen.getByRole("link", { name: "Kopi Corner" }).getAttribute("href")).toBe(`/audit-logs?filter[tenantId]=${TENANT_ID}`);
		expect(screen.getByRole("link", { name: "corr-1" }).getAttribute("href")).toBe("/audit-logs?filter[correlationId]=corr-1");
	});

	it("lists the rows the request changed in the database, in write order, each linking to its before / after", () => {
		const changeId = "88888888-8888-4888-8888-888888888888";
		changesQuery.mockReturnValue({
			data: {
				data: [
					DataChangeLogSummarySchema.parse({
						id: changeId,
						changeSequence: 9,
						occurredAt: 1_790_000_000_020,
						transactionId: 77,
						tableName: "Product",
						operation: "INSERT",
						rowId: "42",
						changedColumns: [],
						actorKind: "USER",
						actor: null,
						tenant: null,
						apiKeyId: null,
						systemOperation: null,
						correlationId: "corr-1",
						databaseRole: "app_runtime",
					}),
				],
			},
			isLoading: false,
			isError: false,
		});
		render(<AuditLogDetailView id={RECORD_ID} />);

		expect(changesQuery).toHaveBeenLastCalledWith({ page: 1, limit: 50, sort: "occurredAt", filter: { correlationId: { eq: "corr-1" } } }, expect.anything());
		expect(screen.getByRole("heading", { name: "Database changes" })).toBeTruthy();
		expect(screen.getByRole("link", { name: /Insert Product 42/ }).getAttribute("href")).toBe(`/audit-logs/changes/${changeId}`);
	});

	it("says when the request changed no rows", () => {
		render(<AuditLogDetailView id={RECORD_ID} />);

		expect(screen.getByText("No rows were changed.")).toBeTruthy();
	});

	it("shows the full-page record's skeleton while the record loads", () => {
		detailQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false });
		render(<AuditLogDetailView id={RECORD_ID} />, { wrapper: UiKitTestProviders });

		const status = screen.getByRole("status");
		expect(status.getAttribute("aria-busy")).toBe("true");
		expect(status.textContent).toBe("Loading audit record…");
		expect(screen.queryByRole("heading", { name: "/api/v1/product" })).toBeNull();
		expect(screen.queryByRole("link", { name: /Back to audit log/ })).toBeNull();
	});

	it("explains a failed load with a way back", () => {
		detailQuery.mockReturnValue({ data: undefined, isLoading: false, isError: true });
		render(<AuditLogDetailView id={RECORD_ID} />);

		expect(screen.getByText("Could not load this audit record.")).toBeTruthy();
		expect(screen.getByRole("link", { name: /Back to audit log/ }).getAttribute("href")).toBe("/audit-logs");
	});
});
