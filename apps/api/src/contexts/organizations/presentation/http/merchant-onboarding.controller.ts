import { Controller, HttpStatus, Post } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	apiContract,
	apiPath,
	CompleteFileUploadResponseSchema,
	CreateFileUploadUrlResponseSchema,
	MerchantOnboardingCompleteResponseSchema,
	MerchantOnboardingDocumentBatchUploadCompleteResponseSchema,
	MerchantOnboardingDocumentBatchUploadUrlResponseSchema,
	MerchantOnboardingDocumentStatusResponseSchema,
	MerchantOnboardingInvitePreviewSchema,
	SuccessAckResponseSchema,
	type CompleteFileUploadResponse,
	type CreateFileUploadUrlResponse,
	type MerchantOnboardingCompleteFieldsInput,
	type MerchantOnboardingCompleteResponse,
	type MerchantOnboardingDocumentBatchUploadCompleteInput,
	type MerchantOnboardingDocumentBatchUploadCompleteResponse,
	type MerchantOnboardingDocumentBatchUploadUrlInput,
	type MerchantOnboardingDocumentBatchUploadUrlResponse,
	type MerchantOnboardingDocumentStatusInput,
	type MerchantOnboardingDocumentStatusResponse,
	type MerchantOnboardingDocumentUploadCompleteInput,
	type MerchantOnboardingDocumentUploadUrlInput,
	type MerchantOnboardingDocumentsSubmitInput,
	type MerchantOnboardingInvitePreview,
	type MerchantOnboardingValidateTokenInput,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { Public } from "../../../../platform/presentation/http/security/decorators/public.decorator";
import { RlsBypass } from "../../../../platform/presentation/http/security/decorators/rls-bypass.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { CompleteMerchantOnboardingCommand } from "../../application/commands/complete-merchant-onboarding/complete-merchant-onboarding.command";
import { CompleteOnboardingDocumentUploadCommand } from "../../application/commands/complete-onboarding-document-upload/complete-onboarding-document-upload.command";
import { CompleteOnboardingDocumentUploadsCommand } from "../../application/commands/complete-onboarding-document-uploads/complete-onboarding-document-uploads.command";
import { RequestOnboardingDocumentUploadCommand } from "../../application/commands/request-onboarding-document-upload/request-onboarding-document-upload.command";
import { RequestOnboardingDocumentUploadsCommand } from "../../application/commands/request-onboarding-document-uploads/request-onboarding-document-uploads.command";
import {
	SubmitOnboardingDocumentsCommand,
	type OnboardingDocumentsSubmitted,
} from "../../application/commands/submit-onboarding-documents/submit-onboarding-documents.command";
import { GetOnboardingDocumentStatusQuery } from "../../application/queries/get-onboarding-document-status/get-onboarding-document-status.query";
import { PreviewOnboardingInviteQuery } from "../../application/queries/preview-onboarding-invite/preview-onboarding-invite.query";

@ApiTags("Organization Onboarding")
@Controller(apiPath("/orgs/onboarding"))
export class MerchantOnboardingController {
	public constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
	) {}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Public()
	@RlsBypass()
	@Post("validate")
	@ApiOperation({ summary: "Validate a merchant onboarding invite token" })
	@ZodResponse(MerchantOnboardingInvitePreviewSchema, { status: HttpStatus.CREATED, description: "Invite preview when the token is valid" })
	public validateInvite(
		@CurrentActor({ allowAnonymous: true }) actor: ActorContext,
		@ZodBody(apiContract.organizations.onboarding.validate.input) body: MerchantOnboardingValidateTokenInput,
	): Promise<MerchantOnboardingInvitePreview> {
		return this.queryBus.execute(new PreviewOnboardingInviteQuery(actor, body));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Public()
	@RlsBypass()
	@Post("complete")
	@ApiOperation({ summary: "Complete merchant onboarding — links OWNER membership and platform User role" })
	@ZodResponse(MerchantOnboardingCompleteResponseSchema, { status: HttpStatus.CREATED, description: "Organization linked to the account" })
	public completeOnboarding(
		@CurrentActor({ allowAnonymous: true }) actor: ActorContext,
		@ZodBody(apiContract.organizations.onboarding.complete.input) body: MerchantOnboardingCompleteFieldsInput,
	): Promise<MerchantOnboardingCompleteResponse> {
		return this.commandBus.execute(new CompleteMerchantOnboardingCommand(actor, body));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Public()
	@RlsBypass()
	@Post("documents/upload-url")
	@ApiOperation({ summary: "Create an invite-authorized KYB document upload ticket" })
	@ZodResponse(CreateFileUploadUrlResponseSchema, { status: HttpStatus.CREATED, description: "Signed upload ticket for onboarding KYB documents" })
	public createDocumentUploadUrl(
		@CurrentActor({ allowAnonymous: true }) actor: ActorContext,
		@ZodBody(apiContract.organizations.onboarding.documentUploadUrl.input) body: MerchantOnboardingDocumentUploadUrlInput,
	): Promise<CreateFileUploadUrlResponse> {
		return this.commandBus.execute(new RequestOnboardingDocumentUploadCommand(actor, body));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Public()
	@RlsBypass()
	@Post("documents/upload-urls")
	@ApiOperation({ summary: "Create invite-authorized KYB document upload tickets in one request" })
	@ZodResponse(MerchantOnboardingDocumentBatchUploadUrlResponseSchema, { status: HttpStatus.CREATED, description: "Signed upload tickets for onboarding KYB documents" })
	public createDocumentUploadUrls(
		@CurrentActor({ allowAnonymous: true }) actor: ActorContext,
		@ZodBody(apiContract.organizations.onboarding.documentBatchUploadUrl.input) body: MerchantOnboardingDocumentBatchUploadUrlInput,
	): Promise<MerchantOnboardingDocumentBatchUploadUrlResponse> {
		return this.commandBus.execute(new RequestOnboardingDocumentUploadsCommand(actor, body));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Public()
	@RlsBypass()
	@Post("documents/upload-complete")
	@ApiOperation({ summary: "Complete an invite-authorized KYB document upload" })
	@ZodResponse(CompleteFileUploadResponseSchema, { status: HttpStatus.CREATED, description: "Onboarding KYB document upload finalized" })
	public completeDocumentUpload(
		@CurrentActor({ allowAnonymous: true }) actor: ActorContext,
		@ZodBody(apiContract.organizations.onboarding.documentUploadComplete.input) body: MerchantOnboardingDocumentUploadCompleteInput,
	): Promise<CompleteFileUploadResponse> {
		return this.commandBus.execute(new CompleteOnboardingDocumentUploadCommand(actor, body));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Public()
	@RlsBypass()
	@Post("documents/upload-complete-batch")
	@ApiOperation({ summary: "Complete invite-authorized KYB document uploads in one request" })
	@ZodResponse(MerchantOnboardingDocumentBatchUploadCompleteResponseSchema, { status: HttpStatus.CREATED, description: "Onboarding KYB document uploads finalized" })
	public completeDocumentUploads(
		@CurrentActor({ allowAnonymous: true }) actor: ActorContext,
		@ZodBody(apiContract.organizations.onboarding.documentBatchUploadComplete.input) body: MerchantOnboardingDocumentBatchUploadCompleteInput,
	): Promise<MerchantOnboardingDocumentBatchUploadCompleteResponse> {
		return this.commandBus.execute(new CompleteOnboardingDocumentUploadsCommand(actor, body));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Public()
	@RlsBypass()
	@Post("documents/submit")
	@ApiOperation({ summary: "Attach onboarding KYB documents and submit the merchant for admin review" })
	@ZodResponse(SuccessAckResponseSchema, { status: HttpStatus.CREATED, description: "Onboarding KYB documents submitted for review" })
	public submitDocuments(
		@CurrentActor({ allowAnonymous: true }) actor: ActorContext,
		@ZodBody(apiContract.organizations.onboarding.documentsSubmit.input) body: MerchantOnboardingDocumentsSubmitInput,
	): Promise<OnboardingDocumentsSubmitted> {
		return this.commandBus.execute(new SubmitOnboardingDocumentsCommand(actor, body));
	}

	/**
	 * Polled by the signed-out merchant while scans finish. A tighter per-IP limit
	 * than the default: an invite token is a bearer credential, so guessing is throttled.
	 */
	@Public()
	@RlsBypass()
	@RateLimit(RATE_LIMIT_POLICY.onboardingStatus)
	@Post("documents/status")
	@ApiOperation({ summary: "Scan status of this onboarding's KYB uploads (same document window as the upload endpoints)" })
	@ZodResponse(MerchantOnboardingDocumentStatusResponseSchema, { status: HttpStatus.CREATED, description: "This onboarding's requested KYB uploads with their scan status" })
	public documentStatus(
		@CurrentActor({ allowAnonymous: true }) actor: ActorContext,
		@ZodBody(apiContract.organizations.onboarding.documentStatus.input) body: MerchantOnboardingDocumentStatusInput,
	): Promise<MerchantOnboardingDocumentStatusResponse> {
		return this.queryBus.execute(new GetOnboardingDocumentStatusQuery(actor, body));
	}
}
