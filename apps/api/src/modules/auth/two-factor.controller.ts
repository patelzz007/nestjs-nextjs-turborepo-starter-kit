import { Controller, Get, HttpStatus, Post, Req, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type {
	BackupCodesRemainingResponse,
	EnableTwoFactorInput,
	LoginTwoFactorInput,
	LoginRestrictedEnrollmentResponse,
	LoginServiceResponse,
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

import { ZodBody } from "../../common/decorators/zod-request.decorators";
import { ZodResponse } from "../../common/decorators/zod-response.decorators";
import { GetUser } from "./decorators/get-user.decorator";
import { Public } from "./decorators/public.decorator";
import { RlsBypass } from "./decorators/rls-bypass.decorator";
import { SetAuthCookiesInterceptor } from "./interceptors/set-auth-cookies.interceptor";
import { Authorize, self } from "../authorization/decorators/authorize.decorator";
import type { FastifyRequest } from "fastify";

import { readSessionDeviceContext } from "../sessions/device/session-device";
import { TwoFactorService } from "./services/two-factor.service";
import { TOKEN_DELIVERY_DESCRIPTION } from "./constants/token-delivery.constants";

@ApiTags("Auth")
@Controller(apiPath("/auth"))
export class TwoFactorController {
	public constructor(private readonly twoFactorService: TwoFactorService) {}

	/**
	 * Starts (or restarts) a 2FA enrollment. A POST, not a GET: it stores a new
	 * pending secret and backup-code hashes, replacing any earlier pending setup —
	 * so it carries the mutation-intent check and the authorization audit entry
	 * like every other state change.
	 */
	@Throttle({ strict: { ttl: 60000, limit: 5 } })
	@ApiBearerAuth()
	@Post("/2fa/setup")
	@Authorize({ action: "UPDATE", resource: "USER", resourceId: self(), description: "User can start their own 2FA enrollment" })
	@ApiOperation({ summary: "Start 2FA enrollment: generate a pending TOTP secret, QR code and backup codes" })
	@ZodResponse(TwoFactorSetupResponseSchema, {
		status: HttpStatus.CREATED,
		description: "TOTP secret, QR code, otpauth:// key URI and backup codes (pending until confirmed via /2fa/enable)",
	})
	public async startSetup(@GetUser("sub") userId: string, @ZodBody(apiContract.auth.twoFactorSetup.input) _body: StartTwoFactorSetupInput): Promise<TwoFactorSetupResponse> {
		return this.twoFactorService.generateSetup(userId);
	}

	@Throttle({ strict: { ttl: 60000, limit: 5 } })
	@ApiBearerAuth()
	@Post("/2fa/enable")
	@Authorize({ action: "UPDATE", resource: "USER", resourceId: self(), description: "User can enable their own 2FA" })
	@ApiOperation({ summary: "Confirm 2FA enrollment with a TOTP code" })
	@ZodResponse(TwoFactorMessageResponseSchema, { description: "2FA enabled" })
	public async enableTwoFactor(
		@GetUser("sub") userId: string,
		@ZodBody(apiContract.auth.twoFactorEnable.input) body: EnableTwoFactorInput,
	): Promise<TwoFactorMessageResponse> {
		return this.twoFactorService.enableTwoFactor(userId, body);
	}

	@Throttle({ strict: { ttl: 60000, limit: 5 } })
	@ApiBearerAuth()
	@Post("/2fa/rotate")
	@Authorize({ action: "UPDATE", resource: "USER", resourceId: self(), description: "User can rotate their own 2FA" })
	@ApiOperation({ summary: "Rotate 2FA after confirming password and current TOTP or backup code" })
	@ZodResponse(TwoFactorSetupResponseSchema, { description: "New TOTP secret, QR code, otpauth:// key URI and backup codes" })
	public async rotateTwoFactor(@GetUser("sub") userId: string, @ZodBody(apiContract.auth.twoFactorRotate.input) body: RotateTwoFactorInput): Promise<TwoFactorSetupResponse> {
		return this.twoFactorService.rotateTwoFactor(userId, body);
	}

	@ApiBearerAuth()
	@Get("/2fa/backup-codes/remaining")
	@ApiOperation({ summary: "Count unused backup codes for the authenticated user" })
	@ZodResponse(BackupCodesRemainingResponseSchema, { description: "Unused backup code count" })
	public async getBackupCodesRemaining(@GetUser("sub") userId: string): Promise<BackupCodesRemainingResponse> {
		return this.twoFactorService.getBackupCodesRemaining(userId);
	}

	@ApiBearerAuth()
	@Post("/2fa/verify-backup-code")
	@ApiOperation({ summary: "Verify a backup code while authenticated" })
	@ZodResponse(VerifyBackupCodeResponseSchema, { description: "Whether the backup code was valid" })
	public async verifyBackupCode(
		@GetUser("sub") userId: string,
		@ZodBody(apiContract.auth.twoFactorVerifyBackupCode.input) body: VerifyBackupCodeInput,
	): Promise<VerifyBackupCodeResponse> {
		return this.twoFactorService.verifyBackupCode(userId, body);
	}

	@Throttle({ strict: { ttl: 60000, limit: 10 } })
	@Public()
	@RlsBypass()
	@Post("/login/2fa")
	@ApiOperation({ summary: "Complete login with a TOTP code" })
	@ZodResponse(LoginClientResponseSchema, { description: "Login result" + TOKEN_DELIVERY_DESCRIPTION })
	@UseInterceptors(SetAuthCookiesInterceptor)
	public async loginWithTwoFactor(
		@ZodBody(apiContract.auth.loginTwoFactor.input) body: LoginTwoFactorInput,
		@Req() req: FastifyRequest,
	): Promise<LoginServiceResponse | LoginRestrictedEnrollmentResponse | LoginVerificationPendingResponse> {
		return this.twoFactorService.completeLoginWithTotp(body, readSessionDeviceContext(req));
	}

	@Throttle({ strict: { ttl: 60000, limit: 10 } })
	@Public()
	@RlsBypass()
	@Post("/login/backup-code")
	@ApiOperation({ summary: "Complete login with a one-time backup code" })
	@ZodResponse(LoginClientResponseSchema, { description: "Login result" + TOKEN_DELIVERY_DESCRIPTION })
	@UseInterceptors(SetAuthCookiesInterceptor)
	public async loginWithBackupCode(
		@ZodBody(apiContract.auth.loginBackupCode.input) body: VerifyBackupCodeLoginInput,
		@Req() req: FastifyRequest,
	): Promise<LoginServiceResponse | LoginRestrictedEnrollmentResponse | LoginVerificationPendingResponse> {
		return this.twoFactorService.completeLoginWithBackupCode(body, readSessionDeviceContext(req));
	}
}
