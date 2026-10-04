import { OWN_PROFILE_ERROR_CODES } from "@workspace/shared";

import { AuthorizationError } from "../../../common/errors/app-error";

/** Client-safe reason sent with `PROFILE_UPDATE_DURING_IMPERSONATION`. */
export const PROFILE_UPDATE_DURING_IMPERSONATION_MESSAGE = "A profile cannot be changed during impersonation. Stop impersonating to edit your own profile.";

/** 403 — an impersonation session tried to change the impersonated user's profile (see `OwnProfileWritePolicy`). */
export class ProfileUpdateDuringImpersonationError extends AuthorizationError {
	public constructor() {
		super({ code: OWN_PROFILE_ERROR_CODES.PROFILE_UPDATE_DURING_IMPERSONATION, message: PROFILE_UPDATE_DURING_IMPERSONATION_MESSAGE });
	}
}
