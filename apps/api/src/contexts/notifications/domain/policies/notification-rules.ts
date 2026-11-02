// ============================================
// notifications/domain/policies/notification-rules.ts — the rules every fan-out applies (ADR 070)
// ============================================

import type { NotificationCategory, NotificationChannel } from "@workspace/shared";

/** Channels a category is always sent on, whatever the person's preferences say. */
export function mandatoryChannels(category: NotificationCategory): readonly NotificationChannel[] {
	switch (category) {
		case "SECURITY":
			return ["IN_APP", "EMAIL"];
		// An outage reaches the people who run the platform at once: in the admin panel and on their phone.
		case "OPERATIONS":
			return ["IN_APP", "PUSH"];
		case "ACCOUNT":
		case "TRANSACTIONAL":
		case "PRODUCT":
		case "MARKETING":
			return [];
	}
}

/** A new person's defaults: product updates in-app only, marketing nowhere (needs consent), the rest everywhere. */
export function defaultChannelEnabled(category: NotificationCategory, channel: NotificationChannel): boolean {
	switch (category) {
		case "MARKETING":
			return false;
		case "PRODUCT":
			return channel === "IN_APP";
		case "SECURITY":
		case "ACCOUNT":
		case "TRANSACTIONAL":
		case "OPERATIONS":
			return true;
	}
}

/** One stored preference row: `tenantKey` is `platform` or a tenant id. */
export interface StoredPreference {
	readonly tenantKey: string;
	readonly category: NotificationCategory;
	readonly channel: NotificationChannel;
	readonly enabled: boolean;
}

export const PLATFORM_PREFERENCE_KEY = "platform";

/** Tenant override → platform preference → catalog default → mandatory lock (the lock always wins). */
export function resolveChannelEnabled(
	preferences: readonly StoredPreference[],
	tenantId: string | null,
	category: NotificationCategory,
	channel: NotificationChannel,
): boolean {
	if (mandatoryChannels(category).includes(channel)) {
		return true;
	}
	const find = (tenantKey: string): StoredPreference | undefined =>
		preferences.find((preference: StoredPreference): boolean => preference.tenantKey === tenantKey && preference.category === category && preference.channel === channel);
	const tenantOverride = tenantId === null ? undefined : find(tenantId);
	if (tenantOverride !== undefined) {
		return tenantOverride.enabled;
	}
	return find(PLATFORM_PREFERENCE_KEY)?.enabled ?? defaultChannelEnabled(category, channel);
}

/** Channels quiet hours hold back: the ones that interrupt (an email waits in the inbox anyway). */
export function isInterruptive(channel: NotificationChannel): boolean {
	return channel === "PUSH" || channel === "SMS";
}
