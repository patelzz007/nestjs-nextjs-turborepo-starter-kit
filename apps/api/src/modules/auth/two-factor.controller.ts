import { Body, Controller, Get, HttpCode, Post, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
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
	LoginServiceResponseSchema,
	TwoFactorMessageResponseSchema,
	TwoFactorSetupResponseSchema,
	VerifyBackupCodeResponseSchema,
} from "@workspace/shared";

import { createWrappedDto } from "../../common/dto/response-wrapper";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { GetUser } from "./decorators/get-user.decorator";
import { Public } from "./decorators/public.decorator";
import { RlsBypass } from "./decorators/rls-bypass.decorator";
import { SetAuthCookiesInterceptor } from "./interceptors/set-auth-cookies.interceptor";
import { TwoFactorService } from "./services/two-factor.service";

const WrappedTwoFactorSetupResponse = createWrappedDto(TwoFactorSetupResponseSchema, "WrappedTwoFactorSetupResponse");
const WrappedTwoFactorMessageResponse = createWrappedDto(TwoFactorMessageResponseSchema, "WrappedTwoFactorMessageResponse");
const WrappedVerifyBackupCodeResponse = createWrappedDto(VerifyBackupCodeResponseSchema, "WrappedVerifyBackupCodeResponse");
const WrappedBackupCodesRemainingResponse = createWrappedDto(BackupCodesRemainingResponseSchema, "WrappedBackupCodesRemainingResponse");
const WrappedLoginTwoFactorResponse = createWrappedDto(LoginServiceResponseSchema, "WrappedLoginTwoFactorResponse");

@ApiTags("Auth")
@Controller(apiPath("/auth"))
export class TwoFactorController {
	public constructor(private readonly twoFactorService: TwoFactorService) {}

	@Throttle({ strict: { ttl: 60000, limit: 5 } })
	@ApiBearerAuth()
	@Get("/2fa/setup")
	@ApiOperation({ summary: "Generate a TOTP secret and QR code for 2FA enrollment" })
	@ApiOkResponse({ type: WrappedTwoFactorSetupResponse })
	public async getSetup(@GetUser("sub") userId: string): Promise<TwoFactorSetupResponse> {
		return this.twoFactorService.generateSetup(userId);
	}

	@Throttle({ strict: { ttl: 60000, limit: 5 } })
	@ApiBearerAuth()
	@Post("/2fa/enable")
	@HttpCode(200)
	@ApiOperation({ summary: "Confirm 2FA enrollment with a TOTP code" })
	@ApiOkResponse({ type: WrappedTwoFactorMessageResponse })
	public async enableTwoFactor(
		@GetUser("sub") userId: string,
		@Body(new ZodValidationPipe(apiContract.auth.twoFactorEnable.input)) body: EnableTwoFactorInput,
	): Promise<TwoFactorMessageResponse> {
		return this.twoFactorService.enableTwoFactor(userId, body);
	}

	@Throttle({ strict: { ttl: 60000, limit: 5 } })
	@ApiBearerAuth()
	@Post("/2fa/rotate")
	@HttpCode(200)
	@ApiOperation({ summary: "Rotate 2FA after confirming password and current TOTP or backup code" })
	@ApiOkResponse({ type: WrappedTwoFactorSetupResponse })
	public async rotateTwoFactor(
		@GetUser("sub") userId: string,
		@Body(new ZodValidationPipe(apiContract.auth.twoFactorRotate.input)) body: RotateTwoFactorInput,
	): Promise<TwoFactorSetupResponse> {
		return this.twoFactorService.rotateTwoFactor(userId, body);
	}

	@ApiBearerAuth()
	@Get("/2fa/backup-codes/remaining")
	@ApiOperation({ summary: "Count unused backup codes for the authenticated user" })
	@ApiOkResponse({ type: WrappedBackupCodesRemainingResponse })
	public async getBackupCodesRemaining(@GetUser("sub") userId: string): Promise<BackupCodesRemainingResponse> {
		return this.twoFactorService.getBackupCodesRemaining(userId);
	}

	@ApiBearerAuth()
	@Post("/2fa/verify-backup-code")
	@HttpCode(200)
	@ApiOperation({ summary: "Verify a backup code while authenticated" })
	@ApiOkResponse({ type: WrappedVerifyBackupCodeResponse })
	public async verifyBackupCode(
		@GetUser("sub") userId: string,
		@Body(new ZodValidationPipe(apiContract.auth.twoFactorVerifyBackupCode.input)) body: VerifyBackupCodeInput,
	): Promise<VerifyBackupCodeResponse> {
		return this.twoFactorService.verifyBackupCode(userId, body);
	}

	@Throttle({ strict: { ttl: 60000, limit: 10 } })
	@Public()
	@RlsBypass()
	@Post("/login/2fa")
	@HttpCode(200)
	@ApiOperation({ summary: "Complete login with a TOTP code" })
	@ApiOkResponse({ type: WrappedLoginTwoFactorResponse })
	@UseInterceptors(SetAuthCookiesInterceptor)
	public async loginWithTwoFactor(
		@Body(new ZodValidationPipe(apiContract.auth.loginTwoFactor.input)) body: LoginTwoFactorInput,
	): Promise<LoginServiceResponse | LoginRestrictedEnrollmentResponse | LoginVerificationPendingResponse> {
		return this.twoFactorService.completeLoginWithTotp(body);
	}

	@Throttle({ strict: { ttl: 60000, limit: 10 } })
	@Public()
	@RlsBypass()
	@Post("/login/backup-code")
	@HttpCode(200)
	@ApiOperation({ summary: "Complete login with a one-time backup code" })
	@ApiOkResponse({ type: WrappedLoginTwoFactorResponse })
	@UseInterceptors(SetAuthCookiesInterceptor)
	public async loginWithBackupCode(
		@Body(new ZodValidationPipe(apiContract.auth.loginBackupCode.input)) body: VerifyBackupCodeLoginInput,
	): Promise<LoginServiceResponse | LoginRestrictedEnrollmentResponse | LoginVerificationPendingResponse> {
		return this.twoFactorService.completeLoginWithBackupCode(body);
	}
}
