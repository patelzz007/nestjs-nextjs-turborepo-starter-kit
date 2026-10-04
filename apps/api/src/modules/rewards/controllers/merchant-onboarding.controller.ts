import { Controller, HttpStatus, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
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
	MerchantOnboardingInvitePreviewSchema,
	MerchantOnboardingCompleteResponseSchema,
	CreateFileUploadUrlResponseSchema,
	MerchantOnboardingDocumentBatchUploadUrlResponseSchema,
	CompleteFileUploadResponseSchema,
	MerchantOnboardingDocumentBatchUploadCompleteResponseSchema,
	SuccessAckResponseSchema,
	MerchantOnboardingDocumentStatusResponseSchema,
	type MerchantOnboardingDocumentStatusInput,
} from "@workspace/shared";
import { Throttle } from "@nestjs/throttler";
import { ZodBody } from "../../../common/decorators/zod-request.decorators";
import { ZodResponse } from "../../../common/decorators/zod-response.decorators";
import { Public } from "../../auth/decorators/public.decorator";
import { RlsBypass } from "../../auth/decorators/rls-bypass.decorator";

import { MerchantOnboardingService } from "../services/merchant-onboarding.service";

/** Status polling: one request every 2 s for a minute is the expected client cadence. */
const ONBOARDING_STATUS_THROTTLE_TTL_MS = 60_000;
const ONBOARDING_STATUS_THROTTLE_LIMIT = 30;

@ApiTags("Organization Onboarding")
@Controller(apiPath("/orgs/onboarding"))
export class MerchantOnboardingController {
	public constructor(private readonly merchantOnboarding: MerchantOnboardingService) {}

	@Public()
	@RlsBypass()
	@Post("validate")
	@ApiOperation({ summary: "Validate a merchant onboarding invite token" })
	@ZodResponse(MerchantOnboardingInvitePreviewSchema, { status: HttpStatus.CREATED, description: "Invite preview when the token is valid" })
	public validateInvite(
		@ZodBody(apiContract.organizations.onboarding.validate.input) body: MerchantOnboardingValidateTokenInput,
	): ReturnType<MerchantOnboardingService["validateInviteToken"]> {
		return this.merchantOnboarding.validateInviteToken(body.token);
	}

	@Public()
	@RlsBypass()
	@Post("complete")
	@ApiOperation({ summary: "Complete merchant onboarding — links OWNER membership and platform User role" })
	@ZodResponse(MerchantOnboardingCompleteResponseSchema, { status: HttpStatus.CREATED, description: "Organization linked to the account" })
	public completeOnboarding(
		@ZodBody(apiContract.organizations.onboarding.complete.input) body: MerchantOnboardingCompleteFieldsInput,
	): ReturnType<MerchantOnboardingService["completeOnboarding"]> {
		return this.merchantOnboarding.completeOnboarding(body);
	}

	@Public()
	@RlsBypass()
	@Post("documents/upload-url")
	@ApiOperation({ summary: "Create an invite-authorized KYB document upload ticket" })
	@ZodResponse(CreateFileUploadUrlResponseSchema, { status: HttpStatus.CREATED, description: "Signed upload ticket for onboarding KYB documents" })
	public createDocumentUploadUrl(
		@ZodBody(apiContract.organizations.onboarding.documentUploadUrl.input) body: MerchantOnboardingDocumentUploadUrlInput,
	): ReturnType<MerchantOnboardingService["createDocumentUploadUrl"]> {
		return this.merchantOnboarding.createDocumentUploadUrl(body);
	}

	@Public()
	@RlsBypass()
	@Post("documents/upload-urls")
	@ApiOperation({ summary: "Create invite-authorized KYB document upload tickets in one request" })
	@ZodResponse(MerchantOnboardingDocumentBatchUploadUrlResponseSchema, { status: HttpStatus.CREATED, description: "Signed upload tickets for onboarding KYB documents" })
	public createDocumentUploadUrls(
		@ZodBody(apiContract.organizations.onboarding.documentBatchUploadUrl.input) body: MerchantOnboardingDocumentBatchUploadUrlInput,
	): ReturnType<MerchantOnboardingService["createDocumentUploadUrls"]> {
		return this.merchantOnboarding.createDocumentUploadUrls(body);
	}

	@Public()
	@RlsBypass()
	@Post("documents/upload-complete")
	@ApiOperation({ summary: "Complete an invite-authorized KYB document upload" })
	@ZodResponse(CompleteFileUploadResponseSchema, { status: HttpStatus.CREATED, description: "Onboarding KYB document upload finalized" })
	public completeDocumentUpload(
		@ZodBody(apiContract.organizations.onboarding.documentUploadComplete.input) body: MerchantOnboardingDocumentUploadCompleteInput,
	): ReturnType<MerchantOnboardingService["completeDocumentUpload"]> {
		return this.merchantOnboarding.completeDocumentUpload(body);
	}

	@Public()
	@RlsBypass()
	@Post("documents/upload-complete-batch")
	@ApiOperation({ summary: "Complete invite-authorized KYB document uploads in one request" })
	@ZodResponse(MerchantOnboardingDocumentBatchUploadCompleteResponseSchema, { status: HttpStatus.CREATED, description: "Onboarding KYB document uploads finalized" })
	public completeDocumentUploads(
		@ZodBody(apiContract.organizations.onboarding.documentBatchUploadComplete.input) body: MerchantOnboardingDocumentBatchUploadCompleteInput,
	): ReturnType<MerchantOnboardingService["completeDocumentUploads"]> {
		return this.merchantOnboarding.completeDocumentUploads(body);
	}

	@Public()
	@RlsBypass()
	@Post("documents/submit")
	@ApiOperation({ summary: "Attach onboarding KYB documents and submit the merchant for admin review" })
	@ZodResponse(SuccessAckResponseSchema, { status: HttpStatus.CREATED, description: "Onboarding KYB documents submitted for review" })
	public submitDocuments(
		@ZodBody(apiContract.organizations.onboarding.documentsSubmit.input) body: MerchantOnboardingDocumentsSubmitInput,
	): ReturnType<MerchantOnboardingService["submitDocuments"]> {
		return this.merchantOnboarding.submitDocuments(body);
	}

	/**
	 * Polled by the signed-out merchant while scans finish. A tighter per-IP limit
	 * than the default: an invite token is a bearer credential, so guessing is throttled.
	 */
	@Public()
	@RlsBypass()
	@Throttle({ strict: { ttl: ONBOARDING_STATUS_THROTTLE_TTL_MS, limit: ONBOARDING_STATUS_THROTTLE_LIMIT } })
	@Post("documents/status")
	@ApiOperation({ summary: "Scan status of this onboarding's KYB uploads (same document window as the upload endpoints)" })
	@ZodResponse(MerchantOnboardingDocumentStatusResponseSchema, { status: HttpStatus.CREATED, description: "This onboarding's requested KYB uploads with their scan status" })
	public documentStatus(
		@ZodBody(apiContract.organizations.onboarding.documentStatus.input) body: MerchantOnboardingDocumentStatusInput,
	): ReturnType<MerchantOnboardingService["documentStatus"]> {
		return this.merchantOnboarding.documentStatus(body);
	}
}
