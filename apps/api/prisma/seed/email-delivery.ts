import type { DeliveryEventOutcome, EmailLogStatus } from "@workspace/shared";

import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";
import { requireRow } from "./require-row";

/**
 * Development-scenario sample of the outbound-email lifecycle, so the admin
 * email log and the delivery-event history (`email_delivery_events`) show
 * every state the API produces. Shaped exactly as the API writes them
 * (EmailSenderService + EmailLogRepository):
 *
 * - every row is written `pending` first and finalized (`sent` / `failed`); one
 *   row stays `pending` (an attempt whose provider call is still in flight);
 * - `metadata.mode` records the delivery mode; an admin test-send also records
 *   who triggered it (actor, correlation id, IP, user agent) — the row IS the
 *   domain audit record of that send;
 * - `last_event_at` is the provider time of the newest APPLIED webhook event;
 * - every event has a unique `webhook_id`, the status it maps to (null for
 *   tracking events) and its outcome — including an `unmatched` event for an
 *   email this system never sent (no `email_log_id`).
 */

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const SEED_RECIPIENT = "demo.recipient@example.com";
/** The admin who triggers the seeded test-send (users.ts). */
const TEST_SEND_ADMIN_EMAIL = "admin@example.com";

/** Who triggered a send — only the admin test-send records an actor. */
type SeedTrigger = "system" | "admin-test-send";

interface EmailEventSpec {
	readonly key: string;
	readonly eventType: string;
	readonly status: EmailLogStatus | null;
	readonly detail: string | null;
	readonly outcome: DeliveryEventOutcome;
	/** Provider time, minutes after the send. */
	readonly minutesAfterSend: number;
}

interface EmailLogSpec {
	readonly key: string;
	readonly templateKey: string;
	readonly subject: string;
	readonly status: EmailLogStatus;
	/** False for attempts the provider never accepted (still pending, or failed before an id was issued). */
	readonly hasProviderId: boolean;
	readonly error: string | null;
	readonly trigger: SeedTrigger;
	readonly hoursAgo: number;
	readonly events: readonly EmailEventSpec[];
}

const LOG_SPECS: readonly EmailLogSpec[] = [
	{
		key: "welcome-delivered",
		templateKey: "welcome",
		subject: "Welcome aboard!",
		status: "delivered",
		hasProviderId: true,
		error: null,
		trigger: "system",
		hoursAgo: 30,
		events: [
			{ key: "sent", eventType: "email.sent", status: "sent", detail: null, outcome: "applied", minutesAfterSend: 0 },
			{ key: "delivered", eventType: "email.delivered", status: "delivered", detail: null, outcome: "applied", minutesAfterSend: 1 },
			{ key: "opened", eventType: "email.opened", status: null, detail: null, outcome: "ignored", minutesAfterSend: 9 },
		],
	},
	{
		key: "reset-bounced",
		templateKey: "password-reset",
		subject: "Reset your password",
		status: "bounced",
		hasProviderId: true,
		error: "permanent — 550 5.1.1 user unknown",
		trigger: "system",
		hoursAgo: 6,
		events: [
			{ key: "bounced", eventType: "email.bounced", status: "bounced", detail: "permanent — 550 5.1.1 user unknown", outcome: "applied", minutesAfterSend: 2 },
			// Arrived after the bounce but was observed earlier by the provider: recorded, not applied.
			{ key: "late-sent", eventType: "email.sent", status: "sent", detail: null, outcome: "stale", minutesAfterSend: 0 },
		],
	},
	{
		key: "verification-sent",
		templateKey: "verification",
		subject: "Verify your email address",
		status: "sent",
		hasProviderId: true,
		error: null,
		trigger: "system",
		hoursAgo: 1,
		events: [],
	},
	{
		key: "admin-test-send",
		templateKey: "security-alert",
		subject: "Security alert on your account",
		status: "complained",
		hasProviderId: true,
		error: "abuse",
		trigger: "admin-test-send",
		hoursAgo: 3,
		events: [
			{ key: "delivered", eventType: "email.delivered", status: "delivered", detail: null, outcome: "applied", minutesAfterSend: 1 },
			{ key: "complained", eventType: "email.complained", status: "complained", detail: "abuse", outcome: "applied", minutesAfterSend: 40 },
		],
	},
	{
		key: "login-code-failed",
		templateKey: "login-verification",
		subject: "Your login verification code",
		status: "failed",
		hasProviderId: false,
		error: "Resend rate limit exceeded",
		trigger: "system",
		hoursAgo: 2,
		events: [],
	},
	{
		key: "welcome-in-flight",
		templateKey: "welcome",
		subject: "Welcome aboard!",
		status: "pending",
		hasProviderId: false,
		error: null,
		trigger: "system",
		hoursAgo: 0,
		events: [],
	},
];

/** Signed events for emails this system never sent (e.g. sent from the Resend dashboard). */
const UNMATCHED_EVENT_SPECS: readonly EmailEventSpec[] = [
	{ key: "dashboard-delivered", eventType: "email.delivered", status: "delivered", detail: null, outcome: "unmatched", minutesAfterSend: 0 },
];

export interface EmailDeliveryEventSeedRow {
	readonly id: string;
	readonly webhookId: string;
	readonly eventType: string;
	readonly resendId: string;
	readonly status: EmailLogStatus | null;
	readonly detail: string | null;
	readonly occurredAt: bigint;
	readonly outcome: DeliveryEventOutcome;
}

/** `email_logs.metadata` exactly as the sender writes it. */
export type EmailLogSeedMetadata = Readonly<Record<string, string>>;

export interface EmailLogSeedRow {
	readonly id: string;
	readonly templateKey: string;
	readonly to: string;
	readonly subject: string;
	readonly status: EmailLogStatus;
	readonly resendId: string | null;
	readonly error: string | null;
	readonly metadata: EmailLogSeedMetadata;
	readonly lastEventAt: bigint | null;
	readonly createdAt: bigint;
	readonly events: readonly EmailDeliveryEventSeedRow[];
}

export interface EmailDeliverySeed {
	readonly logs: readonly EmailLogSeedRow[];
	/** Events with no email log row (`outcome = unmatched`, `email_log_id` NULL). */
	readonly unmatchedEvents: readonly EmailDeliveryEventSeedRow[];
}

function eventRow(scope: string, event: EmailEventSpec, resendId: string, sentAt: number): EmailDeliveryEventSeedRow {
	return {
		id: deterministicUuid("email-delivery-event-seed", `${scope}:${event.key}`),
		webhookId: `msg_seed_${scope}_${event.key}`,
		eventType: event.eventType,
		resendId,
		status: event.status,
		detail: event.detail,
		occurredAt: BigInt(sentAt + event.minutesAfterSend * MS_PER_MINUTE),
		outcome: event.outcome,
	};
}

function metadataFor(spec: EmailLogSpec, actorUserId: string): EmailLogSeedMetadata {
	if (spec.trigger === "system") {
		return { mode: "send" };
	}
	return {
		mode: "send",
		trigger: spec.trigger,
		actorUserId,
		correlationId: `seed-${spec.key}`,
		ipAddress: "198.51.100.24",
		userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
	};
}

/** Pure, deterministic rows (timestamps relative to `nowMs`; `actorUserId` = the admin who test-sent). */
export function buildEmailDeliverySeed(nowMs: number, actorUserId: string): EmailDeliverySeed {
	const logs = LOG_SPECS.map((spec: EmailLogSpec): EmailLogSeedRow => {
		const sentAt: number = nowMs - spec.hoursAgo * MS_PER_HOUR;
		const resendId: string = deterministicUuid("email-log-seed-resend-id", spec.key);
		const events = spec.events.map((event: EmailEventSpec): EmailDeliveryEventSeedRow => eventRow(spec.key, event, resendId, sentAt));
		const applied: readonly bigint[] = events.filter((event) => event.outcome === "applied" && event.status !== null).map((event) => event.occurredAt);
		const lastEventAt: bigint | null = applied.reduce<bigint | null>((latest, at) => (latest === null || at > latest ? at : latest), null);
		return {
			id: deterministicUuid("email-log-seed", spec.key),
			templateKey: spec.templateKey,
			to: SEED_RECIPIENT,
			subject: spec.subject,
			status: spec.status,
			resendId: spec.hasProviderId ? resendId : null,
			error: spec.error,
			metadata: metadataFor(spec, actorUserId),
			lastEventAt,
			createdAt: BigInt(sentAt),
			events,
		};
	});
	const unmatchedEvents = UNMATCHED_EVENT_SPECS.map((event: EmailEventSpec): EmailDeliveryEventSeedRow =>
		eventRow("unmatched", event, deterministicUuid("email-log-seed-resend-id", `unmatched:${event.key}`), nowMs - MS_PER_HOUR),
	);
	return { logs, unmatchedEvents };
}

async function upsertEvent(event: EmailDeliveryEventSeedRow, emailLogId: string | null): Promise<void> {
	const data = {
		webhookId: event.webhookId,
		eventType: event.eventType,
		resendId: event.resendId,
		emailLogId,
		status: event.status,
		detail: event.detail,
		occurredAt: event.occurredAt,
		outcome: event.outcome,
	};
	// Upsert by the natural key (`webhook_id` is UNIQUE), exactly like the webhook dedupes.
	await prisma.emailDeliveryEvent.upsert({ where: { webhookId: event.webhookId }, create: { id: event.id, ...data }, update: data });
}

/** Idempotent upsert of the sample email logs + delivery events; returns the number of events seeded. */
export async function seedEmailDelivery(nowMs: number = Date.now()): Promise<number> {
	const admin = requireRow((await prisma.user.findUnique({ where: { email: TEST_SEND_ADMIN_EMAIL }, select: { id: true } })) ?? undefined, TEST_SEND_ADMIN_EMAIL);
	const seed = buildEmailDeliverySeed(nowMs, admin.id);
	let eventCount = 0;
	for (const row of seed.logs) {
		const data = {
			templateKey: row.templateKey,
			to: row.to,
			subject: row.subject,
			status: row.status,
			resendId: row.resendId,
			error: row.error,
			metadata: row.metadata,
			lastEventAt: row.lastEventAt,
			createdAt: row.createdAt,
			updatedAt: row.lastEventAt ?? row.createdAt,
		};
		await prisma.emailLog.upsert({ where: { id: row.id }, create: { id: row.id, ...data }, update: data });
		for (const event of row.events) {
			await upsertEvent(event, row.id);
			eventCount += 1;
		}
	}
	for (const event of seed.unmatchedEvents) {
		await upsertEvent(event, null);
		eventCount += 1;
	}
	return eventCount;
}
