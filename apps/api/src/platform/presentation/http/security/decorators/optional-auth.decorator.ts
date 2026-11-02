import { applyDecorators, SetMetadata } from "@nestjs/common";

import { Public } from "./public.decorator";

/** Metadata key: a public route that still recognises a signed-in caller. */
export const OPTIONAL_AUTH_KEY = "optionalAuth";

/**
 * A public route whose answer may depend on who asks (e.g. the marketplace also lists rewards given to the
 * signed-in customer). No authentication is required; a valid session is bound like on any other route,
 * and a missing, invalid or expired token — or a revocation check that cannot run — leaves the caller
 * anonymous, which can only ever show them less.
 */
export const OptionalAuth = (): ReturnType<typeof applyDecorators> => applyDecorators(Public(), SetMetadata(OPTIONAL_AUTH_KEY, true));
