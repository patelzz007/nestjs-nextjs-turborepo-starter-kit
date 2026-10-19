import { Inject, Injectable } from "@nestjs/common";

import { AUTHORIZATION_CACHE_INVALIDATION, type AuthorizationCacheInvalidationPort, type UserInvalidationTrigger } from "../../../authorization/public-api";
import type { AccessTokenInvalidationPort, AccessTokenInvalidationReason } from "../../application/ports/access-token-invalidation.port";

/**
 * Authorization's `authz:invalidate` triggers for identity's reasons. Authorization's enum has no
 * value for a 2FA change or an unlock; they are logged as `password_changed`, the closest credential
 * change. The trigger is a log label only (the dropped state is the same), and it is parsed by every
 * instance from the Redis message, so a new value would be dropped by instances not yet upgraded.
 */
const TRIGGER_OF: Readonly<Record<AccessTokenInvalidationReason, UserInvalidationTrigger>> = {
	password_changed: "password_changed",
	password_reset: "password_reset",
	two_factor_enabled: "password_changed",
	two_factor_rotated: "password_changed",
	account_unlocked: "password_changed",
	mfa_recovery_completed: "mfa_recovery_completed",
	session_revoked: "session_revoked",
	logout_all_devices: "logout_all_devices",
	refresh_token_reuse: "refresh_token_reuse",
	session_limit: "session_revoked",
	rbac_mutation: "rbac_mutation",
};

/** Cross-instance invalidation over authorization's `authz:invalidate` transport. */
@Injectable()
export class AccessTokenInvalidationAdapter implements AccessTokenInvalidationPort {
	public constructor(@Inject(AUTHORIZATION_CACHE_INVALIDATION) private readonly invalidation: AuthorizationCacheInvalidationPort) {}

	public invalidateUsers(userIds: readonly string[], reason: AccessTokenInvalidationReason): Promise<void> {
		return this.invalidation.invalidateUsers(userIds, { accessTokenState: true, trigger: TRIGGER_OF[reason] });
	}
}
