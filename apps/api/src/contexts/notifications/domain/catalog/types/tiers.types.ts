import { APP_LINKS, CUSTOMER_TIER_LABELS, CustomerTierSchema, PLATFORM_DISPLAY_REGION, type CustomerTier, type JsonObject } from "@workspace/shared";
import { z } from "zod";

import { defineNotificationType, type TypedNotificationType } from "../notification-type";

// Customer tiers (ADR 085): a promotion and a demotion warning reach the customer by push and in the inbox; the
// demotion itself only in the inbox (they were warned already).

const TIER_NAMES: Readonly<Record<CustomerTier, string>> = CUSTOMER_TIER_LABELS;

/** "12 Dec 2026", in the platform's own region (the stores' wall-clock date). */
function dayOf(epoch: number): string {
	return new Intl.DateTimeFormat(PLATFORM_DISPLAY_REGION.locale, { day: "numeric", month: "short", year: "numeric", timeZone: PLATFORM_DISPLAY_REGION.timeZone }).format(
		epoch,
	);
}

function redemptionsPhrase(count: number): string {
	return count === 1 ? "1 more reward" : `${String(count)} more rewards`;
}

const TierPromotedPayloadSchema = z.object({ fromTier: CustomerTierSchema, toTier: CustomerTierSchema, holdUntil: z.number().int().nonnegative() }).strict();
type TierPromotedPayload = z.output<typeof TierPromotedPayloadSchema>;

/** The customer reached a higher tier. */
export const TIER_PROMOTED_NOTIFICATION: TypedNotificationType<TierPromotedPayload> = defineNotificationType({
	key: "tiers.promoted",
	description: "The customer reached a higher tier",
	category: "ACCOUNT",
	surfaces: ["CUSTOMER"],
	channels: ["IN_APP", "PUSH"],
	urgency: "normal",
	sensitive: false,
	allowsContactRecipient: false,
	digestible: false,
	grouping: null,
	payloadSchema: TierPromotedPayloadSchema,
	toJson: (payload: TierPromotedPayload): JsonObject => ({ ...payload }),
	samplePayload: { fromTier: "SILVER", toTier: "GOLD", holdUntil: 1_802_000_000_000 },
	renderers: {
		en: {
			inApp: (payload) => ({
				title: `You're now ${TIER_NAMES[payload.toTier]}!`,
				body: `Your redemptions moved you up from ${TIER_NAMES[payload.fromTier]}. ${TIER_NAMES[payload.toTier]} rewards are open to you, and your tier is yours until at least ${dayOf(payload.holdUntil)}.`,
				link: APP_LINKS.web.tier,
				icon: "award",
			}),
			push: (payload) => ({
				title: `You're now ${TIER_NAMES[payload.toTier]}!`,
				body: `${TIER_NAMES[payload.toTier]} rewards are open to you. Tap to see them.`,
				link: APP_LINKS.web.tier,
			}),
		},
	},
});

const TierDemotionWarningPayloadSchema = z
	.object({ currentTier: CustomerTierSchema, toTier: CustomerTierSchema, dueAt: z.number().int().nonnegative(), redemptionsToKeep: z.number().int().nonnegative() })
	.strict();
type TierDemotionWarningPayload = z.output<typeof TierDemotionWarningPayloadSchema>;

/** The customer's tier falls on a set day unless they redeem more. */
export const TIER_DEMOTION_WARNING_NOTIFICATION: TypedNotificationType<TierDemotionWarningPayload> = defineNotificationType({
	key: "tiers.demotion-warning",
	description: "The customer's tier falls soon unless they redeem more",
	category: "ACCOUNT",
	surfaces: ["CUSTOMER"],
	channels: ["IN_APP", "PUSH"],
	urgency: "normal",
	sensitive: false,
	allowsContactRecipient: false,
	digestible: false,
	grouping: null,
	payloadSchema: TierDemotionWarningPayloadSchema,
	toJson: (payload: TierDemotionWarningPayload): JsonObject => ({ ...payload }),
	samplePayload: { currentTier: "GOLD", toTier: "SILVER", dueAt: 1_802_000_000_000, redemptionsToKeep: 3 },
	renderers: {
		en: {
			inApp: (payload) => ({
				title: `Your ${TIER_NAMES[payload.currentTier]} ends on ${dayOf(payload.dueAt)}`,
				body: `Redeem ${redemptionsPhrase(payload.redemptionsToKeep)} before then to keep it, or you'll move to ${TIER_NAMES[payload.toTier]}.`,
				link: APP_LINKS.web.tier,
				icon: "alert",
			}),
			push: (payload) => ({
				title: `Your ${TIER_NAMES[payload.currentTier]} ends on ${dayOf(payload.dueAt)}`,
				body: `Redeem ${redemptionsPhrase(payload.redemptionsToKeep)} to keep it.`,
				link: APP_LINKS.web.tier,
			}),
		},
	},
});

const TierDemotedPayloadSchema = z.object({ fromTier: CustomerTierSchema, toTier: CustomerTierSchema }).strict();
type TierDemotedPayload = z.output<typeof TierDemotedPayloadSchema>;

/** The customer's tier fell (after a warning). In the inbox only. */
export const TIER_DEMOTED_NOTIFICATION: TypedNotificationType<TierDemotedPayload> = defineNotificationType({
	key: "tiers.demoted",
	description: "The customer's tier fell after a warning",
	category: "ACCOUNT",
	surfaces: ["CUSTOMER"],
	channels: ["IN_APP"],
	urgency: "normal",
	sensitive: false,
	allowsContactRecipient: false,
	digestible: false,
	grouping: null,
	payloadSchema: TierDemotedPayloadSchema,
	toJson: (payload: TierDemotedPayload): JsonObject => ({ ...payload }),
	samplePayload: { fromTier: "GOLD", toTier: "SILVER" },
	renderers: {
		en: {
			inApp: (payload) => ({
				title: `You're now ${TIER_NAMES[payload.toTier]}`,
				body: `Your ${TIER_NAMES[payload.fromTier]} tier ended. Redeem rewards to climb back up.`,
				link: APP_LINKS.web.tier,
				icon: "info",
			}),
		},
	},
});
