// ============================================
// notifications/infrastructure/notifications.providers.ts — the ADR 070 wiring of the notifications module
// ============================================

import { Logger, type Provider } from "@nestjs/common";
import type Redis from "ioredis";
import { API_VERSION_PREFIX, APP_LINKS, apiRoutes, type EmailRenderContext } from "@workspace/shared";

import { TypedConfigService } from "../../../config/typed-config.service";
import { CLOCK, type Clock } from "../../../platform/application/clock.port";
import type { MerchantAccessPort } from "../../../platform/application/ports/authorization.port";
import { RATE_LIMITER, type RateLimiter } from "../../../platform/application/ports/rate-limiter.port";
import { MERCHANT_ACCESS } from "../../tenancy/public-api";
import type { UnitOfWork } from "../../../platform/application/unit-of-work.port";
import { LogService } from "../../../platform/infrastructure/logging/logs.service";
import { REDIS_PUBLISHER, REDIS_SUBSCRIBER } from "../../../platform/infrastructure/redis/redis.tokens";
import type { NotificationsScope } from "../application/notifications-scope";
import { PUSH_SENDER, SMS_SENDER, type PushSender, type SmsSender } from "../application/ports/channel-senders.port";
import { IN_APP_SIGNAL, type InAppSignalPort } from "../application/ports/in-app-signal.port";
import { NOTIFICATION_QUEUES, type NotificationQueues } from "../application/ports/notification-queues.port";
import {
	BROADCAST_QUEUE,
	BROADCAST_SERVICE,
	CHANNEL_DELIVERY,
	EMAIL_RENDER_CONTEXT,
	NOTIFICATION_ACCOUNT,
	NOTIFICATION_ADMIN,
	NOTIFICATION_DISPATCHER,
	NOTIFICATION_RENDER_CONTEXT,
	NOTIFICATIONS_MAINTENANCE,
	NOTIFICATIONS_UNIT_OF_WORK,
	UNSUBSCRIBE_LINKS,
} from "../application/ports/notifications.tokens";
import { PUSH_TOKEN_CIPHER, type PushTokenCipher } from "../application/ports/push-token-cipher.port";
import { ChannelDelivery } from "../application/services/channel-delivery";
import { NotificationAccountService } from "../application/services/notification-account.service";
import { NotificationAdminService } from "../application/services/notification-admin.service";
import { NotificationDispatcher } from "../application/services/notification-dispatcher";
import { NotificationsMaintenance } from "../application/services/notifications-maintenance";
import type { NotificationRenderContext } from "../domain/catalog/notification-type";
import { MailpitEmailTransport } from "./adapters/transports/mailpit-email.transport";
import { ApnsPushSender } from "./channels/apns-push.sender";
import { FcmPushSender } from "./channels/fcm-push.sender";
import { DisabledPushSender, MailpitPushSender, NativePushSender } from "./channels/push-senders";
import { DisabledSmsSender, MailpitSmsSender, TwilioSmsSender } from "./channels/sms-senders";
import { GcmPushTokenCipher } from "./crypto/gcm-push-token.cipher";
import { SignedUnsubscribeLinks } from "./crypto/unsubscribe-links";
import type { BullMqNotificationQueues } from "./queue/bullmq-notification-queues";
import { InlineNotificationQueues } from "./queue/inline-notification-queues";
import { type BullMqBroadcastQueue, InlineBroadcastQueue } from "./queue/broadcast-queues";
import { BroadcastService, BROADCASTS_SEND_OPERATION, type BroadcastQueue } from "../application/services/broadcast-service";
import { TENANT_RATE_LIMIT_OVERRIDES, type TenantRateLimitOverridesPort } from "../../../platform/application/ports/tenant-rate-limit-overrides.port";
import { systemActor } from "../../../platform/application/actor-context";
import { RedisInAppSignal } from "./signals/redis-in-app-signal";

type RenderContext = Omit<NotificationRenderContext, "groupCount">;

export function createPushSender(config: TypedConfigService, logService: LogService): PushSender {
	const settings = config.notifications;
	switch (settings.pushProvider) {
		case "none":
			return new DisabledPushSender();
		case "mailpit":
			return new MailpitPushSender(new MailpitEmailTransport(config.email, logService), config.email.fromAddress);
		case "native":
			return new NativePushSender(
				settings.fcmServiceAccountJson === null ? null : new FcmPushSender(settings.fcmServiceAccountJson),
				settings.apns === null ? null : new ApnsPushSender(settings.apns),
			);
	}
}

export function createSmsSender(config: TypedConfigService, logService: LogService): SmsSender {
	const settings = config.notifications;
	switch (settings.smsProvider) {
		case "none":
			return new DisabledSmsSender();
		case "mailpit":
			return new MailpitSmsSender(new MailpitEmailTransport(config.email, logService), config.email.fromAddress);
		case "twilio":
			if (settings.twilio === null) {
				new Logger("Notifications").warn("SMS_PROVIDER=twilio without Twilio settings: SMS is off");
				return new DisabledSmsSender();
			}
			return new TwilioSmsSender({ ...settings.twilio, statusCallbackUrl: `${config.http.publicUrl}${API_VERSION_PREFIX}${apiRoutes.notifications.twilioStatus}` });
	}
}

/** The bound in-process queues, wired after the dispatcher and delivery exist (they depend on the queues). */
const INLINE_QUEUES = Symbol("INLINE_QUEUES");
const INLINE_BROADCAST_QUEUE = Symbol("INLINE_BROADCAST_QUEUE");

export function notificationProviders(
	useBullMq: boolean,
	bullMqQueues: typeof BullMqNotificationQueues | null,
	bullMqBroadcastQueue: typeof BullMqBroadcastQueue | null,
): Provider[] {
	return [
		{ provide: INLINE_BROADCAST_QUEUE, useFactory: (): InlineBroadcastQueue => new InlineBroadcastQueue() },
		useBullMq && bullMqBroadcastQueue !== null
			? { provide: BROADCAST_QUEUE, useExisting: bullMqBroadcastQueue }
			: { provide: BROADCAST_QUEUE, useExisting: INLINE_BROADCAST_QUEUE },
		{
			provide: BROADCAST_SERVICE,
			inject: [NOTIFICATIONS_UNIT_OF_WORK, CLOCK, BROADCAST_QUEUE, MERCHANT_ACCESS, TENANT_RATE_LIMIT_OVERRIDES, TypedConfigService, INLINE_BROADCAST_QUEUE],
			useFactory: (
				uow: UnitOfWork<NotificationsScope>,
				clock: Clock,
				queue: BroadcastQueue,
				merchantAccess: MerchantAccessPort,
				overrides: TenantRateLimitOverridesPort,
				config: TypedConfigService,
				inline: InlineBroadcastQueue,
			): BroadcastService => {
				const service = new BroadcastService({
					uow,
					clock,
					queue,
					merchantAccess,
					overrides,
					blockedLinkDomains: config.notifications.broadcastBlockedLinkDomains,
					platformName: config.runtime.appName,
				});
				inline.bind((broadcastId: string): Promise<void> => service.send(systemActor(BROADCASTS_SEND_OPERATION, "job", null, "Send one broadcast", null), broadcastId));
				return service;
			},
		},
		{
			provide: NOTIFICATION_RENDER_CONTEXT,
			inject: [TypedConfigService],
			useFactory: (config: TypedConfigService): RenderContext => ({
				appName: config.runtime.appName,
				webUrl: config.clientApps.webUrl,
				merchantUrl: config.clientApps.merchantUrl,
				adminUrl: config.clientApps.adminUrl,
			}),
		},
		{ provide: PUSH_SENDER, inject: [TypedConfigService, LogService], useFactory: createPushSender },
		{ provide: SMS_SENDER, inject: [TypedConfigService, LogService], useFactory: createSmsSender },
		{
			provide: PUSH_TOKEN_CIPHER,
			inject: [TypedConfigService],
			useFactory: (config: TypedConfigService): PushTokenCipher => new GcmPushTokenCipher(config.notifications.encryptionKeys),
		},
		{
			provide: UNSUBSCRIBE_LINKS,
			inject: [TypedConfigService],
			useFactory: (config: TypedConfigService): SignedUnsubscribeLinks =>
				new SignedUnsubscribeLinks(
					config.auth.emailVerificationSecret,
					`${config.clientApps.webUrl}${APP_LINKS.web.unsubscribe}`,
					`${config.http.publicUrl}${API_VERSION_PREFIX}${apiRoutes.notifications.unsubscribeOneClick}`,
				),
		},
		{
			provide: IN_APP_SIGNAL,
			inject: [TypedConfigService, REDIS_PUBLISHER, REDIS_SUBSCRIBER],
			useFactory: (config: TypedConfigService, publisher: Redis | null, subscriber: Redis | null): RedisInAppSignal => new RedisInAppSignal(config, publisher, subscriber),
		},
		{ provide: INLINE_QUEUES, useFactory: (): InlineNotificationQueues => new InlineNotificationQueues() },
		useBullMq && bullMqQueues !== null ? { provide: NOTIFICATION_QUEUES, useExisting: bullMqQueues } : { provide: NOTIFICATION_QUEUES, useExisting: INLINE_QUEUES },
		{
			provide: NOTIFICATION_DISPATCHER,
			inject: [NOTIFICATIONS_UNIT_OF_WORK, CLOCK, RATE_LIMITER, TypedConfigService, NOTIFICATION_RENDER_CONTEXT, UNSUBSCRIBE_LINKS, NOTIFICATION_QUEUES, IN_APP_SIGNAL],
			useFactory: (
				uow: UnitOfWork<NotificationsScope>,
				clock: Clock,
				limiter: RateLimiter,
				config: TypedConfigService,
				renderContext: RenderContext,
				unsubscribe: SignedUnsubscribeLinks,
				queues: NotificationQueues,
				signals: InAppSignalPort,
			): NotificationDispatcher =>
				new NotificationDispatcher(
					uow,
					{
						limiter,
						clock,
						renderContext,
						unsubscribe,
						richText: { imageUrl: (): string | null => null },
						settings: {
							pushEnabled: config.notifications.pushProvider !== "none",
							smsEnabled: config.notifications.smsProvider !== "none",
							smsAllowedCountries: config.notifications.smsAllowedCountries,
							smsDailyLimitPerRecipient: config.notifications.smsDailyLimitPerRecipient,
							smsDailyLimitPerTenant: config.notifications.smsDailyLimitPerTenant,
						},
					},
					queues,
					signals,
				),
		},
		{
			provide: CHANNEL_DELIVERY,
			inject: [NOTIFICATIONS_UNIT_OF_WORK, CLOCK, PUSH_SENDER, SMS_SENDER, PUSH_TOKEN_CIPHER, NOTIFICATION_RENDER_CONTEXT, INLINE_QUEUES, NOTIFICATION_DISPATCHER],
			useFactory: (
				uow: UnitOfWork<NotificationsScope>,
				clock: Clock,
				push: PushSender,
				sms: SmsSender,
				cipher: PushTokenCipher,
				renderContext: RenderContext,
				inline: InlineNotificationQueues,
				dispatcher: NotificationDispatcher,
			): ChannelDelivery => {
				const delivery = new ChannelDelivery({ uow, clock, push, sms, cipher, renderContext });
				inline.bind(dispatcher, delivery);
				return delivery;
			},
		},
		{
			provide: NOTIFICATIONS_MAINTENANCE,
			inject: [NOTIFICATIONS_UNIT_OF_WORK, CLOCK, NOTIFICATION_QUEUES, NOTIFICATION_RENDER_CONTEXT, UNSUBSCRIBE_LINKS],
			useFactory: (
				uow: UnitOfWork<NotificationsScope>,
				clock: Clock,
				queues: NotificationQueues,
				renderContext: RenderContext,
				unsubscribe: SignedUnsubscribeLinks,
			): NotificationsMaintenance => new NotificationsMaintenance(uow, clock, queues, renderContext, unsubscribe),
		},
		{
			provide: NOTIFICATION_ACCOUNT,
			inject: [NOTIFICATIONS_UNIT_OF_WORK, CLOCK, IN_APP_SIGNAL, PUSH_SENDER, PUSH_TOKEN_CIPHER, UNSUBSCRIBE_LINKS],
			useFactory: (
				uow: UnitOfWork<NotificationsScope>,
				clock: Clock,
				signals: InAppSignalPort,
				push: PushSender,
				cipher: PushTokenCipher,
				unsubscribe: SignedUnsubscribeLinks,
			): NotificationAccountService => new NotificationAccountService(uow, clock, signals, push, cipher, unsubscribe),
		},
		{
			provide: NOTIFICATION_ADMIN,
			inject: [
				NOTIFICATIONS_UNIT_OF_WORK,
				CLOCK,
				NOTIFICATION_QUEUES,
				NOTIFICATION_RENDER_CONTEXT,
				EMAIL_RENDER_CONTEXT,
				PUSH_SENDER,
				SMS_SENDER,
				TypedConfigService,
				MERCHANT_ACCESS,
			],
			useFactory: (
				uow: UnitOfWork<NotificationsScope>,
				clock: Clock,
				queues: NotificationQueues,
				renderContext: RenderContext,
				emailRenderContext: EmailRenderContext,
				push: PushSender,
				sms: SmsSender,
				config: TypedConfigService,
				merchantAccess: MerchantAccessPort,
			): NotificationAdminService =>
				new NotificationAdminService(
					uow,
					clock,
					queues,
					renderContext,
					emailRenderContext,
					{
						emailProvider: config.email.provider,
						emailLive: config.email.provider !== "mailpit",
						push,
						sms,
						fcmConfigured: config.notifications.fcmServiceAccountJson !== null,
						apnsConfigured: config.notifications.apns !== null,
					},
					merchantAccess,
				),
		},
	];
}
