import { Controller, Get, HttpStatus, Post, Req, UseInterceptors } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type {
	BackupCodesRemainingResponse,
	EnableTwoFactorInput,
	LoginRestrictedEnrollmentResponse,
	LoginServiceResponse,
	LoginTwoFactorInput,
	LoginVerificationPendingResponse,
	RotateTwoFactorInput,
	StartTwoFactorSetupInput,
	TwoFactorMessageResponse,
	TwoFactorSetupResponse,
	VerifyBackupCodeInput,
	VerifyBackupCodeLoginInput,
	VerifyBackupCodeResponse,
} from "@workspace/shared";
import {
	apiContract,
	apiPath,
	BackupCodesRemainingResponseSchema,
	LoginClientResponseSchema,
	TwoFactorMessageResponseSchema,
	TwoFactorSetupResponseSchema,
	VerifyBackupCodeResponseSchema,
} from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { self } from "../../../../platform/presentation/http/security/decorators/permission-target";
import { GetUser } from "../../../../platform/presentation/http/security/decorators/get-user.decorator";
import { PublicOperation } from "../../../../platform/presentation/http/security/decorators/public-operation.decorator";
import { Public } from "../../../../platform/presentation/http/security/decorators/public.decorator";
import { SetAuthCookiesInterceptor } from "../../../../platform/presentation/http/security/interceptors/set-auth-cookies.interceptor";
import { readSessionDeviceContext } from "../../../../platform/presentation/http/security/session-device-context";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { CompleteBackupCodeLoginCommand } from "../../application/commands/complete-backup-code-login/complete-backup-code-login.command";
import { CompleteTotpLoginCommand } from "../../application/commands/complete-totp-login/complete-totp-login.command";
import { EnableTwoFactorCommand } from "../../application/commands/enable-two-factor/enable-two-factor.command";
import { RotateTwoFactorCommand } from "../../application/commands/rotate-two-factor/rotate-two-factor.command";
import { StartTwoFactorSetupCommand } from "../../application/commands/start-two-factor-setup/start-two-factor-setup.command";
import { CheckBackupCodeQuery } from "../../application/queries/check-backup-code/check-backup-code.query";
import { CountRemainingBackupCodesQuery } from "../../application/queries/count-remaining-backup-codes/count-remaining-backup-codes.query";
import { TOKEN_DELIVERY_DESCRIPTION } from "./token-delivery.constants";
import { PRINCIPAL_LOOKUP_OPERATION } from "../../../../platform/application/shared-system-operations";

const PUBLIC_ACTOR = { allowAnonymous: true };

/** TOTP enrollment, rotation and backup codes for the signed-in user, and the second step of a 2FA login. Every route dispatches one command or query. */
@ApiTags("Auth")
@Controller(apiPath("/auth"))
export class TwoFactorController {
	public constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
	) {}

	/**
	 * Starts (or restarts) a 2FA enrollment. A POST, not a GET: it stores a new pending secret and
	 * backup-code hashes, replacing any earlier pending setup, so it carries the mutation-intent check
	 * and the authorization audit entry like every other state change.
	 */
	@RateLimit(RATE_LIMIT_POLICY.login)
	@ApiBearerAuth()
	@Post("/2fa/setup")
	@RequirePermission("UPDATE", "USER", { resourceId: self(), description: "User can start their own 2FA enrollment" })
	@ApiOperation({ summary: "Start 2FA enrollment: generate a pending TOTP secret, QR code and backup codes" })
	@ZodResponse(TwoFactorSetupResponseSchema, {
		status: HttpStatus.CREATED,
		description: "TOTP secret, QR code, otpauth:// key URI and backup codes (pending until confirmed via /2fa/enable)",
	})
	public async startSetup(
		@GetUser("sub") userId: string,
		@ZodBody(apiContract.auth.twoFactorSetup.input) _body: StartTwoFactorSetupInput,
		@CurrentActor() actor: ActorContext,
	): Promise<TwoFactorSetupResponse> {
		return this.commandBus.execute(new StartTwoFactorSetupCommand(actor, { userId }));
	}

	@RateLimit(RATE_LIMIT_POLICY.login)
	@ApiBearerAuth()
	@Post("/2fa/enable")
	@RequirePermission("UPDATE", "USER", { resourceId: self(), description: "User can enable their own 2FA" })
	@ApiOperation({ summary: "Confirm 2FA enrollment with a TOTP code" })
	@ZodResponse(TwoFactorMessageResponseSchema, { description: "2FA enabled" })
	public async enableTwoFactor(
		@GetUser("sub") userId: string,
		@ZodBody(apiContract.auth.twoFactorEnable.input) body: EnableTwoFactorInput,
		@CurrentActor() actor: ActorContext,
	): Promise<TwoFactorMessageResponse> {
		return this.commandBus.execute(new EnableTwoFactorCommand(actor, { userId, token: body.token }));
	}

	@RateLimit(RATE_LIMIT_POLICY.login)
	@ApiBearerAuth()
	@Post("/2fa/rotate")
	@RequirePermission("UPDATE", "USER", { resourceId: self(), description: "User can rotate their own 2FA" })
	@ApiOperation({ summary: "Rotate 2FA after confirming password and current TOTP or backup code" })
	@ZodResponse(TwoFactorSetupResponseSchema, { description: "New TOTP secret, QR code, otpauth:// key URI and backup codes" })
	public async rotateTwoFactor(
		@GetUser("sub") userId: string,
		@ZodBody(apiContract.auth.twoFactorRotate.input) body: RotateTwoFactorInput,
		@CurrentActor() actor: ActorContext,
	): Promise<TwoFactorSetupResponse> {
		return this.commandBus.execute(new RotateTwoFactorCommand(actor, { userId, password: body.password, token: body.token, backupCode: body.backupCode }));
	}

	@ApiBearerAuth()
	@Get("/2fa/backup-codes/remaining")
	@ApiOperation({ summary: "Count unused backup codes for the authenticated user" })
	@ZodResponse(BackupCodesRemainingResponseSchema, { description: "Unused backup code count" })
	public async getBackupCodesRemaining(@GetUser("sub") userId: string, @CurrentActor() actor: ActorContext): Promise<BackupCodesRemainingResponse> {
		return this.queryBus.execute(new CountRemainingBackupCodesQuery(actor, { userId }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@ApiBearerAuth()
	@Post("/2fa/verify-backup-code")
	@ApiOperation({ summary: "Verify a backup code while authenticated" })
	@ZodResponse(VerifyBackupCodeResponseSchema, { description: "Whether the backup code was valid" })
	public async verifyBackupCode(
		@GetUser("sub") userId: string,
		@ZodBody(apiContract.auth.twoFactorVerifyBackupCode.input) body: VerifyBackupCodeInput,
		@CurrentActor() actor: ActorContext,
	): Promise<VerifyBackupCodeResponse> {
		return this.queryBus.execute(new CheckBackupCodeQuery(actor, { userId, backupCode: body.backupCode }));
	}

	@RateLimit(RATE_LIMIT_POLICY.sessionIssue)
	@Public()
	@PublicOperation(PRINCIPAL_LOOKUP_OPERATION)
	@Post("/login/2fa")
	@ApiOperation({ summary: "Complete login with a TOTP code" })
	@ZodResponse(LoginClientResponseSchema, { description: "Login result" + TOKEN_DELIVERY_DESCRIPTION })
	@UseInterceptors(SetAuthCookiesInterceptor)
	public async loginWithTwoFactor(
		@ZodBody(apiContract.auth.loginTwoFactor.input) body: LoginTwoFactorInput,
		@Req() req: FastifyRequest,
		@CurrentActor(PUBLIC_ACTOR) actor: ActorContext,
	): Promise<LoginServiceResponse | LoginRestrictedEnrollmentResponse | LoginVerificationPendingResponse> {
		return this.commandBus.execute(new CompleteTotpLoginCommand(actor, { tempToken: body.tempToken, token: body.token, device: readSessionDeviceContext(req) }));
	}

	@RateLimit(RATE_LIMIT_POLICY.sessionIssue)
	@Public()
	@PublicOperation(PRINCIPAL_LOOKUP_OPERATION)
	@Post("/login/backup-code")
	@ApiOperation({ summary: "Complete login with a one-time backup code" })
	@ZodResponse(LoginClientResponseSchema, { description: "Login result" + TOKEN_DELIVERY_DESCRIPTION })
	@UseInterceptors(SetAuthCookiesInterceptor)
	public async loginWithBackupCode(
		@ZodBody(apiContract.auth.loginBackupCode.input) body: VerifyBackupCodeLoginInput,
		@Req() req: FastifyRequest,
		@CurrentActor(PUBLIC_ACTOR) actor: ActorContext,
	): Promise<LoginServiceResponse | LoginRestrictedEnrollmentResponse | LoginVerificationPendingResponse> {
		return this.commandBus.execute(
			new CompleteBackupCodeLoginCommand(actor, { tempToken: body.tempToken, backupCode: body.backupCode, device: readSessionDeviceContext(req) }),
		);
	}
}
