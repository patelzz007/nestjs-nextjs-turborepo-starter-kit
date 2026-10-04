import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { OrganizationLifecycleState } from "@workspace/shared";

import { readTransactionCorrelationId } from "../../../prisma/transaction-correlation";

/** The transaction delegates a lifecycle event is written through (the caller's transaction). */
export type OrganizationLifecycleEventTransaction = Pick<Prisma.TransactionClient, "organizationLifecycleEvent" | "$queryRaw">;

/** One organization lifecycle state transition. */
export interface OrganizationLifecycleTransition {
	readonly organizationId: string;
	/** `null` only for the very first event (the organization is being created). */
	readonly fromState: OrganizationLifecycleState | null;
	readonly toState: OrganizationLifecycleState;
	/** The user who caused the transition; `null` for background work with no human actor. */
	readonly actorUserId: string | null;
	readonly reason: string;
}

/**
 * The ONLY writer of `organization_lifecycle_events`. Every row is appended
 * inside the caller's transaction (it commits or rolls back with the state
 * change it describes) and carries the correlation id that transaction runs
 * under — the request's, or the system operation's for background work — so a
 * lifecycle change can always be traced to the request or job that made it.
 */
@Injectable()
export class OrganizationLifecycleEventRecorder {
	public async recordInTx(tx: OrganizationLifecycleEventTransaction, transition: OrganizationLifecycleTransition): Promise<void> {
		const correlationId: string = await readTransactionCorrelationId(tx);
		await tx.organizationLifecycleEvent.create({
			data: {
				organizationId: transition.organizationId,
				fromState: transition.fromState,
				toState: transition.toState,
				actorUserId: transition.actorUserId,
				reason: transition.reason,
				correlationId,
			},
		});
	}
}
