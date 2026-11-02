import { describe, expect, it } from "vitest";

import {
	isKindSwitchable,
	isPreferenceCellOn,
	kindChannelChangesOf,
	kindCheckStateOf,
	preferenceCellStateOf,
	shownPreferenceCellsOf,
	type NotificationPreferenceCell,
	type NotificationPreferenceRow,
} from "../notifications";

function cell(overrides: Partial<NotificationPreferenceCell> = {}): NotificationPreferenceCell {
	return { channel: "IN_APP", enabled: true, locked: false, available: true, reason: null, ...overrides };
}

describe("notification preference cells", () => {
	it("tells on, off, kept on and not available apart", () => {
		expect(preferenceCellStateOf(cell())).toBe("on");
		expect(preferenceCellStateOf(cell({ enabled: false }))).toBe("off");
		expect(preferenceCellStateOf(cell({ locked: true, available: false }))).toBe("locked");
		expect(preferenceCellStateOf(cell({ available: false, reason: "no-push-device" }))).toBe("unavailable");
	});

	it("counts a channel on only when it reaches the person", () => {
		expect(isPreferenceCellOn(cell())).toBe(true);
		expect(isPreferenceCellOn(cell({ locked: true, enabled: false }))).toBe(true);
		expect(isPreferenceCellOn(cell({ available: false, reason: "phone-unverified" }))).toBe(false);
		expect(isPreferenceCellOn(cell({ enabled: false }))).toBe(false);
	});

	it("leaves out the channels a kind is never sent on", () => {
		const row: NotificationPreferenceRow = { category: "PRODUCT", channels: [cell(), cell({ channel: "SMS", available: false, reason: "not-offered" })] };
		expect(shownPreferenceCellsOf(row).map((shown) => shown.channel)).toEqual(["IN_APP"]);
	});
	it("checks a kind fully only when every channel that can reach the person is on", () => {
		const kept = cell({ locked: true });
		const noPhone = cell({ channel: "PUSH", enabled: false, available: false, reason: "no-push-device" });
		const notOffered = cell({ channel: "SMS", enabled: false, available: false, reason: "not-offered" });
		expect(kindCheckStateOf({ category: "SECURITY", channels: [kept, cell({ channel: "EMAIL" }), noPhone, notOffered] })).toBe("all");
		expect(kindCheckStateOf({ category: "PRODUCT", channels: [cell(), cell({ channel: "EMAIL", enabled: false })] })).toBe("some");
		expect(kindCheckStateOf({ category: "PRODUCT", channels: [cell({ enabled: false }), noPhone] })).toBe("none");
		expect(kindCheckStateOf({ category: "PRODUCT", channels: [noPhone, notOffered] })).toBe("none");
	});

	it("changes only the channels the person can switch and that are not already as asked", () => {
		const row: NotificationPreferenceRow = {
			category: "ACCOUNT",
			channels: [
				cell({ locked: true }),
				cell({ channel: "EMAIL" }),
				cell({ channel: "PUSH", enabled: false }),
				cell({ channel: "SMS", enabled: false, available: false, reason: "phone-unverified" }),
			],
		};
		expect(kindChannelChangesOf(row, true)).toEqual(["PUSH"]);
		expect(kindChannelChangesOf(row, false)).toEqual(["EMAIL"]);
	});

	it("lets a kind's checkbox change something only when one of its channels is switchable", () => {
		expect(isKindSwitchable({ category: "SECURITY", channels: [cell({ locked: true }), cell({ channel: "PUSH", available: false, reason: "no-push-device" })] })).toBe(false);
		expect(isKindSwitchable({ category: "ACCOUNT", channels: [cell({ locked: true }), cell({ channel: "EMAIL", enabled: false })] })).toBe(true);
		expect(isKindSwitchable({ category: "PRODUCT", channels: [cell({ channel: "SMS", reason: "not-offered" })] })).toBe(false);
	});
});
