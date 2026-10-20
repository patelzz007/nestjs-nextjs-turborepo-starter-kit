import { actingUserId, type ActorContext } from "../../application/actor-context";
import type { ScopeFactory } from "../../application/events/in-transaction-event-handler";
import { TransactionalEventCollector } from "../../application/events/transactional-event-collector";
import type { SystemOperationName } from "../../application/system-operation-names";
import type { UnitOfWork } from "../../application/unit-of-work.port";
import type { DomainEvent } from "../../domain/domain-event";
import { systemRlsContext } from "../../../prisma/rls-context";
import { TENANT_DATA_SCOPE, toRlsTransactionScope, type RlsScopeOptions, type RlsTransactionScope } from "./actor-to-rls-context";
import type { AfterCommitPublisher } from "./after-commit-publisher";
import type { TransactionalEventDispatcher } from "./transactional-event-dispatcher";
import type { OutboxTransaction } from "../outbox/platform-outbox.service";

export interface RlsTransactionRunner<TDb extends OutboxTransaction> {
	withRlsContext<TResult>(scope: RlsTransactionScope, handler: (db: TDb) => Promise<TResult>): Promise<TResult>;
}

/**
 * Opens one RLS-scoped transaction, runs in-transaction handlers before commit, and publishes only after commit.
 */
export class PrismaUnitOfWork<TScope, TDb extends OutboxTransaction> implements UnitOfWork<TScope> {
	public constructor(
		private readonly transactions: RlsTransactionRunner<TDb>,
		private readonly scopeFactory: ScopeFactory<TScope, TDb>,
		private readonly dispatcher: TransactionalEventDispatcher<TDb>,
		private readonly publisher: AfterCommitPublisher,
		/** Whether this context's work needs the actor's tenant (see {@link RlsScopeOptions}). */
		private readonly scopeOptions: RlsScopeOptions = TENANT_DATA_SCOPE,
	) {}

	public async run<TResult>(actor: ActorContext, work: (scope: TScope) => Promise<TResult>): Promise<TResult> {
		return this.execute(toRlsTransactionScope(actor, this.scopeOptions), actor, work);
	}

	public async runSystemOperation<TResult>(operation: SystemOperationName, actor: ActorContext, work: (scope: TScope) => Promise<TResult>): Promise<TResult> {
		const actorUserId: string | null = actingUserId(actor);
		const reason: string = actor.kind === "system" ? actor.reason : operation;
		return this.execute({ context: systemRlsContext(operation, actorUserId, actor.tenantId), reason }, actor, work);
	}

	private async execute<TResult>(scope: RlsTransactionScope, actor: ActorContext, work: (scope: TScope) => Promise<TResult>): Promise<TResult> {
		const committed: DomainEvent[] = [];
		const result: TResult = await this.transactions.withRlsContext(scope, async (db: TDb): Promise<TResult> => {
			const collector = new TransactionalEventCollector();
			const outcome: TResult = await work(this.scopeFactory.create(db, collector));
			const events: readonly DomainEvent[] = await this.dispatcher.drain(collector, db, actor);
			for (const event of events) {
				committed.push(event);
			}
			return outcome;
		});
		for (const event of committed) {
			await this.publisher.publish(event);
		}
		return result;
	}
}
