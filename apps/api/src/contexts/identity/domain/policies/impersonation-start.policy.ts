import type { EpochMs } from "@workspace/shared";

import { AlreadyImpersonatingError, MfaStepUpRequiredError } from "../errors/identity.errors";

/** The administrator's current session, as its verified access token describes it. */
export interface ImpersonationRequester {
	/** When the session last proved a second factor, or `null`. */
	readonly mfaAssuredAt: EpochMs | null;
	/** The session is itself an impersonation session. */
	readonly isImpersonating: boolean;
}

/**
 * Before any account is looked at: impersonation needs a second-factor proof younger than the
 * step-up window, and an impersonation session can never start another one.
 */
export function assertCanRequestImpersonation(requester: ImpersonationRequester, stepUpTtlMs: number, now: EpochMs): void {
	if (requester.mfaAssuredAt === null || now - requester.mfaAssuredAt > stepUpTtlMs) {
		throw new MfaStepUpRequiredError();
	}
	if (requester.isImpersonating) {
		throw new AlreadyImpersonatingError();
	}
}
