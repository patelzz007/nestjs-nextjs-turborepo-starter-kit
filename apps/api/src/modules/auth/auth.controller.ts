import { Body, Controller, Get, Headers, HttpCode, Param, Patch, Post, Query, Req, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiHeader, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { SkipThrottle, Throttle } from "@nestjs/throttler";
import type {
	AdminUserDetail,
	AdminUserListQuery,
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
	ValidateResetTokenInput,
	ValidateResetTokenResponse,
	SessionPermissionsResponse,
	SignupInput,
	SignupResponse,
	UserResponse,
	VerifyEmailInput,
	VerifyEmailResponse,
	VerifyLoginInput,
} from "@workspace/shared";
import {
	apiContract,
	AdminUserDetailSchema,
	ChangePasswordResponseSchema,
	ForgotPasswordResponseSchema,
	LoginServiceResponseSchema,
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

import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";

import { EmailVerified } from "./decorators/email-verified.decorator";
import { GetUser } from "./decorators/get-user.decorator";
import { Public } from "./decorators/public.decorator";
import { RlsBypass } from "./decorators/rls-bypass.decorator";
import { RequirePermission } from "./decorators/require-permission.decorator";
import { SuperAdminOnly } from "./decorators/super-admin.decorator";
import { ApiErrorResponseDto } from "../../common/dto/api-response.dto";
import { createWrappedArrayDto, createWrappedDto } from "../../common/dto/response-wrapper";
import { SetAuthCookiesInterceptor } from "./interceptors/set-auth-cookies.interceptor";
import { extractClientInfo } from "../../common/utils/client-info";

import { AuthService } from "./auth.service";
import type { AccessTokenPayload } from "./services/token.service";
import { ChangePasswordDto } from "./dtos/change-password.dto";
import { ForgotPasswordDto } from "./dtos/forgot-password.dto";
import { LoginDto } from "./dtos/login.dto";
import { ResendVerificationDto } from "./dtos/resend-verification.dto";
import { ResetPasswordDto } from "./dtos/reset-password.dto";
import { SignupDto } from "./dtos/signup.dto";

// ── Wrapped Response DTOs (envelope + data) ─────────────────────────────
// Each constant wraps a data schema in the { success, data, meta } envelope
// so Swagger sample responses show the full structure.

const WrappedChangePasswordResponse = createWrappedDto(ChangePasswordResponseSchema, "WrappedChangePasswordResponse");
const WrappedSignupResponse = createWrappedDto(SignupResponseSchema, "WrappedSignupResponse");
const WrappedLoginResponse = createWrappedDto(LoginServiceResponseSchema, "WrappedLoginResponse");
const WrappedResendVerificationResponse = createWrappedDto(ResendVerificationResponseSchema, "WrappedResendVerificationResponse");
const WrappedForgotPasswordResponse = createWrappedDto(ForgotPasswordResponseSchema, "WrappedForgotPasswordResponse");
const WrappedResetPasswordResponse = createWrappedDto(ResetPasswordResponseSchema, "WrappedResetPasswordResponse");
const WrappedValidateResetTokenResponse = createWrappedDto(ValidateResetTokenResponseSchema, "WrappedValidateResetTokenResponse");
const WrappedUserResponse = createWrappedDto(UserResponseSchema, "WrappedUserResponse");
const WrappedSessionPermissionsResponse = createWrappedDto(SessionPermissionsResponseSchema, "WrappedSessionPermissionsResponse");
const WrappedVerifyEmailResponse = createWrappedDto(VerifyEmailResponseSchema, "WrappedVerifyEmailResponse");
const WrappedAdminUserList = createWrappedArrayDto(AdminUserDetailSchema, "WrappedAdminUserList");
const WrappedAdminUserDetail = createWrappedDto(AdminUserDetailSchema, "WrappedAdminUserDetail");
const WrappedMessageResponse = createWrappedDto(MessageResponseSchema, "WrappedMessageResponse");

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
	constructor(private readonly authService: AuthService) {}

	@Throttle({ strict: { ttl: 60000, limit: 3 } })
	@Public()
	@RlsBypass()
	@Post("/signup")
	@ApiOperation({ summary: "Register a new user account" })
	@ApiBody({ type: SignupDto })
	@ApiCreatedResponse({ type: WrappedSignupResponse, description: "User registered" })
	@ApiResponse({ status: 409, type: ApiErrorResponseDto, description: "Email already in use" })
	@ApiHeader({
		name: "x-client-type",
		required: false,
		description: "Set to 'merchant' so the verification link targets the merchant app. Defaults to the web app.",
	})
	public async signup(
		@Body(new ZodValidationPipe(apiContract.auth.signup.input)) body: SignupInput,
		@Headers("x-client-type") headerClientType: string | undefined,
		@Query("client_type") queryClientType: string | undefined,
	): Promise<SignupResponse> {
		const clientType: string | undefined = headerClientType ?? queryClientType;
		return this.authService.signup(body, clientType);
	}

	@Throttle({ strict: { ttl: 60000, limit: 5 } })
	@Public()
	@RlsBypass()
	@Post("/login")
	@ApiOperation({ summary: "Authenticate with email and password" })
	@ApiBody({ type: LoginDto })
	@ApiHeader({
		name: "x-client-type",
		required: false,
		description: "Set to 'admin' when logging in from the admin panel. Only users with isSuperAdmin === true or the ADMIN_DASHBOARD permission may use this.",
	})
	@ApiOkResponse({ type: WrappedLoginResponse, description: "Login successful" })
	@ApiResponse({ status: 401, type: ApiErrorResponseDto, description: "Invalid credentials / Account locked" })
	@ApiResponse({ status: 403, type: ApiErrorResponseDto, description: "Admin access required (when X-Client-Type: admin and user is not superadmin)" })
	@UseInterceptors(SetAuthCookiesInterceptor)
	public async login(
		@Body(new ZodValidationPipe(apiContract.auth.login.input)) body: LoginInput,
		@Headers("x-client-type") headerClientType: string | undefined,
		@Query("client_type") queryClientType: string | undefined,
		@Req() req: FastifyRequest,
	): Promise<LoginServiceResponse | LoginTwoFactorPendingResponse | LoginVerificationPendingResponse> {
		// Accept client type from header (browser apps) or query param (Swagger UI)
		const clientType: string | undefined = headerClientType ?? queryClientType;
		const { deviceInfo, ipAddress } = extractClientInfo(req);
		return this.authService.login(body, clientType, deviceInfo, ipAddress);
	}

	// ── Email Verification ───────────────────────────────────────────────

	@Throttle({ strict: { ttl: 60000, limit: 3 } })
	@Public()
	@RlsBypass()
	@Post("/resend-verification")
	@HttpCode(200)
	@ApiOperation({ summary: "Resend email verification link" })
	@ApiBody({ type: ResendVerificationDto })
	@ApiOkResponse({ type: WrappedResendVerificationResponse, description: "Verification email resent" })
	@ApiHeader({
		name: "x-client-type",
		required: false,
		description: "Set to 'merchant' so the verification link targets the merchant app. Defaults to the web app.",
	})
	public async resendVerification(
		@Body(new ZodValidationPipe(apiContract.auth.resendVerification.input)) body: ResendVerificationInput,
		@Headers("x-client-type") headerClientType: string | undefined,
		@Query("client_type") queryClientType: string | undefined,
	): Promise<ResendVerificationResponse> {
		const clientType: string | undefined = headerClientType ?? queryClientType;
		return this.authService.resendVerificationEmail(body, clientType);
	}

	// ── Password Reset ───────────────────────────────────────────────────

	@Throttle({ strict: { ttl: 60000, limit: 3 } })
	@Public()
	@RlsBypass()
	@Post("/forgot-password")
	@HttpCode(200)
	@ApiOperation({ summary: "Request a password reset email" })
	@ApiBody({ type: ForgotPasswordDto })
	@ApiHeader({
		name: "x-client-type",
		required: false,
		description: "Set to 'admin' or 'merchant' so the reset link targets the correct frontend. Defaults to the web app.",
	})
	@ApiOkResponse({ type: WrappedForgotPasswordResponse, description: "Password reset email sent (if account exists)" })
	public async forgotPassword(
		@Body(new ZodValidationPipe(apiContract.auth.forgotPassword.input)) body: ForgotPasswordInput,
		@Headers("x-client-type") headerClientType: string | undefined,
		@Query("client_type") queryClientType: string | undefined,
	): Promise<ForgotPasswordResponse> {
		const clientType: string | undefined = headerClientType ?? queryClientType;
		return this.authService.forgotPassword(body, clientType);
	}

	@Throttle({ strict: { ttl: 60000, limit: 5 } })
	@Public()
	@RlsBypass()
	@Post("/reset-password")
	@HttpCode(200)
	@ApiOperation({ summary: "Reset password using a valid reset token" })
	@ApiBody({ type: ResetPasswordDto })
	@ApiOkResponse({ type: WrappedResetPasswordResponse, description: "Password reset successful" })
	@ApiResponse({ status: 401, type: ApiErrorResponseDto, description: "Invalid or expired reset token" })
	public async resetPassword(@Body(new ZodValidationPipe(apiContract.auth.resetPassword.input)) body: ResetPasswordInput): Promise<ResetPasswordResponse> {
		return this.authService.resetPassword(body);
	}

	@Throttle({ strict: { ttl: 60000, limit: 10 } })
	@Public()
	@RlsBypass()
	@Post("/validate-reset-token")
	@HttpCode(200)
	@ApiOperation({ summary: "Validate a password reset token without consuming it" })
	@ApiOkResponse({ type: WrappedValidateResetTokenResponse, description: "Whether the reset token is valid" })
	public async validateResetToken(@Body(new ZodValidationPipe(apiContract.auth.validateResetToken.input)) body: ValidateResetTokenInput): Promise<ValidateResetTokenResponse> {
		return this.authService.validateResetToken(body);
	}

	@Throttle({ strict: { ttl: 60000, limit: 10 } })
	@Public()
	@RlsBypass()
	@Post("/verify-login")
	@HttpCode(200)
	@ApiOperation({ summary: "Complete login with an email verification code" })
	@ApiOkResponse({ type: WrappedLoginResponse, description: "Login successful after verification" })
	@UseInterceptors(SetAuthCookiesInterceptor)
	public async verifyLogin(
		@Body(new ZodValidationPipe(apiContract.auth.verifyLogin.input)) body: VerifyLoginInput,
		@Req() req: FastifyRequest,
	): Promise<LoginServiceResponse> {
		const { ipAddress } = extractClientInfo(req);
		return this.authService.verifyLogin(body, ipAddress);
	}

	@SkipThrottle()
	@ApiBearerAuth()
	@Post("/change-password")
	@HttpCode(200)
	@ApiOperation({ summary: "Change password for the authenticated user" })
	@ApiBody({ type: ChangePasswordDto })
	@ApiOkResponse({ type: WrappedChangePasswordResponse, description: "Password changed successfully" })
	public async changePassword(@GetUser("sub") userId: string, @Body(new ZodValidationPipe(apiContract.auth.changePassword.input)) body: ChangePasswordInput): Promise<ChangePasswordResponse> {
		return this.authService.changePassword(userId, body);
	}

	@SkipThrottle()
	@ApiBearerAuth()
	@Get("/me")
	@ApiOperation({ summary: "Get the currently authenticated user's profile" })
	@ApiOkResponse({ type: WrappedUserResponse, description: "Current user profile" })
	@ApiResponse({ status: 401, type: ApiErrorResponseDto, description: "Access token missing / invalid" })
	public async getMe(@GetUser("sub") userId: string): Promise<UserResponse> {
		return this.authService.getMe(userId);
	}

	@SkipThrottle()
	@ApiBearerAuth()
	@Get("/permissions")
	@ApiOperation({ summary: "Get the current session's roles and permissions" })
	@ApiOkResponse({ type: WrappedSessionPermissionsResponse, description: "Session RBAC payload" })
	@ApiResponse({ status: 401, type: ApiErrorResponseDto, description: "Access token missing / invalid" })
	public async getSessionPermissions(@GetUser("sub") userId: string, @GetUser() accessPayload: AccessTokenPayload | undefined): Promise<SessionPermissionsResponse> {
		return this.authService.getSessionPermissions(userId, accessPayload);
	}

	@Public()
	@RlsBypass()
	@Post("/verify-email")
	@ApiOperation({ summary: "Verify email address using a verification token" })
	@ApiOkResponse({ type: WrappedVerifyEmailResponse, description: "Email verified" })
	public async verifyEmail(@Body(new ZodValidationPipe(apiContract.auth.verifyEmail.input)) body: VerifyEmailInput): Promise<VerifyEmailResponse> {
		return this.authService.verifyEmail(body.token);
	}

	// ═══════════════════════════════════════════════════════════════════════
	// Admin User Management  (SuperAdmin only)
	// ═══════════════════════════════════════════════════════════════════════

	@SkipThrottle()
	@ApiBearerAuth()
	@SuperAdminOnly()
	@RequirePermission("LIST", "USER")
	@Get("/admin/users")
	@ApiOperation({ summary: "SuperAdmin: list all users with roles and lockout status" })
	@ApiOkResponse({ type: WrappedAdminUserList, description: "Admin user list" })
	@ApiResponse({ status: 403, type: ApiErrorResponseDto, description: "SuperAdmin privileges required" })
	public async getAdminUsersList(@Query(new ZodValidationPipe(apiContract.auth.adminUsers.input)) query: AdminUserListQuery): Promise<{
		readonly items: AdminUserDetail[];
		readonly total: number;
		readonly page: number;
		readonly limit: number;
		readonly totalPages: number;
		readonly hasNext: boolean;
		readonly hasPrevious: boolean;
	}> {
		return this.authService.getAdminUsersList(query);
	}

	@SkipThrottle()
	@ApiBearerAuth()
	@SuperAdminOnly()
	@RequirePermission("READ", "USER")
	@Get("/admin/users/:userId")
	@ApiOperation({ summary: "SuperAdmin: get detailed user info including security state" })
	@ApiOkResponse({ type: WrappedAdminUserDetail, description: "Full user detail with lockout status" })
	@ApiResponse({ status: 404, type: ApiErrorResponseDto, description: "User not found" })
	public async getAdminUserDetail(@Param("userId", new ZodValidationPipe(UuidParamSchema)) userId: string): Promise<AdminUserDetail> {
		return this.authService.getAdminUserDetail(userId);
	}

	@SkipThrottle()
	@ApiBearerAuth()
	@SuperAdminOnly()
	@EmailVerified()
	@RequirePermission("UPDATE", "USER")
	@Patch("/admin/users/:userId/unlock")
	@ApiOperation({ summary: "SuperAdmin: unlock a locked user account" })
	@ApiOkResponse({ type: WrappedMessageResponse, description: "Account unlocked" })
	@ApiResponse({ status: 404, type: ApiErrorResponseDto, description: "User not found" })
	public async unlockUser(@Param("userId", new ZodValidationPipe(UuidParamSchema)) userId: string): Promise<MessageResponse> {
		return this.authService.unlockUser(userId);
	}
}
