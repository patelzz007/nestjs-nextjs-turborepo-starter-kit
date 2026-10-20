import { Controller, Get, Headers, HttpStatus, Inject, Patch, Post, Req, UseInterceptors } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type {
	AccessTokenPayload,
	AdminUserDetail,
	AdminUserListQuery,
	AuthClientTypeQuery,
	ChangePasswordInput,
	ChangePasswordResponse,
	ConsumerWebSignupInput,
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
	SessionPermissionsResponse,
	SignupResponse,
	UserResponse,
	ValidateResetTokenInput,
	ValidateResetTokenResponse,
	VerifyEmailInput,
	VerifyEmailResponse,
	VerifyLoginInput,
} from "@workspace/shared";
import {
	AdminUserDetailSchema,
	apiContract,
	apiPath,
	AuthClientTypeQuerySchema,
	ChangePasswordResponseSchema,
	ForgotPasswordResponseSchema,
	LoginClientResponseSchema,
	MessageResponseSchema,
	ResendVerificationResponseSchema,
	ResetPasswordResponseSchema,
	SessionPermissionsResponseSchema,
	SignupResponseSchema,
	UserResponseSchema,
	UuidParamSchema,
	ValidateResetTokenResponseSchema,
	VerifyEmailResponseSchema,
} from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { AUTH_FLOW_RECORDER, type AuthFlowRecorder } from "../../../../platform/application/ports/access-token.port";
import { ApiErrorResponseDto } from "../../../../platform/presentation/http/dto/api-response.dto";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { Authorize, self } from "../../../../platform/presentation/http/security/decorators/authorize.decorator";
import { EmailVerified } from "../../../../platform/presentation/http/security/decorators/email-verified.decorator";
import { GetUser } from "../../../../platform/presentation/http/security/decorators/get-user.decorator";
import { PlatformOperation } from "../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { PublicOperation } from "../../../../platform/presentation/http/security/decorators/public-operation.decorator";
import { Public } from "../../../../platform/presentation/http/security/decorators/public.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { SkipAuthThrottle } from "../../../../platform/presentation/http/security/decorators/skip-auth-throttle.decorator";
import { SkipMutationIntent } from "../../../../platform/presentation/http/security/decorators/skip-mutation-intent.decorator";
import { SuperAdminOnly } from "../../../../platform/presentation/http/security/decorators/super-admin.decorator";
import { TrackAuthFlow } from "../../../../platform/presentation/http/security/decorators/track-auth-flow.decorator";
import { SetAuthCookiesInterceptor } from "../../../../platform/presentation/http/security/interceptors/set-auth-cookies.interceptor";
import { readSessionDeviceContext } from "../../../../platform/presentation/http/security/session-device-context";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodListQuery, ZodParam, ZodQuery } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { ChangePasswordCommand } from "../../application/commands/change-password/change-password.command";
import { LogInCommand } from "../../application/commands/log-in/log-in.command";
import { RequestPasswordResetCommand } from "../../application/commands/request-password-reset/request-password-reset.command";
import { ResendVerificationEmailCommand } from "../../application/commands/resend-verification-email/resend-verification-email.command";
import { ResetPasswordCommand } from "../../application/commands/reset-password/reset-password.command";
import { SignUpCommand } from "../../application/commands/sign-up/sign-up.command";
import { UnlockAccountCommand } from "../../application/commands/unlock-account/unlock-account.command";
import { VerifyEmailCommand } from "../../application/commands/verify-email/verify-email.command";
import { VerifyNewDeviceLoginCommand } from "../../application/commands/verify-new-device-login/verify-new-device-login.command";
import { CheckPasswordResetTokenQuery } from "../../application/queries/check-password-reset-token/check-password-reset-token.query";
import { GetMeQuery } from "../../application/queries/get-me/get-me.query";
import { GetSessionPermissionsQuery } from "../../application/queries/get-session-permissions/get-session-permissions.query";
import { GetUserForAdminQuery } from "../../application/queries/get-user-for-admin/get-user-for-admin.query";
import { ListUsersForAdminQuery } from "../../application/queries/list-users-for-admin/list-users-for-admin.query";
import { clientTypeFromHeaderOrQuery } from "./auth-flow-client-type";
import { TOKEN_DELIVERY_DESCRIPTION } from "./token-delivery.constants";
import {
	EMAIL_VERIFICATION_CONFIRM_OPERATION,
	EMAIL_VERIFICATION_SEND_OPERATION,
	SIGNUP_REGISTER_OPERATION,
	PASSWORD_RESET_COMPLETE_OPERATION,
	PASSWORD_RESET_LOOKUP_OPERATION,
	PASSWORD_RESET_REQUEST_OPERATION,
	ADMIN_USERS_READ_OPERATION,
	ADMIN_USERS_UNLOCK_OPERATION,
} from "../../application/ports/identity.tokens";
import { PRINCIPAL_LOOKUP_OPERATION } from "../../../../platform/application/shared-system-operations";

const PUBLIC_ACTOR = { allowAnonymous: true };

/**
 * Credential / identity / admin endpoints: signup, login, email verification, password reset, `/me`,
 * and SuperAdmin user management. Every route dispatches one command or query; `@TrackAuthFlow`
 * records the outcome of each credential flow (`authEvents` is its recorder).
 */
@ApiTags("Auth")
@Controller(apiPath("/auth"))
export class AuthController {
	public constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
		/** Read by `@TrackAuthFlow`. */
		@Inject(AUTH_FLOW_RECORDER) private readonly authEvents: AuthFlowRecorder,
	) {}

	@RateLimit(RATE_LIMIT_POLICY.credential)
	@Public()
	@PublicOperation(SIGNUP_REGISTER_OPERATION)
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
	@TrackAuthFlow({ flow: "signup" })
	public async signup(
		@ZodBody(apiContract.auth.signup.input) body: ConsumerWebSignupInput,
		@Headers("x-client-type") headerClientType: string | undefined,
		@ZodQuery(AuthClientTypeQuerySchema) query: AuthClientTypeQuery,
		@CurrentActor(PUBLIC_ACTOR) actor: ActorContext,
	): Promise<SignupResponse> {
		return this.commandBus.execute(new SignUpCommand(actor, { body, clientType: headerClientType ?? query.client_type }));
	}

	@RateLimit(RATE_LIMIT_POLICY.login)
	@Public()
	@PublicOperation(PRINCIPAL_LOOKUP_OPERATION)
	@SkipMutationIntent()
	@Post("/login")
	@ApiOperation({ summary: "Authenticate with email and password" })
	@ApiHeader({
		name: "x-client-type",
		required: false,
		description:
			"Set to 'admin' when logging in from the admin panel (only users with isSuperAdmin === true or the ADMIN_DASHBOARD permission may use this), 'merchant' from the merchant portal, or 'mobile' from the mobile app (tokens in the body, no cookies; requires X-App-Version).",
	})
	@ZodResponse(LoginClientResponseSchema, { status: HttpStatus.CREATED, description: "Login result" + TOKEN_DELIVERY_DESCRIPTION })
	@ApiResponse({ status: 401, type: ApiErrorResponseDto, description: "Invalid credentials / Account locked" })
	@ApiResponse({ status: 403, type: ApiErrorResponseDto, description: "Admin access required (when X-Client-Type: admin and user is not superadmin)" })
	@UseInterceptors(SetAuthCookiesInterceptor)
	@TrackAuthFlow({ flow: "login", clientType: clientTypeFromHeaderOrQuery })
	public async login(
		@ZodBody(apiContract.auth.login.input) body: LoginInput,
		@Headers("x-client-type") headerClientType: string | undefined,
		@ZodQuery(AuthClientTypeQuerySchema) query: AuthClientTypeQuery,
		@Req() req: FastifyRequest,
		@CurrentActor(PUBLIC_ACTOR) actor: ActorContext,
	): Promise<LoginServiceResponse | LoginRestrictedEnrollmentResponse | LoginTwoFactorPendingResponse | LoginVerificationPendingResponse> {
		// Accept client type from header (browser apps) or query param (Swagger UI)
		return this.commandBus.execute(new LogInCommand(actor, { body, clientType: headerClientType ?? query.client_type, device: readSessionDeviceContext(req) }));
	}

	// ── Email Verification ───────────────────────────────────────────────

	@RateLimit(RATE_LIMIT_POLICY.credential)
	@Public()
	@PublicOperation(EMAIL_VERIFICATION_SEND_OPERATION)
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
		@CurrentActor(PUBLIC_ACTOR) actor: ActorContext,
	): Promise<ResendVerificationResponse> {
		return this.commandBus.execute(new ResendVerificationEmailCommand(actor, { email: body.email, clientType: headerClientType ?? query.client_type }));
	}

	// ── Password Reset ───────────────────────────────────────────────────

	@RateLimit(RATE_LIMIT_POLICY.credential)
	@Public()
	@PublicOperation(PASSWORD_RESET_REQUEST_OPERATION)
	@SkipMutationIntent()
	@Post("/forgot-password")
	@ApiOperation({ summary: "Request a password reset email" })
	@ApiHeader({
		name: "x-client-type",
		required: false,
		description: "Set to 'admin' or 'merchant' so the reset link targets the correct frontend. Defaults to the web app.",
	})
	@ZodResponse(ForgotPasswordResponseSchema, { description: "Password reset email sent (if account exists)" })
	@TrackAuthFlow({ flow: "forgot-password", clientType: clientTypeFromHeaderOrQuery })
	public async forgotPassword(
		@ZodBody(apiContract.auth.forgotPassword.input) body: ForgotPasswordInput,
		@Headers("x-client-type") headerClientType: string | undefined,
		@ZodQuery(AuthClientTypeQuerySchema) query: AuthClientTypeQuery,
		@CurrentActor(PUBLIC_ACTOR) actor: ActorContext,
	): Promise<ForgotPasswordResponse> {
		return this.commandBus.execute(new RequestPasswordResetCommand(actor, { email: body.email, clientType: headerClientType ?? query.client_type }));
	}

	@RateLimit(RATE_LIMIT_POLICY.login)
	@Public()
	@PublicOperation(PASSWORD_RESET_COMPLETE_OPERATION)
	@SkipMutationIntent()
	@Post("/reset-password")
	@ApiOperation({ summary: "Reset password using a valid reset token" })
	@ZodResponse(ResetPasswordResponseSchema, { description: "Password reset successful" })
	@ApiResponse({ status: 401, type: ApiErrorResponseDto, description: "Invalid or expired reset token" })
	@TrackAuthFlow({ flow: "reset-password" })
	public async resetPassword(
		@ZodBody(apiContract.auth.resetPassword.input) body: ResetPasswordInput,
		@CurrentActor(PUBLIC_ACTOR) actor: ActorContext,
	): Promise<ResetPasswordResponse> {
		return this.commandBus.execute(new ResetPasswordCommand(actor, { token: body.token, password: body.password }));
	}

	@RateLimit(RATE_LIMIT_POLICY.sessionIssue)
	@Public()
	@PublicOperation(PASSWORD_RESET_LOOKUP_OPERATION)
	@SkipMutationIntent()
	@Post("/validate-reset-token")
	@ApiOperation({ summary: "Validate a password reset token without consuming it" })
	@ZodResponse(ValidateResetTokenResponseSchema, { description: "Whether the reset token is valid" })
	public async validateResetToken(
		@ZodBody(apiContract.auth.validateResetToken.input) body: ValidateResetTokenInput,
		@CurrentActor(PUBLIC_ACTOR) actor: ActorContext,
	): Promise<ValidateResetTokenResponse> {
		return this.queryBus.execute(new CheckPasswordResetTokenQuery(actor, { token: body.token }));
	}

	@RateLimit(RATE_LIMIT_POLICY.sessionIssue)
	@Public()
	@PublicOperation(PRINCIPAL_LOOKUP_OPERATION)
	@SkipMutationIntent()
	@Post("/verify-login")
	@ApiOperation({ summary: "Complete login with an email verification code" })
	@ZodResponse(LoginClientResponseSchema, { description: "Login result after verification" + TOKEN_DELIVERY_DESCRIPTION })
	@UseInterceptors(SetAuthCookiesInterceptor)
	public async verifyLogin(
		@ZodBody(apiContract.auth.verifyLogin.input) body: VerifyLoginInput,
		@Req() req: FastifyRequest,
		@CurrentActor(PUBLIC_ACTOR) actor: ActorContext,
	): Promise<LoginServiceResponse | LoginRestrictedEnrollmentResponse> {
		return this.commandBus.execute(new VerifyNewDeviceLoginCommand(actor, { verificationId: body.verificationId, code: body.code, device: readSessionDeviceContext(req) }));
	}

	@RateLimit(RATE_LIMIT_POLICY.credential)
	@ApiBearerAuth()
	@Post("/change-password")
	@Authorize({ action: "UPDATE", resource: "USER", resourceId: self(), description: "User can only change their own password" })
	@ApiOperation({ summary: "Change password for the authenticated user" })
	@ZodResponse(ChangePasswordResponseSchema, { description: "Password changed successfully" })
	@TrackAuthFlow({ flow: "change-password" })
	public async changePassword(
		@GetUser("sub") userId: string,
		@ZodBody(apiContract.auth.changePassword.input) body: ChangePasswordInput,
		@CurrentActor() actor: ActorContext,
	): Promise<ChangePasswordResponse> {
		return this.commandBus.execute(new ChangePasswordCommand(actor, { userId, currentPassword: body.currentPassword, newPassword: body.newPassword }));
	}

	@SkipAuthThrottle()
	@ApiBearerAuth()
	@Get("/me")
	@ApiOperation({ summary: "Get the currently authenticated user's profile" })
	@ZodResponse(UserResponseSchema, { description: "Current user profile" })
	@ApiResponse({ status: 401, type: ApiErrorResponseDto, description: "Access token missing / invalid" })
	public async getMe(@GetUser("sub") userId: string, @CurrentActor() actor: ActorContext): Promise<UserResponse> {
		return this.queryBus.execute(new GetMeQuery(actor, { userId }));
	}

	@SkipAuthThrottle()
	@ApiBearerAuth()
	@Get("/permissions")
	@ApiOperation({ summary: "Get the current session's roles and permissions" })
	@ZodResponse(SessionPermissionsResponseSchema, { description: "Session RBAC payload" })
	@ApiResponse({ status: 401, type: ApiErrorResponseDto, description: "Access token missing / invalid" })
	public async getSessionPermissions(
		@GetUser("sub") userId: string,
		@GetUser() accessPayload: AccessTokenPayload | undefined,
		@CurrentActor() actor: ActorContext,
	): Promise<SessionPermissionsResponse> {
		return this.queryBus.execute(new GetSessionPermissionsQuery(actor, { userId, accessPayload }));
	}

	@Public()
	@PublicOperation(EMAIL_VERIFICATION_CONFIRM_OPERATION)
	@SkipMutationIntent()
	@RateLimit(RATE_LIMIT_POLICY.credential)
	@Post("/verify-email")
	@ApiOperation({ summary: "Verify email address using a verification token" })
	@ZodResponse(VerifyEmailResponseSchema, { status: HttpStatus.CREATED, description: "Email verified" })
	@TrackAuthFlow({ flow: "verify-email" })
	public async verifyEmail(
		@ZodBody(apiContract.auth.verifyEmail.input) body: VerifyEmailInput,
		@CurrentActor(PUBLIC_ACTOR) actor: ActorContext,
	): Promise<VerifyEmailResponse> {
		return this.commandBus.execute(new VerifyEmailCommand(actor, { token: body.token }));
	}

	// ═══════════════════════════════════════════════════════════════════════
	// Admin User Management  (SuperAdmin only)
	// ═══════════════════════════════════════════════════════════════════════

	@SkipAuthThrottle()
	@ApiBearerAuth()
	@SuperAdminOnly()
	@RequirePermission("LIST", "USER")
	@PlatformOperation(ADMIN_USERS_READ_OPERATION)
	@Get("/admin/users")
	@ApiOperation({ summary: "SuperAdmin: list all users with roles and lockout status" })
	@ZodPaginatedResponse(AdminUserDetailSchema, { description: "Paginated admin user list" })
	@ApiResponse({ status: 403, type: ApiErrorResponseDto, description: "SuperAdmin privileges required" })
	public async getAdminUsersList(
		@ZodListQuery(apiContract.auth.adminUsers.input) query: AdminUserListQuery,
		@CurrentActor() actor: ActorContext,
	): Promise<PaginatedServiceResult<AdminUserDetail>> {
		return this.queryBus.execute(new ListUsersForAdminQuery(actor, { query }));
	}

	@SkipAuthThrottle()
	@ApiBearerAuth()
	@SuperAdminOnly()
	@RequirePermission("READ", "USER")
	@PlatformOperation(ADMIN_USERS_READ_OPERATION)
	@Get("/admin/users/:userId")
	@ApiOperation({ summary: "SuperAdmin: get detailed user info including security state" })
	@ZodResponse(AdminUserDetailSchema, { description: "Full user detail with lockout status" })
	@ApiResponse({ status: 404, type: ApiErrorResponseDto, description: "User not found" })
	public async getAdminUserDetail(@ZodParam("userId", UuidParamSchema) userId: string, @CurrentActor() actor: ActorContext): Promise<AdminUserDetail> {
		return this.queryBus.execute(new GetUserForAdminQuery(actor, { userId }));
	}

	@SkipAuthThrottle()
	@ApiBearerAuth()
	@SuperAdminOnly()
	@EmailVerified()
	@RequirePermission("UPDATE", "USER")
	@PlatformOperation(ADMIN_USERS_UNLOCK_OPERATION)
	@Authorize({ action: "UPDATE", resource: "USER", resourceId: "userId", description: "SuperAdmin can unlock any user account" })
	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Patch("/admin/users/:userId/unlock")
	@ApiOperation({ summary: "SuperAdmin: unlock a locked user account" })
	@ZodResponse(MessageResponseSchema, { description: "Account unlocked" })
	@ApiResponse({ status: 404, type: ApiErrorResponseDto, description: "User not found" })
	public async unlockUser(@ZodParam("userId", UuidParamSchema) userId: string, @CurrentActor() actor: ActorContext): Promise<MessageResponse> {
		return this.commandBus.execute(new UnlockAccountCommand(actor, { userId }));
	}
}
