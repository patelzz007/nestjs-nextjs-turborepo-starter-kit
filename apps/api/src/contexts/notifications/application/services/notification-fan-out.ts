// ============================================
// notifications/application/services/notification-fan-out.ts — one notification → its deliveries (ADR 070)
// ============================================
// Runs in ONE transaction under `notifications.fan_out`, after the notification committed. In order:
// recipient alive → tenant still served → surfaces → consent (marketing) → per channel: mandatory lock or
// preference → destination (verified, not suppressed, allowed country) → caps → quiet hours → grouping →
// digest. A channel that cannot deliver at all tries the type's declared fallback once. In-app rows are
// written here; email is requested here (same transaction, ADR 060); push and SMS deliveries are QUEUED
// and handed to their queues after commit.

import {
	DAY_MS,
	newRowId,
	RichTextDocumentResponseSchema,
	type NotificationCategory,
	type NotificationChannel,
	type NotificationDeliveryReason,
	type NotificationDeliveryStatus,
	type NotificationSurface,
	maskEmailAddress,
	maskPhone,
} from "@workspace/shared";

import type { Clock } from "../../../../platform/application/clock.port";
import type { RateLimiter } from "../../../../platform/application/ports/rate-limiter.port";
import { DEFAULT_NOTIFICATION_TIME_ZONE, findNotificationType } from "../../domain/catalog/notification-catalog";
import type { InAppRendering, NotificationRenderContext, NotificationType } from "../../domain/catalog/notification-type";
import { isInterruptive, resolveChannelEnabled } from "../../domain/policies/notification-rules";
import { destinationHash } from "../../domain/policies/mask-destination";
import { nextDigestAt, quietHoursRelease } from "../../domain/policies/quiet-hours";
import { renderRichTextHtml, renderRichTextPlain } from "../../domain/rich-text/render-rich-text";
import type { EmailUnsubscribeLinks } from "../../domain/templates/base/base-email-template";
import { BroadcastEmailTemplate } from "../../domain/templates/broadcast-email.template";
import { NotificationEmailTemplate } from "../../domain/templates/notification-email.template";
import type { EmailRequestTransactionalPort } from "../ports/email-request.port";
import type {
	BroadcastContent,
	NewDelivery,
	NewInAppNotification,
	NotificationRecipientProfile,
	NotificationStore,
	StoredNotification,
	StoredSchedule,
} from "../ports/notification-store.port";

/** Tenants in these states are still served; anything else silences its non-security notifications. */
const SERVED_TENANT_STATES: readonly string[] = ["ACTIVE", "RESTRICTED"];
const DEFAULT_QUIET_START_MINUTE = 1_320;
const DEFAULT_QUIET_END_MINUTE = 420;

export interface FanOutSettings {
	readonly pushEnabled: boolean;
	readonly smsEnabled: boolean;
	readonly smsAllowedCountries: readonly string[];
	readonly smsDailyLimitPerRecipient: number;
	readonly smsDailyLimitPerTenant: number;
}

/** SMS a destination may receive per day, and a tenant may send per day (ADR 070 caps, ADR 071 policies). */
/** One day: the SMS caps are daily. */
export const SMS_CAP_WINDOW_MS = DAY_MS;
export const SMS_RECIPIENT_DAILY_POLICY = "SMS_RECIPIENT_DAILY";
export const SMS_TENANT_DAILY_POLICY = "SMS_TENANT_DAILY";

/** Builds the unsubscribe links of one email (none for mandatory email): the web page and the RFC 8058 endpoint. */
export interface UnsubscribeLinkFactory {
	forUser(userId: string, category: NotificationCategory, tenantId: string | null): EmailUnsubscribeLinks;
	forContactPoint(address: string): EmailUnsubscribeLinks;
}

/** Where the fan-out sends what it decided. */
export interface FanOutResult {
	readonly notificationId: string;
	readonly queued: readonly { readonly deliveryId: string; readonly channel: NotificationChannel }[];
	readonly signals: readonly { readonly userId: string; readonly surface: NotificationSurface }[];
	/** The fan-out ran (false: another worker already did it, or the row is gone). */
	readonly ran: boolean;
}

export interface FanOutDependencies {
	readonly store: NotificationStore;
	readonly emails: EmailRequestTransactionalPort;
	readonly limiter: RateLimiter;
	readonly clock: Clock;
	readonly settings: FanOutSettings;
	readonly renderContext: Omit<NotificationRenderContext, "groupCount">;
	readonly unsubscribe: UnsubscribeLinkFactory;
}

/** What one channel decided before rows are written. */
type ChannelPlan =
	| { readonly kind: "suppressed"; readonly reason: NotificationDeliveryReason; readonly cannotDeliver: boolean; readonly maskedDestination: string | null }
	| { readonly kind: "done" };

const NO_PLAN: ChannelPlan = { kind: "done" };

function suppressed(reason: NotificationDeliveryReason, cannotDeliver: boolean, maskedDestination: string | null = null): ChannelPlan {
	return { kind: "suppressed", reason, cannotDeliver, maskedDestination };
}

export class NotificationFanOut {
	private readonly deliveries: NewDelivery[] = [];
	private readonly inApps: NewInAppNotification[] = [];
	private readonly queued: { deliveryId: string; channel: NotificationChannel }[] = [];
	private readonly signals: { userId: string; surface: NotificationSurface }[] = [];
	/** Grouped rows to update, applied by {@link applyGroupUpdates} inside the same transaction. */
	private readonly pendingGroupUpdates: { readonly id: string; readonly groupCount: number; readonly rendering: InAppRendering; readonly now: number }[] = [];
	/** The broadcast being delivered, loaded once (rich body for the inbox, sender identity). */
	private pendingBroadcast: BroadcastContent | null = null;

	public constructor(private readonly deps: FanOutDependencies) {}

	public async fanOut(notificationId: string): Promise<FanOutResult> {
		const now = this.deps.clock.now();
		if (!(await this.deps.store.claimForFanOut(notificationId, now))) {
			return this.result(notificationId, false);
		}
		const notification = await this.deps.store.findNotification(notificationId);
		const type = notification === null ? null : findNotificationType(notification.typeKey);
		if (notification === null || type === null || !type.isValidPayload(notification.payload)) {
			return this.result(notificationId, true);
		}
		if (notification.broadcastId !== null) {
			this.pendingBroadcast = await this.deps.store.broadcastContent(notification.broadcastId);
			if (this.pendingBroadcast?.stopped !== false) {
				// Cancelled, stopped after an upheld report, or gone: this recipient's turn never comes.
				this.suppressAll(notification, type, "broadcast-stopped");
				await this.deps.store.insertDeliveries(this.deliveries);
				return this.result(notificationId, true);
			}
		}
		if (notification.recipientUserId === null) {
			await this.fanOutToContactPoint(notification, type);
		} else {
			await this.fanOutToUser(notification, notification.recipientUserId, type, now);
		}
		await this.deps.store.insertInApp(this.inApps);
		await this.deps.store.insertDeliveries(this.deliveries);
		return this.result(notificationId, true);
	}

	private result(notificationId: string, ran: boolean): FanOutResult {
		return { notificationId, queued: this.queued, signals: this.signals, ran };
	}

	private async fanOutToContactPoint(notification: StoredNotification, type: NotificationType): Promise<void> {
		const address = notification.contactAddress;
		if (address === null || !type.allowsContactRecipient) {
			return;
		}
		const channel: NotificationChannel = address.includes("@") ? "EMAIL" : "SMS";
		if (!type.channels.includes(channel)) {
			return;
		}
		const masked = channel === "EMAIL" ? maskEmailAddress(address) : maskPhone(address);
		if (await this.deps.store.isSuppressed(channel, destinationHash(address))) {
			this.record(notification, channel, "SUPPRESSED", "suppressed-destination", { maskedDestination: masked });
			return;
		}
		const context = { ...this.deps.renderContext, groupCount: 1 };
		if (channel === "EMAIL") {
			await this.requestEmail(notification, type, address, context, this.deps.unsubscribe.forContactPoint(address), masked);
			return;
		}
		await this.planSms(notification, address, null);
	}

	private async fanOutToUser(requested: StoredNotification, userId: string, type: NotificationType, now: number): Promise<void> {
		const profile = await this.deps.store.recipientProfile(userId);
		if (profile === null || profile.isDeleted || !profile.isActive) {
			this.suppressAll(requested, type, "recipient-deleted");
			return;
		}
		// Rendered in the recipient's own language (resolved here: the producer cannot read other users).
		const notification: StoredNotification = { ...requested, locale: profile.locale };
		if (notification.tenantId !== null && notification.category !== "SECURITY") {
			const standing = await this.deps.store.tenantStanding(notification.tenantId);
			if (standing === null || !SERVED_TENANT_STATES.includes(standing.lifecycleState)) {
				this.suppressAll(notification, type, "tenant-inactive");
				return;
			}
		}
		const surfaces = type.surfaces.filter((surface: NotificationSurface): boolean => profile.surfaces.includes(surface));
		if (surfaces.length === 0) {
			this.suppressAll(notification, type, "surface");
			return;
		}
		if (notification.category === "MARKETING" && !(await this.hasMarketingPermission(notification, profile))) {
			this.suppressAll(notification, type, "no-consent");
			return;
		}
		const preferences = await this.deps.store.preferences(userId);
		const schedule = (await this.deps.store.schedule(userId)) ?? defaultSchedule();
		const groupKey = type.urgency === "normal" ? type.groupKey(notification.payload) : null;
		const grouped = groupKey === null || type.groupingWindowMs === null ? [] : await this.deps.store.findGroupedInApp(userId, type.key, groupKey, now - type.groupingWindowMs);
		const groupCount = grouped.reduce((highest: number, row): number => Math.max(highest, row.groupCount), 0) + 1;
		const context: NotificationRenderContext = { ...this.deps.renderContext, groupCount };
		const planned = new Set<NotificationChannel>();
		const plan = async (channel: NotificationChannel, isFallback: boolean): Promise<void> => {
			planned.add(channel);
			if (!isFallback && !resolveChannelEnabled(preferences, notification.tenantId, notification.category, channel)) {
				this.record(notification, channel, "SUPPRESSED", "preference", {});
				return;
			}
			const decided = await this.planUserChannel(channel, { notification, type, profile, surfaces, schedule, context, grouped, groupKey, now });
			if (decided.kind === "suppressed") {
				this.record(notification, channel, "SUPPRESSED", decided.reason, { maskedDestination: decided.maskedDestination });
				const fallback = type.fallbackFor(channel);
				if (decided.cannotDeliver && !isFallback && fallback !== null && !planned.has(fallback) && !type.channels.includes(fallback)) {
					await plan(fallback, true);
				}
			}
		};
		for (const channel of type.channels) {
			await plan(channel, false);
		}
	}

	private async hasMarketingPermission(notification: StoredNotification, profile: NotificationRecipientProfile): Promise<boolean> {
		const tenantId = notification.tenantId;
		if (tenantId !== null && (profile.memberTenantIds.includes(tenantId) || (await this.deps.store.hasLeftTenant(profile.userId, tenantId)))) {
			return false;
		}
		return this.deps.store.hasMarketingConsent(profile.userId, tenantId);
	}

	private async planUserChannel(
		channel: NotificationChannel,
		input: {
			readonly notification: StoredNotification;
			readonly type: NotificationType;
			readonly profile: NotificationRecipientProfile;
			readonly surfaces: readonly NotificationSurface[];
			readonly schedule: StoredSchedule;
			readonly context: NotificationRenderContext;
			readonly grouped: readonly { readonly id: string; readonly surface: NotificationSurface; readonly groupCount: number }[];
			readonly groupKey: string | null;
			readonly now: number;
		},
	): Promise<ChannelPlan> {
		const { notification, type, profile, schedule, context, now } = input;
		const quietRelease =
			type.urgency === "normal" && isInterruptive(channel)
				? quietHoursRelease(now, {
						enabled: schedule.quietHoursEnabled,
						startMinute: schedule.quietStartMinute,
						endMinute: schedule.quietEndMinute,
						timeZone: schedule.timeZone,
					})
				: null;
		switch (channel) {
			case "IN_APP":
				return this.planInApp(input);
			case "EMAIL": {
				const masked = maskEmailAddress(profile.email);
				if (await this.deps.store.isSuppressed("EMAIL", destinationHash(profile.email))) {
					return suppressed("suppressed-destination", true, masked);
				}
				if (input.grouped.length > 0) {
					return suppressed("grouping", false, masked);
				}
				if (type.digestible && type.urgency === "normal" && schedule.digestFrequency !== "OFF") {
					this.record(notification, "EMAIL", "HELD", "digest", { heldUntil: nextDigestAt(now, schedule.timeZone, schedule.digestFrequency), maskedDestination: masked });
					return NO_PLAN;
				}
				const unsubscribe = notification.category === "SECURITY" ? null : this.deps.unsubscribe.forUser(profile.userId, notification.category, notification.tenantId);
				await this.requestEmail(notification, type, profile.email, context, unsubscribe, masked);
				return NO_PLAN;
			}
			case "PUSH": {
				if (!this.deps.settings.pushEnabled) {
					return suppressed("provider-disabled", false);
				}
				const devices = (await this.deps.store.activePushDevices(profile.userId)).filter((device): boolean => input.surfaces.includes(device.surface));
				if (devices.length === 0) {
					return suppressed("no-device", true);
				}
				for (const device of devices) {
					const status: NotificationDeliveryStatus = quietRelease === null ? "QUEUED" : "HELD";
					this.record(notification, "PUSH", status, quietRelease === null ? null : "quiet-hours", {
						heldUntil: quietRelease,
						pushDeviceId: device.id,
						maskedDestination: device.deviceLabel ?? device.platform,
					});
				}
				return NO_PLAN;
			}
			case "SMS": {
				if (profile.phone === null || !profile.phoneVerified) {
					return suppressed("unverified-phone", true);
				}
				return this.planSms(notification, profile.phone, quietRelease);
			}
		}
	}

	private planInApp(input: {
		readonly notification: StoredNotification;
		readonly type: NotificationType;
		readonly profile: NotificationRecipientProfile;
		readonly surfaces: readonly NotificationSurface[];
		readonly context: NotificationRenderContext;
		readonly grouped: readonly { readonly id: string; readonly surface: NotificationSurface; readonly groupCount: number }[];
		readonly groupKey: string | null;
		readonly now: number;
	}): ChannelPlan {
		const { notification, type, profile, context } = input;
		// A sensitive notification never has an inbox row (its content must not be kept).
		if (type.sensitive) {
			return NO_PLAN;
		}
		const rendering = type.renderInApp(notification.payload, notification.locale, context);
		if (rendering === null) {
			return NO_PLAN;
		}
		if (input.grouped.length > 0) {
			for (const row of input.grouped) {
				this.pendingGroupUpdates.push({ id: row.id, groupCount: context.groupCount, rendering, now: input.now });
				this.signals.push({ userId: profile.userId, surface: row.surface });
			}
			this.record(notification, "IN_APP", "DELIVERED", "grouping", {});
			return NO_PLAN;
		}
		const broadcast = this.pendingBroadcast;
		for (const surface of input.surfaces) {
			this.inApps.push({
				id: newRowId(),
				notificationId: notification.id,
				userId: profile.userId,
				tenantId: notification.tenantId,
				surface,
				typeKey: type.key,
				category: notification.category,
				rendering,
				richBody: broadcast?.richBody ?? null,
				senderName: broadcast?.senderName ?? null,
				senderLogoUrl: broadcast?.senderLogoUrl ?? null,
				groupKey: input.groupKey,
				broadcastId: notification.broadcastId,
			});
			this.signals.push({ userId: profile.userId, surface });
		}
		this.record(notification, "IN_APP", "DELIVERED", null, {});
		return NO_PLAN;
	}

	/** Writes grouped-row updates; call after {@link fanOut}, in the same transaction. */
	public async applyGroupUpdates(): Promise<void> {
		for (const update of this.pendingGroupUpdates) {
			await this.deps.store.updateGroupedInApp(update.id, update.groupCount, update.rendering, update.now);
		}
	}

	private async planSms(notification: StoredNotification, phone: string, quietRelease: number | null): Promise<ChannelPlan> {
		const masked = maskPhone(phone);
		if (!this.deps.settings.smsEnabled) {
			return suppressed("provider-disabled", false, masked);
		}
		if (!this.deps.settings.smsAllowedCountries.some((code: string): boolean => phone.startsWith(`+${code}`))) {
			return suppressed("country-not-allowed", true, masked);
		}
		const hash = destinationHash(phone);
		if (await this.deps.store.isSuppressed("SMS", hash)) {
			return suppressed("suppressed-destination", true, masked);
		}
		if (!(await this.withinSmsCaps(hash, notification.tenantId))) {
			this.record(notification, "SMS", "SUPPRESSED", "cap", { maskedDestination: masked });
			return NO_PLAN;
		}
		this.record(notification, "SMS", quietRelease === null ? "QUEUED" : "HELD", quietRelease === null ? null : "quiet-hours", {
			heldUntil: quietRelease,
			maskedDestination: masked,
		});
		return NO_PLAN;
	}

	/** SMS pumping defence (ADR 070): a daily cap per number and per tenant, on the shared limiter. */
	private async withinSmsCaps(destination: string, tenantId: string | null): Promise<boolean> {
		const perRecipient = await this.deps.limiter.consume({
			policyName: SMS_RECIPIENT_DAILY_POLICY,
			rule: { algorithm: "sliding-window", limit: this.deps.settings.smsDailyLimitPerRecipient, windowMs: SMS_CAP_WINDOW_MS, penalty: null },
			subject: { kind: "destination", id: destination },
			cost: 1,
			failMode: "closed",
		});
		if (!perRecipient.allowed) {
			return false;
		}
		if (tenantId === null) {
			return true;
		}
		const perTenant = await this.deps.limiter.consume({
			policyName: SMS_TENANT_DAILY_POLICY,
			rule: { algorithm: "sliding-window", limit: this.deps.settings.smsDailyLimitPerTenant, windowMs: SMS_CAP_WINDOW_MS, penalty: null },
			subject: { kind: "tenant", id: tenantId },
			cost: 1,
			failMode: "closed",
		});
		return perTenant.allowed;
	}

	private async requestEmail(
		notification: StoredNotification,
		type: NotificationType,
		to: string,
		context: NotificationRenderContext,
		unsubscribe: EmailUnsubscribeLinks | null,
		maskedDestination: string,
	): Promise<void> {
		const template = this.emailTemplate(notification, type, to, context, unsubscribe);
		if (template === null) {
			return;
		}
		const result = template instanceof BroadcastEmailTemplate ? await this.deps.emails.request(template) : await this.deps.emails.request(template);
		if (!result.ok) {
			this.record(notification, "EMAIL", "SUPPRESSED", result.reason === "rate-limited" ? "cap" : "suppressed-destination", { maskedDestination });
			return;
		}
		this.record(notification, "EMAIL", result.mode === "queued" ? "QUEUED" : "SENT", null, { maskedDestination, providerMessageId: result.id });
	}

	private emailTemplate(
		notification: StoredNotification,
		type: NotificationType,
		to: string,
		context: NotificationRenderContext,
		unsubscribe: EmailUnsubscribeLinks | null,
	): NotificationEmailTemplate | BroadcastEmailTemplate | null {
		const broadcast = this.pendingBroadcast;
		if (broadcast !== null && unsubscribe !== null) {
			// The stored body as the server answers it (its pictures carry `src`): the open response shape.
			const document = RichTextDocumentResponseSchema.parse(broadcast.richBody);
			const rendering = type.renderEmail(notification.payload, notification.locale, context);
			return new BroadcastEmailTemplate({
				to,
				senderName: broadcast.senderName,
				title: rendering?.subject ?? broadcast.senderName,
				bodyHtml: renderRichTextHtml(document),
				bodyText: renderRichTextPlain(document),
				unsubscribeUrl: unsubscribe.pageUrl,
				oneClickUnsubscribeUrl: unsubscribe.oneClickUrl,
			});
		}
		const rendering = type.renderEmail(notification.payload, notification.locale, context);
		if (rendering === null) {
			return null;
		}
		return new NotificationEmailTemplate({
			to,
			subject: rendering.subject,
			eyebrow: rendering.eyebrow,
			heading: rendering.heading,
			paragraphs: [...rendering.paragraphs],
			...(rendering.action === null ? {} : { actionLabel: rendering.action.label, actionUrl: rendering.action.url }),
			...(unsubscribe === null ? {} : { unsubscribeUrl: unsubscribe.pageUrl, oneClickUnsubscribeUrl: unsubscribe.oneClickUrl }),
		});
	}

	private suppressAll(notification: StoredNotification, type: NotificationType, reason: NotificationDeliveryReason): void {
		for (const channel of type.channels) {
			this.record(notification, channel, "SUPPRESSED", reason, {});
		}
	}

	private record(
		notification: StoredNotification,
		channel: NotificationChannel,
		status: NotificationDeliveryStatus,
		reason: NotificationDeliveryReason | null,
		extra: {
			readonly heldUntil?: number | null;
			readonly maskedDestination?: string | null;
			readonly pushDeviceId?: string | null;
			readonly providerMessageId?: string | null;
		},
	): void {
		const id = newRowId();
		this.deliveries.push({
			id,
			notificationId: notification.id,
			recipientUserId: notification.recipientUserId,
			tenantId: notification.tenantId,
			typeKey: notification.typeKey,
			channel,
			status,
			reason,
			heldUntil: extra.heldUntil ?? null,
			maskedDestination: extra.maskedDestination ?? null,
			pushDeviceId: extra.pushDeviceId ?? null,
			providerMessageId: extra.providerMessageId ?? null,
		});
		if (status === "QUEUED" && (channel === "PUSH" || channel === "SMS")) {
			this.queued.push({ deliveryId: id, channel });
		}
	}
}

function defaultSchedule(): StoredSchedule {
	return {
		quietHoursEnabled: false,
		quietStartMinute: DEFAULT_QUIET_START_MINUTE,
		quietEndMinute: DEFAULT_QUIET_END_MINUTE,
		timeZone: DEFAULT_NOTIFICATION_TIME_ZONE,
		digestFrequency: "OFF",
	};
}
