import { preferenceCellStateOf, type NotificationCategory, type NotificationPreferenceCell } from "@workspace/shared";

import type { NotificationSettingsLabels } from "./notification-settings-labels";

/** The line under a channel's checkbox: why it is kept on or not available; nothing for an ordinary one. */
export function channelNoteOf(category: NotificationCategory, cell: NotificationPreferenceCell, labels: NotificationSettingsLabels): string | null {
	switch (preferenceCellStateOf(cell)) {
		case "locked":
			return labels.locked[category];
		case "unavailable":
			return cell.reason === null ? null : labels.unavailable[cell.reason];
		case "on":
		case "off":
			return null;
	}
}
