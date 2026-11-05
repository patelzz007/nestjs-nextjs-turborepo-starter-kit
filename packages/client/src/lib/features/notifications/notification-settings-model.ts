import { preferenceCellStateOf, type NotificationCategory, type NotificationPreferenceCell } from "@workspace/shared";

import type { NotificationSettingsLabels } from "./notification-settings-labels";

/**
 * The subtitle under a channel's checkbox, never empty: why it is kept on, what to do to have it, or (for an
 * ordinary channel, or one unavailable for no stated reason) what the channel is.
 */
export function channelNoteOf(category: NotificationCategory, cell: NotificationPreferenceCell, labels: NotificationSettingsLabels): string {
	switch (preferenceCellStateOf(cell)) {
		case "locked":
			return labels.locked[category];
		case "unavailable":
			return cell.reason === null ? labels.channelDescriptions[cell.channel] : labels.unavailable[cell.reason];
		case "on":
		case "off":
			return labels.channelDescriptions[cell.channel];
	}
}
