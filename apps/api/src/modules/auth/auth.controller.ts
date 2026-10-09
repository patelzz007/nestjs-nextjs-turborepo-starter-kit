import { Controller, Get, Headers, HttpStatus, Patch, Post, Req, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type {
	AdminUserDetail,
	AuthClientTypeQuery,
	AdminUserListQuery,
	ChangePasswordInput,
	ChangePasswordResponse,
	ForgotPasswordInput,
	ForgotPasswordResponse,
	LoginInput,
	LoginRestrictedEnrollmentResponse,
	LoginServiceResponse,
	LoginTwoFactorPendingResponse,
	LoginVerificationPendingResponse,
	MessageResponse,
	PaginatedServiceResult,
	ResendVerificationInput,
	ResendVerificationResponse,
	ResetPasswordInput,
	ResetPasswordResponse,
	ValidateResetTokenInput,
	ValidateResetTokenResponse,
	SessionPermissionsResponse,
	ConsumerWebSignupInput,
	SignupResponse,
	UserResponse,
	VerifyEmailInput,
	VerifyEmailResponse,
	VerifyLoginInput,
} from "@workspace/shared";
import {
	apiContract,
	AdminUserDetailSchema,
	AuthClientTypeQuerySchema,
	ChangePasswordResponseSchema,
	ForgotPasswordResponseSchema,
	LoginClientResponseSchema,
	MessageResponseSchema,
	ResendVerificationResponseSchema,
	ResetPasswordResponseSchema,
	ValidateResetTokenResponseSchema,
	SignupResponseSchema,
	SessionPermissionsResponseSchema,
	UserResponseSchema,
	VerifyEmailResponseSchema,
	apiPath,
	UuidParamSchema,
} from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import { ZodBody, ZodListQuery, ZodQuery, ZodParam } from "../../common/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../common/decorators/zod-response.decorators";

import { EmailVerified } from "./decorators/email-verified.decorator";
import { GetUser } from "./decorators/get-user.decorator";
import { Public } from "./decorators/public.decorator";
import { RlsBypass } from "./decorators/rls-bypass.decorator";
import { RequirePermission } from "./decorators/require-permission.decorator";
import { SkipAuthThrottle } from "./decorators/skip-auth-throttle.decorator";
import { SkipMutationIntent } from "./decorators/skip-mutation-intent.decorator";
import { SuperAdminOnly } from "./decorators/super-admin.decorator";
import { ApiErrorResponseDto } from "../../common/dto/api-response.dto";
import { SetAuthCookiesInterceptor } from "./interceptors/set-auth-cookies.interceptor";
import { readSessionDeviceContext } from "../sessions/device/session-device";
import { Authorize, self } from "../authorization/decorators/authorize.decorator";

import { AuthService } from "./auth.service";
import { TOKEN_DELIVERY_DESCRIPTION } from "./constants/token-delivery.constants";
import type { AccessTokenPayload } from "./services/token.service";

/**
 * Credential / identity / admin endpoints: signup, login, email verification,
 * password reset, `/me`, and SuperAdmin user management.
 *
 * Session lifecycle endpoints moved to `SessionsController`, impersonation to
 * `ImpersonationController` — URL paths are unchanged.
 */
@ApiTags("Auth")
@Controller(apiPath("/auth"))
export class AuthController {
	public constructor(private readonly authService: AuthService) {}

	@Throttle({ strict: { ttl: 60000, limit: 3 } })
	@Public()
	@RlsBypass()
	@SkipMutationIntent()
	@Post("/signup")
	@ApiOperation({ summary: "Register a new user account" })
	@ZodResponse(SignupResponseSchema, { status: HttpStatus.CREATED, description: "User registered" })
	@ApiResponse({ status: 409, type: ApiErrorResponseDto, description: "Email already in use" })
	@ApiHeader({
		name: "x-client-type",
		required: false,
		description: "Set to 'merchant' so the verification link targets the merchant app. Defaults to the web app.",
	})
	public async signup(
		@ZodBody(apiContract.auth.signup.input) body: ConsumerWebSignupInput,
		@Headers("x-client-type") headerClientType: string | undefined,
		@ZodQuery(AuthClientTypeQuerySchema) query: AuthClientTypeQuery,
	): Promise<SignupResponse> {
		const clientType: string | undefined = headerClientType ?? query.client_type;
		return this.authService.signup(body, clientType);
	}

	@Throttle({ strict: { ttl: 60000, limit: 5 } })
	@Public()
	@RlsBypass()
	@SkipMutationIntent()
	@Post("/login")
	@ApiOperation({ summary: "Authenticate with email and password" })
	@ApiHeader({
		name: "x-client-type",
		required: false,
		description:
			"Set to 'admin' when logging in from the admin panel (only users with isSuperAdmin === true or the ADMIN_DASHBOARD permission may use this), 'merchant' from the merchant portal, or 'mobile' from the mobile app (tokens in the body, no cookies; requires X-App-Version).",
	})
	@ZodResponse(LoginClientResponseSchema, {
		status: HttpStatus.CREATED,
		description: "Login result" + TOKEN_DELIVERY_DESCRIPTION,
	})
	@ApiResponse({ status: 401, type: ApiErrorResponseDto, description: "Invalid credentials / Account locked" })
	@ApiResponse({ status: 403, type: ApiErrorResponseDto, description: "Admin access required (when X-Client-Type: admin and user is not superadmin)" })
	@UseInterceptors(SetAuthCookiesInterceptor)
	public async login(
		@ZodBody(apiContract.auth.login.input) body: LoginInput,
		@Headers("x-client-type") headerClientType: string | undefined,
		@ZodQuery(AuthClientTypeQuerySchema) query: AuthClientTypeQuery,
		@Req() req: FastifyRequest,
	): Promise<LoginServiceResponse | LoginRestrictedEnrollmentResponse | LoginTwoFactorPendingResponse | LoginVerificationPendingResponse> {
		// Accept client type from header (browser apps) or query param (Swagger UI)
		const clientType: string | undefined = headerClientType ?? query.client_type;
		return this.authService.login(body, clientType, readSessionDeviceContext(req));
	}

	// ── Email Verification ───────────────────────────────────────────────

	@Throttle({ strict: { ttl: 60000, limit: 3 } })
	@Public()
	@RlsBypass()
	@SkipMutationIntent()
	@Post("/resend-verification")
	@ApiOperation({ summary: "Resend email verification link" })
	@ZodResponse(ResendVerificationResponseSchema, { description: "Verification email resent" })
	@ApiHeader({
		name: "x-client-type",
		required: false,
		description: "Set to 'merchant' so the verification link targets the merchant app. Defaults to the web app.",
	})
	public async resendVerification(
		@ZodBody(apiContract.auth.resendVerification.input) body: ResendVerificationInput,
		@Headers("x-client-type") headerClientType: string | undefined,
		@ZodQuery(AuthClientTypeQuerySchema) query: AuthClientTypeQuery,
	): Promise<ResendVerificationResponse> {
		const clientType: string | undefined = headerClientType ?? query.client_type;
		return this.authService.resendVerificationEmail(body, clientType);
	}

	// ── Password Reset ───────────────────────────────────────────────────

	@Throttle({ strict: { ttl: 60000, limit: 3 } })
	@Public()
	@RlsBypass()
	@SkipMutationIntent()
	@Post("/forgot-password")
	@ApiOperation({ summary: "Request a password reset email" })
	@ApiHeader({
		name: "x-client-type",
		required: false,
		description: "Set to 'admin' or 'merchant' so the reset link targets the correct frontend. Defaults to the web app.",
	})
	@ZodResponse(ForgotPasswordResponseSchema, { description: "Password reset email sent (if account exists)" })
	public async forgotPassword(
		@ZodBody(apiContract.auth.forgotPassword.input) body: ForgotPasswordInput,
		@Headers("x-client-type") headerClientType: string | undefined,
		@ZodQuery(AuthClientTypeQuerySchema) query: AuthClientTypeQuery,
	): Promise<ForgotPasswordResponse> {
		const clientType: string | undefined = headerClientType ?? query.client_type;
		return this.authService.forgotPassword(body, clientType);
	}

	@Throttle({ strict: { ttl: 60000, limit: 5 } })
	@Public()
	@RlsBypass()
	@SkipMutationIntent()
	@Post("/reset-password")
	@ApiOperation({ summary: "Reset password using a valid reset token" })
	@ZodResponse(ResetPasswordResponseSchema, { description: "Password reset successful" })
	@ApiResponse({ status: 401, type: ApiErrorResponseDto, description: "Invalid or expired reset token" })
	public async resetPassword(@ZodBody(apiContract.auth.resetPassword.input) body: ResetPasswordInput): Promise<ResetPasswordResponse> {
		return this.authService.resetPassword(body);
	}

	@Throttle({ strict: { ttl: 60000, limit: 10 } })
	@Public()
	@RlsBypass()
	@SkipMutationIntent()
	@Post("/validate-reset-token")
	@ApiOperation({ summary: "Validate a password reset token without consuming it" })
	@ZodResponse(ValidateResetTokenResponseSchema, { description: "Whether the reset token is valid" })
	public async validateResetToken(@ZodBody(apiContract.auth.validateResetToken.input) body: ValidateResetTokenInput): Promise<ValidateResetTokenResponse> {
		return this.authService.validateResetToken(body);
	}

	@Throttle({ strict: { ttl: 60000, limit: 10 } })
	@Public()
	@RlsBypass()
	@SkipMutationIntent()
	@Post("/verify-login")
	@ApiOperation({ summary: "Complete login with an email verification code" })
	@ZodResponse(LoginClientResponseSchema, { description: "Login result after verification" + TOKEN_DELIVERY_DESCRIPTION })
	@UseInterceptors(SetAuthCookiesInterceptor)
	public async verifyLogin(
		@ZodBody(apiContract.auth.verifyLogin.input) body: VerifyLoginInput,
		@Req() req: FastifyRequest,
	): Promise<LoginServiceResponse | LoginRestrictedEnrollmentResponse> {
		return this.authService.verifyLogin(body, readSessionDeviceContext(req));
	}

	@SkipAuthThrottle()
	@ApiBearerAuth()
	@Post("/change-password")
	@Authorize({
		action: "UPDATE",
		resource: "USER",
		resourceId: self(),
		description: "User can only change their own password",
	})
	@ApiOperation({ summary: "Change password for the authenticated user" })
	@ZodResponse(ChangePasswordResponseSchema, { description: "Password changed successfully" })
	public async changePassword(@GetUser("sub") userId: string, @ZodBody(apiContract.auth.changePassword.input) body: ChangePasswordInput): Promise<ChangePasswordResponse> {
		return this.authService.changePassword(userId, body);
	}

	@SkipAuthThrottle()
	@ApiBearerAuth()
	@Get("/me")
	@ApiOperation({ summary: "Get the currently authenticated user's profile" })
	@ZodResponse(UserResponseSchema, { description: "Current user profile" })
	@ApiResponse({ status: 401, type: ApiErrorResponseDto, description: "Access token missing / invalid" })
	public async getMe(@GetUser("sub") userId: string): Promise<UserResponse> {
		return this.authService.getMe(userId);
	}

	@SkipAuthThrottle()
	@ApiBearerAuth()
	@Get("/permissions")
	@ApiOperation({ summary: "Get the current session's roles and permissions" })
	@ZodResponse(SessionPermissionsResponseSchema, { description: "Session RBAC payload" })
	@ApiResponse({ status: 401, type: ApiErrorResponseDto, description: "Access token missing / invalid" })
	public async getSessionPermissions(@GetUser("sub") userId: string, @GetUser() accessPayload: AccessTokenPayload | undefined): Promise<SessionPermissionsResponse> {
		return this.authService.getSessionPermissions(userId, accessPayload);
	}

	@Public()
	@RlsBypass()
	@SkipMutationIntent()
	@SkipAuthThrottle()
	@Post("/verify-email")
	@ApiOperation({ summary: "Verify email address using a verification token" })
	@ZodResponse(VerifyEmailResponseSchema, { status: HttpStatus.CREATED, description: "Email verified" })
	public async verifyEmail(@ZodBody(apiContract.auth.verifyEmail.input) body: VerifyEmailInput): Promise<VerifyEmailResponse> {
		return this.authService.verifyEmail(body.token);
	}

	// ═══════════════════════════════════════════════════════════════════════
	// Admin User Management  (SuperAdmin only)
	// ═══════════════════════════════════════════════════════════════════════

	@SkipAuthThrottle()
	@ApiBearerAuth()
	@SuperAdminOnly()
	@RequirePermission("LIST", "USER")
	@Get("/admin/users")
	@ApiOperation({ summary: "SuperAdmin: list all users with roles and lockout status" })
	@ZodPaginatedResponse(AdminUserDetailSchema, { description: "Paginated admin user list" })
	@ApiResponse({ status: 403, type: ApiErrorResponseDto, description: "SuperAdmin privileges required" })
	public async getAdminUsersList(@ZodListQuery(apiContract.auth.adminUsers.input) query: AdminUserListQuery): Promise<PaginatedServiceResult<AdminUserDetail>> {
		return this.authService.getAdminUsersList(query);
	}

	@SkipAuthThrottle()
	@ApiBearerAuth()
	@SuperAdminOnly()
	@RequirePermission("READ", "USER")
	@Get("/admin/users/:userId")
	@ApiOperation({ summary: "SuperAdmin: get detailed user info including security state" })
	@ZodResponse(AdminUserDetailSchema, { description: "Full user detail with lockout status" })
	@ApiResponse({ status: 404, type: ApiErrorResponseDto, description: "User not found" })
	public async getAdminUserDetail(@ZodParam("userId", UuidParamSchema) userId: string): Promise<AdminUserDetail> {
		return this.authService.getAdminUserDetail(userId);
	}

	@SkipAuthThrottle()
	@ApiBearerAuth()
	@SuperAdminOnly()
	@EmailVerified()
	@RequirePermission("UPDATE", "USER")
	@Authorize({
		action: "UPDATE",
		resource: "USER",
		resourceId: "userId",
		description: "SuperAdmin can unlock any user account",
	})
	@Patch("/admin/users/:userId/unlock")
	@ApiOperation({ summary: "SuperAdmin: unlock a locked user account" })
	@ZodResponse(MessageResponseSchema, { description: "Account unlocked" })
	@ApiResponse({ status: 404, type: ApiErrorResponseDto, description: "User not found" })
	public async unlockUser(@ZodParam("userId", UuidParamSchema) userId: string): Promise<MessageResponse> {
		return this.authService.unlockUser(userId);
	}
}
