// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { HttpAuditLogDetailSchema, type HttpAuditLogDetail } from "@workspace/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AuditLogDetailView from "../audit-log-detail";

const { detailQuery } = vi.hoisted(() => ({ detailQuery: vi.fn() }));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): object => ({ api: { auditLogs: { detail: { useQuery: detailQuery } } } }),
}));

const RECORD_ID = "55555555-5555-4555-8555-555555555555";
const ACTOR_ID = "6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const ORGANIZATION_ID = "7a2d3b63-0b4f-4e49-8b66-1e2f3a4b5c6d";

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
	organization: { id: ORGANIZATION_ID, name: "Kopi Corner" },
	storeId: null,
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

	it("links the actor, organization and correlation id back to the filtered table", () => {
		render(<AuditLogDetailView id={RECORD_ID} />);

		expect(screen.getByRole("link", { name: ACTOR_ID }).getAttribute("href")).toBe(`/audit-logs?filter[actorUserId]=${ACTOR_ID}`);
		expect(screen.getByRole("link", { name: "Kopi Corner" }).getAttribute("href")).toBe(`/audit-logs?filter[organizationId]=${ORGANIZATION_ID}`);
		expect(screen.getByRole("link", { name: "corr-1" }).getAttribute("href")).toBe("/audit-logs?filter[correlationId]=corr-1");
	});

	it("explains a failed load with a way back", () => {
		detailQuery.mockReturnValue({ data: undefined, isLoading: false, isError: true });
		render(<AuditLogDetailView id={RECORD_ID} />);

		expect(screen.getByText("Could not load this audit record.")).toBeTruthy();
		expect(screen.getByRole("link", { name: /Back to audit log/ }).getAttribute("href")).toBe("/audit-logs");
	});
});
