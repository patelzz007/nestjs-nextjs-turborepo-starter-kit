import { Test } from "@nestjs/testing";
import type { AuditLog } from "@prisma/client";
import { HttpAuditLogListQuerySchema } from "@workspace/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { captureFastifyRequest } from "../../../../test/support/fastify-request";
import { createAuditTrailDouble } from "../../../../test/support/audit-trail-double";
import { AuditLogWriteError } from "../../../common/audit/audit-log.errors";
import { AuditTrailService } from "../../../common/audit/audit-trail.service";
import { RequestContextService } from "../../../common/context/request-context";
import { ResourceNotFoundError } from "../../../platform/persistence/persistence.errors";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { HttpAuditLogRepository, type AuditLogSummaryRow } from "../repositories/http-audit-log.repository";
import { AUDIT_READ_OPERATION, HttpAuditLogQueryService } from "./http-audit-log-query.service";

vi.mock("../../../prisma/tenant-transaction.service", () => ({ TenantTransactionService: class {} }));

const VIEWER_ID = "99999999-9999-4999-8999-999999999999";
const ACTOR_ID = "11111111-1111-4111-8111-111111111111";
const ORGANIZATION_ID = "33333333-3333-4333-8333-333333333333";
const RECORD_ID = "55555555-5555-4555-8555-555555555555";
const OCCURRED_AT = 1_790_812_800_000;

const SUMMARY_ROW: AuditLogSummaryRow = {
	id: RECORD_ID,
	correlationId: "corr-1",
	occurredAt: BigInt(OCCURRED_AT),
	completedAt: BigInt(OCCURRED_AT + 10),
	method: "POST",
	endpoint: "/api/v1/product",
	path: "/api/v1/product",
	outcome: "SUCCEEDED",
	responseStatus: 201,
	errorCode: null,
	authMethod: "SESSION_COOKIE",
	actorUserId: ACTOR_ID,
	impersonatorUserId: null,
	apiKeyId: null,
	terminalId: null,
	organizationId: ORGANIZATION_ID,
	storeId: null,
	locationId: null,
	ipAddress: "203.0.113.24",
	userAgent: "vitest-agent",
	browserName: null,
	browserVersion: null,
	osName: null,
	osVersion: null,
	deviceType: "UNKNOWN",
	deviceModel: null,
	ipVersion: 4,
	ipScope: "DOCUMENTATION",
	geoCountry: null,
	geoRegion: null,
	geoCity: null,
	geoTimeZone: null,
	clientType: "admin",
};

const FULL_ROW: AuditLog = {
	...SUMMARY_ROW,
	traceId: "corr-1",
	impersonationSessionId: null,
	httpVersion: "1.1",
	host: "api.example.com",
	origin: null,
	referer: null,
	acceptLanguage: null,
	requestContentType: "application/json",
	requestBytes: 12,
	idempotencyKey: null,
	requestParams: null,
	requestBody: { name: "Mug" },
	responseBody: { success: true },
	systemOperations: [],
	createdAt: BigInt(OCCURRED_AT + 10),
};

const LIST_QUERY = HttpAuditLogListQuerySchema.parse({});

describe("HttpAuditLogQueryService", () => {
	const repository = { list: vi.fn(), findById: vi.fn(), findUsers: vi.fn(), findOrganizations: vi.fn() };
	const tenantTx = { withSystemOperation: vi.fn() };
	const tx = { marker: "transaction-client" };
	let service: HttpAuditLogQueryService;
	let audit: ReturnType<typeof createAuditTrailDouble>;

	beforeEach(async () => {
		vi.clearAllMocks();
		tenantTx.withSystemOperation.mockImplementation(async (_context: object, work: (client: typeof tx) => Promise<object | null>) => work(tx));
		repository.list.mockResolvedValue({ items: [SUMMARY_ROW], total: 1, page: 1, totalPages: 1, nextCursor: null, hasNext: false, hasPrevious: false });
		repository.findById.mockResolvedValue(FULL_ROW);
		repository.findUsers.mockResolvedValue([{ id: ACTOR_ID, email: "admin@example.com", fullName: "Admin" }]);
		repository.findOrganizations.mockResolvedValue([{ id: ORGANIZATION_ID, displayName: "Kopi Corner" }]);
		audit = createAuditTrailDouble(new RequestContextService());

		const moduleRef = await Test.createTestingModule({
			providers: [
				HttpAuditLogQueryService,
				{ provide: HttpAuditLogRepository, useValue: repository },
				{ provide: TenantTransactionService, useValue: tenantTx },
				{ provide: AuditTrailService, useValue: audit.auditTrail },
			],
		}).compile();
		service = moduleRef.get(HttpAuditLogQueryService);
	});

	describe("list", () => {
		it("reads under the allowlisted audit read operation, as the viewer", async () => {
			await service.list(VIEWER_ID, LIST_QUERY, await captureFastifyRequest({ headers: {} }));

			expect(tenantTx.withSystemOperation).toHaveBeenCalledWith(
				{ operation: AUDIT_READ_OPERATION, reason: "Admin audit viewer list", actorUserId: VIEWER_ID },
				expect.any(Function),
			);
			expect(repository.list).toHaveBeenCalledWith(LIST_QUERY, tx);
		});

		it("returns the page with actor and organization names resolved", async () => {
			const page = await service.list(VIEWER_ID, LIST_QUERY, await captureFastifyRequest({ headers: {} }));

			expect(repository.findUsers).toHaveBeenCalledWith([ACTOR_ID], tx);
			expect(repository.findOrganizations).toHaveBeenCalledWith([ORGANIZATION_ID], tx);
			expect(page).toMatchObject({ total: 1, limit: LIST_QUERY.limit });
			expect(page.items[0]).toMatchObject({
				id: RECORD_ID,
				actor: { id: ACTOR_ID, email: "admin@example.com", fullName: "Admin" },
				organization: { id: ORGANIZATION_ID, name: "Kopi Corner" },
				durationMs: 10,
			});
		});

		it("records the read itself as a sensitive read — what was released, never the records", async () => {
			await service.list(VIEWER_ID, LIST_QUERY, await captureFastifyRequest({ headers: {} }));

			expect(audit.append).toHaveBeenCalledTimes(1);
			expect(audit.append.mock.calls[0]?.[0]).toMatchObject({
				outcome: "SUCCEEDED",
				responseStatus: 200,
				responseBody: { auditLogView: { view: "list", returned: 1, total: 1, page: 1 } },
			});
		});

		it("releases nothing when the sensitive-read row cannot be written", async () => {
			audit.append.mockRejectedValue(new Error("database unavailable"));

			await expect(service.list(VIEWER_ID, LIST_QUERY, await captureFastifyRequest({ headers: {} }))).rejects.toBeInstanceOf(AuditLogWriteError);
		});
	});

	describe("getById", () => {
		it("returns the complete record, payloads included", async () => {
			const detail = await service.getById(VIEWER_ID, RECORD_ID, await captureFastifyRequest({ headers: {} }));

			expect(repository.findById).toHaveBeenCalledWith(RECORD_ID, tx);
			expect(detail).toMatchObject({ id: RECORD_ID, requestBody: { name: "Mug" }, responseBody: { success: true }, host: "api.example.com" });
		});

		it("records which record was opened", async () => {
			await service.getById(VIEWER_ID, RECORD_ID, await captureFastifyRequest({ headers: {} }));

			expect(audit.append.mock.calls[0]?.[0]).toMatchObject({
				responseBody: { auditLogView: { view: "detail", auditLogId: RECORD_ID, correlationId: "corr-1" } },
			});
		});

		it("answers 404 for an unknown id and writes no sensitive-read row", async () => {
			repository.findById.mockResolvedValue(null);

			await expect(service.getById(VIEWER_ID, RECORD_ID, await captureFastifyRequest({ headers: {} }))).rejects.toBeInstanceOf(ResourceNotFoundError);
			expect(audit.append).not.toHaveBeenCalled();
		});

		it("releases nothing when the sensitive-read row cannot be written", async () => {
			audit.append.mockRejectedValue(new Error("database unavailable"));

			await expect(service.getById(VIEWER_ID, RECORD_ID, await captureFastifyRequest({ headers: {} }))).rejects.toBeInstanceOf(AuditLogWriteError);
		});
	});
});
