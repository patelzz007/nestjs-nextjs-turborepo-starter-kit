import { z } from "zod";

import { EpochMsSchema } from "../../api/common";
import { DocumentMimeTypeSchema, MERCHANT_KYB_UPLOAD_POLICY } from "../platform/storage";
import { strongPassword } from "../../auth/auth";
import { JsonObjectSchema } from "../../runtime/json";
import {
	KybDocumentScanStatusSchema,
	KybStatusSchema,
	MerchantBusinessCategorySchema,
	MerchantMemberRoleSchema,
	MerchantOrgStatusSchema,
	PilotCitySchema,
} from "./rewards-enums";

/** Maximum single KYB document size in bytes (5 MiB). */
export const MERCHANT_KYB_MAX_DOCUMENT_BYTES = MERCHANT_KYB_UPLOAD_POLICY.maxBytesPerFile;

/** Maximum number of KYB documents per submission. */
export const MERCHANT_KYB_MAX_DOCUMENT_COUNT = MERCHANT_KYB_UPLOAD_POLICY.maxCount;

/** Legacy inline document shape (pre-object-storage migration — `kyb_fields.documents`). */
export const MerchantKybLegacyDocumentSchema = z
	.object({
		fileName: z.string().min(1).max(255),
		mimeType: DocumentMimeTypeSchema,
		sizeBytes: z.number().int().positive().max(MERCHANT_KYB_MAX_DOCUMENT_BYTES),
		contentBase64: z.string().min(1).max(7_000_000),
	})
	.strict();

export type MerchantKybLegacyDocument = z.output<typeof MerchantKybLegacyDocumentSchema>;

/** KYB document metadata returned by the API (object storage reference). */
export const MerchantKybDocumentRecordSchema = z
	.object({
		id: z.uuid(),
		fileName: z.string().min(1).max(255),
		mimeType: DocumentMimeTypeSchema,
		sizeBytes: z.number().int().positive().max(MERCHANT_KYB_MAX_DOCUMENT_BYTES),
		scanStatus: KybDocumentScanStatusSchema,
		uploadedAt: EpochMsSchema,
	})
	.strict();

export type MerchantKybDocumentRecord = z.output<typeof MerchantKybDocumentRecordSchema>;

/** Signed download URL for a CLEAN KYB document. */
export const MerchantKybDocumentDownloadResponseSchema = z
	.object({
		documentId: z.uuid(),
		scanStatus: KybDocumentScanStatusSchema,
		downloadUrl: z.url().nullable(),
		expiresAt: EpochMsSchema.nullable(),
	})
	.strict();

export type MerchantKybDocumentDownloadResponse = z.output<typeof MerchantKybDocumentDownloadResponseSchema>;

/** Scanner callback payload (Google OIDC-authenticated). */
export const KybScanResultSchema = z
	.object({
		documentId: z.uuid(),
		organizationId: z.uuid(),
		storagePath: z.string().min(1).max(500),
		objectGeneration: z.string().min(1).max(64).optional(),
		scanStatus: z.enum(["CLEAN", "INFECTED"]),
		scanResult: z.string().max(500).optional(),
		cleanStoragePath: z.string().min(1).max(500).optional(),
	})
	.strict();

export type KybScanResult = z.output<typeof KybScanResultSchema>;

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

/** KYB details collected during onboarding — business name comes from the invite and documents upload after organization creation. */
export const MerchantOnboardingKybFieldsSchema = MerchantKybSubmissionFormSchema.omit({ businessName: true });

export type MerchantOnboardingKybFieldsInput = z.output<typeof MerchantOnboardingKybFieldsSchema>;

export const MerchantOnboardingValidateTokenSchema = z
	.object({
		token: z.string().min(1),
	})
	.strict();

export type MerchantOnboardingValidateTokenInput = z.output<typeof MerchantOnboardingValidateTokenSchema>;

export const MerchantOnboardingInvitePreviewSchema = z
	.object({
		email: z.email(),
		businessName: z.string(),
		city: PilotCitySchema,
		expiresAt: EpochMsSchema,
		hasExistingAccount: z.boolean(),
	})
	.strict();

export type MerchantOnboardingInvitePreview = z.output<typeof MerchantOnboardingInvitePreviewSchema>;

export const MerchantOnboardingCompleteFieldsSchema = z
	.object({
		token: z.string().min(1),
		password: strongPassword,
		fullName: z.string().min(2).max(200),
		category: MerchantBusinessCategorySchema,
		legalName: MerchantOnboardingKybFieldsSchema.shape.legalName,
		addressText: MerchantOnboardingKybFieldsSchema.shape.addressText,
		contactPhone: MerchantOnboardingKybFieldsSchema.shape.contactPhone,
		registrationNo: MerchantOnboardingKybFieldsSchema.shape.registrationNo,
		taxId: MerchantOnboardingKybFieldsSchema.shape.taxId,
		documentType: MerchantOnboardingKybFieldsSchema.shape.documentType,
	})
	.strict();

export type MerchantOnboardingCompleteFieldsInput = z.output<typeof MerchantOnboardingCompleteFieldsSchema>;

/** Invite-authorized upload ticket request used before the merchant can sign in. */
export const MerchantOnboardingDocumentUploadUrlSchema = z
	.object({
		token: z.string().min(1),
		fileName: z.string().min(1).max(255),
		mimeType: DocumentMimeTypeSchema,
		sizeBytes: z.number().int().positive(),
		checksumSha256: z.string().length(64),
	})
	.strict();

export type MerchantOnboardingDocumentUploadUrlInput = z.output<typeof MerchantOnboardingDocumentUploadUrlSchema>;

/** Confirms an invite-authorized direct upload. */
export const MerchantOnboardingDocumentUploadCompleteSchema = z
	.object({
		token: z.string().min(1),
		fileId: z.uuid(),
		checksumSha256: z.string().length(64),
	})
	.strict();

export type MerchantOnboardingDocumentUploadCompleteInput = z.output<typeof MerchantOnboardingDocumentUploadCompleteSchema>;

/** Attaches completed onboarding documents to the newly provisioned merchant. */
export const MerchantOnboardingDocumentsSubmitSchema = z
	.object({
		token: z.string().min(1),
		documentFileIds: z.array(z.uuid()).min(1).max(MERCHANT_KYB_MAX_DOCUMENT_COUNT),
	})
	.strict();

export type MerchantOnboardingDocumentsSubmitInput = z.output<typeof MerchantOnboardingDocumentsSubmitSchema>;

export const MerchantKybProfileResponseSchema = z
	.object({
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
	})
	.strict();

export type MerchantKybProfileResponse = z.output<typeof MerchantKybProfileResponseSchema>;

export const MerchantOnboardingCompleteResponseSchema = z
	.object({
		organizationId: z.uuid(),
		organizationSlug: z
			.string()
			.min(2)
			.max(64)
			.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
		businessName: z.string(),
		role: MerchantMemberRoleSchema,
	})
	.strict();

export type MerchantOnboardingCompleteResponse = z.output<typeof MerchantOnboardingCompleteResponseSchema>;

export const MerchantCreateMemberSchema = z
	.object({
		email: z.email().max(100),
		password: strongPassword,
		fullName: z.string().min(2).max(200),
		role: z.literal("CASHIER"),
	})
	.strict();

export type MerchantCreateMemberInput = z.output<typeof MerchantCreateMemberSchema>;

export const MerchantMemberCreatedResponseSchema = z
	.object({
		userId: z.uuid(),
		email: z.string(),
		fullName: z.string(),
		organizationId: z.uuid(),
		role: MerchantMemberRoleSchema,
	})
	.strict();

export type MerchantMemberCreatedResponse = z.output<typeof MerchantMemberCreatedResponseSchema>;

export const AdminKybUpdateSchema = z
	.object({
		kybStatus: KybStatusSchema,
		kybFields: JsonObjectSchema.optional(),
	})
	.strict();

export type AdminKybUpdateInput = z.output<typeof AdminKybUpdateSchema>;

export const AdminKybUpdatePathInputSchema = AdminKybUpdateSchema.extend({
	organizationId: z.uuid(),
}).strict();

export type AdminKybUpdatePathInput = z.output<typeof AdminKybUpdatePathInputSchema>;
