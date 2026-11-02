// The merchant broadcast composer's model (ADR 073): who a store's broadcast goes to (its own customers,
// all or picked), and how that and the shared message fields map to the API's draft
// (`BroadcastDraftSchema`, the server re-validates everything). The parts every composer shares — the
// send time, the body, the channels and the status words — live in `@workspace/client`'s broadcasts.

import {
	BROADCAST_CHANNEL_OPTIONS,
	BROADCAST_DEFAULT_SEND_TIME,
	broadcastScheduleValuesOf,
	buildBroadcastDraft,
	type BroadcastDraftResult,
} from "@workspace/client/lib/features/broadcasts/broadcast-draft";
import type { BroadcastMessageValues } from "@workspace/client/lib/features/broadcasts/broadcast-composer-form";
import { BROADCAST_CLAIMED_WITHIN_DEFAULT_DAYS, type BroadcastResponse, type TenantBroadcastAudience, type TenantCustomerUnreachableReason } from "@workspace/shared";
import { z } from "zod";

/** Who the broadcast goes to: every customer the filters match, or the people the merchant picked. */
export const BroadcastRecipientsModeSchema = z.enum(["all-customers", "chosen-customers"]);
export type BroadcastRecipientsMode = z.output<typeof BroadcastRecipientsModeSchema>;

/** Whether the customers redeemed what they claimed (the audience filter). */
export const BroadcastRedeemedFilterSchema = z.enum(["any", "redeemed", "not-redeemed"]);
export type BroadcastRedeemedFilter = z.output<typeof BroadcastRedeemedFilterSchema>;

/** What the composer holds while the merchant writes: the shared message fields, and the store's audience. */
export interface BroadcastComposerValues extends BroadcastMessageValues {
	readonly recipients: BroadcastRecipientsMode;
	readonly claimedWithinDays: number;
	readonly redeemed: BroadcastRedeemedFilter;
	readonly customerIds: readonly string[];
}

/** A new broadcast: every customer seen in the last 60 days, every channel, sent when scheduled. */
export function emptyBroadcastComposerValues(today: string): BroadcastComposerValues {
	return {
		title: "",
		body: null,
		recipients: "all-customers",
		claimedWithinDays: BROADCAST_CLAIMED_WITHIN_DEFAULT_DAYS,
		redeemed: "any",
		customerIds: [],
		channels: BROADCAST_CHANNEL_OPTIONS,
		timing: "now",
		sendDate: today,
		sendTime: BROADCAST_DEFAULT_SEND_TIME,
	};
}

/** The audience the API receives: the filters, and the picked people only when the merchant picked. */
export function toBroadcastAudience(values: Pick<BroadcastComposerValues, "recipients" | "claimedWithinDays" | "redeemed" | "customerIds">): TenantBroadcastAudience {
	return {
		kind: "tenant-customers",
		claimedWithinDays: values.claimedWithinDays,
		redeemed: values.redeemed,
		locationId: null,
		customerIds: values.recipients === "chosen-customers" && values.customerIds.length > 0 ? [...values.customerIds] : null,
	};
}

/** The draft the API receives (a store's broadcast is marketing), or what is still missing in the merchant's words. */
export function toBroadcastDraft(values: BroadcastComposerValues, storeTimeZone: string, now: number): BroadcastDraftResult {
	return buildBroadcastDraft(
		{
			title: values.title,
			body: values.body,
			channels: values.channels,
			schedule: values,
			audience: toBroadcastAudience(values),
			category: "MARKETING",
			audienceProblem: values.recipients === "chosen-customers" && values.customerIds.length === 0 ? "Pick at least one customer, or send it to all your customers." : null,
		},
		storeTimeZone,
		now,
	);
}

/** A saved broadcast back in the composer (editing a draft). */
export function broadcastComposerValuesOf(broadcast: BroadcastResponse, storeTimeZone: string, today: string): BroadcastComposerValues {
	const audience = broadcast.audience.kind === "tenant-customers" ? broadcast.audience : null;
	const customerIds = audience?.customerIds ?? [];
	const base = emptyBroadcastComposerValues(today);
	return {
		...base,
		title: broadcast.title,
		body: broadcast.body,
		recipients: customerIds.length > 0 ? "chosen-customers" : "all-customers",
		claimedWithinDays: audience?.claimedWithinDays ?? base.claimedWithinDays,
		redeemed: audience?.redeemed ?? base.redeemed,
		customerIds,
		channels: broadcast.channels,
		...broadcastScheduleValuesOf(broadcast, storeTimeZone, base),
	};
}

export const UNREACHABLE_REASON_LABELS: Readonly<Record<TenantCustomerUnreachableReason, string>> = {
	"no-consent": "Opted out",
	banned: "Banned",
	left: "Left your store",
	staff: "Your team",
};
