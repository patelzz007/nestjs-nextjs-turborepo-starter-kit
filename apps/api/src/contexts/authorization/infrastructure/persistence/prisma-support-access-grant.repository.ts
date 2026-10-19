import type { Prisma, SupportAccessGrant } from "@prisma/client";

import { SupportAccessGrantAggregate, type SupportAccessGrantState } from "../../domain/aggregates/support-access-grant.aggregate";
import type { SupportAccessGrantRepository } from "../../domain/repositories/support-access-grant.repository";

function stateOf(row: SupportAccessGrant): SupportAccessGrantState {
	return {
		id: row.id,
		organizationId: row.organizationId,
		supportUserId: row.supportUserId,
		mode: row.mode,
		status: row.status,
		reason: row.reason,
		ticketRef: row.ticketRef,
		tenantApprovedById: row.tenantApprovedById,
		expiresAt: Number(row.expiresAt),
		revokedAt: row.revokedAt === null ? null : Number(row.revokedAt),
		createdAt: Number(row.createdAt),
	};
}

/** `SupportAccessGrant` (bypass-write) on the support-access transaction. Every transition is compared-and-set on the loaded status. */
export class PrismaSupportAccessGrantRepository implements SupportAccessGrantRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async findById(grantId: string): Promise<SupportAccessGrantAggregate | null> {
		const row: SupportAccessGrant | null = await this.db.supportAccessGrant.findUnique({ where: { id: grantId } });
		return row === null ? null : SupportAccessGrantAggregate.rehydrate(stateOf(row));
	}

	public async add(grant: SupportAccessGrantAggregate): Promise<SupportAccessGrantState> {
		const state: SupportAccessGrantState = grant.snapshot();
		const created: SupportAccessGrant = await this.db.supportAccessGrant.create({
			data: {
				id: state.id,
				organizationId: state.organizationId,
				supportUserId: state.supportUserId,
				mode: state.mode,
				status: state.status,
				reason: state.reason,
				ticketRef: state.ticketRef,
				expiresAt: state.expiresAt,
			},
		});
		return stateOf(created);
	}

	public async save(grant: SupportAccessGrantAggregate): Promise<"saved" | "lost"> {
		const state: SupportAccessGrantState = grant.snapshot();
		const { count } = await this.db.supportAccessGrant.updateMany({
			where: { id: state.id, status: grant.concurrencyToken },
			data: { status: state.status, tenantApprovedById: state.tenantApprovedById, revokedAt: state.revokedAt },
		});
		return count === 1 ? "saved" : "lost";
	}
}
