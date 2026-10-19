import type { AuditLog, DataChangeLog } from "@prisma/client";
import { AuditTrailListQuerySchema, DataChangeLogListQuerySchema, HttpAuditLogListQuerySchema, LIST_SLOT_INDEX } from "@workspace/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestTypedConfig } from "../../../../../../test/support/test-api-env";
import { PrismaService } from "../../../../../prisma/prisma.service";
import { PrismaAuditReferenceReader } from "../prisma-audit-reference.reader";
import { PrismaAuditTrailReadRepository } from "../prisma-audit-trail.read-repository";
import { PrismaDataChangeLogReadRepository, type DataChangeLogSummaryRow } from "../prisma-data-change-log.read-repository";
import { AUDIT_LOG_SUMMARY_SELECT, PrismaHttpAuditLogReadRepository, type AuditLogSummaryRow } from "../prisma-http-audit-log.read-repository";
import { LIVE_ROW_FIELDS } from "../../../../../platform/infrastructure/persistence/__tests__/base-row-fields";

const ACTOR_ID = "11111111-1111-4111-8111-111111111111";
const ORGANIZATION_ID = "33333333-3333-4333-8333-333333333333";
const RECORD_ID = "55555555-5555-4555-8555-555555555555";
const CHANGE_ID = "66666666-6666-4666-8666-666666666666";
const OCCURRED_AT = 1_790_812_800_000;
/** How long the fixture request took, in ms. */
const REQUEST_DURATION_MS = 10;
/** The fixture change's database transaction (it has no correlation id, so it is grouped by this). */
const CHANGE_TRANSACTION_ID = BigInt(9);

const REQUEST_ROW: AuditLogSummaryRow = {
	id: RECORD_ID,
	correlationId: "corr-1",
	occurredAt: BigInt(OCCURRED_AT),
	completedAt: BigInt(OCCURRED_AT + REQUEST_DURATION_MS),
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

const REQUEST_FULL_ROW: AuditLog = {
	...LIVE_ROW_FIELDS,
	...REQUEST_ROW,
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
	createdAt: BigInt(OCCURRED_AT + REQUEST_DURATION_MS),
	updatedAt: BigInt(OCCURRED_AT + REQUEST_DURATION_MS),
};

const CHANGE_ROW: DataChangeLogSummaryRow = {
	id: CHANGE_ID,
	changeSequence: BigInt(7),
	occurredAt: BigInt(OCCURRED_AT),
	transactionId: CHANGE_TRANSACTION_ID,
	tableName: "Reward",
	operation: "UPDATE",
	rowId: "77777777-7777-4777-8777-777777777777",
	changedColumns: ["status"],
	actorKind: "USER",
	actorUserId: ACTOR_ID,
	organizationId: ORGANIZATION_ID,
	apiKeyId: null,
	systemOperation: null,
	correlationId: null,
	databaseRole: "app_runtime",
};

const CHANGE_FULL_ROW: DataChangeLog = {
	...LIVE_ROW_FIELDS,
	...CHANGE_ROW,
	oldData: { status: "DRAFT" },
	newData: { status: "PUBLISHED" },
	actorPurpose: null,
	loginRole: "api",
	applicationName: null,
	clientAddress: "10.0.0.12",
	createdAt: BigInt(OCCURRED_AT + 1),
	updatedAt: BigInt(OCCURRED_AT + 1),
};

/** A raw row as `$queryRaw` answers it (snake_case columns). */
type RawRow = Readonly<Record<string, string | number>>;
/** `$queryRaw` called as a tagged template: the SQL text parts, then the bound values. */
type QueryRaw = (strings: TemplateStringsArray, ...values: readonly (object | string | number)[]) => Promise<readonly RawRow[]>;

/** The delegates the readers use, replaced on a real client so no other member exists by accident. */
function stubDb(): {
	readonly db: PrismaService;
	readonly auditLog: { readonly count: ReturnType<typeof vi.fn>; readonly findMany: ReturnType<typeof vi.fn>; readonly findUnique: ReturnType<typeof vi.fn> };
	readonly dataChangeLog: { readonly count: ReturnType<typeof vi.fn>; readonly findMany: ReturnType<typeof vi.fn>; readonly findUnique: ReturnType<typeof vi.fn> };
	readonly users: ReturnType<typeof vi.fn>;
	readonly organizations: ReturnType<typeof vi.fn>;
	readonly queryRaw: ReturnType<typeof vi.fn<QueryRaw>>;
} {
	const auditLog = { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() };
	const dataChangeLog = { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() };
	const users = vi.fn().mockResolvedValue([{ id: ACTOR_ID, email: "admin@example.com", fullName: "Admin" }]);
	const organizations = vi.fn().mockResolvedValue([{ id: ORGANIZATION_ID, displayName: "Kopi Corner" }]);
	const queryRaw = vi.fn<QueryRaw>();
	const db = Object.assign(new PrismaService(createTestTypedConfig()), {
		auditLog,
		dataChangeLog,
		user: { findMany: users },
		organization: { findMany: organizations },
		$queryRaw: queryRaw,
	});
	return { db, auditLog, dataChangeLog, users, organizations, queryRaw };
}

describe("PrismaHttpAuditLogReadRepository", () => {
	let stub: ReturnType<typeof stubDb>;
	let repository: PrismaHttpAuditLogReadRepository;

	beforeEach(() => {
		stub = stubDb();
		repository = new PrismaHttpAuditLogReadRepository(stub.db, new PrismaAuditReferenceReader(stub.db));
	});

	it("answers one page with actor and organization names resolved, and the request's page size", async () => {
		stub.auditLog.count.mockResolvedValue(1);
		stub.auditLog.findMany.mockResolvedValue([REQUEST_ROW]);
		const query = HttpAuditLogListQuerySchema.parse({});

		const page = await repository.list(query);

		expect(stub.users).toHaveBeenCalledWith({ where: { id: { in: [ACTOR_ID] } }, select: { id: true, email: true, fullName: true } });
		expect(page).toMatchObject({ total: 1, limit: query.limit, page: 1 });
		expect(page.items[LIST_SLOT_INDEX.first]).toMatchObject({
			id: RECORD_ID,
			actor: { id: ACTOR_ID, email: "admin@example.com", fullName: "Admin" },
			organization: { id: ORGANIZATION_ID, name: "Kopi Corner" },
			durationMs: REQUEST_DURATION_MS,
		});
	});

	it("never reads the payload columns for a list page", async () => {
		stub.auditLog.count.mockResolvedValue(0);
		stub.auditLog.findMany.mockResolvedValue([]);

		await repository.list(HttpAuditLogListQuerySchema.parse({}));

		const [args] = stub.auditLog.findMany.mock.calls;
		expect(args).toEqual([expect.objectContaining({ select: AUDIT_LOG_SUMMARY_SELECT })]);
		for (const payload of ["requestParams", "requestBody", "responseBody"]) {
			expect(Object.keys(AUDIT_LOG_SUMMARY_SELECT)).not.toContain(payload);
		}
		expect(stub.users).not.toHaveBeenCalled();
	});

	it("answers one complete record, payloads included", async () => {
		stub.auditLog.findUnique.mockResolvedValue(REQUEST_FULL_ROW);

		const detail = await repository.findById(RECORD_ID);

		expect(stub.auditLog.findUnique).toHaveBeenCalledWith({ where: { id: RECORD_ID } });
		expect(detail).toMatchObject({ id: RECORD_ID, requestBody: { name: "Mug" }, responseBody: { success: true }, host: "api.example.com" });
	});

	it("answers null for an unknown id and resolves no names", async () => {
		stub.auditLog.findUnique.mockResolvedValue(null);

		await expect(repository.findById(RECORD_ID)).resolves.toBeNull();
		expect(stub.users).not.toHaveBeenCalled();
	});
});

describe("PrismaDataChangeLogReadRepository", () => {
	let stub: ReturnType<typeof stubDb>;
	let repository: PrismaDataChangeLogReadRepository;

	beforeEach(() => {
		stub = stubDb();
		repository = new PrismaDataChangeLogReadRepository(stub.db, new PrismaAuditReferenceReader(stub.db));
	});

	it("answers one page with names resolved", async () => {
		stub.dataChangeLog.count.mockResolvedValue(1);
		stub.dataChangeLog.findMany.mockResolvedValue([CHANGE_ROW]);

		const page = await repository.list(DataChangeLogListQuerySchema.parse({}));

		expect(stub.organizations).toHaveBeenCalledWith({ where: { id: { in: [ORGANIZATION_ID] } }, select: { id: true, displayName: true } });
		expect(page.items[LIST_SLOT_INDEX.first]).toMatchObject({ id: CHANGE_ID, changeSequence: 7, actor: { fullName: "Admin" }, organization: { name: "Kopi Corner" } });
	});

	it("answers one complete change with its row images, or null for an unknown id", async () => {
		stub.dataChangeLog.findUnique.mockResolvedValueOnce(CHANGE_FULL_ROW).mockResolvedValueOnce(null);

		await expect(repository.findById(CHANGE_ID)).resolves.toMatchObject({ oldData: { status: "DRAFT" }, newData: { status: "PUBLISHED" }, loginRole: "api" });
		await expect(repository.findById(CHANGE_ID)).resolves.toBeNull();
	});
});

describe("PrismaAuditTrailReadRepository", () => {
	let stub: ReturnType<typeof stubDb>;
	let repository: PrismaAuditTrailReadRepository;

	/** Answers each raw statement of a timeline read by what it selects. */
	function answerTimeline(positions: readonly RawRow[]): void {
		stub.queryRaw.mockImplementation((strings: TemplateStringsArray): Promise<readonly RawRow[]> => {
			const sql = strings.join("?");
			if (sql.includes("count(*) AS total")) {
				return Promise.resolve([{ total: positions.length }]);
			}
			if (sql.includes("SELECT t.kind")) {
				return Promise.resolve(positions);
			}
			return Promise.resolve([]);
		});
	}

	beforeEach(() => {
		stub = stubDb();
		repository = new PrismaAuditTrailReadRepository(stub.db, new PrismaAuditReferenceReader(stub.db));
	});

	it("reads each kind's rows by id and summarizes an uncorrelated change by its transaction", async () => {
		answerTimeline([{ kind: "BACKGROUND", id: CHANGE_ID, occurredAt: OCCURRED_AT }]);
		stub.dataChangeLog.findMany.mockResolvedValue([CHANGE_ROW]);

		const page = await repository.list(AuditTrailListQuerySchema.parse({}));

		expect(stub.auditLog.findMany).not.toHaveBeenCalled();
		expect(stub.dataChangeLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: [CHANGE_ID] } } }));
		const summaryCall = stub.queryRaw.mock.calls.find(([strings]) => strings.join("?").includes("group_key"));
		expect(summaryCall).toEqual(expect.arrayContaining([[], [CHANGE_TRANSACTION_ID]]));
		expect(page.items[LIST_SLOT_INDEX.first]).toMatchObject({ kind: "BACKGROUND", id: CHANGE_ID, changeCount: 1, changedTables: ["Reward"] });
		expect(page).toMatchObject({ total: 1, page: 1 });
	});

	it("answers requests in timeline order, with no changes when the request changed nothing", async () => {
		answerTimeline([{ kind: "REQUEST", id: RECORD_ID, occurredAt: OCCURRED_AT }]);
		stub.auditLog.findMany.mockResolvedValue([REQUEST_ROW]);

		const page = await repository.list(AuditTrailListQuerySchema.parse({}));

		expect(page.items[LIST_SLOT_INDEX.first]).toMatchObject({ kind: "REQUEST", id: RECORD_ID, changeCount: 0, changedTables: [] });
	});

	it("drops a position whose record vanished rather than inventing one", async () => {
		answerTimeline([{ kind: "REQUEST", id: RECORD_ID, occurredAt: OCCURRED_AT }]);
		stub.auditLog.findMany.mockResolvedValue([]);

		const page = await repository.list(AuditTrailListQuerySchema.parse({}));

		expect(page.items).toEqual([]);
	});

	it("reads nothing more for an empty timeline", async () => {
		answerTimeline([]);

		const page = await repository.list(AuditTrailListQuerySchema.parse({}));

		expect(page).toMatchObject({ items: [], total: 0 });
		expect(stub.auditLog.findMany).not.toHaveBeenCalled();
		expect(stub.dataChangeLog.findMany).not.toHaveBeenCalled();
		expect(stub.users).not.toHaveBeenCalled();
	});
});
