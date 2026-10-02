import { Test, TestingModule } from "@nestjs/testing";

import { AuthService } from "./auth.service";
import { AdminUserService } from "./services/admin-user.service";
import { ChangePasswordService } from "./services/change-password.service";
import { EmailVerificationService } from "./services/email-verification.service";
import { IdentityService } from "./services/identity.service";
import { LoginService } from "./services/login.service";
import { LoginVerificationService } from "./services/login-verification.service";
import { PasswordResetService } from "./services/password-reset.service";

describe("AuthService", () => {
	let service: AuthService;

	beforeEach(async () => {
		// DI smoke test: AuthService is a facade — each collaborator is an inert
		// stand-in, so this proves the injection graph resolves, nothing more.
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AuthService,
				{ provide: IdentityService, useValue: {} },
				{ provide: LoginService, useValue: {} },
				{ provide: LoginVerificationService, useValue: {} },
				{ provide: PasswordResetService, useValue: {} },
				{ provide: ChangePasswordService, useValue: {} },
				{ provide: EmailVerificationService, useValue: {} },
				{ provide: AdminUserService, useValue: {} },
			],
		}).compile();

		service = module.get<AuthService>(AuthService);
	});

	it("should be defined", () => {
		expect(service).toBeInstanceOf(AuthService);
	});
});
