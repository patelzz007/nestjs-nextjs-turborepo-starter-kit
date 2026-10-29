import { CaughtValueSchema } from "@workspace/shared";
import { Inject, Logger } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { UserProfileChanged } from "../../../domain/events/identity.events";
import { USER_SESSION_CACHE } from "../../ports/identity.tokens";
import type { UserSessionCachePort } from "../../ports/user-session-cache.port";
import { caughtErrorLogFields } from "../../../../../platform/application/errors/caught-error-log";

/**
 * After commit: the cached `/auth/me` + `/auth/permissions` payloads of the user are dropped so the next
 * read on any instance is fresh. A cache that cannot be cleared must not turn a committed change into a
 * reported failure: it is logged and the entry expires with the cache TTL.
 */
@EventsHandler(UserProfileChanged)
export class InvalidateMeCacheOnProfileChangedHandler implements IEventHandler<UserProfileChanged> {
	private readonly logger: Logger = new Logger(InvalidateMeCacheOnProfileChangedHandler.name);

	public constructor(@Inject(USER_SESSION_CACHE) private readonly sessionCache: UserSessionCachePort) {}

	public async handle(event: UserProfileChanged): Promise<void> {
		try {
			await this.sessionCache.invalidate(event.userId);
		} catch (error) {
			this.logger.error({ event: "profile.session_cache_invalidation_failed", userId: event.userId, ...caughtErrorLogFields(CaughtValueSchema.safeParse(error).data) });
		}
	}
}
