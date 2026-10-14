import { HttpStatus, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { AuditTrailEntry, AuditTrailListQuery, PaginatedServiceResult } from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import { AuditTrailService } from "../../../common/audit/audit-trail.service";
import { toPaginatedServiceResult } from "../../../platform/persistence/list-page";
import type { RepositoryListResult } from "../../../platform/persistence/types";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { auditTrailChangeGroups, auditTrailReferenceIds, toAuditTrailEntry, type AuditTrailPageRows } from "../audit-trail.mapper";
import { AuditReferenceRepository } from "../repositories/audit-reference.repository";
import { AuditTrailRepository, type AuditTrailEntryRow } from "../repositories/audit-trail.repository";

/** Allowlisted system operation every timeline read runs under (system-operation.registry.ts). */
export const AUDIT_TRAIL_READ_OPERATION = "audit.trail.read";

/**
 * Application service behind the admin audit log (`GET /admin/audit-trail`):
 * HTTP requests and background database writes as ONE timeline (ADR 051).
 *
 * - Both stores are bypass-only under RLS, so the read runs under the
 *   allowlisted `audit.trail.read` operation — after the controller's
 *   AUDIT_LOG permission check.
 * - Reading the trail is itself a sensitive read (rules/10): each page writes
 *   its own HTTP audit row BEFORE the data leaves the server; if that row
 *   cannot be written the read fails.
 */
@Injectable()
export class AuditTrailQueryService {
	public constructor(
		private readonly repository: AuditTrailRepository,
		private readonly references: AuditReferenceRepository,
		private readonly tenantTx: TenantTransactionService,
		private readonly auditTrail: AuditTrailService,
	) {}

	/** One page of the timeline (newest first by default), each entry with its change summary and names resolved. */
	public async list(actorId: string, query: AuditTrailListQuery, request: FastifyRequest): Promise<PaginatedServiceResult<AuditTrailEntry>> {
		const page: RepositoryListResult<AuditTrailEntry> = await this.tenantTx.withSystemOperation(
			{ operation: AUDIT_TRAIL_READ_OPERATION, reason: "Admin audit log timeline", actorUserId: actorId },
			async (tx: Prisma.TransactionClient): Promise<RepositoryListResult<AuditTrailEntry>> => {
				const positions: RepositoryListResult<AuditTrailEntryRow> = await this.repository.listEntries(query, tx);
				const rows: AuditTrailPageRows = await this.loadPageRows(positions.items, tx);
				return {
					...positions,
					items: positions.items.flatMap((position: AuditTrailEntryRow): AuditTrailEntry[] => {
						const entry: AuditTrailEntry | null = toAuditTrailEntry(position, rows);
						return entry === null ? [] : [entry];
					}),
				};
			},
		);
		await this.auditTrail.recordSensitiveRead(request, HttpStatus.OK, {
			auditTrailView: { returned: page.items.length, total: page.total, page: page.page },
		});
		return toPaginatedServiceResult(page, query);
	}

	private async loadPageRows(positions: readonly AuditTrailEntryRow[], tx: Prisma.TransactionClient): Promise<AuditTrailPageRows> {
		const idsOf = (kind: AuditTrailEntryRow["kind"]): string[] => positions.filter((position) => position.kind === kind).map((position) => position.id);
		// Sequential: an interactive transaction runs its statements on one connection anyway.
		const requests = await this.repository.findRequests(idsOf("REQUEST"), tx);
		const changes = await this.repository.findChanges(idsOf("BACKGROUND"), tx);
		const groups = auditTrailChangeGroups(requests, changes);
		const summaries = await this.repository.summarizeChanges(groups.correlationIds, groups.transactionIds, tx);
		const references = await this.references.load(auditTrailReferenceIds(requests, changes), tx);
		return {
			requests: new Map(requests.map((row): [string, (typeof requests)[number]] => [row.id, row])),
			changes: new Map(changes.map((row): [string, (typeof changes)[number]] => [row.id, row])),
			summaries,
			references,
		};
	}
}
