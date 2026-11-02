import type { JsonObject } from "@workspace/shared";
import { z } from "zod";

import { defineNotificationType, type TypedNotificationType } from "../notification-type";
import { ALL_SURFACES } from "./security.types";

const BroadcastMessagePayloadSchema = z
	.object({
		broadcastId: z.uuid(),
		title: z.string().min(1).max(200),
		/** Plain-text preview of the body (push and the inbox row). */
		preview: z.string().max(240),
		senderName: z.string().min(1).max(200),
		senderLogoUrl: z.string().max(500).nullable(),
	})
	.strict();
export type BroadcastMessagePayload = z.output<typeof BroadcastMessagePayloadSchema>;

/**
 * A broadcast (ADR 073), as each recipient receives it. Its category comes from the broadcast; its email
 * body is the broadcast's rendered rich text (the fan-out builds it from the broadcast), so the email
 * renderer here is only the fallback shape.
 */
export const BROADCAST_MESSAGE_NOTIFICATION: TypedNotificationType<BroadcastMessagePayload> = defineNotificationType({
	key: "broadcasts.message",
	description: "A broadcast from a business or from the platform",
	category: "MARKETING",
	categoryOverridable: true,
	surfaces: ALL_SURFACES,
	channels: ["IN_APP", "EMAIL", "PUSH"],
	urgency: "normal",
	sensitive: false,
	allowsContactRecipient: false,
	digestible: false,
	grouping: null,
	payloadSchema: BroadcastMessagePayloadSchema,
	toJson: (payload: BroadcastMessagePayload): JsonObject => ({ ...payload }),
	samplePayload: {
		broadcastId: "0193f2c4-0000-7000-8000-000000000006",
		title: "Weekend 2-for-1",
		preview: "Bring a friend this Saturday…",
		senderName: "Acme Coffee",
		senderLogoUrl: null,
	},
	renderers: {
		en: {
			inApp: (payload) => ({ title: payload.title, body: payload.preview, link: null, icon: "megaphone" }),
			push: (payload) => ({ title: payload.senderName, body: `${payload.title}\n${payload.preview}`, link: null }),
			email: (payload) => ({ subject: payload.title, eyebrow: payload.senderName, heading: payload.title, paragraphs: [payload.preview], action: null }),
		},
	},
});

const TestPayloadSchema = z.object({ requestedBy: z.string().min(1).max(200) }).strict();
type TestPayload = z.output<typeof TestPayloadSchema>;

/** Platform staff's "Send test": one of each channel to themselves. */
export const TEST_NOTIFICATION: TypedNotificationType<TestPayload> = defineNotificationType({
	key: "notifications.test",
	description: "A test sent from the admin catalog",
	category: "ACCOUNT",
	surfaces: ALL_SURFACES,
	channels: ["IN_APP", "EMAIL", "PUSH", "SMS"],
	urgency: "immediate",
	sensitive: false,
	allowsContactRecipient: false,
	digestible: false,
	grouping: null,
	payloadSchema: TestPayloadSchema,
	toJson: (payload: TestPayload): JsonObject => ({ ...payload }),
	samplePayload: { requestedBy: "Platform staff" },
	renderers: {
		en: {
			inApp: (payload) => ({ title: "Test notification", body: `Sent by ${payload.requestedBy} from the notification catalog.`, link: null, icon: "bell" }),
			email: (payload, context) => ({
				subject: `Test notification from ${context.appName}`,
				eyebrow: "Test",
				heading: "Test notification",
				paragraphs: [`Sent by ${payload.requestedBy} from the notification catalog. Email delivery works.`],
				action: null,
			}),
			push: () => ({ title: "Test notification", body: "Push delivery works.", link: null }),
			sms: (_payload, context) => ({ text: `${context.appName}: test SMS. SMS delivery works.` }),
		},
	},
});
