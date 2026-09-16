import { Body, Controller, Post } from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	apiContract,
	apiPath,
	type MerchantOnboardingCompleteFieldsInput,
	type MerchantOnboardingDocumentsSubmitInput,
	type MerchantOnboardingDocumentBatchUploadCompleteInput,
	type MerchantOnboardingDocumentBatchUploadUrlInput,
	type MerchantOnboardingDocumentUploadCompleteInput,
	type MerchantOnboardingDocumentUploadUrlInput,
	type MerchantOnboardingValidateTokenInput,
} from "@workspace/shared";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { Public } from "../../auth/decorators/public.decorator";
import { RlsBypass } from "../../auth/decorators/rls-bypass.decorator";
import { KernelIntegrationHelper } from "../../authorization/kernel/kernel-integration.helper";

import { MerchantOnboardingValidateTokenDto } from "../dtos/rewards.dto";
import { MerchantOnboardingService } from "../services/merchant-onboarding.service";

@ApiTags("Organization Onboarding")
@Controller(apiPath("/orgs/onboarding"))
export class MerchantOnboardingController {
	public constructor(
		private readonly merchantOnboarding: MerchantOnboardingService,
		private readonly kernelHelper: KernelIntegrationHelper,
	) {}

	@Public()
	@RlsBypass()
	@Post("validate")
	@ApiOperation({ summary: "Validate a merchant onboarding invite token" })
	@ApiBody({ type: MerchantOnboardingValidateTokenDto })
	@ApiOkResponse({ description: "Invite preview when the token is valid" })
	public validateInvite(
		@Body(new ZodValidationPipe(apiContract.organizations.onboarding.validate.input)) body: MerchantOnboardingValidateTokenInput,
	): ReturnType<MerchantOnboardingService["validateInviteToken"]> {
		return this.merchantOnboarding.validateInviteToken(body.token);
	}

	@Public()
	@RlsBypass()
	@Post("complete")
	@ApiOperation({ summary: "Complete merchant onboarding — links OWNER membership and platform User role" })
	@ApiOkResponse({ description: "Organization linked to the account" })
	public completeOnboarding(
		@Body(new ZodValidationPipe(apiContract.organizations.onboarding.complete.input)) body: MerchantOnboardingCompleteFieldsInput,
	): ReturnType<MerchantOnboardingService["completeOnboarding"]> {
		return this.merchantOnboarding.completeOnboarding(body);
	}

	@Public()
	@RlsBypass()
	@Post("documents/upload-url")
	@ApiOperation({ summary: "Create an invite-authorized KYB document upload ticket" })
	@ApiOkResponse({ description: "Signed upload ticket for onboarding KYB documents" })
	public createDocumentUploadUrl(
		@Body(new ZodValidationPipe(apiContract.organizations.onboarding.documentUploadUrl.input)) body: MerchantOnboardingDocumentUploadUrlInput,
	): ReturnType<MerchantOnboardingService["createDocumentUploadUrl"]> {
		return this.merchantOnboarding.createDocumentUploadUrl(body);
	}

	@Public()
	@RlsBypass()
	@Post("documents/upload-urls")
	@ApiOperation({ summary: "Create invite-authorized KYB document upload tickets in one request" })
	@ApiOkResponse({ description: "Signed upload tickets for onboarding KYB documents" })
	public createDocumentUploadUrls(
		@Body(new ZodValidationPipe(apiContract.organizations.onboarding.documentBatchUploadUrl.input)) body: MerchantOnboardingDocumentBatchUploadUrlInput,
	): ReturnType<MerchantOnboardingService["createDocumentUploadUrls"]> {
		return this.merchantOnboarding.createDocumentUploadUrls(body);
	}

	@Public()
	@RlsBypass()
	@Post("documents/upload-complete")
	@ApiOperation({ summary: "Complete an invite-authorized KYB document upload" })
	@ApiOkResponse({ description: "Onboarding KYB document upload finalized" })
	public completeDocumentUpload(
		@Body(new ZodValidationPipe(apiContract.organizations.onboarding.documentUploadComplete.input)) body: MerchantOnboardingDocumentUploadCompleteInput,
	): ReturnType<MerchantOnboardingService["completeDocumentUpload"]> {
		return this.merchantOnboarding.completeDocumentUpload(body);
	}

	@Public()
	@RlsBypass()
	@Post("documents/upload-complete-batch")
	@ApiOperation({ summary: "Complete invite-authorized KYB document uploads in one request" })
	@ApiOkResponse({ description: "Onboarding KYB document uploads finalized" })
	public completeDocumentUploads(
		@Body(new ZodValidationPipe(apiContract.organizations.onboarding.documentBatchUploadComplete.input)) body: MerchantOnboardingDocumentBatchUploadCompleteInput,
	): ReturnType<MerchantOnboardingService["completeDocumentUploads"]> {
		return this.merchantOnboarding.completeDocumentUploads(body);
	}

	@Public()
	@RlsBypass()
	@Post("documents/submit")
	@ApiOperation({ summary: "Attach onboarding KYB documents and submit the merchant for admin review" })
	@ApiOkResponse({ description: "Onboarding KYB documents submitted for review" })
	public submitDocuments(
		@Body(new ZodValidationPipe(apiContract.organizations.onboarding.documentsSubmit.input)) body: MerchantOnboardingDocumentsSubmitInput,
	): ReturnType<MerchantOnboardingService["submitDocuments"]> {
		return this.merchantOnboarding.submitDocuments(body);
	}
}
