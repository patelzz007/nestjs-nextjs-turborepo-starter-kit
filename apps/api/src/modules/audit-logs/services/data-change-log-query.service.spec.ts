import { Test } from "@nestjs/testing";
import type { DataChangeLog } from "@prisma/client";
import { DataChangeLogListQuerySchema, LIST_SLOT_INDEX } from "@workspace/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { captureFastifyRequest } from "../../../../test/support/fastify-request";
import { createAuditTrailDouble } from "../../../../test/support/audit-trail-double";
import { AuditLogWriteError } from "../../../common/audit/audit-log.errors";
import { AuditTrailService } from "../../../common/audit/audit-trail.service";
import { RequestContextService } from "../../../common/context/request-context";
import { ResourceNotFoundError } from "../../../platform/persistence/persistence.errors";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { toAuditLogReferences } from "../audit-references";
import { AuditReferenceRepository } from "../repositories/audit-reference.repository";
import { DataChangeLogRepository, type DataChangeLogSummaryRow } from "../repositories/data-change-log.repository";
import { DATA_CHANGE_READ_OPERATION, DataChangeLogQueryService } from "./data-change-log-query.service";

vi.mock("../../../prisma/tenant-transaction.service", () => ({ TenantTransactionService: class {} }));

const VIEWER_ID = "99999999-9999-4999-8999-999999999999";
const ACTOR_ID = "11111111-1111-4111-8111-111111111111";
const ORGANIZATION_ID = "33333333-3333-4333-8333-333333333333";
const RECORD_ID = "55555555-5555-4555-8555-555555555555";
const OCCURRED_AT = 1_790_812_800_000;

const SUMMARY_ROW: DataChangeLogSummaryRow = {
	id: RECORD_ID,
	changeSequence: BigInt(7),
	occurredAt: BigInt(OCCURRED_AT),
	transactionId: BigInt(501),
	tableName: "rewards",
	operation: "UPDATE",
	rowId: "66666666-6666-4666-8666-666666666666",
	changedColumns: ["status"],
	actorKind: "USER",
	actorUserId: ACTOR_ID,
	organizationId: ORGANIZATION_ID,
	apiKeyId: null,
	systemOperation: null,
	correlationId: "corr-1",
	databaseRole: "app_runtime",
};

const FULL_ROW: DataChangeLog = {
	...SUMMARY_ROW,
	oldData: { status: "DRAFT" },
	newData: { status: "PUBLISHED" },
	actorPurpose: null,
	loginRole: "api",
	applicationName: null,
	clientAddress: "10.0.0.12",
	createdAt: BigInt(OCCURRED_AT + 1),
};

const LIST_QUERY = DataChangeLogListQuerySchema.parse({});

describe("DataChangeLogQueryService", () => {
	const repository = { list: vi.fn(), findById: vi.fn() };
	const references = { load: vi.fn() };
	const tenantTx = { withSystemOperation: vi.fn() };
	const tx = { marker: "transaction-client" };
	let service: DataChangeLogQueryService;
	let audit: ReturnType<typeof createAuditTrailDouble>;

	beforeEach(async () => {
		vi.clearAllMocks();
		tenantTx.withSystemOperation.mockImplementation(async (_context: object, work: (client: typeof tx) => Promise<object | null>) => work(tx));
		repository.list.mockResolvedValue({ items: [SUMMARY_ROW], total: 1, page: 1, totalPages: 1, nextCursor: null, hasNext: false, hasPrevious: false });
		repository.findById.mockResolvedValue(FULL_ROW);
		references.load.mockResolvedValue(
			toAuditLogReferences([{ id: ACTOR_ID, email: "merchant@example.com", fullName: "Merchant Owner" }], [{ id: ORGANIZATION_ID, displayName: "Kopi Corner" }]),
		);
		audit = createAuditTrailDouble(new RequestContextService());

		const moduleRef = await Test.createTestingModule({
			providers: [
				DataChangeLogQueryService,
				{ provide: DataChangeLogRepository, useValue: repository },
				{ provide: AuditReferenceRepository, useValue: references },
				{ provide: TenantTransactionService, useValue: tenantTx },
				{ provide: AuditTrailService, useValue: audit.auditTrail },
			],
		}).compile();
		service = moduleRef.get(DataChangeLogQueryService);
	});

	describe("list", () => {
		it("reads under the allowlisted data-change read operation, as the viewer", async () => {
			await service.list(VIEWER_ID, LIST_QUERY, await captureFastifyRequest({ headers: {} }));

			expect(tenantTx.withSystemOperation).toHaveBeenCalledWith(
				{ operation: DATA_CHANGE_READ_OPERATION, reason: "Admin data-change viewer list", actorUserId: VIEWER_ID },
				expect.any(Function),
			);
			expect(repository.list).toHaveBeenCalledWith(LIST_QUERY, tx);
		});

		it("returns the page with actor and organization names resolved", async () => {
			const page = await service.list(VIEWER_ID, LIST_QUERY, await captureFastifyRequest({ headers: {} }));

			expect(references.load).toHaveBeenCalledWith({ userIds: [ACTOR_ID], organizationIds: [ORGANIZATION_ID] }, tx);
			expect(page).toMatchObject({ total: 1, limit: LIST_QUERY.limit });
			expect(page.items[LIST_SLOT_INDEX.first]).toMatchObject({
				id: RECORD_ID,
				tableName: "rewards",
				actor: { id: ACTOR_ID, fullName: "Merchant Owner" },
				organization: { id: ORGANIZATION_ID, name: "Kopi Corner" },
			});
		});

		it("records the read itself as a sensitive read — what was released, never the records", async () => {
			await service.list(VIEWER_ID, LIST_QUERY, await captureFastifyRequest({ headers: {} }));

			expect(audit.append).toHaveBeenCalledTimes(1);
			expect(audit.append.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.first]).toMatchObject({
				outcome: "SUCCEEDED",
				responseStatus: 200,
				responseBody: { dataChangeView: { view: "list", returned: 1, total: 1, page: 1 } },
			});
		});

		it("releases nothing when the sensitive-read row cannot be written", async () => {
			audit.append.mockRejectedValue(new Error("database unavailable"));

			await expect(service.list(VIEWER_ID, LIST_QUERY, await captureFastifyRequest({ headers: {} }))).rejects.toBeInstanceOf(AuditLogWriteError);
		});
	});

	describe("getById", () => {
		it("returns the complete record, row images included", async () => {
			const detail = await service.getById(VIEWER_ID, RECORD_ID, await captureFastifyRequest({ headers: {} }));

			expect(tenantTx.withSystemOperation).toHaveBeenCalledWith(
				{ operation: DATA_CHANGE_READ_OPERATION, reason: "Admin data-change viewer detail", actorUserId: VIEWER_ID },
				expect.any(Function),
			);
			expect(repository.findById).toHaveBeenCalledWith(RECORD_ID, tx);
			expect(detail).toMatchObject({ id: RECORD_ID, oldData: { status: "DRAFT" }, newData: { status: "PUBLISHED" }, loginRole: "api" });
		});

		it("records which record was opened", async () => {
			await service.getById(VIEWER_ID, RECORD_ID, await captureFastifyRequest({ headers: {} }));

			expect(audit.append.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.first]).toMatchObject({
				responseBody: { dataChangeView: { view: "detail", dataChangeId: RECORD_ID, tableName: "rewards", rowId: SUMMARY_ROW.rowId, correlationId: "corr-1" } },
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
