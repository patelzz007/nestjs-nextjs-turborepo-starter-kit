import { Inject, Logger } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import { ThrownErrorSchema } from "@workspace/shared";

import { UserAuthorizationChanged } from "../../../domain/events/user-authorization-changed.event";
import type { AuthorizationCacheInvalidationPort } from "../../ports/authorization-cache-invalidation.port";
import { AUTHORIZATION_CACHE_INVALIDATION } from "../../ports/authorization.tokens";

/**
 * After commit (mechanism 2): drop the affected users' cached authorization and access-token state on
 * every instance (`authz:invalidate`). Replaces `AuthorizationEventEmitter`. A failure only logs: the
 * bumped `tokenVersion` is durable and the caches converge at their TTL.
 */
@EventsHandler(UserAuthorizationChanged)
export class InvalidateAuthorizationOnUserAuthorizationChanged implements IEventHandler<UserAuthorizationChanged> {
	private readonly logger: Logger = new Logger(InvalidateAuthorizationOnUserAuthorizationChanged.name);

	public constructor(@Inject(AUTHORIZATION_CACHE_INVALIDATION) private readonly invalidation: AuthorizationCacheInvalidationPort) {}

	public async handle(event: UserAuthorizationChanged): Promise<void> {
		try {
			await this.invalidation.invalidateUsers(event.userIds, { accessTokenState: true, trigger: "rbac_mutation" });
			this.logger.log(`Revoked all sessions for ${String(event.userIds.length)} user(s) (trigger=rbac_mutation)`);
		} catch (error) {
			const thrown = ThrownErrorSchema.safeParse(error);
			this.logger.error(`Authorization invalidation after an RBAC change failed; caches converge at TTL: ${thrown.success ? thrown.data.message : "unknown error"}`);
		}
	}
}
