import { Test } from "@nestjs/testing";
import { AuditTrailListQuerySchema, LIST_SLOT_INDEX } from "@workspace/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { captureFastifyRequest } from "../../../../test/support/fastify-request";
import { createAuditTrailDouble } from "../../../../test/support/audit-trail-double";
import { AuditLogWriteError } from "../../../common/audit/audit-log.errors";
import { AuditTrailService } from "../../../common/audit/audit-trail.service";
import { RequestContextService } from "../../../common/context/request-context";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { toAuditLogReferences } from "../audit-references";
import { AuditReferenceRepository } from "../repositories/audit-reference.repository";
import { AuditTrailRepository } from "../repositories/audit-trail.repository";
import type { DataChangeLogSummaryRow } from "../repositories/data-change-log.repository";
import { AUDIT_TRAIL_READ_OPERATION, AuditTrailQueryService } from "./audit-trail-query.service";

vi.mock("../../../prisma/tenant-transaction.service", () => ({ TenantTransactionService: class {} }));

const VIEWER_ID = "99999999-9999-4999-8999-999999999999";
const CHANGE_ID = "66666666-6666-4666-8666-666666666666";
const OCCURRED_AT = 1_790_812_800_000;

const CHANGE: DataChangeLogSummaryRow = {
	id: CHANGE_ID,
	changeSequence: BigInt(1),
	occurredAt: BigInt(OCCURRED_AT),
	transactionId: BigInt(9),
	tableName: "regions",
	operation: "INSERT",
	rowId: "7",
	changedColumns: [],
	actorKind: "UNATTRIBUTED",
	actorUserId: null,
	organizationId: null,
	apiKeyId: null,
	systemOperation: null,
	correlationId: null,
	databaseRole: "postgres",
};

const LIST_QUERY = AuditTrailListQuerySchema.parse({});

describe("AuditTrailQueryService", () => {
	const repository = { listEntries: vi.fn(), findRequests: vi.fn(), findChanges: vi.fn(), summarizeChanges: vi.fn() };
	const references = { load: vi.fn() };
	const tenantTx = { withSystemOperation: vi.fn() };
	const tx = { marker: "transaction-client" };
	let service: AuditTrailQueryService;
	let audit: ReturnType<typeof createAuditTrailDouble>;

	beforeEach(async () => {
		vi.clearAllMocks();
		tenantTx.withSystemOperation.mockImplementation(async (_context: object, work: (client: typeof tx) => Promise<object>) => work(tx));
		repository.listEntries.mockResolvedValue({
			items: [{ kind: "BACKGROUND", id: CHANGE_ID, occurredAt: OCCURRED_AT }],
			total: 1,
			page: 1,
			totalPages: 1,
			nextCursor: null,
			hasNext: false,
			hasPrevious: false,
		});
		repository.findRequests.mockResolvedValue([]);
		repository.findChanges.mockResolvedValue([CHANGE]);
		repository.summarizeChanges.mockResolvedValue(new Map());
		references.load.mockResolvedValue(toAuditLogReferences([], []));
		audit = createAuditTrailDouble(new RequestContextService());

		const moduleRef = await Test.createTestingModule({
			providers: [
				AuditTrailQueryService,
				{ provide: AuditTrailRepository, useValue: repository },
				{ provide: AuditReferenceRepository, useValue: references },
				{ provide: TenantTransactionService, useValue: tenantTx },
				{ provide: AuditTrailService, useValue: audit.auditTrail },
			],
		}).compile();
		service = moduleRef.get(AuditTrailQueryService);
	});

	it("reads under the timeline's read operation and reads each kind's rows by id", async () => {
		await service.list(VIEWER_ID, LIST_QUERY, await captureFastifyRequest({ headers: {} }));

		expect(tenantTx.withSystemOperation).toHaveBeenCalledWith(
			{ operation: AUDIT_TRAIL_READ_OPERATION, reason: "Admin audit log timeline", actorUserId: VIEWER_ID },
			expect.any(Function),
		);
		expect(repository.findRequests).toHaveBeenCalledWith([], tx);
		expect(repository.findChanges).toHaveBeenCalledWith([CHANGE_ID], tx);
		// The lone uncorrelated change is summarized by its transaction.
		expect(repository.summarizeChanges).toHaveBeenCalledWith([], [BigInt(9)], tx);
	});

	it("returns the entries in timeline order", async () => {
		const page = await service.list(VIEWER_ID, LIST_QUERY, await captureFastifyRequest({ headers: {} }));

		expect(page.items[LIST_SLOT_INDEX.first]).toMatchObject({ kind: "BACKGROUND", id: CHANGE_ID, changeCount: 1, actorKind: "UNATTRIBUTED" });
		expect(page).toMatchObject({ total: 1 });
	});

	it("records the read as a sensitive read, and releases nothing when it cannot", async () => {
		await service.list(VIEWER_ID, LIST_QUERY, await captureFastifyRequest({ headers: {} }));
		expect(audit.append.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.first]).toMatchObject({ responseBody: { auditTrailView: { returned: 1, total: 1, page: 1 } } });

		audit.append.mockRejectedValue(new Error("database unavailable"));
		await expect(service.list(VIEWER_ID, LIST_QUERY, await captureFastifyRequest({ headers: {} }))).rejects.toBeInstanceOf(AuditLogWriteError);
	});
});
