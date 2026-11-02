// ============================================
// notifications/application/services/notification-dispatcher.ts — runs one fan-out, then hands off (ADR 070)
// ============================================

import type { InAppNotificationSignal } from "@workspace/shared";

import { systemActor } from "../../../../platform/application/actor-context";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import type { NotificationsScope } from "../notifications-scope";
import type { InAppSignalPort } from "../ports/in-app-signal.port";
import type { NotificationQueues } from "../ports/notification-queues.port";
import { NotificationFanOut, type FanOutDependencies } from "./notification-fan-out";

export const NOTIFICATIONS_FAN_OUT_OPERATION = "notifications.fan_out";

export type FanOutServices = Omit<FanOutDependencies, "store" | "emails">;

export class NotificationDispatcher {
	public constructor(
		private readonly uow: UnitOfWork<NotificationsScope>,
		private readonly services: FanOutServices,
		private readonly queues: NotificationQueues,
		private readonly signals: InAppSignalPort,
	) {}

	/** One notification → its deliveries, in one transaction; then push/SMS are queued and inboxes signalled. */
	public async fanOut(notificationId: string): Promise<void> {
		const actor = systemActor(NOTIFICATIONS_FAN_OUT_OPERATION, "job", null, "Fan out one notification", null);
		const outcome = await this.uow.runSystemOperation(NOTIFICATIONS_FAN_OUT_OPERATION, actor, async (scope: NotificationsScope) => {
			const fanOut = new NotificationFanOut({ ...this.services, store: scope.notificationStore, emails: scope.emailRequests });
			const result = await fanOut.fanOut(notificationId);
			await fanOut.applyGroupUpdates();
			const signals: { readonly userId: string; readonly signal: InAppNotificationSignal }[] = [];
			const seen = new Set<string>();
			for (const { userId, surface } of result.signals) {
				const key = `${userId}|${surface}`;
				if (!seen.has(key)) {
					seen.add(key);
					signals.push({ userId, signal: { surface, unread: await scope.notificationStore.unreadCount(userId, surface) } });
				}
			}
			return { queued: result.queued, signals };
		});
		for (const job of outcome.queued) {
			if (job.channel === "PUSH" || job.channel === "SMS") {
				await this.queues.deliver(job.channel, job.deliveryId);
			}
		}
		for (const { userId, signal } of outcome.signals) {
			await this.signals.publish(userId, signal);
		}
	}
}
