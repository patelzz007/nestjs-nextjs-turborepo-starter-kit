// API contract leaves owned by the `tenants` context (plan §7: the backend owner of each
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
	AdminMerchantInviteAvailabilitySchema,
	AdminMerchantInviteCreatedResponseSchema,
	AdminMerchantListQuerySchema,
	MerchantTenantResponseSchema,
	TenantRewardMembershipResponseSchema,
	OwnMembershipListQuerySchema,
} from "./schemas/merchant";
import {
	AdminTenantAppealParamSchema,
	AdminTenantAppealRejectSchema,
	AdminTenantLifecycleChangeSchema,
	TenantAppealCreateSchema,
	TenantLifecycleResponseSchema,
	TenantMembershipLeaveResponseSchema,
} from "./schemas/tenant-lifecycle";
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
import { TenantCustomerBanCreateSchema, TenantCustomerBanListQuerySchema, TenantCustomerBanParamSchema, TenantCustomerBanResponseSchema } from "./schemas/customer-bans";
import { CompleteFileUploadResponseSchema, CreateFileUploadUrlResponseSchema, FileDownloadDispositionSchema } from "../files/schemas/storage";
import { LoginClientResponseSchema } from "../identity/schemas/auth";
import { adminTenantsRoutes, tenantsRoutes, rewardsAdminTenantRoutes } from "./routes";
import {
	AdminCreateTenantInviteSchema,
	AdminLocationRequestListQuerySchema,
	AdminLocationRequestResponseSchema,
	AdminTenantInviteCreatedResponseSchema,
	AdminLocationCreateSchema,
	AdminLocationReviewPathInputSchema,
	AdminLocationReviewSchema,
	TenantAccessRequestCreateSchema,
	TenantAccessRequestResponseSchema,
	TenantContextResponseSchema,
	LocationCloseResponseSchema,
	LocationCloseSchema,
	LocationCreateSchema,
	LocationIdParamSchema,
	LocationResponseSchema,
	LocationUpdateSchema,
	TenantMemberInviteCreatedResponseSchema,
	TenantMemberInviteIdParamSchema,
	TenantMemberInviteListQuerySchema,
	TenantMemberInviteResponseSchema,
	TenantMemberInviteSchema,
	TenantMemberListQuerySchema,
	TenantMemberRosterResponseSchema,
	TenantMemberLocationParamSchema,
	TenantMemberLocationRemoveResponseSchema,
	TenantMemberLocationRemoveSchema,
	MembershipResponseSchema,
	TenantOwnMembershipUpdateSchema,
	TenantSlugParamSchema,
	TenantTeamInviteAcceptResponseSchema,
	TenantTeamInvitePreviewSchema,
	TenantTeamInviteRegisterAcceptSchema,
	TenantTeamInviteTokenSchema,
} from "./schemas/tenant";

/** Contract leaves composed into `apiContract.rewardsAdmin`. */
export const rewardsAdminTenantContract = {
	createInvite: defineContract({
		method: "POST",
		path: rewardsAdminTenantRoutes.invites,
		input: AdminCreateMerchantInviteSchema,
		response: singleResponse(AdminMerchantInviteCreatedResponseSchema),
	}),
	inviteAvailability: defineContract({
		method: "GET",
		path: rewardsAdminTenantRoutes.inviteAvailability,
		input: z.undefined(),
		response: singleResponse(AdminMerchantInviteAvailabilitySchema),
	}),
	listTenants: defineContract({
		method: "GET",
		path: rewardsAdminTenantRoutes.merchants,
		input: AdminMerchantListQuerySchema,
		response: paginatedResponse(MerchantTenantResponseSchema),
	}),
	getTenant: defineContract({
		method: "GET",
		path: rewardsAdminTenantRoutes.tenantDetail,
		input: AdminMerchantIdParamSchema,
		response: singleResponse(AdminMerchantDetailResponseSchema),
	}),
	getTenantLifecycle: defineContract({
		method: "GET",
		path: rewardsAdminTenantRoutes.tenantLifecycle,
		input: AdminMerchantIdParamSchema,
		response: singleResponse(TenantLifecycleResponseSchema),
	}),
	suspendTenant: defineContract({
		method: "POST",
		path: rewardsAdminTenantRoutes.suspendTenant,
		input: z.intersection(AdminMerchantIdParamSchema, AdminTenantLifecycleChangeSchema),
		response: singleResponse(TenantLifecycleResponseSchema),
	}),
	reinstateTenant: defineContract({
		method: "POST",
		path: rewardsAdminTenantRoutes.reinstateTenant,
		input: z.intersection(AdminMerchantIdParamSchema, AdminTenantLifecycleChangeSchema),
		response: singleResponse(TenantLifecycleResponseSchema),
	}),
	banTenant: defineContract({
		method: "POST",
		path: rewardsAdminTenantRoutes.banTenant,
		input: z.intersection(AdminMerchantIdParamSchema, AdminTenantLifecycleChangeSchema),
		response: singleResponse(TenantLifecycleResponseSchema),
	}),
	unbanTenant: defineContract({
		method: "POST",
		path: rewardsAdminTenantRoutes.unbanTenant,
		input: z.intersection(AdminMerchantIdParamSchema, AdminTenantLifecycleChangeSchema),
		response: singleResponse(TenantLifecycleResponseSchema),
	}),
	rejectTenantAppeal: defineContract({
		method: "POST",
		path: rewardsAdminTenantRoutes.rejectTenantAppeal,
		input: z.intersection(AdminTenantAppealParamSchema, AdminTenantAppealRejectSchema),
		response: singleResponse(TenantLifecycleResponseSchema),
	}),
	downloadTenantDocument: defineContract({
		method: "GET",
		path: rewardsAdminTenantRoutes.tenantKybDocumentDownload,
		input: z
			.object({
				tenantId: UuidParamSchema,
				documentId: UuidParamSchema,
				disposition: FileDownloadDispositionSchema.optional(),
			})
			.strict(),
		response: singleResponse(MerchantKybDocumentDownloadResponseSchema),
	}),
	updateKyb: defineContract({
		method: "PATCH",
		path: rewardsAdminTenantRoutes.tenantKyb,
		input: AdminKybUpdatePathInputSchema,
		response: singleResponse(OkResponseSchema),
	}),
	listLocationRequests: defineContract({
		method: "GET",
		path: rewardsAdminTenantRoutes.locationRequests,
		input: AdminLocationRequestListQuerySchema,
		response: paginatedResponse(AdminLocationRequestResponseSchema),
	}),
	createLocation: defineContract({
		method: "POST",
		path: rewardsAdminTenantRoutes.locationCreate,
		input: z.intersection(AdminMerchantIdParamSchema, AdminLocationCreateSchema),
		response: singleResponse(LocationResponseSchema),
	}),
	reviewLocation: defineContract({
		method: "PATCH",
		path: rewardsAdminTenantRoutes.locationReview,
		input: z.intersection(AdminLocationReviewPathInputSchema, AdminLocationReviewSchema),
		response: singleResponse(LocationResponseSchema),
	}),
};

/** Contract leaves composed into `apiContract.tenants`. */
export const tenantsContract = {
	membershipsBootstrap: defineContract({
		method: "GET",
		path: tenantsRoutes.membershipsBootstrap,
		input: OwnMembershipListQuerySchema,
		response: paginatedResponse(TenantRewardMembershipResponseSchema),
	}),
	context: defineContract({
		method: "GET",
		path: tenantsRoutes.context,
		input: TenantSlugParamSchema,
		response: singleResponse(TenantContextResponseSchema),
	}),
	createAccessRequest: defineContract({
		method: "POST",
		path: tenantsRoutes.accessRequests,
		input: z.intersection(TenantSlugParamSchema, TenantAccessRequestCreateSchema),
		response: singleResponse(TenantAccessRequestResponseSchema),
	}),
	inviteMember: defineContract({
		method: "POST",
		path: tenantsRoutes.inviteMember,
		input: z.intersection(TenantSlugParamSchema, TenantMemberInviteSchema),
		response: singleResponse(TenantMemberInviteCreatedResponseSchema),
	}),
	listMembers: defineContract({
		method: "GET",
		path: tenantsRoutes.listMembers,
		input: z.intersection(TenantSlugParamSchema, TenantMemberListQuerySchema),
		response: paginatedResponse(TenantMemberRosterResponseSchema),
	}),
	updateOwnMembership: defineContract({
		method: "PATCH",
		path: tenantsRoutes.ownMembership,
		input: z.intersection(TenantSlugParamSchema, TenantOwnMembershipUpdateSchema),
		response: singleResponse(MembershipResponseSchema),
	}),
	leaveTenant: defineContract({
		method: "POST",
		path: tenantsRoutes.leaveTenant,
		input: TenantSlugParamSchema,
		response: singleResponse(TenantMembershipLeaveResponseSchema),
	}),
	lifecycle: defineContract({
		method: "GET",
		path: tenantsRoutes.lifecycle,
		input: TenantSlugParamSchema,
		response: singleResponse(TenantLifecycleResponseSchema),
	}),
	submitAppeal: defineContract({
		method: "POST",
		path: tenantsRoutes.submitAppeal,
		input: z.intersection(TenantSlugParamSchema, TenantAppealCreateSchema),
		response: singleResponse(TenantLifecycleResponseSchema),
	}),
	reactivate: defineContract({
		method: "POST",
		path: tenantsRoutes.reactivate,
		input: TenantSlugParamSchema,
		response: singleResponse(TenantLifecycleResponseSchema),
	}),
	customerBans: defineContract({
		method: "GET",
		path: tenantsRoutes.customerBans,
		input: z.intersection(TenantSlugParamSchema, TenantCustomerBanListQuerySchema),
		response: paginatedResponse(TenantCustomerBanResponseSchema),
	}),
	banCustomer: defineContract({
		method: "POST",
		path: tenantsRoutes.customerBans,
		input: z.intersection(TenantSlugParamSchema, TenantCustomerBanCreateSchema),
		response: singleResponse(TenantCustomerBanResponseSchema),
	}),
	liftCustomerBan: defineContract({
		method: "POST",
		path: tenantsRoutes.liftCustomerBan,
		input: TenantCustomerBanParamSchema,
		response: singleResponse(OkResponseSchema),
	}),
	listMemberInvites: defineContract({
		method: "GET",
		path: tenantsRoutes.listMemberInvites,
		input: z.intersection(TenantSlugParamSchema, TenantMemberInviteListQuerySchema),
		response: paginatedResponse(TenantMemberInviteResponseSchema),
	}),
	revokeMemberInvite: defineContract({
		method: "POST",
		path: tenantsRoutes.revokeMemberInvite,
		input: TenantMemberInviteIdParamSchema,
		response: singleResponse(MessageResponseSchema),
	}),
	removeMemberFromLocation: defineContract({
		method: "POST",
		path: tenantsRoutes.removeMemberFromLocation,
		input: z.intersection(TenantMemberLocationParamSchema, TenantMemberLocationRemoveSchema),
		response: singleResponse(TenantMemberLocationRemoveResponseSchema),
	}),
	validateTeamInvite: defineContract({
		access: "public",
		method: "POST",
		path: tenantsRoutes.teamInvites.validate,
		input: TenantTeamInviteTokenSchema,
		response: singleResponse(TenantTeamInvitePreviewSchema),
	}),
	acceptTeamInvite: defineContract({
		method: "POST",
		path: tenantsRoutes.teamInvites.accept,
		input: TenantTeamInviteTokenSchema,
		response: singleResponse(TenantTeamInviteAcceptResponseSchema),
	}),
	registerAndAcceptTeamInvite: defineContract({
		access: "public",
		method: "POST",
		path: tenantsRoutes.teamInvites.registerAndAccept,
		input: TenantTeamInviteRegisterAcceptSchema,
		response: singleResponse(LoginClientResponseSchema),
	}),
	kyb: {
		get: defineContract({
			method: "GET",
			path: tenantsRoutes.kyb,
			input: TenantSlugParamSchema,
			response: singleResponse(MerchantKybProfileResponseSchema),
		}),
		submit: defineContract({
			method: "PATCH",
			path: tenantsRoutes.kyb,
			input: z.intersection(TenantSlugParamSchema, MerchantKybSubmissionFieldsSchema),
			response: singleResponse(MerchantKybProfileResponseSchema),
		}),
		downloadDocument: defineContract({
			method: "GET",
			path: tenantsRoutes.kybDocumentDownload,
			input: z
				.object({
					tenantSlug: TenantSlugParamSchema.shape.tenantSlug,
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
			path: tenantsRoutes.locations.create,
			input: z.intersection(TenantSlugParamSchema, LocationCreateSchema),
			response: singleResponse(LocationResponseSchema),
		}),
		update: defineContract({
			method: "PATCH",
			path: tenantsRoutes.locations.update,
			input: z.intersection(LocationIdParamSchema, LocationUpdateSchema),
			response: singleResponse(LocationResponseSchema),
		}),
		close: defineContract({
			method: "POST",
			path: tenantsRoutes.locations.close,
			input: z.intersection(LocationIdParamSchema, LocationCloseSchema),
			response: singleResponse(LocationCloseResponseSchema),
		}),
	},
	onboarding: {
		validate: defineContract({
			access: "public",
			method: "POST",
			path: tenantsRoutes.onboarding.validate,
			input: MerchantOnboardingValidateTokenSchema,
			response: singleResponse(MerchantOnboardingInvitePreviewSchema),
		}),
		complete: defineContract({
			access: "public",
			method: "POST",
			path: tenantsRoutes.onboarding.complete,
			input: MerchantOnboardingCompleteFieldsSchema,
			response: singleResponse(MerchantOnboardingCompleteResponseSchema),
		}),
		documentUploadUrl: defineContract({
			access: "public",
			method: "POST",
			path: tenantsRoutes.onboarding.documentUploadUrl,
			input: MerchantOnboardingDocumentUploadUrlSchema,
			response: singleResponse(CreateFileUploadUrlResponseSchema),
		}),
		documentBatchUploadUrl: defineContract({
			access: "public",
			method: "POST",
			path: tenantsRoutes.onboarding.documentBatchUploadUrl,
			input: MerchantOnboardingDocumentBatchUploadUrlSchema,
			response: singleResponse(MerchantOnboardingDocumentBatchUploadUrlResponseSchema),
		}),
		documentUploadComplete: defineContract({
			access: "public",
			method: "POST",
			path: tenantsRoutes.onboarding.documentUploadComplete,
			input: MerchantOnboardingDocumentUploadCompleteSchema,
			response: singleResponse(CompleteFileUploadResponseSchema),
		}),
		documentBatchUploadComplete: defineContract({
			access: "public",
			method: "POST",
			path: tenantsRoutes.onboarding.documentBatchUploadComplete,
			input: MerchantOnboardingDocumentBatchUploadCompleteSchema,
			response: singleResponse(MerchantOnboardingDocumentBatchUploadCompleteResponseSchema),
		}),
		documentsSubmit: defineContract({
			access: "public",
			method: "POST",
			path: tenantsRoutes.onboarding.documentsSubmit,
			input: MerchantOnboardingDocumentsSubmitSchema,
			response: singleResponse(SuccessAckResponseSchema),
		}),
		documentStatus: defineContract({
			access: "public",
			method: "POST",
			path: tenantsRoutes.onboarding.documentStatus,
			input: MerchantOnboardingDocumentStatusSchema,
			response: singleResponse(MerchantOnboardingDocumentStatusResponseSchema),
		}),
	},
};

/** Contract leaves composed into `apiContract.adminTenants`. */
export const adminTenantsContract = {
	createInvite: defineContract({
		method: "POST",
		path: adminTenantsRoutes.invites,
		input: AdminCreateTenantInviteSchema,
		response: singleResponse(AdminTenantInviteCreatedResponseSchema),
	}),
};
