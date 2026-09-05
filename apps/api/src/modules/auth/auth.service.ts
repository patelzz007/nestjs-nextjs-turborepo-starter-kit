import { Injectable } from "@nestjs/common";
import type {
	AdminUserDetail,
	AdminUserListQuery,
	AccessTokenPayload,
	ChangePasswordInput,
	ChangePasswordResponse,
	ForgotPasswordInput,
	ForgotPasswordResponse,
	LoginInput,
	LoginServiceResponse,
	LoginTwoFactorPendingResponse,
	LoginVerificationPendingResponse,
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
	ValidateResetTokenInput,
	ValidateResetTokenResponse,
	VerifyLoginInput,
} from "@workspace/shared";

import { AdminUserService } from "./services/admin-user.service";
import { ChangePasswordService } from "./services/change-password.service";
import { EmailVerificationService } from "./services/email-verification.service";
import { IdentityService } from "./services/identity.service";
import { LoginService } from "./services/login.service";
import { LoginVerificationService } from "./services/login-verification.service";
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
		private readonly loginVerificationService: LoginVerificationService,
		private readonly passwordResetService: PasswordResetService,
		private readonly changePasswordService: ChangePasswordService,
		private readonly emailVerificationService: EmailVerificationService,
		private readonly adminUserService: AdminUserService,
	) {}

	// ── Identity ────────────────────────────────────────────────────────

	public async signup(signupDto: SignupInput, clientType?: string): Promise<SignupResponse> {
		return this.identityService.signup(signupDto, clientType);
	}

	public async getMe(userId: string): Promise<UserResponse> {
		return this.identityService.getMe(userId);
	}

	public async getSessionPermissions(userId: string, accessPayload?: AccessTokenPayload): Promise<SessionPermissionsResponse> {
		return this.identityService.getSessionPermissions(userId, accessPayload);
	}

	// ── Login ───────────────────────────────────────────────────────────

	public async login(
		loginDto: LoginInput,
		clientType?: string,
		deviceInfo?: string,
		ipAddress?: string,
	): Promise<LoginServiceResponse | LoginTwoFactorPendingResponse | LoginVerificationPendingResponse> {
		return this.loginService.login(loginDto, clientType, deviceInfo, ipAddress);
	}

	public async verifyLogin(dto: VerifyLoginInput, ipAddress?: string): Promise<LoginServiceResponse> {
		return this.loginVerificationService.verifyLoginCode(dto.verificationId, dto.code, ipAddress);
	}

	// ── Email Verification ──────────────────────────────────────────────

	public async resendVerificationEmail(dto: ResendVerificationInput, clientType?: string): Promise<ResendVerificationResponse> {
		return this.emailVerificationService.resendVerificationEmail(dto, clientType);
	}

	public async verifyEmail(token: string): Promise<VerifyEmailResponse> {
		return this.emailVerificationService.verifyEmail(token);
	}

	// ── Password Reset ──────────────────────────────────────────────────

	public async forgotPassword(dto: ForgotPasswordInput, clientType?: string): Promise<ForgotPasswordResponse> {
		return this.passwordResetService.forgotPassword(dto, clientType);
	}

	public async resetPassword(dto: ResetPasswordInput): Promise<ResetPasswordResponse> {
		return this.passwordResetService.resetPassword(dto);
	}

	public async validateResetToken(dto: ValidateResetTokenInput): Promise<ValidateResetTokenResponse> {
		return this.passwordResetService.validateResetToken(dto.token);
	}

	public async changePassword(userId: string, dto: ChangePasswordInput): Promise<ChangePasswordResponse> {
		return this.changePasswordService.changePassword(userId, dto);
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
