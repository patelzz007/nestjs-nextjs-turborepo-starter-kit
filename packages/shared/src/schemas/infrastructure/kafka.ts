import { z } from "zod";

import { AuthFlowEventSchema, EmailLogUpdatedEventSchema, ImpersonationActionEventSchema, SessionActionEventSchema } from "../domain/events";
import { RewardPlatformEventSchema } from "../domain/rewards";

/** Kafka topics the API publishes platform events to. */
export const KAFKA_TOPICS: ["platform.auth", "platform.sessions", "platform.impersonation", "platform.email", "platform.rewards"] = [
	"platform.auth",
	"platform.sessions",
	"platform.impersonation",
	"platform.email",
	"platform.rewards",
];

export const KafkaTopicSchema = z.enum(KAFKA_TOPICS);

export type KafkaTopic = z.output<typeof KafkaTopicSchema>;

/** Discriminated envelope for every outbound Kafka message. */
export const PlatformEventEnvelopeSchema = z.discriminatedUnion("type", [
	z
		.object({
			type: z.literal("auth.flow"),
			correlationId: z.string().nullable(),
			occurredAt: z.number().int().nonnegative(),
			payload: AuthFlowEventSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("session.action"),
			correlationId: z.string().nullable(),
			occurredAt: z.number().int().nonnegative(),
			payload: SessionActionEventSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("impersonation.action"),
			correlationId: z.string().nullable(),
			occurredAt: z.number().int().nonnegative(),
			payload: ImpersonationActionEventSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("email.log.updated"),
			correlationId: z.string().nullable(),
			occurredAt: z.number().int().nonnegative(),
			payload: EmailLogUpdatedEventSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("reward.platform"),
			correlationId: z.string().nullable(),
			occurredAt: z.number().int().nonnegative(),
			payload: RewardPlatformEventSchema,
		})
		.strict(),
]);

export type PlatformEventEnvelope = z.output<typeof PlatformEventEnvelopeSchema>;
