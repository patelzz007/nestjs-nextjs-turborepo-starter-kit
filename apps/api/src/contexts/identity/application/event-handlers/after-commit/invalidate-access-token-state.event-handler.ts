import { Inject, Logger } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { DeviceSessionsRevoked, UserCredentialsChanged } from "../../../domain/events/identity.events";
import type { AccessTokenInvalidationPort } from "../../ports/access-token-invalidation.port";
import { ACCESS_TOKEN_INVALIDATION, USER_SESSION_CACHE } from "../../ports/identity.tokens";
import type { UserSessionCachePort } from "../../ports/user-session-cache.port";

/**
 * After commit (mechanism 2): a credential change or a session revocation drops the cached
 * access-token state on EVERY instance (D16, D18), so an older token or a revoked `sid` is refused on
 * its next request. Best effort: a failure is logged, never rethrown — the change is durable and the
 * access-token state cache TTL is the backstop.
 */
@EventsHandler(UserCredentialsChanged, DeviceSessionsRevoked)
export class InvalidateAccessTokenStateHandler implements IEventHandler<UserCredentialsChanged | DeviceSessionsRevoked> {
	private readonly logger: Logger = new Logger(InvalidateAccessTokenStateHandler.name);

	public constructor(
		@Inject(ACCESS_TOKEN_INVALIDATION) private readonly invalidation: AccessTokenInvalidationPort,
		@Inject(USER_SESSION_CACHE) private readonly sessionCache: UserSessionCachePort,
	) {}

	public async handle(event: UserCredentialsChanged | DeviceSessionsRevoked): Promise<void> {
		const userIds: readonly string[] = event instanceof UserCredentialsChanged ? [event.userId] : event.userIds;
		try {
			await this.invalidation.invalidateUsers(userIds, event.reason);
			if (event instanceof UserCredentialsChanged) {
				await this.sessionCache.invalidateUsers(userIds);
			}
		} catch (error) {
			this.logger.error({ event: "identity.invalidation_failed", eventName: event.eventName, error: error instanceof Error ? error.message : "unknown error" });
		}
	}
}
