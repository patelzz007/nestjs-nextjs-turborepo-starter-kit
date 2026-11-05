import { describe, expect, it } from "vitest";

import { withMarketingConsent, withPreferenceChanges, withSchedule, type NotificationPreferencesResponse } from "../notifications";

const STORE = "0190f0e0-0000-7000-8000-000000000001";
const OTHER_STORE = "0190f0e0-0000-7000-8000-000000000002";

const PREFERENCES: NotificationPreferencesResponse = {
	tenantId: null,
	categories: [
		{
			category: "PRODUCT",
			channels: [
				{ channel: "EMAIL", enabled: true, locked: false, available: true, reason: null },
				{ channel: "PUSH", enabled: false, locked: false, available: true, reason: null },
			],
		},
		{ category: "SECURITY", channels: [{ channel: "EMAIL", enabled: true, locked: true, available: true, reason: null }] },
	],
	platformMarketingConsent: false,
	schedule: { quietHoursEnabled: false, quietStartMinute: 1320, quietEndMinute: 420, timeZone: "Asia/Kuala_Lumpur", digestFrequency: "OFF" },
	tenants: [
		{ tenantId: STORE, tenantName: "Kopi", marketingConsent: false, left: false },
		{ tenantId: OTHER_STORE, tenantName: "Roti", marketingConsent: true, left: false },
	],
};

describe("withPreferenceChanges", () => {
	it("changes exactly the cells the save names, and leaves the rest", () => {
		const next = withPreferenceChanges(PREFERENCES, { tenantId: null, changes: [{ category: "PRODUCT", channel: "PUSH", enabled: true }] });
		expect(next.categories.at(0)?.channels.map((cell) => [cell.channel, cell.enabled])).toEqual([
			["EMAIL", true],
			["PUSH", true],
		]);
		expect(next.categories.at(1)).toEqual(PREFERENCES.categories.at(1));
		expect(PREFERENCES.categories.at(0)?.channels.at(1)?.enabled).toBe(false);
	});

	it("keeps the identity of every row and cell the save did not change", () => {
		const next = withPreferenceChanges(PREFERENCES, { tenantId: null, changes: [{ category: "PRODUCT", channel: "PUSH", enabled: true }] });
		expect(next.categories.at(1)).toBe(PREFERENCES.categories.at(1));
		expect(next.categories.at(0)?.channels.at(0)).toBe(PREFERENCES.categories.at(0)?.channels.at(0));
		expect(next.categories.at(0)).not.toBe(PREFERENCES.categories.at(0));
		// A save that changes nothing (already so) keeps the whole row.
		const same = withPreferenceChanges(PREFERENCES, { tenantId: null, changes: [{ category: "PRODUCT", channel: "EMAIL", enabled: true }] });
		expect(same.categories.at(0)).toBe(PREFERENCES.categories.at(0));
	});
});

describe("withSchedule", () => {
	it("replaces the schedule only", () => {
		const schedule = { ...PREFERENCES.schedule, quietHoursEnabled: true };
		expect(withSchedule(PREFERENCES, schedule)).toEqual({ ...PREFERENCES, schedule });
	});
});

describe("withMarketingConsent", () => {
	it("sets the platform's consent, or one store's and no other", () => {
		expect(withMarketingConsent(PREFERENCES, { scope: "PLATFORM", tenantId: null, granted: true, wordingVersion: "v1", source: "SETTINGS" }).platformMarketingConsent).toBe(
			true,
		);
		const next = withMarketingConsent(PREFERENCES, { scope: "TENANT", tenantId: STORE, granted: true, wordingVersion: "v1", source: "SETTINGS" });
		expect(next.tenants.map((tenant) => tenant.marketingConsent)).toEqual([true, true]);
		expect(next.platformMarketingConsent).toBe(false);
	});
});
