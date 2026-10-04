import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

/** The transaction delegate an organization audit row is written through (the caller's transaction). */
export type OrganizationAuditTransaction = Pick<Prisma.TransactionClient, "organizationAuditLog">;

/** Client-safe scalar metadata stored with an audit row. */
export type OrganizationAuditMetadata = Readonly<Record<string, string | number | boolean | null>>;

/**
 * One organization audit row. Actor, organization and the policy version the
 * decision ran under are REQUIRED — there is no "system" / 0 fallback; a caller
 * that cannot name a real actor and policy version cannot write an audit row.
 */
export interface OrganizationAuditEntry {
	readonly organizationId: string;
	readonly actorUserId: string;
	/** Active tenant Cedar policy version the action was authorized under. */
	readonly policyVersion: number;
	readonly action: string;
	readonly resourceType: string;
	readonly resourceId: string;
	readonly decision?: string;
	readonly correlationId?: string;
	readonly metadata?: OrganizationAuditMetadata;
}

@Injectable()
export class OrganizationAuditService {
	/**
	 * Append an audit row INSIDE the caller's transaction, so the row commits or
	 * rolls back together with the state change it describes.
	 */
	public async recordInTx(tx: OrganizationAuditTransaction, entry: OrganizationAuditEntry): Promise<void> {
		await tx.organizationAuditLog.create({
			data: {
				organizationId: entry.organizationId,
				actorUserId: entry.actorUserId,
				action: entry.action,
				resourceType: entry.resourceType,
				resourceId: entry.resourceId,
				decision: entry.decision ?? null,
				policyVersion: entry.policyVersion,
				correlationId: entry.correlationId ?? null,
				...(entry.metadata === undefined ? {} : { metadata: { ...entry.metadata } }),
			},
		});
	}
}
