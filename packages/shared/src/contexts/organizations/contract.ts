// API contract leaves owned by the `organizations` context (plan §7: the backend owner of each
// endpoint). Composed into `apiContract` (`src/contracts/index.ts`) with identical keys.

import { z } from "zod";

import { defineContract } from "../../contracts/define-contract";
import { paginatedResponse, singleResponse } from "../../contracts/response";
import { MessageResponseSchema, OkResponseSchema, SuccessAckResponseSchema } from "../../schemas/api/message";
import { UuidParamSchema } from "../../schemas/domain/platform/param-schemas";
import {
	AdminCreateMerchantInviteSchema,
	AdminMerchantDetailResponseSchema,
	AdminMerchantIdParamSchema,
	AdminMerchantInviteCreatedResponseSchema,
	AdminMerchantListQuerySchema,
	MerchantOrgResponseSchema,
	OrganizationRewardMembershipResponseSchema,
	OwnMembershipListQuerySchema,
} from "./schemas/merchant";
import {
	AdminKybUpdatePathInputSchema,
	MerchantKybDocumentDownloadResponseSchema,
	MerchantKybProfileResponseSchema,
	MerchantKybSubmissionFieldsSchema,
	MerchantOnboardingCompleteFieldsSchema,
	MerchantOnboardingCompleteResponseSchema,
	MerchantOnboardingDocumentBatchUploadCompleteResponseSchema,
	MerchantOnboardingDocumentBatchUploadCompleteSchema,
	MerchantOnboardingDocumentBatchUploadUrlResponseSchema,
	MerchantOnboardingDocumentBatchUploadUrlSchema,
	MerchantOnboardingDocumentsSubmitSchema,
	MerchantOnboardingDocumentStatusResponseSchema,
	MerchantOnboardingDocumentStatusSchema,
	MerchantOnboardingDocumentUploadCompleteSchema,
	MerchantOnboardingDocumentUploadUrlSchema,
	MerchantOnboardingInvitePreviewSchema,
	MerchantOnboardingValidateTokenSchema,
} from "./schemas/merchant-kyb";
import { CompleteFileUploadResponseSchema, CreateFileUploadUrlResponseSchema, FileDownloadDispositionSchema } from "../files/schemas/storage";
import { LoginClientResponseSchema } from "../identity/schemas/auth";
import { adminOrganizationsRoutes, organizationsRoutes, rewardsAdminOrganizationRoutes } from "./routes";
import {
	AdminCreateOrganizationInviteSchema,
	AdminLocationRequestListQuerySchema,
	AdminLocationRequestResponseSchema,
	AdminOrganizationInviteCreatedResponseSchema,
	AdminOrganizationLocationCreateSchema,
	AdminOrganizationLocationReviewPathInputSchema,
	AdminOrganizationLocationReviewSchema,
	OrganizationAccessRequestCreateSchema,
	OrganizationAccessRequestResponseSchema,
	OrganizationContextResponseSchema,
	OrganizationLocationCloseResponseSchema,
	OrganizationLocationCloseSchema,
	OrganizationLocationCreateSchema,
	OrganizationLocationIdParamSchema,
	OrganizationLocationResponseSchema,
	OrganizationLocationUpdateSchema,
	OrganizationMemberInviteCreatedResponseSchema,
	OrganizationMemberInviteIdParamSchema,
	OrganizationMemberInviteListQuerySchema,
	OrganizationMemberInviteResponseSchema,
	OrganizationMemberInviteSchema,
	OrganizationMemberListQuerySchema,
	OrganizationMemberRosterResponseSchema,
	OrganizationMemberStoreParamSchema,
	OrganizationMemberStoreRemoveResponseSchema,
	OrganizationMemberStoreRemoveSchema,
	OrganizationMembershipResponseSchema,
	OrganizationOwnMembershipUpdateSchema,
	OrganizationSlugParamSchema,
	OrganizationTeamInviteAcceptResponseSchema,
	OrganizationTeamInvitePreviewSchema,
	OrganizationTeamInviteRegisterAcceptSchema,
	OrganizationTeamInviteTokenSchema,
} from "./schemas/organization";

/** Contract leaves composed into `apiContract.rewardsAdmin`. */
export const rewardsAdminOrganizationContract = {
	createInvite: defineContract({
		method: "POST",
		path: rewardsAdminOrganizationRoutes.invites,
		input: AdminCreateMerchantInviteSchema,
		response: singleResponse(AdminMerchantInviteCreatedResponseSchema),
	}),
	listOrganizations: defineContract({
		method: "GET",
		path: rewardsAdminOrganizationRoutes.merchants,
		input: AdminMerchantListQuerySchema,
		response: paginatedResponse(MerchantOrgResponseSchema),
	}),
	getOrganization: defineContract({
		method: "GET",
		path: rewardsAdminOrganizationRoutes.organizationDetail,
		input: AdminMerchantIdParamSchema,
		response: singleResponse(AdminMerchantDetailResponseSchema),
	}),
	downloadOrganizationDocument: defineContract({
		method: "GET",
		path: rewardsAdminOrganizationRoutes.organizationKybDocumentDownload,
		input: z
			.object({
				organizationId: UuidParamSchema,
				documentId: UuidParamSchema,
				disposition: FileDownloadDispositionSchema.optional(),
			})
			.strict(),
		response: singleResponse(MerchantKybDocumentDownloadResponseSchema),
	}),
	updateKyb: defineContract({
		method: "PATCH",
		path: rewardsAdminOrganizationRoutes.organizationKyb,
		input: AdminKybUpdatePathInputSchema,
		response: singleResponse(OkResponseSchema),
	}),
	listLocationRequests: defineContract({
		method: "GET",
		path: rewardsAdminOrganizationRoutes.locationRequests,
		input: AdminLocationRequestListQuerySchema,
		response: paginatedResponse(AdminLocationRequestResponseSchema),
	}),
	createOrganizationLocation: defineContract({
		method: "POST",
		path: rewardsAdminOrganizationRoutes.organizationLocationCreate,
		input: z.intersection(AdminMerchantIdParamSchema, AdminOrganizationLocationCreateSchema),
		response: singleResponse(OrganizationLocationResponseSchema),
	}),
	reviewOrganizationLocation: defineContract({
		method: "PATCH",
		path: rewardsAdminOrganizationRoutes.organizationLocationReview,
		input: z.intersection(AdminOrganizationLocationReviewPathInputSchema, AdminOrganizationLocationReviewSchema),
		response: singleResponse(OrganizationLocationResponseSchema),
	}),
};

/** Contract leaves composed into `apiContract.organizations`. */
export const organizationsContract = {
	membershipsBootstrap: defineContract({
		method: "GET",
		path: organizationsRoutes.membershipsBootstrap,
		input: OwnMembershipListQuerySchema,
		response: paginatedResponse(OrganizationRewardMembershipResponseSchema),
	}),
	context: defineContract({
		method: "GET",
		path: organizationsRoutes.context,
		input: OrganizationSlugParamSchema,
		response: singleResponse(OrganizationContextResponseSchema),
	}),
	createAccessRequest: defineContract({
		method: "POST",
		path: organizationsRoutes.accessRequests,
		input: z.intersection(OrganizationSlugParamSchema, OrganizationAccessRequestCreateSchema),
		response: singleResponse(OrganizationAccessRequestResponseSchema),
	}),
	inviteMember: defineContract({
		method: "POST",
		path: organizationsRoutes.inviteMember,
		input: z.intersection(OrganizationSlugParamSchema, OrganizationMemberInviteSchema),
		response: singleResponse(OrganizationMemberInviteCreatedResponseSchema),
	}),
	listMembers: defineContract({
		method: "GET",
		path: organizationsRoutes.listMembers,
		input: z.intersection(OrganizationSlugParamSchema, OrganizationMemberListQuerySchema),
		response: paginatedResponse(OrganizationMemberRosterResponseSchema),
	}),
	updateOwnMembership: defineContract({
		method: "PATCH",
		path: organizationsRoutes.ownMembership,
		input: z.intersection(OrganizationSlugParamSchema, OrganizationOwnMembershipUpdateSchema),
		response: singleResponse(OrganizationMembershipResponseSchema),
	}),
	listMemberInvites: defineContract({
		method: "GET",
		path: organizationsRoutes.listMemberInvites,
		input: z.intersection(OrganizationSlugParamSchema, OrganizationMemberInviteListQuerySchema),
		response: paginatedResponse(OrganizationMemberInviteResponseSchema),
	}),
	revokeMemberInvite: defineContract({
		method: "POST",
		path: organizationsRoutes.revokeMemberInvite,
		input: OrganizationMemberInviteIdParamSchema,
		response: singleResponse(MessageResponseSchema),
	}),
	removeMemberFromStore: defineContract({
		method: "POST",
		path: organizationsRoutes.removeMemberFromStore,
		input: z.intersection(OrganizationMemberStoreParamSchema, OrganizationMemberStoreRemoveSchema),
		response: singleResponse(OrganizationMemberStoreRemoveResponseSchema),
	}),
	validateTeamInvite: defineContract({
		access: "public",
		method: "POST",
		path: organizationsRoutes.teamInvites.validate,
		input: OrganizationTeamInviteTokenSchema,
		response: singleResponse(OrganizationTeamInvitePreviewSchema),
	}),
	acceptTeamInvite: defineContract({
		method: "POST",
		path: organizationsRoutes.teamInvites.accept,
		input: OrganizationTeamInviteTokenSchema,
		response: singleResponse(OrganizationTeamInviteAcceptResponseSchema),
	}),
	registerAndAcceptTeamInvite: defineContract({
		access: "public",
		method: "POST",
		path: organizationsRoutes.teamInvites.registerAndAccept,
		input: OrganizationTeamInviteRegisterAcceptSchema,
		response: singleResponse(LoginClientResponseSchema),
	}),
	kyb: {
		get: defineContract({
			method: "GET",
			path: organizationsRoutes.kyb,
			input: OrganizationSlugParamSchema,
			response: singleResponse(MerchantKybProfileResponseSchema),
		}),
		submit: defineContract({
			method: "PATCH",
			path: organizationsRoutes.kyb,
			input: z.intersection(OrganizationSlugParamSchema, MerchantKybSubmissionFieldsSchema),
			response: singleResponse(MerchantKybProfileResponseSchema),
		}),
		downloadDocument: defineContract({
			method: "GET",
			path: organizationsRoutes.kybDocumentDownload,
			input: z
				.object({
					orgSlug: OrganizationSlugParamSchema.shape.orgSlug,
					documentId: UuidParamSchema,
					disposition: FileDownloadDispositionSchema.optional(),
				})
				.strict(),
			response: singleResponse(MerchantKybDocumentDownloadResponseSchema),
		}),
	},
	locations: {
		create: defineContract({
			method: "POST",
			path: organizationsRoutes.locations.create,
			input: z.intersection(OrganizationSlugParamSchema, OrganizationLocationCreateSchema),
			response: singleResponse(OrganizationLocationResponseSchema),
		}),
		update: defineContract({
			method: "PATCH",
			path: organizationsRoutes.locations.update,
			input: z.intersection(OrganizationLocationIdParamSchema, OrganizationLocationUpdateSchema),
			response: singleResponse(OrganizationLocationResponseSchema),
		}),
		close: defineContract({
			method: "POST",
			path: organizationsRoutes.locations.close,
			input: z.intersection(OrganizationLocationIdParamSchema, OrganizationLocationCloseSchema),
			response: singleResponse(OrganizationLocationCloseResponseSchema),
		}),
	},
	onboarding: {
		validate: defineContract({
			access: "public",
			method: "POST",
			path: organizationsRoutes.onboarding.validate,
			input: MerchantOnboardingValidateTokenSchema,
			response: singleResponse(MerchantOnboardingInvitePreviewSchema),
		}),
		complete: defineContract({
			access: "public",
			method: "POST",
			path: organizationsRoutes.onboarding.complete,
			input: MerchantOnboardingCompleteFieldsSchema,
			response: singleResponse(MerchantOnboardingCompleteResponseSchema),
		}),
		documentUploadUrl: defineContract({
			access: "public",
			method: "POST",
			path: organizationsRoutes.onboarding.documentUploadUrl,
			input: MerchantOnboardingDocumentUploadUrlSchema,
			response: singleResponse(CreateFileUploadUrlResponseSchema),
		}),
		documentBatchUploadUrl: defineContract({
			access: "public",
			method: "POST",
			path: organizationsRoutes.onboarding.documentBatchUploadUrl,
			input: MerchantOnboardingDocumentBatchUploadUrlSchema,
			response: singleResponse(MerchantOnboardingDocumentBatchUploadUrlResponseSchema),
		}),
		documentUploadComplete: defineContract({
			access: "public",
			method: "POST",
			path: organizationsRoutes.onboarding.documentUploadComplete,
			input: MerchantOnboardingDocumentUploadCompleteSchema,
			response: singleResponse(CompleteFileUploadResponseSchema),
		}),
		documentBatchUploadComplete: defineContract({
			access: "public",
			method: "POST",
			path: organizationsRoutes.onboarding.documentBatchUploadComplete,
			input: MerchantOnboardingDocumentBatchUploadCompleteSchema,
			response: singleResponse(MerchantOnboardingDocumentBatchUploadCompleteResponseSchema),
		}),
		documentsSubmit: defineContract({
			access: "public",
			method: "POST",
			path: organizationsRoutes.onboarding.documentsSubmit,
			input: MerchantOnboardingDocumentsSubmitSchema,
			response: singleResponse(SuccessAckResponseSchema),
		}),
		documentStatus: defineContract({
			access: "public",
			method: "POST",
			path: organizationsRoutes.onboarding.documentStatus,
			input: MerchantOnboardingDocumentStatusSchema,
			response: singleResponse(MerchantOnboardingDocumentStatusResponseSchema),
		}),
	},
};

/** Contract leaves composed into `apiContract.adminOrganizations`. */
export const adminOrganizationsContract = {
	createInvite: defineContract({
		method: "POST",
		path: adminOrganizationsRoutes.invites,
		input: AdminCreateOrganizationInviteSchema,
		response: singleResponse(AdminOrganizationInviteCreatedResponseSchema),
	}),
};
