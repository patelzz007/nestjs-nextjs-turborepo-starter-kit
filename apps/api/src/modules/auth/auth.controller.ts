import { Body, Controller, Get, HttpCode, Param, Patch, Post, Req, UseGuards, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { SkipThrottle, Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { extractClientInfo } from "../../common/utils/client-info";
import { GetUser } from "../../common/decorators/get-user.decorator";
import { RefreshTokenGuard } from "../../common/guards/refresh-token.guard";
import type { RefreshTokenPayload } from "./services/token.service";
import { SuperAdminOnly } from "../../common/decorators/super-admin.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { SetAuthCookiesInterceptor } from "../../common/interceptors/set-auth-cookies.interceptor";
import { ClearAuthCookiesInterceptor } from "../../common/interceptors/clear-auth-cookies.interceptor";
import { ApiErrorResponseDto } from "../../common/dto/api-response.dto";
import { createWrappedDto, createWrappedArrayDto } from "../../common/dto/response-wrapper";
import { AuthService } from "./auth.service";
import { ForgotPasswordDto } from "./dtos/forgot-password.dto";
import { LoginDto } from "./dtos/login.dto";
import { ResendVerificationDto } from "./dtos/resend-verification.dto";
import { ResetPasswordDto } from "./dtos/reset-password.dto";
import { SignupDto } from "./dtos/signup.dto";
import type {
	AdminUserDetail,
	ForgotPasswordResponse,
	ImpersonateResponse,
	LoginServiceResponse,
	LogoutAllResponse,
	LogoutResponse,
	MessageResponse,
	RefreshResponse,
	RefreshResponseMessage,
	ResendVerificationResponse,
	ResetPasswordResponse,
	Session,
	SignupResponse,
	StopImpersonationResponse,
	UserResponse,
	VerifyEmailResponse,
} from "@workspace/shared";
import {
	AdminUserDetailSchema,
	ForgotPasswordResponseSchema,
	ImpersonateResponseSchema,
	LoginServiceResponseSchema,
	LogoutAllResponseSchema,
	LogoutResponseSchema,
	MessageResponseSchema,
	RefreshResponseMessageSchema,
	ResendVerificationResponseSchema,
	ResetPasswordResponseSchema,
	SessionSchema,
	SignupResponseSchema,
	StopImpersonationResponseSchema,
	UserResponseSchema,
	VerifyEmailResponseSchema,
} from "@workspace/shared";

// ── Wrapped Response DTOs (envelope + data) ─────────────────────────────
// Each constant wraps a data schema in the { success, data, meta } envelope
// so Swagger sample responses show the full structure.

const WrappedSignupResponse = createWrappedDto(SignupResponseSchema, "WrappedSignupResponse");
const WrappedLoginResponse = createWrappedDto(LoginServiceResponseSchema, "WrappedLoginResponse");
const WrappedRefreshResponse = createWrappedDto(RefreshResponseMessageSchema, "WrappedRefreshResponse");
const WrappedLogoutResponse = createWrappedDto(LogoutResponseSchema, "WrappedLogoutResponse");
const WrappedLogoutAllResponse = createWrappedDto(LogoutAllResponseSchema, "WrappedLogoutAllResponse");
const WrappedSessionList = createWrappedArrayDto(SessionSchema, "WrappedSessionList");
const WrappedResendVerificationResponse = createWrappedDto(ResendVerificationResponseSchema, "WrappedResendVerificationResponse");
const WrappedForgotPasswordResponse = createWrappedDto(ForgotPasswordResponseSchema, "WrappedForgotPasswordResponse");
const WrappedResetPasswordResponse = createWrappedDto(ResetPasswordResponseSchema, "WrappedResetPasswordResponse");
const WrappedUserResponse = createWrappedDto(UserResponseSchema, "WrappedUserResponse");
const WrappedVerifyEmailResponse = createWrappedDto(VerifyEmailResponseSchema, "WrappedVerifyEmailResponse");
const WrappedAdminUserList = createWrappedArrayDto(AdminUserDetailSchema, "WrappedAdminUserList");
const WrappedAdminUserDetail = createWrappedDto(AdminUserDetailSchema, "WrappedAdminUserDetail");
const WrappedMessageResponse = createWrappedDto(MessageResponseSchema, "WrappedMessageResponse");
const WrappedImpersonateResponse = createWrappedDto(ImpersonateResponseSchema, "WrappedImpersonateResponse");
const WrappedStopImpersonationResponse = createWrappedDto(StopImpersonationResponseSchema, "WrappedStopImpersonationResponse");

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
	constructor(
		private readonly authService: AuthService,
	) {}

	@Throttle({ strict: { ttl: 60000, limit: 3 } })
	@Public()
	@Post("/signup")
	@ApiOperation({ summary: "Register a new user account" })
	@ApiBody({ type: SignupDto })
	@ApiCreatedResponse({ type: WrappedSignupResponse, description: "User registered" })
	@ApiResponse({ status: 409, type: ApiErrorResponseDto, description: "Email already in use" })
	public async signup(@Body() signupDto: SignupDto): Promise<SignupResponse> {
		return this.authService.signup(signupDto);
	}

	@Throttle({ strict: { ttl: 60000, limit: 5 } })
	@Public()
	@Post("/login")
	@ApiOperation({ summary: "Authenticate with email and password" })
	@ApiBody({ type: LoginDto })
	@ApiOkResponse({ type: WrappedLoginResponse, description: "Login successful" })
	@ApiResponse({ status: 401, type: ApiErrorResponseDto, description: "Invalid credentials / Account locked" })
	@UseInterceptors(SetAuthCookiesInterceptor)
	public async login(@Body() loginDto: LoginDto, @Req() req: Request): Promise<LoginServiceResponse> {
		const { deviceInfo, ipAddress } = extractClientInfo(req);
		return this.authService.login(loginDto, deviceInfo, ipAddress);
	}

	@Throttle({ default: { ttl: 60000, limit: 10 } })
	@Public()
	@UseGuards(RefreshTokenGuard)
	@Post("/refresh")
	@ApiOperation({ summary: "Refresh access token using refresh token cookie" })
	@ApiOkResponse({ type: WrappedRefreshResponse, description: "Tokens refreshed" })
	@ApiResponse({ status: 401, type: ApiErrorResponseDto, description: "Invalid or expired refresh token" })
	@UseInterceptors(SetAuthCookiesInterceptor)
	public async refreshToken(@GetUser() user: RefreshTokenPayload, @Req() req: Request): Promise<RefreshResponseMessage> {
		const { deviceInfo, ipAddress } = extractClientInfo(req);

		// Extract the raw refresh token JWT from cookies for reuse detection
		// The service will bcrypt-compare it against the stored hash before rotating
		// RefreshTokenGuard already verified the cookie exists, so it's always a string
		const rawRefreshToken: string = req.cookies["refreshToken"];

		// The refresh token's jti (JWT ID) is used for direct DB lookup
		const tokens: RefreshResponse = await this.authService.refreshToken(user.sub, rawRefreshToken, user.jti, deviceInfo, ipAddress);

		return {
			...tokens,
			message: "Tokens refreshed successfully",
		};
	}

	@Public()
	@UseGuards(RefreshTokenGuard)
	@Post("/logout")
	@ApiOperation({ summary: "Logout from the current device" })
	@ApiOkResponse({ type: WrappedLogoutResponse, description: "Logged out from current device" })
	@UseInterceptors(ClearAuthCookiesInterceptor)
	public async logout(@GetUser() user: RefreshTokenPayload): Promise<LogoutResponse> {
		await this.authService.logoutDevice(user.sub, user.jti);

		return { message: "Logged out successfully" };
	}

	@Public()
	@Post("/logout-all")
	@UseGuards(RefreshTokenGuard)
	@ApiOperation({ summary: "Logout from all devices" })
	@ApiOkResponse({ type: WrappedLogoutAllResponse, description: "Logged out from all devices" })
	@UseInterceptors(ClearAuthCookiesInterceptor)
	public async logoutAll(@GetUser() user: RefreshTokenPayload): Promise<LogoutAllResponse> {
		await this.authService.logoutAllDevices(user.sub);

		return { message: "Logged out from all devices" };
	}

	// ── Active Sessions ──────────────────────────────────────────────────

	@SkipThrottle()
	@ApiBearerAuth()
	@Get("/sessions")
	@ApiOperation({ summary: "Get all active sessions for the current user" })
	@ApiOkResponse({ type: WrappedSessionList, description: "List of active sessions" })
	public async getSessions(@GetUser("sub") userId: string): Promise<Session[]> {
		return this.authService.getSessions(userId);
	}

	// ── Email Verification ───────────────────────────────────────────────

	@Throttle({ strict: { ttl: 60000, limit: 3 } })
	@Public()
	@Post("/resend-verification")
	@HttpCode(200)
	@ApiOperation({ summary: "Resend email verification link" })
	@ApiBody({ type: ResendVerificationDto })
	@ApiOkResponse({ type: WrappedResendVerificationResponse, description: "Verification email resent" })
	public async resendVerification(@Body() dto: ResendVerificationDto): Promise<ResendVerificationResponse> {
		return this.authService.resendVerificationEmail(dto);
	}

	// ── Password Reset ───────────────────────────────────────────────────

	@Throttle({ strict: { ttl: 60000, limit: 3 } })
	@Public()
	@Post("/forgot-password")
	@HttpCode(200)
	@ApiOperation({ summary: "Request a password reset email" })
	@ApiBody({ type: ForgotPasswordDto })
	@ApiOkResponse({ type: WrappedForgotPasswordResponse, description: "Password reset email sent (if account exists)" })
	public async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<ForgotPasswordResponse> {
		return this.authService.forgotPassword(dto);
	}

	@Throttle({ strict: { ttl: 60000, limit: 5 } })
	@Public()
	@Post("/reset-password")
	@HttpCode(200)
	@ApiOperation({ summary: "Reset password using a valid reset token" })
	@ApiBody({ type: ResetPasswordDto })
	@ApiOkResponse({ type: WrappedResetPasswordResponse, description: "Password reset successful" })
	@ApiResponse({ status: 401, type: ApiErrorResponseDto, description: "Invalid or expired reset token" })
	public async resetPassword(@Body() dto: ResetPasswordDto): Promise<ResetPasswordResponse> {
		return this.authService.resetPassword(dto);
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
	public async verifyEmail(@Param("token") token: string): Promise<VerifyEmailResponse> {
		return this.authService.verifyEmail(token);
	}

	// ═══════════════════════════════════════════════════════════════════════
	// Admin User Detail  (SuperAdmin only)
	// ═══════════════════════════════════════════════════════════════════════

	// ═══════════════════════════════════════════════════════════════════════
	// Admin User List  (SuperAdmin only)
	// ═══════════════════════════════════════════════════════════════════════

	@SkipThrottle()
	@ApiBearerAuth()
	@SuperAdminOnly()
	@Get("/admin/users")
	@ApiOperation({ summary: "SuperAdmin: list all users with roles and lockout status" })
	@ApiOkResponse({ type: WrappedAdminUserList, description: "Admin user list" })
	@ApiResponse({ status: 403, type: ApiErrorResponseDto, description: "SuperAdmin privileges required" })
	public async getAdminUsersList(): Promise<AdminUserDetail[]> {
		return this.authService.getAdminUsersList();
	}

	// ═══════════════════════════════════════════════════════════════════════
	// Admin User Detail  (SuperAdmin only)
	// ═══════════════════════════════════════════════════════════════════════

	@SkipThrottle()
	@ApiBearerAuth()
	@SuperAdminOnly()
	@Get("/admin/users/:userId")
	@ApiOperation({ summary: "SuperAdmin: get detailed user info including security state" })
	@ApiOkResponse({ type: WrappedAdminUserDetail, description: "Full user detail with lockout status" })
	@ApiResponse({ status: 404, type: ApiErrorResponseDto, description: "User not found" })
	public async getAdminUserDetail(@Param("userId") userId: string): Promise<AdminUserDetail> {
		return this.authService.getAdminUserDetail(userId);
	}

	// ═══════════════════════════════════════════════════════════════════════
	// Admin Unlock User  (SuperAdmin only)
	// ═══════════════════════════════════════════════════════════════════════

	@SkipThrottle()
	@ApiBearerAuth()
	@SuperAdminOnly()
	@Patch("/admin/users/:userId/unlock")
	@ApiOperation({ summary: "SuperAdmin: unlock a locked user account" })
	@ApiOkResponse({ type: WrappedMessageResponse, description: "Account unlocked" })
	@ApiResponse({ status: 404, type: ApiErrorResponseDto, description: "User not found" })
	public async unlockUser(@Param("userId") userId: string): Promise<MessageResponse> {
		return this.authService.unlockUser(userId);
	}

	// ═══════════════════════════════════════════════════════════════════════
	// Impersonation  (SuperAdmin only)
	// ═══════════════════════════════════════════════════════════════════════

	/**
	 * POST /auth/impersonate/:userId
	 * SuperAdmin starts impersonating another user.
	 * Returns a short-lived access token that the frontend can use to act as
	 * the target user. The original SuperAdmin session is NOT invalidated.
	 */
	@Throttle({ strict: { ttl: 60000, limit: 10 } })
	@ApiBearerAuth()
	@SuperAdminOnly()
	@Post("/impersonate/:userId")
	@ApiOperation({ summary: "SuperAdmin: impersonate another user" })
	@ApiOkResponse({ type: WrappedImpersonateResponse, description: "Impersonation started" })
	@ApiResponse({ status: 403, type: ApiErrorResponseDto, description: "SuperAdmin privileges required" })
	public async impersonate(@GetUser("sub") superAdminId: string, @Param("userId") targetUserId: string, @Req() req: Request): Promise<ImpersonateResponse> {
		const { ipAddress } = extractClientInfo(req);
		const userAgent: string | null = req.headers["user-agent"] ?? null;
		return this.authService.impersonateUser(superAdminId, targetUserId, ipAddress, userAgent);
	}

	/**
	 * POST /auth/stop-impersonation
	 * Stop impersonating — returns a confirmation message.
	 * The frontend should discard the impersonation token and restore
	 * the original SuperAdmin session.
	 */
	@Throttle({ strict: { ttl: 60000, limit: 10 } })
	@ApiBearerAuth()
	@Post("/stop-impersonation")
	@ApiOperation({ summary: "SuperAdmin: stop impersonating" })
	@ApiOkResponse({ type: WrappedStopImpersonationResponse, description: "Impersonation ended" })
	public async stopImpersonation(@GetUser("originalUserId") impersonatorId: string | undefined, @GetUser("sub") targetUserId: string, @Req() req: Request): Promise<StopImpersonationResponse> {
		const { ipAddress } = extractClientInfo(req);
		const userAgent: string | null = req.headers["user-agent"] ?? null;
		// If originalUserId is not set (not an impersonation token), fall back to sub
		const superAdminId: string = impersonatorId ?? targetUserId;
		return this.authService.stopImpersonation(superAdminId, targetUserId, ipAddress, userAgent);
	}
}
