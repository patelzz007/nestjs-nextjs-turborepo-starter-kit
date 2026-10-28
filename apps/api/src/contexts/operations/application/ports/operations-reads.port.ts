// ============================================
// application/ports/operations-reads.port.ts — read-only access to the console's repositories
// ============================================

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { OperationsReadScope } from "../operations-scope";

/** Runs `work` in one read transaction under the console's read operation. */
export interface OperationsReads {
	read<TResult>(actor: ActorContext, work: (scope: OperationsReadScope) => Promise<TResult>): Promise<TResult>;
}
