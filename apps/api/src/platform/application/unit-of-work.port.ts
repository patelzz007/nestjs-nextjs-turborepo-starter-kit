import type { ActorContext } from "./actor-context";
import type { SystemOperationName } from "./system-operation-names";

export interface UnitOfWork<TScope> {
	/** Runs `work` in one transaction under the actor's RLS context (tenant or system). */
	run<TResult>(actor: ActorContext, work: (scope: TScope) => Promise<TResult>): Promise<TResult>;

	/** Same, but as an allowlisted system operation (`withSystemOperation`). */
	runSystemOperation<TResult>(operation: SystemOperationName, actor: ActorContext, work: (scope: TScope) => Promise<TResult>): Promise<TResult>;
}
