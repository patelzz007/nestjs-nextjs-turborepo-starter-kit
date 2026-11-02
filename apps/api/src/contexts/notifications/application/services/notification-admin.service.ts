// ============================================
// notifications/application/services/notification-admin.service.ts — the delivery log and the catalog (ADR 070)
// ============================================

import {
	MERCHANT_CAPABILITY,
	type EmailRenderContext,
	type NotificationChannel,
	type NotificationDeliveryEntry,
	type NotificationDeliveryListQuery,
	type NotificationProvidersResponse,
	type NotificationSuppressionEntry,
	type NotificationSuppressionListQuery,
	type NotificationTypePreview,
	type NotificationTypeSummary,
	type PaginatedServiceResult,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { Clock } from "../../../../platform/application/clock.port";
import type { MerchantAccessPort } from "../../../../platform/application/ports/authorization.port";
import { AuthorizationError, NotFoundError, ValidationError } from "../../../../platform/application/errors/app-error";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import { findNotificationType, NOTIFICATION_CATALOG } from "../../domain/catalog/notification-catalog";
import type { NotificationRenderContext, NotificationType } from "../../domain/catalog/notification-type";
import { TEST_NOTIFICATION } from "../../domain/catalog/types/platform.types";
import { mandatoryChannels } from "../../domain/policies/notification-rules";
import { countSmsSegments } from "../../domain/policies/sms-segments";
import { NotificationEmailTemplate } from "../../domain/templates/notification-email.template";
import type { NotificationsScope } from "../notifications-scope";
import type { PushSender, SmsSender } from "../ports/channel-senders.port";
import type { NotificationQueues } from "../ports/notification-queues.port";

export const NOTIFICATIONS_DELIVERY_LOG_OPERATION = "notifications.delivery_log";
export const NOTIFICATIONS_SUPPRESSIONS_OPERATION = "notifications.suppressions";
export const NOTIFICATIONS_TWILIO_WEBHOOK_OPERATION = "notifications.webhook.twilio";

export interface ProviderDescription {
	readonly emailProvider: string;
	readonly emailLive: boolean;
	readonly push: PushSender;
	readonly sms: SmsSender;
	readonly fcmConfigured: boolean;
	readonly apnsConfigured: boolean;
}

export function summarizeType(type: NotificationType): NotificationTypeSummary {
	return {
		key: type.key,
		description: type.description,
		category: type.category,
		surfaces: [...type.surfaces],
		channels: [...type.channels],
		mandatoryChannels: mandatoryChannels(type.category).filter((channel: NotificationChannel): boolean => type.channels.includes(channel)),
		urgency: type.urgency,
		sensitive: type.sensitive,
		groups: type.groupingWindowMs !== null,
		digestible: type.digestible,
		allowsContactRecipient: type.allowsContactRecipient,
	};
}

export class NotificationAdminService {
	public constructor(
		private readonly uow: UnitOfWork<NotificationsScope>,
		private readonly clock: Clock,
		private readonly queues: NotificationQueues,
		private readonly renderContext: Omit<NotificationRenderContext, "groupCount">,
		private readonly emailRenderContext: EmailRenderContext,
		private readonly providers: ProviderDescription,
		private readonly merchantAccess: MerchantAccessPort,
	) {}

	/** Platform staff: every tenant's deliveries. */
	public listDeliveries(actor: ActorContext, query: NotificationDeliveryListQuery): Promise<PaginatedServiceResult<NotificationDeliveryEntry>> {
		return this.uow.runSystemOperation(NOTIFICATIONS_DELIVERY_LOG_OPERATION, actor, (scope) => scope.accountStore.listDeliveries(query, null));
	}

	/** One tenant's deliveries, for its members holding `merchant:view_notifications`. */
	public async listTenantDeliveries(actor: ActorContext, tenantId: string, query: NotificationDeliveryListQuery): Promise<PaginatedServiceResult<NotificationDeliveryEntry>> {
		await this.merchantAccess.assertCapability(actor, { tenantId, capability: MERCHANT_CAPABILITY.viewNotifications });
		return this.uow.runSystemOperation(NOTIFICATIONS_DELIVERY_LOG_OPERATION, actor, (scope) => scope.accountStore.listDeliveries(query, tenantId));
	}

	public async retryDelivery(actor: ActorContext, deliveryId: string): Promise<NotificationDeliveryEntry> {
		const entry = await this.uow.runSystemOperation(NOTIFICATIONS_DELIVERY_LOG_OPERATION, actor, (scope) => scope.accountStore.retryDelivery(deliveryId, this.clock.now()));
		if (entry === null) {
			throw new ValidationError({ message: "Only a failed push or SMS delivery can be retried" });
		}
		if (entry.channel === "PUSH" || entry.channel === "SMS") {
			await this.queues.deliver(entry.channel, entry.id);
		}
		return entry;
	}

	public catalog(): readonly NotificationTypeSummary[] {
		return NOTIFICATION_CATALOG.map(summarizeType);
	}

	/** Every channel's rendering of a type with its sample payload: exactly what would be sent. */
	public preview(typeKey: string): NotificationTypePreview {
		const type = findNotificationType(typeKey);
		if (type === null) {
			throw new NotFoundError({ message: `No notification type "${typeKey}"` });
		}
		const payload = type.samplePayloadJson();
		const context = { ...this.renderContext, groupCount: 1 };
		const inApp = type.renderInApp(payload, "en", context);
		const email = type.renderEmail(payload, "en", context);
		const push = type.renderPush(payload, "en", context);
		const sms = type.renderSms(payload, "en", context);
		const template =
			email === null
				? null
				: new NotificationEmailTemplate({
						to: "preview@example.com",
						subject: email.subject,
						eyebrow: email.eyebrow,
						heading: email.heading,
						paragraphs: [...email.paragraphs],
						...(email.action === null ? {} : { actionLabel: email.action.label, actionUrl: email.action.url }),
					});
		return {
			key: type.key,
			inApp: inApp === null ? null : { title: inApp.title, body: inApp.body, link: inApp.link },
			email: template === null ? null : { subject: template.subject, html: template.renderHtml(this.emailRenderContext), text: template.renderText(this.emailRenderContext) },
			push: push === null ? null : { title: type.sensitive ? this.renderContext.appName : push.title, body: type.sensitive ? "You have a new security message." : push.body },
			sms: sms === null ? null : { text: sms.text, segments: countSmsSegments(sms.text).segments },
		};
	}

	/** "Send test": one notification of every channel to the staff member themselves. */
	public async sendTest(actor: ActorContext, typeKey: string): Promise<void> {
		if (actor.kind !== "user") {
			throw new AuthorizationError({ message: "A test is sent to a signed-in staff member" });
		}
		if (typeKey !== TEST_NOTIFICATION.key) {
			throw new ValidationError({ message: `Only "${TEST_NOTIFICATION.key}" can be sent as a test` });
		}
		await this.uow.run(actor, async (scope) => {
			await scope.notify.notify({
				type: TEST_NOTIFICATION,
				recipient: { kind: "user", userId: actor.userId },
				payload: { requestedBy: "you" },
				dedupeKey: `test:${actor.userId}:${String(this.clock.now())}`,
				tenantId: null,
			});
		});
	}

	public listSuppressions(actor: ActorContext, query: NotificationSuppressionListQuery): Promise<PaginatedServiceResult<NotificationSuppressionEntry>> {
		return this.uow.runSystemOperation(NOTIFICATIONS_SUPPRESSIONS_OPERATION, actor, (scope) => scope.accountStore.listSuppressions(query));
	}

	public async liftSuppression(actor: ActorContext, suppressionId: string, reason: string): Promise<NotificationSuppressionEntry> {
		const actorId = actor.kind === "user" ? actor.userId : "system";
		const entry = await this.uow.runSystemOperation(NOTIFICATIONS_SUPPRESSIONS_OPERATION, actor, (scope) =>
			scope.accountStore.liftSuppression(suppressionId, reason, actorId, this.clock.now()),
		);
		if (entry === null) {
			throw new NotFoundError({ message: "Active suppression not found" });
		}
		return entry;
	}

	public providerStatus(): NotificationProvidersResponse {
		const { push, sms } = this.providers;
		return {
			providers: [
				{ channel: "IN_APP", provider: "database + SSE", configured: true, live: true, detail: "Inbox rows and live updates over Server-Sent Events" },
				{
					channel: "EMAIL",
					provider: this.providers.emailProvider,
					configured: true,
					live: this.providers.emailLive,
					detail: this.providers.emailLive ? "Delivers for real" : "Local inbox (Mailpit)",
				},
				{
					channel: "PUSH",
					provider: push.provider,
					configured: push.provider !== "none",
					live: push.live,
					detail:
						push.provider === "native"
							? `FCM ${this.providers.fcmConfigured ? "configured" : "missing"} · APNs ${this.providers.apnsConfigured ? "configured" : "missing"}`
							: push.provider === "mailpit"
								? "Local sink: <device>@push.localhost in Mailpit"
								: "Off: deliveries are recorded SUPPRESSED (provider-disabled)",
				},
				{
					channel: "SMS",
					provider: sms.provider,
					configured: sms.provider !== "none",
					live: sms.live,
					detail:
						sms.provider === "twilio"
							? "Twilio Messaging Service"
							: sms.provider === "mailpit"
								? "Local sink: <number>@sms.localhost in Mailpit"
								: "Off: deliveries are recorded SUPPRESSED (provider-disabled)",
				},
			],
		};
	}

	/** A verified Twilio status callback (`MessageStatus`) or an inbound STOP (ADR 070). */
	public async applyTwilioStatus(actor: ActorContext, input: { readonly messageSid: string; readonly status: string; readonly errorCode: string | null }): Promise<void> {
		const outcome = input.status === "delivered" ? "DELIVERED" : input.status === "failed" || input.status === "undelivered" ? "FAILED" : null;
		if (outcome === null) {
			return;
		}
		await this.uow.runSystemOperation(NOTIFICATIONS_TWILIO_WEBHOOK_OPERATION, actor, (scope) =>
			scope.accountStore.applyProviderStatus(input.messageSid, outcome, input.errorCode === null ? null : `Twilio ${input.errorCode}`, this.clock.now()),
		);
	}

	public async applyTwilioStop(actor: ActorContext, destinationHash: string, maskedDestination: string): Promise<void> {
		await this.uow.runSystemOperation(NOTIFICATIONS_TWILIO_WEBHOOK_OPERATION, actor, (scope) =>
			scope.accountStore.suppress("SMS", destinationHash, maskedDestination, "SMS_STOP", this.clock.now()),
		);
	}
}
