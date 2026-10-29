import { CaughtValueSchema } from "@workspace/shared";
import { Inject, Logger } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { UserAuthorizationChanged } from "../../../../authorization/public-api";
import { USER_SESSION_CACHE } from "../../ports/identity.tokens";
import type { UserSessionCachePort } from "../../ports/user-session-cache.port";
import { caughtErrorLogFields } from "../../../../../platform/application/errors/caught-error-log";

/**
 * `InvalidateMeCacheOnAuthorizationChanged` (plan §7.6, M2): roles or permissions of these users
 * changed in authorization, so their cached `/auth/me` and `/auth/permissions` payloads are dropped.
 * After commit, best effort: a failure is logged and the cache TTL is the backstop.
 */
@EventsHandler(UserAuthorizationChanged)
export class InvalidateMeCacheOnAuthorizationChanged implements IEventHandler<UserAuthorizationChanged> {
	private readonly logger: Logger = new Logger(InvalidateMeCacheOnAuthorizationChanged.name);

	public constructor(@Inject(USER_SESSION_CACHE) private readonly sessionCache: UserSessionCachePort) {}

	public async handle(event: UserAuthorizationChanged): Promise<void> {
		try {
			await this.sessionCache.invalidateUsers(event.userIds);
		} catch (error) {
			this.logger.error({ event: "identity.me_cache_invalidation_failed", users: event.userIds.length, ...caughtErrorLogFields(CaughtValueSchema.safeParse(error).data) });
		}
	}
}
