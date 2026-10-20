import type { EpochMs } from "@workspace/shared";

import { AlreadyImpersonatingError, ImpersonationGrantRequiredError, MfaStepUpRequiredError } from "../errors/identity.errors";

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

/** An approved, unexpired support grant the administrator holds for one tenant. */
export interface ApprovedSupportGrant {
	readonly grantId: string;
	readonly tenantId: string;
}

/**
 * A customer has no membership, so no grant is required. Every tenant the target belongs to
 * needs its own approved grant for the administrator. Returns the grant ids that authorize the
 * session (one per tenant, in membership order), which the session records.
 */
export function assertImpersonationGrants(membershipTenantIds: readonly string[], approvedGrants: readonly ApprovedSupportGrant[]): readonly string[] {
	const grantByTenant = new Map<string, string>(approvedGrants.map((grant): [string, string] => [grant.tenantId, grant.grantId]));
	return [...new Set(membershipTenantIds)].map((tenantId: string): string => {
		const grantId: string | undefined = grantByTenant.get(tenantId);
		if (grantId === undefined) {
			throw new ImpersonationGrantRequiredError();
		}
		return grantId;
	});
}
