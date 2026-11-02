import { NotificationChannelSchema, type NotificationCategory } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { defaultChannelEnabled, isInterruptive, mandatoryChannels, PLATFORM_PREFERENCE_KEY, resolveChannelEnabled, type StoredPreference } from "../notification-rules";

const TENANT = "0193f2c4-0000-7000-8000-0000000000c1";

describe("mandatoryChannels", () => {
	it("always sends security notices in-app and by email, and operations alerts in-app and to the phone", () => {
		expect(mandatoryChannels("SECURITY")).toEqual(["IN_APP", "EMAIL"]);
		expect(mandatoryChannels("OPERATIONS")).toEqual(["IN_APP", "PUSH"]);
	});

	it("locks nothing for the other kinds", () => {
		const switchable: readonly NotificationCategory[] = ["ACCOUNT", "TRANSACTIONAL", "PRODUCT", "MARKETING"];
		for (const category of switchable) {
			expect(mandatoryChannels(category)).toEqual([]);
		}
	});
});

describe("defaultChannelEnabled", () => {
	it("starts a new person with every channel of an operations alert on", () => {
		for (const channel of NotificationChannelSchema.options) {
			expect(defaultChannelEnabled("OPERATIONS", channel)).toBe(true);
		}
	});

	it("keeps product news in the app and marketing nowhere until consent", () => {
		expect(defaultChannelEnabled("PRODUCT", "IN_APP")).toBe(true);
		expect(defaultChannelEnabled("PRODUCT", "EMAIL")).toBe(false);
		expect(defaultChannelEnabled("MARKETING", "IN_APP")).toBe(false);
	});
});

describe("resolveChannelEnabled", () => {
	const off = (category: StoredPreference["category"], channel: StoredPreference["channel"], tenantKey = PLATFORM_PREFERENCE_KEY): StoredPreference => ({
		tenantKey,
		category,
		channel,
		enabled: false,
	});

	it("keeps an always-on channel on, whatever was stored", () => {
		expect(resolveChannelEnabled([off("OPERATIONS", "PUSH")], null, "OPERATIONS", "PUSH")).toBe(true);
		expect(resolveChannelEnabled([off("OPERATIONS", "IN_APP")], null, "OPERATIONS", "IN_APP")).toBe(true);
	});

	it("lets the person turn an operations alert's email off", () => {
		expect(resolveChannelEnabled([off("OPERATIONS", "EMAIL")], null, "OPERATIONS", "EMAIL")).toBe(false);
	});

	it("prefers a tenant's own choice to the platform's", () => {
		const preferences: readonly StoredPreference[] = [off("ACCOUNT", "EMAIL"), { tenantKey: TENANT, category: "ACCOUNT", channel: "EMAIL", enabled: true }];
		expect(resolveChannelEnabled(preferences, TENANT, "ACCOUNT", "EMAIL")).toBe(true);
		expect(resolveChannelEnabled(preferences, null, "ACCOUNT", "EMAIL")).toBe(false);
	});
});

describe("isInterruptive", () => {
	it("holds back only what buzzes", () => {
		expect(isInterruptive("PUSH")).toBe(true);
		expect(isInterruptive("SMS")).toBe(true);
		expect(isInterruptive("EMAIL")).toBe(false);
		expect(isInterruptive("IN_APP")).toBe(false);
	});
});
