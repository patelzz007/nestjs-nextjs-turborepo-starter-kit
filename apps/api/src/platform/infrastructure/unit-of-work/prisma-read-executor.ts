import { actingUserId, type ActorContext } from "../../application/actor-context";
import type { SystemOperationName } from "../../application/system-operation-names";
import { systemRlsContext } from "../../../prisma/rls-context";
import { TENANT_DATA_SCOPE, toRlsTransactionScope, type RlsScopeOptions } from "./actor-to-rls-context";
import type { RlsTransactionRunner } from "./prisma-unit-of-work";
import type { OutboxTransaction } from "../outbox/platform-outbox.service";

/**
 * Runs a read under the actor's RLS session.
 *
 * Prisma's driver adapter checks out the pooled connection outside AsyncLocalStorage, so
 * `rlsStorage.run` never reaches `RlsPool` for a Prisma query. The session is stamped
 * transaction-locally by {@link RlsTransactionRunner.withRlsContext}, the same path writes use.
 * The transaction only exists to bind that session to this query's connection.
 */
export class PrismaReadExecutor<TDb extends OutboxTransaction> {
	public constructor(
		private readonly transactions: RlsTransactionRunner<TDb>,
		/** Whether the reads need the actor's organization (tenant data) or read the user's own rows (see {@link RlsScopeOptions}). */
		private readonly scopeOptions: RlsScopeOptions = TENANT_DATA_SCOPE,
	) {}

	public read<TResult>(actor: ActorContext, work: (db: TDb) => Promise<TResult>): Promise<TResult> {
		return this.transactions.withRlsContext(toRlsTransactionScope(actor, this.scopeOptions), (db) => work(db));
	}

	/**
	 * A read under an allowlisted system operation, on behalf of the actor (recorded as its acting user).
	 * For the lookups an authorization decision needs before the actor's own scope is known.
	 */
	public readAsSystemOperation<TResult>(operation: SystemOperationName, actor: ActorContext, work: (db: TDb) => Promise<TResult>): Promise<TResult> {
		const context = systemRlsContext(operation, actingUserId(actor), actor.organizationId);
		return this.transactions.withRlsContext({ context, reason: operation }, (db) => work(db));
	}
}
