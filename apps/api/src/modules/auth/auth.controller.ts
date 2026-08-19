import { Body, Controller, Get, Headers, HttpCode, Param, Patch, Post, Query, Req, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiHeader, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { SkipThrottle, Throttle } from "@nestjs/throttler";
import type {
	AdminUserDetail,
	AdminUserListQuery,
	ForgotPasswordInput,
	ForgotPasswordResponse,
	LoginInput,
	LoginServiceResponse,
	MessageResponse,
	ResendVerificationInput,
	ResendVerificationResponse,
	ResetPasswordInput,
	ResetPasswordResponse,
	SignupInput,
	SignupResponse,
	UserResponse,
	VerifyEmailResponse,
} from "@workspace/shared";
import {
	AdminUserDetailSchema,
	ForgotPasswordResponseSchema,
	LoginServiceResponseSchema,
	MessageResponseSchema,
	ResendVerificationResponseSchema,
	ResetPasswordResponseSchema,
	SignupResponseSchema,
	UserResponseSchema,
	VerifyEmailResponseSchema,
	apiContract,
	apiPath,
	UuidParamSchema,
	VerifyEmailTokenParamSchema,
} from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";

import { EmailVerified } from "./decorators/email-verified.decorator";
import { GetUser } from "./decorators/get-user.decorator";
import { Public } from "./decorators/public.decorator";
import { RequirePermission } from "./decorators/require-permission.decorator";
import { SuperAdminOnly } from "./decorators/super-admin.decorator";
import { ApiErrorResponseDto } from "../../common/dto/api-response.dto";
import { createWrappedArrayDto, createWrappedDto } from "../../common/dto/response-wrapper";
import { SetAuthCookiesInterceptor } from "./interceptors/set-auth-cookies.interceptor";
import { extractClientInfo } from "../../common/utils/client-info";

import { AuthService } from "./auth.service";
import { ForgotPasswordDto } from "./dtos/forgot-password.dto";
import { LoginDto } from "./dtos/login.dto";
import { ResendVerificationDto } from "./dtos/resend-verification.dto";
import { ResetPasswordDto } from "./dtos/reset-password.dto";
import { SignupDto } from "./dtos/signup.dto";

// ── Wrapped Response DTOs (envelope + data) ─────────────────────────────
// Each constant wraps a data schema in the { success, data, meta } envelope
// so Swagger sample responses show the full structure.

const WrappedSignupResponse = createWrappedDto(SignupResponseSchema, "WrappedSignupResponse");
const WrappedLoginResponse = createWrappedDto(LoginServiceResponseSchema, "WrappedLoginResponse");
const WrappedResendVerificationResponse = createWrappedDto(ResendVerificationResponseSchema, "WrappedResendVerificationResponse");
const WrappedForgotPasswordResponse = createWrappedDto(ForgotPasswordResponseSchema, "WrappedForgotPasswordResponse");
const WrappedResetPasswordResponse = createWrappedDto(ResetPasswordResponseSchema, "WrappedResetPasswordResponse");
const WrappedUserResponse = createWrappedDto(UserResponseSchema, "WrappedUserResponse");
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
	@Post("/signup")
	@ApiOperation({ summary: "Register a new user account" })
	@ApiBody({ type: SignupDto })
	@ApiCreatedResponse({ type: WrappedSignupResponse, description: "User registered" })
	@ApiResponse({ status: 409, type: ApiErrorResponseDto, description: "Email already in use" })
	public async signup(@Body(new ZodValidationPipe(apiContract.auth.signup.input)) body: SignupInput): Promise<SignupResponse> {
		return this.authService.signup(body);
	}

	@Throttle({ strict: { ttl: 60000, limit: 5 } })
	@Public()
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
	): Promise<LoginServiceResponse> {
		// Accept client type from header (browser apps) or query param (Swagger UI)
		const clientType: string | undefined = headerClientType ?? queryClientType;
		const { deviceInfo, ipAddress } = extractClientInfo(req);
		return this.authService.login(body, clientType, deviceInfo, ipAddress);
	}

	// ── Email Verification ───────────────────────────────────────────────

	@Throttle({ strict: { ttl: 60000, limit: 3 } })
	@Public()
	@Post("/resend-verification")
	@HttpCode(200)
	@ApiOperation({ summary: "Resend email verification link" })
	@ApiBody({ type: ResendVerificationDto })
	@ApiOkResponse({ type: WrappedResendVerificationResponse, description: "Verification email resent" })
	public async resendVerification(@Body(new ZodValidationPipe(apiContract.auth.resendVerification.input)) body: ResendVerificationInput): Promise<ResendVerificationResponse> {
		return this.authService.resendVerificationEmail(body);
	}

	// ── Password Reset ───────────────────────────────────────────────────

	@Throttle({ strict: { ttl: 60000, limit: 3 } })
	@Public()
	@Post("/forgot-password")
	@HttpCode(200)
	@ApiOperation({ summary: "Request a password reset email" })
	@ApiBody({ type: ForgotPasswordDto })
	@ApiOkResponse({ type: WrappedForgotPasswordResponse, description: "Password reset email sent (if account exists)" })
	public async forgotPassword(@Body(new ZodValidationPipe(apiContract.auth.forgotPassword.input)) body: ForgotPasswordInput): Promise<ForgotPasswordResponse> {
		return this.authService.forgotPassword(body);
	}

	@Throttle({ strict: { ttl: 60000, limit: 5 } })
	@Public()
	@Post("/reset-password")
	@HttpCode(200)
	@ApiOperation({ summary: "Reset password using a valid reset token" })
	@ApiBody({ type: ResetPasswordDto })
	@ApiOkResponse({ type: WrappedResetPasswordResponse, description: "Password reset successful" })
	@ApiResponse({ status: 401, type: ApiErrorResponseDto, description: "Invalid or expired reset token" })
	public async resetPassword(@Body(new ZodValidationPipe(apiContract.auth.resetPassword.input)) body: ResetPasswordInput): Promise<ResetPasswordResponse> {
		return this.authService.resetPassword(body);
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

	@Public()
	@Post("/verify-email/:token")
	@ApiOperation({ summary: "Verify email address using a verification token" })
	@ApiOkResponse({ type: WrappedVerifyEmailResponse, description: "Email verified" })
	public async verifyEmail(@Param("token", new ZodValidationPipe(VerifyEmailTokenParamSchema)) token: string): Promise<VerifyEmailResponse> {
		return this.authService.verifyEmail(token);
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
