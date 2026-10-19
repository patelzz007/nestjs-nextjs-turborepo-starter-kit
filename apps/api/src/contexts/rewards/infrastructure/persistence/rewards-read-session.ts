import type { Prisma } from "@prisma/client";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { toRlsTransactionScope, USER_OWNED_DATA_SCOPE } from "../../../../platform/infrastructure/unit-of-work/actor-to-rls-context";
import type { RlsTransactionRunner } from "../../../../platform/infrastructure/unit-of-work/prisma-unit-of-work";
import { systemRlsContext } from "../../../../prisma/rls-context";
import { ROUTE_RLS_BYPASS_OPERATION } from "../../application/ports/rewards.tokens";

/** The human behind a cross-tenant read, recorded on the system-operation audit line. */
function actingUserId(actor: ActorContext): string | null {
	if (actor.kind === "user") {
		return actor.userId;
	}
	return actor.kind === "system" ? actor.actorUserId : null;
}

/**
 * Read sessions for reward projections. A tenant read stamps the actor's own RLS session; a
 * cross-tenant read (the `@RlsBypass()` routes) runs as the allowlisted `route.rls_bypass`
 * operation, as those routes did before. Both bind the session to the query's connection with a
 * short transaction (plan §5.4).
 */
export class RewardsReadSession {
	public constructor(private readonly transactions: RlsTransactionRunner<Prisma.TransactionClient>) {}

	public read<TResult>(actor: ActorContext, work: (db: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult> {
		return this.transactions.withRlsContext(toRlsTransactionScope(actor), work);
	}

	/** A read of the actor's OWN rows (legal acceptance, profile fields), which need no organization. */
	public readOwn<TResult>(actor: ActorContext, work: (db: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult> {
		return this.transactions.withRlsContext(toRlsTransactionScope(actor, USER_OWNED_DATA_SCOPE), work);
	}

	public readAcrossTenants<TResult>(actor: ActorContext, work: (db: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult> {
		const context = systemRlsContext(ROUTE_RLS_BYPASS_OPERATION, actingUserId(actor), actor.organizationId);
		return this.transactions.withRlsContext({ context, reason: ROUTE_RLS_BYPASS_OPERATION }, work);
	}
}
