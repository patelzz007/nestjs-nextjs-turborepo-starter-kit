import { z } from "zod";

import { OrganizationLocationDraftSchema, OrganizationPrimaryLocationDraftSchema } from "../organization/organization";
import { EpochMsSchema } from "../../api/common";
import { CanonicalEmailSchema } from "../../api/email-address";
import { CreateFileUploadUrlResponseSchema, DocumentMimeTypeSchema, MERCHANT_KYB_UPLOAD_POLICY } from "../platform/storage";
import { strongPassword } from "../../auth/password";
import { JsonObjectSchema } from "../../runtime/json";
import {
	KybDocumentScanStatusSchema,
	KybStatusSchema,
	type KybStatus,
	MerchantBusinessCategorySchema,
	MerchantMemberRoleSchema,
	MerchantOrgStatusSchema,
	PilotCitySchema,
} from "./rewards-enums";

/** Maximum single KYB document size in bytes (5 MiB). */
export const MERCHANT_KYB_MAX_DOCUMENT_BYTES = MERCHANT_KYB_UPLOAD_POLICY.maxBytesPerFile;

/** Maximum number of KYB documents per submission. */
export const MERCHANT_KYB_MAX_DOCUMENT_COUNT = MERCHANT_KYB_UPLOAD_POLICY.maxCount;

/** KYB document metadata returned by the API (object storage reference). */
export const MerchantKybDocumentRecordSchema = z.object({
	id: z.uuid(),
	fileName: z.string().min(1).max(255),
	mimeType: DocumentMimeTypeSchema,
	sizeBytes: z.number().int().positive().max(MERCHANT_KYB_MAX_DOCUMENT_BYTES),
	scanStatus: KybDocumentScanStatusSchema,
	uploadedAt: EpochMsSchema,
});

export type MerchantKybDocumentRecord = z.output<typeof MerchantKybDocumentRecordSchema>;

/** Signed download URL for a CLEAN KYB document. */
export const MerchantKybDocumentDownloadResponseSchema = z.object({
	documentId: z.uuid(),
	scanStatus: KybDocumentScanStatusSchema,
	downloadUrl: z.url().nullable(),
	expiresAt: EpochMsSchema.nullable(),
});

export type MerchantKybDocumentDownloadResponse = z.output<typeof MerchantKybDocumentDownloadResponseSchema>;

/** Business verification fields merchants submit for KYB review (files uploaded via presigned POST). */
export const MerchantKybSubmissionFieldsSchema = z
	.object({
		businessName: z.string().min(1).max(200),
		legalName: z.string().min(1).max(200),
		addressText: z.string().min(1).max(500),
		contactPhone: z.string().min(5).max(20),
		registrationNo: z.string().min(1).max(100),
		taxId: z.string().min(1).max(100),
		documentType: z.string().min(1).max(100),
		documentFileIds: z.array(z.uuid()).min(1).max(MERCHANT_KYB_MAX_DOCUMENT_COUNT),
	})
	.strict();

export type MerchantKybSubmissionFieldsInput = z.output<typeof MerchantKybSubmissionFieldsSchema>;

/** Client form fields before direct uploads produce `documentFileIds`. */
export const MerchantKybSubmissionFormSchema = MerchantKybSubmissionFieldsSchema.omit({ documentFileIds: true });

export type MerchantKybSubmissionFormInput = z.output<typeof MerchantKybSubmissionFormSchema>;

/** Business details step for KYB settings verification. */
export const MerchantKybBusinessFieldsSchema = MerchantKybSubmissionFieldsSchema.pick({
	businessName: true,
	legalName: true,
	addressText: true,
	contactPhone: true,
});

export type MerchantKybBusinessFieldsInput = z.output<typeof MerchantKybBusinessFieldsSchema>;

/** Registration step for KYB forms. */
export const MerchantKybRegistrationFieldsSchema = MerchantKybSubmissionFieldsSchema.pick({
	registrationNo: true,
	taxId: true,
	documentType: true,
});

export type MerchantKybRegistrationFieldsInput = z.output<typeof MerchantKybRegistrationFieldsSchema>;

/** KYB details collected during onboarding — business name comes from the invite; store address is captured on the Stores step. */
export const MerchantOnboardingKybFieldsSchema = MerchantKybSubmissionFormSchema.omit({
	businessName: true,
	addressText: true,
	contactPhone: true,
});

export type MerchantOnboardingKybFieldsInput = z.output<typeof MerchantOnboardingKybFieldsSchema>;

/** Business step fields for merchant onboarding (legal name only — address lives on the Stores step). */
export const MerchantOnboardingBusinessFieldsSchema = MerchantKybSubmissionFieldsSchema.pick({
	legalName: true,
});

export type MerchantOnboardingBusinessFieldsInput = z.output<typeof MerchantOnboardingBusinessFieldsSchema>;

/** The onboarding invite token every signed-out onboarding call carries. */
const MerchantOnboardingInviteTokenSchema = z.string().min(1);

export const MerchantOnboardingValidateTokenSchema = z
	.object({
		token: MerchantOnboardingInviteTokenSchema,
	})
	.strict();

export type MerchantOnboardingValidateTokenInput = z.output<typeof MerchantOnboardingValidateTokenSchema>;

export const MerchantOnboardingInvitePreviewSchema = z.object({
	email: z.email(),
	businessName: z.string(),
	city: PilotCitySchema,
	expiresAt: EpochMsSchema,
	hasExistingAccount: z.boolean(),
});

export type MerchantOnboardingInvitePreview = z.output<typeof MerchantOnboardingInvitePreviewSchema>;

export const MerchantOnboardingCompleteFieldsSchema = z
	.object({
		token: MerchantOnboardingInviteTokenSchema,
		password: strongPassword,
		fullName: z.string().min(2).max(200),
		category: MerchantBusinessCategorySchema,
		legalName: MerchantOnboardingKybFieldsSchema.shape.legalName,
		primaryLocation: OrganizationPrimaryLocationDraftSchema,
		registrationNo: MerchantOnboardingKybFieldsSchema.shape.registrationNo,
		taxId: MerchantOnboardingKybFieldsSchema.shape.taxId,
		documentType: MerchantOnboardingKybFieldsSchema.shape.documentType,
		additionalLocations: z.array(OrganizationLocationDraftSchema).max(10).default([]),
	})
	.strict();

export type MerchantOnboardingCompleteFieldsInput = z.output<typeof MerchantOnboardingCompleteFieldsSchema>;

/** One file in a batch onboarding KYB upload request. */
export const MerchantOnboardingDocumentUploadItemSchema = z
	.object({
		fileName: z.string().min(1).max(255),
		mimeType: DocumentMimeTypeSchema,
		sizeBytes: z.number().int().positive(),
		checksumSha256: z.string().length(64),
	})
	.strict();

export type MerchantOnboardingDocumentUploadItem = z.output<typeof MerchantOnboardingDocumentUploadItemSchema>;

export const MerchantOnboardingDocumentBatchUploadCompleteItemSchema = z
	.object({
		fileId: z.uuid(),
		checksumSha256: z.string().length(64),
	})
	.strict();

export type MerchantOnboardingDocumentBatchUploadCompleteItem = z.output<typeof MerchantOnboardingDocumentBatchUploadCompleteItemSchema>;

/** Invite-authorized upload ticket request used before the merchant can sign in. */
export const MerchantOnboardingDocumentUploadUrlSchema = z
	.object({
		token: MerchantOnboardingInviteTokenSchema,
		...MerchantOnboardingDocumentUploadItemSchema.shape,
	})
	.strict();

export type MerchantOnboardingDocumentUploadUrlInput = z.output<typeof MerchantOnboardingDocumentUploadUrlSchema>;

/** Confirms an invite-authorized direct upload. */
export const MerchantOnboardingDocumentUploadCompleteSchema = z
	.object({
		token: MerchantOnboardingInviteTokenSchema,
		...MerchantOnboardingDocumentBatchUploadCompleteItemSchema.shape,
	})
	.strict();

export type MerchantOnboardingDocumentUploadCompleteInput = z.output<typeof MerchantOnboardingDocumentUploadCompleteSchema>;

/** Batch invite-authorized upload ticket request for onboarding KYB documents. */
export const MerchantOnboardingDocumentBatchUploadUrlSchema = z
	.object({
		token: MerchantOnboardingInviteTokenSchema,
		files: z.array(MerchantOnboardingDocumentUploadItemSchema).min(1).max(MERCHANT_KYB_MAX_DOCUMENT_COUNT),
	})
	.strict();

export type MerchantOnboardingDocumentBatchUploadUrlInput = z.output<typeof MerchantOnboardingDocumentBatchUploadUrlSchema>;

export const MerchantOnboardingDocumentBatchUploadUrlResponseSchema = z.object({
	uploads: z.array(CreateFileUploadUrlResponseSchema).min(1),
});

export type MerchantOnboardingDocumentBatchUploadUrlResponse = z.output<typeof MerchantOnboardingDocumentBatchUploadUrlResponseSchema>;

/** Batch confirmation for invite-authorized onboarding KYB uploads. */
export const MerchantOnboardingDocumentBatchUploadCompleteSchema = z
	.object({
		token: MerchantOnboardingInviteTokenSchema,
		completions: z.array(MerchantOnboardingDocumentBatchUploadCompleteItemSchema).min(1).max(MERCHANT_KYB_MAX_DOCUMENT_COUNT),
	})
	.strict();

export type MerchantOnboardingDocumentBatchUploadCompleteInput = z.output<typeof MerchantOnboardingDocumentBatchUploadCompleteSchema>;

export const MerchantOnboardingDocumentBatchUploadCompleteResponseSchema = z.object({
	fileIds: z.array(z.uuid()).min(1),
});

export type MerchantOnboardingDocumentBatchUploadCompleteResponse = z.output<typeof MerchantOnboardingDocumentBatchUploadCompleteResponseSchema>;

/** Attaches completed onboarding documents to the newly provisioned merchant. */
export const MerchantOnboardingDocumentsSubmitSchema = z
	.object({
		token: MerchantOnboardingInviteTokenSchema,
		documentFileIds: z.array(z.uuid()).min(1).max(MERCHANT_KYB_MAX_DOCUMENT_COUNT),
	})
	.strict();

export type MerchantOnboardingDocumentsSubmitInput = z.output<typeof MerchantOnboardingDocumentsSubmitSchema>;

/**
 * Scan status of the onboarding's own KYB uploads, polled while the merchant is
 * still signed out. The token travels in the body (never a URL). Ids that are
 * not this onboarding's KYB uploads are simply absent from the answer.
 */
export const MerchantOnboardingDocumentStatusSchema = z
	.object({
		token: MerchantOnboardingInviteTokenSchema,
		fileIds: z.array(z.uuid()).min(1).max(MERCHANT_KYB_MAX_DOCUMENT_COUNT),
	})
	.strict();

export type MerchantOnboardingDocumentStatusInput = z.output<typeof MerchantOnboardingDocumentStatusSchema>;

export const MerchantOnboardingDocumentStatusResponseSchema = z.object({
	documents: z.array(MerchantKybDocumentRecordSchema),
});

export type MerchantOnboardingDocumentStatusResponse = z.output<typeof MerchantOnboardingDocumentStatusResponseSchema>;

export const MerchantKybProfileResponseSchema = z.object({
	organizationId: z.uuid(),
	businessName: z.string(),
	legalName: z.string().nullable(),
	addressText: z.string().nullable(),
	contactPhone: z.string().nullable(),
	contactEmail: z.string(),
	city: PilotCitySchema,
	kybStatus: KybStatusSchema,
	kybFields: JsonObjectSchema.nullable(),
	documents: z.array(MerchantKybDocumentRecordSchema),
	status: MerchantOrgStatusSchema,
});

export type MerchantKybProfileResponse = z.output<typeof MerchantKybProfileResponseSchema>;

export const MerchantOnboardingCompleteResponseSchema = z.object({
	organizationId: z.uuid(),
	organizationSlug: z
		.string()
		.min(2)
		.max(64)
		.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
	businessName: z.string(),
	role: MerchantMemberRoleSchema,
});

export type MerchantOnboardingCompleteResponse = z.output<typeof MerchantOnboardingCompleteResponseSchema>;

export const MerchantCreateMemberSchema = z
	.object({
		email: CanonicalEmailSchema,
		password: strongPassword,
		fullName: z.string().min(2).max(200),
		role: z.literal("CASHIER"),
	})
	.strict();

export type MerchantCreateMemberInput = z.output<typeof MerchantCreateMemberSchema>;

export const MerchantMemberCreatedResponseSchema = z.object({
	userId: z.uuid(),
	email: z.string(),
	fullName: z.string(),
	organizationId: z.uuid(),
	role: MerchantMemberRoleSchema,
});

export type MerchantMemberCreatedResponse = z.output<typeof MerchantMemberCreatedResponseSchema>;

/** Longest identifier-style KYB field (registration number, tax id, document type). */
const KYB_IDENTIFIER_MAX_LENGTH = 100;
/** Longest free-text KYB field (review notes, the reason given to the merchant). */
const KYB_TEXT_MAX_LENGTH = 2000;

/**
 * The KYB review payload stored on a merchant profile — a closed, typed shape
 * (never free JSON): what the merchant submitted (`registrationNo`, `taxId`,
 * `documentType`, `submittedAt`) and what the reviewer recorded.
 */
export const KybFieldsSchema = z
	.object({
		registrationNo: z.string().trim().min(1).max(KYB_IDENTIFIER_MAX_LENGTH).optional(),
		taxId: z.string().trim().min(1).max(KYB_IDENTIFIER_MAX_LENGTH).optional(),
		documentType: z.string().trim().min(1).max(KYB_IDENTIFIER_MAX_LENGTH).optional(),
		submittedAt: EpochMsSchema.optional(),
		reviewNotes: z.string().trim().min(1).max(KYB_TEXT_MAX_LENGTH).optional(),
		/** Shown to the merchant: why the review was rejected or what they must fix. */
		rejectionReason: z.string().trim().min(1).max(KYB_TEXT_MAX_LENGTH).optional(),
		reviewedAt: EpochMsSchema.optional(),
	})
	.strict();

export type KybFields = z.output<typeof KybFieldsSchema>;

/** Decisions the merchant must be told the reason for (`kybFields.rejectionReason`). */
export const KYB_STATUSES_REQUIRING_REASON: readonly KybStatus[] = [KybStatusSchema.enum.REJECTED, KybStatusSchema.enum.ACTION_REQUIRED];

/**
 * `PATCH /admin/merchants/:id/kyb`. Self-enforcing: a REJECTED or
 * ACTION_REQUIRED decision without a reason is invalid HERE — the API and the
 * admin form validate with this same schema, so the rule cannot live only in
 * the UI.
 */
export const AdminKybUpdateSchema = z
	.object({
		kybStatus: KybStatusSchema,
		kybFields: KybFieldsSchema.optional(),
	})
	.strict()
	.superRefine((value, context) => {
		if (KYB_STATUSES_REQUIRING_REASON.includes(value.kybStatus) && value.kybFields?.rejectionReason === undefined) {
			context.addIssue({ code: "custom", message: "A reason is required when rejecting or requesting action", path: ["kybFields", "rejectionReason"] });
		}
	});

export type AdminKybUpdateInput = z.output<typeof AdminKybUpdateSchema>;

export const AdminKybUpdatePathInputSchema = z.intersection(z.object({ organizationId: z.uuid() }).strict(), AdminKybUpdateSchema);

export type AdminKybUpdatePathInput = z.output<typeof AdminKybUpdatePathInputSchema>;
