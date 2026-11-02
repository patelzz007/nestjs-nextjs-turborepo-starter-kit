// The platform broadcast composer's model (ADR 073): who a notice from platform staff goes to — people by
// the app they use (customers, merchant staff, platform staff), narrowed by when they signed up and, for
// merchant staff, by their store's state — what kind of notice it is, and how that and the shared message
// fields map to the API's draft. A notice to everyone, unnarrowed, waits for a second person's approval.

import type { BroadcastMessageValues } from "@workspace/client/lib/features/broadcasts/broadcast-composer-form";
import {
	BROADCAST_CHANNEL_OPTIONS,
	BROADCAST_DEFAULT_SEND_TIME,
	broadcastScheduleValuesOf,
	buildBroadcastDraft,
	wallClockOf,
	type BroadcastDraftResult,
} from "@workspace/client/lib/features/broadcasts/broadcast-draft";
import {
	epochMs,
	instantOfWallClock,
	PlatformBroadcastAudienceSchema,
	PlatformBroadcastCategorySchema,
	type BroadcastResponse,
	type PlatformBroadcastAudience,
} from "@workspace/shared";
import { z } from "zod";

/** The apps a notice can reach, in the order the composer lists them. */
export const PlatformSurfaceSchema = PlatformBroadcastAudienceSchema.shape.surfaces.element;
export type PlatformSurface = z.output<typeof PlatformSurfaceSchema>;

export type PlatformBroadcastCategory = z.output<typeof PlatformBroadcastCategorySchema>;

/** Which merchant staff: of every store, of active stores only, or of restricted ones only. */
export const PlatformTenantStatesFilterSchema = z.enum(["any", "active", "restricted"]);
export type PlatformTenantStatesFilter = z.output<typeof PlatformTenantStatesFilterSchema>;

export const PLATFORM_SURFACE_LABELS: Readonly<Record<PlatformSurface, { readonly label: string; readonly hint: string }>> = {
	CUSTOMER: { label: "Customers", hint: "The web app and the phone app." },
	MERCHANT: { label: "Merchant staff", hint: "Everyone on a store's team, in the merchant portal." },
	ADMIN: { label: "Platform staff", hint: "Everyone who uses this admin panel." },
};

export const PLATFORM_CATEGORY_LABELS: Readonly<Record<PlatformBroadcastCategory, { readonly label: string; readonly hint: string }>> = {
	PRODUCT: { label: "Product news", hint: "New features and planned maintenance. People can turn these off." },
	ACCOUNT: { label: "Account notice", hint: "Something about their account or the terms they agreed to." },
};

export const PLATFORM_TENANT_STATES_LABELS: Readonly<Record<PlatformTenantStatesFilter, string>> = {
	any: "Every store",
	active: "Active stores only",
	restricted: "Restricted stores only",
};

/** What the composer holds while staff write: the shared message fields, and the platform audience. */
export interface PlatformBroadcastValues extends BroadcastMessageValues {
	readonly category: PlatformBroadcastCategory;
	readonly surfaces: readonly PlatformSurface[];
	/** `yyyy-MM-dd`: only people who signed up on or after it; "" for everyone. */
	readonly signedUpAfter: string;
	readonly tenantStates: PlatformTenantStatesFilter;
}

/** A new notice: product news to customers, in the app and by email, sent when scheduled. */
export function emptyPlatformBroadcastValues(today: string): PlatformBroadcastValues {
	return {
		title: "",
		body: null,
		category: "PRODUCT",
		surfaces: ["CUSTOMER"],
		signedUpAfter: "",
		tenantStates: "any",
		channels: BROADCAST_CHANNEL_OPTIONS,
		timing: "now",
		sendDate: today,
		sendTime: BROADCAST_DEFAULT_SEND_TIME,
	};
}

const START_OF_DAY = "00:00";

/** The audience the API receives. A store filter means something only while merchant staff are in it. */
export function toPlatformAudience(values: Pick<PlatformBroadcastValues, "surfaces" | "signedUpAfter" | "tenantStates">, senderTimeZone: string): PlatformBroadcastAudience {
	const dayStart = values.signedUpAfter === "" ? null : wallClockOf(values.signedUpAfter, START_OF_DAY);
	const filtersStores = values.surfaces.includes("MERCHANT") && values.tenantStates !== "any";
	return {
		kind: "platform-users",
		surfaces: PlatformSurfaceSchema.options.filter((surface) => values.surfaces.includes(surface)),
		signedUpAfter: dayStart === null ? null : epochMs(instantOfWallClock(dayStart, senderTimeZone)),
		tenantStates: filtersStores ? [values.tenantStates === "active" ? "ACTIVE" : "RESTRICTED"] : null,
	};
}

/** Whether the notice reaches every user unnarrowed: then a second staff member must approve it (the API's rule). */
export function needsSecondApproval(audience: PlatformBroadcastAudience): boolean {
	return audience.surfaces.length === PlatformSurfaceSchema.options.length && audience.signedUpAfter === null && audience.tenantStates === null;
}

/** The draft the API receives, or what is still missing in the sender's words. */
export function toPlatformBroadcastDraft(values: PlatformBroadcastValues, senderTimeZone: string, now: number): BroadcastDraftResult {
	return buildBroadcastDraft(
		{
			title: values.title,
			body: values.body,
			channels: values.channels,
			schedule: values,
			audience: toPlatformAudience(values, senderTimeZone),
			category: values.category,
			audienceProblem: values.surfaces.length === 0 ? "Choose at least one group of people." : null,
		},
		senderTimeZone,
		now,
	);
}

const ISO_DATE_LENGTH = "yyyy-MM-dd".length;

/** A day as the sender's wall clock reads it (`yyyy-MM-dd`). */
function dayInZone(instant: number, timeZone: string): string {
	return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant).slice(0, ISO_DATE_LENGTH);
}

/** A saved platform notice back in the composer (editing a draft). */
export function platformBroadcastValuesOf(broadcast: BroadcastResponse, senderTimeZone: string, today: string): PlatformBroadcastValues {
	const base = emptyPlatformBroadcastValues(today);
	const audience = broadcast.audience.kind === "platform-users" ? broadcast.audience : null;
	const category = PlatformBroadcastCategorySchema.safeParse(broadcast.category);
	const states = audience?.tenantStates ?? null;
	const signedUpAfter = audience?.signedUpAfter ?? null;
	return {
		...base,
		title: broadcast.title,
		body: broadcast.body,
		category: category.success ? category.data : base.category,
		surfaces: audience?.surfaces ?? base.surfaces,
		signedUpAfter: signedUpAfter === null ? "" : dayInZone(signedUpAfter, senderTimeZone),
		tenantStates: states === null ? "any" : states.includes("ACTIVE") ? "active" : "restricted",
		channels: broadcast.channels,
		...broadcastScheduleValuesOf(broadcast, senderTimeZone, base),
	};
}
