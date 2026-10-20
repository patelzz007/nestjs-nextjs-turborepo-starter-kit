import type { EpochMs } from "@workspace/shared";

import type { UserAuthorizationAggregate } from "../aggregates/user-authorization.aggregate";

/** One account's direct roles and overrides, bound to one RBAC transaction. */
export interface UserAuthorizationRepository {
	/** `null` when no non-deleted user has that id. */
	findForAccount(userId: string): Promise<UserAuthorizationAggregate | null>;
	/** At most `limit` accounts (user-id order) holding at least one live override that expired before `now`. */
	findWithExpiredOverrides(now: EpochMs, limit: number): Promise<UserAuthorizationAggregate[]>;
	save(authorization: UserAuthorizationAggregate): Promise<void>;
}
