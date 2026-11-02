import type { NotificationPreferenceCell } from "@workspace/shared";

import { CHANNEL_ICONS, channelNoteOf } from "../settings-model";

function cell(overrides: Partial<NotificationPreferenceCell> = {}): NotificationPreferenceCell {
	return { channel: "IN_APP", enabled: true, locked: false, available: true, reason: null, ...overrides };
}

describe("the notification settings model", () => {
	it("says why a channel is kept on, per kind, and what to do for one not available", () => {
		expect(channelNoteOf("SECURITY", cell({ locked: true }))).toBe("Always on, to keep your account safe");
		expect(channelNoteOf("OPERATIONS", cell({ locked: true }))).toBe("Always on, so outages reach you at once");
		expect(channelNoteOf("ACCOUNT", cell({ locked: true }))).toBe("Always on");
		expect(channelNoteOf("MARKETING", cell({ channel: "PUSH", available: false, reason: "no-push-device" }))).toBe("Turn on notifications on this phone first");
		expect(channelNoteOf("MARKETING", cell({ available: false, reason: null }))).toBeNull();
		expect(channelNoteOf("MARKETING", cell())).toBeNull();
		expect(channelNoteOf("MARKETING", cell({ enabled: false }))).toBeNull();
	});

	it("gives every channel its own symbol", () => {
		expect(new Set(Object.values(CHANNEL_ICONS)).size).toBe(Object.keys(CHANNEL_ICONS).length);
	});
});
