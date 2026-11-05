// ============================================
// notifications/application/services/notification-account.service.ts — a person's own notifications (ADR 070)
// ============================================
// The inbox, preferences, quiet hours, consent, tenant links and push devices of the signed-in person,
// plus the signed one-click unsubscribe. Every read and write names the caller's own user id; nothing
// here takes a user id from the client.

import { createHash } from "node:crypto";

import {
	MARKETING_CONSENT_WORDING_VERSION,
	MAX_PUSH_DEVICES_PER_USER,
	newRowId,
	NotificationCategorySchema,
	NotificationChannelSchema,
	type InAppNotificationListQuery,
	type InAppNotificationResponse,
	type MarkNotificationsReadInput,
	type NotificationCategory,
	type NotificationChannel,
	type NotificationPreferenceCell,
	type NotificationPreferencesResponse,
	type NotificationSchedule,
	type NotificationSurface,
	type PaginatedServiceResult,
	type PushDeviceResponse,
	type RegisterPushDeviceInput,
	type SetMarketingConsentInput,
	type UnsubscribeResponse,
	type UpdateNotificationPreferencesInput,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { Clock } from "../../../../platform/application/clock.port";
import { AuthorizationError, DependencyUnavailableError, NotFoundError, ValidationError } from "../../../../platform/application/errors/app-error";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import { DEFAULT_NOTIFICATION_TIME_ZONE } from "../../domain/catalog/notification-catalog";
import { mandatoryChannels, PLATFORM_PREFERENCE_KEY, resolveChannelEnabled } from "../../domain/policies/notification-rules";
import type { NotificationsScope } from "../notifications-scope";
import type { PushSender } from "../ports/channel-senders.port";
import type { InAppSignalPort } from "../ports/in-app-signal.port";
import type { PushTokenCipher } from "../ports/push-token-cipher.port";
import { encryptInstallationId, pushAddressOf } from "./push-address";

export const NOTIFICATIONS_INBOX_OPERATION = "notifications.inbox";
export const NOTIFICATIONS_PREFERENCES_OPERATION = "notifications.preferences";
export const NOTIFICATIONS_UNSUBSCRIBE_OPERATION = "notifications.unsubscribe";

/** SMS is not offered for these categories (ADR 070 matrix). */
const SMS_OFFERED: readonly NotificationCategory[] = ["SECURITY", "ACCOUNT", "TRANSACTIONAL"];
const DEFAULT_QUIET_START_MINUTE = 1_320;
const DEFAULT_QUIET_END_MINUTE = 420;

/** The verified unsubscribe link (signature checked by the infrastructure). */
export type UnsubscribeTarget =
	| { readonly kind: "user"; readonly userId: string; readonly category: NotificationCategory; readonly tenantId: string | null }
	| { readonly kind: "contact-point"; readonly destinationHash: string };

export interface UnsubscribeVerifier {
	verify(token: string): UnsubscribeTarget;
}

/** Where the request came from (consent proof); a system actor has no request. */
function requestOf(actor: ActorContext): { readonly ip: string | null; readonly userAgent: string | null } | null {
	return actor.kind === "system" ? null : actor.request;
}

/** A signed-in user, never an API key or an impersonating admin for writes. */
function requireUser(actor: ActorContext): Extract<ActorContext, { readonly kind: "user" }> {
	if (actor.kind !== "user") {
		throw new AuthorizationError({ message: "Notifications belong to a signed-in person" });
	}
	return actor;
}

/** An impersonating admin reads the inbox but changes nothing of the person's (ADR 070, Q12). */
function requireOwnSession(actor: ActorContext): Extract<ActorContext, { readonly kind: "user" }> {
	const user = requireUser(actor);
	if (user.impersonatorUserId !== null) {
		throw new AuthorizationError({ message: "An impersonated session cannot change the person's notifications" });
	}
	return user;
}

export class NotificationAccountService {
	public constructor(
		private readonly uow: UnitOfWork<NotificationsScope>,
		private readonly clock: Clock,
		private readonly signals: InAppSignalPort,
		private readonly push: PushSender,
		private readonly cipher: PushTokenCipher,
		private readonly unsubscribe: UnsubscribeVerifier,
	) {}

	// ── Inbox ──────────────────────────────────────────────────────────

	public listInbox(actor: ActorContext, query: InAppNotificationListQuery): Promise<PaginatedServiceResult<InAppNotificationResponse>> {
		const user = requireUser(actor);
		return this.uow.runSystemOperation(NOTIFICATIONS_INBOX_OPERATION, actor, (scope) => scope.accountStore.listInbox(user.userId, query));
	}

	public unreadCount(actor: ActorContext, surface: NotificationSurface): Promise<number> {
		const user = requireUser(actor);
		return this.uow.runSystemOperation(NOTIFICATIONS_INBOX_OPERATION, actor, (scope) => scope.accountStore.unreadCount(user.userId, surface));
	}

	/** Read on one surface is read everywhere (the same notification on another app, the phone's tray). */
	public async markRead(actor: ActorContext, input: MarkNotificationsReadInput): Promise<void> {
		const user = requireOwnSession(actor);
		const now = this.clock.now();
		const unread = await this.uow.runSystemOperation(NOTIFICATIONS_INBOX_OPERATION, actor, async (scope) => {
			const notificationIds = await scope.accountStore.markRead(user.userId, input.surface, input.markAll === true ? "all" : (input.notificationIds ?? []), now);
			await scope.accountStore.markNotificationsRead(user.userId, notificationIds, now);
			return scope.accountStore.unreadCount(user.userId, input.surface);
		});
		await this.signals.publish(user.userId, { surface: input.surface, unread });
		await this.syncDeviceTrays(actor, user.userId);
	}

	/** Archived rows leave the inbox (and count as read); the client refetches its list. */
	public async archive(actor: ActorContext, inAppIds: readonly string[]): Promise<void> {
		const user = requireOwnSession(actor);
		await this.uow.runSystemOperation(NOTIFICATIONS_INBOX_OPERATION, actor, (scope) => scope.accountStore.archive(user.userId, inAppIds, this.clock.now()));
	}

	/** A push tap: opened, and its notification read in every inbox. */
	public async pushOpened(actor: ActorContext, deliveryId: string): Promise<void> {
		const user = requireOwnSession(actor);
		const notificationId = await this.uow.runSystemOperation(NOTIFICATIONS_INBOX_OPERATION, actor, (scope) =>
			scope.accountStore.markPushOpened(user.userId, deliveryId, this.clock.now()),
		);
		if (notificationId === null) {
			throw new NotFoundError({ message: "Delivery not found" });
		}
	}

	// ── Preferences, schedule, consent ─────────────────────────────────

	public preferences(actor: ActorContext, tenantId: string | null): Promise<NotificationPreferencesResponse> {
		const user = requireUser(actor);
		return this.uow.runSystemOperation(NOTIFICATIONS_PREFERENCES_OPERATION, actor, async (scope) => {
			const store = scope.accountStore;
			const stored = await store.preferences(user.userId);
			const consents = await store.latestConsents(user.userId);
			const phoneVerified = await store.phoneVerified(user.userId);
			const hasDevice = (await store.activeDevices(user.userId)).length > 0;
			// The operations alerts go only to the admin panel's people: nobody else has a row to set.
			const usesAdminPanel = await store.usesAdminPanel(user.userId);
			const schedule = (await store.schedule(user.userId)) ?? {
				quietHoursEnabled: false,
				quietStartMinute: DEFAULT_QUIET_START_MINUTE,
				quietEndMinute: DEFAULT_QUIET_END_MINUTE,
				timeZone: DEFAULT_NOTIFICATION_TIME_ZONE,
				digestFrequency: "OFF",
			};
			const marketingConsent = consents.get(tenantId ?? PLATFORM_PREFERENCE_KEY) ?? false;
			const cell = (category: NotificationCategory, channel: NotificationChannel): NotificationPreferenceCell => {
				const locked = mandatoryChannels(category).includes(channel);
				const offered = channel !== "SMS" || SMS_OFFERED.includes(category);
				const reachable = channel === "SMS" ? phoneVerified : channel === "PUSH" ? hasDevice : true;
				const needsConsent = category === "MARKETING" && !marketingConsent;
				const reason = locked
					? "mandatory"
					: !offered
						? "not-offered"
						: needsConsent
							? "needs-consent"
							: !reachable
								? channel === "SMS"
									? "phone-unverified"
									: "no-push-device"
								: null;
				return { channel, enabled: offered && resolveChannelEnabled(stored, tenantId, category, channel), locked, available: offered && reachable, reason };
			};
			const links = await store.tenantLinks(user.userId);
			return {
				tenantId,
				categories: NotificationCategorySchema.options
					.filter((category: NotificationCategory): boolean => category !== "OPERATIONS" || usesAdminPanel)
					.map((category) => ({
						category,
						channels: NotificationChannelSchema.options.map((channel) => cell(category, channel)),
					})),
				platformMarketingConsent: consents.get(PLATFORM_PREFERENCE_KEY) ?? false,
				schedule,
				tenants: links.map((link) => ({
					tenantId: link.tenantId,
					tenantName: link.tenantName,
					marketingConsent: consents.get(link.tenantId) ?? false,
					left: link.leftAt !== null,
				})),
			};
		});
	}

	public async updatePreferences(actor: ActorContext, input: UpdateNotificationPreferencesInput): Promise<NotificationPreferencesResponse> {
		const user = requireOwnSession(actor);
		const changes = input.changes.filter((change) => !mandatoryChannels(change.category).includes(change.channel));
		if (changes.length !== input.changes.length) {
			throw new ValidationError({
				message: "Security notices are always sent in-app and by email, and operations alerts in-app and to your phone; those channels cannot be turned off",
			});
		}
		await this.uow.runSystemOperation(NOTIFICATIONS_PREFERENCES_OPERATION, actor, (scope) =>
			scope.accountStore.savePreferences(user.userId, input.tenantId ?? PLATFORM_PREFERENCE_KEY, changes, this.clock.now()),
		);
		return this.preferences(actor, input.tenantId);
	}

	public async updateSchedule(actor: ActorContext, schedule: NotificationSchedule): Promise<NotificationPreferencesResponse> {
		const user = requireOwnSession(actor);
		await this.uow.runSystemOperation(NOTIFICATIONS_PREFERENCES_OPERATION, actor, (scope) => scope.accountStore.saveSchedule(user.userId, schedule, this.clock.now()));
		return this.preferences(actor, null);
	}

	public async setConsent(actor: ActorContext, input: SetMarketingConsentInput): Promise<void> {
		const user = requireOwnSession(actor);
		if (input.wordingVersion !== MARKETING_CONSENT_WORDING_VERSION) {
			throw new ValidationError({ message: "The consent wording changed; reload and answer the current question" });
		}
		await this.uow.runSystemOperation(NOTIFICATIONS_PREFERENCES_OPERATION, actor, (scope) =>
			scope.accountStore.recordConsent(
				{
					userId: user.userId,
					scope: input.scope,
					tenantId: input.tenantId,
					granted: input.granted,
					source: input.source,
					wordingVersion: input.wordingVersion,
					ip: requestOf(actor)?.ip ?? null,
					userAgent: requestOf(actor)?.userAgent ?? null,
				},
				this.clock.now(),
			),
		);
	}

	/** "Stop hearing from {tenant}": the link is marked left and that tenant's consent withdrawn (ADR 073). */
	public async leaveTenant(actor: ActorContext, tenantId: string): Promise<void> {
		const user = requireOwnSession(actor);
		await this.uow.runSystemOperation(NOTIFICATIONS_PREFERENCES_OPERATION, actor, async (scope) => {
			await scope.accountStore.leaveTenant(user.userId, tenantId, this.clock.now());
			await scope.accountStore.recordConsent(
				{
					userId: user.userId,
					scope: "TENANT",
					tenantId,
					granted: false,
					source: "LEAVE_TENANT",
					wordingVersion: MARKETING_CONSENT_WORDING_VERSION,
					ip: requestOf(actor)?.ip ?? null,
					userAgent: requestOf(actor)?.userAgent ?? null,
				},
				this.clock.now(),
			);
		});
	}

	// ── Push devices ───────────────────────────────────────────────────

	public listDevices(actor: ActorContext): Promise<readonly PushDeviceResponse[]> {
		const user = requireUser(actor);
		return this.uow.runSystemOperation(NOTIFICATIONS_PREFERENCES_OPERATION, actor, (scope) => scope.accountStore.listDevices(user.userId, user.sessionId));
	}

	/**
	 * Registers this installed app for the signed-in session (ADR 070): the same token refreshes its row,
	 * a token last held by another person moves to this one, and past {@link MAX_PUSH_DEVICES_PER_USER}
	 * the least recently seen device is revoked.
	 */
	public async registerDevice(actor: ActorContext, input: RegisterPushDeviceInput): Promise<PushDeviceResponse> {
		const user = requireOwnSession(actor);
		if (!this.cipher.available) {
			throw new DependencyUnavailableError({ message: "Push notifications are not configured on this server (NOTIFICATIONS_ENCRYPTION_KEYS)" });
		}
		const tokenHash = createHash("sha256").update(input.token).digest("hex");
		const now = this.clock.now();
		const deviceId = await this.uow.runSystemOperation(NOTIFICATIONS_PREFERENCES_OPERATION, actor, async (scope) => {
			const store = scope.accountStore;
			const existing = await store.findDeviceByTokenHash(tokenHash);
			if (existing !== null && existing.userId === user.userId) {
				await store.touchDevice(
					existing.id,
					{
						deviceSessionId: user.sessionId,
						surface: input.surface,
						deviceLabel: input.deviceLabel,
						appVersion: input.appVersion,
						installationIdCiphertext: encryptInstallationId(this.cipher, input.installationId, existing.id),
					},
					now,
				);
				return existing.id;
			}
			if (existing !== null) {
				// A shared phone: the previous person signed out and this one signed in.
				await store.revokeDevice(existing.id, null, "signed-in-elsewhere", now);
			}
			const active = await store.activeDevices(user.userId);
			for (const stale of active.slice(0, Math.max(0, active.length - MAX_PUSH_DEVICES_PER_USER + 1))) {
				await store.revokeDevice(stale.id, user.userId, "device-limit", now);
			}
			const id = newRowId();
			await store.insertDevice(
				{
					id,
					userId: user.userId,
					deviceSessionId: user.sessionId,
					platform: input.platform,
					surface: input.surface,
					tokenCiphertext: this.cipher.encrypt(input.token, id),
					tokenHash,
					installationIdCiphertext: encryptInstallationId(this.cipher, input.installationId, id),
					deviceLabel: input.deviceLabel,
					appVersion: input.appVersion,
				},
				now,
			);
			return id;
		});
		const device = await this.uow.runSystemOperation(NOTIFICATIONS_PREFERENCES_OPERATION, actor, (scope) => scope.accountStore.device(deviceId));
		if (device === null) {
			throw new NotFoundError({ message: "Push device not found" });
		}
		return { ...device, isCurrentSession: true };
	}

	public async removeDevice(actor: ActorContext, deviceId: string): Promise<void> {
		const user = requireOwnSession(actor);
		const removed = await this.uow.runSystemOperation(NOTIFICATIONS_PREFERENCES_OPERATION, actor, (scope) =>
			scope.accountStore.revokeDevice(deviceId, user.userId, "removed-by-owner", this.clock.now()),
		);
		if (!removed) {
			throw new NotFoundError({ message: "Push device not found" });
		}
	}

	// ── One-click unsubscribe (RFC 8058) ───────────────────────────────

	public async applyUnsubscribe(actor: ActorContext, token: string): Promise<UnsubscribeResponse> {
		const target = this.unsubscribe.verify(token);
		const now = this.clock.now();
		return this.uow.runSystemOperation(NOTIFICATIONS_UNSUBSCRIBE_OPERATION, actor, async (scope) => {
			if (target.kind === "contact-point") {
				await scope.accountStore.suppress("EMAIL", target.destinationHash, "unsubscribed contact", "UNSUBSCRIBED", now);
				return { category: "ACCOUNT", channel: "EMAIL", tenantName: null };
			}
			if (target.category === "MARKETING") {
				await scope.accountStore.recordConsent(
					{
						userId: target.userId,
						scope: target.tenantId === null ? "PLATFORM" : "TENANT",
						tenantId: target.tenantId,
						granted: false,
						source: "UNSUBSCRIBE_LINK",
						wordingVersion: MARKETING_CONSENT_WORDING_VERSION,
						ip: requestOf(actor)?.ip ?? null,
						userAgent: requestOf(actor)?.userAgent ?? null,
					},
					now,
				);
			} else if (!mandatoryChannels(target.category).includes("EMAIL")) {
				await scope.accountStore.savePreferences(
					target.userId,
					target.tenantId ?? PLATFORM_PREFERENCE_KEY,
					[{ category: target.category, channel: "EMAIL", enabled: false }],
					now,
				);
			}
			return { category: target.category, channel: "EMAIL", tenantName: target.tenantId === null ? null : await scope.accountStore.tenantName(target.tenantId) };
		});
	}

	/** Reading anywhere clears the delivered notifications from the person's phones and sets the badge (silent push). */
	private async syncDeviceTrays(actor: ActorContext, userId: string): Promise<void> {
		if (!this.cipher.available) {
			return;
		}
		const devices = await this.uow.runSystemOperation(NOTIFICATIONS_INBOX_OPERATION, actor, async (scope) => {
			const active = await scope.accountStore.activeDevices(userId);
			return Promise.all(active.map(async (device) => ({ device, badge: await scope.accountStore.unreadCount(userId, device.surface) })));
		});
		for (const { device, badge } of devices) {
			await this.push.sendSilentSync({ platform: device.platform, ...pushAddressOf(this.cipher, device), deviceId: device.id, badge });
		}
	}
}
