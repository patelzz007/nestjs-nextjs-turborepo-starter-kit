import type { EpochMs } from "@workspace/shared";

import { DomainEvent } from "../../../../platform/domain/domain-event";

/**
 * The effective authorization of `userIds` changed (roles, direct grants, a role's permissions, a role
 * hierarchy edit, an expired override). Their sessions were revoked in the same transaction.
 *
 * Published after commit only (mechanism 2). Handlers drop cached authorization and access-token state
 * on every instance (`authz:invalidate`) and the identity context clears its `/auth/me` cache. A
 * handler that fails only logs: the bumped `tokenVersion` is already durable.
 */
export class UserAuthorizationChanged extends DomainEvent {
	public readonly eventName = "authorization.UserAuthorizationChanged";

	public constructor(
		occurredAt: EpochMs,
		/** Distinct, never empty: the scope only records the event when someone was affected. */
		public readonly userIds: readonly string[],
	) {
		super(occurredAt);
	}
}
