import { describe, expect, it } from "vitest";
import { epochMs, type EpochMs } from "@workspace/shared";

import {
	AlreadyImpersonatingError,
	ImpersonationGrantRequiredError,
	MerchantAccessRequiredError,
	MfaStepUpRequiredError,
	ProfileUpdateDuringImpersonationError,
} from "../errors/identity.errors";
import { assertCanRequestImpersonation, assertImpersonationGrants } from "../policies/impersonation-start.policy";
import { assertMerchantPortalAccess } from "../policies/merchant-portal-access.policy";
import { assertOwnProfileWritable, decideOwnProfileWrite, toProfileActor } from "../policies/own-profile-write.policy";
import { resolveSessionRestriction, sessionScopeOf } from "../policies/session-restriction.policy";

const NOW: EpochMs = epochMs(1_800_000_000_000);
const STEP_UP_MS = 300_000;

describe("assertCanRequestImpersonation", () => {
	it("needs a second-factor proof younger than the step-up window", () => {
		expect(() => {
			assertCanRequestImpersonation({ mfaAssuredAt: null, isImpersonating: false }, STEP_UP_MS, NOW);
		}).toThrow(MfaStepUpRequiredError);
		expect(() => {
			assertCanRequestImpersonation({ mfaAssuredAt: epochMs(NOW - STEP_UP_MS - 1), isImpersonating: false }, STEP_UP_MS, NOW);
		}).toThrow(MfaStepUpRequiredError);
		expect(() => {
			assertCanRequestImpersonation({ mfaAssuredAt: epochMs(NOW - STEP_UP_MS), isImpersonating: false }, STEP_UP_MS, NOW);
		}).not.toThrow();
	});

	it("refuses to start from an impersonation session", () => {
		expect(() => {
			assertCanRequestImpersonation({ mfaAssuredAt: NOW, isImpersonating: true }, STEP_UP_MS, NOW);
		}).toThrow(AlreadyImpersonatingError);
	});
});

describe("assertImpersonationGrants", () => {
	it("allows a customer with no membership, and a member covered by a grant for every tenant, returning those grants", () => {
		expect(assertImpersonationGrants([], [])).toEqual([]);
		expect(
			assertImpersonationGrants(
				["tenant-a", "tenant-b"],
				[
					{ grantId: "grant-b", tenantId: "tenant-b" },
					{ grantId: "grant-a", tenantId: "tenant-a" },
					{ grantId: "grant-c", tenantId: "tenant-c" },
				],
			),
		).toEqual(["grant-a", "grant-b"]);
	});

	it("refuses when any of the target's tenants has no approved grant", () => {
		expect(() => {
			assertImpersonationGrants(["tenant-a"], []);
		}).toThrow(ImpersonationGrantRequiredError);
		expect(() => {
			assertImpersonationGrants(["tenant-a", "tenant-b"], [{ grantId: "grant-a", tenantId: "tenant-a" }]);
		}).toThrow(ImpersonationGrantRequiredError);
	});
});

describe("assertMerchantPortalAccess", () => {
	it("lets in a merchant member, a merchant manager, or someone with a pending team invite", () => {
		expect(() => {
			assertMerchantPortalAccess({ hasMerchantMembership: true, canManageMerchants: false, hasPendingTeamInvite: false });
		}).not.toThrow();
		expect(() => {
			assertMerchantPortalAccess({ hasMerchantMembership: false, canManageMerchants: true, hasPendingTeamInvite: false });
		}).not.toThrow();
		expect(() => {
			assertMerchantPortalAccess({ hasMerchantMembership: false, canManageMerchants: false, hasPendingTeamInvite: true });
		}).not.toThrow();
		expect(() => {
			assertMerchantPortalAccess({ hasMerchantMembership: false, canManageMerchants: false, hasPendingTeamInvite: false });
		}).toThrow(MerchantAccessRequiredError);
	});
});

describe("own profile writes", () => {
	it("lets the account itself write and refuses an impersonation session", () => {
		const self = toProfileActor({ sub: "user-1" });
		const impersonated = toProfileActor({ sub: "user-1", isImpersonating: true });

		expect(decideOwnProfileWrite(self)).toEqual({ allowed: true });
		expect(decideOwnProfileWrite(impersonated)).toEqual({ allowed: false, reason: "impersonated_session" });
		expect(() => {
			assertOwnProfileWritable(impersonated);
		}).toThrow(ProfileUpdateDuringImpersonationError);
	});
});

describe("resolveSessionRestriction", () => {
	const VERIFIED_NO_MFA = { isEmailVerified: true, twoFactorEnabled: false, mfaEnrollmentDeadline: null, enrollmentGraceMs: 1 };

	it("restricts an unverified email first", () => {
		expect(resolveSessionRestriction({ ...VERIFIED_NO_MFA, isEmailVerified: false, mfaEnrollmentDeadline: NOW }, NOW)).toMatchObject({
			restricted: true,
			reason: "email_verification",
		});
	});

	it("restricts once the MFA enrollment deadline passed, or immediately when the grace is zero", () => {
		expect(resolveSessionRestriction({ ...VERIFIED_NO_MFA, mfaEnrollmentDeadline: NOW }, NOW)).toMatchObject({ restricted: true, reason: "mfa_enrollment" });
		expect(resolveSessionRestriction({ ...VERIFIED_NO_MFA, enrollmentGraceMs: 0 }, NOW)).toMatchObject({ restricted: true, reason: "mfa_enrollment" });
		expect(resolveSessionRestriction({ ...VERIFIED_NO_MFA, mfaEnrollmentDeadline: epochMs(NOW + 1) }, NOW)).toEqual({ restricted: false });
	});

	it("never restricts an account that already enrolled 2FA", () => {
		expect(resolveSessionRestriction({ ...VERIFIED_NO_MFA, twoFactorEnabled: true, mfaEnrollmentDeadline: NOW }, NOW)).toEqual({ restricted: false });
	});

	it("maps a restriction to the session scope tokens carry", () => {
		expect(sessionScopeOf({ restricted: false })).toBe("full");
		expect(sessionScopeOf({ restricted: true, reason: "mfa_enrollment", message: "x" })).toBe("restricted");
	});
});
