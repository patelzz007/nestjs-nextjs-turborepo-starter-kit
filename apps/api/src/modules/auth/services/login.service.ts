import { Injectable, UnauthorizedException } from "@nestjs/common";
import { z } from "zod";
import type {
	LoginInput,
	LoginRestrictedEnrollmentResponse,
	LoginServiceResponse,
	LoginTwoFactorPendingResponse,
	LoginVerificationPendingResponse,
	UserPermissions,
} from "@workspace/shared";

import { AuthorizationCheckerService } from "../../authorization/services/authorization-checker.service";
import { TrackAuthFlow } from "../decorators/track-auth-flow.decorator";
import { UserRepository } from "../repositories/user.repository";
import { AccountLockoutService } from "./account-lockout.service";
import { CryptoService } from "./crypto.service";
import { LoginVerificationService } from "./login-verification.service";
import { TwoFactorService } from "./two-factor.service";

/**
 * Handles the login flow: credential verification, admin access check,
 * brute-force protection (via `AccountLockoutService`), session creation,
 * and token generation.
 *
 * Extracted from `AuthService` to follow single-responsibility principle.
 */
@Injectable()
export class LoginService {
	constructor(
		private readonly userRepo: UserRepository,
		private readonly cryptoService: CryptoService,
		private readonly authorizationChecker: AuthorizationCheckerService,
		private readonly lockoutService: AccountLockoutService,
		private readonly twoFactorService: TwoFactorService,
		private readonly loginVerificationService: LoginVerificationService,
	) {}

	@TrackAuthFlow({
		flow: "login",
		clientType: (_loginDto: unknown, clientType?: unknown) => {
			const parsed = z.string().safeParse(clientType);
			return parsed.success ? parsed.data : null;
		},
	})
	public async login(
		loginDto: LoginInput,
		clientType?: string,
		deviceInfo?: string,
		ipAddress?: string,
	): Promise<LoginServiceResponse | LoginRestrictedEnrollmentResponse | LoginTwoFactorPendingResponse | LoginVerificationPendingResponse> {
		const { email, password } = loginDto;

		const user = await this.userRepo.findLoginByEmail(email);

		// ── Client-type check: admin-only login ─────────────────────────
		// Uniform INVALID_CREDENTIALS for all failures — no admin-capability probing.
		// ─────────────────────────────────────────────────────────────────

		// Use consistent dummy hash to prevent timing-based account enumeration
		const dummyHash = await this.cryptoService.hash("dummy-password-to-prevent-timing-attack");
		const passwordHash = user?.passwordHash ?? dummyHash;
		const passwordMatches = await this.cryptoService.compare(password, passwordHash);

		// ── Brute-force protection ────────────────────────────────────────
		// checkLockout throws UnauthorizedException if account is locked
		await this.lockoutService.checkLockout(user, clientType, performance.now());

		if (!user || !user.isActive || user.isDeleted || !passwordMatches) {
			if (user) {
				// recordFailedAttempt increments counter and throws if threshold crossed
				await this.lockoutService.recordFailedAttempt(user, clientType, performance.now());
			}

			// Non-existent / inactive user — throw directly
			throw new UnauthorizedException({
				message: "Invalid email or password",
				error: "INVALID_CREDENTIALS",
			});
		}

		if (clientType === "admin" && !user.isSuperAdmin) {
			const userPerms: UserPermissions = await this.authorizationChecker.getUserPermissionDetails(user.id);
			const hasDashboardAccess: boolean = userPerms.permissions.some((p) => p.resource === "ADMIN_DASHBOARD");
			if (!hasDashboardAccess) {
				throw new UnauthorizedException({
					message: "Invalid email or password",
					error: "INVALID_CREDENTIALS",
				});
			}
		}
		// ─────────────────────────────────────────────────────────────────

		// ── Reset failed attempts only after password step when 2FA is not required ──
		if (!user.twoFactorEnabled) {
			await this.lockoutService.resetAttempts(user.id);
			return this.loginVerificationService.maybeRequireVerification({
				userId: user.id,
				clientType: clientType ?? null,
				deviceInfo: deviceInfo ?? null,
				ipAddress: ipAddress ?? null,
			});
		}

		return this.twoFactorService.createLoginChallenge(user.id, clientType, deviceInfo, ipAddress);
	}
}
