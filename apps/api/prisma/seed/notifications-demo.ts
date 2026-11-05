// ============================================
// prisma/seed/notifications-demo.ts — notifications, broadcasts, limits and private rewards (ADR 070–073)
// ============================================
// Every row is one the API itself leaves behind: customer links built from the seeded claims, consent
// history, a customer's channel settings, devices (sealed with the app's own push-token cipher),
// notifications with each delivery outcome, a tenant's and the platform's broadcasts through their
// lifecycle with a report and strikes, rate-limit overrides, and a reward given to chosen customers.
// Re-running converges: rows are upserted by deterministic id.

import type { NotificationChannel, Prisma } from "@prisma/client";
import { DAY_MS, type RichTextDocument } from "@workspace/shared";

import { getApiConfig } from "../../src/config/api-config";
import { TypedConfigService } from "../../src/config/typed-config.service";
import { BROADCAST_MESSAGE_NOTIFICATION } from "../../src/contexts/notifications/domain/catalog/types/platform.types";
import { NEW_SIGN_IN_NOTIFICATION } from "../../src/contexts/notifications/domain/catalog/types/security.types";
import { isoWeek } from "../../src/contexts/notifications/domain/broadcasts/broadcast-policy";
import { DEFAULT_NOTIFICATION_LOCALE, type NotificationRenderContext } from "../../src/contexts/notifications/domain/catalog/notification-type";
import { destinationHash } from "../../src/contexts/notifications/domain/policies/mask-destination";
import { PLATFORM_PREFERENCE_KEY } from "../../src/contexts/notifications/domain/policies/notification-rules";
import { encryptInstallationId } from "../../src/contexts/notifications/application/services/push-address";
import { GcmPushTokenCipher } from "../../src/contexts/notifications/infrastructure/crypto/gcm-push-token.cipher";
import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";
import { EXTRA_SEED_USER_EMAILS } from "./extra-users";
import { requireRow } from "./require-row";
import { REWARD_SEED_IDS } from "./rewards";
import { TENANT_SEED_IDS } from "./tenant-seed-ids";
import { seedBroadcastImage } from "./broadcast-images";

const NAMESPACE = "seed.notifications";
const CONSENT_WORDING_VERSION = "2026-10";
const SEED_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const SEED_IP = "203.106.93.14";
const CUSTOMER_TIME_ZONE = "Asia/Kuala_Lumpur";
/** Quiet hours 22:00–07:00, as minutes after midnight. */
const QUIET_START_MINUTE = 22 * 60;
const QUIET_END_MINUTE = 7 * 60;
const FAILED_PUSH_ATTEMPTS = 3;
/** The three strikes in 90 days that stop a tenant broadcasting (ADR 073). */
const STRIKES_TO_DISABLE = 3;
const RAISED_TRAFFIC_PER_SECOND = 120;
const RAISED_WEEKLY_BROADCASTS = 10;
const SENT_AUDIENCE = 2;
const PLATFORM_AUDIENCE = 40;
/** The channels a business's offer uses, and a platform notice's (no push for news). */
const TENANT_CHANNELS: NotificationChannel[] = ["IN_APP", "PUSH", "EMAIL"];
const PLATFORM_CHANNELS: NotificationChannel[] = ["IN_APP", "EMAIL"];
const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const WEEK_MS = 7 * DAY_MS;

const SEED_RENDER_CONTEXT: NotificationRenderContext = {
	appName: "Rewards",
	webUrl: "http://localhost:3000",
	merchantUrl: "http://localhost:3002",
	adminUrl: "http://localhost:3001",
	groupCount: 1,
};

/** The fixed ids of the rows below (deterministic, so e2e suites and re-runs find the same rows). */
export const NOTIFICATION_SEED_IDS = Object.freeze({
	privateReward: deterministicUuid(NAMESPACE, "reward.private"),
	sentBroadcast: deterministicUuid(NAMESPACE, "broadcast.kl.sent"),
	scheduledBroadcast: deterministicUuid(NAMESPACE, "broadcast.kl.scheduled"),
	draftBroadcast: deterministicUuid(NAMESPACE, "broadcast.kl.draft"),
	pausedBroadcast: deterministicUuid(NAMESPACE, "broadcast.kl.paused"),
	cancelledBroadcast: deterministicUuid(NAMESPACE, "broadcast.mlk.cancelled"),
	platformBroadcast: deterministicUuid(NAMESPACE, "broadcast.platform.sent"),
	pendingPlatformBroadcast: deterministicUuid(NAMESPACE, "broadcast.platform.pending"),
});

export interface NotificationsDemoSummary {
	readonly tenantCustomers: number;
	readonly notifications: number;
	readonly broadcasts: number;
	/** Consent records written for the developer's test accounts (`TEST_ACCOUNT_EMAILS`). */
	readonly testAccountConsents: number;
	readonly devices: number | "skipped";
}

interface SeedPeople {
	readonly customerId: string;
	readonly otherCustomerId: string;
	readonly klOwnerId: string;
	readonly mlkOwnerId: string;
	readonly adminId: string;
	readonly superAdminId: string;
}

function bodyOf(...paragraphs: string[]): RichTextDocument {
	return { type: "doc", content: paragraphs.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })) };
}

/** The catalog's in-app copy for a seeded notice (every type seeded here has one). */
function rendered<T>(rendering: T | null, label: string): T {
	if (rendering === null) {
		throw new Error(`Seed: ${label} has no in-app rendering`);
	}
	return rendering;
}

function at(now: number, agoMs: number): bigint {
	return BigInt(now - agoMs);
}

/**
 * Customer links (ADR 073) from the seeded claims: one per tenant and person, counted from their claims and
 * stamped with their last redemption. One customer has left Brew & Bean KL (and withdrew consent).
 */
async function seedTenantCustomers(people: SeedPeople, now: number): Promise<number> {
	const claims = await prisma.rewardClaim.findMany({ where: { isDeleted: false }, select: { userId: true, createdAt: true, reward: { select: { tenantId: true } } } });
	const redemptions = await prisma.rewardRedemption.findMany({ where: { isDeleted: false }, select: { tenantId: true, userId: true, createdAt: true } });
	const lastRedeemed = new Map<string, bigint>();
	for (const redemption of redemptions) {
		const key = `${redemption.tenantId}:${redemption.userId}`;
		const previous = lastRedeemed.get(key);
		lastRedeemed.set(key, previous === undefined || redemption.createdAt > previous ? redemption.createdAt : previous);
	}
	const links = new Map<string, { tenantId: string; userId: string; first: bigint; last: bigint; count: number }>();
	for (const claim of claims) {
		const key = `${claim.reward.tenantId}:${claim.userId}`;
		const link = links.get(key);
		links.set(
			key,
			link === undefined
				? { tenantId: claim.reward.tenantId, userId: claim.userId, first: claim.createdAt, last: claim.createdAt, count: 1 }
				: {
						...link,
						first: claim.createdAt < link.first ? claim.createdAt : link.first,
						last: claim.createdAt > link.last ? claim.createdAt : link.last,
						count: link.count + 1,
					},
		);
	}
	for (const [key, link] of links) {
		const left = link.tenantId === TENANT_SEED_IDS.klTenant && link.userId === people.otherCustomerId;
		const row = {
			tenantId: link.tenantId,
			userId: link.userId,
			firstClaimedAt: link.first,
			lastClaimedAt: link.last,
			claimCount: link.count,
			lastRedeemedAt: lastRedeemed.get(key) ?? null,
			leftAt: left ? at(now, DAY_MS) : null,
			createdAt: link.first,
			updatedAt: link.last,
		};
		await prisma.tenantCustomer.upsert({ where: { tenantId_userId: { tenantId: link.tenantId, userId: link.userId } }, create: row, update: row });
	}
	return links.size;
}

type SeedConsent = Omit<Prisma.MarketingConsentUncheckedCreateInput, "id" | "wordingVersion" | "occurredAt"> & { readonly id: string; readonly occurredAt: bigint };

/** Consent history: the customer agreed at sign-up and at a first claim; the other customer later left a tenant. */
async function seedMarketingConsent(people: SeedPeople, now: number): Promise<void> {
	const rows: SeedConsent[] = [
		{
			id: deterministicUuid(NAMESPACE, "consent.platform"),
			userId: people.customerId,
			scope: "PLATFORM",
			tenantId: null,
			granted: true,
			source: "SIGNUP",
			ip: null,
			userAgent: null,
			occurredAt: at(now, 90 * DAY_MS),
		},
		{
			id: deterministicUuid(NAMESPACE, "consent.kl"),
			userId: people.customerId,
			scope: "TENANT",
			tenantId: TENANT_SEED_IDS.klTenant,
			granted: true,
			source: "FIRST_CLAIM",
			ip: SEED_IP,
			userAgent: SEED_USER_AGENT,
			occurredAt: at(now, 30 * DAY_MS),
		},
		{
			id: deterministicUuid(NAMESPACE, "consent.mlk"),
			userId: people.customerId,
			scope: "TENANT",
			tenantId: TENANT_SEED_IDS.mlkTenant,
			granted: true,
			source: "SETTINGS",
			ip: SEED_IP,
			userAgent: SEED_USER_AGENT,
			occurredAt: at(now, 20 * DAY_MS),
		},
		{
			id: deterministicUuid(NAMESPACE, "consent.other.kl"),
			userId: people.otherCustomerId,
			scope: "TENANT",
			tenantId: TENANT_SEED_IDS.klTenant,
			granted: true,
			source: "FIRST_CLAIM",
			ip: SEED_IP,
			userAgent: SEED_USER_AGENT,
			occurredAt: at(now, 40 * DAY_MS),
		},
		{
			id: deterministicUuid(NAMESPACE, "consent.other.kl.left"),
			userId: people.otherCustomerId,
			scope: "TENANT",
			tenantId: TENANT_SEED_IDS.klTenant,
			granted: false,
			source: "LEAVE_TENANT",
			ip: SEED_IP,
			userAgent: SEED_USER_AGENT,
			occurredAt: at(now, DAY_MS),
		},
		{
			id: deterministicUuid(NAMESPACE, "consent.other.platform"),
			userId: people.otherCustomerId,
			scope: "PLATFORM",
			tenantId: null,
			granted: false,
			source: "UNSUBSCRIBE_LINK",
			ip: SEED_IP,
			userAgent: SEED_USER_AGENT,
			occurredAt: at(now, 3 * DAY_MS),
		},
	];
	// Consent history is append-only (UPDATE is withheld): a re-run inserts what is missing and never rewrites a record.
	await prisma.marketingConsent.createMany({
		data: rows.map((row) => ({ ...row, wordingVersion: CONSENT_WORDING_VERSION, createdAt: row.occurredAt, updatedAt: row.occurredAt })),
		skipDuplicates: true,
	});
}

/**
 * The developer's own test accounts: opted in to the platform's offers and to every store they are a
 * customer of (a customer link comes only from a claim), so a broadcast can be tried on them straight
 * after a seed.
 */
export const TEST_ACCOUNT_EMAILS: readonly string[] = ["superadmin@example.com", "bishenpatel123@gmail.com"];

async function seedTestAccountConsent(now: number): Promise<number> {
	const accounts = await prisma.user.findMany({ where: { email: { in: [...TEST_ACCOUNT_EMAILS] }, isDeleted: false }, select: { id: true, email: true } });
	const links = await prisma.tenantCustomer.findMany({
		where: { userId: { in: accounts.map((account) => account.id) }, leftAt: null },
		select: { userId: true, tenantId: true },
	});
	const rows: SeedConsent[] = accounts.flatMap((account): SeedConsent[] => [
		{
			id: deterministicUuid(NAMESPACE, `consent.test.${account.email}.platform`),
			userId: account.id,
			scope: "PLATFORM",
			tenantId: null,
			granted: true,
			source: "SETTINGS",
			ip: SEED_IP,
			userAgent: SEED_USER_AGENT,
			occurredAt: at(now, DAY_MS),
		},
		...links
			.filter((link) => link.userId === account.id)
			.map((link): SeedConsent => ({
				id: deterministicUuid(NAMESPACE, `consent.test.${account.email}.${link.tenantId}`),
				userId: account.id,
				scope: "TENANT",
				tenantId: link.tenantId,
				granted: true,
				source: "SETTINGS",
				ip: SEED_IP,
				userAgent: SEED_USER_AGENT,
				occurredAt: at(now, DAY_MS),
			})),
	]);
	// Append-only like every consent record: a re-run adds what is missing and never rewrites one.
	await prisma.marketingConsent.createMany({
		data: rows.map((row) => ({ ...row, wordingVersion: CONSENT_WORDING_VERSION, createdAt: row.occurredAt, updatedAt: row.occurredAt })),
		skipDuplicates: true,
	});
	return rows.length;
}

/** The customer's channel settings: no marketing email from anyone, but Brew & Bean KL's pushes on; quiet nights; a daily digest. */
async function seedNotificationSettings(people: SeedPeople): Promise<void> {
	const preferences: Prisma.NotificationPreferenceUncheckedCreateInput[] = [
		{
			id: deterministicUuid(NAMESPACE, "preference.marketing.email"),
			userId: people.customerId,
			tenantKey: PLATFORM_PREFERENCE_KEY,
			category: "MARKETING",
			channel: "EMAIL",
			enabled: false,
		},
		{
			id: deterministicUuid(NAMESPACE, "preference.kl.push"),
			userId: people.customerId,
			tenantKey: TENANT_SEED_IDS.klTenant,
			category: "MARKETING",
			channel: "PUSH",
			enabled: true,
		},
		{
			id: deterministicUuid(NAMESPACE, "preference.product.push"),
			userId: people.customerId,
			tenantKey: PLATFORM_PREFERENCE_KEY,
			category: "PRODUCT",
			channel: "PUSH",
			enabled: false,
		},
	];
	for (const row of preferences) {
		await prisma.notificationPreference.upsert({ where: { id: row.id ?? "" }, create: row, update: row });
	}
	const schedule: Prisma.NotificationScheduleUncheckedCreateInput = {
		userId: people.customerId,
		quietHoursEnabled: true,
		quietStartMinute: QUIET_START_MINUTE,
		quietEndMinute: QUIET_END_MINUTE,
		timeZone: CUSTOMER_TIME_ZONE,
		digestFrequency: "DAILY",
	};
	await prisma.notificationSchedule.upsert({ where: { userId: people.customerId }, create: schedule, update: schedule });
}

/** A hard-bounced address still suppressed, and a phone number whose STOP was lifted by support. */
async function seedSuppressions(people: SeedPeople, now: number): Promise<void> {
	const rows: Prisma.NotificationSuppressionUncheckedCreateInput[] = [
		{
			id: deterministicUuid(NAMESPACE, "suppression.bounce"),
			channel: "EMAIL",
			destinationHash: destinationHash("old.address@bounced.example.com"),
			maskedDestination: "o•••@bounced.example.com",
			cause: "HARD_BOUNCE",
			liftedAt: null,
			liftedBy: null,
			liftReason: null,
			createdAt: at(now, 12 * DAY_MS),
			updatedAt: at(now, 12 * DAY_MS),
		},
		{
			id: deterministicUuid(NAMESPACE, "suppression.stop.lifted"),
			channel: "SMS",
			destinationHash: destinationHash("+60123456789"),
			maskedDestination: "+60••••6789",
			cause: "SMS_STOP",
			liftedAt: at(now, 2 * DAY_MS),
			liftedBy: people.adminId,
			liftReason: "The customer called support and asked for codes by SMS again.",
			createdAt: at(now, 9 * DAY_MS),
			updatedAt: at(now, 2 * DAY_MS),
		},
	];
	for (const row of rows) {
		await prisma.notificationSuppression.upsert({ where: { id: row.id ?? "" }, create: row, update: row });
	}
}

interface SeedDevice {
	readonly key: string;
	readonly platform: Prisma.PushDeviceUncheckedCreateInput["platform"];
	readonly token: string;
	/** Android's Firebase Installation ID, which FCM sends by (5.3); iOS has none. */
	readonly installationId: string | null;
	readonly sessionId: string;
	readonly label: string;
	readonly appVersion: string;
	readonly revoked: boolean;
}

/**
 * The customer's phones: an Android phone in use (with its installation ID, 5.3) and an old iPhone revoked when its
 * session ended. Tokens and the installation ID are sealed with the app's cipher; without `NOTIFICATIONS_ENCRYPTION_KEYS` nothing can be sealed, so none are seeded.
 */
async function seedPushDevices(people: SeedPeople, now: number): Promise<{ readonly activeDeviceId: string | null; readonly count: number | "skipped" }> {
	const cipher = new GcmPushTokenCipher(new TypedConfigService(getApiConfig()).notifications.encryptionKeys);
	if (!cipher.available) {
		return { activeDeviceId: null, count: "skipped" };
	}
	const sessions = await prisma.refreshToken.findMany({ where: { userId: people.customerId }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], select: { id: true } });
	const [current, older] = sessions;
	const session = requireRow(current, "a refresh token of user@example.com");
	const devices: readonly SeedDevice[] = [
		{
			key: "android",
			platform: "ANDROID",
			token: "seed-fcm-token-pixel-8",
			installationId: "fSeedPixel8Install0001",
			sessionId: session.id,
			label: "Pixel 8",
			appVersion: "1.4.0",
			revoked: false,
		},
		{
			key: "ios",
			platform: "IOS",
			token: "seed-apns-token-iphone-12",
			installationId: null,
			sessionId: (older ?? session).id,
			label: "iPhone 12",
			appVersion: "1.2.3",
			revoked: true,
		},
	];
	for (const device of devices) {
		const id = deterministicUuid(NAMESPACE, `device.${device.key}`);
		const row: Prisma.PushDeviceUncheckedCreateInput = {
			id,
			userId: people.customerId,
			deviceSessionId: device.sessionId,
			platform: device.platform,
			surface: "CUSTOMER",
			tokenCiphertext: cipher.encrypt(device.token, id),
			tokenHash: destinationHash(device.token),
			installationIdCiphertext: encryptInstallationId(cipher, device.installationId, id),
			deviceLabel: device.label,
			appVersion: device.appVersion,
			lastSeenAt: at(now, device.revoked ? 45 * DAY_MS : HOUR_MS),
			revokedAt: device.revoked ? at(now, 40 * DAY_MS) : null,
			revokedReason: device.revoked ? "session-ended" : null,
			createdAt: at(now, 60 * DAY_MS),
			updatedAt: at(now, device.revoked ? 40 * DAY_MS : HOUR_MS),
		};
		await prisma.pushDevice.upsert({ where: { id }, create: row, update: row });
	}
	return { activeDeviceId: deterministicUuid(NAMESPACE, "device.android"), count: devices.length };
}

/**
 * A new-sign-in notice with every delivery outcome: the in-app row (read), the email delivered and opened,
 * the push that failed three times and fell back to that email, and an SMS held for quiet hours. One older
 * notice is past retention (soft-deleted with its rows), and one went to an invitee who has no account yet.
 */
async function seedNotifications(people: SeedPeople, activeDeviceId: string | null, now: number): Promise<number> {
	const signedInAt = now - 2 * HOUR_MS;
	const payload = NEW_SIGN_IN_NOTIFICATION.declaration.toJson({ device: "Safari on macOS", location: "Kuala Lumpur, Malaysia", signedInAt });
	const rendering = rendered(NEW_SIGN_IN_NOTIFICATION.renderInApp(payload, DEFAULT_NOTIFICATION_LOCALE, SEED_RENDER_CONTEXT), "new sign-in in-app copy");
	const notices = [
		{ key: "sign-in.recent", createdAt: at(now, 2 * HOUR_MS), deleted: false, groupKey: "sign-in:safari-macos", notBefore: null },
		{ key: "sign-in.expired", createdAt: at(now, 200 * DAY_MS), deleted: true, groupKey: null, notBefore: at(now, 200 * DAY_MS - MINUTE_MS) },
	];
	for (const notice of notices) {
		const id = deterministicUuid(NAMESPACE, `notification.${notice.key}`);
		const softDelete = notice.deleted ? { isDeleted: true, deletedAt: at(now, DAY_MS), deletedBy: "notifications.retention" } : {};
		const notification: Prisma.NotificationUncheckedCreateInput = {
			id,
			recipientUserId: people.customerId,
			recipientKey: people.customerId,
			contactAddress: null,
			tenantId: null,
			typeKey: NEW_SIGN_IN_NOTIFICATION.key,
			category: NEW_SIGN_IN_NOTIFICATION.category,
			dedupeKey: notice.key,
			payload: notice.deleted ? {} : payload,
			locale: DEFAULT_NOTIFICATION_LOCALE,
			broadcastId: null,
			groupKey: notice.groupKey,
			fannedOutAt: notice.createdAt + BigInt(SECOND_MS),
			notBefore: notice.notBefore,
			createdAt: notice.createdAt,
			updatedAt: notice.createdAt,
			...softDelete,
		};
		await prisma.notification.upsert({ where: { id }, create: notification, update: notification });
		const inAppId = deterministicUuid(NAMESPACE, `in-app.${notice.key}`);
		const inApp: Prisma.InAppNotificationUncheckedCreateInput = {
			id: inAppId,
			notificationId: id,
			userId: people.customerId,
			tenantId: null,
			surface: "CUSTOMER",
			typeKey: NEW_SIGN_IN_NOTIFICATION.key,
			category: NEW_SIGN_IN_NOTIFICATION.category,
			title: rendering.title,
			body: rendering.body,
			link: rendering.link,
			icon: rendering.icon,
			groupKey: notice.groupKey,
			groupCount: 1,
			readAt: notice.createdAt + BigInt(MINUTE_MS),
			archivedAt: notice.deleted ? notice.createdAt + BigInt(DAY_MS) : null,
			createdAt: notice.createdAt,
			updatedAt: notice.createdAt,
			...softDelete,
		};
		await prisma.inAppNotification.upsert({ where: { id: inAppId }, create: inApp, update: inApp });
		const emailId = deterministicUuid(NAMESPACE, `delivery.${notice.key}.email`);
		const sent = notice.createdAt + BigInt(SECOND_MS);
		const deliveries: Prisma.NotificationDeliveryUncheckedCreateInput[] = [
			{
				id: emailId,
				notificationId: id,
				recipientUserId: people.customerId,
				tenantId: null,
				typeKey: NEW_SIGN_IN_NOTIFICATION.key,
				channel: "EMAIL",
				status: "DELIVERED",
				attempts: 1,
				maskedDestination: "u•••@example.com",
				providerMessageId: `seed-ses-${notice.key}`,
				sentAt: sent,
				deliveredAt: sent + BigInt(SECOND_MS),
				openedAt: sent + BigInt(10 * MINUTE_MS),
				...softDelete,
			},
			{
				id: deterministicUuid(NAMESPACE, `delivery.${notice.key}.push`),
				notificationId: id,
				recipientUserId: people.customerId,
				tenantId: null,
				typeKey: NEW_SIGN_IN_NOTIFICATION.key,
				channel: "PUSH",
				status: "FAILED",
				attempts: FAILED_PUSH_ATTEMPTS,
				maskedDestination: "Pixel 8",
				pushDeviceId: activeDeviceId,
				lastError: "FCM: UNAVAILABLE (the service was temporarily unavailable)",
				fallbackDeliveryId: emailId,
				...softDelete,
			},
			{
				id: deterministicUuid(NAMESPACE, `delivery.${notice.key}.sms`),
				notificationId: id,
				recipientUserId: people.customerId,
				tenantId: null,
				typeKey: NEW_SIGN_IN_NOTIFICATION.key,
				channel: "SMS",
				status: "HELD",
				reason: "quiet-hours",
				heldUntil: notice.createdAt + BigInt(8 * HOUR_MS),
				attempts: 0,
				maskedDestination: "+60••••6789",
				...softDelete,
			},
		];
		for (const delivery of deliveries) {
			const row = { ...delivery, createdAt: notice.createdAt, updatedAt: notice.createdAt };
			await prisma.notificationDelivery.upsert({ where: { id: row.id ?? "" }, create: row, update: row });
		}
	}
	// A team invite to someone with no account yet: addressed by contact, never an inbox row.
	const inviteId = deterministicUuid(NAMESPACE, "notification.invite");
	const address = "new.cashier@example.com";
	const invite: Prisma.NotificationUncheckedCreateInput = {
		id: inviteId,
		recipientUserId: null,
		recipientKey: destinationHash(address),
		contactAddress: address,
		tenantId: TENANT_SEED_IDS.klTenant,
		typeKey: NEW_SIGN_IN_NOTIFICATION.key,
		category: "ACCOUNT",
		dedupeKey: "invite.new-cashier",
		payload,
		locale: DEFAULT_NOTIFICATION_LOCALE,
		fannedOutAt: at(now, DAY_MS),
		createdAt: at(now, DAY_MS),
		updatedAt: at(now, DAY_MS),
	};
	await prisma.notification.upsert({ where: { id: inviteId }, create: invite, update: invite });
	const inviteDelivery: Prisma.NotificationDeliveryUncheckedCreateInput = {
		id: deterministicUuid(NAMESPACE, "delivery.invite.email"),
		notificationId: inviteId,
		recipientUserId: null,
		tenantId: TENANT_SEED_IDS.klTenant,
		typeKey: NEW_SIGN_IN_NOTIFICATION.key,
		channel: "EMAIL",
		status: "SENT",
		attempts: 1,
		maskedDestination: "n•••@example.com",
		providerMessageId: "seed-ses-invite",
		sentAt: at(now, DAY_MS),
		createdAt: at(now, DAY_MS),
		updatedAt: at(now, DAY_MS),
	};
	await prisma.notificationDelivery.upsert({ where: { id: inviteDelivery.id ?? "" }, create: inviteDelivery, update: inviteDelivery });
	return notices.length + 1;
}

interface SeedBroadcast {
	readonly id: string;
	readonly row: Prisma.BroadcastUncheckedCreateInput;
}

function tenantAudience(customerIds: readonly string[] | null): Prisma.InputJsonObject {
	return { kind: "tenant-customers", claimedWithinDays: 90, redeemed: "any", locationId: null, customerIds: customerIds === null ? null : [...customerIds] };
}

/**
 * Broadcasts through their lifecycle: Brew & Bean KL's sent offer (in two inboxes, reported once), one
 * scheduled for each customer's 09:00, a draft to two chosen customers, one paused after a report;
 * Melaka's cancelled one (its report upheld: a strike); a platform notice to every user, approved by a second
 * staff member, and another waiting for approval. A lifecycle tenant has three strikes and broadcasting off.
 */
async function seedBroadcasts(people: SeedPeople, now: number): Promise<number> {
	const sentAt = now - 3 * DAY_MS;
	const tomorrowNine = Date.UTC(new Date(now + DAY_MS).getUTCFullYear(), new Date(now + DAY_MS).getUTCMonth(), new Date(now + DAY_MS).getUTCDate(), 9);
	const offer = bodyOf("Two-for-one lattes all weekend at Brew & Bean KL.", "Show this message at the counter.");
	// The draft shows the store's picture (enhancement 5.4): a seeded BROADCAST_IMAGE named by file id only.
	const thankYouPicture = await seedBroadcastImage(people.klOwnerId);
	const thankYou = bodyOf("Thank you for visiting us every week — your next coffee is on us.");
	const thankYouBody: RichTextDocument = {
		...thankYou,
		content: [{ type: "image", attrs: { fileId: thankYouPicture, alt: "A slice of our chocolate cake" } }, ...thankYou.content],
	};
	const ids = NOTIFICATION_SEED_IDS;
	const broadcasts: SeedBroadcast[] = [
		{
			id: ids.sentBroadcast,
			row: {
				id: ids.sentBroadcast,
				tenantId: TENANT_SEED_IDS.klTenant,
				authorUserId: people.klOwnerId,
				status: "SENT",
				category: "MARKETING",
				channels: TENANT_CHANNELS,
				title: "Weekend latte offer",
				body: offer,
				audienceFilter: tenantAudience(null),
				sendMode: "INSTANT",
				startsAt: BigInt(sentAt),
				sendingWeek: isoWeek(sentAt),
				audienceCount: SENT_AUDIENCE,
				sendingStartedAt: BigInt(sentAt),
				completedAt: BigInt(sentAt + MINUTE_MS),
				createdAt: BigInt(sentAt - DAY_MS),
				updatedAt: BigInt(sentAt + MINUTE_MS),
			},
		},
		{
			id: ids.scheduledBroadcast,
			row: {
				id: ids.scheduledBroadcast,
				tenantId: TENANT_SEED_IDS.klTenant,
				authorUserId: people.klOwnerId,
				status: "SCHEDULED",
				category: "MARKETING",
				channels: TENANT_CHANNELS,
				title: "Fresh pastries at 9",
				body: bodyOf("Our croissants come out of the oven at 9 every morning."),
				audienceFilter: tenantAudience(null),
				sendMode: "RECIPIENT_LOCAL_TIME",
				localSendAt: BigInt(tomorrowNine),
				startsAt: BigInt(tomorrowNine - 14 * HOUR_MS),
				createdAt: at(now, HOUR_MS),
				updatedAt: at(now, HOUR_MS),
			},
		},
		{
			id: ids.draftBroadcast,
			row: {
				id: ids.draftBroadcast,
				tenantId: TENANT_SEED_IDS.klTenant,
				authorUserId: people.klOwnerId,
				status: "DRAFT",
				category: "MARKETING",
				channels: TENANT_CHANNELS,
				title: "A thank-you for our regulars",
				body: thankYouBody,
				audienceFilter: tenantAudience([people.customerId, people.otherCustomerId]),
				sendMode: "INSTANT",
				sendAt: BigInt(now + 2 * DAY_MS),
				createdAt: at(now, 2 * HOUR_MS),
				updatedAt: at(now, 2 * HOUR_MS),
			},
		},
		{
			id: ids.pausedBroadcast,
			row: {
				id: ids.pausedBroadcast,
				tenantId: TENANT_SEED_IDS.klTenant,
				authorUserId: people.klOwnerId,
				status: "PAUSED",
				category: "MARKETING",
				channels: TENANT_CHANNELS,
				title: "Flash sale tonight",
				body: bodyOf("Everything half price after 8pm."),
				audienceFilter: tenantAudience(null),
				sendMode: "INSTANT",
				startsAt: at(now, 5 * HOUR_MS),
				pausedAt: at(now, 4 * HOUR_MS),
				pauseReason: "Paused after 1 report(s)",
				createdAt: at(now, DAY_MS),
				updatedAt: at(now, 4 * HOUR_MS),
			},
		},
		{
			id: ids.cancelledBroadcast,
			row: {
				id: ids.cancelledBroadcast,
				tenantId: TENANT_SEED_IDS.mlkTenant,
				authorUserId: people.mlkOwnerId,
				status: "CANCELLED",
				category: "MARKETING",
				channels: TENANT_CHANNELS,
				title: "Win a free trip",
				body: bodyOf("Reply with your bank details to claim your prize."),
				audienceFilter: tenantAudience(null),
				sendMode: "INSTANT",
				startsAt: at(now, 6 * DAY_MS),
				sendingWeek: isoWeek(now - 6 * DAY_MS),
				audienceCount: 1,
				sendingStartedAt: at(now, 6 * DAY_MS),
				cancelledAt: at(now, 5 * DAY_MS),
				createdAt: at(now, 7 * DAY_MS),
				updatedAt: at(now, 5 * DAY_MS),
			},
		},
		{
			id: ids.platformBroadcast,
			row: {
				id: ids.platformBroadcast,
				tenantId: null,
				authorUserId: people.adminId,
				approverUserId: people.superAdminId,
				status: "SENT",
				category: "PRODUCT",
				channels: PLATFORM_CHANNELS,
				title: "Rewards now works offline",
				body: bodyOf("Your claimed rewards now open even without a connection."),
				audienceFilter: { kind: "platform-users", surfaces: ["CUSTOMER", "MERCHANT", "ADMIN"], signedUpAfter: null, tenantStates: null },
				sendMode: "INSTANT",
				startsAt: at(now, 10 * DAY_MS),
				sendingWeek: isoWeek(now - 10 * DAY_MS),
				audienceCount: PLATFORM_AUDIENCE,
				sendingStartedAt: at(now, 10 * DAY_MS),
				completedAt: at(now, 10 * DAY_MS - 5 * MINUTE_MS),
				approvedAt: at(now, 10 * DAY_MS + HOUR_MS),
				createdAt: at(now, 11 * DAY_MS),
				updatedAt: at(now, 10 * DAY_MS - 5 * MINUTE_MS),
			},
		},
		{
			id: ids.pendingPlatformBroadcast,
			row: {
				id: ids.pendingPlatformBroadcast,
				tenantId: null,
				authorUserId: people.adminId,
				status: "PENDING_APPROVAL",
				category: "ACCOUNT",
				channels: PLATFORM_CHANNELS,
				title: "Updated terms of service",
				body: bodyOf("We are updating our terms on 1 December. Nothing changes in how you use Rewards."),
				audienceFilter: { kind: "platform-users", surfaces: ["CUSTOMER", "MERCHANT", "ADMIN"], signedUpAfter: null, tenantStates: null },
				sendMode: "INSTANT",
				createdAt: at(now, HOUR_MS),
				updatedAt: at(now, HOUR_MS),
			},
		},
	];
	for (const broadcast of broadcasts) {
		await prisma.broadcast.upsert({ where: { id: broadcast.id }, create: broadcast.row, update: broadcast.row });
	}
	await seedBroadcastInbox(people, offer, sentAt);
	await seedReportsAndStrikes(people, now);
	return broadcasts.length;
}

/** The sent offer as both customers received it: the notification and its rich inbox row. */
async function seedBroadcastInbox(people: SeedPeople, offer: RichTextDocument, sentAt: number): Promise<void> {
	const payload = BROADCAST_MESSAGE_NOTIFICATION.declaration.toJson({
		broadcastId: NOTIFICATION_SEED_IDS.sentBroadcast,
		title: "Weekend latte offer",
		preview: "Two-for-one lattes all weekend at Brew & Bean KL.",
		senderName: "Brew & Bean KL",
		senderLogoUrl: null,
	});
	const rendering = rendered(BROADCAST_MESSAGE_NOTIFICATION.renderInApp(payload, DEFAULT_NOTIFICATION_LOCALE, SEED_RENDER_CONTEXT), "broadcast in-app copy");
	for (const [key, userId, read] of [
		["customer", people.customerId, true],
		["other", people.otherCustomerId, false],
	] satisfies [string, string, boolean][]) {
		const id = deterministicUuid(NAMESPACE, `broadcast.notification.${key}`);
		const notification: Prisma.NotificationUncheckedCreateInput = {
			id,
			recipientUserId: userId,
			recipientKey: userId,
			tenantId: TENANT_SEED_IDS.klTenant,
			typeKey: BROADCAST_MESSAGE_NOTIFICATION.key,
			category: "MARKETING",
			dedupeKey: `broadcast:${NOTIFICATION_SEED_IDS.sentBroadcast}`,
			payload,
			locale: DEFAULT_NOTIFICATION_LOCALE,
			broadcastId: NOTIFICATION_SEED_IDS.sentBroadcast,
			fannedOutAt: BigInt(sentAt + SECOND_MS),
			createdAt: BigInt(sentAt),
			updatedAt: BigInt(sentAt),
		};
		await prisma.notification.upsert({ where: { id }, create: notification, update: notification });
		const inAppId = deterministicUuid(NAMESPACE, `broadcast.in-app.${key}`);
		const inApp: Prisma.InAppNotificationUncheckedCreateInput = {
			id: inAppId,
			notificationId: id,
			userId,
			tenantId: TENANT_SEED_IDS.klTenant,
			surface: "CUSTOMER",
			typeKey: BROADCAST_MESSAGE_NOTIFICATION.key,
			category: "MARKETING",
			title: rendering.title,
			body: rendering.body,
			richBody: offer,
			link: rendering.link,
			icon: rendering.icon,
			senderName: "Brew & Bean KL",
			senderLogoUrl: "https://placehold.co/96x96/png?text=BB",
			broadcastId: NOTIFICATION_SEED_IDS.sentBroadcast,
			readAt: read ? BigInt(sentAt + HOUR_MS) : null,
			createdAt: BigInt(sentAt),
			updatedAt: BigInt(sentAt),
		};
		await prisma.inAppNotification.upsert({ where: { id: inAppId }, create: inApp, update: inApp });
	}
}

/** A customer's open report on the paused flash sale; Melaka's scam upheld (a strike); a lifecycle tenant's three strikes. */
async function seedReportsAndStrikes(people: SeedPeople, now: number): Promise<void> {
	const reports: Prisma.BroadcastReportUncheckedCreateInput[] = [
		{
			id: deterministicUuid(NAMESPACE, "report.open"),
			broadcastId: NOTIFICATION_SEED_IDS.pausedBroadcast,
			tenantId: TENANT_SEED_IDS.klTenant,
			reporterUserId: people.otherCustomerId,
			reason: "SPAM",
			note: "Third offer from them this week.",
			status: "OPEN",
			createdAt: at(now, 4 * HOUR_MS),
			updatedAt: at(now, 4 * HOUR_MS),
		},
		{
			id: deterministicUuid(NAMESPACE, "report.upheld"),
			broadcastId: NOTIFICATION_SEED_IDS.cancelledBroadcast,
			tenantId: TENANT_SEED_IDS.mlkTenant,
			reporterUserId: people.customerId,
			reason: "SCAM",
			note: "Asks for bank details.",
			status: "UPHELD",
			reviewedBy: people.adminId,
			reviewedAt: at(now, 5 * DAY_MS),
			createdAt: at(now, 6 * DAY_MS),
			updatedAt: at(now, 5 * DAY_MS),
		},
	];
	for (const report of reports) {
		await prisma.broadcastReport.upsert({ where: { id: report.id ?? "" }, create: report, update: report });
	}
	const mlkStrike: Prisma.TenantBroadcastStrikeUncheckedCreateInput = {
		id: deterministicUuid(NAMESPACE, "strike.mlk"),
		tenantId: TENANT_SEED_IDS.mlkTenant,
		broadcastId: NOTIFICATION_SEED_IDS.cancelledBroadcast,
		issuedBy: people.adminId,
		issuedAt: at(now, 5 * DAY_MS),
		createdAt: at(now, 5 * DAY_MS),
		updatedAt: at(now, 5 * DAY_MS),
	};
	await prisma.tenantBroadcastStrike.upsert({ where: { id: mlkStrike.id ?? "" }, create: mlkStrike, update: mlkStrike });

	const banned = await prisma.tenant.findFirst({ where: { lifecycleState: "BANNED" }, orderBy: { id: "asc" }, select: { id: true } });
	if (banned === null) {
		return;
	}
	for (let strike = 1; strike <= STRIKES_TO_DISABLE; strike += 1) {
		const key = `banned.${String(strike)}`;
		const broadcastId = deterministicUuid(NAMESPACE, `broadcast.${key}`);
		const issuedAt = at(now, (40 - strike * 10) * DAY_MS);
		const broadcast: Prisma.BroadcastUncheckedCreateInput = {
			id: broadcastId,
			tenantId: banned.id,
			authorUserId: people.superAdminId,
			status: "CANCELLED",
			category: "MARKETING",
			channels: TENANT_CHANNELS,
			title: `Counterfeit voucher sale #${String(strike)}`,
			body: bodyOf("Buy vouchers at 90% off — today only."),
			audienceFilter: tenantAudience(null),
			sendMode: "INSTANT",
			cancelledAt: issuedAt,
			createdAt: issuedAt - BigInt(DAY_MS),
			updatedAt: issuedAt,
		};
		await prisma.broadcast.upsert({ where: { id: broadcastId }, create: broadcast, update: broadcast });
		const row: Prisma.TenantBroadcastStrikeUncheckedCreateInput = {
			id: deterministicUuid(NAMESPACE, `strike.${key}`),
			tenantId: banned.id,
			broadcastId,
			issuedBy: people.adminId,
			issuedAt,
			createdAt: issuedAt,
			updatedAt: issuedAt,
		};
		await prisma.tenantBroadcastStrike.upsert({ where: { id: row.id ?? "" }, create: row, update: row });
	}
	await prisma.tenant.update({ where: { id: banned.id }, data: { broadcastsDisabledAt: at(now, 10 * DAY_MS) } });
}

/** Brew & Bean KL's raised traffic limit and weekly broadcasts, and an older override support removed. */
async function seedRateLimitOverrides(people: SeedPeople, now: number): Promise<void> {
	const rows: Prisma.TenantRateLimitOverrideUncheckedCreateInput[] = [
		{
			id: deterministicUuid(NAMESPACE, "override.traffic"),
			tenantId: TENANT_SEED_IDS.klTenant,
			policyName: "TENANT_TRAFFIC",
			limit: RAISED_TRAFFIC_PER_SECOND,
			windowMs: BigInt(SECOND_MS),
			reason: "Year-end campaign: the POS integration batches checkouts.",
			expiresAt: BigInt(now + 30 * DAY_MS),
			setByUserId: people.superAdminId,
			createdAt: at(now, DAY_MS),
			updatedAt: at(now, DAY_MS),
		},
		{
			id: deterministicUuid(NAMESPACE, "override.broadcasts"),
			tenantId: TENANT_SEED_IDS.klTenant,
			policyName: "TENANT_BROADCASTS",
			limit: RAISED_WEEKLY_BROADCASTS,
			windowMs: BigInt(WEEK_MS),
			reason: "Grand-opening fortnight for the second outlet.",
			expiresAt: BigInt(now + 14 * DAY_MS),
			setByUserId: people.superAdminId,
			createdAt: at(now, 2 * DAY_MS),
			updatedAt: at(now, 2 * DAY_MS),
		},
		{
			id: deterministicUuid(NAMESPACE, "override.traffic.removed"),
			tenantId: TENANT_SEED_IDS.mlkTenant,
			policyName: "API_KEY_TRAFFIC",
			limit: RAISED_TRAFFIC_PER_SECOND,
			windowMs: BigInt(SECOND_MS),
			reason: "Load test of the new till integration.",
			expiresAt: at(now, 5 * DAY_MS),
			setByUserId: people.superAdminId,
			isDeleted: true,
			deletedAt: at(now, 6 * DAY_MS),
			deletedBy: people.superAdminId,
			createdAt: at(now, 9 * DAY_MS),
			updatedAt: at(now, 6 * DAY_MS),
		},
	];
	for (const row of rows) {
		await prisma.tenantRateLimitOverride.upsert({ where: { id: row.id ?? "" }, create: row, update: row });
	}
}

/**
 * A Brew & Bean KL reward given only to two of its customers (ADR: reward audiences), with a third customer
 * who was taken off its list (soft-deleted). It reuses the published reward's terms and images, has no
 * referrals, and only its members see or can claim it.
 */
async function seedPrivateReward(people: SeedPeople, now: number): Promise<void> {
	const source = await prisma.reward.findUniqueOrThrow({
		where: { id: REWARD_SEED_IDS.klRewardPublished },
		include: { images: { where: { isDeleted: false }, orderBy: { position: "asc" }, select: { fileId: true } } },
	});
	const id = NOTIFICATION_SEED_IDS.privateReward;
	const reward: Prisma.RewardUncheckedCreateInput = {
		id,
		tenantId: source.tenantId,
		title: "A free cake for our regulars",
		description: "Thank you for coming back — a slice of any cake, on us.",
		rewardType: "FREE_ITEM",
		freeItemName: "Slice of cake (any)",
		freeItemSku: "BAK-CAKE-SLICE",
		rewardValue: 1,
		termsConditions: source.termsConditions,
		rewardKind: "CONSUMER",
		category: source.category,
		quantityTotal: 2,
		quantityRemaining: 2,
		startDate: at(now, DAY_MS),
		expiryDate: BigInt(now + 30 * DAY_MS),
		status: "PUBLISHED",
		referralsEnabled: false,
		locationScopeType: "ALL_LOCATIONS",
		audienceType: "SELECTED_CUSTOMERS",
		reviewedAt: at(now, DAY_MS),
		reviewedByUserId: people.adminId,
		createdBy: people.klOwnerId,
		createdAt: at(now, 2 * DAY_MS),
		updatedAt: at(now, DAY_MS),
	};
	await prisma.reward.upsert({ where: { id }, create: reward, update: reward });
	await prisma.rewardImage.deleteMany({ where: { rewardId: id } });
	await prisma.rewardImage.createMany({ data: source.images.map((image, position) => ({ rewardId: id, tenantId: source.tenantId, fileId: image.fileId, position })) });
	const removed = await prisma.user.findFirst({
		where: { email: { in: [...EXTRA_SEED_USER_EMAILS] }, isDeleted: false, id: { notIn: [people.customerId, people.otherCustomerId] } },
		orderBy: { email: "asc" },
		select: { id: true },
	});
	const members = [
		{ key: "customer", userId: people.customerId, removed: false },
		{ key: "other", userId: people.otherCustomerId, removed: false },
		...(removed === null ? [] : [{ key: "removed", userId: removed.id, removed: true }]),
	];
	for (const member of members) {
		const row: Prisma.RewardAudienceMemberUncheckedCreateInput = {
			id: deterministicUuid(NAMESPACE, `audience.${member.key}`),
			tenantId: source.tenantId,
			rewardId: id,
			userId: member.userId,
			createdBy: people.klOwnerId,
			createdAt: at(now, 2 * DAY_MS),
			updatedAt: member.removed ? at(now, DAY_MS) : at(now, 2 * DAY_MS),
			...(member.removed ? { isDeleted: true, deletedAt: at(now, DAY_MS), deletedBy: people.klOwnerId, updatedBy: people.klOwnerId } : {}),
		};
		await prisma.rewardAudienceMember.upsert({ where: { rewardId_userId: { rewardId: id, userId: member.userId } }, create: row, update: row });
	}
}

/** Everything above, for user@example.com and an extra seeded customer who both claimed from Brew & Bean KL. */
export async function seedNotificationsDemo(people: Omit<SeedPeople, "otherCustomerId" | "klOwnerId" | "mlkOwnerId">, now: number): Promise<NotificationsDemoSummary> {
	const other = await prisma.rewardClaim.findFirst({
		where: { isDeleted: false, reward: { tenantId: TENANT_SEED_IDS.klTenant }, user: { email: { in: [...EXTRA_SEED_USER_EMAILS] } } },
		orderBy: [{ createdAt: "asc" }, { id: "asc" }],
		select: { userId: true },
	});
	const all: SeedPeople = {
		...people,
		otherCustomerId: requireRow(other ?? undefined, "an extra customer with a Brew & Bean KL claim").userId,
		klOwnerId: REWARD_SEED_IDS.klOwnerUser,
		mlkOwnerId: REWARD_SEED_IDS.mlkOwnerUser,
	};
	await seedPrivateReward(all, now);
	const tenantCustomers = await seedTenantCustomers(all, now);
	await seedMarketingConsent(all, now);
	const testAccountConsents = await seedTestAccountConsent(now);
	await seedNotificationSettings(all);
	await seedSuppressions(all, now);
	const devices = await seedPushDevices(all, now);
	const notifications = await seedNotifications(all, devices.activeDeviceId, now);
	const broadcasts = await seedBroadcasts(all, now);
	await seedRateLimitOverrides(all, now);
	return { tenantCustomers, testAccountConsents, notifications, broadcasts, devices: devices.count };
}
