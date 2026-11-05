// The notification settings' model (ADR 070): the symbol of each channel, and the subtitle
// under each channel's checkbox. Pure, so the screen only lays it out.

import { preferenceCellStateOf, type NotificationCategory, type NotificationChannel, type NotificationPreferenceCell } from "@workspace/shared";
import type { LucideIcon } from "@workspace/ui-native/components/icon";
import BellIcon from "lucide-react-native/icons/bell";
import MailIcon from "lucide-react-native/icons/mail";
import MessageSquareIcon from "lucide-react-native/icons/message-square";
import SmartphoneIcon from "lucide-react-native/icons/smartphone";

import { CHANNEL_DESCRIPTIONS, LOCKED_LABELS, UNAVAILABLE_LABELS } from "./labels";

export const CHANNEL_ICONS: Readonly<Record<NotificationChannel, LucideIcon>> = {
	IN_APP: BellIcon,
	EMAIL: MailIcon,
	PUSH: SmartphoneIcon,
	SMS: MessageSquareIcon,
};

/**
 * The subtitle under a channel's checkbox, never empty: why it is kept on, what to do to have it, or (for an
 * ordinary channel, or one unavailable for no stated reason) what the channel is.
 */
export function channelNoteOf(category: NotificationCategory, cell: NotificationPreferenceCell): string {
	switch (preferenceCellStateOf(cell)) {
		case "locked":
			return LOCKED_LABELS[category];
		case "unavailable":
			return cell.reason === null ? CHANNEL_DESCRIPTIONS[cell.channel] : UNAVAILABLE_LABELS[cell.reason];
		case "on":
		case "off":
			return CHANNEL_DESCRIPTIONS[cell.channel];
	}
}
