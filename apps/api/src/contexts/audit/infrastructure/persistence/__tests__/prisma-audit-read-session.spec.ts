import type { Prisma } from "@prisma/client";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { describe, expect, it, vi } from "vitest";

import { createAuditTrailDouble } from "../../../../../../test/support/audit-trail-double";
import { createTestTypedConfig } from "../../../../../../test/support/test-api-env";
import { systemActor, type ActorContext } from "../../../../../platform/application/actor-context";
import { PrismaService } from "../../../../../prisma/prisma.service";
import type { SystemDatabaseContext } from "../../../../../prisma/tenant-context";
import type { AuditReadScope } from "../../../application/ports/audit-read-session.port";
import { AuditTrailSensitiveReadRecorder } from "../../adapters/audit-trail-sensitive-read.recorder";
import { PrismaAuditReadSession, type SystemOperationTransactions } from "../prisma-audit-read-session";
import { PrismaAuditTrailReadRepository } from "../prisma-audit-trail.read-repository";
import { PrismaDataChangeLogReadRepository } from "../prisma-data-change-log.read-repository";
import { PrismaHttpAuditLogReadRepository } from "../prisma-http-audit-log.read-repository";

const VIEWER_ID = "99999999-9999-4999-8999-999999999999";
const REQUEST = { requestId: "corr-view", ip: null, userAgent: null, deviceLabel: null, endpoint: null };

/** Runs every system operation on one stand-in transaction and keeps the contexts it was opened with. */
class RecordingTransactions implements SystemOperationTransactions {
	public readonly opened: SystemDatabaseContext[] = [];

	public constructor(private readonly db: Prisma.TransactionClient) {}

	public withSystemOperation<TResult>(context: SystemDatabaseContext, handler: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult> {
		this.opened.push(context);
		return handler(this.db);
	}
}

function sessionWith(db: Prisma.TransactionClient = new PrismaService(createTestTypedConfig())): {
	readonly session: PrismaAuditReadSession;
	readonly transactions: RecordingTransactions;
} {
	const transactions = new RecordingTransactions(db);
	return { session: new PrismaAuditReadSession(transactions, createAuditTrailDouble().auditTrail), transactions };
}

const USER: ActorContext = {
	kind: "user",
	userId: VIEWER_ID,
	sessionId: "session-1",
	tenantId: null,
	isSuperAdmin: false,
	accessScope: "tenant",
	impersonatorUserId: null,
	request: REQUEST,
};

describe("PrismaAuditReadSession", () => {
	it("opens the request's system operation with its reason and the viewing user as the operation's actor", async () => {
		const { session, transactions } = sessionWith();

		await session.read({ operation: "audit.http_request.read", reason: "Admin audit viewer list", actor: USER }, () => Promise.resolve(null));

		expect(transactions.opened).toEqual([{ operation: "audit.http_request.read", reason: "Admin audit viewer list", actorUserId: VIEWER_ID }]);
	});

	it.each<{ readonly name: string; readonly actor: ActorContext; readonly actorUserId: string | null }>([
		{ name: "a system actor's human", actor: systemActor("audit.trail.read", "cli", null, "export", VIEWER_ID), actorUserId: VIEWER_ID },
		{
			name: "no one for an API key",
			actor: { kind: "api_key", apiKeyId: "key-1", tenantId: "org-1", locationId: null, terminalId: null, request: REQUEST },
			actorUserId: null,
		},
		{
			name: "a refresh-token subject",
			actor: { kind: "token_subject", userId: VIEWER_ID, tenantId: null, request: REQUEST },
			actorUserId: VIEWER_ID,
		},
		{ name: "no one for an anonymous caller", actor: { kind: "anonymous", tenantId: null, request: REQUEST }, actorUserId: null },
	])("records $name as the operation's actor", async ({ actor, actorUserId }) => {
		const { session, transactions } = sessionWith();

		await session.read({ operation: "audit.trail.read", reason: "Admin audit log timeline", actor }, () => Promise.resolve(null));

		expect(transactions.opened.at(LIST_SLOT_INDEX.first)?.actorUserId).toBe(actorUserId);
	});

	it("hands the work a scope of readers bound to the read's transaction, built fresh for every read", async () => {
		const { session } = sessionWith();
		const scopes: AuditReadScope[] = [];

		await session.read({ operation: "audit.trail.read", reason: "first", actor: USER }, (scope) => Promise.resolve(scopes.push(scope)));
		await session.read({ operation: "audit.trail.read", reason: "second", actor: USER }, (scope) => Promise.resolve(scopes.push(scope)));

		const [first, second] = scopes;
		expect(first?.httpAuditLogs).toBeInstanceOf(PrismaHttpAuditLogReadRepository);
		expect(first?.dataChangeLogs).toBeInstanceOf(PrismaDataChangeLogReadRepository);
		expect(first?.auditTrail).toBeInstanceOf(PrismaAuditTrailReadRepository);
		expect(first?.sensitiveReads).toBeInstanceOf(AuditTrailSensitiveReadRecorder);
		expect(second?.httpAuditLogs).not.toBe(first?.httpAuditLogs);
	});

	it("reads through the transaction it opened", async () => {
		const findUnique = vi.fn().mockResolvedValue(null);
		const db = Object.assign(new PrismaService(createTestTypedConfig()), { auditLog: { findUnique } });
		const { session } = sessionWith(db);

		const found = await session.read({ operation: "audit.http_request.read", reason: "detail", actor: USER }, (scope) => scope.httpAuditLogs.findById(VIEWER_ID));

		expect(found).toBeNull();
		expect(findUnique).toHaveBeenCalledWith({ where: { id: VIEWER_ID } });
	});

	it("answers what the work answered, and lets its failure through (the transaction rolls back)", async () => {
		const { session } = sessionWith();
		const failure = new Error("read failed");

		await expect(session.read({ operation: "audit.trail.read", reason: "ok", actor: USER }, () => Promise.resolve("page"))).resolves.toBe("page");
		await expect(session.read({ operation: "audit.trail.read", reason: "fails", actor: USER }, () => Promise.reject(failure))).rejects.toBe(failure);
	});
});
