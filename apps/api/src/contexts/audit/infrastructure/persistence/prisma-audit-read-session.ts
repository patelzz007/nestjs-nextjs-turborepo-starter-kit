import type { Prisma } from "@prisma/client";

import { actingUserId } from "../../../../platform/application/actor-context";
import type { AuditReadRequest, AuditReadScope, AuditReadSession } from "../../application/ports/audit-read-session.port";
import type { AuditTrailService } from "../../../../platform/infrastructure/audit/audit-trail.service";
import type { SystemDatabaseContext } from "../../../../prisma/tenant-context";
import { AuditTrailSensitiveReadRecorder } from "../adapters/audit-trail-sensitive-read.recorder";
import { PrismaAuditReferenceReader } from "./prisma-audit-reference.reader";
import { PrismaAuditTrailReadRepository } from "./prisma-audit-trail.read-repository";
import { PrismaDataChangeLogReadRepository } from "./prisma-data-change-log.read-repository";
import { PrismaHttpAuditLogReadRepository } from "./prisma-http-audit-log.read-repository";

/** The one `TenantTransactionService` method an audit read needs. */
export interface SystemOperationTransactions {
	withSystemOperation<TResult>(context: SystemDatabaseContext, handler: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult>;
}

/**
 * Opens one `withSystemOperation` transaction per audit read and builds a scope bound to it.
 * Readers are created fresh on every read (never cached); `db` is never stored on a singleton.
 */
export class PrismaAuditReadSession implements AuditReadSession {
	public constructor(
		private readonly transactions: SystemOperationTransactions,
		private readonly auditTrail: AuditTrailService,
	) {}

	public read<TResult>(request: AuditReadRequest, work: (scope: AuditReadScope) => Promise<TResult>): Promise<TResult> {
		return this.transactions.withSystemOperation(
			{ operation: request.operation, reason: request.reason, actorUserId: actingUserId(request.actor) },
			(db: Prisma.TransactionClient): Promise<TResult> => work(this.scopeFor(db)),
		);
	}

	private scopeFor(db: Prisma.TransactionClient): AuditReadScope {
		const references = new PrismaAuditReferenceReader(db);
		return {
			httpAuditLogs: new PrismaHttpAuditLogReadRepository(db, references),
			dataChangeLogs: new PrismaDataChangeLogReadRepository(db, references),
			auditTrail: new PrismaAuditTrailReadRepository(db, references),
			sensitiveReads: new AuditTrailSensitiveReadRecorder(this.auditTrail, db),
		};
	}
}
