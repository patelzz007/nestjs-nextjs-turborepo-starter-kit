import { z } from "zod";

export const WebNotificationItemSchema = z
	.object({
		id: z.string().min(1),
		title: z.string().min(1),
		message: z.string().min(1),
		time: z.string().min(1),
		read: z.boolean(),
	})
	.strict();

export type WebNotificationItem = z.output<typeof WebNotificationItemSchema>;

export const WebNotificationsDataSchema = z
	.object({
		notifications: z.array(WebNotificationItemSchema),
	})
	.strict();

export type WebNotificationsData = z.output<typeof WebNotificationsDataSchema>;

const notificationsDataJson = {
	notifications: [
		{
			id: "1",
			title: "Reward claimed",
			message: "Your free coffee reward is ready to redeem.",
			time: "1 hour ago",
			read: false,
		},
		{
			id: "2",
			title: "New offer nearby",
			message: "A cafe near you just published a weekend deal.",
			time: "3 hours ago",
			read: false,
		},
		{
			id: "3",
			title: "Claim expiring soon",
			message: "Your 20% off voucher expires in 2 days.",
			time: "Yesterday",
			read: true,
		},
		{
			id: "4",
			title: "Referral bonus",
			message: "Invite a friend to earn bonus points.",
			time: "2 days ago",
			read: true,
		},
	],
};

export const WEB_NOTIFICATIONS_DATA: WebNotificationsData = WebNotificationsDataSchema.parse(notificationsDataJson);
