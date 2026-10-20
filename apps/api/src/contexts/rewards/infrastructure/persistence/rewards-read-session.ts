import type { Prisma } from "@prisma/client";

import { actingUserId, type ActorContext } from "../../../../platform/application/actor-context";
import { toRlsTransactionScope, USER_OWNED_DATA_SCOPE } from "../../../../platform/infrastructure/unit-of-work/actor-to-rls-context";
import type { RlsTransactionRunner } from "../../../../platform/infrastructure/unit-of-work/prisma-unit-of-work";
import { systemRlsContext } from "../../../../prisma/rls-context";
import { MARKETPLACE_REWARDS_READ_OPERATION, REWARDS_ADMIN_REVIEW_OPERATION } from "../../application/ports/rewards.tokens";

/**
 * Read sessions for reward projections. A tenant read stamps the actor's own RLS session. Admin
 * moderation reads run as `rewards.admin_review`. Published marketplace reads run as
 * `marketplace.published_rewards.read`. Both bind the session to the query's connection with a
 * short transaction (plan §5.4).
 */
export class RewardsReadSession {
	public constructor(private readonly transactions: RlsTransactionRunner<Prisma.TransactionClient>) {}

	public read<TResult>(actor: ActorContext, work: (db: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult> {
		return this.transactions.withRlsContext(toRlsTransactionScope(actor), work);
	}

	/** A read of the actor's OWN rows (legal acceptance, profile fields), which need no tenant. */
	public readOwn<TResult>(actor: ActorContext, work: (db: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult> {
		return this.transactions.withRlsContext(toRlsTransactionScope(actor, USER_OWNED_DATA_SCOPE), work);
	}

	/** Admin moderation reads. Merchant names and logos are loaded afterwards under `tenant.display_data.read`. */
	public readAcrossTenants<TResult>(actor: ActorContext, work: (db: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult> {
		const context = systemRlsContext(REWARDS_ADMIN_REVIEW_OPERATION, actingUserId(actor), actor.tenantId);
		return this.transactions.withRlsContext({ context, reason: REWARDS_ADMIN_REVIEW_OPERATION }, work);
	}

	/** Published marketplace rows. Merchant names and logos are loaded afterwards under `tenant.display_data.read`. */
	public readPublished<TResult>(actor: ActorContext, work: (db: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult> {
		const context = systemRlsContext(MARKETPLACE_REWARDS_READ_OPERATION, actingUserId(actor), actor.tenantId);
		return this.transactions.withRlsContext({ context, reason: MARKETPLACE_REWARDS_READ_OPERATION }, work);
	}
}
