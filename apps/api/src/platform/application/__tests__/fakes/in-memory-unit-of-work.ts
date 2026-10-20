import type { ActorContext } from "../../actor-context";
import type { SystemOperationName } from "../../system-operation-names";
import type { UnitOfWork } from "../../unit-of-work.port";

/** Runs the callback immediately and records whether the unit of work committed or rolled back. */
export class InMemoryUnitOfWork<TScope> implements UnitOfWork<TScope> {
	public readonly committed: { readonly actor: ActorContext; readonly operation: SystemOperationName | null }[] = [];
	public readonly rolledBack: ActorContext[] = [];

	public constructor(private readonly scope: TScope) {}

	public async run<TResult>(actor: ActorContext, work: (scope: TScope) => Promise<TResult>): Promise<TResult> {
		return this.execute(actor, null, work);
	}

	public async runSystemOperation<TResult>(operation: SystemOperationName, actor: ActorContext, work: (scope: TScope) => Promise<TResult>): Promise<TResult> {
		return this.execute(actor, operation, work);
	}

	private async execute<TResult>(actor: ActorContext, operation: SystemOperationName | null, work: (scope: TScope) => Promise<TResult>): Promise<TResult> {
		try {
			const result = await work(this.scope);
			this.committed.push({ actor, operation });
			return result;
		} catch (error) {
			this.rolledBack.push(actor);
			throw error;
		}
	}
}
