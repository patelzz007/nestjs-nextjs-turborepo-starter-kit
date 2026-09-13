import { z } from "zod";

import rawNotificationData from "@/data/notification-data.json";

/**
 * Zod schema for a single notification entry in the topbar bell dropdown.
 *
 * The type is derived with `z.infer` (rule 5) — no hand-written interface, so
 * the type and the schema can never drift apart.
 */
export const NotificationItemSchema = z
	.object({
		id: z.string().min(1),
		title: z.string().min(1),
		message: z.string().min(1),
		time: z.string().min(1),
		read: z.boolean(),
	})
	.strict();

/** Root shape of `data/notification-data.json`. */
export const NotificationsDataSchema = z
	.object({
		notifications: z.array(NotificationItemSchema),
	})
	.strict();

export type NotificationItem = z.infer<typeof NotificationItemSchema>;

/**
 * The notification list, **parsed** (not just typed) at module load. Parsing
 * guarantees the JSON file can never drift from the schema — if someone adds a
 * malformed entry, this module throws a loud Zod error on startup (rule 13).
 */
export const notificationsData = NotificationsDataSchema.parse(rawNotificationData);
