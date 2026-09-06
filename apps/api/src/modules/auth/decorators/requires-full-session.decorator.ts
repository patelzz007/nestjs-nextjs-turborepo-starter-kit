import { applyDecorators, SetMetadata, UseGuards } from "@nestjs/common";

import { ALLOW_RESTRICTED_SESSION_KEY, REQUIRES_FULL_SESSION_KEY, RestrictedSessionGuard } from "../guards/restricted-session.guard";

/**
 * Marks a route as requiring a full (non-restricted) session.
 * Restricted enrollment tokens are rejected unless the route is on the guard allowlist.
 */
export const RequiresFullSession = (): ReturnType<typeof applyDecorators> => {
	return applyDecorators(SetMetadata(REQUIRES_FULL_SESSION_KEY, true), UseGuards(RestrictedSessionGuard));
};

/**
 * Explicitly allows restricted enrollment sessions on a route
 * (in addition to the built-in allowlist).
 */
export const AllowRestrictedSession = (): ReturnType<typeof applyDecorators> => {
	return applyDecorators(SetMetadata(ALLOW_RESTRICTED_SESSION_KEY, true));
};
