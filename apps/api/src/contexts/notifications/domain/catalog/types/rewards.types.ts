import { APP_LINKS, SIGNUP_REFERRALS_SCREEN_PATH, type JsonObject } from "@workspace/shared";
import { z } from "zod";

import { defineNotificationType, type TypedNotificationType } from "../notification-type";

const MS_PER_MINUTE = 60_000;
/** Notifications of one grouped type within this window fold into one (ADR 070). */
export const DEFAULT_GROUPING_WINDOW_MS = 10 * MS_PER_MINUTE;

const ReferrerCreditedPayloadSchema = z.object({ rewardId: z.uuid(), rewardTitle: z.string().min(1).max(200), claimTtlDays: z.number().int().positive() }).strict();
type ReferrerCreditedPayload = z.output<typeof ReferrerCreditedPayloadSchema>;

/** A referee's redemption earned the referrer a reward. Several within ten minutes fold into one. */
export const REFERRER_CREDITED_NOTIFICATION: TypedNotificationType<ReferrerCreditedPayload> = defineNotificationType({
	key: "rewards.referrer-credited",
	description: "A referral earned the person a reward",
	category: "TRANSACTIONAL",
	surfaces: ["CUSTOMER"],
	channels: ["IN_APP", "EMAIL", "PUSH"],
	urgency: "normal",
	sensitive: false,
	allowsContactRecipient: false,
	digestible: true,
	grouping: { key: (): string => "referrer-credited", windowMs: DEFAULT_GROUPING_WINDOW_MS },
	payloadSchema: ReferrerCreditedPayloadSchema,
	toJson: (payload: ReferrerCreditedPayload): JsonObject => ({ ...payload }),
	samplePayload: { rewardId: "0193f2c4-0000-7000-8000-000000000001", rewardTitle: "Free latte", claimTtlDays: 14 },
	renderers: {
		en: {
			inApp: (payload, context) =>
				context.groupCount > 1
					? {
							title: `You earned ${String(context.groupCount)} referrer rewards!`,
							body: "Your referrals redeemed rewards. Claim them before they expire.",
							link: "/rewards",
							icon: "gift",
						}
					: {
							title: "You earned a referrer reward!",
							body: `Your referral redeemed a reward. Claim "${payload.rewardTitle}" within ${String(payload.claimTtlDays)} days.`,
							link: APP_LINKS.web.reward(payload.rewardId),
							icon: "gift",
						},
			email: (payload, context) => ({
				subject: "You earned a referrer reward",
				eyebrow: "Referral reward",
				heading: "Your referral paid off",
				paragraphs: [`Someone you referred redeemed a reward on ${context.appName}.`, `Claim "${payload.rewardTitle}" within ${String(payload.claimTtlDays)} days.`],
				action: { label: "Claim your reward", url: `${context.webUrl}${APP_LINKS.web.reward(payload.rewardId)}` },
			}),
			push: (payload, context) =>
				context.groupCount > 1
					? { title: `${String(context.groupCount)} referrer rewards`, body: "Your referrals redeemed rewards. Tap to claim.", link: "/rewards" }
					: {
							title: "You earned a referrer reward!",
							body: `Claim "${payload.rewardTitle}" within ${String(payload.claimTtlDays)} days.`,
							link: APP_LINKS.web.reward(payload.rewardId),
						},
		},
	},
});

/** Merchant pages live under the tenant's slug (`/t/<slug>/…`), so a merchant notice carries it. */
const TenantSlugSchema = z.string().min(1).max(64);

const RewardDecisionPayloadSchema = z.object({ rewardId: z.uuid(), rewardTitle: z.string().min(1).max(200), tenantSlug: TenantSlugSchema }).strict();
type RewardDecisionPayload = z.output<typeof RewardDecisionPayloadSchema>;

/** A tenant's reward passed review and is live. */
export const REWARD_APPROVED_NOTIFICATION: TypedNotificationType<RewardDecisionPayload> = defineNotificationType({
	key: "rewards.reward-approved",
	description: "A reward passed review and is live",
	category: "ACCOUNT",
	surfaces: ["MERCHANT"],
	channels: ["IN_APP", "PUSH"],
	urgency: "normal",
	sensitive: false,
	allowsContactRecipient: false,
	digestible: false,
	grouping: null,
	fallback: { PUSH: "EMAIL" },
	payloadSchema: RewardDecisionPayloadSchema,
	toJson: (payload: RewardDecisionPayload): JsonObject => ({ ...payload }),
	samplePayload: { rewardId: "0193f2c4-0000-7000-8000-000000000002", rewardTitle: "Weekend 2-for-1", tenantSlug: "sunrise-cafe" },
	renderers: {
		en: {
			inApp: (payload) => ({
				title: "Reward approved",
				body: `"${payload.rewardTitle}" is now live in the marketplace.`,
				link: APP_LINKS.merchant.reward(payload.tenantSlug, payload.rewardId),
				icon: "check",
			}),
			push: (payload) => ({ title: "Reward approved", body: `"${payload.rewardTitle}" is now live.`, link: APP_LINKS.merchant.reward(payload.tenantSlug, payload.rewardId) }),
			email: (payload, context) => ({
				subject: `"${payload.rewardTitle}" is live`,
				eyebrow: "Reward review",
				heading: "Reward approved",
				paragraphs: [`"${payload.rewardTitle}" passed review and is now live in the ${context.appName} marketplace.`],
				action: { label: "View reward", url: `${context.merchantUrl}${APP_LINKS.merchant.reward(payload.tenantSlug, payload.rewardId)}` },
			}),
		},
	},
});

const RewardRejectedPayloadSchema = z
	.object({ rewardId: z.uuid(), rewardTitle: z.string().min(1).max(200), tenantSlug: TenantSlugSchema, reason: z.string().min(1).max(2_000) })
	.strict();
type RewardRejectedPayload = z.output<typeof RewardRejectedPayloadSchema>;

/** A tenant's reward needs changes before it can go live. */
export const REWARD_REJECTED_NOTIFICATION: TypedNotificationType<RewardRejectedPayload> = defineNotificationType({
	key: "rewards.reward-rejected",
	description: "A reward needs changes before it can go live",
	category: "ACCOUNT",
	surfaces: ["MERCHANT"],
	channels: ["IN_APP", "EMAIL", "PUSH"],
	urgency: "normal",
	sensitive: false,
	allowsContactRecipient: false,
	digestible: false,
	grouping: null,
	payloadSchema: RewardRejectedPayloadSchema,
	toJson: (payload: RewardRejectedPayload): JsonObject => ({ ...payload }),
	samplePayload: { rewardId: "0193f2c4-0000-7000-8000-000000000003", rewardTitle: "Free cake", tenantSlug: "sunrise-cafe", reason: "The cover image is too small." },
	renderers: {
		en: {
			inApp: (payload) => ({ title: "Reward needs changes", body: payload.reason, link: APP_LINKS.merchant.rewardEdit(payload.tenantSlug, payload.rewardId), icon: "alert" }),
			email: (payload, context) => ({
				subject: `"${payload.rewardTitle}" needs changes`,
				eyebrow: "Reward review",
				heading: "Reward needs changes",
				paragraphs: [`"${payload.rewardTitle}" was not approved yet:`, payload.reason],
				action: { label: "Edit reward", url: `${context.merchantUrl}${APP_LINKS.merchant.rewardEdit(payload.tenantSlug, payload.rewardId)}` },
			}),
			push: (payload) => ({
				title: "Reward needs changes",
				body: `"${payload.rewardTitle}": ${payload.reason}`,
				link: APP_LINKS.merchant.rewardEdit(payload.tenantSlug, payload.rewardId),
			}),
		},
	},
});

/** A reward went live by itself after the review window. */
export const REWARD_AUTO_PUBLISHED_NOTIFICATION: TypedNotificationType<RewardDecisionPayload> = defineNotificationType({
	key: "rewards.reward-auto-published",
	description: "A reward was published after the 24-hour review window",
	category: "ACCOUNT",
	surfaces: ["MERCHANT"],
	channels: ["IN_APP", "PUSH"],
	urgency: "normal",
	sensitive: false,
	allowsContactRecipient: false,
	digestible: false,
	grouping: null,
	fallback: { PUSH: "EMAIL" },
	payloadSchema: RewardDecisionPayloadSchema,
	toJson: (payload: RewardDecisionPayload): JsonObject => ({ ...payload }),
	samplePayload: { rewardId: "0193f2c4-0000-7000-8000-000000000004", rewardTitle: "Morning combo", tenantSlug: "sunrise-cafe" },
	renderers: {
		en: {
			inApp: (payload) => ({
				title: "Reward published",
				body: `"${payload.rewardTitle}" was auto-published after the 24h review window.`,
				link: APP_LINKS.merchant.reward(payload.tenantSlug, payload.rewardId),
				icon: "check",
			}),
			push: (payload) => ({ title: "Reward published", body: `"${payload.rewardTitle}" is now live.`, link: APP_LINKS.merchant.reward(payload.tenantSlug, payload.rewardId) }),
			email: (payload, context) => ({
				subject: `"${payload.rewardTitle}" was published`,
				eyebrow: "Reward review",
				heading: "Reward published",
				paragraphs: [`"${payload.rewardTitle}" was published automatically after the 24-hour review window.`],
				action: { label: "View reward", url: `${context.merchantUrl}${APP_LINKS.merchant.reward(payload.tenantSlug, payload.rewardId)}` },
			}),
		},
	},
});

const SignupReferralSuccessPayloadSchema = z.object({ signupReferralId: z.uuid(), refereeName: z.string().min(1).max(200) }).strict();
type SignupReferralSuccessPayload = z.output<typeof SignupReferralSuccessPayloadSchema>;

/** A person the user invited redeemed their first reward. */
export const SIGNUP_REFERRAL_SUCCESS_NOTIFICATION: TypedNotificationType<SignupReferralSuccessPayload> = defineNotificationType({
	key: "referrals.signup-success",
	description: "An invited person redeemed their first reward",
	category: "TRANSACTIONAL",
	surfaces: ["CUSTOMER"],
	channels: ["IN_APP", "PUSH", "EMAIL"],
	urgency: "normal",
	sensitive: false,
	allowsContactRecipient: false,
	digestible: true,
	grouping: null,
	payloadSchema: SignupReferralSuccessPayloadSchema,
	toJson: (payload: SignupReferralSuccessPayload): JsonObject => ({ ...payload }),
	samplePayload: { signupReferralId: "0193f2c4-0000-7000-8000-000000000005", refereeName: "Jane Tan" },
	renderers: {
		en: {
			inApp: (payload) => ({
				title: "Referral successful",
				body: `${payload.refereeName} redeemed a reward. Your referral is successful.`,
				link: SIGNUP_REFERRALS_SCREEN_PATH,
				icon: "users",
			}),
			push: (payload) => ({ title: "Referral successful", body: `${payload.refereeName} redeemed a reward.`, link: SIGNUP_REFERRALS_SCREEN_PATH }),
			email: (payload, context) => ({
				subject: "Your referral was successful",
				eyebrow: "Referrals",
				heading: "Referral successful",
				paragraphs: [`${payload.refereeName} redeemed their first reward on ${context.appName}.`],
				action: { label: "See your referrals", url: `${context.webUrl}${SIGNUP_REFERRALS_SCREEN_PATH}` },
			}),
		},
	},
});

const LegacyNoticePayloadSchema = z.object({ title: z.string().min(1).max(200), body: z.string().max(4_000), link: z.string().max(500).nullable() }).strict();
type LegacyNoticePayload = z.output<typeof LegacyNoticePayloadSchema>;

/** A reward inbox row carried over from `RewardNotification` (ADR 070): in-app only, its words kept as they were. */
export const LEGACY_REWARD_NOTICE: TypedNotificationType<LegacyNoticePayload> = defineNotificationType({
	key: "rewards.legacy",
	description: "A reward notice from the earlier inbox",
	category: "TRANSACTIONAL",
	surfaces: ["CUSTOMER", "MERCHANT"],
	channels: ["IN_APP"],
	urgency: "normal",
	sensitive: false,
	allowsContactRecipient: false,
	digestible: false,
	grouping: null,
	payloadSchema: LegacyNoticePayloadSchema,
	toJson: (payload: LegacyNoticePayload): JsonObject => ({ ...payload }),
	samplePayload: { title: "Reward approved", body: '"Weekend 2-for-1" is now live in the marketplace.', link: null },
	renderers: { en: { inApp: (payload) => ({ title: payload.title, body: payload.body, link: payload.link, icon: "gift" }) } },
});
