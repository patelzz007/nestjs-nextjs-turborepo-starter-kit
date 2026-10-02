import { Test, TestingModule } from "@nestjs/testing";

import type { AccessTokenPayload } from "../auth/services/token.service";

import { SessionStatusController } from "./session-status.controller";

/** Fixed token expiry (epoch seconds) for a deterministic assertion. */
const EXPIRES_AT_SECONDS = 1_752_767_000;

describe("SessionStatusController", () => {
	let controller: SessionStatusController;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [SessionStatusController],
		}).compile();

		controller = module.get<SessionStatusController>(SessionStatusController);
	});

	it("should be defined", () => {
		expect(controller).toBeDefined();
	});

	describe("getSession", () => {
		it("returns session status derived from the verified access-token payload", () => {
			const payload: AccessTokenPayload = {
				sub: "user-123",
				id: "user-123",
				email: "admin@example.com",
				fullName: "Alex Morgan",
				isActive: true,
				isSuperAdmin: true,
				isEmailVerified: true,
				hasAdminAccess: true,
				tokenVersion: 1,
				exp: EXPIRES_AT_SECONDS,
			};

			const session = controller.getSession(payload);

			expect(session.userId).toBe("user-123");
			expect(session.email).toBe("admin@example.com");
			expect(session.fullName).toBe("Alex Morgan");
			expect(session.expiresAt).toBe(EXPIRES_AT_SECONDS * 1000);
			// checkedAt is produced by the server clock — must be a plausible epoch ms.
			expect(session.checkedAt).toBeGreaterThan(0);
			expect(Number.isSafeInteger(session.checkedAt)).toBe(true);
		});

		it("returns null expiresAt when the token has no exp claim", () => {
			const payload: AccessTokenPayload = {
				sub: "user-456",
				id: "user-456",
				email: "dev@example.com",
				fullName: "Dev User",
				isActive: true,
				isSuperAdmin: false,
				isEmailVerified: true,
				hasAdminAccess: false,
				tokenVersion: 1,
			};

			const session = controller.getSession(payload);

			expect(session.expiresAt).toBeNull();
		});
	});
});
