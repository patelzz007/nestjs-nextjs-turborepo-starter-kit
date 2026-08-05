import { Test, TestingModule } from "@nestjs/testing";

import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import type { AccessTokenPayload } from "./modules/auth/services/token.service";
import { AuthService } from "./modules/auth/auth.service.js";

describe("AppController", () => {
	let controller: AppController;

	const appServiceMock = {
		getHello: jest.fn(),
		healthCheck: jest.fn(),
	};

	const authServiceMock = {};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [AppController],
			providers: [
				{ provide: AppService, useValue: appServiceMock },
				{ provide: AuthService, useValue: authServiceMock },
			],
		}).compile();

		controller = module.get<AppController>(AppController);
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
				roles: [],
				permissions: [],
				exp: 1_752_767_000, // fixed instant for a deterministic assertion
			};

			const session = controller.getSession(payload);

			expect(session.userId).toBe("user-123");
			expect(session.email).toBe("admin@example.com");
			expect(session.fullName).toBe("Alex Morgan");
			expect(session.expiresAt).toBe(new Date(payload.exp! * 1000).toISOString());
			// checkedAt is produced by the server clock — must parse as a valid date.
			expect(Number.isNaN(new Date(session.checkedAt).getTime())).toBe(false);
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
				roles: [],
				permissions: [],
			};

			const session = controller.getSession(payload);

			expect(session.expiresAt).toBeNull();
		});
	});
});
