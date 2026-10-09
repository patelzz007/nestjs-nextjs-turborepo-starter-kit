import { DEVICE_SESSION_ERROR_CODES } from "@workspace/shared";

import { AuthorizationError } from "../../common/errors/app-error";

/** Client-safe reason sent with `SESSION_REVOKE_DURING_IMPERSONATION`. */
export const SESSION_REVOKE_DURING_IMPERSONATION_MESSAGE = "Devices cannot be signed out during impersonation. Stop impersonating first.";

/**
 * 403 — an impersonation session tried to sign out one of the impersonated
 * user's devices. Listing them stays allowed (the impersonator sees what the
 * user sees); revoking would record the user as the actor of a sign-out they
 * never made.
 */
export class SessionRevokeDuringImpersonationError extends AuthorizationError {
	public constructor() {
		super({ code: DEVICE_SESSION_ERROR_CODES.SESSION_REVOKE_DURING_IMPERSONATION, message: SESSION_REVOKE_DURING_IMPERSONATION_MESSAGE });
	}
}
