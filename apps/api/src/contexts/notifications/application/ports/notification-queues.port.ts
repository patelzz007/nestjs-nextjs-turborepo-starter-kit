import type { NotificationChannel } from "@workspace/shared";
import { z } from "zod";

/** `broadcasts.send` job: one broadcast to start sending (ADR 073). */
export const BroadcastSendJobSchema = z.object({ broadcastId: z.uuid() }).strict();
export type BroadcastSendJob = z.output<typeof BroadcastSendJobSchema>;

export const NotificationFanOutJobSchema = z.object({ notificationId: z.uuid() }).strict();
export type NotificationFanOutJob = z.output<typeof NotificationFanOutJobSchema>;
export const NotificationChannelJobSchema = z.object({ deliveryId: z.uuid() }).strict();
export type NotificationChannelJob = z.output<typeof NotificationChannelJobSchema>;

/**
 * Hands work to the notification queues after commit (ADR 070): BullMQ when Redis is configured
 * (jobId = the row id, so a repeat is a no-op), otherwise in this process right away.
 */
export interface NotificationQueues {
	fanOut(notificationId: string): Promise<void>;
	deliver(channel: Extract<NotificationChannel, "PUSH" | "SMS">, deliveryId: string): Promise<void>;
}

export const NOTIFICATION_QUEUES = Symbol("NOTIFICATION_QUEUES");
