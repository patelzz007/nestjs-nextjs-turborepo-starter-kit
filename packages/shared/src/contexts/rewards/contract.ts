// API contract leaves owned by the `rewards` context (plan §7: the backend owner of each
// endpoint). Composed into `apiContract` (`src/contracts/index.ts`) with identical keys.

import { z } from "zod";

import { defineContract, defineFileContract } from "../../contracts/define-contract";
import { fileResponse, paginatedResponse, singleResponse } from "../../contracts/response";
import { OkResponseSchema } from "../../schemas/api/message";
import { UuidParamSchema } from "../../schemas/domain/platform/param-schemas";
import { AcceptRewardLegalSchema, RewardClaimCheckoutStatusSchema } from "./schemas/reward-legal";
import {
	AdminPendingRewardListQuerySchema,
	AdminRejectRewardPathInputSchema,
	AdminRewardImageDownloadResponseSchema,
	AdminRewardImagePathInputSchema,
	AdminRewardImagesArchivePathInputSchema,
	AdminRewardPathInputSchema,
	MerchantCreateRewardSchema,
	MerchantRewardListQuerySchema,
	MerchantRewardSummaryQuerySchema,
	MerchantRewardSummarySchema,
	MerchantUpdateRewardPathInputSchema,
	REWARD_IMAGES_ARCHIVE_CONTENT_TYPE,
	RewardListQuerySchema,
	RewardResponseSchema,
} from "./schemas/reward";
import { OrganizationSlugParamSchema } from "../organizations/schemas/organization";
import { legalRoutes, organizationRewardsRoutes, rewardsAdminRewardRoutes, rewardsRoutes } from "./routes";

/** Contract leaves composed into `apiContract.rewardsAdmin` (pendingRewards, getReward, approveReward, rejectReward, downloadRewardImage, downloadRewardImagesArchive). */
export const rewardsAdminRewardContract = {
	pendingRewards: defineContract({
		method: "GET",
		path: rewardsAdminRewardRoutes.rewardsPending,
		input: AdminPendingRewardListQuerySchema,
		response: paginatedResponse(RewardResponseSchema),
	}),
	/** One reward in full, whatever its status — reviewers open it from the moderation queue. */
	getReward: defineContract({
		method: "GET",
		path: rewardsAdminRewardRoutes.rewardDetail,
		input: AdminRewardPathInputSchema,
		response: singleResponse(RewardResponseSchema),
	}),
	approveReward: defineContract({
		method: "POST",
		path: rewardsAdminRewardRoutes.rewardApprove,
		input: z.object({ rewardId: UuidParamSchema }).strict(),
		response: singleResponse(RewardResponseSchema),
	}),
	/** One of a reward's images, downloaded as its original upload — reviewers check photos at full resolution. */
	downloadRewardImage: defineContract({
		method: "GET",
		path: rewardsAdminRewardRoutes.rewardImageDownload,
		input: AdminRewardImagePathInputSchema,
		response: singleResponse(AdminRewardImageDownloadResponseSchema),
	}),
	/** Every image of a reward in one ZIP (original uploads, in display order) — fetch it with `fetchDownload`. */
	downloadRewardImagesArchive: defineFileContract({
		method: "GET",
		path: rewardsAdminRewardRoutes.rewardImagesArchive,
		input: AdminRewardImagesArchivePathInputSchema,
		response: fileResponse([REWARD_IMAGES_ARCHIVE_CONTENT_TYPE]),
	}),
	rejectReward: defineContract({
		method: "POST",
		path: rewardsAdminRewardRoutes.rewardReject,
		input: AdminRejectRewardPathInputSchema,
		response: singleResponse(RewardResponseSchema),
	}),
};

// ── Rewards platform (Phase 1) ───────────────────────────────────

/** Contract leaves composed into `apiContract.rewards`. */
export const rewardsContract = {
	list: defineContract({ access: "public", method: "GET", path: rewardsRoutes.list, input: RewardListQuerySchema, response: paginatedResponse(RewardResponseSchema) }),
	detail: defineContract({
		access: "public",
		method: "GET",
		path: rewardsRoutes.detail,
		input: z.object({ rewardId: UuidParamSchema }).strict(),
		response: singleResponse(RewardResponseSchema),
	}),
};

/** Contract leaves composed into `apiContract.legal`. */
export const legalContract = {
	accept: defineContract({ method: "POST", path: legalRoutes.accept, input: AcceptRewardLegalSchema, response: singleResponse(OkResponseSchema) }),
	status: defineContract({ method: "GET", path: legalRoutes.status, input: z.undefined(), response: singleResponse(RewardClaimCheckoutStatusSchema) }),
};

/** Contract leaves composed into `apiContract.organizations.rewards`. */
export const organizationRewardsContract = {
	list: defineContract({
		method: "GET",
		path: organizationRewardsRoutes.list,
		input: z.intersection(OrganizationSlugParamSchema, MerchantRewardListQuerySchema),
		response: paginatedResponse(RewardResponseSchema),
	}),
	summary: defineContract({
		method: "GET",
		path: organizationRewardsRoutes.summary,
		input: z.intersection(OrganizationSlugParamSchema, MerchantRewardSummaryQuerySchema),
		response: singleResponse(MerchantRewardSummarySchema),
	}),
	get: defineContract({
		method: "GET",
		path: organizationRewardsRoutes.get,
		input: z.object({ orgSlug: OrganizationSlugParamSchema.shape.orgSlug, rewardId: UuidParamSchema }).strict(),
		response: singleResponse(RewardResponseSchema),
	}),
	create: defineContract({
		method: "POST",
		path: organizationRewardsRoutes.create,
		input: z.intersection(OrganizationSlugParamSchema, MerchantCreateRewardSchema),
		response: singleResponse(RewardResponseSchema),
	}),
	update: defineContract({
		method: "PATCH",
		path: organizationRewardsRoutes.update,
		input: MerchantUpdateRewardPathInputSchema.extend({ orgSlug: OrganizationSlugParamSchema.shape.orgSlug }),
		response: singleResponse(RewardResponseSchema),
	}),
	publish: defineContract({
		method: "POST",
		path: organizationRewardsRoutes.publish,
		input: z.object({ orgSlug: OrganizationSlugParamSchema.shape.orgSlug, rewardId: UuidParamSchema }).strict(),
		response: singleResponse(RewardResponseSchema),
	}),
};
