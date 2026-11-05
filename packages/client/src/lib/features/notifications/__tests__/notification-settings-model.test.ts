import type { NotificationPreferenceCell } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { NOTIFICATION_SETTINGS_LABELS } from "../notification-settings-labels";
import { channelNoteOf } from "../notification-settings-model";

function cell(overrides: Partial<NotificationPreferenceCell> = {}): NotificationPreferenceCell {
	return { channel: "IN_APP", enabled: true, locked: false, available: true, reason: null, ...overrides };
}

describe("the notification settings model", () => {
	it("gives every channel a subtitle: why it is kept on, what to do for one not available, or what the channel is", () => {
		expect(channelNoteOf("SECURITY", cell({ locked: true }), NOTIFICATION_SETTINGS_LABELS)).toBe("Always on, to keep your account safe");
		expect(channelNoteOf("OPERATIONS", cell({ locked: true }), NOTIFICATION_SETTINGS_LABELS)).toBe("Always on, so outages reach you at once");
		expect(channelNoteOf("MARKETING", cell({ channel: "SMS", available: false, reason: "phone-unverified" }), NOTIFICATION_SETTINGS_LABELS)).toBe(
			"Add and verify your phone number first",
		);
		expect(channelNoteOf("MARKETING", cell({ available: false, reason: null }), NOTIFICATION_SETTINGS_LABELS)).toBe("In the bell, in every app you use");
		expect(channelNoteOf("MARKETING", cell(), NOTIFICATION_SETTINGS_LABELS)).toBe("In the bell, in every app you use");
		expect(channelNoteOf("MARKETING", cell({ channel: "EMAIL", enabled: false }), NOTIFICATION_SETTINGS_LABELS)).toBe("To your sign-in email address");
	});
});
