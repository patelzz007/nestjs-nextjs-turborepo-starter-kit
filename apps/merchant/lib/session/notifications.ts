import { z } from "zod";

export const MerchantNotificationItemSchema = z
	.object({
		id: z.string().min(1),
		title: z.string().min(1),
		message: z.string().min(1),
		time: z.string().min(1),
		read: z.boolean(),
	})
	.strict();

export type MerchantNotificationItem = z.output<typeof MerchantNotificationItemSchema>;

export const MerchantNotificationsDataSchema = z
	.object({
		notifications: z.array(MerchantNotificationItemSchema),
	})
	.strict();

export type MerchantNotificationsData = z.output<typeof MerchantNotificationsDataSchema>;

const notificationsDataJson = {
	notifications: [
		{
			id: "1",
			title: "Reward approved",
			message: "Your 20% Off First Order reward is now live.",
			time: "2 hours ago",
			read: false,
		},
		{
			id: "2",
			title: "New redemption",
			message: "A customer redeemed Free Coffee at your store.",
			time: "5 hours ago",
			read: false,
		},
		{
			id: "3",
			title: "Inventory low",
			message: "Summer Promo has fewer than 10 rewards remaining.",
			time: "Yesterday",
			read: true,
		},
		{
			id: "4",
			title: "Weekly summary",
			message: "You had 24 claims and 18 redemptions this week.",
			time: "2 days ago",
			read: true,
		},
	],
};

export const MERCHANT_NOTIFICATIONS_DATA: MerchantNotificationsData = MerchantNotificationsDataSchema.parse(notificationsDataJson);
