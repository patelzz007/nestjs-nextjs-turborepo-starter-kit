import { Controller, Get, Post, UseInterceptors } from "@nestjs/common";
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
import { TwoFactorService } from "./services/two-factor.service";

@ApiTags("Auth")
@Controller(apiPath("/auth"))
export class TwoFactorController {
	public constructor(private readonly twoFactorService: TwoFactorService) {}

	@Throttle({ strict: { ttl: 60000, limit: 5 } })
	@ApiBearerAuth()
	@Get("/2fa/setup")
	@ApiOperation({ summary: "Generate a TOTP secret and QR code for 2FA enrollment" })
	@ZodResponse(TwoFactorSetupResponseSchema, { description: "TOTP secret, QR code and backup codes" })
	public async getSetup(@GetUser("sub") userId: string): Promise<TwoFactorSetupResponse> {
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
	@ZodResponse(TwoFactorSetupResponseSchema, { description: "New TOTP secret, QR code and backup codes" })
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
	@ZodResponse(LoginClientResponseSchema, { description: "Login result — tokens are set as httpOnly cookies and never appear in the body" })
	@UseInterceptors(SetAuthCookiesInterceptor)
	public async loginWithTwoFactor(
		@ZodBody(apiContract.auth.loginTwoFactor.input) body: LoginTwoFactorInput,
	): Promise<LoginServiceResponse | LoginRestrictedEnrollmentResponse | LoginVerificationPendingResponse> {
		return this.twoFactorService.completeLoginWithTotp(body);
	}

	@Throttle({ strict: { ttl: 60000, limit: 10 } })
	@Public()
	@RlsBypass()
	@Post("/login/backup-code")
	@ApiOperation({ summary: "Complete login with a one-time backup code" })
	@ZodResponse(LoginClientResponseSchema, { description: "Login result — tokens are set as httpOnly cookies and never appear in the body" })
	@UseInterceptors(SetAuthCookiesInterceptor)
	public async loginWithBackupCode(
		@ZodBody(apiContract.auth.loginBackupCode.input) body: VerifyBackupCodeLoginInput,
	): Promise<LoginServiceResponse | LoginRestrictedEnrollmentResponse | LoginVerificationPendingResponse> {
		return this.twoFactorService.completeLoginWithBackupCode(body);
	}
}
