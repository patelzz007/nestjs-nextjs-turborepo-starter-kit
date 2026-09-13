import { Body, Controller, Headers, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	apiContract,
	apiPath,
	type MerchantCreateMemberInput,
	type MerchantOnboardingCompleteFieldsInput,
	type MerchantOnboardingDocumentsSubmitInput,
	type MerchantOnboardingDocumentUploadCompleteInput,
	type MerchantOnboardingDocumentUploadUrlInput,
	type MerchantOnboardingValidateTokenInput,
} from "@workspace/shared";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { readFirstHeader } from "../../../common/utils/http-headers";
import { GetUser } from "../../auth/decorators/get-user.decorator";
import { Public } from "../../auth/decorators/public.decorator";
import { RlsBypass } from "../../auth/decorators/rls-bypass.decorator";
import type { AccessTokenPayload } from "../../auth/services/token.service";

import { MerchantCreateMemberDto, MerchantOnboardingValidateTokenDto } from "../dtos/rewards.dto";
import { MerchantMemberService } from "../services/merchant-member.service";
import { MerchantOnboardingService } from "../services/merchant-onboarding.service";

const MERCHANT_ORG_HEADER = {
	name: "X-Merchant-Org-Id",
	required: false,
	description: "Merchant org uuid — defaults to your first membership",
} as const;

@ApiTags("Merchant Onboarding")
@Controller(apiPath("/merchant/onboarding"))
export class MerchantOnboardingController {
	public constructor(private readonly merchantOnboarding: MerchantOnboardingService) {}

	@Public()
	@RlsBypass()
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
	@RlsBypass()
	@Post("complete")
	@ApiOperation({ summary: "Complete merchant onboarding — creates org, OWNER membership, and platform User role" })
	@ApiOkResponse({ description: "Merchant org created and linked to the account" })
	public completeOnboarding(
		@Body(new ZodValidationPipe(apiContract.merchant.onboarding.complete.input)) body: MerchantOnboardingCompleteFieldsInput,
	): ReturnType<MerchantOnboardingService["completeOnboarding"]> {
		return this.merchantOnboarding.completeOnboarding(body);
	}

	@Public()
	@RlsBypass()
	@Post("documents/upload-url")
	@ApiOperation({ summary: "Create an invite-authorized KYB document upload ticket" })
	@ApiOkResponse({ description: "Signed upload ticket for onboarding KYB documents" })
	public createDocumentUploadUrl(
		@Body(new ZodValidationPipe(apiContract.merchant.onboarding.documentUploadUrl.input)) body: MerchantOnboardingDocumentUploadUrlInput,
	): ReturnType<MerchantOnboardingService["createDocumentUploadUrl"]> {
		return this.merchantOnboarding.createDocumentUploadUrl(body);
	}

	@Public()
	@RlsBypass()
	@Post("documents/upload-complete")
	@ApiOperation({ summary: "Complete an invite-authorized KYB document upload" })
	@ApiOkResponse({ description: "Onboarding KYB document upload finalized" })
	public completeDocumentUpload(
		@Body(new ZodValidationPipe(apiContract.merchant.onboarding.documentUploadComplete.input)) body: MerchantOnboardingDocumentUploadCompleteInput,
	): ReturnType<MerchantOnboardingService["completeDocumentUpload"]> {
		return this.merchantOnboarding.completeDocumentUpload(body);
	}

	@Public()
	@RlsBypass()
	@Post("documents/submit")
	@ApiOperation({ summary: "Attach onboarding KYB documents and submit the merchant for admin review" })
	@ApiOkResponse({ description: "Onboarding KYB documents submitted for review" })
	public submitDocuments(
		@Body(new ZodValidationPipe(apiContract.merchant.onboarding.documentsSubmit.input)) body: MerchantOnboardingDocumentsSubmitInput,
	): ReturnType<MerchantOnboardingService["submitDocuments"]> {
		return this.merchantOnboarding.submitDocuments(body);
	}
}

@ApiTags("Merchant Team")
@ApiBearerAuth()
@Controller(apiPath("/merchant/members"))
export class MerchantMembersController {
	public constructor(private readonly merchantMembers: MerchantMemberService) {}

	@Post()
	@RlsBypass()
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
