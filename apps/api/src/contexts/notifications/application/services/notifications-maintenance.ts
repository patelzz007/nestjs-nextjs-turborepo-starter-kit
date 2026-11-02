// ============================================
// notifications/application/services/notifications-maintenance.ts — the minute-by-minute housekeeping (ADR 070)
// ============================================
// Every minute: fan out any notification a crash left behind (the row is its own outbox), release push
// and SMS deliveries whose quiet hours ended (and re-queue any lost job), and send the digests that are
// due. Daily: retention (soft delete) and revoking push devices whose session ended. Every step is safe on
// every replica at once: claims and transitions are conditional.

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { Clock } from "../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import { notificationType } from "../../domain/catalog/notification-catalog";
import type { NotificationRenderContext } from "../../domain/catalog/notification-type";
import { NotificationDigestEmailTemplate } from "../../domain/templates/notification-digest-email.template";
import type { NotificationsScope } from "../notifications-scope";
import type { NotificationQueues } from "../ports/notification-queues.port";
import type { DueDigestDelivery } from "../ports/notification-store.port";
import type { EmailUnsubscribeLinks } from "../../domain/templates/base/base-email-template";
import type { UnsubscribeLinkFactory } from "./notification-fan-out";

export const NOTIFICATIONS_MAINTENANCE_OPERATION = "notifications.maintenance";
/** A notification not fanned out this long after commit missed its hand-off. */
export const UNFANNED_GRACE_MS = 60_000;
/** Rows one run handles at most (the next run continues). */
export const MAINTENANCE_BATCH_SIZE = 500;

export interface MaintenanceSummary {
	readonly fannedOut: number;
	readonly released: number;
	readonly digests: number;
}

/** A digest's footer link and `List-Unsubscribe` endpoint. */
function digestUnsubscribe(links: EmailUnsubscribeLinks): { readonly unsubscribeUrl: string; readonly oneClickUnsubscribeUrl: string } {
	return { unsubscribeUrl: links.pageUrl, oneClickUnsubscribeUrl: links.oneClickUrl };
}

export class NotificationsMaintenance {
	public constructor(
		private readonly uow: UnitOfWork<NotificationsScope>,
		private readonly clock: Clock,
		private readonly queues: NotificationQueues,
		private readonly renderContext: Omit<NotificationRenderContext, "groupCount">,
		private readonly unsubscribe: UnsubscribeLinkFactory,
	) {}

	public async run(actor: ActorContext): Promise<MaintenanceSummary> {
		const now = this.clock.now();
		const { unfanned, released } = await this.uow.runSystemOperation(NOTIFICATIONS_MAINTENANCE_OPERATION, actor, async (scope) => {
			const store = scope.notificationStore;
			const due = await store.dueDeliveries(now, MAINTENANCE_BATCH_SIZE);
			const toQueue: { readonly id: string; readonly channel: "PUSH" | "SMS" }[] = [];
			for (const delivery of due) {
				const channel = delivery.channel === "PUSH" ? "PUSH" : "SMS";
				if (delivery.status === "QUEUED" || (await store.transitionDelivery(delivery.id, "HELD", "QUEUED", now))) {
					toQueue.push({ id: delivery.id, channel });
				}
			}
			return { unfanned: await store.unfannedNotifications(now - UNFANNED_GRACE_MS, now, MAINTENANCE_BATCH_SIZE), released: toQueue };
		});
		for (const notificationId of unfanned) {
			await this.queues.fanOut(notificationId);
		}
		for (const delivery of released) {
			await this.queues.deliver(delivery.channel, delivery.id);
		}
		const digests = await this.sendDigests(actor, now);
		return { fannedOut: unfanned.length, released: released.length, digests };
	}

	public async retain(actor: ActorContext): Promise<{ readonly inApp: number; readonly deliveries: number; readonly notifications: number; readonly devices: number }> {
		const now = this.clock.now();
		return this.uow.runSystemOperation(NOTIFICATIONS_MAINTENANCE_OPERATION, actor, async (scope) => {
			const removed = await scope.notificationStore.applyRetention(now);
			const devices = await scope.notificationStore.revokeDevicesOfEndedSessions(now);
			return { ...removed, devices };
		});
	}

	/** One digest email per person, gathering every held email that is due (ADR 070). */
	private async sendDigests(actor: ActorContext, now: number): Promise<number> {
		return this.uow.runSystemOperation(NOTIFICATIONS_MAINTENANCE_OPERATION, actor, async (scope) => {
			const due = await scope.notificationStore.dueDigestDeliveries(now, MAINTENANCE_BATCH_SIZE);
			const byUser = new Map<string, DueDigestDelivery[]>();
			for (const delivery of due) {
				byUser.set(delivery.userId, [...(byUser.get(delivery.userId) ?? []), delivery]);
			}
			let sent = 0;
			for (const [userId, deliveries] of byUser) {
				const items = deliveries.flatMap((delivery) => {
					const rendering = notificationType(delivery.notification.typeKey).renderInApp(delivery.notification.payload, delivery.notification.locale, {
						...this.renderContext,
						groupCount: 1,
					});
					return rendering === null ? [] : [{ title: rendering.title, body: rendering.body, link: rendering.link === null ? "" : this.absolute(rendering.link) }];
				});
				const [first] = deliveries;
				if (first === undefined || items.length === 0) {
					continue;
				}
				const result = await scope.emailRequests.request(
					new NotificationDigestEmailTemplate({
						to: first.email,
						period: first.digestFrequency === "WEEKLY" ? "WEEKLY" : "DAILY",
						itemTitles: items.map((item) => item.title),
						itemBodies: items.map((item) => item.body),
						itemLinks: items.map((item) => item.link),
						...digestUnsubscribe(this.unsubscribe.forUser(userId, first.notification.category, null)),
					}),
				);
				await scope.notificationStore.completeDigest(
					deliveries.map((delivery) => delivery.deliveryId),
					result.ok ? { status: result.mode === "queued" ? "QUEUED" : "SENT", providerMessageId: result.id } : { status: "SUPPRESSED", providerMessageId: null },
					now,
				);
				sent += result.ok ? 1 : 0;
			}
			return sent;
		});
	}

	private absolute(link: string): string {
		return link.startsWith("https://") ? link : `${this.renderContext.webUrl}${link}`;
	}
}
