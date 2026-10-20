import { z } from "zod";

import { BaseResponseSchema, EpochMsSchema } from "../../../schemas/api/common";
import { defineListQuery, listFilter } from "../../../schemas/api/list-query";
import { JsonObjectSchema } from "../../../schemas/runtime/json";
import { REWARD_LIST_DEFAULT_LIMIT } from "../../rewards/schemas/reward";
import { RewardBackupCodeSchema, RewardClaimStatusSchema } from "./claim-enums";

// ── Claims: holding an offer (RewardClaim, OTP challenge, QR codes, notification inbox) ──

/** `GET /claims` (the signed-in user's claims) list query. */
export const rewardClaimListQuery = defineListQuery({
	sortable: ["claimedAt", "createdAt"],
	defaultSort: [{ field: "claimedAt", direction: "desc" }],
	filter: {
		status: listFilter.enumeration(RewardClaimStatusSchema, { eq: true, in: true }),
	},
	params: {},
	defaultLimit: REWARD_LIST_DEFAULT_LIMIT,
});

export const RewardClaimListQuerySchema = rewardClaimListQuery.schema;

export type RewardClaimListQuery = z.output<typeof RewardClaimListQuerySchema>;

export type RewardClaimListSortField = (typeof rewardClaimListQuery.sortable)[number];

/** `GET /rewards/notifications` list query — `filter[readAt][isNull]=true` lists unread notifications. */
export const rewardNotificationListQuery = defineListQuery({
	sortable: ["createdAt"],
	defaultSort: [{ field: "createdAt", direction: "desc" }],
	filter: {
		readAt: listFilter.epochMs({ isNull: true, gte: true, lte: true }),
	},
	params: {},
	defaultLimit: REWARD_LIST_DEFAULT_LIMIT,
});

export const RewardNotificationListQuerySchema = rewardNotificationListQuery.schema;

export type RewardNotificationListQuery = z.output<typeof RewardNotificationListQuerySchema>;

export type RewardNotificationListSortField = (typeof rewardNotificationListQuery.sortable)[number];

export const RequestClaimOtpSchema = z
	.object({
		rewardId: z.uuid(),
		phone: z.string().min(8).max(20),
	})
	.strict();

export type RequestClaimOtpInput = z.output<typeof RequestClaimOtpSchema>;

export const CreateRewardClaimSchema = z
	.object({
		rewardId: z.uuid(),
		phone: z.string().min(8).max(20),
		otp: z
			.string()
			.length(6)
			.regex(/^\d{6}$/)
			.optional(),
		captchaToken: z.string().min(1).optional(),
	})
	.strict();

export type CreateRewardClaimInput = z.output<typeof CreateRewardClaimSchema>;

export const MarkRewardNotificationsReadSchema = z
	.object({
		notificationIds: z.array(z.uuid()).optional(),
		markAll: z.boolean().optional(),
	})
	.strict();

export type MarkRewardNotificationsReadInput = z.output<typeof MarkRewardNotificationsReadSchema>;

export const RewardClaimResponseSchema = BaseResponseSchema.extend({
	id: z.uuid(),
	rewardId: z.uuid(),
	rewardTitle: z.string(),
	status: RewardClaimStatusSchema,
	claimedAt: EpochMsSchema,
	claimExpiresAt: EpochMsSchema,
	redeemedAt: EpochMsSchema.nullable(),
	isReferrerCredit: z.boolean(),
});

export type RewardClaimResponse = z.output<typeof RewardClaimResponseSchema>;

export const RewardClaimCreatedResponseSchema = z.object({
	claim: RewardClaimResponseSchema,
	qrDeepLink: z.string(),
	backupCode: RewardBackupCodeSchema,
});

export type RewardClaimCreatedResponse = z.output<typeof RewardClaimCreatedResponseSchema>;

export const RewardClaimQrResponseSchema = z.object({
	claimId: z.uuid(),
	qrPayload: z.string(),
	backupCode: RewardBackupCodeSchema,
	claimExpiresAt: EpochMsSchema,
});

export type RewardClaimQrResponse = z.output<typeof RewardClaimQrResponseSchema>;

export const RewardNotificationResponseSchema = BaseResponseSchema.extend({
	id: z.uuid(),
	type: z.string(),
	title: z.string(),
	body: z.string(),
	readAt: EpochMsSchema.nullable(),
	metadata: JsonObjectSchema.nullable(),
});

export type RewardNotificationResponse = z.output<typeof RewardNotificationResponseSchema>;

/** `GET /reward-notifications` payload: one keyset page of notifications plus the unread badge count. */
