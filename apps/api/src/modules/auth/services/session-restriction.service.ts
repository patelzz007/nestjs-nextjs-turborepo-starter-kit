import { Injectable } from "@nestjs/common";
import type { EnrollmentReason } from "@workspace/shared";

import { TypedConfigService } from "../../../config/typed-config.service";
import type { UserLogin } from "../repositories/user.repository";
import type { SessionScope } from "./token.service";

export type SessionRestriction = { readonly restricted: false } | { readonly restricted: true; readonly reason: EnrollmentReason; readonly message: string };

export interface ResolvedSessionTokens {
	readonly sessionScope: SessionScope;
	readonly mfaAssuredAt: number | undefined;
}

/**
 * Authoritative resolver for whether a session should be `restricted` or `full`.
 *
 * Used at login and on every refresh so rotating tokens never escalates privileges.
 */
@Injectable()
export class SessionRestrictionService {
	public constructor(private readonly config: TypedConfigService) {}

	public resolveSessionRestriction(user: UserLogin, isEmailVerified: boolean, now: number): SessionRestriction {
		if (!isEmailVerified) {
			return {
				restricted: true,
				reason: "email_verification",
				message: "Verify your email address to continue.",
			};
		}

		if (!user.twoFactorEnabled && this.requiresMfaEnrollment(user, now)) {
			return {
				restricted: true,
				reason: "mfa_enrollment",
				message: "Set up two-factor authentication to continue.",
			};
		}

		return { restricted: false };
	}

	public resolveSessionTokens(user: UserLogin, now: number): ResolvedSessionTokens {
		const isEmailVerified: boolean = user.emailVerifiedAt !== null && user.emailVerifiedAt <= now;
		const restriction: SessionRestriction = this.resolveSessionRestriction(user, isEmailVerified, now);
		const sessionScope: SessionScope = restriction.restricted ? "restricted" : "full";
		const mfaAssuredAt: number | undefined = user.mfaAssuredAt !== null && user.mfaAssuredAt <= BigInt(now) ? Number(user.mfaAssuredAt) : undefined;

		return { sessionScope, mfaAssuredAt };
	}

	private requiresMfaEnrollment(user: UserLogin, now: number): boolean {
		const deadline: bigint | null = user.mfaEnrollmentDeadline;
		if (deadline !== null && deadline <= BigInt(now)) {
			return true;
		}

		const graceMs: number = this.config.mfaEnrollmentDeadlineMs;
		if (deadline === null && graceMs <= 0) {
			return true;
		}

		return false;
	}
}
