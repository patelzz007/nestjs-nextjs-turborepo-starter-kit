import { z } from "zod";

import { AuthFlowEventSchema, EmailLogUpdatedEventSchema, ImpersonationActionEventSchema, SessionActionEventSchema } from "../domain/platform/events";
import { RewardPlatformEventSchema } from "../domain/rewards/rewards-entities";

/** Kafka topics the API publishes platform events to. */
export const KafkaTopicSchema = z.enum(["platform.auth", "platform.sessions", "platform.impersonation", "platform.email", "platform.rewards"]);

export type KafkaTopic = z.output<typeof KafkaTopicSchema>;

export const KAFKA_TOPICS: readonly KafkaTopic[] = KafkaTopicSchema.options;

const AuthFlowEnvelopeSchema = z
	.object({
		type: z.literal("auth.flow"),
		correlationId: z.string().nullable(),
		occurredAt: z.number().int().nonnegative(),
		payload: AuthFlowEventSchema,
	})
	.strict();

const SessionActionEnvelopeSchema = z
	.object({
		type: z.literal("session.action"),
		correlationId: z.string().nullable(),
		occurredAt: z.number().int().nonnegative(),
		payload: SessionActionEventSchema,
	})
	.strict();

const ImpersonationActionEnvelopeSchema = z
	.object({
		type: z.literal("impersonation.action"),
		correlationId: z.string().nullable(),
		occurredAt: z.number().int().nonnegative(),
		payload: ImpersonationActionEventSchema,
	})
	.strict();

const EmailLogUpdatedEnvelopeSchema = z
	.object({
		type: z.literal("email.log.updated"),
		correlationId: z.string().nullable(),
		occurredAt: z.number().int().nonnegative(),
		payload: EmailLogUpdatedEventSchema,
	})
	.strict();

const RewardPlatformEnvelopeSchema = z
	.object({
		type: z.literal("reward.platform"),
		correlationId: z.string().nullable(),
		occurredAt: z.number().int().nonnegative(),
		payload: RewardPlatformEventSchema,
	})
	.strict();

/**
 * Discriminated envelope stored in `outbox_events.payload`. The stable event id
 * is the outbox row id — it is added on the wire ({@link PlatformEventMessageSchema}).
 */
export const PlatformEventEnvelopeSchema = z.discriminatedUnion("type", [
	AuthFlowEnvelopeSchema,
	SessionActionEnvelopeSchema,
	ImpersonationActionEnvelopeSchema,
	EmailLogUpdatedEnvelopeSchema,
	RewardPlatformEnvelopeSchema,
]);

export type PlatformEventEnvelope = z.output<typeof PlatformEventEnvelopeSchema>;

export type PlatformEventPayload = PlatformEventEnvelope["payload"];

export type PlatformEventType = PlatformEventEnvelope["type"];

const ENVELOPE_INPUT_KEYS: { readonly type: true; readonly payload: true } = { type: true, payload: true };

/**
 * What a producer hands to the outbox: the event type and its payload. The
 * outbox stamps `correlationId`, `occurredAt`, and the stable event id.
 */
export const PlatformEventInputSchema = z.discriminatedUnion("type", [
	AuthFlowEnvelopeSchema.pick(ENVELOPE_INPUT_KEYS),
	SessionActionEnvelopeSchema.pick(ENVELOPE_INPUT_KEYS),
	ImpersonationActionEnvelopeSchema.pick(ENVELOPE_INPUT_KEYS),
	EmailLogUpdatedEnvelopeSchema.pick(ENVELOPE_INPUT_KEYS),
	RewardPlatformEnvelopeSchema.pick(ENVELOPE_INPUT_KEYS),
]);

export type PlatformEventInput = z.output<typeof PlatformEventInputSchema>;

/** Stable, producer-assigned event id — the idempotency key for every consumer inbox. */
export const PlatformEventIdSchema = z.uuid();

export type PlatformEventId = z.output<typeof PlatformEventIdSchema>;

const EVENT_ID_SHAPE: { readonly eventId: typeof PlatformEventIdSchema } = { eventId: PlatformEventIdSchema };

/**
 * Wire contract for every Kafka message on a `platform.*` topic: the stored
 * envelope plus the stable `eventId`. A redelivered or republished message
 * always carries the same `eventId`, so consumers dedupe on it.
 */
export const PlatformEventMessageSchema = z.discriminatedUnion("type", [
	AuthFlowEnvelopeSchema.extend(EVENT_ID_SHAPE),
	SessionActionEnvelopeSchema.extend(EVENT_ID_SHAPE),
	ImpersonationActionEnvelopeSchema.extend(EVENT_ID_SHAPE),
	EmailLogUpdatedEnvelopeSchema.extend(EVENT_ID_SHAPE),
	RewardPlatformEnvelopeSchema.extend(EVENT_ID_SHAPE),
]);

export type PlatformEventMessage = z.output<typeof PlatformEventMessageSchema>;

/** Kafka topic each platform event type is published to. */
export const PLATFORM_EVENT_TOPICS: Readonly<Record<PlatformEventType, KafkaTopic>> = {
	"auth.flow": "platform.auth",
	"session.action": "platform.sessions",
	"impersonation.action": "platform.impersonation",
	"email.log.updated": "platform.email",
	"reward.platform": "platform.rewards",
};

/** Optional tenant tag publishers may include on any platform event payload. */
export const PlatformEventOrganizationIdSchema = z.object({
	organizationId: z.uuid(),
});

export type PlatformEventOrganizationId = z.output<typeof PlatformEventOrganizationIdSchema>;

/** Returns the tenant id when the publisher tagged the payload; otherwise null. */
export function readPlatformEventOrganizationId(payload: PlatformEventPayload): string | null {
	const parsed = PlatformEventOrganizationIdSchema.safeParse(payload);
	if (!parsed.success) {
		return null;
	}
	return parsed.data.organizationId;
}
