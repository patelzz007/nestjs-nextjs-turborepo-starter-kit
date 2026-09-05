import { Body, Controller, Headers, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { apiContract, apiPath, type MerchantCreateMemberInput, type MerchantOnboardingCompleteInput, type MerchantOnboardingValidateTokenInput } from "@workspace/shared";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { readFirstHeader } from "../../../common/utils/http-headers";
import { GetUser } from "../../auth/decorators/get-user.decorator";
import { Public } from "../../auth/decorators/public.decorator";
import { RlsBypass } from "../../auth/decorators/rls-bypass.decorator";
import type { AccessTokenPayload } from "../../auth/services/token.service";

import { MerchantCreateMemberDto, MerchantOnboardingCompleteDto, MerchantOnboardingValidateTokenDto } from "../dtos/rewards.dto";
import { MerchantMemberService } from "../services/merchant-member.service";
import { MerchantOnboardingService } from "../services/merchant-onboarding.service";

const MERCHANT_ORG_HEADER = {
	name: "X-Merchant-Org-Id",
	required: false,
	description: "Merchant org uuid — defaults to your first membership",
} as const;

@ApiTags("Merchant Onboarding")
@RlsBypass()
@Controller(apiPath("/merchant/onboarding"))
export class MerchantOnboardingController {
	public constructor(private readonly merchantOnboarding: MerchantOnboardingService) {}

	@Public()
	@Post("validate")
	@ApiOperation({ summary: "Validate a merchant onboarding invite token" })
	@ApiBody({ type: MerchantOnboardingValidateTokenDto })
	@ApiOkResponse({ description: "Invite preview when the token is valid" })
	public validateInvite(
		@Body(new ZodValidationPipe(apiContract.merchant.onboarding.validate.input)) body: MerchantOnboardingValidateTokenInput,
	): ReturnType<MerchantOnboardingService["validateInviteToken"]> {
		return this.merchantOnboarding.validateInviteToken(body.token);
	}

	@Public()
	@Post("complete")
	@ApiOperation({ summary: "Complete merchant onboarding — creates org, OWNER membership, and platform User role" })
	@ApiBody({ type: MerchantOnboardingCompleteDto })
	@ApiOkResponse({ description: "Merchant org created and linked to the account" })
	public completeOnboarding(
		@Body(new ZodValidationPipe(apiContract.merchant.onboarding.complete.input)) body: MerchantOnboardingCompleteInput,
	): ReturnType<MerchantOnboardingService["completeOnboarding"]> {
		return this.merchantOnboarding.completeOnboarding(body);
	}
}

@ApiTags("Merchant Team")
@ApiBearerAuth()
@RlsBypass()
@Controller(apiPath("/merchant/members"))
export class MerchantMembersController {
	public constructor(private readonly merchantMembers: MerchantMemberService) {}

	@Post()
	@ApiHeader(MERCHANT_ORG_HEADER)
	@ApiOperation({ summary: "Create a cashier account for the merchant org (owner only)" })
	@ApiBody({ type: MerchantCreateMemberDto })
	@ApiOkResponse({ description: "Staff account created with CASHIER membership and platform User role" })
	public createMember(
		@GetUser() user: AccessTokenPayload,
		@Headers() headers: Record<string, string | string[] | undefined>,
		@Body(new ZodValidationPipe(apiContract.merchant.members.create.input)) body: MerchantCreateMemberInput,
	): ReturnType<MerchantMemberService["createMember"]> {
		const orgId = readFirstHeader(headers["x-merchant-org-id"]);
		return this.merchantMembers.createMember(user.sub, orgId, body);
	}
}
