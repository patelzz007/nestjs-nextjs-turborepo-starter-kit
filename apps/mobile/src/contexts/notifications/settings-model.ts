// The notification settings' model (ADR 070): the symbol of each channel, and why a channel's
// checkbox is kept on or not available. Pure, so the screen only lays it out.

import { preferenceCellStateOf, type NotificationCategory, type NotificationChannel, type NotificationPreferenceCell } from "@workspace/shared";
import type { LucideIcon } from "@workspace/ui-native/components/icon";
import BellIcon from "lucide-react-native/icons/bell";
import MailIcon from "lucide-react-native/icons/mail";
import MessageSquareIcon from "lucide-react-native/icons/message-square";
import SmartphoneIcon from "lucide-react-native/icons/smartphone";

import { LOCKED_LABELS, UNAVAILABLE_LABELS } from "./labels";

export const CHANNEL_ICONS: Readonly<Record<NotificationChannel, LucideIcon>> = {
	IN_APP: BellIcon,
	EMAIL: MailIcon,
	PUSH: SmartphoneIcon,
	SMS: MessageSquareIcon,
};

/** The line under a channel's checkbox: why it is kept on or not available; nothing for an ordinary one. */
export function channelNoteOf(category: NotificationCategory, cell: NotificationPreferenceCell): string | null {
	switch (preferenceCellStateOf(cell)) {
		case "locked":
			return LOCKED_LABELS[category];
		case "unavailable":
			return cell.reason === null ? null : UNAVAILABLE_LABELS[cell.reason];
		case "on":
		case "off":
			return null;
	}
}
