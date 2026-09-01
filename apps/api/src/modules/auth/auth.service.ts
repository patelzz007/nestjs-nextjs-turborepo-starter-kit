import { Injectable } from "@nestjs/common";
import type {
	AdminUserDetail,
	AdminUserListQuery,
	AccessTokenPayload,
	ForgotPasswordInput,
	ForgotPasswordResponse,
	LoginInput,
	LoginServiceResponse,
	MessageResponse,
	ResendVerificationInput,
	ResendVerificationResponse,
	ResetPasswordInput,
	ResetPasswordResponse,
	SessionPermissionsResponse,
	SignupInput,
	SignupResponse,
	UserResponse,
	VerifyEmailResponse,
} from "@workspace/shared";

import { AdminUserService } from "./services/admin-user.service";
import { EmailVerificationService } from "./services/email-verification.service";
import { IdentityService } from "./services/identity.service";
import { LoginService } from "./services/login.service";
import { PasswordResetService } from "./services/password-reset.service";

/**
 * Thin orchestration facade for the auth module.
 *
 * Each domain (identity, login, email verification, password reset, admin
 * user management) lives in its own focused service. This class delegates
 * to them so the controller has a single injection point without coupling
 * to every sub-service.
 *
 * Session lifecycle (refresh, logout, active sessions) lives in
 * `modules/sessions` and impersonation in `modules/impersonation` — see
 * `docs/architecture.md` (module layout convention).
 */
@Injectable()
export class AuthService {
	constructor(
		private readonly identityService: IdentityService,
		private readonly loginService: LoginService,
		private readonly passwordResetService: PasswordResetService,
		private readonly emailVerificationService: EmailVerificationService,
		private readonly adminUserService: AdminUserService,
	) {}

	// ── Identity ────────────────────────────────────────────────────────

	public async signup(signupDto: SignupInput): Promise<SignupResponse> {
		return this.identityService.signup(signupDto);
	}

	public async getMe(userId: string): Promise<UserResponse> {
		return this.identityService.getMe(userId);
	}

	public async getSessionPermissions(userId: string, accessPayload?: AccessTokenPayload): Promise<SessionPermissionsResponse> {
		return this.identityService.getSessionPermissions(userId, accessPayload);
	}

	// ── Login ───────────────────────────────────────────────────────────

	public async login(loginDto: LoginInput, clientType?: string, deviceInfo?: string, ipAddress?: string): Promise<LoginServiceResponse> {
		return this.loginService.login(loginDto, clientType, deviceInfo, ipAddress);
	}

	// ── Email Verification ──────────────────────────────────────────────

	public async resendVerificationEmail(dto: ResendVerificationInput): Promise<ResendVerificationResponse> {
		return this.emailVerificationService.resendVerificationEmail(dto);
	}

	public async verifyEmail(token: string): Promise<VerifyEmailResponse> {
		return this.emailVerificationService.verifyEmail(token);
	}

	// ── Password Reset ──────────────────────────────────────────────────

	public async forgotPassword(dto: ForgotPasswordInput): Promise<ForgotPasswordResponse> {
		return this.passwordResetService.forgotPassword(dto);
	}

	public async resetPassword(dto: ResetPasswordInput): Promise<ResetPasswordResponse> {
		return this.passwordResetService.resetPassword(dto);
	}

	// ── Admin User Management ───────────────────────────────────────────

	public async getAdminUsersList(query: AdminUserListQuery): Promise<{
		readonly items: AdminUserDetail[];
		readonly total: number;
		readonly page: number;
		readonly limit: number;
		readonly totalPages: number;
		readonly hasNext: boolean;
		readonly hasPrevious: boolean;
	}> {
		return this.adminUserService.getAdminUsersList(query);
	}

	public async getAdminUserDetail(userId: string): Promise<AdminUserDetail> {
		return this.adminUserService.getAdminUserDetail(userId);
	}

	public async unlockUser(userId: string): Promise<MessageResponse> {
		return this.adminUserService.unlockUser(userId);
	}
}
