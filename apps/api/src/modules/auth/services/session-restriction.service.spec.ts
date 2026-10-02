import { describe, expect, it, vi } from "vitest";

import type { UserLogin } from "../repositories/user.repository";

import { SessionRestrictionService } from "./session-restriction.service";
import { TypedConfigService } from "../../../config/typed-config.service";
import { createTestApiConfig } from "../../../../test/support/test-api-env";

vi.mock("../../../config/typed-config.service", () => ({
	TypedConfigService: class {
		public readonly mfaEnrollmentDeadlineMs = 7 * 24 * 60 * 60 * 1000;
	},
}));

function buildUser(overrides: Partial<UserLogin> = {}): UserLogin {
	return {
		id: "user-1",
		email: "user@example.com",
		fullName: "Test User",
		isActive: true,
		isSuperAdmin: false,
		createdAt: BigInt(Date.now()),
		updatedAt: BigInt(Date.now()),
		isDeleted: false,
		deletedAt: null,
		emailVerifiedAt: BigInt(Date.now() - 60_000),
		tokenVersion: 1,
		twoFactorEnabled: false,
		mfaEnrollmentDeadline: BigInt(Date.now() + 60_000),
		mfaAssuredAt: null,
		passwordHash: "hash",
		failedLoginAttempts: 0,
		lockedUntil: null,
		twoFactorSecret: null,
		...overrides,
	};
}

describe("SessionRestrictionService", () => {
	const service = new SessionRestrictionService(new TypedConfigService(createTestApiConfig()));
	const now: number = Date.now();

	it("returns restricted scope when email is not verified", () => {
		const user = buildUser({ emailVerifiedAt: null });
		const tokens = service.resolveSessionTokens(user, now);

		expect(tokens.sessionScope).toBe("restricted");
	});

	it("returns restricted scope when MFA enrollment deadline has passed", () => {
		const user = buildUser({ mfaEnrollmentDeadline: BigInt(now - 1), twoFactorEnabled: false });
		const tokens = service.resolveSessionTokens(user, now);

		expect(tokens.sessionScope).toBe("restricted");
	});

	it("returns full scope when enrollment requirements are satisfied", () => {
		const user = buildUser({ twoFactorEnabled: true, mfaAssuredAt: BigInt(now - 1_000) });
		const tokens = service.resolveSessionTokens(user, now);

		expect(tokens.sessionScope).toBe("full");
		expect(tokens.mfaAssuredAt).toBe(Number(user.mfaAssuredAt));
	});
});
