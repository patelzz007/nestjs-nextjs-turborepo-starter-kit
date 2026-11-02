import type { NotificationCategory, NotificationChannel } from "@workspace/shared";
import type { IconTileTone } from "@workspace/ui/components/icon-tile";
import { Bell, Mail, Megaphone, MessageSquare, ShieldAlert, Siren, Smartphone, Sparkles, Ticket, UserRound, type LucideIcon } from "lucide-react";

/** A kind of message's look: its glyph in its colour (the icon tiles' tones, rules/07), the same as the phone app's. */
export interface NotificationKindLook {
	readonly icon: LucideIcon;
	readonly tone: IconTileTone;
}

export const NOTIFICATION_KIND_LOOKS: Readonly<Record<NotificationCategory, NotificationKindLook>> = {
	SECURITY: { icon: ShieldAlert, tone: "red" },
	ACCOUNT: { icon: UserRound, tone: "violet" },
	TRANSACTIONAL: { icon: Ticket, tone: "green" },
	PRODUCT: { icon: Sparkles, tone: "blue" },
	MARKETING: { icon: Megaphone, tone: "orange" },
	OPERATIONS: { icon: Siren, tone: "yellow" },
};

export const NOTIFICATION_CHANNEL_ICONS: Readonly<Record<NotificationChannel, LucideIcon>> = {
	IN_APP: Bell,
	EMAIL: Mail,
	PUSH: Smartphone,
	SMS: MessageSquare,
};
